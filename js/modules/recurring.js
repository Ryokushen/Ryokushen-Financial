// js/modules/recurring.js
import db from '../database.js';
import {
  safeParseFloat,
  escapeHtml,
  formatDate,
  formatCurrency,
  getDueDateClass,
  getDueDateText,
  convertToMonthly,
  getNextDueDate,
} from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import { debug } from './debug.js';
import { subtractMoney, addMoney } from './financialMath.js';
import { loadingState } from './loadingState.js';
import {
  validateForm,
  ValidationSchemas,
  showFieldError,
  clearFormErrors,
  CrossFieldValidators,
  validateFormWithCrossFields,
} from './validation.js';
import { calendarUI } from './calendarUI.js';
import { eventManager } from './eventManager.js';
import { transactionManager } from './transactionManager.js';

export function setupEventListeners(appState, onUpdate) {
  // Cache DOM elements
  const addRecurringBtn = document.getElementById('add-recurring-btn');
  const closeRecurringModalBtn = document.getElementById('close-recurring-modal');
  const cancelRecurringBtn = document.getElementById('cancel-recurring-btn');
  const recurringForm = document.getElementById('recurring-form');
  const recurringPaymentMethod = document.getElementById('recurring-payment-method');
  const calendarViewToggle = document.getElementById('calendar-view-toggle');

  if (addRecurringBtn) {
    eventManager.addEventListener(addRecurringBtn, 'click', () =>
      openRecurringModal(appState.appData)
    );
  }
  if (closeRecurringModalBtn) {
    eventManager.addEventListener(closeRecurringModalBtn, 'click', () =>
      closeModal('recurring-modal')
    );
  }
  if (cancelRecurringBtn) {
    eventManager.addEventListener(cancelRecurringBtn, 'click', () => closeModal('recurring-modal'));
  }
  if (recurringForm) {
    eventManager.addEventListener(recurringForm, 'submit', e =>
      handleRecurringSubmit(e, appState, onUpdate)
    );
  }

  // Calendar integration
  setupCalendarEventListeners(appState, onUpdate);

  // NEW: Payment method change handler
  if (recurringPaymentMethod) {
    eventManager.addEventListener(recurringPaymentMethod, 'change', () => {
      togglePaymentMethodFields();
    });
  }

  // View toggle for calendar/list view
  if (calendarViewToggle) {
    eventManager.addEventListener(calendarViewToggle, 'change', e => {
      toggleCalendarView(e.target.value, appState);
    });
  }
}

// Setup calendar-specific event listeners
function setupCalendarEventListeners(appState, onUpdate) {
  // Listen for calendar data requests
  eventManager.addEventListener(window, 'calendar:needsData', () => {
    if (appState.appData.recurringBills) {
      calendarUI.updateData(appState.appData.recurringBills);
    }
  });

  // Listen for pay bill events from calendar
  eventManager.addEventListener(window, 'calendar:payBill', e => {
    if (e.detail && e.detail.billId) {
      payRecurringBill(e.detail.billId, appState, onUpdate);
    }
  });
}

// Toggle between calendar and list views
function toggleCalendarView(view, appState) {
  const calendarContainer = document.getElementById('calendar-container');
  const listContainer = document.getElementById('upcoming-bills-list');

  if (view === 'month') {
    calendarContainer.style.display = 'block';
    listContainer.style.display = 'none';

    // Initialize calendar if not already done
    if (!calendarUI.isInitialized) {
      calendarUI.init();
    }

    // Update calendar data after initialization
    if (appState && appState.appData.recurringBills) {
      calendarUI.updateData(appState.appData.recurringBills);
    }
  } else {
    calendarContainer.style.display = 'none';
    listContainer.style.display = 'block';
  }
}

