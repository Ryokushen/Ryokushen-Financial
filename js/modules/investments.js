// js/modules/investments.js - Updated with Stock API Integration
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatCurrency, debounce } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import {
  stockApiService,
  HoldingsUpdater,
  formatLastUpdateTime,
  initializeServices,
} from './stockApi.js';
import { loadingState, showButtonSuccess, showButtonError } from './loadingState.js';
import { domCache, cacheFormElements } from './domCache.js';
import { batchUpdateSavingsGoal, flushBatch } from './batchOperations.js';
import { debug } from './debug.js';
import { sumMoney, multiplyMoney } from './financialMath.js';
import {
  validateForm,
  ValidationSchemas,
  showFieldError,
  clearFormErrors,
  validateWithAsyncRules,
  AsyncValidators,
} from './validation.js';
import { InvestmentCalculators } from './investmentCalculators.js';
import { eventManager } from './eventManager.js';

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
    holdings: (account.holdings || []).map(h => mapHolding(h)),
  };
}

function mapHolding(holding) {
  return {
    id: holding.id,
    symbol: holding.symbol,
    company: holding.company,
    shares: safeParseFloat(holding.shares),
    currentPrice: safeParseFloat(holding.current_price),
    value: safeParseFloat(holding.value),
  };
}

function openInvestmentAccountModal(appData, accountId = null) {
  // Cache form elements
  const elements = domCache.cacheElements({
    form: 'investment-account-form',
    title: 'investment-account-modal-title',
    accountId: 'investment-account-id',
    name: 'investment-account-name',
    institution: 'investment-account-institution',
    type: 'investment-account-type',
    balance: 'investment-account-balance',
    dayChange: 'investment-account-day-change',
  });

  elements.form.reset();
  elements.accountId.value = '';

  if (accountId) {
    const account = appData.investmentAccounts.find(a => a.id === accountId);
    if (account) {
      elements.title.textContent = 'Edit Investment Account';
      elements.accountId.value = account.id;
      elements.name.value = account.name;
      elements.institution.value = account.institution;
      elements.type.value = account.accountType;
      elements.balance.value = account.balance;
      elements.dayChange.value = account.dayChange;
    }
  } else {
    elements.title.textContent = 'Add New Investment Account';
    elements.dayChange.value = '0';
  }
  openModal('investment-account-modal');
}

async function handleInvestmentAccountSubmit(event, appState, onUpdate) {
  event.preventDefault();

  // Clear previous errors
  clearFormErrors('investment-account-form');

  try {
    // Use cached elements
    const elements = domCache.cacheElements({
      accountId: 'investment-account-id',
      name: 'investment-account-name',
      institution: 'investment-account-institution',
      type: 'investment-account-type',
      balance: 'investment-account-balance',
      dayChange: 'investment-account-day-change',
    });

    const accountId = elements.accountId.value;
    const accountData = {
      name: elements.name.value,
      institution: elements.institution.value,
      accountType: elements.type.value,
      balance: safeParseFloat(elements.balance.value),
      dayChange: safeParseFloat(elements.dayChange.value),
    };

    // Validate form data with async validation
    const asyncValidators = {
      name: AsyncValidators.uniqueInvestmentAccountName(
        appState.appData.investmentAccounts,
        accountId ? parseInt(accountId) : null
      ),
    };

    const { errors, hasErrors } = await validateWithAsyncRules(
      accountData,
      ValidationSchemas.investmentAccount,
      asyncValidators
    );

    if (hasErrors) {
      // Show field-level errors
      Object.entries(errors).forEach(([field, error]) => {
        const fieldId =
          field === 'accountType'
            ? 'investment-account-type'
            : field === 'dayChange'
              ? 'investment-account-day-change'
              : `investment-account-${field}`;
        showFieldError(fieldId, error);
      });
      showError('Please correct the errors in the form.');
      return;
    }

    if (accountId) {
      const savedAccount = await db.updateInvestmentAccount(parseInt(accountId), accountData);
      const index = appState.appData.investmentAccounts.findIndex(
        a => a.id === parseInt(accountId)
      );
      if (index !== -1) {
        const existingHoldings = appState.appData.investmentAccounts[index].holdings;
        appState.appData.investmentAccounts[index] = mapInvestmentAccount({
          ...savedAccount,
          holdings: existingHoldings,
        });
      }
    } else {
      const savedAccount = await db.addInvestmentAccount(accountData);
      appState.appData.investmentAccounts.push(mapInvestmentAccount(savedAccount));
    }

    closeModal('investment-account-modal');
    await onUpdate();
    announceToScreenReader('Investment account saved successfully');
  } catch (error) {
    showError('Failed to save investment account.');
  }
}

