// js/modules/dashboard.js
import { formatCurrency, escapeHtml, formatDate, convertToMonthly } from './utils.js';
import * as KPIs from './kpis.js';
import { renderBillsTimeline } from './timeline.js';
import * as Accounts from './accounts.js';
import * as Debt from './debt.js';
import { addMoney, subtractMoney, sumMoney, convertToMonthlyPrecise } from './financialMath.js';
import { TimeBudgetWidget } from './widgets/timeBudgetWidget.js';

// Initialize time budget widget
let timeBudgetWidget = null;

function renderFinancialHealth(kpiResults) {
    const container = document.querySelector('.health-score-container');
    if (!container) return;

    const { emergencyRatio, dti, savingsRate, healthScore } = kpiResults;

    const healthScoreHTML = `
        <div class="health-indicator-enhanced">
            <div class="health-score-value ${healthScore.status.toLowerCase()}">${escapeHtml(healthScore.score)}</div>
            <div class="health-score-label">Overall Score</div>
            <div class="health-score-status status-${healthScore.status.toLowerCase()}">${escapeHtml(healthScore.status)}</div>
        </div>
        <div class="kpi-details-grid">
            <div class="kpi-metric-card">
                <div class="kpi-label">Savings Rate</div>
                <div class="kpi-value">${savingsRate.toFixed(1)}%</div>
            </div>
            <div class="kpi-metric-card">
                <div class="kpi-label">Emergency Fund</div>
                <div class="kpi-value">${isFinite(emergencyRatio) ? emergencyRatio.toFixed(1) : 'N/A'} mos</div>
            </div>
            <div class="kpi-metric-card">
                <div class="kpi-label">Debt-to-Income</div>
                <div class="kpi-value">${isFinite(dti) ? dti.toFixed(1) : '0'}%</div>
            </div>
        </div>
    `;
    container.innerHTML = healthScoreHTML;
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
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-description">${escapeHtml(t.description)}</div>
                    <div class="transaction-details">${formatDate(t.date)} - ${escapeHtml(accountName)}</div>
                </div>
                <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
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

    renderRecentTransactions(appData);
    
    // Initialize or update time budget widget
    if (!timeBudgetWidget && document.getElementById('time-budget-widget')) {
        timeBudgetWidget = new TimeBudgetWidget('time-budget-widget');
        timeBudgetWidget.init(appData);
    } else if (timeBudgetWidget) {
        timeBudgetWidget.updateAppData(appData);
    }
}

