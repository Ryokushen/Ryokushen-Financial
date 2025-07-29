// js/app.js - Main Application Orchestrator
import { supabaseAuth } from './modules/supabaseAuth.js';
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
import { privacyManager, togglePrivacyMode, enablePanicMode, reapplyPrivacy, isPrivacyMode } from './modules/privacy.js';
import { GlobalVoiceInterface } from './modules/voice/globalVoiceInterface.js';
import { dataIndex } from './modules/dataIndex.js';
import { timeBudgets } from './modules/timeBudgets.js';
import { initializeTimeSettings } from './modules/timeSettings.js';
import { initializeTransactionTimePreview } from './modules/transactionTimePreview.js';
import { initializePrivacySettings } from './modules/privacySettings.js';
import { initRulesUI } from './modules/rulesUI.js';
import { calendar } from './modules/calendar.js';
import { eventManager } from './modules/eventManager.js';
import { populateAllCategoryDropdowns } from './modules/categories.js';
import { performanceDashboard } from './modules/performanceDashboard.js';
import { cashFlowSankey } from './modules/cashFlowSankey.js';

// Initialize app after auth is ready
(async function initApp() {
    // Wait for authentication to initialize
    await supabaseAuth.waitForInit();
    
    // Check for password reset token first
    const hash = window.location.hash.substring(1);
    const isPasswordReset = hash.includes('recovery');

    if (isPasswordReset) {
        // Handle password reset flow - already handled in initializeAuth
        return;
    } else if (!supabaseAuth.isAuthenticated()) {
        // Show login screen only if not in password reset flow
        supabaseAuth.showAuthScreen();
        return;
    }
    
    // User is authenticated, proceed with app initialization
    
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

    // Global voice interface instance
    let globalVoiceInterface = null;

    // Global error handlers
    eventManager.addEventListener(window, 'unhandledrejection', event => {
        debug.error('Unhandled promise rejection:', event.reason);
        showError('An unexpected error occurred. Please refresh the page if issues persist.');
        event.preventDefault();
    });

    eventManager.addEventListener(window, 'error', event => {
        debug.error('Global error:', event.error);
        showError('An unexpected error occurred. Please refresh the page if issues persist.');
        event.preventDefault();
    });

    // Network status handlers
    eventManager.addEventListener(window, 'online', () => {
        const banner = document.getElementById('offline-banner');
        if (banner) banner.style.display = 'none';
        announceToScreenReader('Connection restored');
    });

    eventManager.addEventListener(window, 'offline', () => {
        showError('No internet connection. Some features may not work.');
    });

    eventManager.addEventListener(document, "DOMContentLoaded", async () => {
        try {
            // Add user info and logout button to header
            addUserInfoToHeader();
    checkEmailVerification();
            
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
        
        // Initialize privacy manager now that DOM is ready
        privacyManager.init();
        
        // Populate all category dropdowns with dynamic data
        populateAllCategoryDropdowns();
        
        await loadAllData();
        
        // Initialize smart rules after data is loaded
        const { smartRules } = await import('./modules/smartRules.js');
        await smartRules.init();
        
        // Make smartRules globally accessible for UI components
        window.smartRules = smartRules;
        
        // Initialize TransactionManager after data is loaded
        const { transactionManager } = await import('./modules/transactionManager.js');
        await transactionManager.init();
        
        // Make transactionManager globally accessible for debugging
        window.transactionManager = transactionManager;
        
        // Expose appState for modules that need it
        window.appState = appState;
        
        // Expose helper for accessing recurring bills (for testing/debugging)
        window.getRecurringBills = () => appState.appData.recurringBills;
        window.previewRecurring = async (days = 30) => {
            const bills = appState.appData.recurringBills;
            if (!bills || bills.length === 0) {
                console.log('No recurring bills found');
                return [];
            }
            const preview = await transactionManager.previewUpcomingRecurring(bills, days);
            console.table(preview.map(p => ({
                bill: p.bill.name,
                dueDate: p.dueDate,
                amount: p.transactionData.amount,
                category: p.transactionData.category,
                account: p.transactionData.account_id,
                creditCard: p.transactionData.debt_account_id
            })));
            return preview;
        };
        
        // Expose advanced search helpers for console use
        window.searchTransactions = async (filters) => {
            try {
                const results = await transactionManager.searchTransactions(filters);
                console.log(`Found ${results.metadata.totalCount} transactions (showing ${results.metadata.returnedCount})`);
                console.log(`Total: $${results.metadata.totalAmount.toFixed(2)} (Income: $${results.metadata.totalIncome.toFixed(2)}, Expense: $${results.metadata.totalExpense.toFixed(2)})`);
                console.table(results.transactions.slice(0, 10).map(t => ({
                    'Date': t.date,
                    'Description': t.description,
                    'Amount': `$${parseFloat(t.amount).toFixed(2)}`,
                    'Category': t.category,
                    'Account': t.account_name || 'Unknown'
                })));
                return results;
            } catch (error) {
                console.error('Search failed:', error);
                return null;
            }
        };
        
        window.searchByText = async (text, options = {}) => {
            try {
                const results = await transactionManager.searchByDescription(text, options);
                console.log(`Found ${results.length} matches for "${text}"`);
                console.table(results.slice(0, 10).map(t => ({
                    'Score': t._score,
                    'Date': t.date,
                    'Description': t._highlighted?.description || t.description,
                    'Amount': `$${parseFloat(t.amount).toFixed(2)}`,
                    'Category': t.category
                })));
                return results;
            } catch (error) {
                console.error('Text search failed:', error);
                return [];
            }
        };
        
        window.searchWithQuery = async (query) => {
            try {
                const results = await transactionManager.searchWithQuery(query);
                console.log(`Complex query found ${results.length} results`);
                console.table(results.slice(0, 10).map(t => ({
                    'Date': t.date,
                    'Description': t.description,
                    'Amount': `$${parseFloat(t.amount).toFixed(2)}`,
                    'Category': t.category,
                    'Account': t.account_name || 'Unknown'
                })));
                return results;
            } catch (error) {
                console.error('Complex query failed:', error);
                return [];
            }
        };
        
        // Initialize rule templates UI
        const { ruleTemplatesUI } = await import('./modules/ruleTemplatesUI.js');
        ruleTemplatesUI.init();
        
        // Initialize smart rules UI
        initRulesUI();
        
        // Initialize calendar
        calendar.init();
        
        // Initialize transaction import UI
        const { transactionImport } = await import('./modules/transactionImport.js');
        transactionImport.init();
        
        // Initialize bulk operations UI
        const { bulkOperationsUI } = await import('./modules/bulkOperations.js');
        bulkOperationsUI.init();
        
        // Initialize transaction templates UI
        const { transactionTemplatesUI } = await import('./modules/transactionTemplates.js');
        transactionTemplatesUI.init();
        
        // Make transactionTemplatesUI globally accessible
        window.transactionTemplatesUI = transactionTemplatesUI;
        
        // Initialize advanced search UI
        const advancedSearchModule = await import('./modules/advancedSearch.js');
        const advancedSearch = advancedSearchModule.default;

        calculateAccountBalances();

        await updateAllDisplays(appState); // Initial render
        const transactionDate = document.getElementById("transaction-date");
        if (transactionDate) {
            transactionDate.value = new Date().toISOString().split("T")[0];
        }

        // Initialize global voice interface after all data is loaded
        try {
            globalVoiceInterface = new GlobalVoiceInterface(appState);
            // Expose to window for UI button integration
            window.globalVoiceInterface = globalVoiceInterface;
            debug.log('Global voice interface initialized');
        } catch (error) {
            debug.error('Failed to initialize voice interface:', error);
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
                debtAccountId: b.debt_account_id, // Add debt account ID field
                // Keep original field names for TransactionManager compatibility
                is_active: b.is_active !== undefined ? b.is_active : (b.active !== undefined ? b.active : true),
                next_due_date: b.next_due_date || b.next_due,
                last_paid_date: b.last_paid_date,
                payment_method: b.payment_method || 'cash',
                debt_account_id: b.debt_account_id,
                account_id: b.account_id,
                frequency: b.frequency,
                category: b.category,
                name: b.name
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
            
            // Run credit card sign migration
            await migrateCreditCardTransactionSigns(appState.appData.transactions);
            
            // Build data indexes for fast lookups
            dataIndex.rebuildIndexes(appState.appData);
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

    // Function to check email verification status
    function checkEmailVerification() {
        if (!supabaseAuth.isAuthenticated()) return;
        
        if (!supabaseAuth.isEmailVerified()) {
            // Create verification banner
            const banner = document.createElement('div');
            banner.id = 'email-verification-banner';
            banner.className = 'verification-banner';
            banner.innerHTML = `
                <div class="verification-content">
                    <span class="verification-icon">⚠️</span>
                    <span class="verification-text">Please verify your email address. Check your inbox for a verification link.</span>
                    <button id="resend-verification" class="btn btn--small">Resend Email</button>
                </div>
            `;
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .verification-banner {
                    background: var(--color-warning, #FFA500);
                    color: white;
                    padding: 12px 20px;
                    text-align: center;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                
                .verification-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                .verification-icon {
                    font-size: 20px;
                }
                
                .verification-text {
                    flex: 1;
                    font-size: 14px;
                }
                
                #resend-verification {
                    background: white;
                    color: var(--color-warning, #FFA500);
                    border: none;
                    padding: 6px 16px;
                    font-size: 13px;
                    font-weight: 500;
                }
                
                #resend-verification:hover {
                    background: rgba(255, 255, 255, 0.9);
                }
                
                @media (max-width: 768px) {
                    .verification-content {
                        flex-wrap: wrap;
                        text-align: center;
                    }
                    
                    .verification-text {
                        width: 100%;
                        margin-bottom: 8px;
                    }
                }
            `;
            document.head.appendChild(style);
            
            // Insert banner at the top of the body
            document.body.insertBefore(banner, document.body.firstChild);
            
            // Add resend handler
            const resendBtn = document.getElementById('resend-verification');
            if (resendBtn) {
                eventManager.addEventListener(resendBtn, 'click', async () => {
                    const btn = document.getElementById('resend-verification');
                    const originalText = btn.textContent;
                    btn.disabled = true;
                    btn.textContent = 'Sending...';
                    
                    try {
                        const result = await supabaseAuth.resendVerificationEmail();
                        
                        if (!result.success) throw new Error(result.message);
                        
                        btn.textContent = 'Email Sent!';
                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.disabled = false;
                        }, 3000);
                    } catch (error) {
                        debug.error('Failed to resend verification email:', error);
                        btn.textContent = 'Failed';
                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.disabled = false;
                        }, 3000);
                    }
                });
            }
        }
    }

    // Function to add user info and logout button to header
    function addUserInfoToHeader() {
        const userEmailEl = document.getElementById('user-email');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (!userEmailEl) return;
        
        const user = supabaseAuth.getUser();
        if (!user) return;
        
        // Update user email display
        userEmailEl.textContent = user.email;
        
        // Setup logout button if it exists
        if (logoutBtn) {
            eventManager.addEventListener(logoutBtn, 'click', async () => {
                try {
                    await supabaseAuth.logout();
                    window.location.reload();
                } catch (error) {
                    showError('Failed to logout: ' + error.message);
                }
            });
        }
        
        // Add logout handler
        const logoutButton = document.getElementById('logout-btn');
        if (logoutButton) {
            eventManager.addEventListener(logoutButton, 'click', () => {
                if (confirm('Are you sure you want to logout?')) {
                    supabaseAuth.logout();
                }
            });
        }
    }

    // Optimized account balance calculation with better data structures
    function calculateAccountBalances() {
        appState.balanceCache.clear();

        // Create a map for O(1) balance updates
        const balanceMap = new Map();
        
        // Initialize all accounts with 0 balance
        appState.appData.cashAccounts.forEach(account => {
            balanceMap.set(account.id, 0);
        });

        // Single pass through transactions to calculate balances
        appState.appData.transactions.forEach(transaction => {
            if (transaction.account_id && balanceMap.has(transaction.account_id)) {
                const currentBalance = balanceMap.get(transaction.account_id);
                balanceMap.set(transaction.account_id, currentBalance + transaction.amount);
            }
        });

        // Update accounts and cache
        appState.appData.cashAccounts.forEach(account => {
            const balance = balanceMap.get(account.id) || 0;
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
            // Recalculate account balances for cash accounts
            calculateAccountBalances();
            
            // Rebuild data indexes for fast lookups
            dataIndex.rebuildIndexes(appState.appData);
            
            // Clear KPI cache when data is updated
            import('./modules/kpis.js')
                .then(kpis => kpis.clearKPICache())
                .catch(error => debug.error('Failed to clear KPI cache:', error));
            updateAllDisplays(appState);
            
            // Update voice interface with new app state
            if (globalVoiceInterface) {
                globalVoiceInterface.updateAppState(appState);
            }
        };

        // Prevent unwanted scrolling on body clicks
        eventManager.addEventListener(document, 'click', (e) => {
            // If clicking on body or non-interactive elements
            if (e.target === document.body || 
                (!e.target.closest('button, a, input, select, textarea, [role="button"], .clickable, label'))) {
                e.preventDefault();
                // Keep focus on current element or blur
                if (document.activeElement && document.activeElement !== document.body) {
                    document.activeElement.blur();
                }
            }
        }, true);

        document.querySelectorAll(".tab-btn").forEach(button => {
            eventManager.addEventListener(button, "click", function () { 
                switchTab(this.getAttribute("data-tab"), appState); 
            });
        });
        
        // Add voice button event listener
        const voiceBtn = document.getElementById('voice-command-btn');
        if (voiceBtn) {
            eventManager.addEventListener(voiceBtn, 'click', () => {
                if (window.globalVoiceInterface) {
                    window.globalVoiceInterface.handleVoiceButtonClick();
                } else {
                    showError('Voice commands are not available');
                }
            });
        }
        
        // Initialize time settings UI
        initializeTimeSettings();
        
        // Initialize transaction time preview
        initializeTransactionTimePreview();
        
        // Expose timeBudgets globally for debugging (only in development)
        if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
            window.timeBudgets = timeBudgets;
            debug.log('TimeBudgets exposed globally for debugging');
        }

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
        
        // Setup privacy mode event listeners
        const privacyToggleBtn = document.getElementById('privacy-toggle-btn');
        if (privacyToggleBtn) {
            eventManager.addEventListener(privacyToggleBtn, 'click', async () => {
                await togglePrivacyMode();
            });
        }
        
        const panicButton = document.getElementById('panic-button');
        if (panicButton) {
            eventManager.addEventListener(panicButton, 'click', () => {
                enablePanicMode();
            });
        }
        
        // Listen for transaction events to refresh UI
        eventManager.addEventListener(window, 'transaction:added', onUpdate);
        
        // Special handling for transaction:updated to sync local state
        eventManager.addEventListener(window, 'transaction:updated', (event) => {
            if (event.detail && event.detail.transaction) {
                // Update the transaction in local app state
                const updatedTransaction = event.detail.transaction;
                const index = appState.appData.transactions.findIndex(t => t.id === updatedTransaction.id);
                
                if (index !== -1) {
                    // Update the transaction in the array
                    appState.appData.transactions[index] = {
                        ...updatedTransaction,
                        amount: parseFloat(updatedTransaction.amount)
                    };
                    debug.log('Updated transaction in app state:', updatedTransaction.id);
                } else {
                    debug.warn('Transaction not found in app state:', updatedTransaction.id);
                }
            }
            
            // Now refresh the UI with the updated data
            onUpdate();
        });
        
        eventManager.addEventListener(window, 'transaction:deleted', onUpdate);
        
        // Listen for bulk transaction events and reload data from database
        const onBulkUpdate = async () => {
            // Reload all data from database to sync with bulk changes
            await loadAllData();
            onUpdate();
        };
        
        eventManager.addEventListener(window, 'transactions:batchAdded', onBulkUpdate);
        eventManager.addEventListener(window, 'transactions:batchUpdated', onBulkUpdate);
        eventManager.addEventListener(window, 'transactions:batchDeleted', onBulkUpdate);
        
        // Add privacy listener to reapply on data updates
        privacyManager.addListener(() => {
            // First, reapply privacy mode to blur/unblur elements
            reapplyPrivacy();
            
            // Then refresh charts with a single delay to ensure privacy state is propagated
            setTimeout(() => {
                const currentPrivacyMode = isPrivacyMode();
                
                // Get the current active tab
                const activeTab = document.querySelector('.tab-content.active');
                const activeTabId = activeTab ? activeTab.id : 'dashboard';
                
                // Refresh charts based on active tab
                if (activeTabId === 'dashboard') {
                    createCharts(appState);
                } else if (activeTabId === 'debt' && window.updateDebtCharts) {
                    window.updateDebtCharts(appState);
                } else if (activeTabId === 'investments' && window.lastInvestmentData && window.lastInvestmentChartType) {
                    window.updateInvestmentCharts(window.lastInvestmentData, window.lastInvestmentChartType);
                } else if (activeTabId === 'sankey' && window.cashFlowSankey) {
                    window.cashFlowSankey.togglePrivacy();
                }
            }, 250); // Chart refresh delay - kept at 250ms for stability
        });
    }

    // This function just re-renders the components with the current state.
    // Optimized to only update visible content
    async function updateAllDisplays(state, options = {}) {
        const { forceAll = false, specificUpdate = null } = options;
        
        // Track what needs updating
        const updates = {
            dashboard: false,
            dropdowns: false,
            activeTab: true
        };
        
        // If specific update requested, only do that
        if (specificUpdate) {
            switch (specificUpdate) {
                case 'dashboard':
                    updateDashboard(state);
                    return;
                case 'accounts':
                    Accounts.renderCashAccounts(state);
                    Accounts.populateAccountDropdowns(state.appData);
                    return;
                case 'transactions':
                    Transactions.renderTransactions(state);
                    return;
                case 'charts':
                    createCharts(state);
                    return;
            }
        }
        
        // Always update dashboard metrics and dropdowns as they're lightweight
        updateDashboard(state);
        Accounts.populateAccountDropdowns(state.appData);
        Debt.populateDebtAccountDropdown(state.appData);
        
        // Get the current active tab
        const activeTab = document.querySelector('.tab-content.active');
        const activeTabId = activeTab ? activeTab.id : 'dashboard';
        
        // If forcing all updates or no active tab, update everything
        if (forceAll || !activeTab) {
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

            createCharts(state);
        } else {
            // Only update content for the active tab
            switch (activeTabId) {
                case 'dashboard':
                    createCharts(state);
                    break;
                case 'accounts':
                    const cashList = document.getElementById("cash-accounts-list");
                    if (cashList) Accounts.renderCashAccounts(state);
                    break;
                case 'transactions':
                    Transactions.renderTransactions(state);
                    break;
                case 'investments':
                    const investmentsList = document.getElementById("investment-accounts-list");
                    if (investmentsList) Investments.renderInvestmentAccountsEnhanced(state);
                    const savingsList = document.getElementById("savings-goals-list");
                    if (savingsList) Savings.renderSavingsGoals(state);
                    break;
                case 'debt':
                    const debtList = document.getElementById("debt-accounts-list");
                    if (debtList) Debt.renderDebtAccounts(state);
                    if (window.updateDebtCharts) {
                        window.updateDebtCharts(state);
                    }
                    break;
                case 'recurring':
                    const recurringList = document.getElementById("all-recurring-bills-list");
                    if (recurringList) Recurring.renderRecurringBills(state);
                    break;
                case 'sankey':
                    if (window.cashFlowSankey) {
                        window.cashFlowSankey.init();
                    }
                    break;
                case 'rules':
                    // Rules UI manages its own rendering
                    break;
            }
            
            // Handle specific updates if requested
            if (specificUpdate) {
                switch (specificUpdate) {
                    case 'transactions':
                        Transactions.renderTransactions(state);
                        break;
                    case 'accounts':
                        const cashList = document.getElementById("cash-accounts-list");
                        if (cashList) Accounts.renderCashAccounts(state);
                        break;
                    // Add more specific update cases as needed
                }
            }
        }
        
        // Reapply privacy mode after all updates
        reapplyPrivacy();
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
    
    async function migrateCreditCardTransactionSigns(transactions) {
        // One-time migration to fix credit card transaction signs
        // This ensures all expenses are negative and all payments are positive
        const db = (await import('./database.js')).default;
        const migrationKey = 'creditCardSignMigration_v1';
        
        // Check if migration has already been run
        if (localStorage.getItem(migrationKey) === 'completed') {
            return;
        }
        
        debug.log('Running credit card transaction sign migration...');
        
        // Find all credit card transactions that need sign adjustment
        const ccTransactions = transactions.filter(t => t.debt_account_id && !t.account_id);
        let migratedCount = 0;
        
        for (const t of ccTransactions) {
            let needsUpdate = false;
            let newAmount = t.amount;
            
            // If it's a positive amount (old system: debt increase), make it negative (expense)
            if (t.amount > 0) {
                newAmount = -Math.abs(t.amount);
                needsUpdate = true;
            }
            // If it's a negative amount (old system: payment), make it positive
            else if (t.amount < 0) {
                newAmount = Math.abs(t.amount);
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                t.amount = newAmount;
                await db.updateTransaction(t.id, { amount: newAmount });
                migratedCount++;
            }
        }
        
        // Mark migration as completed
        localStorage.setItem(migrationKey, 'completed');
        debug.log(`Credit card sign migration completed. Updated ${migratedCount} transactions.`);
    }
    
    // Export cleanup function for testing and memory management
    window.cleanupApp = () => {
        debug.log('Starting app cleanup...');
        
        // Remove all event listeners
        eventManager.removeAllListeners();
        
        // Call module cleanup functions if they exist
        if (typeof Accounts.cleanup === 'function') Accounts.cleanup();
        if (typeof Transactions.cleanup === 'function') Transactions.cleanup();
        if (typeof Investments.cleanup === 'function') Investments.cleanup();
        if (typeof Debt.cleanup === 'function') Debt.cleanup();
        if (typeof Recurring.cleanup === 'function') Recurring.cleanup();
        if (typeof Savings.cleanup === 'function') Savings.cleanup();
        
        // Clear app state
        appState.appData = {
            transactions: [],
            cashAccounts: [],
            investmentAccounts: [],
            debtAccounts: [],
            recurringBills: [],
            savingsGoals: []
        };
        appState.balanceCache.clear();
        
        debug.log('App cleanup completed');
    };
})(); // Close the async IIFE