async function deleteInvestmentAccount(id, appState, onUpdate) {
  if (
    confirm(
      'Are you sure you want to delete this account? This will also unlink any savings goals.'
    )
  ) {
    loadingState.showOperationLock('Deleting investment account...');
    try {
      const linkedGoals = appState.appData.savingsGoals.filter(goal => goal.linkedAccountId === id);

      // Batch update all linked savings goals
      const updatePromises = linkedGoals.map(goal =>
        batchUpdateSavingsGoal(goal.id, { linked_account_id: null })
          .then(() => {
            goal.linkedAccountId = null;
            goal.accountDeleted = true;
          })
          .catch(goalError => {
            debug.error(`Failed to update savings goal ${goal.id}:`, goalError);
            showError(
              `Warning: Failed to unlink savings goal "${goal.name}". You may need to update it manually.`
            );
          })
      );

      await Promise.all(updatePromises);
      await flushBatch();

      await db.deleteInvestmentAccount(id);
      appState.appData.investmentAccounts = appState.appData.investmentAccounts.filter(
        a => a.id !== id
      );

      loadingState.hideOperationLock();
      await onUpdate();
      announceToScreenReader('Investment account deleted');
    } catch (error) {
      loadingState.hideOperationLock();
      debug.error('Error deleting investment account:', error);
      showError('Failed to delete investment account. Please try again.');
    }
  }
}

function openHoldingModal(appData, accountId, holdingId = null) {
  const account = appData.investmentAccounts.find(a => a.id === accountId);
  if (!account) {
    showError('Parent account not found for holding.');
    return;
  }

  const modalData = { accountId, holdingId };

  // Populate after modal opens and form is reset
  setTimeout(() => {
    document.getElementById('holding-account-id').value = accountId;
    document.getElementById('holding-index').value = '';

    if (holdingId) {
      const holdingIndex = account.holdings.findIndex(h => h.id === holdingId);
      if (holdingIndex > -1) {
        const holding = account.holdings[holdingIndex];
        document.getElementById('holding-index').value = holdingIndex;
        document.getElementById('holding-symbol').value = holding.symbol;
        document.getElementById('holding-company').value = holding.company;
        document.getElementById('holding-shares').value = holding.shares;
        document.getElementById('holding-price').value = holding.currentPrice;
        document.getElementById('holding-value').value = holding.value;
      }
    }
  }, 0);

  openModal('holding-modal', modalData);
}

async function handleHoldingSubmit(event, appState, onUpdate) {
  event.preventDefault();

  // Clear previous errors
  clearFormErrors('holding-form');

  try {
    const accountId = parseInt(document.getElementById('holding-account-id').value);
    const holdingIndex = document.getElementById('holding-index').value;

    const formData = {
      symbol: document.getElementById('holding-symbol').value.toUpperCase().trim(),
      shares: safeParseFloat(document.getElementById('holding-shares').value),
      price: safeParseFloat(document.getElementById('holding-price').value),
    };

    // Validate form data
    const { errors, hasErrors } = validateForm(formData, ValidationSchemas.holding);

    if (hasErrors) {
      // Show field-level errors
      Object.entries(errors).forEach(([field, error]) => {
        showFieldError(`holding-${field}`, error);
      });
      showError('Please correct the errors in the form.');
      return;
    }

    // Add computed fields after validation
    const holdingData = {
      symbol: formData.symbol,
      shares: formData.shares,
      company: document.getElementById('holding-company').value.trim(),
      current_price: formData.price,
      value: multiplyMoney(formData.shares, formData.price),
    };

    const account = appState.appData.investmentAccounts.find(a => a.id === accountId);
    if (account) {
      if (holdingIndex !== '') {
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
        account.balance = sumMoney(account.holdings.map(h => h.value));
        await db.updateInvestmentAccount(accountId, account);
      }
    }

    closeModal('holding-modal');
    await onUpdate();
    announceToScreenReader('Holding saved successfully');
  } catch (error) {
    debug.error('Error saving holding:', error);
    showError('Failed to save holding. Please check your inputs and try again.');
  }
}

async function deleteHolding(accountId, holdingId, appState, onUpdate) {
  if (confirm('Are you sure you want to delete this holding?')) {
    try {
      const account = appState.appData.investmentAccounts.find(a => a.id === accountId);
      if (!account) {
        showError('Could not find the associated account.');
        return;
      }

      await db.deleteHolding(holdingId);

      account.holdings = account.holdings.filter(h => h.id !== holdingId);

      // FIXED: Only recalculate balance from holdings if this account still has holdings
      // If no holdings remain, preserve the account's balance (don't set to 0)
      if (account.holdings && account.holdings.length > 0) {
        account.balance = sumMoney(account.holdings.map(h => h.value));
        await db.updateInvestmentAccount(accountId, account);
      }

      await onUpdate();
      announceToScreenReader('Holding deleted');
    } catch (error) {
      debug.error('Error deleting holding:', error);
      showError('Failed to delete holding. Please try again.');
    }
  }
}

