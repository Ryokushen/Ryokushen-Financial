// js/modules/recurring.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatDate, formatCurrency, getDueDateClass, getDueDateText, convertToMonthly, getNextDueDate } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import { debug } from './debug.js';
import { subtractMoney, addMoney } from './financialMath.js';
import { validateForm, ValidationSchemas, showFieldError, clearFormErrors, CrossFieldValidators, validateFormWithCrossFields } from './validation.js';

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("add-recurring-btn")?.addEventListener("click", () => openRecurringModal(appState.appData));
    document.getElementById("close-recurring-modal")?.addEventListener("click", () => closeModal('recurring-modal'));
    document.getElementById("cancel-recurring-btn")?.addEventListener("click", () => closeModal('recurring-modal'));
    document.getElementById("recurring-form")?.addEventListener("submit", (e) => handleRecurringSubmit(e, appState, onUpdate));

    // NEW: Payment method change handler
    document.getElementById("recurring-payment-method")?.addEventListener("change", function () {
        togglePaymentMethodFields();
    });

    document.getElementById("all-recurring-bills-list")?.addEventListener('click', (event) => {
        const id = parseInt(event.target.getAttribute('data-id'));
        if (!id) return;
        if (event.target.classList.contains('btn-pay-bill')) payRecurringBill(id, appState, onUpdate);
        if (event.target.classList.contains('btn-edit-bill')) openRecurringModal(appState.appData, id);
        if (event.target.classList.contains('btn-delete-bill')) deleteRecurringBill(id, appState, onUpdate);
    });
}

// NEW: Toggle payment method fields based on selection
function togglePaymentMethodFields() {
    const paymentMethod = document.getElementById("recurring-payment-method").value;
    const cashAccountGroup = document.getElementById("cash-account-group");
    const creditAccountGroup = document.getElementById("credit-account-group");

    if (paymentMethod === 'cash') {
        cashAccountGroup.style.display = 'block';
        creditAccountGroup.style.display = 'none';
        // Clear credit card selection
        document.getElementById("recurring-debt-account").value = '';
    } else if (paymentMethod === 'credit') {
        cashAccountGroup.style.display = 'none';
        creditAccountGroup.style.display = 'block';
        // Clear cash account selection
        document.getElementById("recurring-account").value = '';
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
                document.getElementById("recurring-id").value = bill.id;
                document.getElementById("recurring-name").value = bill.name;
                document.getElementById("recurring-category").value = bill.category;
                document.getElementById("recurring-amount").value = bill.amount;
                document.getElementById("recurring-frequency").value = bill.frequency;
                document.getElementById("recurring-next-due").value = bill.nextDue || bill.next_due;
                document.getElementById("recurring-notes").value = bill.notes || "";
                document.getElementById("recurring-active").checked = bill.active !== false;

                // Set payment method and accounts
                const paymentMethod = bill.payment_method || 'cash';
                document.getElementById("recurring-payment-method").value = paymentMethod;

                if (paymentMethod === 'cash') {
                    document.getElementById("recurring-account").value = bill.account_id;
                } else {
                    document.getElementById("recurring-debt-account").value = bill.debt_account_id;
                }

                togglePaymentMethodFields();
            }
        } else {
            document.getElementById("recurring-id").value = "";
            document.getElementById("recurring-active").checked = true;
            document.getElementById("recurring-payment-method").value = 'cash';
            document.getElementById("recurring-next-due").value = new Date().toISOString().split('T')[0];
            togglePaymentMethodFields();
        }
    }, 0);
    
    openModal('recurring-modal', modalData);
}

