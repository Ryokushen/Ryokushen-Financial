// js/modules/accounts.js
import db from '../database.js';
import { formatCurrency, escapeHtml, safeParseFloat } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import {
  validateForm,
  ValidationSchemas,
  showFieldError,
  clearFormErrors,
  validateWithAsyncRules,
  AsyncValidators,
} from './validation.js';
import {
  setupModalEventListeners,
  createFormSubmitHandler,
  populateFormFromData,
  displayValidationErrors,
} from './formUtils.js';
import { eventManager } from './eventManager.js';
import { transactionManager } from './transactionManager.js';

export function setupEventListeners(appState, onUpdate) {
  const addCashAccountBtn = document.getElementById('add-cash-account-btn');
  if (addCashAccountBtn) {
    eventManager.addEventListener(addCashAccountBtn, 'click', () =>
      openCashAccountModal(appState.appData)
    );
  }

  // Use the new modal event listener utility
  setupModalEventListeners('cash-account-modal', {
    onSubmit: e => handleCashAccountSubmit(e, appState, onUpdate),
  });
}

function openCashAccountModal(appData, accountId = null) {
  const modalData = { accountId };

  // Pre-configure form fields before modal opens
  const form = document.getElementById('cash-account-form');
  const initialBalanceField = document.getElementById('cash-account-initial-balance');
  const initialBalanceParent = initialBalanceField?.parentElement;

  if (accountId) {
    const account = appData.cashAccounts.find(a => a.id === accountId);
    if (account) {
      // Modal will be reset by modalManager, so we need to populate after open
      setTimeout(() => {
        populateFormFromData(
          'cash-account-form',
          {
            id: account.id,
            name: account.name,
            type: account.type,
            institution: account.institution || '',
            notes: account.notes || '',
          },
          'cash-account-'
        );
        if (initialBalanceField) {
          initialBalanceField.disabled = true;
        }
        if (initialBalanceParent) {
          initialBalanceParent.style.display = 'none';
        }
      }, 0);
    }
  } else {
    // For new accounts, ensure initial balance field is visible
    setTimeout(() => {
      document.getElementById('cash-account-id').value = '';
      if (initialBalanceField) {
        initialBalanceField.disabled = false;
      }
      if (initialBalanceParent) {
        initialBalanceParent.style.display = 'block';
      }
    }, 0);
  }

  openModal('cash-account-modal', modalData);
}

async function handleCashAccountSubmit(event, appState, onUpdate) {
  event.preventDefault();

  // Clear previous errors
  clearFormErrors('cash-account-form');

  try {
    const accountId = document.getElementById('cash-account-id').value;
    const accountData = {
      name: document.getElementById('cash-account-name').value,
      type: document.getElementById('cash-account-type').value,
      institution: document.getElementById('cash-account-institution').value,
      notes: document.getElementById('cash-account-notes').value,
      isActive: true,
    };

    // Validate form data
    const asyncValidators = {
      name: AsyncValidators.uniqueAccountName(
        appState.appData.cashAccounts,
        accountId ? parseInt(accountId) : null
      ),
    };

    const { errors, hasErrors } = await validateWithAsyncRules(
      accountData,
      ValidationSchemas.cashAccount,
      asyncValidators
    );

    if (hasErrors) {
      // Show field-level errors
      Object.entries(errors).forEach(([field, error]) => {
        showFieldError(`cash-account-${field}`, error);
      });
      showError('Please correct the errors in the form.');
      return;
    }

    if (accountId) {
      await db.updateCashAccount(parseInt(accountId), accountData);
      const index = appState.appData.cashAccounts.findIndex(a => a.id === parseInt(accountId));
      if (index > -1) {
        const oldAccount = appState.appData.cashAccounts[index];
        appState.appData.cashAccounts[index] = { ...oldAccount, ...accountData };
      }
    } else {
      const initialBalance = safeParseFloat(
        document.getElementById('cash-account-initial-balance').value
      );

      // Validate initial balance if provided
      if (document.getElementById('cash-account-initial-balance').value && isNaN(initialBalance)) {
        showFieldError('cash-account-initial-balance', 'Initial balance must be a valid number');
        showError('Please correct the errors in the form.');
        return;
      }
      const savedAccount = await db.addCashAccount(accountData);
      const newAccount = { ...savedAccount, isActive: savedAccount.is_active, balance: 0 };

      if (initialBalance !== 0) {
        const initialTransaction = {
          date: new Date().toISOString().split('T')[0],
          account_id: savedAccount.id,
          category: 'Income',
          description: 'Initial Balance',
          amount: initialBalance,
          cleared: true,
        };
        const savedTransaction = await transactionManager.addTransaction(initialTransaction);
        appState.appData.transactions.unshift({
          ...savedTransaction,
          amount: parseFloat(savedTransaction.amount),
        });
        // Balance will be recalculated automatically
      }
      appState.appData.cashAccounts.push(newAccount);
    }

    closeModal('cash-account-modal');
    onUpdate();
    announceToScreenReader('Account saved successfully');
  } catch (error) {
    showError('Failed to save account.');
  }
}