// NEW: Stock price update functions
async function updateAllStockPrices(appState, onUpdate) {
  // Ensure services are initialized
  const services = initializeServices();
  if (!holdingsUpdater) {
    holdingsUpdater = new HoldingsUpdater(appState, services.stockApiService);
  }

  if (!services.stockApiService.isConfigured) {
    showError(
      'Stock price updates require a Finnhub API key. Get a free key at finnhub.io and configure it in Settings.'
    );
    return;
  }

  const operation = async () => {
    announceToScreenReader('Updating stock prices...');
    const results = await holdingsUpdater.updateAllHoldings();
    lastUpdateTime = Date.now();
    await onUpdate();

    // Build detailed message including mutual funds
    let message = `Updated ${results.updated} holdings`;
    if (results.mutualFunds > 0) {
      message += ` (${results.mutualFunds} mutual funds skipped - not supported by free tier)`;
    }
    if (results.skipped > 0) {
      message += `, ${results.skipped} other skipped`;
    }
    if (results.failed > 0) {
      message += `, ${results.failed} failed`;
    }

    announceToScreenReader(message);

    // Show button status
    if (results.failed === 0 && results.mutualFunds === 0) {
      showButtonSuccess('update-all-prices-btn', '✓ Updated');
    } else if (results.failed > 0) {
      showButtonError('update-all-prices-btn', `⚠ ${results.failed} Failed`);
    } else if (results.mutualFunds > 0) {
      showButtonSuccess(
        'update-all-prices-btn',
        `✓ Updated (${results.mutualFunds} funds skipped)`
      );
    }

    // Show info message if mutual funds were skipped
    if (results.mutualFunds > 0) {
      const infoDiv = document.createElement('div');
      infoDiv.style.cssText =
        'background: var(--color-warning-bg); color: var(--color-warning); padding: 0.75rem; border-radius: var(--radius-md); margin-top: 0.5rem; font-size: var(--font-size-sm);';
      infoDiv.innerHTML = `ℹ️ ${results.mutualFunds} mutual fund${results.mutualFunds > 1 ? 's' : ''} (symbols ending in X) cannot be updated with the free Finnhub API. Consider using regular ETFs instead for real-time updates.`;

      const updateControls = document.querySelector('.investment-update-controls');
      if (updateControls) {
        // Remove any existing info message
        const existingInfo = updateControls.querySelector('.mutual-fund-info');
        if (existingInfo) {
          existingInfo.remove();
        }
        infoDiv.className = 'mutual-fund-info';
        updateControls.appendChild(infoDiv);
      }
    }

    return results;
  };

  try {
    await loadingState.executeWithLoading('updateAllStockPrices', operation, {
      buttonId: 'update-all-prices-btn',
      loadingText: 'Updating...',
      lockScreen: true,
      lockMessage: 'Updating stock prices...',
    });
  } catch (error) {
    debug.error('Error updating stock prices:', error);
    showError('Failed to update stock prices. Please check your internet connection and API key.');
    showButtonError('update-all-prices-btn');
  }
}

async function updateSingleHolding(symbol, appState, onUpdate) {
  try {
    // Ensure services are initialized
    const services = initializeServices();
    if (!holdingsUpdater) {
      holdingsUpdater = new HoldingsUpdater(appState, services.stockApiService);
    }

    if (!services.stockApiService.isConfigured) {
      showError(
        'Stock price updates require a Finnhub API key. Get a free key at finnhub.io and configure it in Settings.'
      );
      return;
    }

    // Check if it's a mutual fund
    if (services.stockApiService.isMutualFundSymbol(symbol)) {
      showError(
        `${symbol} is a mutual fund and cannot be updated with Finnhub free tier. Consider using ETFs instead.`
      );
      return;
    }

    const success = await holdingsUpdater.updateHoldingBySymbol(symbol);
    if (success) {
      await onUpdate();
      announceToScreenReader(`Updated ${symbol}`);
    } else {
      showError(`Failed to update ${symbol}. Symbol may not be found.`);
    }
  } catch (error) {
    debug.error(`Error updating ${symbol}:`, error);
    showError(`Failed to update ${symbol}: ${error.message || 'Unknown error'}`);
  }
}

// Helper function to get holding type icon
function getHoldingIcon(symbol, company) {
  // Try to determine type from symbol or company name
  const symbolUpper = symbol.toUpperCase();
  const companyLower = (company || '').toLowerCase();

  if (symbolUpper.includes('ETF') || companyLower.includes('etf')) {
    return '📊';
  }
  if (symbolUpper.includes('FUND') || companyLower.includes('fund')) {
    return '🏦';
  }
  if (symbolUpper.includes('BOND') || companyLower.includes('bond')) {
    return '📜';
  }
  if (symbolUpper.includes('REIT') || companyLower.includes('reit')) {
    return '🏢';
  }
  if (companyLower.includes('money market') || symbolUpper.includes('MM')) {
    return '💵';
  }

  // Default to stock icon
  return '💼';
}

// Helper function to get account type icon and gradient
function getAccountStyle(accountType) {
  const type = (accountType || '').toLowerCase();

  if (type.includes('roth') || type.includes('ira')) {
    return {
      icon: '🏦',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    };
  }
  if (type.includes('401k') || type.includes('403b')) {
    return {
      icon: '💼',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    };
  }
  if (type.includes('brokerage') || type.includes('taxable')) {
    return {
      icon: '📈',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    };
  }
  if (type.includes('savings')) {
    return {
      icon: '💰',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    };
  }

  // Default
  return {
    icon: '💹',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  };
}

