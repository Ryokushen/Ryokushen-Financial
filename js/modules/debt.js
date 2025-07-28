// js/modules/debt.js
import db from '../database.js';
import {
  safeParseFloat,
  escapeHtml,
  formatCurrency,
  formatDate,
  getDueDateClass,
  getDueDateText,
} from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import {
  validateForm,
  ValidationSchemas,
  showFieldError,
  clearFormErrors,
  CrossFieldValidators,
  validateFormWithCrossFields,
  validateWithAsyncRules,
  AsyncValidators,
} from './validation.js';
import { DebtStrategy } from './debtStrategy.js';
import { eventManager } from './eventManager.js';
import { debug } from './debug.js';

// Store the current sort preference
let currentSortType = localStorage.getItem('debtSortPreference') || 'balance-high';

// Calculate monthly interest for a debt account
function calculateMonthlyInterest(account) {
  const rate = account.interestRate || account.interest_rate || 0;
  return (account.balance * rate) / 100 / 12;
}

// Sort debt accounts based on the selected criteria
function sortDebtAccounts(accounts, sortType) {
  const sorted = [...accounts]; // Create copy to avoid mutating original

  switch (sortType) {
    case 'alphabetical':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'balance-high':
      return sorted.sort((a, b) => b.balance - a.balance);
    case 'balance-low':
      return sorted.sort((a, b) => a.balance - b.balance);
    case 'apr-high':
      return sorted.sort(
        (a, b) =>
          (b.interestRate || b.interest_rate || 0) - (a.interestRate || a.interest_rate || 0)
      );
    case 'apr-low':
      return sorted.sort(
        (a, b) =>
          (a.interestRate || a.interest_rate || 0) - (b.interestRate || b.interest_rate || 0)
      );
    case 'payment-high':
      return sorted.sort(
        (a, b) =>
          (b.minimumPayment || b.minimum_payment || 0) -
          (a.minimumPayment || a.minimum_payment || 0)
      );
    case 'payment-low':
      return sorted.sort(
        (a, b) =>
          (a.minimumPayment || a.minimum_payment || 0) -
          (b.minimumPayment || b.minimum_payment || 0)
      );
    case 'interest-high':
      return sorted.sort((a, b) => {
        const aInterest = calculateMonthlyInterest(a);
        const bInterest = calculateMonthlyInterest(b);
        return bInterest - aInterest;
      });
    case 'interest-low':
      return sorted.sort((a, b) => {
        const aInterest = calculateMonthlyInterest(a);
        const bInterest = calculateMonthlyInterest(b);
        return aInterest - bInterest;
      });
    default:
      return sorted;
  }
}

function openDebtModal(appData, debtId = null) {
  const modalData = { debtId };

  if (debtId) {
    const debt = appData.debtAccounts.find(d => d.id === debtId);
    if (debt) {
      // Modal will be reset by modalManager, so populate after open
      setTimeout(() => {
        document.getElementById('debt-id').value = debt.id;
        document.getElementById('debt-name').value = debt.name;
        document.getElementById('debt-type').value = debt.type;
        document.getElementById('debt-institution').value = debt.institution;
        document.getElementById('debt-balance').value = debt.balance;
        // Handle both camelCase and snake_case for compatibility
        document.getElementById('debt-interest-rate').value =
          debt.interestRate || debt.interest_rate || '';
        document.getElementById('debt-minimum-payment').value =
          debt.minimumPayment || debt.minimum_payment || '';

        // Format date for HTML date input (expects YYYY-MM-DD)
        const dueDate = debt.dueDate || debt.due_date || '';
        if (dueDate) {
          // If date includes time, extract just the date part
          const dateOnly = dueDate.split('T')[0];
          document.getElementById('debt-due-date').value = dateOnly;
        } else {
          document.getElementById('debt-due-date').value = '';
        }

        document.getElementById('debt-credit-limit').value =
          debt.creditLimit || debt.credit_limit || '';
        document.getElementById('debt-notes').value = debt.notes || '';
      }, 0);
    }
  } else {
    // For new debt accounts, just ensure ID is empty after reset
    setTimeout(() => {
      document.getElementById('debt-id').value = '';
    }, 0);
  }

  openModal('debt-modal', modalData);
}