// UPDATED: Populate both cash and debt account dropdowns
function populateRecurringAccountDropdowns(appData) {
    const cashSelect = document.getElementById("recurring-account");
    const debtSelect = document.getElementById("recurring-debt-account");

    if (!cashSelect || !debtSelect) return;

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
        const billId = document.getElementById("recurring-id").value;
        const paymentMethod = document.getElementById("recurring-payment-method").value;
        
        const formData = {
            name: document.getElementById("recurring-name").value.trim(),
            category: document.getElementById("recurring-category").value,
            amount: safeParseFloat(document.getElementById("recurring-amount").value),
            frequency: document.getElementById("recurring-frequency").value,
            nextDue: document.getElementById("recurring-next-due").value
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
            showError("Please correct the errors in the form.");
            return;
        }

        // NEW: Validate payment method selection
        let accountId = null;
        let debtAccountId = null;

        if (paymentMethod === 'cash') {
            accountId = parseInt(document.getElementById("recurring-account").value);
            if (!accountId || isNaN(accountId)) {
                showError("Please select a valid cash account.");
                return;
            }
        } else if (paymentMethod === 'credit') {
            debtAccountId = parseInt(document.getElementById("recurring-debt-account").value);
            if (!debtAccountId || isNaN(debtAccountId)) {
                showError("Please select a valid credit card.");
                return;
            }
        } else {
            showError("Please select a payment method.");
            return;
        }

        // UPDATED: Build bill data with payment method support
        const billData = {
            name: document.getElementById("recurring-name").value.trim(),
            category: document.getElementById("recurring-category").value,
            amount: amount,
            frequency: document.getElementById("recurring-frequency").value,
            next_due: nextDue,
            payment_method: paymentMethod,
            account_id: accountId,
            debt_account_id: debtAccountId,
            notes: document.getElementById("recurring-notes").value.trim(),
            active: document.getElementById("recurring-active").checked
        };

        // Additional validation
        if (!billData.name) {
            showError("Bill name is required.");
            return;
        }

        if (!billData.category) {
            showError("Please select a category.");
            return;
        }

        if (!billData.frequency) {
            showError("Please select a billing frequency.");
            return;
        }

        debug.log("Submitting bill data:", billData);

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
                    active: savedBill.active
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
                active: savedBill.active
            });
        }

        closeModal('recurring-modal');
        onUpdate();
        announceToScreenReader("Recurring bill saved successfully.");

    } catch (error) {
        debug.error("Error saving recurring bill:", error);
        showError(`Failed to save recurring bill: ${error.message}`);
    }
}

async function deleteRecurringBill(id, appState, onUpdate) {
    const bill = appState.appData.recurringBills.find(b => b.id === id);
    if (!bill) return;

    if (confirm(`Are you sure you want to delete "${bill.name}"?`)) {
        try {
            await db.deleteRecurringBill(id);
            appState.appData.recurringBills = appState.appData.recurringBills.filter(b => b.id !== id);
            onUpdate();
            announceToScreenReader("Recurring bill deleted.");
        } catch (error) {
            debug.error("Error deleting recurring bill:", error);
            showError("Failed to delete recurring bill.");
        }
    }
}

// UPDATED: Support both cash and credit card payments
async function payRecurringBill(id, appState, onUpdate) {
    const bill = appState.appData.recurringBills.find(b => b.id === id);
    if (!bill) return;

    const paymentMethod = bill.paymentMethod || bill.payment_method || 'cash';

    if (confirm(`Pay ${bill.name} for ${formatCurrency(bill.amount)} via ${paymentMethod === 'credit' ? 'credit card' : 'cash account'}?`)) {
        try {
            if (paymentMethod === 'cash') {
                // Original cash payment logic
                const transaction = {
                    date: new Date().toISOString().split('T')[0],
                    account_id: bill.account_id,
                    category: bill.category,
                    description: `${bill.name} (Recurring)`,
                    amount: -bill.amount,
                    cleared: true
                };

                const savedTransaction = await db.addTransaction(transaction);
                appState.appData.transactions.unshift({ ...savedTransaction, amount: parseFloat(savedTransaction.amount) });

                // Update cash account balance
                if (appState.updateAccountBalance) {
                    appState.updateAccountBalance(bill.account_id, -bill.amount);
                } else {
                    const paymentAccount = appState.appData.cashAccounts.find(a => a.id === bill.account_id);
                    if (paymentAccount) {
                        paymentAccount.balance = subtractMoney(paymentAccount.balance, bill.amount);
                    }
                }
            } else if (paymentMethod === 'credit') {
                // NEW: Credit card payment logic
                const debtAccountId = bill.debtAccountId || bill.debt_account_id;
                if (!debtAccountId) {
                    showError("No credit card account found for this bill.");
                    return;
                }

                // Create a debt transaction (increases debt)
                const transaction = {
                    date: new Date().toISOString().split('T')[0],
                    account_id: null, // No cash account involved
                    category: bill.category,
                    description: `${bill.name} (Recurring - Credit Card)`,
                    amount: bill.amount, // Positive amount increases debt
                    cleared: true,
                    debt_account_id: debtAccountId
                };

                const savedTransaction = await db.addTransaction(transaction);
                appState.appData.transactions.unshift({ ...savedTransaction, amount: parseFloat(savedTransaction.amount) });

                // Update credit card debt balance
                const debtAccount = appState.appData.debtAccounts.find(d => d.id === debtAccountId);
                if (debtAccount) {
                    const newBalance = debtAccount.balance + bill.amount;
                    await db.updateDebtBalance(debtAccount.id, newBalance);
                    debtAccount.balance = newBalance;
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
                debt_account_id: bill.debtAccountId || bill.debt_account_id
            });

            onUpdate();
            announceToScreenReader("Payment recorded successfully.");
        } catch (error) {
            debug.error("Error paying bill:", error);
            showError("Failed to record payment.");
        }
    }
}