// NEW: Toggle payment method fields based on selection
function togglePaymentMethodFields() {
  const paymentMethod = document.getElementById('recurring-payment-method').value;
  const cashAccountGroup = document.getElementById('cash-account-group');
  const creditAccountGroup = document.getElementById('credit-account-group');

  if (paymentMethod === 'cash') {
    cashAccountGroup.style.display = 'block';
    creditAccountGroup.style.display = 'none';
    // Clear credit card selection
    document.getElementById('recurring-debt-account').value = '';
  } else if (paymentMethod === 'credit') {
    cashAccountGroup.style.display = 'none';
    creditAccountGroup.style.display = 'block';
    // Clear cash account selection
    document.getElementById('recurring-account').value = '';
  }
}

function openRecurringModal(appData, billId = null) {
  // First populate the account dropdowns
  populateRecurringAccountDropdowns(appData);

  const modalData = { billId };

  // Populate after modal opens and form is reset
  setTimeout(() => {
    if (billId) {
      const bill = appData.recurringBills.find(b => b.id === billId);
      if (bill) {
        document.getElementById('recurring-id').value = bill.id;
        document.getElementById('recurring-name').value = bill.name;
        document.getElementById('recurring-category').value = bill.category;
        document.getElementById('recurring-amount').value = bill.amount;
        document.getElementById('recurring-frequency').value = bill.frequency;
        document.getElementById('recurring-next-due').value = bill.nextDue || bill.next_due;
        document.getElementById('recurring-notes').value = bill.notes || '';
        document.getElementById('recurring-active').checked = bill.active !== false;

        // Set payment method and accounts
        const paymentMethod = bill.payment_method || 'cash';
        document.getElementById('recurring-payment-method').value = paymentMethod;

        if (paymentMethod === 'cash') {
          document.getElementById('recurring-account').value = bill.account_id;
        } else {
          document.getElementById('recurring-debt-account').value = bill.debt_account_id;
        }

        togglePaymentMethodFields();
      }
    } else {
      document.getElementById('recurring-id').value = '';
      document.getElementById('recurring-active').checked = true;
      document.getElementById('recurring-payment-method').value = 'cash';
      document.getElementById('recurring-next-due').value = new Date().toISOString().split('T')[0];
      togglePaymentMethodFields();
    }
  }, 0);

  openModal('recurring-modal', modalData);
}

// UPDATED: Populate both cash and debt account dropdowns
function populateRecurringAccountDropdowns(appData) {
  const cashSelect = document.getElementById('recurring-account');
  const debtSelect = document.getElementById('recurring-debt-account');

  if (!cashSelect || !debtSelect) {
    return;
  }

  // Populate cash accounts
  const activeAccounts = appData.cashAccounts.filter(a => a.isActive);
  const currentCashValue = cashSelect.value;

  cashSelect.innerHTML = '<option value="" disabled selected>Select Cash Account</option>';
  activeAccounts.forEach(account => {
    cashSelect.innerHTML += `<option value="${account.id}">${escapeHtml(account.name)}</option>`;
  });

  if (currentCashValue) {
    cashSelect.value = currentCashValue;
  }

  // NEW: Populate debt accounts (credit cards, etc.)
  const creditCards = appData.debtAccounts.filter(d => d.type === 'Credit Card');
  const currentDebtValue = debtSelect.value;

  debtSelect.innerHTML = '<option value="" disabled selected>Select Credit Card</option>';
  creditCards.forEach(account => {
    debtSelect.innerHTML += `<option value="${account.id}">${escapeHtml(account.name)}</option>`;
  });

  if (currentDebtValue) {
    debtSelect.value = currentDebtValue;
  }
}