export function renderInvestmentAccountsEnhanced(appState) {
  const { investmentAccounts } = appState.appData;
  const list = document.getElementById('investment-accounts-list');
  const totalValueEl = document.getElementById('investment-total-value');
  const dayChangeEl = document.getElementById('investment-day-change');
  const dayChangePercentEl = document.getElementById('investment-day-change-percent');
  const accountsCountEl = document.getElementById('investment-accounts-count');
  const accountsTypesEl = document.getElementById('investment-accounts-types');
  const holdingsCountEl = document.getElementById('investment-holdings-count');
  const holdingsBreakdownEl = document.getElementById('investment-holdings-breakdown');
  const bestPerformerEl = document.getElementById('investment-best-performer');

  if (!list || !totalValueEl || !dayChangeEl) {
    return;
  }

  const totalValue = sumMoney(investmentAccounts.map(acc => acc.balance));
  const totalDayChange = sumMoney(investmentAccounts.map(acc => acc.dayChange));
  const dayChangePercent = totalValue > 0 ? ((totalDayChange / totalValue) * 100).toFixed(2) : 0;

  // Update summary cards
  totalValueEl.textContent = formatCurrency(totalValue);
  dayChangeEl.textContent = formatCurrency(Math.abs(totalDayChange));
  dayChangeEl.className = totalDayChange >= 0 ? 'summary-value positive' : 'summary-value negative';

  if (dayChangePercentEl) {
    const arrow = totalDayChange >= 0 ? '↑' : '↓';
    dayChangePercentEl.textContent = `${arrow} ${Math.abs(dayChangePercent)}% Today`;
    dayChangePercentEl.className =
      totalDayChange >= 0 ? 'summary-change positive' : 'summary-change negative';
  }

  if (accountsCountEl) {
    accountsCountEl.textContent = `${investmentAccounts.length} Active`;
  }

  if (accountsTypesEl) {
    const types = [...new Set(investmentAccounts.map(a => a.accountType))];
    accountsTypesEl.textContent = types.length > 0 ? types.join(', ') : 'No accounts';
  }

  // Calculate total holdings and breakdown
  let totalHoldings = 0;
  const holdingTypes = { stocks: 0, etfs: 0, funds: 0, other: 0 };
  let bestPerformer = null;
  let bestPerformance = 0;

  investmentAccounts.forEach(account => {
    account.holdings.forEach(holding => {
      totalHoldings++;
      const icon = getHoldingIcon(holding.symbol, holding.company);
      if (icon === '💼') {
        holdingTypes.stocks++;
      } else if (icon === '📊') {
        holdingTypes.etfs++;
      } else if (icon === '🏦') {
        holdingTypes.funds++;
      } else {
        holdingTypes.other++;
      }

      // Track best performer (simplified - would need previous price for real calculation)
      if (holding.value > bestPerformance) {
        bestPerformance = holding.value;
        bestPerformer = holding.symbol;
      }
    });
  });

  if (holdingsCountEl) {
    holdingsCountEl.textContent = `${totalHoldings} Positions`;
  }

  if (holdingsBreakdownEl) {
    const breakdown = [];
    if (holdingTypes.stocks > 0) {
      breakdown.push(`${holdingTypes.stocks} Stocks`);
    }
    if (holdingTypes.etfs > 0) {
      breakdown.push(`${holdingTypes.etfs} ETFs`);
    }
    if (holdingTypes.funds > 0) {
      breakdown.push(`${holdingTypes.funds} Funds`);
    }
    if (holdingTypes.other > 0) {
      breakdown.push(`${holdingTypes.other} Other`);
    }
    holdingsBreakdownEl.textContent = breakdown.length > 0 ? breakdown.join(', ') : 'No holdings';
  }

  if (bestPerformerEl) {
    bestPerformerEl.textContent = bestPerformer ? `↑ Best: ${bestPerformer}` : 'No data';
    if (bestPerformer) {
      bestPerformerEl.className = 'summary-change positive';
    }
  }

  if (investmentAccounts.length === 0) {
    list.innerHTML = '<div class="empty-state">No investment accounts added yet.</div>';
    return;
  }

  // Add update button and last update info at the top
  const updateControlsHTML = `
        <div class="investment-update-controls" style="margin-bottom: 1rem; padding: 1rem; background: var(--glass-bg); backdrop-filter: blur(10px); border-radius: var(--radius-lg); border: 1px solid var(--glass-border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <button id="update-all-prices-btn" class="btn btn--primary">Update All Prices</button>
                <span style="font-size: var(--font-size-sm); opacity: 0.8;">
                    Last updated: ${formatLastUpdateTime(lastUpdateTime)}
                </span>
            </div>
            <div style="font-size: var(--font-size-xs); opacity: 0.7;">
                Fetches real-time stock prices for all holdings with valid symbols
            </div>
        </div>
    `;

  // Get the current stockApiService to check symbol validity
  const services = initializeServices();
  const currentStockApiService = services.stockApiService;

  // Render expandable account cards
  list.innerHTML =
    updateControlsHTML +
    investmentAccounts
      .map((account, index) => {
        const accountStyle = getAccountStyle(account.accountType);
        const dayChangePercent =
          account.balance > 0 ? ((account.dayChange / account.balance) * 100).toFixed(1) : 0;
        const isExpanded = index === 0; // Expand first account by default

        return `
        <div class="investment-account-card ${isExpanded ? 'expanded' : ''}" data-id="${account.id}">
            <div class="investment-account-header" onclick="this.parentElement.classList.toggle('expanded')">
                <div class="investment-account-info">
                    <div class="investment-account-icon" style="background: ${accountStyle.gradient}">
                        ${accountStyle.icon}
                    </div>
                    <div class="investment-account-details">
                        <h3>${escapeHtml(account.name)}</h3>
                        <div class="investment-account-type">${escapeHtml(account.institution)} • ${escapeHtml(account.accountType)}</div>
                    </div>
                </div>
                <div class="investment-account-metrics">
                    <div class="investment-account-value">
                        <div class="amount" data-sensitive="true">${formatCurrency(account.balance)}</div>
                        <div class="change ${account.dayChange >= 0 ? 'positive' : 'negative'}">
                            ${account.dayChange >= 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(account.dayChange))} (${Math.abs(dayChangePercent)}%)
                        </div>
                    </div>
                    <div class="expand-icon">⌄</div>
                </div>
            </div>
            
            <div class="holdings-container">
                <div class="holdings-list">
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) 0; margin-bottom: var(--space-2);">
                        <h4 style="font-size: var(--font-size-lg); margin: 0;">Holdings</h4>
                        <button class="btn btn--primary btn--sm btn-add-holding" data-id="${account.id}">+ Add Holding</button>
                    </div>
                    ${
                      account.holdings.length > 0
                        ? account.holdings
                            .map(h => {
                              const holdingIcon = getHoldingIcon(h.symbol, h.company);
                              const isValidSymbol = currentStockApiService.isValidSymbol(h.symbol);
                              const isMutualFund = currentStockApiService.isMutualFundSymbol(
                                h.symbol
                              );
                              const percentOfAccount =
                                account.balance > 0
                                  ? ((h.value / account.balance) * 100).toFixed(1)
                                  : 0;

                              return `
                        <div class="holding-row" data-holding-id="${h.id}">
                            <div class="holding-symbol">
                                <div class="holding-icon">${holdingIcon}</div>
                                <div class="holding-symbol-info">
                                    <div class="symbol">${escapeHtml(h.symbol)}${isMutualFund ? ' <span style="font-size: var(--font-size-xs); opacity: 0.7;">(Fund)</span>' : ''}</div>
                                    <div class="type">${h.company || 'Stock'}</div>
                                </div>
                            </div>
                            <div>${h.shares.toFixed(3)} shares</div>
                            <div data-sensitive="true">${formatCurrency(h.currentPrice)}</div>
                            <div class="holding-value" data-sensitive="true">${formatCurrency(h.value)}</div>
                            <div>
                                <div>${percentOfAccount}%</div>
                                <div class="holdings-actions">
                                    ${isValidSymbol && !isMutualFund ? `<button class="icon-btn btn-update-holding" data-symbol="${h.symbol}" title="Update price">📊</button>` : ''}
                                    <button class="icon-btn btn-edit-holding" title="Edit">✏️</button>
                                    <button class="icon-btn btn-delete-holding" title="Delete">🗑️</button>
                                </div>
                            </div>
                        </div>`;
                            })
                            .join('')
                        : '<div class="empty-state" style="padding: var(--space-6); text-align: center; opacity: 0.7;">No holdings for this account yet.</div>'
                    }
                    
                    <div style="display: flex; gap: var(--space-3); margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--glass-border);">
                        <button class="btn btn--secondary btn--sm btn-edit-account" data-id="${account.id}">Edit Account</button>
                        <button class="btn btn--outline btn--sm btn-delete-account" data-id="${account.id}">Delete Account</button>
                    </div>
                </div>
            </div>
        </div>
        `;
      })
      .join('');

  // Update account dropdown for calculators
  populateAccountDropdown(appState.appData);
}