async function handleDebtSubmit(event, appState, onUpdate) {
  event.preventDefault();

  // Clear previous errors
  clearFormErrors('debt-form');

  try {
    const debtIdValue = document.getElementById('debt-id').value;
    const debtId = debtIdValue ? parseInt(debtIdValue) : null;
    const debtData = {
      name: document.getElementById('debt-name').value || '',
      type: document.getElementById('debt-type').value || '',
      institution: document.getElementById('debt-institution').value || '',
      balance: safeParseFloat(document.getElementById('debt-balance').value || '0'),
      interestRate: safeParseFloat(document.getElementById('debt-interest-rate').value || '0'),
      minimumPayment: safeParseFloat(document.getElementById('debt-minimum-payment').value || '0'),
      dueDate: document.getElementById('debt-due-date').value || '',
      creditLimit: safeParseFloat(document.getElementById('debt-credit-limit').value) || null,
      notes: document.getElementById('debt-notes').value || '',
    };

    // Validate form data with cross-field validation and async validation
    const asyncValidators = {
      name: AsyncValidators.uniqueDebtAccountName(appState.appData.debtAccounts, debtId),
    };

    const { errors, hasErrors } = await validateWithAsyncRules(
      debtData,
      ValidationSchemas.debtAccount,
      asyncValidators
    );

    // Also check cross-field validation
    const crossFieldErrors = CrossFieldValidators.debtAccount
      ? CrossFieldValidators.debtAccount(debtData)
      : {};
    Object.assign(errors, crossFieldErrors);
    const hasCrossFieldErrors = Object.keys(crossFieldErrors).length > 0;

    if (hasErrors || hasCrossFieldErrors) {
      // Show field-level errors
      Object.entries(errors).forEach(([field, error]) => {
        showFieldError(`debt-${field}`, error);
      });
      showError('Please correct the errors in the form.');
      return;
    }

    if (debtId) {
      const savedDebt = await db.updateDebtAccount(debtId, debtData);
      const index = appState.appData.debtAccounts.findIndex(d => d.id === debtId);
      if (index > -1) {
        // Update with both snake_case and camelCase fields for consistency
        appState.appData.debtAccounts[index] = {
          ...savedDebt,
          balance: savedDebt.balance != null ? parseFloat(savedDebt.balance) : 0,
          interestRate: savedDebt.interest_rate != null ? parseFloat(savedDebt.interest_rate) : 0,
          minimumPayment:
            savedDebt.minimum_payment != null ? parseFloat(savedDebt.minimum_payment) : 0,
          creditLimit: savedDebt.credit_limit != null ? parseFloat(savedDebt.credit_limit) : null,
          dueDate: savedDebt.due_date,
        };
      }
    } else {
      const savedDebt = await db.addDebtAccount(debtData);
      // Add with both snake_case and camelCase fields for consistency
      appState.appData.debtAccounts.push({
        ...savedDebt,
        balance: savedDebt.balance != null ? parseFloat(savedDebt.balance) : 0,
        interestRate: savedDebt.interest_rate != null ? parseFloat(savedDebt.interest_rate) : 0,
        minimumPayment:
          savedDebt.minimum_payment != null ? parseFloat(savedDebt.minimum_payment) : 0,
        creditLimit: savedDebt.credit_limit != null ? parseFloat(savedDebt.credit_limit) : null,
        dueDate: savedDebt.due_date,
      });
    }

    closeModal('debt-modal');
    await onUpdate();
    announceToScreenReader('Debt account saved successfully');
  } catch (error) {
    debug.error('Error saving debt account:', error);
    showError(`Failed to save debt account: ${error.message}`);
  }
}

