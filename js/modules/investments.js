// js/modules/investments.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatCurrency } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';

export function mapInvestmentAccount(account) {
    return {
        id: account.id,
        name: account.name,
        institution: account.institution,
        accountType: account.account_type,
        balance: safeParseFloat(account.balance),
        dayChange: safeParseFloat(account.day_change),
        holdings: (account.holdings || []).map(h => mapHolding(h))
    };
}

function mapHolding(holding) {
    return {
        id: holding.id,
        symbol: holding.symbol,
        company: holding.company,
        shares: safeParseFloat(holding.shares),
        currentPrice: safeParseFloat(holding.current_price),
        value: safeParseFloat(holding.value)
    };
}

function openInvestmentAccountModal(appData, accountId = null) {
    const form = document.getElementById("investment-account-form");
    const title = document.getElementById("investment-account-modal-title");
    form.reset();
    document.getElementById("investment-account-id").value = "";

    if (accountId) {
        const account = appData.investmentAccounts.find(a => a.id === accountId);
        if (account) {
            title.textContent = "Edit Investment Account";
            document.getElementById("investment-account-id").value = account.id;
            document.getElementById("investment-account-name").value = account.name;
            document.getElementById("investment-account-institution").value = account.institution;
            document.getElementById("investment-account-type").value = account.accountType;
            document.getElementById("investment-account-balance").value = account.balance;
            document.getElementById("investment-account-day-change").value = account.dayChange;
        }
    } else {
        title.textContent = "Add New Investment Account";
        document.getElementById("investment-account-day-change").value = "0";
    }
    openModal('investment-account-modal');
}

async function handleInvestmentAccountSubmit(event, appState, onUpdate) {
    event.preventDefault();
    try {
        const accountId = document.getElementById("investment-account-id").value;
        const accountData = {
            name: document.getElementById("investment-account-name").value,
            institution: document.getElementById("investment-account-institution").value,
            accountType: document.getElementById("investment-account-type").value,
            balance: safeParseFloat(document.getElementById("investment-account-balance").value),
            dayChange: safeParseFloat(document.getElementById("investment-account-day-change").value)
        };

        if (accountId) {
            const savedAccount = await db.updateInvestmentAccount(parseInt(accountId), accountData);
            const index = appState.appData.investmentAccounts.findIndex(a => a.id === parseInt(accountId));
            if (index !== -1) {
                const existingHoldings = appState.appData.investmentAccounts[index].holdings;
                appState.appData.investmentAccounts[index] = mapInvestmentAccount({ ...savedAccount, holdings: existingHoldings });
            }
        } else {
            const savedAccount = await db.addInvestmentAccount(accountData);
            appState.appData.investmentAccounts.push(mapInvestmentAccount(savedAccount));
        }

        closeModal('investment-account-modal');
        await onUpdate();
        announceToScreenReader("Investment account saved successfully");
    } catch (error) {
        showError("Failed to save investment account.");
    }
}

// FIX FOR ISSUE 3: Proper error handling and database updates for dependent data
async function deleteInvestmentAccount(id, appState, onUpdate) {
    if (confirm(`Are you sure you want to delete this account? This will also unlink any savings goals.`)) {
        try {
            // First, update all linked savings goals in the database
            const linkedGoals = appState.appData.savingsGoals.filter(goal => goal.linkedAccountId === id);

            for (const goal of linkedGoals) {
                try {
                    await db.updateSavingsGoal(goal.id, { linked_account_id: null });
                    // Update local state
                    goal.linkedAccountId = null;
                    goal.accountDeleted = true;
                } catch (goalError) {
                    console.error(`Failed to update savings goal ${goal.id}:`, goalError);
                    showError(`Warning: Failed to unlink savings goal "${goal.name}". You may need to update it manually.`);
                }
            }

            // Now delete the investment account
            await db.deleteInvestmentAccount(id);
            appState.appData.investmentAccounts = appState.appData.investmentAccounts.filter(a => a.id !== id);

            await onUpdate();
            announceToScreenReader("Investment account deleted");
        } catch (error) {
            console.error("Error deleting investment account:", error);
            showError("Failed to delete investment account. Please try again.");
        }
    }
}

