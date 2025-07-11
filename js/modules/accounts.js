// js/modules/accounts.js
import db from '../database.js';
import { formatCurrency, escapeHtml, safeParseFloat } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("add-cash-account-btn")?.addEventListener("click", () => openCashAccountModal(appState.appData));
    document.getElementById("close-cash-account-modal")?.addEventListener("click", () => closeModal('cash-account-modal'));
    document.getElementById("cancel-cash-account-btn")?.addEventListener("click", () => closeModal('cash-account-modal'));
    document.getElementById("cash-account-form")?.addEventListener("submit", (e) => handleCashAccountSubmit(e, appState, onUpdate));

    // NEW: Transfer functionality
    document.getElementById("transfer-to-investment-btn")?.addEventListener("click", () => openTransferModal(appState.appData));
    document.getElementById("close-transfer-modal")?.addEventListener("click", () => closeModal('transfer-modal'));
    document.getElementById("cancel-transfer-btn")?.addEventListener("click", () => closeModal('transfer-modal'));
    document.getElementById("transfer-form")?.addEventListener("submit", (e) => handleTransferSubmit(e, appState, onUpdate));

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
        // NEW: Transfer button handler
        if (target.classList.contains('btn-transfer-account')) {
            openTransferModal(appState.appData, id);
        }
    });
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

// NEW: Transfer functionality
function openTransferModal(appData, sourceAccountId = null) {
    populateTransferDropdowns(appData);
    const form = document.getElementById("transfer-form");
    form.reset();

    // If called from a specific account's transfer button, pre-select it
    if (sourceAccountId) {
        document.getElementById("transfer-from-account").value = sourceAccountId;
    }

    document.getElementById("transfer-date").value = new Date().toISOString().split('T')[0];
    openModal('transfer-modal');
}

function populateTransferDropdowns(appData) {
    const fromSelect = document.getElementById("transfer-from-account");
    const toSelect = document.getElementById("transfer-to-account");

    if (!fromSelect || !toSelect) return;

    // Populate source accounts (cash accounts)
    fromSelect.innerHTML = '<option value="" disabled selected>Select Source Account</option>';
    appData.cashAccounts
        .filter(acc => acc.isActive)
        .forEach(acc => {
            fromSelect.innerHTML += `<option value="${acc.id}">${escapeHtml(acc.name)} - ${formatCurrency(acc.balance || 0)}</option>`;
        });

    // Populate target accounts (investment accounts)
    toSelect.innerHTML = '<option value="" disabled selected>Select Target Account</option>';
    appData.investmentAccounts.forEach(acc => {
        toSelect.innerHTML += `<option value="${acc.id}">${escapeHtml(acc.name)} (${escapeHtml(acc.accountType)})</option>`;
    });
}