async function deleteDebtAccount(id, appState, onUpdate) {
  const debt = appState.appData.debtAccounts.find(d => d.id === id);
  if (debt && confirm(`Are you sure you want to delete "${debt.name}"?`)) {
    try {
      await db.deleteDebtAccount(id);
      appState.appData.debtAccounts = appState.appData.debtAccounts.filter(d => d.id !== id);
      await onUpdate();
      announceToScreenReader('Debt account deleted');
    } catch (error) {
      showError('Failed to delete debt account.');
    }
  }
}

// Get debt card icon based on debt type
function getDebtIcon(debtType) {
  const icons = {
    'Credit Card': '💳',
    'Student Loan': '🎓',
    'Auto Loan': '🚗',
    Mortgage: '🏠',
    'Personal Loan': '💰',
    'Line of Credit': '💰',
    Other: '📄',
  };
  return icons[debtType] || '📄';
}

// Calculate debt utilization percentage
function calculateUtilization(balance, creditLimit) {
  if (!creditLimit || creditLimit <= 0) {
    return 0;
  }
  return Math.min((balance / creditLimit) * 100, 100);
}

// Calculate estimated payoff time in months
function calculatePayoffTime(balance, minimumPayment, interestRate) {
  if (minimumPayment <= 0 || interestRate <= 0) {
    return 0;
  }

  const monthlyRate = interestRate / 100 / 12;
  const monthlyInterest = balance * monthlyRate;

  if (minimumPayment <= monthlyInterest) {
    return 999;
  } // Never pays off

  const months =
    -Math.log(1 - (balance * monthlyRate) / minimumPayment) / Math.log(1 + monthlyRate);
  return Math.ceil(months);
}

// Calculate debt metrics for overview
function calculateDebtMetrics(debtAccounts) {
  const totalBalance = debtAccounts.reduce((sum, account) => sum + account.balance, 0);
  const totalPayments = debtAccounts.reduce((sum, account) => sum + account.minimumPayment, 0);

  // Calculate weighted average interest rate
  const totalWeightedRate = debtAccounts.reduce(
    (sum, account) => sum + account.balance * account.interestRate,
    0
  );
  const avgInterestRate = totalBalance > 0 ? totalWeightedRate / totalBalance : 0;

  // Calculate total principal in payments (estimate)
  const totalInterest = debtAccounts.reduce((sum, account) => {
    const monthlyRate = account.interestRate / 100 / 12;
    return sum + account.balance * monthlyRate;
  }, 0);
  const totalPrincipal = Math.max(0, totalPayments - totalInterest);

  // Calculate overall progress (this is a simplified metric)
  // In a real app, you'd track original balances vs current balances
  const estimatedOriginalDebt = totalBalance * 1.3; // Assume 30% paid off for demo
  const payoffProgress = Math.max(
    0,
    Math.min(100, ((estimatedOriginalDebt - totalBalance) / estimatedOriginalDebt) * 100)
  );

  return {
    totalBalance,
    totalPayments,
    totalPrincipal,
    totalInterest,
    avgInterestRate,
    payoffProgress,
    accountCount: debtAccounts.length,
  };
}