async function handleRecurringSubmit(event, appState, onUpdate) {
  event.preventDefault();

  // Clear previous errors
  clearFormErrors('recurring-form');

  try {
    const billId = document.getElementById('recurring-id').value;
    const paymentMethod = document.getElementById('recurring-payment-method').value;

    const formData = {
      name: document.getElementById('recurring-name').value.trim(),
      category: document.getElementById('recurring-category').value,
      amount: safeParseFloat(document.getElementById('recurring-amount').value),
      frequency: document.getElementById('recurring-frequency').value,
      nextDue: document.getElementById('recurring-next-due').value,
    };

    // Validate form data with cross-field validation
    const { errors, hasErrors } = validateFormWithCrossFields(
      formData,
      ValidationSchemas.recurringBill,
      CrossFieldValidators.recurringBill
    );

    if (hasErrors) {
      // Show field-level errors
      Object.entries(errors).forEach(([field, error]) => {
        const fieldId = field === 'nextDue' ? 'recurring-next-due' : `recurring-${field}`;
        showFieldError(fieldId, error);
      });
      showError('Please correct the errors in the form.');
      return;
    }

    // NEW: Validate payment method selection
    let accountId = null;
    let debtAccountId = null;

    if (paymentMethod === 'cash') {
      accountId = parseInt(document.getElementById('recurring-account').value);
      if (!accountId || isNaN(accountId)) {
        showError('Please select a valid cash account.');
        return;
      }
    } else if (paymentMethod === 'credit') {
      debtAccountId = parseInt(document.getElementById('recurring-debt-account').value);
      if (!debtAccountId || isNaN(debtAccountId)) {
        showError('Please select a valid credit card.');
        return;
      }
    } else {
      showError('Please select a payment method.');
      return;
    }

    // FIXED: Build bill data using formData object for amount and nextDue
    const billData = {
      name: formData.name,
      category: formData.category,
      amount: formData.amount, // Fixed: was 'amount' (undefined), now 'formData.amount'
      frequency: formData.frequency,
      next_due: formData.nextDue, // Fixed: was 'nextDue' (undefined), now 'formData.nextDue'
      payment_method: paymentMethod,
      account_id: accountId,
      debt_account_id: debtAccountId,
      notes: document.getElementById('recurring-notes').value.trim(),
      active: document.getElementById('recurring-active').checked,
    };

    // Additional validation
    if (!billData.name) {
      showError('Bill name is required.');
      return;
    }

    if (!billData.category) {
      showError('Please select a category.');
      return;
    }

    if (!billData.frequency) {
      showError('Please select a billing frequency.');
      return;
    }

    debug.log('Submitting bill data:', billData);

    let savedBill;
    if (billId) {
      savedBill = await db.updateRecurringBill(parseInt(billId), billData);
      const index = appState.appData.recurringBills.findIndex(b => b.id === parseInt(billId));
      if (index > -1) {
        appState.appData.recurringBills[index] = {
          ...savedBill,
          amount: parseFloat(savedBill.amount),
          nextDue: savedBill.next_due,
          paymentMethod: savedBill.payment_method,
          debtAccountId: savedBill.debt_account_id,
          active: savedBill.active,
        };
      }
    } else {
      savedBill = await db.addRecurringBill(billData);
      appState.appData.recurringBills.push({
        ...savedBill,
        amount: parseFloat(savedBill.amount),
        nextDue: savedBill.next_due,
        paymentMethod: savedBill.payment_method,
        debtAccountId: savedBill.debt_account_id,
        active: savedBill.active,
      });
    }

    closeModal('recurring-modal');

    // Dispatch event for calendar update
    window.dispatchEvent(new CustomEvent('recurring:updated', { detail: savedBill }));

    onUpdate();
    announceToScreenReader('Recurring bill saved successfully.');
  } catch (error) {
    debug.error('Error saving recurring bill:', error);
    showError(`Failed to save recurring bill: ${error.message}`);
  }
}

async function deleteRecurringBill(id, appState, onUpdate) {
  const bill = appState.appData.recurringBills.find(b => b.id === id);
  if (!bill) {
    return;
  }

  if (confirm(`Are you sure you want to delete "${bill.name}"?`)) {
    try {
      await db.deleteRecurringBill(id);
      appState.appData.recurringBills = appState.appData.recurringBills.filter(b => b.id !== id);

      // Dispatch event for calendar update
      window.dispatchEvent(new CustomEvent('recurring:deleted', { detail: { id } }));

      onUpdate();
      announceToScreenReader('Recurring bill deleted.');
    } catch (error) {
      debug.error('Error deleting recurring bill:', error);
      showError('Failed to delete recurring bill.');
    }
  }
}

