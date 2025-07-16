// js/modules/accounts.js
import db from '../database.js';
import { formatCurrency, escapeHtml, safeParseFloat } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import { validateForm, ValidationSchemas, showFieldError, clearFormErrors, validateWithAsyncRules, AsyncValidators } from './validation.js';
import { setupModalEventListeners, createFormSubmitHandler, populateFormFromData, displayValidationErrors } from './formUtils.js';

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("add-cash-account-btn")?.addEventListener("click", () => openCashAccountModal(appState.appData));
    
    // Use the new modal event listener utility
    setupModalEventListeners('cash-account-modal', {
        onSubmit: (e) => handleCashAccountSubmit(e, appState, onUpdate)
    });
    
    document.getElementById("cash-accounts-list")?.addEventListener('click', (event) => {
        const target = event.target;
        const id = parseInt(target.getAttribute('data-id'));
        if (!id) return;

        if (target.classList.contains('btn-edit-account')) {
            openCashAccountModal(appState.appData, id);
        }
        if (target.classList.contains('btn-delete-account')) {
            deleteCashAccount(id, appState, onUpdate);
        }
    });
}

function openCashAccountModal(appData, accountId = null) {
    const modalData = { accountId };
    
    // Pre-configure form fields before modal opens
    const form = document.getElementById("cash-account-form");
    const initialBalanceField = document.getElementById("cash-account-initial-balance");
    const initialBalanceParent = initialBalanceField?.parentElement;
    
    if (accountId) {
        const account = appData.cashAccounts.find(a => a.id === accountId);
        if (account) {
            // Modal will be reset by modalManager, so we need to populate after open
            setTimeout(() => {
                populateFormFromData('cash-account-form', {
                    id: account.id,
                    name: account.name,
                    type: account.type,
                    institution: account.institution || "",
                    notes: account.notes || ""
                }, 'cash-account-');
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
            document.getElementById("cash-account-id").value = "";
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
        const accountId = document.getElementById("cash-account-id").value;
        const accountData = {
            name: document.getElementById("cash-account-name").value,
            type: document.getElementById("cash-account-type").value,
            institution: document.getElementById("cash-account-institution").value,
            notes: document.getElementById("cash-account-notes").value,
            isActive: true
        };
        
        // Validate form data
        const asyncValidators = {
            name: AsyncValidators.uniqueAccountName(appState.appData.cashAccounts, accountId ? parseInt(accountId) : null)
        };
        
        const { errors, hasErrors } = await validateWithAsyncRules(accountData, ValidationSchemas.cashAccount, asyncValidators);
        
        if (hasErrors) {
            // Show field-level errors
            Object.entries(errors).forEach(([field, error]) => {
                showFieldError(`cash-account-${field}`, error);
            });
            showError("Please correct the errors in the form.");
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
            const initialBalance = safeParseFloat(document.getElementById("cash-account-initial-balance").value);
            
            // Validate initial balance if provided
            if (document.getElementById("cash-account-initial-balance").value && isNaN(initialBalance)) {
                showFieldError("cash-account-initial-balance", "Initial balance must be a valid number");
                showError("Please correct the errors in the form.");
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
                    cleared: true
                };
                const savedTransaction = await db.addTransaction(initialTransaction);
                appState.appData.transactions.unshift({ ...savedTransaction, amount: parseFloat(savedTransaction.amount) });
                newAccount.balance = initialBalance;
            }
            appState.appData.cashAccounts.push(newAccount);
        }
        
        closeModal('cash-account-modal');
        onUpdate();
        announceToScreenReader("Account saved successfully");
    } catch (error) {
        showError("Failed to save account.");
    }
}

async function deleteCashAccount(id, appState, onUpdate) {
    const account = appState.appData.cashAccounts.find(a => a.id === id);
    if (!account) return;

    if (confirm(`Are you sure you want to delete "${account.name}"? This will also delete ALL associated transactions.`)) {
        try {
            await db.deleteCashAccount(id); // DB handles deleting transactions
            appState.appData.cashAccounts = appState.appData.cashAccounts.filter(a => a.id !== id);
            appState.appData.transactions = appState.appData.transactions.filter(t => t.account_id !== id);
            
            onUpdate();
            announceToScreenReader("Cash account and transactions deleted");
        } catch (error) {
            showError("Failed to delete cash account.");
        }
    }
}

export function renderCashAccounts(appState) {
    const { appData } = appState;
    const cashAccountsList = document.getElementById("cash-accounts-list");
    if (!cashAccountsList) return;

    const totalValue = appData.cashAccounts
        .filter(account => account.isActive)
        .reduce((sum, account) => sum + (account.balance || 0), 0);

    document.getElementById("accounts-total-value").textContent = formatCurrency(totalValue);
    document.getElementById("accounts-count").textContent = appData.cashAccounts.length;
    
    cashAccountsList.innerHTML = appData.cashAccounts.map(account => {
        const balance = account.balance || 0;
        return `
        <div class="investment-account ${!account.isActive ? 'inactive' : ''}" data-id="${account.id}">
             <div class="investment-account-header">
                <h4>${escapeHtml(account.name)} <span class="account-type">(${escapeHtml(account.type)})</span></h4>
                <div class="investment-account-actions">
                    <button class="btn btn--secondary btn--sm btn-edit-account" data-id="${account.id}">Edit</button>
                    <button class="btn btn--outline btn--sm btn-delete-account" data-id="${account.id}">Delete</button>
                </div>
            </div>
             <div class="account-info">
                 <div class="account-info-item">
                     <span class="account-info-label">Balance</span>
                     <span class="account-info-value ${balance >= 0 ? '' : 'text-error'}" data-sensitive="true">${formatCurrency(balance)}</span>
                 </div>
             </div>
        </div>`;
    }).join('');
}

export function populateAccountDropdowns(appData) {
    const selectors = [
        document.getElementById("transaction-account"),
        document.getElementById("contribution-source"),
        document.getElementById("recurring-account")
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
        optionsHtml += activeAccounts.map(account => 
            `<option value="cash_${account.id}">${escapeHtml(account.name)}</option>`
        ).join('');
        optionsHtml += '</optgroup>';
    }
    
    // Add credit card accounts (only for transaction-account selector)
    const transactionAccountSelect = document.getElementById("transaction-account");
    
    selectors.forEach(select => {
        if (select) {
            const currentValue = select.value;
            let selectOptionsHtml = optionsHtml;
            
            // Only add credit cards to the transaction account dropdown
            if (select === transactionAccountSelect && creditCardAccounts.length > 0) {
                selectOptionsHtml += '<optgroup label="Credit Cards">';
                selectOptionsHtml += creditCardAccounts.map(account => 
                    `<option value="cc_${account.id}">${escapeHtml(account.name)} (CC)</option>`
                ).join('');
                selectOptionsHtml += '</optgroup>';
            }
            
            select.innerHTML = `<option value="" disabled selected>— Select account —</option>${selectOptionsHtml}`;
            if (currentValue) select.value = currentValue;
        }
    });
}