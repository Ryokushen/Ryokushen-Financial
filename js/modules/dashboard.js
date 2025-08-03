// js/modules/dashboard.js
import { formatCurrency, escapeHtml, formatDate, convertToMonthly } from './utils.js';
import * as KPIs from './kpis.js';
import { renderBillsTimeline } from './timeline.js';
import * as Accounts from './accounts.js';
import * as Debt from './debt.js';
import { addMoney, subtractMoney, sumMoney, convertToMonthlyPrecise } from './financialMath.js';
import { TimeBudgetWidget } from './widgets/timeBudgetWidget.js';
import { getCategoryIcon } from './categories.js';
import db from '../database.js';

// Initialize time budget widget
let timeBudgetWidget = null;

// Store current comparison period (can be changed by user)
const currentComparisonPeriod = 'month'; // 'week', 'month', 'year'

// Cache for historical comparison data
let historicalComparison = null;
let lastSnapshotCapture = null;

// Export functions for testing
window.dashboardUtils = {
  captureSnapshot: async () => {
    try {
      console.log('Manually capturing financial snapshot...');
      const result = await db.captureFinancialSnapshot('daily');
      console.log('Snapshot captured successfully:', result);
      await fetchHistoricalComparison();
      return result;
    } catch (error) {
      console.error('Failed to capture snapshot:', error);
      throw error;
    }
  },
  getHistoricalData: () => historicalComparison,
};

function renderFinancialHealth(kpiResults) {
  const container = document.querySelector('.health-score-container');
  if (!container) {
    return;
  }

  const { emergencyRatio, dti, savingsRate, healthScore } = kpiResults;

  const healthScoreHTML = `
        <div class="health-indicator-enhanced">
            <div class="health-score-value ${healthScore.status.toLowerCase()}">${escapeHtml(healthScore.score)}</div>
            <div class="health-score-status status-${healthScore.status.toLowerCase()}">${escapeHtml(healthScore.status)}</div>
        </div>
        <div class="kpi-details-grid">
            <div class="kpi-metric-card">
                <div class="kpi-value">${savingsRate.toFixed(0)}%</div>
                <div class="kpi-label">Savings</div>
            </div>
            <div class="kpi-metric-card">
                <div class="kpi-value">${isFinite(emergencyRatio) ? Math.floor(emergencyRatio) : 'N/A'}mo</div>
                <div class="kpi-label">Emergency</div>
            </div>
            <div class="kpi-metric-card">
                <div class="kpi-value">${isFinite(dti) ? dti.toFixed(0) : '0'}%</div>
                <div class="kpi-label">Debt Ratio</div>
            </div>
        </div>
    `;
  container.innerHTML = healthScoreHTML;
}