export function setupEventListeners(appState, onUpdate) {
  // Initialize services and holdings updater with appState
  const services = initializeServices();
  holdingsUpdater = new HoldingsUpdater(appState, services.stockApiService);

  // Add a DIRECT event listener for the update prices button
  eventManager.addEventListener(document, 'click', event => {
    if (event.target.id === 'update-all-prices-btn') {
      updateAllStockPrices(appState, onUpdate);
    }
  });

  const addInvestmentBtn = document.getElementById('add-investment-account-btn');
  if (addInvestmentBtn) {
    eventManager.addEventListener(addInvestmentBtn, 'click', () =>
      openInvestmentAccountModal(appState.appData)
    );
  }

  const closeInvestmentModalBtn = document.getElementById('close-investment-account-modal');
  if (closeInvestmentModalBtn) {
    eventManager.addEventListener(closeInvestmentModalBtn, 'click', () =>
      closeModal('investment-account-modal')
    );
  }

  const cancelInvestmentBtn = document.getElementById('cancel-investment-account-btn');
  if (cancelInvestmentBtn) {
    eventManager.addEventListener(cancelInvestmentBtn, 'click', () =>
      closeModal('investment-account-modal')
    );
  }

  const investmentForm = document.getElementById('investment-account-form');
  if (investmentForm) {
    eventManager.addEventListener(investmentForm, 'submit', e =>
      handleInvestmentAccountSubmit(e, appState, onUpdate)
    );
  }

  const investmentAccountsList = document.getElementById('investment-accounts-list');
  if (investmentAccountsList) {
    eventManager.addEventListener(investmentAccountsList, 'click', event => {
      const target = event.target;

      // Prevent header click from triggering button actions
      if (target.closest('.investment-account-header') && !target.closest('button')) {
        return; // Let the inline onclick handler handle the expand/collapse
      }

      const accountEl = target.closest('.investment-account-card');
      if (!accountEl) {
        return;
      }
      const accountId = parseInt(accountEl.getAttribute('data-id'));

      if (target.classList.contains('btn-edit-account')) {
        openInvestmentAccountModal(appState.appData, accountId);
      } else if (target.classList.contains('btn-delete-account')) {
        deleteInvestmentAccount(accountId, appState, onUpdate);
      } else if (target.classList.contains('btn-add-holding')) {
        openHoldingModal(appState.appData, accountId);
      } else if (target.classList.contains('btn-edit-holding')) {
        const holdingRow = target.closest('.holding-row');
        const holdingId = parseInt(holdingRow.getAttribute('data-holding-id'));
        openHoldingModal(appState.appData, accountId, holdingId);
      } else if (target.classList.contains('btn-delete-holding')) {
        const holdingRow = target.closest('.holding-row');
        const holdingId = parseInt(holdingRow.getAttribute('data-holding-id'));
        deleteHolding(accountId, holdingId, appState, onUpdate);
      } else if (target.classList.contains('btn-update-holding')) {
        const symbol = target.getAttribute('data-symbol');
        updateSingleHolding(symbol, appState, onUpdate);
      }
    });
  }

  const closeHoldingModalBtn = document.getElementById('close-holding-modal');
  if (closeHoldingModalBtn) {
    eventManager.addEventListener(closeHoldingModalBtn, 'click', () => closeModal('holding-modal'));
  }

  const cancelHoldingBtn = document.getElementById('cancel-holding-btn');
  if (cancelHoldingBtn) {
    eventManager.addEventListener(cancelHoldingBtn, 'click', () => closeModal('holding-modal'));
  }

  const holdingForm = document.getElementById('holding-form');
  if (holdingForm) {
    eventManager.addEventListener(holdingForm, 'submit', e =>
      handleHoldingSubmit(e, appState, onUpdate)
    );
  }

  // Auto-calculate holding value
  const holdingShares = document.getElementById('holding-shares');
  if (holdingShares) {
    eventManager.addEventListener(holdingShares, 'input', updateHoldingValue);
  }

  const holdingPrice = document.getElementById('holding-price');
  if (holdingPrice) {
    eventManager.addEventListener(holdingPrice, 'input', updateHoldingValue);
  }

  // Investment calculator event listeners
  const calculatorType = document.getElementById('calculator-type');
  if (calculatorType) {
    eventManager.addEventListener(calculatorType, 'change', handleCalculatorTypeChange);
  }

  const calculateContributionBtn = document.getElementById('calculate-contribution-btn');
  if (calculateContributionBtn) {
    eventManager.addEventListener(calculateContributionBtn, 'click', () =>
      calculateExtraContribution(appState)
    );
  }

  const calculateRetirementBtn = document.getElementById('calculate-retirement-btn');
  if (calculateRetirementBtn) {
    eventManager.addEventListener(calculateRetirementBtn, 'click', () =>
      calculateRetirementGoal(appState)
    );
  }

  const calculateGrowthBtn = document.getElementById('calculate-growth-btn');
  if (calculateGrowthBtn) {
    eventManager.addEventListener(calculateGrowthBtn, 'click', () =>
      calculatePortfolioGrowth(appState)
    );
  }
}

