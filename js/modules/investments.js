// js/modules/investments.js - Updated with Stock API Integration
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatCurrency } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import { stockApiService, HoldingsUpdater, formatLastUpdateTime } from './stockApi.js';

// Initialize holdings updater (will be set with appState later)
let holdingsUpdater = null;

// Track last update time
let lastUpdateTime = null;

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

async function deleteInvestmentAccount(id, appState, onUpdate) {
    if (confirm(`Are you sure you want to delete this account? This will also unlink any savings goals.`)) {
        try {
            const linkedGoals = appState.appData.savingsGoals.filter(goal => goal.linkedAccountId === id);

            for (const goal of linkedGoals) {
                try {
                    await db.updateSavingsGoal(goal.id, { linked_account_id: null });
                    goal.linkedAccountId = null;
                    goal.accountDeleted = true;
                } catch (goalError) {
                    console.error(`Failed to update savings goal ${goal.id}:`, goalError);
                    showError(`Warning: Failed to unlink savings goal "${goal.name}". You may need to update it manually.`);
                }
            }

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

            // FIXED: Only recalculate balance from holdings if this account has holdings
            // For savings accounts and other accounts without holdings, preserve the manually set balance
            if (account.holdings && account.holdings.length > 0) {
                account.balance = account.holdings.reduce((sum, h) => sum + h.value, 0);
                await db.updateInvestmentAccount(accountId, account);
            }
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

            account.holdings = account.holdings.filter(h => h.id !== holdingId);

            // FIXED: Only recalculate balance from holdings if this account still has holdings
            // If no holdings remain, preserve the account's balance (don't set to 0)
            if (account.holdings && account.holdings.length > 0) {
                account.balance = account.holdings.reduce((sum, h) => sum + h.value, 0);
                await db.updateInvestmentAccount(accountId, account);
            }

            await onUpdate();
            announceToScreenReader("Holding deleted");
        } catch (error) {
            console.error("Error deleting holding:", error);
            showError("Failed to delete holding. Please try again.");
        }
    }
}

// NEW: Stock price update functions
async function updateAllStockPrices(appState, onUpdate) {
    if (!holdingsUpdater) {
        showError("Stock API service not initialized. Please check your API configuration.");
        return;
    }

    try {
        // Show loading state
        const updateBtn = document.getElementById('update-all-prices-btn');
        if (updateBtn) {
            updateBtn.disabled = true;
            updateBtn.textContent = 'Updating...';
        }

        announceToScreenReader("Updating stock prices...");

        const results = await holdingsUpdater.updateAllHoldings();
        lastUpdateTime = Date.now();

        await onUpdate();

        const message = `Updated ${results.updated} holdings, ${results.skipped} skipped, ${results.failed} failed`;
        announceToScreenReader(message);

        // Show success message briefly
        if (updateBtn) {
            updateBtn.textContent = '✓ Updated';
            setTimeout(() => {
                updateBtn.textContent = 'Update Prices';
                updateBtn.disabled = false;
            }, 2000);
        }

    } catch (error) {
        console.error("Error updating stock prices:", error);
        showError("Failed to update stock prices. Please check your internet connection and API key.");

        // Reset button
        const updateBtn = document.getElementById('update-all-prices-btn');
        if (updateBtn) {
            updateBtn.textContent = 'Update Prices';
            updateBtn.disabled = false;
        }
    }
}

async function updateSingleHolding(symbol, appState, onUpdate) {
    if (!holdingsUpdater) {
        showError("Stock API service not initialized.");
        return;
    }

    try {
        const success = await holdingsUpdater.updateHoldingBySymbol(symbol);
        if (success) {
            await onUpdate();
            announceToScreenReader(`Updated ${symbol}`);
        } else {
            showError(`Failed to update ${symbol}. Symbol may not be found.`);
        }
    } catch (error) {
        console.error(`Error updating ${symbol}:`, error);
        showError(`Failed to update ${symbol}.`);
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

    // Add update button and last update info at the top
    const updateControlsHTML = `
        <div class="investment-update-controls" style="margin-bottom: 1rem; padding: 1rem; background: var(--color-secondary); border-radius: var(--radius-base);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <button id="update-all-prices-btn" class="btn btn--primary">Update All Prices</button>
                <span style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
                    Last updated: ${formatLastUpdateTime(lastUpdateTime)}
                </span>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                Fetches real-time stock prices for all holdings with valid symbols
            </div>
        </div>
    `;

    list.innerHTML = updateControlsHTML + investmentAccounts.map(account => `
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
                        ${account.holdings.map(h => {
        const isValidSymbol = stockApiService.isValidSymbol(h.symbol);
        return `
                            <tr data-holding-id="${h.id}">
                                <td>
                                    ${escapeHtml(h.symbol)}
                                    ${isValidSymbol ? '<span style="color: var(--color-success); font-size: 0.8em;">📈</span>' : '<span style="color: var(--color-text-secondary); font-size: 0.8em;">—</span>'}
                                </td>
                                <td>${h.shares.toFixed(3)}</td>
                                <td>${formatCurrency(h.currentPrice)}</td>
                                <td>${formatCurrency(h.value)}</td>
                                <td>
                                    <div class="holding-actions">
                                        ${isValidSymbol ? `<button class="btn btn-small btn--secondary btn-update-holding" data-symbol="${h.symbol}" title="Update ${h.symbol} price">📊</button>` : ''}
                                        <button class="btn btn-small btn-edit-holding">Edit</button>
                                        <button class="btn btn-small btn-delete-holding">Delete</button>
                                    </div>
                                </td>
                            </tr>`;
    }).join('')}
                    </tbody>
                </table>` : '<div class="empty-state empty-state--small">No holdings for this account.</div>'}
            </div>
        </div>
    `).join('');
}

export function setupEventListeners(appState, onUpdate) {
    // Initialize holdings updater with appState
    holdingsUpdater = new HoldingsUpdater(appState, stockApiService);

    // Add a DIRECT event listener for the update prices button
    document.addEventListener('click', event => {
        if (event.target.id === 'update-all-prices-btn') {
            updateAllStockPrices(appState, onUpdate);
        }
    });

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
        } else if (target.classList.contains('btn-update-holding')) {
            const symbol = target.getAttribute('data-symbol');
            updateSingleHolding(symbol, appState, onUpdate);
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