// Update debt overview metrics
function updateDebtOverview(debtAccounts) {
  const metrics = calculateDebtMetrics(debtAccounts);

  // Update total debt balance
  const totalBalanceEl = document.getElementById('debt-total-balance');
  if (totalBalanceEl) {
    totalBalanceEl.textContent = formatCurrency(metrics.totalBalance);
  }

  // Update monthly payment
  const monthlyTotalEl = document.getElementById('debt-monthly-total');
  if (monthlyTotalEl) {
    monthlyTotalEl.textContent = formatCurrency(metrics.totalPayments);
  }

  // Update principal info
  const principalInfoEl = document.getElementById('debt-principal-info');
  if (principalInfoEl) {
    principalInfoEl.textContent = `Principal: ${formatCurrency(metrics.totalPrincipal)}`;
  }

  // Update payoff progress
  const payoffPercentEl = document.getElementById('debt-payoff-percent');
  if (payoffPercentEl) {
    payoffPercentEl.textContent = `${Math.round(metrics.payoffProgress)}%`;
  }

  // Update progress bar
  const progressFillEl = document.getElementById('debt-progress-fill');
  if (progressFillEl) {
    progressFillEl.style.width = `${metrics.payoffProgress}%`;
  }

  // Update balance change (for demo, show a small decrease)
  const balanceChangeEl = document.getElementById('debt-balance-change');
  if (balanceChangeEl && metrics.totalBalance > 0) {
    const monthlyChange = metrics.totalPrincipal;
    balanceChangeEl.textContent = `↓ ${formatCurrency(monthlyChange)} this month`;
    balanceChangeEl.className = 'debt-metric-change positive';
  }

  // Update progress change
  const progressChangeEl = document.getElementById('debt-progress-change');
  if (progressChangeEl) {
    progressChangeEl.textContent = '↑ 2.4% this quarter';
  }
}

