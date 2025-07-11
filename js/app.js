// js/app.js - Main Application Orchestrator
import db from './database.js';
import { CHART_COLORS, formatCurrency, formatDate, escapeHtml, convertToMonthly } from './modules/utils.js';
import { showError, switchTab } from './modules/ui.js';
import { createCharts } from './modules/charts.js';
import * as Accounts from './modules/accounts.js';
import * as Transactions from './modules/transactions.js';
import * as Investments from './modules/investments.js';
import * as Debt from './modules/debt.js';
import * as Recurring from './modules/recurring.js';
import * as Savings from './modules/savings.js';
import * as KPIs from './modules/kpis.js';
import { renderBillsTimeline } from './modules/timeline.js';

const appState = {
    appData: {
        transactions: [],
        cashAccounts: [],
        investmentAccounts: [],
        debtAccounts: [],
        recurringBills: [],
        savingsGoals: []
    },
    CHART_COLORS: CHART_COLORS,
    balanceCache: new Map()
};

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initializeApp();
        setupEventListeners();
    } catch (error) {
        showError("Fatal: Could not initialize the application. " + error.message);
        console.error("Initialization Error:", error);
    }
});

async function initializeApp() {
    await loadAllData();

    calculateAccountBalances();

    await updateAllDisplays(appState); // Initial render
    const transactionDate = document.getElementById("transaction-date");
    if (transactionDate) {
        transactionDate.value = new Date().toISOString().split("T")[0];
    }
}

async function loadAllData() {
    try {
        const [transactions, investmentAccounts, cashAccounts, debtAccounts, recurringBills, savingsGoals] = await Promise.all([
            db.getTransactions(),
            db.getInvestmentAccounts(),
            db.getCashAccounts(),
            db.getDebtAccounts(),
            db.getRecurringBills(),
            db.getSavingsGoals()
        ]);

        appState.appData.transactions = transactions.map(t => ({ ...t, amount: parseFloat(t.amount) }));
        appState.appData.cashAccounts = cashAccounts.map(c => ({ ...c, isActive: c.is_active }));
        appState.appData.investmentAccounts = investmentAccounts.map(Investments.mapInvestmentAccount);
        appState.appData.debtAccounts = debtAccounts.map(d => ({
            ...d,
            balance: parseFloat(d.balance),
            interestRate: parseFloat(d.interest_rate),
            minimumPayment: parseFloat(d.minimum_payment),
            creditLimit: d.credit_limit ? parseFloat(d.credit_limit) : null,
            dueDate: d.due_date
        }));

        // UPDATED: Handle new payment method fields for recurring bills
        appState.appData.recurringBills = recurringBills.map(b => ({
            ...b,
            amount: parseFloat(b.amount),
            nextDue: b.next_due,
            active: b.active,
            paymentMethod: b.payment_method || 'cash', // Default to cash for backward compatibility
            debtAccountId: b.debt_account_id // Add debt account ID field
        }));

        appState.appData.savingsGoals = savingsGoals.map(g => ({
            ...g,
            targetAmount: parseFloat(g.target_amount),
            currentAmount: parseFloat(g.current_amount),
            linkedAccountId: g.linked_account_id,
            targetDate: g.target_date,
            createdDate: g.created_date,
            completedDate: g.completed_date
        }));

        await migrateDebtTransactions(appState.appData.transactions, appState.appData.debtAccounts);
    } catch (error) {
        console.error("Data Loading Error:", error);
        showError("Could not load financial data from the database. Please refresh the page.");
        // Prevent app from proceeding with empty state
        appState.appData = {
            transactions: [],
            cashAccounts: [],
            investmentAccounts: [],
            debtAccounts: [],
            recurringBills: [],
            savingsGoals: []
        };
    }
}