const updateHoldingValue = debounce(() => {
  const shares = safeParseFloat(document.getElementById('holding-shares').value);
  const price = safeParseFloat(document.getElementById('holding-price').value);
  document.getElementById('holding-value').value = multiplyMoney(shares, price).toFixed(2);
}, 300);

// Investment Calculator Functions
function handleCalculatorTypeChange() {
  const calculatorType = document.getElementById('calculator-type').value;

  // Hide all calculator sections
  const calculatorSections = [
    'contribution-calculator',
    'retirement-calculator',
    'growth-calculator',
  ];
  calculatorSections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'none';
    }
  });

  // Show selected calculator
  const selectedSection = document.getElementById(`${calculatorType}-calculator`);
  if (selectedSection) {
    selectedSection.style.display = 'block';
  }

  // Hide results and charts
  const resultSections = ['contribution-results', 'retirement-results', 'growth-results'];
  resultSections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'none';
    }
  });

  const chartsSection = document.querySelector('.investment-charts');
  if (chartsSection) {
    chartsSection.style.display = 'none';
  }
}

function calculateExtraContribution(appState) {
  try {
    const accountSelect = document.getElementById('contrib-account-select');
    const extraAmount = safeParseFloat(document.getElementById('contrib-extra-amount').value);
    const years = parseInt(document.getElementById('contrib-years').value);

    // Validate inputs
    const validation = InvestmentCalculators.validateInputs({
      monthlyContribution: extraAmount,
      years,
    });

    if (!validation.isValid) {
      showError(validation.errors.join(', '));
      return;
    }

    if (extraAmount <= 0 || years <= 0) {
      showError('Please enter valid amounts for extra contribution and years.');
      return;
    }

    // Get current portfolio value (or specific account if selected)
    let currentValue = 0;
    if (!accountSelect || accountSelect.value === '' || accountSelect.value === 'all') {
      // Calculate total portfolio value
      currentValue = appState.appData.investmentAccounts.reduce(
        (sum, account) => sum + account.balance,
        0
      );
    } else {
      // Find specific account
      const account = appState.appData.investmentAccounts.find(
        acc => acc.name === accountSelect.value
      );
      currentValue = account ? account.balance : 0;
    }

    if (currentValue < 0) {
      showError('Invalid account balance detected.');
      return;
    }

    const returnRates = [9, 12, 15];
    const scenarios = InvestmentCalculators.calculateMultipleScenarios(
      currentValue,
      extraAmount,
      returnRates,
      years
    );

    // Display results
    const resultsDiv = document.getElementById('contribution-results');
    resultsDiv.innerHTML = `
        <h5>Extra Contribution Results</h5>
        <p>Starting Value: ${formatCurrency(currentValue)}</p>
        <p>Extra Monthly Contribution: ${formatCurrency(extraAmount)}</p>
        <p>Time Period: ${years} years</p>
        
        <div class="results-grid">
            ${scenarios
              .map(
                scenario => `
                <div class="results-card">
                    <h5>${scenario.rate}% Annual Return</h5>
                    <div class="result-metric">
                        <span class="result-metric-label">Future Value:</span>
                        <span class="result-metric-value result-highlight">${formatCurrency(scenario.futureValue)}</span>
                    </div>
                    <div class="result-metric">
                        <span class="result-metric-label">Total Contributed:</span>
                        <span class="result-metric-value">${formatCurrency(scenario.totalContributed)}</span>
                    </div>
                    <div class="result-metric">
                        <span class="result-metric-label">Total Earnings:</span>
                        <span class="result-metric-value">${formatCurrency(scenario.totalEarnings)}</span>
                    </div>
                </div>
            `
              )
              .join('')}
        </div>
    `;

    resultsDiv.style.display = 'block';

    // Show charts
    document.querySelector('.investment-charts').style.display = 'block';

    // Update charts if function exists
    if (window.updateInvestmentCharts) {
      window.updateInvestmentCharts(scenarios, 'contribution');
    }
  } catch (error) {
    debug.error('Error in calculateExtraContribution:', error);
    showError('Failed to calculate extra contribution. Please check your inputs and try again.');
  }
}

