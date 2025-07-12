// js/modules/accounts.js
import db from '../database.js';
import { formatCurrency, escapeHtml, safeParseFloat } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';

let eventListeners = [];

export function setupEventListeners(appState, onUpdate) {
    // Clean up any existing listeners first
    cleanupEventListeners();
    
    // Store references to event handlers
    const handlers = {
        openModal: () => openCashAccountModal(appState.appData),
        closeModal: () => closeModal('cash-account-modal'),
        cancelModal: () => closeModal('cash-account-modal'),
        submitForm: (e) => handleCashAccountSubmit(e, appState, onUpdate),
        listClick: (event) => {
            const target = event.target;
            const id = parseInt(target.getAttribute('data-id'));
            if (!id) return;

            if (target.classList.contains('btn-edit-account')) {
                openCashAccountModal(appState.appData, id);
            }
            if (target.classList.contains('btn-delete-account')) {
                deleteCashAccount(id, appState, onUpdate);
            }
        }
    };
    
    // Add event listeners and store references
    const addCashAccountBtn = document.getElementById("add-cash-account-btn");
    if (addCashAccountBtn) {
        addCashAccountBtn.addEventListener("click", handlers.openModal);
        eventListeners.push({ element: addCashAccountBtn, type: "click", handler: handlers.openModal });
    }
    
    const closeCashAccountModal = document.getElementById("close-cash-account-modal");
    if (closeCashAccountModal) {
        closeCashAccountModal.addEventListener("click", handlers.closeModal);
        eventListeners.push({ element: closeCashAccountModal, type: "click", handler: handlers.closeModal });
    }
    
    const cancelCashAccountBtn = document.getElementById("cancel-cash-account-btn");
    if (cancelCashAccountBtn) {
        cancelCashAccountBtn.addEventListener("click", handlers.cancelModal);
        eventListeners.push({ element: cancelCashAccountBtn, type: "click", handler: handlers.cancelModal });
    }
    
    const cashAccountForm = document.getElementById("cash-account-form");
    if (cashAccountForm) {
        cashAccountForm.addEventListener("submit", handlers.submitForm);
        eventListeners.push({ element: cashAccountForm, type: "submit", handler: handlers.submitForm });
    }
    
    const cashAccountsList = document.getElementById("cash-accounts-list");
    if (cashAccountsList) {
        cashAccountsList.addEventListener('click', handlers.listClick);
        eventListeners.push({ element: cashAccountsList, type: 'click', handler: handlers.listClick });
    }
}

export function cleanupEventListeners() {
    eventListeners.forEach(({ element, type, handler }) => {
        element.removeEventListener(type, handler);
    });
    eventListeners = [];
}

function openCashAccountModal(appData, accountId = null) {
    const form = document.getElementById("cash-account-form");
    const title = document.getElementById("cash-account-modal-title");
    form.reset();
    document.getElementById("cash-account-id").value = "";
    document.getElementById("cash-account-initial-balance").disabled = false;
    document.getElementById("cash-account-initial-balance").parentElement.style.display = 'block';

    if (accountId) {
        const account = appData.cashAccounts.find(a => a.id === accountId);
        if (account) {
            title.textContent = "Edit Account";
            document.getElementById("cash-account-id").value = account.id;
            document.getElementById("cash-account-name").value = account.name;
            document.getElementById("cash-account-type").value = account.type;
            document.getElementById("cash-account-institution").value = account.institution || "";
            document.getElementById("cash-account-notes").value = account.notes || "";
            document.getElementById("cash-account-initial-balance").disabled = true; // Can't change balance here
            document.getElementById("cash-account-initial-balance").parentElement.style.display = 'none';
        }
    } else {
        title.textContent = "Add New Account";
    }
    openModal('cash-account-modal');
}

async function handleCashAccountSubmit(event, appState, onUpdate) {
    event.preventDefault();
    try {
        const accountId = document.getElementById("cash-account-id").value;
        const accountData = {
            name: document.getElementById("cash-account-name").value,
            type: document.getElementById("cash-account-type").value,
            institution: document.getElementById("cash-account-institution").value,
            notes: document.getElementById("cash-account-notes").value,
            isActive: true
        };

        if (accountId) {
            await db.updateCashAccount(parseInt(accountId), accountData);
            const index = appState.appData.cashAccounts.findIndex(a => a.id === parseInt(accountId));
            if (index > -1) {
                const oldAccount = appState.appData.cashAccounts[index];
                appState.appData.cashAccounts[index] = { ...oldAccount, ...accountData };
            }
        } else {
            const initialBalance = safeParseFloat(document.getElementById("cash-account-initial-balance").value);
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
                     <span class="account-info-value ${balance >= 0 ? '' : 'text-error'}">${formatCurrency(balance)}</span>
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
    
    const activeAccounts = appData.cashAccounts.filter(a => a.isActive);
    const optionsHtml = activeAccounts.map(account => `<option value="${account.id}">${escapeHtml(account.name)}</option>`).join('');

    selectors.forEach(select => {
        if (select) {
            const currentValue = select.value;
            select.innerHTML = `<option value="" disabled selected>— Select account —</option>${optionsHtml}`;
            if (currentValue) select.value = currentValue;
        }
    });
}