function calculateAccountBalances() {
    appState.balanceCache.clear();

    // Group transactions by account for efficient calculation
    const transactionsByAccount = new Map();

    appState.appData.transactions.forEach(transaction => {
        if (transaction.account_id) {  // Only group cash transactions
            if (!transactionsByAccount.has(transaction.account_id)) {
                transactionsByAccount.set(transaction.account_id, []);
            }
            transactionsByAccount.get(transaction.account_id).push(transaction);
        }
    });

    // Calculate and cache balances
    appState.appData.cashAccounts.forEach(account => {
        const accountTransactions = transactionsByAccount.get(account.id) || [];
        const balance = accountTransactions.reduce((sum, t) => sum + t.amount, 0);
        account.balance = balance;
        appState.balanceCache.set(account.id, balance);
    });
}

function updateAccountBalance(accountId, amountChange) {
    const account = appState.appData.cashAccounts.find(a => a.id === accountId);
    if (account) {
        account.balance = (account.balance || 0) + amountChange;
        appState.balanceCache.set(accountId, account.balance);
    }
}

function setupEventListeners() {
    const onUpdate = () => updateAllDisplays(appState);

    document.querySelectorAll(".tab-btn").forEach(button => {
        button.addEventListener("click", function () { switchTab(this.getAttribute("data-tab"), appState); });
    });

    // Pass the balance update function to modules that need it
    const enhancedAppState = {
        ...appState,
        updateAccountBalance
    };

    Accounts.setupEventListeners(enhancedAppState, onUpdate);
    Transactions.setupEventListeners(enhancedAppState, onUpdate);
    Investments.setupEventListeners(enhancedAppState, onUpdate);
    Debt.setupEventListeners(enhancedAppState, onUpdate);
    Recurring.setupEventListeners(enhancedAppState, onUpdate);
    Savings.setupEventListeners(enhancedAppState, onUpdate);
}

// This function just re-renders the components with the current state.
async function updateAllDisplays(state) {
    updateDashboard(state);
    const cashList = document.getElementById("cash-accounts-list");
    if (cashList) Accounts.renderCashAccounts(state);

    const transactionsBody = document.getElementById("transactions-table-body");
    if (transactionsBody) Transactions.renderTransactions(state);

    const investmentsList = document.getElementById("investment-accounts-list");
    if (investmentsList) Investments.renderInvestmentAccountsEnhanced(state);

    const savingsList = document.getElementById("savings-goals-list");
    if (savingsList) Savings.renderSavingsGoals(state);

    const debtList = document.getElementById("debt-accounts-list");
    if (debtList) Debt.renderDebtAccounts(state);

    const recurringList = document.getElementById("all-recurring-bills-list");
    if (recurringList) Recurring.renderRecurringBills(state);

    const netWorthCanvas = document.getElementById("netWorthChart");
    if (netWorthCanvas) createCharts(state);

    Accounts.populateAccountDropdowns(state.appData);
    Debt.populateDebtAccountDropdown(state.appData);
}

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

export function updateDashboard({ appData }) {
    const totalCash = appData.cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const totalInvestments = appData.investmentAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const totalDebt = appData.debtAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const monthlyRecurring = appData.recurringBills.filter(b => b.active !== false).reduce((sum, b) => sum + convertToMonthly(b.amount, b.frequency), 0);
    const netWorth = totalCash + totalInvestments - totalDebt;

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

async function migrateDebtTransactions(transactions, debtAccounts) {
    // Make migration idempotent: only migrate if debt_account exists and debt_account_id is null
    const db = (await import('./database.js')).default;
    for (const t of transactions.filter(t => t.category === 'Debt' && t.debt_account && !t.debt_account_id)) {
        const debtAccount = debtAccounts.find(d => d.name === t.debt_account);
        if (debtAccount) {
            t.debt_account_id = debtAccount.id;
            await db.updateTransaction(t.id, { debt_account_id: t.debt_account_id });
            delete t.debt_account;  // Clean up old field
        } else {
            console.warn(`Migration: No matching debt account for transaction ${t.id}`);
        }
    }
}