// UPDATED: Support both cash and credit card payments using TransactionManager
async function payRecurringBill(id, appState, onUpdate) {
  const bill = appState.appData.recurringBills.find(b => b.id === id);
  if (!bill) {
    return;
  }

  const paymentMethod = bill.paymentMethod || bill.payment_method || 'cash';

  if (
    confirm(
      `Pay ${bill.name} for ${formatCurrency(bill.amount)} via ${paymentMethod === 'credit' ? 'credit card' : 'cash account'}?`
    )
  ) {
    loadingState.showOperationLock(`Processing payment for ${bill.name}...`);
    try {
      let savedTransaction;

      if (paymentMethod === 'cash') {
        // Cash payment using TransactionManager
        const transaction = {
          date: new Date().toISOString().split('T')[0],
          account_id: bill.account_id,
          category: bill.category,
          description: `${bill.name} (Recurring)`,
          amount: -bill.amount,
          cleared: true,
        };

        savedTransaction = await transactionManager.addTransaction(transaction);
        appState.appData.transactions.unshift({
          ...savedTransaction,
          amount: parseFloat(savedTransaction.amount),
        });

        // Balance will be recalculated automatically for cash accounts
      } else if (paymentMethod === 'credit') {
        // Credit card payment using TransactionManager with atomic balance update
        const debtAccountId = bill.debtAccountId || bill.debt_account_id;
        if (!debtAccountId) {
          showError('No credit card account found for this bill.');
          return;
        }

        // Create a debt transaction with atomic balance update
        const transaction = {
          date: new Date().toISOString().split('T')[0],
          account_id: null, // No cash account involved
          category: bill.category,
          description: `${bill.name} (Recurring - Credit Card)`,
          amount: -bill.amount, // Negative amount will be negated to positive by transactionManager
          cleared: true,
          debt_account_id: debtAccountId,
        };

        // Use atomic operation to create transaction and update balance
        savedTransaction = await transactionManager.createTransactionWithBalanceUpdate(
          transaction,
          [{ accountType: 'debt', accountId: debtAccountId, amount: -bill.amount }]
        );

        appState.appData.transactions.unshift({
          ...savedTransaction,
          amount: parseFloat(savedTransaction.amount),
        });

        // Update local debt account balance
        const debtAccount = appState.appData.debtAccounts.find(d => d.id === debtAccountId);
        if (debtAccount) {
          // Fetch updated balance from database to ensure consistency
          const updatedAccount = await db.getDebtAccountById(debtAccountId);
          if (updatedAccount) {
            debtAccount.balance = updatedAccount.balance;
          }
        }
      }

      // Update next due date
      const newNextDue = getNextDueDate(bill.nextDue || bill.next_due, bill.frequency);
      bill.nextDue = newNextDue;
      bill.next_due = newNextDue;

      await db.updateRecurringBill(bill.id, {
        next_due: newNextDue,
        active: bill.active,
        payment_method: paymentMethod,
        account_id: bill.account_id,
        debt_account_id: bill.debtAccountId || bill.debt_account_id,
      });

      // Fetch the updated bill from database to ensure all fields are current
      const updatedBill = await db.getRecurringBillById(bill.id);
      if (updatedBill) {
        // Update the bill in appState with all the latest data
        const billIndex = appState.appData.recurringBills.findIndex(b => b.id === bill.id);
        if (billIndex !== -1) {
          appState.appData.recurringBills[billIndex] = {
            ...updatedBill,
            amount: parseFloat(updatedBill.amount),
            nextDue: updatedBill.next_due,
            paymentMethod: updatedBill.payment_method,
            debtAccountId: updatedBill.debt_account_id,
            active: updatedBill.active
          };
        }
      }

      loadingState.hideOperationLock();
      onUpdate();
      announceToScreenReader('Payment recorded successfully.');
    } catch (error) {
      loadingState.hideOperationLock();
      debug.error('Error paying bill:', error);
      showError('Failed to record payment.');
    }
  }
}