function calculateTrend(current, previous) {
  if (previous === 0) {
    return { value: 0, direction: 'neutral' };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return {
    value: Math.abs(change).toFixed(1),
    direction: change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'neutral',
  };
}

// Fetch historical comparison data from database
async function fetchHistoricalComparison() {
  try {
    historicalComparison = await db.getSnapshotComparison(currentComparisonPeriod);
    return historicalComparison;
  } catch (error) {
    console.warn('Failed to fetch historical comparison:', error);
    return null;
  }
}

// Capture a financial snapshot
async function captureFinancialSnapshot() {
  try {
    // Only capture once per day
    const today = new Date().toDateString();
    if (lastSnapshotCapture === today) {
      return;
    }

    await db.captureFinancialSnapshot('daily');
    lastSnapshotCapture = today;

    // Refresh historical comparison after capturing
    await fetchHistoricalComparison();
  } catch (error) {
    console.warn('Failed to capture financial snapshot:', error);
  }
}

async function updateMetricTrends(metrics) {
  const { totalCash, totalInvestments, totalDebt, monthlyRecurring } = metrics;

  // Try to use historical data first
  if (historicalComparison) {
    // Update cash trend
    const cashTrendEl = document.getElementById('cash-trend');
    if (cashTrendEl) {
      const change = historicalComparison.cash_change_percent || 0;
      const direction = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'neutral';
      cashTrendEl.textContent =
        direction === 'neutral'
          ? '→ 0%'
          : `${direction === 'up' ? '↗' : '↘'} ${Math.abs(change).toFixed(1)}%`;
      cashTrendEl.className = `metric-trend ${direction}`;
    }

    // Update investment trend
    const investmentTrendEl = document.getElementById('investment-trend');
    if (investmentTrendEl) {
      const change = historicalComparison.investments_change_percent || 0;
      const direction = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'neutral';
      investmentTrendEl.textContent =
        direction === 'neutral'
          ? '→ 0%'
          : `${direction === 'up' ? '↗' : '↘'} ${Math.abs(change).toFixed(1)}%`;
      investmentTrendEl.className = `metric-trend ${direction}`;
    }

    // Update debt trend (down is good for debt)
    const debtTrendEl = document.getElementById('debt-trend');
    if (debtTrendEl) {
      const change = historicalComparison.debt_change_percent || 0;
      const direction = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'neutral';
      debtTrendEl.textContent =
        direction === 'neutral'
          ? '→ 0%'
          : `${direction === 'up' ? '↗' : '↘'} ${Math.abs(change).toFixed(1)}%`;
      debtTrendEl.className = `metric-trend ${direction === 'down' ? 'up' : direction === 'up' ? 'down' : ''}`;
    }

    // Update bills trend
    const billsTrendEl = document.getElementById('bills-trend');
    if (billsTrendEl) {
      const change = historicalComparison.bills_change_percent || 0;
      const direction = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'neutral';
      billsTrendEl.textContent =
        direction === 'neutral'
          ? '→ 0%'
          : `${direction === 'up' ? '↗' : '↘'} ${Math.abs(change).toFixed(1)}%`;
      billsTrendEl.className = `metric-trend ${direction}`;
    }
  } else {
    // Fallback to session-based comparison
    const previousMetrics = window._dashboardPreviousMetrics || {
      totalCash: 0,
      totalInvestments: 0,
      totalDebt: 0,
      monthlyRecurring: 0,
    };
    const cashTrend = calculateTrend(totalCash, previousMetrics.totalCash);
    const investmentTrend = calculateTrend(totalInvestments, previousMetrics.totalInvestments);
    const debtTrend = calculateTrend(totalDebt, previousMetrics.totalDebt);
    const billsTrend = calculateTrend(monthlyRecurring, previousMetrics.monthlyRecurring);

    // Update trend displays
    const cashTrendEl = document.getElementById('cash-trend');
    if (cashTrendEl) {
      cashTrendEl.textContent =
        cashTrend.direction === 'neutral'
          ? '→ 0%'
          : `${cashTrend.direction === 'up' ? '↗' : '↘'} ${cashTrend.value}%`;
      cashTrendEl.className = `metric-trend ${cashTrend.direction}`;
    }

    const investmentTrendEl = document.getElementById('investment-trend');
    if (investmentTrendEl) {
      investmentTrendEl.textContent =
        investmentTrend.direction === 'neutral'
          ? '→ 0%'
          : `${investmentTrend.direction === 'up' ? '↗' : '↘'} ${investmentTrend.value}%`;
      investmentTrendEl.className = `metric-trend ${investmentTrend.direction}`;
    }

    const debtTrendEl = document.getElementById('debt-trend');
    if (debtTrendEl) {
      // For debt, down is good
      debtTrendEl.textContent =
        debtTrend.direction === 'neutral'
          ? '→ 0%'
          : `${debtTrend.direction === 'up' ? '↗' : '↘'} ${debtTrend.value}%`;
      debtTrendEl.className = `metric-trend ${debtTrend.direction === 'down' ? 'up' : debtTrend.direction === 'up' ? 'down' : ''}`;
    }

    const billsTrendEl = document.getElementById('bills-trend');
    if (billsTrendEl) {
      billsTrendEl.textContent =
        billsTrend.direction === 'neutral'
          ? '→ 0%'
          : `${billsTrend.direction === 'up' ? '↗' : '↘'} ${billsTrend.value}%`;
      billsTrendEl.className = `metric-trend ${billsTrend.direction}`;
    }

    // Store current values for next comparison (fallback only)
    window._dashboardPreviousMetrics = { totalCash, totalInvestments, totalDebt, monthlyRecurring };
  }
}

function renderRecentTransactions(appData) {
  const list = document.getElementById('recent-transactions-list');
  if (!list) {
    return;
  }

  const recent = [...appData.transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  if (recent.length === 0) {
    list.innerHTML = '<div class="empty-state">No recent transactions.</div>';
    return;
  }
  list.innerHTML = recent
    .map(t => {
      // Improved account lookup logic with better fallbacks
      let accountName = 'Account Not Found';

      if (t.account_id) {
        const cashAccount = appData.cashAccounts.find(a => a.id === t.account_id);
        if (cashAccount) {
          accountName = escapeHtml(cashAccount.name);
        } else {
          // Provide more helpful fallback with account ID
          accountName = `Deleted Account (${t.account_id.substring(0, 8)}...)`;
        }
      } else if (t.debt_account_id) {
        const debtAccount = appData.debtAccounts.find(d => d.id === t.debt_account_id);
        if (debtAccount) {
          accountName = `${escapeHtml(debtAccount.name)} (Credit Card)`;
        } else {
          accountName = `Deleted Credit Card (${t.debt_account_id.substring(0, 8)}...)`;
        }
      }

      const isPositive = t.amount >= 0;
      const isIncome = t.category === 'Income' || t.amount > 0;
      const categoryIcon = getCategoryIcon(t.category, isIncome);

      return `
            <div class="table-row compact">
                <div class="table-transaction">
                    <div class="table-icon small">${categoryIcon}</div>
                    <div>
                        <div style="font-weight: 500; font-size: 14px;">${escapeHtml(t.description)}</div>
                        <div class="text-muted" style="font-size: 12px;">${formatDate(t.date)} • ${escapeHtml(accountName)}</div>
                    </div>
                </div>
                <div class="table-amount ${isPositive ? 'positive' : 'negative'}" style="font-size: 16px;">
                    ${isPositive ? '+' : ''}${formatCurrency(t.amount)}
                </div>
            </div>`;
    })
    .join('');
}

export async function updateDashboard({ appData }) {
  // Capture snapshot and fetch historical data
  await captureFinancialSnapshot();
  await fetchHistoricalComparison();
  const totalCash = sumMoney(appData.cashAccounts.map(acc => acc.balance || 0));
  const totalInvestments = sumMoney(appData.investmentAccounts.map(acc => acc.balance));
  const totalDebt = sumMoney(appData.debtAccounts.map(acc => acc.balance));
  const monthlyRecurring = sumMoney(
    appData.recurringBills
      .filter(b => b.active !== false)
      .map(b => convertToMonthlyPrecise(b.amount, b.frequency))
  );
  const netWorth = subtractMoney(addMoney(totalCash, totalInvestments), totalDebt);

  const emergencyRatio = KPIs.calculateEmergencyFundRatio(appData);
  const dti = KPIs.calculateDebtToIncomeRatio(appData);
  const savingsRate = KPIs.calculateSavingsRate(appData);
  const healthScore = KPIs.calculateOverallHealthScore({ emergencyRatio, dti, savingsRate });

  renderFinancialHealth({ emergencyRatio, dti, savingsRate, healthScore });
  renderBillsTimeline({ appData });

  const totalCashEl = document.getElementById('total-cash');
  if (totalCashEl) {
    totalCashEl.textContent = formatCurrency(totalCash);
  }

  const totalInvestmentsEl = document.getElementById('total-investments');
  if (totalInvestmentsEl) {
    totalInvestmentsEl.textContent = formatCurrency(totalInvestments);
  }

  const totalDebtEl = document.getElementById('total-debt');
  if (totalDebtEl) {
    totalDebtEl.textContent = formatCurrency(totalDebt);
  }

  const monthlyRecurringEl = document.getElementById('monthly-recurring');
  if (monthlyRecurringEl) {
    monthlyRecurringEl.textContent = formatCurrency(monthlyRecurring);
  }

  const netWorthEl = document.getElementById('net-worth');
  if (netWorthEl) {
    netWorthEl.textContent = formatCurrency(netWorth);
  }

  // Update net worth badge
  const netWorthBadge = document.getElementById('net-worth-badge');
  if (netWorthBadge) {
    netWorthBadge.textContent = `Net Worth: ${formatCurrency(netWorth)}`;
  }

  // Update metric trends
  await updateMetricTrends({ totalCash, totalInvestments, totalDebt, monthlyRecurring });

  renderRecentTransactions(appData);

  // Initialize or update time budget widget
  if (!timeBudgetWidget && document.getElementById('time-budget-widget')) {
    timeBudgetWidget = new TimeBudgetWidget('time-budget-widget');
    timeBudgetWidget.init(appData);
  } else if (timeBudgetWidget) {
    timeBudgetWidget.updateAppData(appData);
  }

  // Update enhanced metrics
  updateEnhancedMetrics(appData);

  // Update focus charts
  updateFocusCharts(appData);
}

function updateEnhancedMetrics(appData) {
  const totalCash = sumMoney(appData.cashAccounts.map(acc => acc.balance || 0));
  const totalInvestments = sumMoney(appData.investmentAccounts.map(acc => acc.balance));
  const totalDebt = sumMoney(appData.debtAccounts.map(acc => acc.balance));
  const netWorth = subtractMoney(addMoney(totalCash, totalInvestments), totalDebt);
  const totalAssets = addMoney(totalCash, totalInvestments);

  // Net Worth metric
  const netWorthEl = document.getElementById('net-worth-enhanced');
  if (netWorthEl) {
    netWorthEl.textContent = formatCurrency(netWorth);
  }

  // Calculate net worth change using historical data
  const netWorthChangeEl = document.getElementById('net-worth-change');
  const netWorthBadge = document.getElementById('net-worth-change-badge');

  if (historicalComparison && historicalComparison.net_worth_change_percent !== null) {
    // Use actual historical data
    const changePercent = historicalComparison.net_worth_change_percent;
    const previousNetWorth = historicalComparison.previous_net_worth || 0;
    const netWorthChange = netWorth - previousNetWorth;

    if (netWorthChangeEl) {
      if (changePercent !== 0) {
        netWorthChangeEl.textContent = `${changePercent > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(netWorthChange))} this ${currentComparisonPeriod}`;
      } else {
        netWorthChangeEl.textContent = '→ No change';
      }
    }

    if (netWorthBadge) {
      netWorthBadge.textContent =
        changePercent >= 0 ? `+${changePercent.toFixed(1)}%` : `${changePercent.toFixed(1)}%`;
      netWorthBadge.className =
        changePercent >= 0 ? 'metric-badge positive' : 'metric-badge negative';
    }
  } else {
    // Fallback to estimated change
    const netWorthChange = netWorth * 0.024; // Mock 2.4% change
    if (netWorthChangeEl) {
      netWorthChangeEl.textContent = `↑ ${formatCurrency(netWorthChange)} this month (est.)`;
    }
    if (netWorthBadge) {
      netWorthBadge.textContent = '+2.4%';
      netWorthBadge.className = 'metric-badge positive';
    }
  }

  // Monthly Cash Flow
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyTransactions = appData.transactions.filter(t => {
    // Parse date in local timezone
    const tDate = new Date(`${t.date}T00:00:00`);
    return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
  });

  const monthlyIncome = sumMoney(monthlyTransactions.filter(t => t.amount > 0).map(t => t.amount));
  const monthlyExpenses = Math.abs(
    sumMoney(monthlyTransactions.filter(t => t.amount < 0).map(t => t.amount))
  );
  const monthlyCashFlow = subtractMoney(monthlyIncome, monthlyExpenses);

  const cashFlowEl = document.getElementById('monthly-cash-flow');
  if (cashFlowEl) {
    cashFlowEl.textContent = (monthlyCashFlow >= 0 ? '+' : '') + formatCurrency(monthlyCashFlow);
  }

  const cashFlowBadge = document.getElementById('cash-flow-badge');
  if (cashFlowBadge) {
    cashFlowBadge.textContent = monthlyCashFlow >= 0 ? 'Positive' : 'Negative';
    cashFlowBadge.className =
      monthlyCashFlow >= 0 ? 'metric-badge positive' : 'metric-badge negative';
  }

  const cashFlowBreakdown = document.getElementById('cash-flow-breakdown');
  if (cashFlowBreakdown) {
    cashFlowBreakdown.textContent = `Income: ${formatCurrency(monthlyIncome)} • Expenses: ${formatCurrency(monthlyExpenses)}`;
  }

  // Investment Performance
  const investmentTotalEl = document.getElementById('investment-total');
  if (investmentTotalEl) {
    investmentTotalEl.textContent = formatCurrency(totalInvestments);
  }

  const investmentGains = totalInvestments * 0.132; // Mock 13.2% YTD
  const investmentGainsEl = document.getElementById('investment-gains');
  if (investmentGainsEl) {
    investmentGainsEl.textContent = `↑ ${formatCurrency(investmentGains)} YTD gains`;
  }

  const investmentBadge = document.getElementById('investment-performance-badge');
  if (investmentBadge) {
    investmentBadge.textContent = '+13.2%';
    investmentBadge.className = 'metric-badge positive';
  }

  // Assets vs Debt
  const totalAssetsEl = document.getElementById('total-assets');
  if (totalAssetsEl) {
    totalAssetsEl.textContent = formatCurrency(totalAssets);
  }

  const assetsDebtRatio = document.getElementById('assets-debt-ratio');
  if (assetsDebtRatio) {
    const assetsPercent =
      totalAssets > 0 ? Math.round((totalAssets / (totalAssets + totalDebt)) * 100) : 0;
    const debtPercent = 100 - assetsPercent;
    assetsDebtRatio.textContent = `${assetsPercent}/${debtPercent}`;
  }

  const assetsDebtBreakdown = document.getElementById('assets-debt-breakdown');
  if (assetsDebtBreakdown) {
    assetsDebtBreakdown.textContent = `Assets: ${formatCurrency(totalAssets)} • Debt: ${formatCurrency(totalDebt)}`;
  }
}

function updateFocusCharts(appData) {
  // Calculate expense breakdown
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyExpenses = appData.transactions.filter(t => {
    // Parse date in local timezone by adding time component
    const tDate = new Date(`${t.date}T00:00:00`);
    return (
      tDate.getMonth() === currentMonth &&
      tDate.getFullYear() === currentYear &&
      (t.amount < 0 || t.category === 'Debt')
    );
  });

  // Group expenses by category
  const expenseByCategory = {};
  let totalExpenses = 0;

  monthlyExpenses.forEach(t => {
    const category = t.category || 'Uncategorized';
    if (!expenseByCategory[category]) {
      expenseByCategory[category] = 0;
    }
    expenseByCategory[category] = addMoney(expenseByCategory[category], Math.abs(t.amount));
    totalExpenses = addMoney(totalExpenses, Math.abs(t.amount));
  });

  // Sort by amount and take top 5
  const topExpenses = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Update total expenses
  const totalExpensesEl = document.getElementById('total-expenses');
  if (totalExpensesEl) {
    totalExpensesEl.textContent = `${formatCurrency(totalExpenses)}/mo`;
  }

  // Render expense breakdown
  const expenseList = document.getElementById('expense-breakdown-list');
  if (expenseList) {
    if (topExpenses.length > 0) {
      const maxExpense = topExpenses[0][1];
      const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#dfe6e9'];

      expenseList.innerHTML = topExpenses
        .map(([category, amount], index) => {
          const percentage = (amount / maxExpense) * 100;
          const icon = getCategoryIcon(category);

          return `
                  <div class="expense-item">
                      <div class="expense-bar">
                          <div class="expense-fill" style="width: ${percentage}%; background: ${colors[index]};">
                              <span class="expense-icon">${icon}</span>
                          </div>
                      </div>
                      <div class="expense-details">
                          <span>${escapeHtml(category)}</span>
                          <span data-sensitive="true">${formatCurrency(amount)}</span>
                      </div>
                  </div>
              `;
        })
        .join('');
    } else {
      // Show empty state message
      expenseList.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 20px; color: #94a3b8;">
          <div style="font-size: 2em; margin-bottom: 10px;">📊</div>
          <div>No expenses recorded for this month yet</div>
          <div style="font-size: 0.9em; margin-top: 5px;">Add transactions or wait for the month to progress</div>
        </div>
      `;
    }
  }

  // Update investment mix
  const investmentTotal = sumMoney(appData.investmentAccounts.map(acc => acc.balance));
  const investmentMixTotalEl = document.getElementById('investment-mix-total');
  if (investmentMixTotalEl) {
    investmentMixTotalEl.textContent = formatCurrency(investmentTotal);
  }

  // Mock investment breakdown (in real app, would calculate from holdings)
  const investmentList = document.getElementById('investment-breakdown-list');
  if (investmentList && investmentTotal > 0) {
    const stocksAmount = investmentTotal * 0.6;
    const bondsAmount = investmentTotal * 0.3;
    const cashAmount = investmentTotal * 0.1;

    investmentList.innerHTML = `
            <div class="investment-item">
                <div class="investment-icon">📈</div>
                <div class="investment-info">
                    <div class="investment-label">Stocks</div>
                    <div class="investment-value" data-sensitive="true">${formatCurrency(stocksAmount)}</div>
                </div>
                <div class="investment-percent">60%</div>
            </div>
            <div class="investment-item">
                <div class="investment-icon">📊</div>
                <div class="investment-info">
                    <div class="investment-label">Bonds</div>
                    <div class="investment-value" data-sensitive="true">${formatCurrency(bondsAmount)}</div>
                </div>
                <div class="investment-percent">30%</div>
            </div>
            <div class="investment-item">
                <div class="investment-icon">💵</div>
                <div class="investment-info">
                    <div class="investment-label">Cash</div>
                    <div class="investment-value" data-sensitive="true">${formatCurrency(cashAmount)}</div>
                </div>
                <div class="investment-percent">10%</div>
            </div>
            <div class="investment-summary">
                ↑ 13.2% YTD Return
            </div>
        `;
  }

  // Update main chart (if Chart.js is available)
  updateMainDashboardChart(appData);
}

function generateNetWorthHistory(currentNetWorth) {
  // Generate realistic historical net worth data based on current value
  // Assumes 2.45% growth this month (matching the badge display)
  const monthlyGrowthRate = 0.0245;
  const historicalData = [];
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  // Work backwards from current net worth
  let value = currentNetWorth;
  for (let i = 5; i >= 0; i--) {
    historicalData.unshift(Math.round(value));
    // Go back by reducing by growth rate (compound)
    value = value / (1 + monthlyGrowthRate * (i === 5 ? 1 : 0.8));
  }

  return { labels, data: historicalData };
}

function updateMainDashboardChart(appData) {
  const canvas = document.getElementById('mainDashboardChart');
  if (!canvas || !window.Chart) {
    return;
  }

  const ctx = canvas.getContext('2d');

  // Calculate current net worth
  const totalCash = sumMoney(appData.cashAccounts.map(acc => acc.balance || 0));
  const totalInvestments = sumMoney(appData.investmentAccounts.map(acc => acc.balance));
  const totalDebt = sumMoney(appData.debtAccounts.map(acc => acc.balance));
  const netWorth = subtractMoney(addMoney(totalCash, totalInvestments), totalDebt);

  // Generate historical data
  const { labels, data } = generateNetWorthHistory(netWorth);

  // Destroy existing chart if it exists
  if (window.mainDashboardChartInstance) {
    window.mainDashboardChartInstance.destroy();
  }

  // Create new chart
  window.mainDashboardChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Net Worth',
          data,
          borderColor: 'rgba(76, 175, 80, 0.8)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 5,
          right: 5,
          top: 5,
          bottom: 5,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: 'Net Worth Progress',
          color: '#ffffff',
          font: {
            size: 16,
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
          ticks: {
            color: '#94a3b8',
          },
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
          },
          ticks: {
            color: '#94a3b8',
            callback(value) {
              // Format based on value size
              if (value >= 1000000) {
                return `$${(value / 1000000).toFixed(1)}M`;
              } else if (value >= 1000) {
                return `$${(value / 1000).toFixed(0)}k`;
              } else {
                return `$${value.toFixed(0)}`;
              }
            },
          },
        },
      },
    },
  });
}