function openHoldingModal(appData, accountId, holdingId = null) {
    const form = document.getElementById("holding-form");
    const title = document.getElementById("holding-modal-title");
    form.reset();
    document.getElementById("holding-account-id").value = accountId;
    document.getElementById("holding-index").value = "";

    const account = appData.investmentAccounts.find(a => a.id === accountId);
    if (!account) {
        showError("Parent account not found for holding.");
        return;
    }

    if (holdingId) {
        const holdingIndex = account.holdings.findIndex(h => h.id === holdingId);
        if (holdingIndex > -1) {
            const holding = account.holdings[holdingIndex];
            title.textContent = "Edit Holding";
            document.getElementById("holding-index").value = holdingIndex;
            document.getElementById("holding-symbol").value = holding.symbol;
            document.getElementById("holding-company").value = holding.company;
            document.getElementById("holding-shares").value = holding.shares;
            document.getElementById("holding-price").value = holding.currentPrice;
            document.getElementById("holding-value").value = holding.value;
        }
    } else {
        title.textContent = "Add New Holding";
    }
    openModal('holding-modal');
}

async function handleHoldingSubmit(event, appState, onUpdate) {
    event.preventDefault();
    try {
        const accountId = parseInt(document.getElementById("holding-account-id").value);
        const holdingIndex = document.getElementById("holding-index").value;

        const holdingData = {
            symbol: document.getElementById("holding-symbol").value.toUpperCase().trim(),
            company: document.getElementById("holding-company").value.trim(),
            shares: safeParseFloat(document.getElementById("holding-shares").value),
            current_price: safeParseFloat(document.getElementById("holding-price").value),
            value: safeParseFloat(document.getElementById("holding-shares").value) * safeParseFloat(document.getElementById("holding-price").value)
        };

        // Add validation to prevent bad data
        if (!holdingData.symbol) {
            showError("Holding symbol is required.");
            return;
        }
        if (holdingData.shares <= 0 || holdingData.current_price <= 0) {
            showError("Shares and Price must be positive numbers.");
            return;
        }

        const account = appState.appData.investmentAccounts.find(a => a.id === accountId);
        if (account) {
            if (holdingIndex !== "") {
                const holdingId = account.holdings[parseInt(holdingIndex)].id;
                const savedHolding = await db.updateHolding(holdingId, holdingData);
                account.holdings[parseInt(holdingIndex)] = mapHolding(savedHolding);
            } else {
                const savedHolding = await db.addHolding(accountId, holdingData);
                account.holdings.push(mapHolding(savedHolding));
            }

            // Recalculate account balance correctly
            account.balance = account.holdings.reduce((sum, h) => sum + h.value, 0);

            // Use the correct, existing function to update the investment account
            await db.updateInvestmentAccount(accountId, account);
        }

        closeModal('holding-modal');
        await onUpdate();
        announceToScreenReader("Holding saved successfully");
    } catch (error) {
        console.error("Error saving holding:", error);
        showError("Failed to save holding. Please check your inputs and try again.");
    }
}


async function deleteHolding(accountId, holdingId, appState, onUpdate) {
    if (confirm("Are you sure you want to delete this holding?")) {
        try {
            const account = appState.appData.investmentAccounts.find(a => a.id === accountId);
            if (!account) {
                showError("Could not find the associated account.");
                return;
            }

            await db.deleteHolding(holdingId);

            // Update local state
            account.holdings = account.holdings.filter(h => h.id !== holdingId);
            account.balance = account.holdings.reduce((sum, h) => sum + h.value, 0);

            // Update account balance in database using the correct function
            await db.updateInvestmentAccount(accountId, account);

            await onUpdate();
            announceToScreenReader("Holding deleted");
        } catch (error) {
            console.error("Error deleting holding:", error);
            showError("Failed to delete holding. Please try again.");
        }
    }
}