export function renderRecurringBills(appState) {
  const { appData } = appState;
  renderSummary(appData);
  renderUpcomingBills(appData);
  renderBillsCardGrid(appState); // New card grid rendering

  // Check if calendar view is selected
  const viewToggle = document.getElementById('calendar-view-toggle');
  if (viewToggle && viewToggle.value === 'month') {
    // Initialize calendar if needed
    if (!calendarUI.isInitialized) {
      calendarUI.init();
    }
    // Update calendar with recurring bills data
    if (appData.recurringBills) {
      calendarUI.updateData(appData.recurringBills);
    }
  }
}

function renderSummary(appData) {
  const activeBills = appData.recurringBills.filter(bill => bill.active !== false);
  const monthlyTotal = activeBills.reduce(
    (sum, bill) => sum + convertToMonthly(bill.amount, bill.frequency),
    0
  );

  // Update summary elements if they exist (they may not exist in the redesigned UI)
  const monthlyTotalEl = document.getElementById('recurring-monthly-total');
  if (monthlyTotalEl) {
    monthlyTotalEl.textContent = formatCurrency(monthlyTotal);
  }

  const annualTotalEl = document.getElementById('recurring-annual-total');
  if (annualTotalEl) {
    annualTotalEl.textContent = formatCurrency(monthlyTotal * 12);
  }

  const countEl = document.getElementById('recurring-count');
  if (countEl) {
    countEl.textContent = activeBills.length.toString();
  }
}