async function handleTransferSubmit(event, appState, onUpdate) {
    event.preventDefault();

    try {
        const fromAccountId = parseInt(document.getElementById("transfer-from-account").value);
        const toAccountId = parseInt(document.getElementById("transfer-to-account").value);
        const amount = safeParseFloat(document.getElementById("transfer-amount").value);
        const date = document.getElementById("transfer-date").value;
        const description = document.getElementById("transfer-description").value || "Transfer to Investment Account";

        // Validation
        if (!fromAccountId || !toAccountId) {
            showError("Please select both source and target accounts.");
            return;
        }

        if (amount <= 0) {
            showError("Transfer amount must be greater than zero.");
            return;
        }

        if (fromAccountId === toAccountId) {
            showError("Cannot transfer to the same account.");
            return;
        }

        // Find accounts
        const fromAccount = appState.appData.cashAccounts.find(a => a.id === fromAccountId);
        const toAccount = appState.appData.investmentAccounts.find(a => a.id === toAccountId);

        if (!fromAccount || !toAccount) {
            showError("One or both selected accounts not found.");
            return;
        }

        // Check sufficient balance
        if (fromAccount.balance < amount) {
            showError(`Insufficient funds. Available: ${formatCurrency(fromAccount.balance)}`);
            return;
        }

        // Create withdrawal transaction (negative amount)
        const withdrawalTransaction = {
            date: date,
            account_id: fromAccountId,
            category: "Transfer",
            description: `Transfer to ${toAccount.name}`,
            amount: -amount,
            cleared: true
        };

        const savedWithdrawal = await db.addTransaction(withdrawalTransaction);
        appState.appData.transactions.unshift({
            ...savedWithdrawal,
            amount: parseFloat(savedWithdrawal.amount)
        });

        // Update cash account balance
        fromAccount.balance -= amount;
        if (appState.updateAccountBalance) {
            appState.updateAccountBalance(fromAccountId, -amount);
        }

        // Update investment account balance
        toAccount.balance += amount;
        await db.updateInvestmentAccount(toAccountId, {
            balance: toAccount.balance
        });

        closeModal('transfer-modal');
        onUpdate();
        announceToScreenReader(`Successfully transferred ${formatCurrency(amount)} from ${fromAccount.name} to ${toAccount.name}`);

    } catch (error) {
        console.error("Error processing transfer:", error);
        showError("Failed to process transfer. Please try again.");
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

    // NEW: Add transfer button to header
    const accountsCard = document.querySelector('.accounts-summary .card__header');
    if (accountsCard) {
        // Check if transfer button already exists
        if (!document.getElementById("transfer-to-investment-btn")) {
            const transferBtn = document.createElement('button');
            transferBtn.id = 'transfer-to-investment-btn';
            transferBtn.className = 'btn btn--secondary';
            transferBtn.textContent = 'Transfer to Investment';
            transferBtn.style.marginLeft = '10px';
            accountsCard.appendChild(transferBtn);
        }
    }

    cashAccountsList.innerHTML = appData.cashAccounts.map(account => {
        const balance = account.balance || 0;
        return `
        <div class="investment-account ${!account.isActive ? 'inactive' : ''}" data-id="${account.id}">
             <div class="investment-account-header">
                <h4>${escapeHtml(account.name)} <span class="account-type">(${escapeHtml(account.type)})</span></h4>
                <div class="investment-account-actions">
                    <button class="btn btn--primary btn--sm btn-transfer-account" data-id="${account.id}">Transfer</button>
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
    // Regular account dropdowns
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

    // NEW: Populate transfer dropdowns
    populateTransferDropdowns(appData);
}

// NEW: Populate transfer-specific dropdowns
function populateTransferDropdowns(appData) {
    const transferFromSelect = document.getElementById("transfer-from-account");
    const transferToSelect = document.getElementById("transfer-to-account");

    if (!transferFromSelect || !transferToSelect) return;

    // Populate FROM dropdown (all accounts)
    let fromOptions = '<option value="" disabled selected>— Select source account —</option>';

    // Add cash accounts
    appData.cashAccounts
        .filter(acc => acc.isActive)
        .forEach(acc => {
            fromOptions += `<option value="${acc.id}">${escapeHtml(acc.name)} (Cash) - ${formatCurrency(acc.balance || 0)}</option>`;
        });

    // Add investment accounts
    appData.investmentAccounts.forEach(acc => {
        fromOptions += `<option value="${acc.id}">${escapeHtml(acc.name)} (${escapeHtml(acc.accountType)}) - ${formatCurrency(acc.balance)}</option>`;
    });

    transferFromSelect.innerHTML = fromOptions;

    // Populate TO dropdown (all accounts)
    let toOptions = '<option value="" disabled selected>— Select destination account —</option>';

    // Add cash accounts
    appData.cashAccounts
        .filter(acc => acc.isActive)
        .forEach(acc => {
            toOptions += `<option value="${acc.id}">${escapeHtml(acc.name)} (Cash)</option>`;
        });

    // Add investment accounts  
    appData.investmentAccounts.forEach(acc => {
        toOptions += `<option value="${acc.id}">${escapeHtml(acc.name)} (${escapeHtml(acc.accountType)})</option>`;
    });

    transferToSelect.innerHTML = toOptions;
}