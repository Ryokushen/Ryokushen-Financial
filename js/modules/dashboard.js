// js/modules/dashboard.js
import { formatCurrency, escapeHtml, formatDate, convertToMonthly } from './utils.js';
import * as KPIs from './kpis.js';
import { renderBillsTimeline } from './timeline.js';
import * as Accounts from './accounts.js';
import * as Debt from './debt.js';
import { addMoney, subtractMoney, sumMoney, convertToMonthlyPrecise } from './financialMath.js';
import { TimeBudgetWidget } from './widgets/timeBudgetWidget.js';
import { getCategoryIcon } from './transactions.js';

// Initialize time budget widget
let timeBudgetWidget = null;

// Store previous values for trend calculation
let previousMetrics = {
    totalCash: 0,
    totalInvestments: 0,
    totalDebt: 0,
    monthlyRecurring: 0
};

function renderFinancialHealth(kpiResults) {
    const container = document.querySelector('.health-score-container');
    if (!container) return;

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
    if (previous === 0) return { value: 0, direction: 'neutral' };
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return {
        value: Math.abs(change).toFixed(1),
        direction: change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'neutral'
    };
}

function updateMetricTrends(metrics) {
    const { totalCash, totalInvestments, totalDebt, monthlyRecurring } = metrics;
    
    // Calculate trends
    const cashTrend = calculateTrend(totalCash, previousMetrics.totalCash);
    const investmentTrend = calculateTrend(totalInvestments, previousMetrics.totalInvestments);
    const debtTrend = calculateTrend(totalDebt, previousMetrics.totalDebt);
    const billsTrend = calculateTrend(monthlyRecurring, previousMetrics.monthlyRecurring);
    
    // Update trend displays
    const cashTrendEl = document.getElementById('cash-trend');
    if (cashTrendEl) {
        cashTrendEl.textContent = cashTrend.direction === 'neutral' ? '→ 0%' : 
            `${cashTrend.direction === 'up' ? '↗' : '↘'} ${cashTrend.value}%`;
        cashTrendEl.className = `metric-trend ${cashTrend.direction}`;
    }
    
    const investmentTrendEl = document.getElementById('investment-trend');
    if (investmentTrendEl) {
        investmentTrendEl.textContent = investmentTrend.direction === 'neutral' ? '→ 0%' : 
            `${investmentTrend.direction === 'up' ? '↗' : '↘'} ${investmentTrend.value}%`;
        investmentTrendEl.className = `metric-trend ${investmentTrend.direction}`;
    }
    
    const debtTrendEl = document.getElementById('debt-trend');
    if (debtTrendEl) {
        // For debt, down is good
        debtTrendEl.textContent = debtTrend.direction === 'neutral' ? '→ 0%' : 
            `${debtTrend.direction === 'up' ? '↗' : '↘'} ${debtTrend.value}%`;
        debtTrendEl.className = `metric-trend ${debtTrend.direction === 'down' ? 'up' : debtTrend.direction === 'up' ? 'down' : ''}`;
    }
    
    const billsTrendEl = document.getElementById('bills-trend');
    if (billsTrendEl) {
        billsTrendEl.textContent = billsTrend.direction === 'neutral' ? '→ 0%' : 
            `${billsTrend.direction === 'up' ? '↗' : '↘'} ${billsTrend.value}%`;
        billsTrendEl.className = `metric-trend ${billsTrend.direction}`;
    }
    
    // Store current values for next comparison
    previousMetrics = { totalCash, totalInvestments, totalDebt, monthlyRecurring };
}

function renderRecentTransactions(appData) {
    const list = document.getElementById("recent-transactions-list");
    if (!list) return;

    const recent = [...appData.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    if (recent.length === 0) {
        list.innerHTML = `<div class="empty-state">No recent transactions.</div>`;
        return;
    }
    list.innerHTML = recent.map(t => {
        const account = appData.cashAccounts.find(a => a.id === t.account_id);
        const accountName = account ? escapeHtml(account.name) : "Unknown";
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
    }).join('');
}


export function updateDashboard({ appData }) {
    const totalCash = sumMoney(appData.cashAccounts.map(acc => acc.balance || 0));
    const totalInvestments = sumMoney(appData.investmentAccounts.map(acc => acc.balance));
    const totalDebt = sumMoney(appData.debtAccounts.map(acc => acc.balance));
    const monthlyRecurring = sumMoney(appData.recurringBills.filter(b => b.active !== false).map(b => convertToMonthlyPrecise(b.amount, b.frequency)));
    const netWorth = subtractMoney(addMoney(totalCash, totalInvestments), totalDebt);

    const emergencyRatio = KPIs.calculateEmergencyFundRatio(appData);
    const dti = KPIs.calculateDebtToIncomeRatio(appData);
    const savingsRate = KPIs.calculateSavingsRate(appData);
    const healthScore = KPIs.calculateOverallHealthScore({ emergencyRatio, dti, savingsRate });

    renderFinancialHealth({ emergencyRatio, dti, savingsRate, healthScore });
    renderBillsTimeline({ appData });

    const totalCashEl = document.getElementById("total-cash");
    if (totalCashEl) totalCashEl.textContent = formatCurrency(totalCash);

    const totalInvestmentsEl = document.getElementById("total-investments");
    if (totalInvestmentsEl) totalInvestmentsEl.textContent = formatCurrency(totalInvestments);

    const totalDebtEl = document.getElementById("total-debt");
    if (totalDebtEl) totalDebtEl.textContent = formatCurrency(totalDebt);

    const monthlyRecurringEl = document.getElementById("monthly-recurring");
    if (monthlyRecurringEl) monthlyRecurringEl.textContent = formatCurrency(monthlyRecurring);

    const netWorthEl = document.getElementById("net-worth");
    if (netWorthEl) netWorthEl.textContent = formatCurrency(netWorth);
    
    // Update net worth badge
    const netWorthBadge = document.getElementById("net-worth-badge");
    if (netWorthBadge) netWorthBadge.textContent = `Net Worth: ${formatCurrency(netWorth)}`;
    
    // Update metric trends
    updateMetricTrends({ totalCash, totalInvestments, totalDebt, monthlyRecurring });

    renderRecentTransactions(appData);
    
    // Initialize or update time budget widget
    if (!timeBudgetWidget && document.getElementById('time-budget-widget')) {
        timeBudgetWidget = new TimeBudgetWidget('time-budget-widget');
        timeBudgetWidget.init(appData);
    } else if (timeBudgetWidget) {
        timeBudgetWidget.updateAppData(appData);
    }
}