function calculateRetirementGoal(appState) {
  try {
    const currentAge = parseInt(document.getElementById('retire-current-age').value);
    const retirementAge = parseInt(document.getElementById('retire-target-age').value);
    const targetAmount = safeParseFloat(document.getElementById('retire-target-amount').value);

    // Check for NaN values
    if (isNaN(currentAge) || isNaN(retirementAge) || isNaN(targetAmount)) {
      showError('Please enter valid numbers for all fields.');
      return;
    }

    const validation = InvestmentCalculators.validateInputs({
      currentAge,
      retirementAge,
      targetAmount,
      years: retirementAge - currentAge,
    });

    if (!validation.isValid) {
      showError(validation.errors.join(', '));
      return;
    }

    if (retirementAge <= currentAge) {
      showError('Retirement age must be greater than current age.');
      return;
    }

    if (targetAmount <= 0) {
      showError('Target amount must be greater than zero.');
      return;
    }

    // Get total portfolio value
    const currentPortfolioValue = appState.appData.investmentAccounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    const returnRates = [9, 12, 15];
    const results = InvestmentCalculators.calculateRetirementScenarios(
      currentAge,
      retirementAge,
      targetAmount,
      currentPortfolioValue,
      returnRates
    );

    if (results.error) {
      showError(results.error);
      return;
    }

    // Check if target is already achievable
    const futureValueWithoutContributions =
      currentPortfolioValue * Math.pow(1 + 0.1 / 12, results.scenarios[0].yearsToRetirement * 12);
    const targetAlreadyAchievable = futureValueWithoutContributions >= targetAmount;

    // Display results
    const resultsDiv = document.getElementById('retirement-results');
    resultsDiv.innerHTML = `
            <h5>Retirement Planning Results</h5>
            <p>Current Age: ${currentAge}, Retirement Age: ${retirementAge} (${results.scenarios[0].yearsToRetirement} years)</p>
            <p>Current Portfolio Value: ${formatCurrency(currentPortfolioValue)}</p>
            <p>Target Retirement Amount: ${formatCurrency(targetAmount)}</p>
            
            ${
              targetAlreadyAchievable
                ? `
                <div style="background-color: rgba(33, 128, 141, 0.1); color: var(--color-primary); padding: var(--space-12); border-radius: var(--radius-6); margin: var(--space-16) 0; border-left: 4px solid var(--color-primary);">
                    🎉 Great news! Your current portfolio may reach your target without additional contributions at reasonable return rates.
                </div>
            `
                : ''
            }
            
            <div class="results-grid">
                ${results.scenarios
                  .map(scenario => {
                    const isMinimal = scenario.requiredMonthlyContribution < 50;
                    return `
                    <div class="results-card">
                        <h5>${scenario.rate}% Annual Return</h5>
                        <div class="result-metric">
                            <span class="result-metric-label">Required Monthly:</span>
                            <span class="result-metric-value result-highlight">
                                ${scenario.requiredMonthlyContribution === 0 ? '$0.00' : formatCurrency(scenario.requiredMonthlyContribution)}
                                ${
                                  scenario.requiredMonthlyContribution === 0
                                    ? '<br><small style="color: var(--color-success); font-weight: normal;">✅ No additional contributions needed!</small>'
                                    : isMinimal && scenario.requiredMonthlyContribution > 0
                                      ? '<br><small style="color: var(--color-text-secondary); font-weight: normal;">Low due to portfolio growth</small>'
                                      : ''
                                }
                            </span>
                        </div>
                        <div class="result-metric">
                            <span class="result-metric-label">Total Contributions:</span>
                            <span class="result-metric-value">${scenario.totalContributions === 0 ? '$0.00' : formatCurrency(scenario.totalContributions)}</span>
                        </div>
                        <div class="result-metric">
                            <span class="result-metric-label">Projected Earnings:</span>
                            <span class="result-metric-value">${formatCurrency(scenario.projectedEarnings)}</span>
                        </div>
                    </div>
                `;
                  })
                  .join('')}
            </div>
        `;

    resultsDiv.style.display = 'block';

    // Show charts
    document.querySelector('.investment-charts').style.display = 'block';

    // Update charts if function exists
    if (window.updateInvestmentCharts) {
      window.updateInvestmentCharts(results.scenarios, 'retirement');
    }
  } catch (error) {
    debug.error('Error in calculateRetirementGoal:', error);
    showError('Failed to calculate retirement goal. Please check your inputs and try again.');
  }
}