export function renderInvestmentAccountsEnhanced(appState) {
    const { investmentAccounts } = appState.appData;
    const list = document.getElementById("investment-accounts-list");
    const totalValueEl = document.getElementById("investment-total-value");
    const dayChangeEl = document.getElementById("investment-day-change");

    if (!list || !totalValueEl || !dayChangeEl) return;

    const totalValue = investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalDayChange = investmentAccounts.reduce((sum, acc) => sum + acc.dayChange, 0);

    totalValueEl.textContent = formatCurrency(totalValue);
    dayChangeEl.textContent = formatCurrency(totalDayChange);
    dayChangeEl.className = `metric-value ${totalDayChange >= 0 ? 'text-success' : 'text-error'}`;

    if (investmentAccounts.length === 0) {
        list.innerHTML = `<div class="empty-state">No investment accounts added yet.</div>`;
        return;
    }

    list.innerHTML = investmentAccounts.map(account => `
        <div class="investment-account" data-id="${account.id}">
            <div class="investment-account-header">
                <h4>${escapeHtml(account.name)} <span class="account-type">(${escapeHtml(account.accountType)})</span></h4>
                <div class="investment-account-actions">
                    <button class="btn btn--secondary btn--sm btn-edit-account" data-id="${account.id}">Edit</button>
                    <button class="btn btn--outline btn--sm btn-delete-account" data-id="${account.id}">Delete</button>
                </div>
            </div>
            <div class="account-info">
                <div class="account-info-item"><span class="account-info-label">Institution</span><span class="account-info-value">${escapeHtml(account.institution)}</span></div>
                <div class="account-info-item"><span class="account-info-label">Balance</span><span class="account-info-value">${formatCurrency(account.balance)}</span></div>
                <div class="account-info-item"><span class="account-info-label">Day Change</span><span class="account-info-value ${account.dayChange >= 0 ? 'text-success' : 'text-error'}">${formatCurrency(account.dayChange)}</span></div>
            </div>
            <div class="holdings">
                <div class="holdings-header">
                    <h5>Holdings</h5>
                    <button class="btn btn--primary btn--sm btn-add-holding" data-id="${account.id}">Add Holding</button>
                </div>
                ${account.holdings.length > 0 ? `
                <table class="holdings-table">
                    <thead><tr><th>Symbol</th><th>Shares</th><th>Price</th><th>Value</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${account.holdings.map(h => `
                            <tr data-holding-id="${h.id}">
                                <td>${escapeHtml(h.symbol)}</td>
                                <td>${h.shares.toFixed(3)}</td>
                                <td>${formatCurrency(h.currentPrice)}</td>
                                <td>${formatCurrency(h.value)}</td>
                                <td>
                                    <div class="holding-actions">
                                        <button class="btn btn-small btn-edit-holding">Edit</button>
                                        <button class="btn btn-small btn-delete-holding">Delete</button>
                                    </div>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>` : '<div class="empty-state empty-state--small">No holdings for this account.</div>'}
            </div>
        </div>
    `).join('');
}

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("add-investment-account-btn")?.addEventListener("click", () => openInvestmentAccountModal(appState.appData));
    document.getElementById("close-investment-account-modal")?.addEventListener("click", () => closeModal('investment-account-modal'));
    document.getElementById("cancel-investment-account-btn")?.addEventListener("click", () => closeModal('investment-account-modal'));
    document.getElementById("investment-account-form")?.addEventListener("submit", (e) => handleInvestmentAccountSubmit(e, appState, onUpdate));

    document.getElementById("investment-accounts-list")?.addEventListener('click', event => {
        const target = event.target;
        const accountEl = target.closest('.investment-account');
        if (!accountEl) return;
        const accountId = parseInt(accountEl.getAttribute('data-id'));

        if (target.classList.contains('btn-edit-account')) {
            openInvestmentAccountModal(appState.appData, accountId);
        } else if (target.classList.contains('btn-delete-account')) {
            deleteInvestmentAccount(accountId, appState, onUpdate);
        } else if (target.classList.contains('btn-add-holding')) {
            openHoldingModal(appState.appData, accountId);
        } else if (target.classList.contains('btn-edit-holding')) {
            const holdingId = parseInt(target.closest('tr').getAttribute('data-holding-id'));
            openHoldingModal(appState.appData, accountId, holdingId);
        } else if (target.classList.contains('btn-delete-holding')) {
            const holdingId = parseInt(target.closest('tr').getAttribute('data-holding-id'));
            deleteHolding(accountId, holdingId, appState, onUpdate);
        }
    });

    document.getElementById("close-holding-modal")?.addEventListener("click", () => closeModal('holding-modal'));
    document.getElementById("cancel-holding-btn")?.addEventListener("click", () => closeModal('holding-modal'));
    document.getElementById("holding-form")?.addEventListener("submit", (e) => handleHoldingSubmit(e, appState, onUpdate));

    // Auto-calculate holding value
    document.getElementById('holding-shares')?.addEventListener('input', updateHoldingValue);
    document.getElementById('holding-price')?.addEventListener('input', updateHoldingValue);
}

function updateHoldingValue() {
    const shares = safeParseFloat(document.getElementById('holding-shares').value);
    const price = safeParseFloat(document.getElementById('holding-price').value);
    document.getElementById('holding-value').value = (shares * price).toFixed(2);
}