function renderUpcomingBills(appData) {
  const upcomingList = document.getElementById('upcoming-bills-list');
  if (!upcomingList) {
    return;
  }

  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const upcomingBills = appData.recurringBills
    .filter(bill => {
      const dueDate = new Date(bill.nextDue || bill.next_due);
      const isActive = bill.active !== false;
      return isActive && dueDate >= today && dueDate <= thirtyDaysFromNow;
    })
    .sort((a, b) => new Date(a.nextDue || a.next_due) - new Date(b.nextDue || b.next_due));

  if (upcomingBills.length === 0) {
    upcomingList.innerHTML = '<div class="empty-state">No bills due in the next 30 days.</div>';
    return;
  }

  upcomingList.innerHTML = upcomingBills
    .map(bill => {
      const paymentMethod = bill.paymentMethod || bill.payment_method || 'cash';
      let accountName = 'N/A';

      if (paymentMethod === 'cash') {
        const account = appData.cashAccounts.find(a => a.id === bill.account_id);
        accountName = account ? escapeHtml(account.name) : 'N/A';
      } else {
        const debtAccountId = bill.debtAccountId || bill.debt_account_id;
        const account = appData.debtAccounts.find(d => d.id === debtAccountId);
        accountName = account ? `${escapeHtml(account.name)} (Credit Card)` : 'N/A';
      }

      const dueDate = bill.nextDue || bill.next_due;
      return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-description">${escapeHtml(bill.name)}</div>
                    <div class="transaction-details">${formatDate(dueDate)} - ${accountName}</div>
                </div>
                <div class="transaction-amount negative" data-sensitive="true">${formatCurrency(-bill.amount)}</div>
            </div>
        `;
    })
    .join('');
}

// UPDATED: Display payment method information
// New function to render bills in card grid layout
function renderBillsCardGrid(appState) {
  const { appData } = appState;
  const billsGrid = document.getElementById('recurring-bills-grid');
  if (!billsGrid) {
    return;
  }

  if (appData.recurringBills.length === 0) {
    billsGrid.innerHTML =
      '<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">No recurring bills added yet.</div>';
    return;
  }

  // Sort bills by next due date
  const sortedBills = [...appData.recurringBills].sort((a, b) => {
    const dateA = new Date(a.nextDue || a.next_due);
    const dateB = new Date(b.nextDue || b.next_due);
    return dateA - dateB;
  });

  billsGrid.innerHTML = sortedBills
    .map(bill => {
      const paymentMethod = bill.paymentMethod || bill.payment_method || 'cash';
      const isActive = bill.active !== false;
      const dueDate = bill.nextDue || bill.next_due;
      const today = new Date();
      const dueDateObj = new Date(dueDate);
      const daysUntil = Math.ceil((dueDateObj - today) / (1000 * 60 * 60 * 24));

      let accountInfo = '';
      if (paymentMethod === 'cash') {
        const account = appData.cashAccounts.find(a => a.id === bill.account_id);
        accountInfo = account ? account.name : 'Cash Account';
      } else {
        const debtAccountId = bill.debtAccountId || bill.debt_account_id;
        const account = appData.debtAccounts.find(d => d.id === debtAccountId);
        accountInfo = account ? account.name : 'Credit Card';
      }

      // Get icon based on bill name or category
      const getBillIcon = name => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('gym') || lowerName.includes('fitness')) {
          return '🏋️';
        }
        if (lowerName.includes('phone') || lowerName.includes('mobile')) {
          return '📱';
        }
        if (lowerName.includes('internet') || lowerName.includes('wifi')) {
          return '🌐';
        }
        if (lowerName.includes('electric') || lowerName.includes('power')) {
          return '⚡';
        }
        if (lowerName.includes('water')) {
          return '💧';
        }
        if (lowerName.includes('gas')) {
          return '🔥';
        }
        if (lowerName.includes('insurance')) {
          return '🛡️';
        }
        if (lowerName.includes('rent') || lowerName.includes('mortgage')) {
          return '🏠';
        }
        if (lowerName.includes('car') || lowerName.includes('auto')) {
          return '🚗';
        }
        if (
          lowerName.includes('streaming') ||
          lowerName.includes('netflix') ||
          lowerName.includes('youtube')
        ) {
          return '🎬';
        }
        if (lowerName.includes('music') || lowerName.includes('spotify')) {
          return '🎵';
        }
        if (lowerName.includes('cloud') || lowerName.includes('storage')) {
          return '☁️';
        }
        if (lowerName.includes('subscription')) {
          return '💳';
        }
        return '💸';
      };

      return `
        <div class="bill-card ${!isActive ? 'inactive' : ''}" data-id="${bill.id}">
            <div class="bill-card__icon">${getBillIcon(bill.name)}</div>
            <div class="bill-card__amount" data-sensitive="true">${formatCurrency(bill.amount)}</div>
            <div class="bill-card__name">${escapeHtml(bill.name)}</div>
            <div class="bill-card__details">
                <div>📅 Next Due: ${formatDate(dueDate)}</div>
                <div>🔄 Frequency: ${escapeHtml(bill.frequency)}</div>
                <div>💳 ${escapeHtml(accountInfo)}</div>
            </div>
            <div class="bill-card__actions">
                <button class="btn btn--primary btn-pay-bill" data-id="${bill.id}">Pay Bill</button>
                <button class="btn btn--secondary btn-edit-bill" data-id="${bill.id}">Edit</button>
                <button class="icon-btn btn-delete-bill" data-id="${bill.id}" title="Delete">🗑️</button>
            </div>
        </div>
        `;
    })
    .join('');

  // Add event listeners for the grid
  eventManager.addEventListener(billsGrid, 'click', event => {
    const target = event.target;
    const card = target.closest('.bill-card');
    if (!card) {
      return;
    }

    const id = parseInt(card.getAttribute('data-id'));
    if (!id) {
      return;
    }

    if (target.classList.contains('btn-pay-bill')) {
      event.stopPropagation();
      payRecurringBill(id, appState, () => {
        renderRecurringBills(appState);
      });
    }
    if (target.classList.contains('btn-edit-bill')) {
      event.stopPropagation();
      openRecurringModal(appState.appData, id);
    }
    if (target.classList.contains('btn-delete-bill')) {
      event.stopPropagation();
      deleteRecurringBill(id, appState, () => {
        renderRecurringBills(appState);
      });
    }
  });
}