function calculatePortfolioGrowth(appState) {
  const monthlyContrib = safeParseFloat(document.getElementById('growth-monthly-contrib').value);
  const years = parseInt(document.getElementById('growth-years').value);

  const validation = InvestmentCalculators.validateInputs({
    monthlyContribution: monthlyContrib,
    years,
  });

  if (!validation.isValid) {
    showError(validation.errors.join(', '));
    return;
  }

  // Get total portfolio value
  const currentPortfolioValue = appState.appData.investmentAccounts.reduce(
    (sum, account) => sum + account.balance,
    0
  );

  const returnRates = [9, 12, 15];
  const timeline = InvestmentCalculators.calculatePortfolioGrowthTimeline(
    currentPortfolioValue,
    monthlyContrib,
    returnRates,
    years
  );

  // Calculate final values for each rate
  const finalValues = returnRates.map(rate => {
    const result = InvestmentCalculators.calculateFutureValue(
      currentPortfolioValue,
      monthlyContrib,
      rate,
      years
    );
    return { rate, ...result };
  });

  // Display results
  const resultsDiv = document.getElementById('growth-results');
  resultsDiv.innerHTML = `
        <h5>Portfolio Growth Projection</h5>
        <p>Current Portfolio Value: ${formatCurrency(currentPortfolioValue)}</p>
        <p>Monthly Contribution: ${formatCurrency(monthlyContrib)}</p>
        <p>Projection Period: ${years} years</p>
        
        <div class="results-grid">
            ${finalValues
              .map(
                scenario => `
                <div class="results-card">
                    <h5>${scenario.rate}% Annual Return</h5>
                    <div class="result-metric">
                        <span class="result-metric-label">Final Portfolio Value:</span>
                        <span class="result-metric-value result-highlight">${formatCurrency(scenario.futureValue)}</span>
                    </div>
                    <div class="result-metric">
                        <span class="result-metric-label">Total Contributed:</span>
                        <span class="result-metric-value">${formatCurrency(scenario.totalContributed)}</span>
                    </div>
                    <div class="result-metric">
                        <span class="result-metric-label">Investment Growth:</span>
                        <span class="result-metric-value">${formatCurrency(scenario.totalEarnings)}</span>
                    </div>
                </div>
            `
              )
              .join('')}
        </div>
    `;

  resultsDiv.style.display = 'block';

  // Show charts
  document.querySelector('.investment-charts').style.display = 'block';

  // Update charts if function exists
  if (window.updateInvestmentCharts) {
    window.updateInvestmentCharts(timeline, 'growth');
  }
}

function populateAccountDropdown(appData) {
  const accountSelect = document.getElementById('contrib-account-select');
  if (!accountSelect) {
    return;
  }

  // Clear existing options except "All Accounts"
  accountSelect.innerHTML = '<option value="">All Accounts</option>';

  // Add investment accounts
  appData.investmentAccounts.forEach(account => {
    accountSelect.innerHTML += `<option value="${escapeHtml(account.name)}">${escapeHtml(account.name)} (${formatCurrency(account.balance)})</option>`;
  });
}
