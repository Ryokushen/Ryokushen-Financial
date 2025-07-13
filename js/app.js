// js/app.js - Main Application Orchestrator
import db from './database.js';
import { CHART_COLORS } from './modules/utils.js';
import { showError, switchTab, announceToScreenReader } from './modules/ui.js';
import { createCharts } from './modules/charts.js';
import * as Accounts from './modules/accounts.js';
import * as Transactions from './modules/transactions.js';
import * as Investments from './modules/investments.js';
import * as Debt from './modules/debt.js';
import * as Recurring from './modules/recurring.js';
import * as Savings from './modules/savings.js';
import * as KPIs from './modules/kpis.js';
import { renderBillsTimeline } from './modules/timeline.js';
import { updateDashboard } from './modules/dashboard.js';
import { debug } from './modules/debug.js';
import { addMoney } from './modules/financialMath.js';

// Configure Chart.js global defaults for better mobile responsiveness
if (typeof Chart !== 'undefined') {
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.display = true;
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.padding = 10;
    Chart.defaults.plugins.legend.labels.font = {
        size: 11
    };
}

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

// Global error handlers
window.addEventListener('unhandledrejection', event => {
    debug.error('Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred. Please refresh the page if issues persist.');
    event.preventDefault();
});

window.addEventListener('error', event => {
    debug.error('Global error:', event.error);
    showError('An unexpected error occurred. Please refresh the page if issues persist.');
    event.preventDefault();
});

// Network status handlers
window.addEventListener('online', () => {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.style.display = 'none';
    announceToScreenReader('Connection restored');
});

window.addEventListener('offline', () => {
    showError('No internet connection. Some features may not work.');
});

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initializeApp();
        setupEventListeners();
    } catch (error) {
        showError("Fatal: Could not initialize the application. " + error.message);
        debug.error("Initialization Error:", error);
    }
});

async function initializeApp() {
    // Setup modal manager
    const { setupCommonModals } = await import('./modules/modalManager.js');
    setupCommonModals();
    
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
        const dataTypes = ['transactions', 'investmentAccounts', 'cashAccounts', 'debtAccounts', 'recurringBills', 'savingsGoals'];
        const results = await Promise.allSettled([
            db.getTransactions(),
            db.getInvestmentAccounts(),
            db.getCashAccounts(),
            db.getDebtAccounts(),
            db.getRecurringBills(),
            db.getSavingsGoals()
        ]);
        
        // Process results and handle partial failures
        const [transactionsResult, investmentAccountsResult, cashAccountsResult, debtAccountsResult, recurringBillsResult, savingsGoalsResult] = results;
        
        // Set default empty arrays for failed loads
        const transactions = transactionsResult.status === 'fulfilled' ? transactionsResult.value : [];
        const investmentAccounts = investmentAccountsResult.status === 'fulfilled' ? investmentAccountsResult.value : [];
        const cashAccounts = cashAccountsResult.status === 'fulfilled' ? cashAccountsResult.value : [];
        const debtAccounts = debtAccountsResult.status === 'fulfilled' ? debtAccountsResult.value : [];
        const recurringBills = recurringBillsResult.status === 'fulfilled' ? recurringBillsResult.value : [];
        const savingsGoals = savingsGoalsResult.status === 'fulfilled' ? savingsGoalsResult.value : [];
        
        // Log any failures
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                debug.error(`Failed to load ${dataTypes[index]}:`, result.reason);
                showError(`Warning: Failed to load ${dataTypes[index]}. Some features may be limited.`);
            }
        });

        // Map data with proper null checks and safe parsing
        appState.appData.transactions = transactions.map(t => ({ 
            ...t, 
            amount: t.amount != null ? parseFloat(t.amount) : 0 
        }));
        
        appState.appData.cashAccounts = cashAccounts.map(c => ({ 
            ...c, 
            isActive: c.is_active,
            balance: c.balance != null ? parseFloat(c.balance) : 0
        }));
        
        appState.appData.investmentAccounts = investmentAccounts.map(Investments.mapInvestmentAccount);
        
        appState.appData.debtAccounts = debtAccounts.map(d => ({
            ...d,
            balance: d.balance != null ? parseFloat(d.balance) : 0,
            interestRate: d.interest_rate != null ? parseFloat(d.interest_rate) : 0,
            minimumPayment: d.minimum_payment != null ? parseFloat(d.minimum_payment) : 0,
            creditLimit: d.credit_limit != null ? parseFloat(d.credit_limit) : null,
            dueDate: d.due_date
        }));

        // UPDATED: Handle new payment method fields for recurring bills
        appState.appData.recurringBills = recurringBills.map(b => ({
            ...b,
            amount: b.amount != null ? parseFloat(b.amount) : 0,
            nextDue: b.next_due,
            active: b.active !== undefined ? b.active : true,
            paymentMethod: b.payment_method || 'cash', // Default to cash for backward compatibility
            debtAccountId: b.debt_account_id // Add debt account ID field
        }));

        appState.appData.savingsGoals = savingsGoals.map(g => ({
            ...g,
            targetAmount: g.target_amount != null ? parseFloat(g.target_amount) : 0,
            currentAmount: g.current_amount != null ? parseFloat(g.current_amount) : 0,
            linkedAccountId: g.linked_account_id,
            targetDate: g.target_date,
            createdDate: g.created_date,
            completedDate: g.completed_date
        }));

        await migrateDebtTransactions(appState.appData.transactions, appState.appData.debtAccounts);
    } catch (error) {
        debug.error("Data Loading Error:", error);
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
        account.balance = addMoney(account.balance || 0, amountChange);
        appState.balanceCache.set(accountId, account.balance);
    }
}

function setupEventListeners() {
    const onUpdate = () => {
        // Clear KPI cache when data is updated
        import('./modules/kpis.js')
            .then(kpis => kpis.clearKPICache())
            .catch(error => debug.error('Failed to clear KPI cache:', error));
        updateAllDisplays(appState);
    };

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

// Dashboard functionality moved to dashboard.js module

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
            debug.warn(`Migration: No matching debt account for transaction ${t.id}`);
        }
    }
}