async function deleteCashAccount(id, appState, onUpdate) {
  const account = appState.appData.cashAccounts.find(a => a.id === id);
  if (!account) {
    return;
  }

  if (
    confirm(
      `Are you sure you want to delete "${account.name}"? This will also delete ALL associated transactions.`
    )
  ) {
    try {
      // Get all transactions for this account before deletion
      const accountTransactions = appState.appData.transactions.filter(t => t.account_id === id);
      const transactionIds = accountTransactions.map(t => t.id);

      // Use TransactionManager to delete transactions in batch if there are any
      if (transactionIds.length > 0) {
        await transactionManager.deleteMultipleTransactions(transactionIds);
      }

      // Now delete the account itself
      await db.deleteCashAccount(id);

      // Update local state
      appState.appData.cashAccounts = appState.appData.cashAccounts.filter(a => a.id !== id);
      appState.appData.transactions = appState.appData.transactions.filter(
        t => t.account_id !== id
      );

      onUpdate();
      announceToScreenReader('Cash account and transactions deleted');
    } catch (error) {
      showError('Failed to delete cash account.');
    }
  }
}

export function renderCashAccounts(appState) {
  const { appData } = appState;

  // Update summary values if they exist
  const totalValue = appData.cashAccounts
    .filter(account => account.isActive)
    .reduce((sum, account) => sum + (account.balance || 0), 0);

  const totalValueEl = document.getElementById('accounts-total-value');
  if (totalValueEl) {
    totalValueEl.textContent = formatCurrency(totalValue);
  }

  const countEl = document.getElementById('accounts-count');
  if (countEl) {
    countEl.textContent = appData.cashAccounts.length;
  }

  // Render card layout
  const accountsGrid = document.getElementById('accounts-grid');
  if (accountsGrid) {
    // Get account type icons
    const getAccountIcon = type => {
      const icons = {
        Checking: '💳',
        Savings: '💰',
        'Money Market': '🏦',
        Other: '📊',
      };
      return icons[type] || '💼';
    };

    accountsGrid.innerHTML = appData.cashAccounts
      .map(account => {
        const balance = account.balance || 0;
        const isActive = account.isActive !== false;

        return `
            <div class="account-card ${!isActive ? 'inactive' : ''}" data-id="${account.id}">
                <div class="account-card__icon">${getAccountIcon(account.type)}</div>
                <div class="account-card__balance" data-sensitive="true">${formatCurrency(balance)}</div>
                <div class="account-card__name">${escapeHtml(account.name)}</div>
                <div class="account-card__details">
                    <div>🏦 ${escapeHtml(account.institution || 'No institution')}</div>
                    <div>📁 ${escapeHtml(account.type)}</div>
                    <div>🔄 ${isActive ? 'Active' : 'Inactive'}</div>
                </div>
                <div class="account-card__actions">
                    <button class="btn btn--primary btn-edit-account" data-id="${account.id}">Edit</button>
                    <button class="btn btn--secondary btn-delete-account" data-id="${account.id}">Delete</button>
                </div>
            </div>
            `;
      })
      .join('');

    // Also update event listeners for the grid
    eventManager.addEventListener(accountsGrid, 'click', event => {
      const target = event.target;
      const card = target.closest('.account-card');
      if (!card) {
        return;
      }

      const id = parseInt(card.getAttribute('data-id'));
      if (!id) {
        return;
      }

      if (target.classList.contains('btn-edit-account')) {
        openCashAccountModal(appData, id);
      }
      if (target.classList.contains('btn-delete-account')) {
        deleteCashAccount(id, appState, () => {
          // Refresh accounts after delete
          renderCashAccounts(appState);
        });
      }
    });
  }
}

export function populateAccountDropdowns(appData) {
  const selectors = [
    document.getElementById('transaction-account'),
    document.getElementById('contribution-source'),
    document.getElementById('recurring-account'),
  ];

  // Get active cash accounts
  const activeAccounts = appData.cashAccounts.filter(a => a.isActive);

  // Get credit card accounts (type = 'Credit Card')
  const creditCardAccounts = appData.debtAccounts.filter(a => a.type === 'Credit Card');

  // Build options HTML with optgroups for better organization
  let optionsHtml = '';

  // Add cash accounts
  if (activeAccounts.length > 0) {
    optionsHtml += '<optgroup label="Cash Accounts">';
    optionsHtml += activeAccounts
      .map(account => `<option value="cash_${account.id}">${escapeHtml(account.name)}</option>`)
      .join('');
    optionsHtml += '</optgroup>';
  }

  // Add credit card accounts (only for transaction-account selector)
  const transactionAccountSelect = document.getElementById('transaction-account');

  selectors.forEach(select => {
    if (select) {
      const currentValue = select.value;
      let selectOptionsHtml = optionsHtml;

      // Only add credit cards to the transaction account dropdown
      if (select === transactionAccountSelect && creditCardAccounts.length > 0) {
        selectOptionsHtml += '<optgroup label="Credit Cards">';
        selectOptionsHtml += creditCardAccounts
          .map(
            account => `<option value="cc_${account.id}">${escapeHtml(account.name)} (CC)</option>`
          )
          .join('');
        selectOptionsHtml += '</optgroup>';
      }

      select.innerHTML = `<option value="" disabled selected>— Select account —</option>${selectOptionsHtml}`;
      if (currentValue) {
        select.value = currentValue;
      }
    }
  });
}
// Cleanup function for accounts module
export function cleanup() {
  // Note: eventManager handles all listener cleanup automatically
  // Module-specific cleanup can be added here if needed
}