// Render individual debt cards using the new design
export function renderDebtAccounts(appState) {
  const { appData } = appState;
  const debtAccountsList = document.getElementById('debt-accounts-list');
  if (!debtAccountsList) {
    return;
  }

  // Update overview metrics
  updateDebtOverview(appData.debtAccounts);

  if (appData.debtAccounts.length === 0) {
    debtAccountsList.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 48px; margin-bottom: 16px;">💳</div>
                <p>No debt accounts added yet</p>
                <p style="font-size: 12px; opacity: 0.7;">Add your first debt account to start tracking your payoff progress</p>
            </div>`;
    return;
  }

  // Sort accounts based on current preference
  const sortedAccounts = sortDebtAccounts(appData.debtAccounts, currentSortType);

  // Update sort dropdown to reflect current sort
  const sortSelect = document.getElementById('debt-sort-select');
  if (sortSelect && sortSelect.value !== currentSortType) {
    sortSelect.value = currentSortType;
  }

  debtAccountsList.innerHTML = sortedAccounts
    .map(account => {
      const utilization = calculateUtilization(
        account.balance,
        account.creditLimit || account.credit_limit
      );
      const interestRate = account.interestRate || account.interest_rate || 0;
      const minimumPayment = account.minimumPayment || account.minimum_payment || 0;
      const payoffTime = calculatePayoffTime(account.balance, minimumPayment, interestRate);
      const monthlyInterest = calculateMonthlyInterest(account);
      const isCredit =
        account.type === 'Credit Card' || (account.creditLimit || account.credit_limit) > 0;

      return `
            <div class="debt-card" data-id="${account.id}">
                <div class="debt-header">
                    <div>
                        <div class="debt-name">${escapeHtml(account.name)}</div>
                        <div class="debt-type">${escapeHtml(account.type)}</div>
                    </div>
                    <div class="debt-icon">${getDebtIcon(account.type)}</div>
                </div>
                
                <div class="debt-amount" data-sensitive="true">${formatCurrency(account.balance)}</div>
                
                <div class="payment-breakdown">
                    <div class="payment-item">
                        <div class="payment-label">Min Payment</div>
                        <div class="payment-value" data-sensitive="true">${formatCurrency(minimumPayment)}</div>
                    </div>
                    <div class="payment-item">
                        <div class="payment-label">APR</div>
                        <div class="payment-value">${interestRate.toFixed(1)}%</div>
                    </div>
                    <div class="payment-item">
                        <div class="payment-label">Payoff</div>
                        <div class="payment-value">${payoffTime > 120 ? '10+ yrs' : `${payoffTime} mo`}</div>
                    </div>
                </div>
                
                ${
                  isCredit
                    ? `
                    <div style="font-size: 12px; opacity: 0.7; margin-bottom: 4px;">
                        Utilization: ${utilization.toFixed(0)}%
                    </div>
                    <div class="utilization-bar">
                        <div class="utilization-fill" style="width: ${utilization}%;"></div>
                    </div>
                `
                    : `
                    <div class="debt-progress-bar">
                        <div class="debt-progress-fill" style="width: ${Math.min(35, 100 - (account.balance / (account.balance * 1.5)) * 100)}%;"></div>
                    </div>
                    <div class="utilization-text">Progress: ${Math.min(35, 100 - (account.balance / (account.balance * 1.5)) * 100).toFixed(0)}% Paid Off</div>
                `
                }
                
                <div class="debt-actions" style="margin-top: 16px; display: flex; gap: 8px;">
                    <button class="btn btn--secondary btn--small btn-edit-debt" data-id="${account.id}">
                        Edit
                    </button>
                    <button class="btn btn--secondary btn--small btn-delete-debt" data-id="${account.id}">
                        Delete
                    </button>
                </div>
                
                ${
                  monthlyInterest > 5
                    ? `
                    <div style="margin-top: 12px; padding: 8px; background: rgba(244, 67, 54, 0.1); border-radius: 8px; font-size: 12px; color: #f44336;">
                        💡 Monthly interest: ${formatCurrency(monthlyInterest)} - Consider extra payments
                    </div>
                `
                    : ''
                }
            </div>`;
    })
    .join('');
}

// Initialize debt charts (placeholder for Chart.js integration)
function initializeDebtCharts(appState) {
  // Debt Payoff Timeline Chart
  const timelineCanvas = document.getElementById('debt-payoff-timeline-chart');
  if (timelineCanvas && window.Chart) {
    // This would implement a real chart showing debt payoff over time
    // For now, we'll create a placeholder
    const ctx = timelineCanvas.getContext('2d');

    // Sample data for demonstration
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    const totalDebt = appState.appData.debtAccounts.reduce(
      (sum, account) => sum + account.balance,
      0
    );
    const monthlyPayment = appState.appData.debtAccounts.reduce(
      (sum, account) => sum + account.minimumPayment,
      0
    );

    // Simple projection
    const currentBalances = [];
    const projectedBalances = [];
    let currentBalance = totalDebt;
    let projectedBalance = totalDebt;

    for (let i = 0; i < 12; i++) {
      currentBalances.push(currentBalance);
      projectedBalances.push(projectedBalance);

      // Current path (minimum payments)
      const avgRate = 0.18 / 12; // 18% APR average
      const interest = currentBalance * avgRate;
      currentBalance = Math.max(0, currentBalance - Math.max(0, monthlyPayment - interest));

      // Projected path (with extra $100)
      const projectedPayment = monthlyPayment + 100;
      const projectedInterest = projectedBalance * avgRate;
      projectedBalance = Math.max(
        0,
        projectedBalance - Math.max(0, projectedPayment - projectedInterest)
      );
    }

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Current Path',
            data: currentBalances,
            borderColor: '#f44336',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            fill: true,
            tension: 0.4,
          },
          {
            label: 'With Extra $100/mo',
            data: projectedBalances,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#e2e8f0' },
          },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
          },
          y: {
            ticks: {
              color: '#94a3b8',
              callback: value => `$${(value / 1000).toFixed(0)}k`,
            },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
          },
        },
      },
    });
  }

  // Debt Breakdown Chart
  const breakdownCanvas = document.getElementById('debt-breakdown-chart');
  if (breakdownCanvas && window.Chart && appState.appData.debtAccounts.length > 0) {
    const ctx = breakdownCanvas.getContext('2d');

    const data = appState.appData.debtAccounts.map(account => ({
      label: account.name,
      value: account.balance,
      type: account.type,
    }));

    const colors = [
      '#f44336',
      '#e91e63',
      '#9c27b0',
      '#673ab7',
      '#3f51b5',
      '#2196f3',
      '#03a9f4',
      '#00bcd4',
    ];

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          {
            data: data.map(d => d.value),
            backgroundColor: colors.slice(0, data.length),
            borderWidth: 2,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#e2e8f0',
              padding: 15,
              usePointStyle: true,
            },
          },
        },
        cutout: '70%',
      },
    });
  }
}

export function populateDebtAccountDropdown(appData) {
  const debtAccountSelect = document.getElementById('debt-account-select');
  if (!debtAccountSelect) {
    return;
  }
  debtAccountSelect.innerHTML = '<option value="">Select Debt Account</option>';
  appData.debtAccounts.forEach(account => {
    debtAccountSelect.innerHTML += `<option value="${escapeHtml(account.name)}">${escapeHtml(account.name)}</option>`;
  });
}

function calculateAndDisplayPayoff(appState) {
  const strategy = document.getElementById('debt-strategy-select').value;
  const extraPayment = safeParseFloat(document.getElementById('extra-payment-amount').value) || 0;
  const debts = appState.appData.debtAccounts;

  if (debts.length === 0) {
    showError('No debt accounts to calculate payoff for.');
    return;
  }

  // Calculate payoff timeline
  const timeline = DebtStrategy.calculatePayoffTimeline(debts, strategy, extraPayment);

  // Display results
  document.getElementById('payoff-results').style.display = 'block';
  document.getElementById('debt-free-date').textContent = formatDate(timeline.debtFreeDate);
  document.getElementById('total-interest').textContent = formatCurrency(timeline.totalInterest);
  document.getElementById('months-to-payoff').textContent = timeline.months;

  // Calculate strategy comparison
  const comparison = DebtStrategy.compareStrategies(debts, extraPayment);

  // Display comparison if there's a difference
  if (comparison.interestSavings !== 0 || comparison.timeDifference !== 0) {
    document.getElementById('strategy-comparison').style.display = 'block';
    const comparisonDiv = document.querySelector('.comparison-results');

    comparisonDiv.innerHTML = `
            <div class="comparison-card">
                <h5>Avalanche Method</h5>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Total Interest:</span>
                    <span class="comparison-metric-value">${formatCurrency(comparison.avalanche.totalInterest)}</span>
                </div>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Payoff Time:</span>
                    <span class="comparison-metric-value">${comparison.avalanche.months} months</span>
                </div>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Debt Free Date:</span>
                    <span class="comparison-metric-value">${formatDate(comparison.avalanche.debtFreeDate)}</span>
                </div>
            </div>
            <div class="comparison-card">
                <h5>Snowball Method</h5>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Total Interest:</span>
                    <span class="comparison-metric-value">${formatCurrency(comparison.snowball.totalInterest)}</span>
                </div>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Payoff Time:</span>
                    <span class="comparison-metric-value">${comparison.snowball.months} months</span>
                </div>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Debt Free Date:</span>
                    <span class="comparison-metric-value">${formatDate(comparison.snowball.debtFreeDate)}</span>
                </div>
            </div>
        `;

    // Add savings highlight if applicable
    if (comparison.interestSavings > 0) {
      comparisonDiv.innerHTML += `
                <div class="comparison-card" style="grid-column: 1 / -1;">
                    <p class="savings-highlight">
                        The Avalanche method saves ${formatCurrency(comparison.interestSavings)} in interest!
                    </p>
                </div>
            `;
    }
  }

  // Display extra payment allocation recommendation
  const existingAllocation = document.querySelector('.extra-payment-allocation');
  if (existingAllocation) {
    existingAllocation.remove();
  }

  if (extraPayment > 0) {
    const allocation = DebtStrategy.allocateExtraPayment(debts, strategy, extraPayment);
    if (allocation.length > 0) {
      const allocationDiv = document.createElement('div');
      allocationDiv.className = 'extra-payment-allocation mt-16';
      allocationDiv.innerHTML = `
                <h4>Recommended Extra Payment Allocation</h4>
                <p>Based on your ${strategy} strategy, apply your extra ${formatCurrency(extraPayment)} monthly payment to:</p>
                <div class="allocation-recommendation">
                    <strong>${escapeHtml(allocation[0].debtName)}</strong>
                    <span class="text-secondary">(${allocation[0].reason})</span>
                </div>
            `;
      document.getElementById('payoff-results').appendChild(allocationDiv);
    }
  }

  // Update charts if they exist
  initializeDebtCharts(appState);
}

export function setupEventListeners(appState, onUpdate) {
  // Cache DOM elements
  const addDebtBtn = document.getElementById('add-debt-btn');
  const closeDebtModalBtn = document.getElementById('close-debt-modal');
  const cancelDebtBtn = document.getElementById('cancel-debt-btn');
  const debtForm = document.getElementById('debt-form');
  const debtAccountsList = document.getElementById('debt-accounts-list');
  const calculatePayoffBtn = document.getElementById('calculate-payoff-btn');
  const debtStrategySelect = document.getElementById('debt-strategy-select');
  const extraPaymentAmount = document.getElementById('extra-payment-amount');
  const debtSortSelect = document.getElementById('debt-sort-select');

  if (addDebtBtn) {
    eventManager.addEventListener(addDebtBtn, 'click', () => openDebtModal(appState.appData));
  }
  if (closeDebtModalBtn) {
    eventManager.addEventListener(closeDebtModalBtn, 'click', () => closeModal('debt-modal'));
  }
  if (cancelDebtBtn) {
    eventManager.addEventListener(cancelDebtBtn, 'click', () => closeModal('debt-modal'));
  }
  if (debtForm) {
    eventManager.addEventListener(debtForm, 'submit', e => handleDebtSubmit(e, appState, onUpdate));
  }

  // Sort dropdown event listener
  if (debtSortSelect) {
    eventManager.addEventListener(debtSortSelect, 'change', e => {
      currentSortType = e.target.value;
      localStorage.setItem('debtSortPreference', currentSortType);
      renderDebtAccounts(appState);
      announceToScreenReader(`Debt accounts sorted by ${e.target.selectedOptions[0].text}`);
    });
  }

  if (debtAccountsList) {
    eventManager.addEventListener(debtAccountsList, 'click', event => {
      const target = event.target;
      const id = parseInt(target.getAttribute('data-id'));
      if (!id) {
        return;
      }

      if (target.classList.contains('btn-edit-debt')) {
        event.stopPropagation();
        openDebtModal(appState.appData, id);
      }
      if (target.classList.contains('btn-delete-debt')) {
        event.stopPropagation();
        deleteDebtAccount(id, appState, onUpdate);
      }
    });
  }

  // Payoff calculation event listeners
  if (calculatePayoffBtn) {
    eventManager.addEventListener(calculatePayoffBtn, 'click', () =>
      calculateAndDisplayPayoff(appState)
    );
  }
  if (debtStrategySelect) {
    eventManager.addEventListener(debtStrategySelect, 'change', () => {
      if (document.getElementById('payoff-results').style.display !== 'none') {
        calculateAndDisplayPayoff(appState);
      }
    });
  }
  if (extraPaymentAmount) {
    eventManager.addEventListener(extraPaymentAmount, 'input', () => {
      if (document.getElementById('payoff-results').style.display !== 'none') {
        calculateAndDisplayPayoff(appState);
      }
    });
  }

  // Initialize charts on first load
  setTimeout(() => {
    if (appState.appData.debtAccounts.length > 0) {
      initializeDebtCharts(appState);
    }
  }, 100);
}

// Export initialization function for charts
export function initializeDebtDashboard(appState) {
  renderDebtAccounts(appState);
  initializeDebtCharts(appState);
}