export function renderRecurringBills(appState) {
    const { appData } = appState;
    renderSummary(appData);
    renderUpcomingBills(appData);
    renderAllRecurringBills(appData);
}

function renderSummary(appData) {
    const activeBills = appData.recurringBills.filter(bill => bill.active !== false);
    const monthlyTotal = activeBills.reduce((sum, bill) => sum + convertToMonthly(bill.amount, bill.frequency), 0);

    document.getElementById("recurring-monthly-total").textContent = formatCurrency(monthlyTotal);
    document.getElementById("recurring-annual-total").textContent = formatCurrency(monthlyTotal * 12);
    document.getElementById("recurring-count").textContent = activeBills.length.toString();
}

function renderUpcomingBills(appData) {
    const upcomingList = document.getElementById("upcoming-bills-list");
    if (!upcomingList) return;

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
        upcomingList.innerHTML = `<div class="empty-state">No bills due in the next 30 days.</div>`;
        return;
    }

    upcomingList.innerHTML = upcomingBills.map(bill => {
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
    }).join('');
}

// UPDATED: Display payment method information
function renderAllRecurringBills(appData) {
    const billsList = document.getElementById("all-recurring-bills-list");
    if (!billsList) return;

    if (appData.recurringBills.length === 0) {
        billsList.innerHTML = `<div class="empty-state">No recurring bills added yet.</div>`;
        return;
    }

    billsList.innerHTML = appData.recurringBills.map(bill => {
        const paymentMethod = bill.paymentMethod || bill.payment_method || 'cash';
        const isActive = bill.active !== false;
        const dueDate = bill.nextDue || bill.next_due;

        let accountInfo = '';
        if (paymentMethod === 'cash') {
            const account = appData.cashAccounts.find(a => a.id === bill.account_id);
            accountInfo = account ? `${escapeHtml(account.name)} (Cash)` : 'N/A';
        } else {
            const debtAccountId = bill.debtAccountId || bill.debt_account_id;
            const account = appData.debtAccounts.find(d => d.id === debtAccountId);
            accountInfo = account ? `${escapeHtml(account.name)} (Credit Card)` : 'N/A';
        }

        return `
        <div class="recurring-bill-card ${isActive ? '' : 'inactive'}" data-id="${bill.id}">
            <div class="recurring-bill-header">
                <h5>${escapeHtml(bill.name)}</h5>
                <div class="recurring-bill-amount" data-sensitive="true">${formatCurrency(bill.amount)}</div>
            </div>
            <div class="recurring-bill-info">
                <div class="recurring-bill-detail">
                    <span class="label">Next Due:</span>
                    <span class="value ${getDueDateClass(dueDate)}">${formatDate(dueDate)}</span>
                </div>
                <div class="recurring-bill-detail">
                    <span class="label">Frequency:</span>
                    <span class="value">${escapeHtml(bill.frequency)}</span>
                </div>
                <div class="recurring-bill-detail">
                    <span class="label">Payment Method:</span>
                    <span class="value">${accountInfo}</span>
                </div>
                <div class="recurring-bill-detail">
                    <span class="label">Status:</span>
                    <span class="value">${isActive ? 'Active' : 'Inactive'}</span>
                </div>
            </div>
            <div class="recurring-bill-actions">
                ${isActive ? `<button class="btn btn--primary btn--sm btn-pay-bill" data-id="${bill.id}">Pay Bill</button>` : ''}
                <button class="btn btn--secondary btn--sm btn-edit-bill" data-id="${bill.id}">Edit</button>
                <button class="btn btn--outline btn--sm btn-delete-bill" data-id="${bill.id}">Delete</button>
            </div>
        </div>
        `;
    }).join('');
}