// js/modules/voice/voiceAnalytics.js - Voice-Activated Financial Analytics

import { debug } from '../debug.js';
import { formatCurrency, formatDate } from '../utils.js';
import { addMoney, subtractMoney, sumMoney } from '../financialMath.js';
import * as KPIs from '../kpis.js';
import DateParser from './utils/dateParser.js';
import FinancialCalculations from './utils/financialCalcs.js';

/**
 * Voice Analytics Engine - Processes financial queries and returns data
 */
export class VoiceAnalytics {
    constructor(appState) {
        this.appState = appState;
        this.initializeQueryHandlers();
    }

    /**
     * Initialize query handlers for different intent types
     */
    initializeQueryHandlers() {
        this.queryHandlers = {
            'query.balance': this.handleBalanceQuery.bind(this),
            'query.networth': this.handleNetWorthQuery.bind(this),
            'query.debt': this.handleDebtQuery.bind(this),
            'query.investments': this.handleInvestmentQuery.bind(this),
            'query.spending': this.handleSpendingQuery.bind(this),
            'query.merchant_spending': this.handleMerchantSpendingQuery.bind(this),
            'query.health': this.handleHealthQuery.bind(this),
            'query.savings_rate': this.handleSavingsRateQuery.bind(this),
            
            // New query handlers
            'query.trends': this.handleTrendQuery.bind(this),
            'query.expense_increase': this.handleExpenseIncreaseQuery.bind(this),
            'query.time_spending': this.handleTimeSpendingQuery.bind(this),
            'query.bills_due': this.handleBillsDueQuery.bind(this),
            'query.overdue_bills': this.handleOverdueBillsQuery.bind(this),
            'query.cheapest_bill': this.handleCheapestBillQuery.bind(this),
            'query.debt_payoff': this.handleDebtPayoffQuery.bind(this),
            'query.highest_interest': this.handleHighestInterestQuery.bind(this),
            'query.monthly_interest': this.handleMonthlyInterestQuery.bind(this),
            'query.credit_utilization': this.handleCreditUtilizationQuery.bind(this),
            'query.debt_strategy': this.handleDebtStrategyQuery.bind(this),
            'query.goal_progress': this.handleGoalProgressQuery.bind(this),
            'query.goal_remaining': this.handleGoalRemainingQuery.bind(this),
            'query.portfolio_return': this.handlePortfolioReturnQuery.bind(this),
            'query.investment_performance': this.handleInvestmentPerformanceQuery.bind(this),
            'query.find_transactions': this.handleFindTransactionsQuery.bind(this),
            'query.recurring_charges': this.handleRecurringChargesQuery.bind(this),
            'query.top_spending': this.handleTopSpendingQuery.bind(this),
            
            // Enhanced Natural Language Query handlers
            'query.goal_timeline': this.handleGoalTimelineQuery.bind(this),
            'query.emergency_fund': this.handleEmergencyFundQuery.bind(this),
            'query.highest_category': this.handleHighestCategoryQuery.bind(this),
            'query.comparative_spending': this.handleComparativeSpendingQuery.bind(this),
            'query.balance_forecast': this.handleBalanceForecastQuery.bind(this),
            'query.spending_forecast': this.handleSpendingForecastQuery.bind(this),
            'query.debt_freedom': this.handleDebtFreedomQuery.bind(this),
            'query.anomaly_detection': this.handleAnomalyDetectionQuery.bind(this)
        };
    }

    /**
     * Process a financial query and return results
     */
    async processQuery(intent, parameters = {}) {
        debug.log('Processing voice query:', intent, parameters);

        try {
            const handler = this.queryHandlers[intent];
            if (!handler) {
                return this.createErrorResponse(`Query type "${intent}" not supported`);
            }

            const result = await handler(parameters);
            debug.log('Query result:', result);
            return result;

        } catch (error) {
            debug.error('Error processing voice query:', error);
            return this.createErrorResponse('Failed to process query');
        }
    }

    /**
     * Handle balance queries
     */
    async handleBalanceQuery(parameters) {
        const appData = this.appState?.appData || { cashAccounts: [] };
        const totalCash = sumMoney(appData.cashAccounts.map(acc => acc.balance || 0));

        return {
            type: 'balance',
            success: true,
            data: {
                totalCash: totalCash,
                accounts: appData.cashAccounts.map(acc => ({
                    name: acc.name,
                    balance: acc.balance || 0
                }))
            },
            response: {
                text: `Your total cash balance is ${formatCurrency(totalCash)}`,
                title: 'Cash Balance',
                details: `Across ${appData.cashAccounts.length} account${appData.cashAccounts.length !== 1 ? 's' : ''}`
            }
        };
    }

    /**
     * Handle net worth queries
     */
    async handleNetWorthQuery(parameters) {
        const appData = this.appState?.appData || { 
            cashAccounts: [], 
            investmentAccounts: [], 
            debtAccounts: [] 
        };
        
        const totalCash = sumMoney(appData.cashAccounts.map(acc => acc.balance || 0));
        const totalInvestments = sumMoney(appData.investmentAccounts.map(acc => acc.balance || 0));
        const totalDebt = sumMoney(appData.debtAccounts.map(acc => acc.balance || 0));
        const netWorth = addMoney(totalCash, totalInvestments) - totalDebt;

        return {
            type: 'networth',
            success: true,
            data: {
                netWorth: netWorth,
                totalCash: totalCash,
                totalInvestments: totalInvestments,
                totalDebt: totalDebt
            },
            response: {
                text: `Your net worth is ${formatCurrency(netWorth)}`,
                title: 'Net Worth',
                details: `Cash: ${formatCurrency(totalCash)}, Investments: ${formatCurrency(totalInvestments)}, Debt: ${formatCurrency(totalDebt)}`
            }
        };
    }

    /**
     * Handle debt queries
     */
    async handleDebtQuery(parameters) {
        const appData = this.appState?.appData || { debtAccounts: [] };
        const totalDebt = sumMoney(appData.debtAccounts.map(acc => acc.balance || 0));
        const monthlyPayments = sumMoney(appData.debtAccounts.map(acc => acc.minimumPayment || 0));

        return {
            type: 'debt',
            success: true,
            data: {
                totalDebt: totalDebt,
                monthlyPayments: monthlyPayments,
                accounts: appData.debtAccounts.map(acc => ({
                    name: acc.name,
                    balance: acc.balance || 0,
                    minimumPayment: acc.minimumPayment || 0
                }))
            },
            response: {
                text: `You have ${formatCurrency(totalDebt)} in total debt`,
                title: 'Total Debt',
                details: `Monthly payments: ${formatCurrency(monthlyPayments)} across ${appData.debtAccounts.length} account${appData.debtAccounts.length !== 1 ? 's' : ''}`
            }
        };
    }

    /**
     * Handle investment queries
     */
    async handleInvestmentQuery(parameters) {
        const appData = this.appState?.appData || { investmentAccounts: [] };
        const totalInvestments = sumMoney(appData.investmentAccounts.map(acc => acc.balance || 0));
        
        // Calculate total day change if available
        const totalDayChange = sumMoney(
            appData.investmentAccounts
                .filter(acc => acc.dayChange !== undefined)
                .map(acc => acc.dayChange || 0)
        );

        return {
            type: 'investments',
            success: true,
            data: {
                totalValue: totalInvestments,
                totalDayChange: totalDayChange,
                accounts: appData.investmentAccounts.map(acc => ({
                    name: acc.name,
                    balance: acc.balance || 0,
                    dayChange: acc.dayChange || 0
                }))
            },
            response: {
                text: `Your investments are worth ${formatCurrency(totalInvestments)}`,
                title: 'Investment Portfolio',
                details: totalDayChange !== 0 ? 
                    `Day change: ${totalDayChange > 0 ? '+' : ''}${formatCurrency(totalDayChange)}` :
                    `Across ${appData.investmentAccounts.length} account${appData.investmentAccounts.length !== 1 ? 's' : ''}`
            }
        };
    }

    /**
     * Handle spending queries by category
     */
    async handleSpendingQuery(parameters) {
        const { category, timePeriod = 'current' } = parameters;
        const appData = this.appState?.appData || { transactions: [] };

        const timeRange = this.getTimeRange(timePeriod);
        const filteredTransactions = this.filterTransactionsByTimeAndCategory(
            appData.transactions, 
            timeRange, 
            category
        );

        const totalSpent = Math.abs(sumMoney(
            filteredTransactions
                .filter(t => t.amount < 0) // Only expenses
                .map(t => t.amount)
        ));

        const transactionCount = filteredTransactions.length;

        return {
            type: 'spending',
            success: true,
            data: {
                category: category,
                timePeriod: timePeriod,
                totalSpent: totalSpent,
                transactionCount: transactionCount,
                transactions: filteredTransactions.slice(0, 5) // Latest 5 transactions
            },
            response: {
                text: `You spent ${formatCurrency(totalSpent)} on ${category || 'expenses'} ${this.formatTimePeriod(timePeriod)}`,
                title: `${category || 'Spending'} Analysis`,
                details: `${transactionCount} transaction${transactionCount !== 1 ? 's' : ''} ${this.formatTimePeriod(timePeriod)}`
            }
        };
    }

    /**
     * Handle merchant spending queries
     */
    async handleMerchantSpendingQuery(parameters) {
        const { merchant, timePeriod = 'current' } = parameters;
        const appData = this.appState?.appData || { transactions: [] };

        const timeRange = this.getTimeRange(timePeriod);
        const filteredTransactions = appData.transactions.filter(t => {
            const matchesTime = this.isTransactionInTimeRange(t, timeRange);
            const matchesMerchant = merchant ? 
                t.description.toLowerCase().includes(merchant.toLowerCase()) : true;
            return matchesTime && matchesMerchant && t.amount < 0; // Only expenses
        });

        const totalSpent = Math.abs(sumMoney(filteredTransactions.map(t => t.amount)));
        const transactionCount = filteredTransactions.length;

        return {
            type: 'merchant_spending',
            success: true,
            data: {
                merchant: merchant,
                timePeriod: timePeriod,
                totalSpent: totalSpent,
                transactionCount: transactionCount,
                transactions: filteredTransactions.slice(0, 5)
            },
            response: {
                text: merchant ? 
                    `You spent ${formatCurrency(totalSpent)} at ${merchant} ${this.formatTimePeriod(timePeriod)}` :
                    `Total spending ${this.formatTimePeriod(timePeriod)}: ${formatCurrency(totalSpent)}`,
                title: merchant ? `${merchant} Spending` : 'Spending Analysis',
                details: `${transactionCount} transaction${transactionCount !== 1 ? 's' : ''} ${this.formatTimePeriod(timePeriod)}`
            }
        };
    }

    /**
     * Handle financial health queries
     */
    async handleHealthQuery(parameters) {
        const appData = this.appState?.appData || { 
            cashAccounts: [], 
            investmentAccounts: [], 
            debtAccounts: [],
            transactions: []
        };

        try {
            const emergencyRatio = KPIs.calculateEmergencyFundRatio(appData);
            const dti = KPIs.calculateDebtToIncomeRatio(appData);
            const savingsRate = KPIs.calculateSavingsRate(appData);
            const healthScore = KPIs.calculateOverallHealthScore({ emergencyRatio, dti, savingsRate });

            return {
                type: 'health',
                success: true,
                data: {
                    healthScore: healthScore,
                    emergencyRatio: emergencyRatio,
                    debtToIncome: dti,
                    savingsRate: savingsRate
                },
                response: {
                    text: `Your financial health score is ${healthScore.score} (${healthScore.status})`,
                    title: 'Financial Health',
                    details: `Savings rate: ${savingsRate.toFixed(1)}%, Emergency fund: ${isFinite(emergencyRatio) ? emergencyRatio.toFixed(1) + ' months' : 'N/A'}`
                }
            };
        } catch (error) {
            debug.error('Error calculating health metrics:', error);
            return this.createErrorResponse('Unable to calculate financial health metrics');
        }
    }

    /**
     * Handle savings rate queries
     */
    async handleSavingsRateQuery(parameters) {
        const appData = this.appState?.appData || { 
            cashAccounts: [], 
            investmentAccounts: [], 
            transactions: []
        };

        try {
            const savingsRate = KPIs.calculateSavingsRate(appData);
            
            let interpretation = '';
            if (savingsRate >= 20) interpretation = 'Excellent! You\'re saving well.';
            else if (savingsRate >= 10) interpretation = 'Good savings rate.';
            else if (savingsRate >= 5) interpretation = 'Room for improvement.';
            else interpretation = 'Consider increasing your savings.';

            return {
                type: 'savings_rate',
                success: true,
                data: {
                    savingsRate: savingsRate,
                    interpretation: interpretation
                },
                response: {
                    text: `Your savings rate is ${savingsRate.toFixed(1)}%`,
                    title: 'Savings Rate',
                    details: interpretation
                }
            };
        } catch (error) {
            debug.error('Error calculating savings rate:', error);
            return this.createErrorResponse('Unable to calculate savings rate');
        }
    }

    /**
     * Get time range for filtering
     */
    getTimeRange(timePeriod) {
        const now = new Date();
        const ranges = {
            'this month': {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
            },
            'last month': {
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                end: new Date(now.getFullYear(), now.getMonth(), 0)
            },
            'this week': {
                start: new Date(now.setDate(now.getDate() - now.getDay())),
                end: new Date(now.setDate(now.getDate() - now.getDay() + 6))
            },
            'this year': {
                start: new Date(now.getFullYear(), 0, 1),
                end: new Date(now.getFullYear(), 11, 31)
            },
            'current': {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
            }
        };

        return ranges[timePeriod] || ranges['current'];
    }

    /**
     * Filter transactions by time range and category
     */
    filterTransactionsByTimeAndCategory(transactions, timeRange, category) {
        return transactions.filter(t => {
            const matchesTime = this.isTransactionInTimeRange(t, timeRange);
            const matchesCategory = category ? 
                t.category.toLowerCase() === category.toLowerCase() : true;
            return matchesTime && matchesCategory;
        });
    }

    /**
     * Check if transaction is in time range
     */
    isTransactionInTimeRange(transaction, timeRange) {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= timeRange.start && transactionDate <= timeRange.end;
    }

    /**
     * Format time period for display
     */
    formatTimePeriod(timePeriod) {
        const formats = {
            'this month': 'this month',
            'last month': 'last month',
            'this week': 'this week',
            'last week': 'last week',
            'this year': 'this year',
            'current': 'this month'
        };

        return formats[timePeriod] || timePeriod;
    }

    /**
     * Create error response
     */
    createErrorResponse(message) {
        return {
            type: 'error',
            success: false,
            error: message,
            response: {
                text: message,
                title: 'Error',
                details: 'Please try rephrasing your question.'
            }
        };
    }

    /**
     * Update app state reference
     */
    updateAppState(newAppState) {
        this.appState = newAppState;
    }

    /**
     * Handle spending trend queries
     */
    async handleTrendQuery(parameters) {
        const appData = this.appState?.appData || { transactions: [] };
        const period = parameters.comparisonPeriod || 'lastMonth';
        
        // Get current and comparison period ranges
        const currentRange = this.getTimeRangeForPeriod('this month');
        const compareRange = this.getTimeRangeForPeriod(period);
        
        // Calculate spending for each period
        const currentSpending = this.calculatePeriodSpending(appData.transactions, currentRange);
        const compareSpending = this.calculatePeriodSpending(appData.transactions, compareRange);
        
        const difference = currentSpending - compareSpending;
        const percentChange = compareSpending > 0 ? (difference / compareSpending) * 100 : 0;
        
        const trend = difference > 0 ? 'more' : 'less';
        const trendText = difference > 0 ? 'increased' : 'decreased';
        
        return {
            type: 'trend',
            success: true,
            data: {
                currentSpending,
                compareSpending,
                difference: Math.abs(difference),
                percentChange: Math.abs(percentChange),
                trend
            },
            response: {
                text: `You're spending ${formatCurrency(Math.abs(difference))} ${trend} this month compared to ${this.formatTimePeriod(period)}. That's a ${Math.abs(percentChange).toFixed(1)}% ${trendText}.`,
                title: 'Spending Trend',
                details: `Current: ${formatCurrency(currentSpending)} | Previous: ${formatCurrency(compareSpending)}`
            }
        };
    }

    /**
     * Handle expense increase queries
     */
    async handleExpenseIncreaseQuery(parameters) {
        const appData = this.appState?.appData || { transactions: [] };
        
        // Get current and last month ranges
        const currentRange = this.getTimeRangeForPeriod('this month');
        const lastRange = this.getTimeRangeForPeriod('last month');
        
        // Group by category and calculate increases
        const categoryIncreases = this.calculateCategoryIncreases(
            appData.transactions, 
            currentRange, 
            lastRange
        );
        
        // Sort by increase amount
        const topIncreases = categoryIncreases
            .filter(cat => cat.increase > 0)
            .sort((a, b) => b.increase - a.increase)
            .slice(0, 5);
        
        if (topIncreases.length === 0) {
            return {
                type: 'expense_increase',
                success: true,
                data: { topIncreases: [] },
                response: {
                    text: 'Good news! You\'re not spending more in any category this month.',
                    title: 'No Expense Increases',
                    details: 'All categories are stable or decreasing'
                }
            };
        }
        
        const biggest = topIncreases[0];
        
        return {
            type: 'expense_increase',
            success: true,
            data: { topIncreases },
            response: {
                text: `Your biggest expense increase is ${biggest.category} with ${formatCurrency(biggest.increase)} more than last month (${biggest.percentChange.toFixed(1)}% increase).`,
                title: 'Expense Increases',
                details: topIncreases.map(cat => 
                    `${cat.category}: +${formatCurrency(cat.increase)}`
                ).join(' | ')
            }
        };
    }

    /**
     * Handle time-based spending queries
     */
    async handleTimeSpendingQuery(parameters) {
        const appData = this.appState?.appData || { transactions: [] };
        const timePeriod = parameters.timePeriod || 'today';
        
        // Get time range for specified period
        const timeRange = this.getTimeRangeForPeriod(timePeriod);
        
        // Filter transactions for time period
        const periodTransactions = appData.transactions.filter(t => 
            this.isTransactionInTimeRange(t, timeRange) && t.amount < 0
        );
        
        const totalSpent = Math.abs(sumMoney(periodTransactions.map(t => t.amount)));
        const transactionCount = periodTransactions.length;
        
        return {
            type: 'time_spending',
            success: true,
            data: {
                totalSpent,
                transactionCount,
                transactions: periodTransactions
            },
            response: {
                text: `You spent ${formatCurrency(totalSpent)} ${this.formatTimePeriod(timePeriod)} across ${transactionCount} transaction${transactionCount !== 1 ? 's' : ''}.`,
                title: `${this.formatTimePeriod(timePeriod)}'s Spending`,
                details: transactionCount > 0 ? 
                    `Average: ${formatCurrency(totalSpent / transactionCount)}` : 
                    'No transactions'
            }
        };
    }

    /**
     * Handle bills due queries
     */
    async handleBillsDueQuery(parameters) {
        const appData = this.appState?.appData || { recurringBills: [] };
        const timePeriod = parameters.timePeriod || 'this week';
        
        // Get time range
        const timeRange = this.getTimeRangeForPeriod(timePeriod);
        
        // Filter bills due in period
        const dueBills = appData.recurringBills.filter(bill => {
            if (!bill.active || !bill.next_due) return false;
            const dueDate = new Date(bill.next_due);
            return dueDate >= timeRange.start && dueDate <= timeRange.end;
        });
        
        // Sort by due date
        dueBills.sort((a, b) => new Date(a.next_due) - new Date(b.next_due));
        
        const totalDue = sumMoney(dueBills.map(bill => bill.amount));
        
        return {
            type: 'bills_due',
            success: true,
            data: {
                bills: dueBills,
                totalDue,
                count: dueBills.length
            },
            response: {
                text: dueBills.length > 0 ?
                    `You have ${dueBills.length} bill${dueBills.length !== 1 ? 's' : ''} due ${this.formatTimePeriod(timePeriod)} totaling ${formatCurrency(totalDue)}.` :
                    `No bills due ${this.formatTimePeriod(timePeriod)}.`,
                title: 'Upcoming Bills',
                details: dueBills.length > 0 ?
                    dueBills.slice(0, 3).map(bill => 
                        `${bill.name}: ${formatCurrency(bill.amount)} on ${formatDate(new Date(bill.next_due))}`
                    ).join(' | ') :
                    'All clear!'
            }
        };
    }

    /**
     * Handle overdue bills queries
     */
    async handleOverdueBillsQuery(parameters) {
        const appData = this.appState?.appData || { recurringBills: [] };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Find overdue bills
        const overdueBills = appData.recurringBills.filter(bill => {
            if (!bill.active || !bill.next_due) return false;
            const dueDate = new Date(bill.next_due);
            return dueDate < today;
        });
        
        const totalOverdue = sumMoney(overdueBills.map(bill => bill.amount));
        
        return {
            type: 'overdue_bills',
            success: true,
            data: {
                bills: overdueBills,
                totalOverdue,
                count: overdueBills.length
            },
            response: {
                text: overdueBills.length > 0 ?
                    `You have ${overdueBills.length} overdue bill${overdueBills.length !== 1 ? 's' : ''} totaling ${formatCurrency(totalOverdue)}.` :
                    'Great! No overdue bills.',
                title: 'Overdue Bills',
                details: overdueBills.length > 0 ?
                    overdueBills.map(bill => 
                        `${bill.name}: ${formatCurrency(bill.amount)}`
                    ).join(' | ') :
                    'All bills are current'
            }
        };
    }

    /**
     * Handle cheapest bill query
     */
    async handleCheapestBillQuery(parameters) {
        const appData = this.appState?.appData || { recurringBills: [] };
        
        // Filter active bills and sort by amount
        const activeBills = appData.recurringBills.filter(bill => bill.active);
        
        if (activeBills.length === 0) {
            return {
                type: 'cheapest_bill',
                success: true,
                data: {},
                response: {
                    text: 'You have no active recurring bills.',
                    title: 'No Bills Found',
                    details: 'No active recurring bills'
                }
            };
        }
        
        // Sort by amount ascending
        activeBills.sort((a, b) => a.amount - b.amount);
        const cheapest = activeBills[0];
        
        return {
            type: 'cheapest_bill',
            success: true,
            data: { bill: cheapest },
            response: {
                text: `Your cheapest recurring bill is ${cheapest.name} at ${formatCurrency(cheapest.amount)} per ${cheapest.frequency}.`,
                title: 'Cheapest Bill',
                details: `Due: ${cheapest.next_due ? formatDate(new Date(cheapest.next_due)) : 'Not set'}`
            }
        };
    }

    /**
     * Calculate spending for a period
     */
    calculatePeriodSpending(transactions, timeRange) {
        const expenses = transactions.filter(t => 
            this.isTransactionInTimeRange(t, timeRange) && 
            t.amount < 0 &&
            t.category !== 'Transfer'
        );
        return Math.abs(sumMoney(expenses.map(t => t.amount)));
    }

    /**
     * Calculate category increases between periods
     */
    calculateCategoryIncreases(transactions, currentRange, compareRange) {
        const currentByCategory = {};
        const compareByCategory = {};
        
        // Group current period by category
        transactions.forEach(t => {
            if (this.isTransactionInTimeRange(t, currentRange) && t.amount < 0) {
                currentByCategory[t.category] = (currentByCategory[t.category] || 0) + Math.abs(t.amount);
            }
        });
        
        // Group comparison period by category
        transactions.forEach(t => {
            if (this.isTransactionInTimeRange(t, compareRange) && t.amount < 0) {
                compareByCategory[t.category] = (compareByCategory[t.category] || 0) + Math.abs(t.amount);
            }
        });
        
        // Calculate increases
        const increases = [];
        for (const category in currentByCategory) {
            const current = currentByCategory[category];
            const previous = compareByCategory[category] || 0;
            const increase = current - previous;
            const percentChange = previous > 0 ? (increase / previous) * 100 : 100;
            
            increases.push({
                category,
                current,
                previous,
                increase,
                percentChange
            });
        }
        
        return increases;
    }

    /**
     * Get time range for specific period
     */
    getTimeRangeForPeriod(period) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const ranges = {
            'today': {
                start: today,
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
            },
            'yesterday': {
                start: new Date(today.getTime() - 24 * 60 * 60 * 1000),
                end: new Date(today.getTime() - 1)
            },
            'this week': {
                start: new Date(today.setDate(today.getDate() - today.getDay())),
                end: new Date(today.setDate(today.getDate() - today.getDay() + 6))
            },
            'last weekend': {
                start: new Date(today.setDate(today.getDate() - today.getDay() - 2)),
                end: new Date(today.setDate(today.getDate() - today.getDay()))
            },
            'tomorrow': {
                start: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                end: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 - 1)
            },
            'next week': {
                start: new Date(today.setDate(today.getDate() - today.getDay() + 7)),
                end: new Date(today.setDate(today.getDate() - today.getDay() + 13))
            },
            'this month': {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
            },
            'last month': {
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                end: new Date(now.getFullYear(), now.getMonth(), 0)
            },
            'lastMonth': { // alias
                start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
                end: new Date(now.getFullYear(), now.getMonth(), 0)
            },
            'year to date': {
                start: new Date(now.getFullYear(), 0, 1),
                end: now
            }
        };
        
        return ranges[period] || ranges['today'];
    }

    /**
     * Handle debt payoff queries
     */
    async handleDebtPayoffQuery(parameters) {
        const appData = this.appState?.appData || { debtAccounts: [] };
        const debtName = parameters.debtName;
        
        if (!debtName) {
            return this.createErrorResponse('Please specify which debt you want to check.');
        }
        
        // Find matching debt account
        const debt = appData.debtAccounts.find(d => 
            d.name.toLowerCase().includes(debtName.toLowerCase())
        );
        
        if (!debt) {
            return this.createErrorResponse(`Could not find debt account "${debtName}".`);
        }
        
        // Calculate payoff timeline
        if (!debt.minimumPayment || debt.minimumPayment <= 0) {
            return {
                type: 'debt_payoff',
                success: true,
                data: { debt, payoffMonths: null },
                response: {
                    text: `${debt.name} has no minimum payment set. Cannot calculate payoff date.`,
                    title: 'Debt Payoff',
                    details: `Balance: ${formatCurrency(debt.balance)}`
                }
            };
        }
        
        // Simple payoff calculation (doesn't account for interest)
        const monthsToPayoff = Math.ceil(debt.balance / debt.minimumPayment);
        const payoffDate = new Date();
        payoffDate.setMonth(payoffDate.getMonth() + monthsToPayoff);
        
        return {
            type: 'debt_payoff',
            success: true,
            data: {
                debt,
                monthsToPayoff,
                payoffDate
            },
            response: {
                text: `At ${formatCurrency(debt.minimumPayment)} per month, ${debt.name} will be paid off in ${monthsToPayoff} months (${formatDate(payoffDate)}).`,
                title: 'Debt Payoff Timeline',
                details: `Balance: ${formatCurrency(debt.balance)} | Rate: ${debt.interestRate || 0}%`
            }
        };
    }

    /**
     * Handle highest interest query
     */
    async handleHighestInterestQuery(parameters) {
        const appData = this.appState?.appData || { debtAccounts: [] };
        
        const debtsWithInterest = appData.debtAccounts.filter(d => 
            d.interestRate && d.interestRate > 0 && d.balance > 0
        );
        
        if (debtsWithInterest.length === 0) {
            return {
                type: 'highest_interest',
                success: true,
                data: {},
                response: {
                    text: 'No active debts with interest rates found.',
                    title: 'Highest Interest Debt',
                    details: 'All debts have 0% interest or no balance'
                }
            };
        }
        
        // Sort by interest rate descending
        debtsWithInterest.sort((a, b) => b.interestRate - a.interestRate);
        const highest = debtsWithInterest[0];
        
        return {
            type: 'highest_interest',
            success: true,
            data: { debt: highest, allDebts: debtsWithInterest },
            response: {
                text: `Your highest interest debt is ${highest.name} at ${highest.interestRate}% APR with a balance of ${formatCurrency(highest.balance)}.`,
                title: 'Highest Interest Debt',
                details: debtsWithInterest.length > 1 ? 
                    `Next: ${debtsWithInterest[1].name} at ${debtsWithInterest[1].interestRate}%` : 
                    'This is your only debt with interest'
            }
        };
    }

    /**
     * Handle monthly interest query
     */
    async handleMonthlyInterestQuery(parameters) {
        const appData = this.appState?.appData || { debtAccounts: [] };
        
        // Calculate total monthly interest across all debts
        let totalMonthlyInterest = 0;
        const interestByDebt = [];
        
        appData.debtAccounts.forEach(debt => {
            if (debt.balance > 0 && debt.interestRate > 0) {
                const monthlyRate = debt.interestRate / 100 / 12;
                const monthlyInterest = debt.balance * monthlyRate;
                totalMonthlyInterest += monthlyInterest;
                
                interestByDebt.push({
                    name: debt.name,
                    balance: debt.balance,
                    rate: debt.interestRate,
                    monthlyInterest
                });
            }
        });
        
        if (interestByDebt.length === 0) {
            return {
                type: 'monthly_interest',
                success: true,
                data: { totalMonthlyInterest: 0 },
                response: {
                    text: 'You\'re not paying any interest on your debts.',
                    title: 'Monthly Interest',
                    details: 'All debts have 0% interest or no balance'
                }
            };
        }
        
        // Sort by monthly interest amount
        interestByDebt.sort((a, b) => b.monthlyInterest - a.monthlyInterest);
        
        return {
            type: 'monthly_interest',
            success: true,
            data: {
                totalMonthlyInterest,
                interestByDebt,
                annualInterest: totalMonthlyInterest * 12
            },
            response: {
                text: `You're paying ${formatCurrency(totalMonthlyInterest)} in interest per month across ${interestByDebt.length} debt${interestByDebt.length !== 1 ? 's' : ''}.`,
                title: 'Monthly Interest Charges',
                details: `Annually: ${formatCurrency(totalMonthlyInterest * 12)} | Highest: ${interestByDebt[0].name} (${formatCurrency(interestByDebt[0].monthlyInterest)})`
            }
        };
    }

    /**
     * Handle credit utilization query
     */
    async handleCreditUtilizationQuery(parameters) {
        const appData = this.appState?.appData || { debtAccounts: [] };
        
        // Filter credit cards (have credit limits)
        const creditCards = appData.debtAccounts.filter(d => 
            d.creditLimit && d.creditLimit > 0
        );
        
        if (creditCards.length === 0) {
            return {
                type: 'credit_utilization',
                success: true,
                data: {},
                response: {
                    text: 'No credit cards found to calculate utilization.',
                    title: 'Credit Utilization',
                    details: 'Add credit cards with limits to track utilization'
                }
            };
        }
        
        // Calculate total utilization
        const totalBalance = sumMoney(creditCards.map(cc => cc.balance));
        const totalLimit = sumMoney(creditCards.map(cc => cc.creditLimit));
        const totalUtilization = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0;
        
        // Calculate individual utilizations
        const cardUtilizations = creditCards.map(cc => ({
            name: cc.name,
            balance: cc.balance,
            limit: cc.creditLimit,
            utilization: cc.creditLimit > 0 ? (cc.balance / cc.creditLimit) * 100 : 0
        }));
        
        // Sort by utilization percentage
        cardUtilizations.sort((a, b) => b.utilization - a.utilization);
        
        // Determine health status
        let status = '';
        if (totalUtilization < 10) status = 'Excellent';
        else if (totalUtilization < 30) status = 'Good';
        else if (totalUtilization < 50) status = 'Fair';
        else status = 'Poor';
        
        return {
            type: 'credit_utilization',
            success: true,
            data: {
                totalUtilization,
                totalBalance,
                totalLimit,
                cardUtilizations,
                status
            },
            response: {
                text: `Your total credit utilization is ${totalUtilization.toFixed(1)}% (${status}). You're using ${formatCurrency(totalBalance)} of ${formatCurrency(totalLimit)} available credit.`,
                title: 'Credit Utilization',
                details: cardUtilizations.length > 0 ? 
                    `Highest: ${cardUtilizations[0].name} at ${cardUtilizations[0].utilization.toFixed(1)}%` :
                    'Keep utilization below 30% for best credit score'
            }
        };
    }

    /**
     * Handle debt strategy query
     */
    async handleDebtStrategyQuery(parameters) {
        const appData = this.appState?.appData || { debtAccounts: [] };
        
        const activeDebts = appData.debtAccounts.filter(d => d.balance > 0);
        
        if (activeDebts.length === 0) {
            return {
                type: 'debt_strategy',
                success: true,
                data: {},
                response: {
                    text: 'Congratulations! You have no active debts.',
                    title: 'Debt Strategy',
                    details: 'No debt payoff strategy needed'
                }
            };
        }
        
        // Sort by interest rate (avalanche method) and by balance (snowball method)
        const avalancheOrder = [...activeDebts].sort((a, b) => 
            (b.interestRate || 0) - (a.interestRate || 0)
        );
        
        const snowballOrder = [...activeDebts].sort((a, b) => 
            a.balance - b.balance
        );
        
        // Calculate total monthly interest saved with avalanche
        let totalInterestSaved = 0;
        if (avalancheOrder[0].interestRate > 0) {
            const monthlyRate = avalancheOrder[0].interestRate / 100 / 12;
            totalInterestSaved = avalancheOrder[0].balance * monthlyRate;
        }
        
        // Recommend strategy
        const highestRate = avalancheOrder[0];
        const smallestBalance = snowballOrder[0];
        
        let recommendation = '';
        let strategy = '';
        
        if (highestRate.name === smallestBalance.name) {
            recommendation = `Focus on paying off ${highestRate.name} first - it has both the highest interest rate and smallest balance.`;
            strategy = 'Both methods agree';
        } else if (highestRate.interestRate >= 15) {
            recommendation = `Pay off ${highestRate.name} first (${highestRate.interestRate}% APR). High interest rate costs you ${formatCurrency(totalInterestSaved)} monthly.`;
            strategy = 'Avalanche method (high interest)';
        } else {
            recommendation = `Consider paying off ${smallestBalance.name} first (${formatCurrency(smallestBalance.balance)}). Quick wins can boost motivation.`;
            strategy = 'Snowball method (small balance)';
        }
        
        return {
            type: 'debt_strategy',
            success: true,
            data: {
                avalancheOrder,
                snowballOrder,
                highestRate,
                smallestBalance,
                totalDebts: activeDebts.length
            },
            response: {
                text: recommendation,
                title: 'Debt Payoff Strategy',
                details: `Strategy: ${strategy} | Total debts: ${activeDebts.length}`
            }
        };
    }

    /**
     * Handle goal progress query
     */
    async handleGoalProgressQuery(parameters) {
        const appData = this.appState?.appData || { savingsGoals: [] };
        
        const activeGoals = appData.savingsGoals || [];
        
        if (activeGoals.length === 0) {
            return {
                type: 'goal_progress',
                success: true,
                data: {},
                response: {
                    text: 'You have no savings goals set up.',
                    title: 'Goal Progress',
                    details: 'Create goals to track your savings progress'
                }
            };
        }
        
        // Calculate progress for each goal
        const goalProgress = activeGoals.map(goal => {
            const progress = goal.targetAmount > 0 ? 
                (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const remaining = goal.targetAmount - goal.currentAmount;
            const isOnTrack = goal.targetDate ? 
                this.calculateIfOnTrack(goal) : true;
            
            return {
                name: goal.name,
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                progress,
                remaining,
                targetDate: goal.targetDate,
                isOnTrack
            };
        });
        
        // Sort by progress percentage
        goalProgress.sort((a, b) => b.progress - a.progress);
        
        // Overall summary
        const totalGoals = goalProgress.length;
        const completedGoals = goalProgress.filter(g => g.progress >= 100).length;
        const onTrackGoals = goalProgress.filter(g => g.isOnTrack).length;
        
        return {
            type: 'goal_progress',
            success: true,
            data: {
                goals: goalProgress,
                totalGoals,
                completedGoals,
                onTrackGoals
            },
            response: {
                text: `You have ${totalGoals} goal${totalGoals !== 1 ? 's' : ''}, ${onTrackGoals} on track. ${goalProgress[0].name} is ${goalProgress[0].progress.toFixed(1)}% complete.`,
                title: 'Savings Goals Progress',
                details: completedGoals > 0 ? 
                    `${completedGoals} completed!` : 
                    `Keep saving! ${formatCurrency(goalProgress[0].remaining)} left for ${goalProgress[0].name}`
            }
        };
    }

    /**
     * Handle goal remaining query
     */
    async handleGoalRemainingQuery(parameters) {
        const appData = this.appState?.appData || { savingsGoals: [] };
        const goalName = parameters.goalName;
        
        if (!goalName) {
            return this.createErrorResponse('Please specify which goal you want to check.');
        }
        
        // Find matching goal
        const goal = appData.savingsGoals?.find(g => 
            g.name.toLowerCase().includes(goalName.toLowerCase())
        );
        
        if (!goal) {
            return this.createErrorResponse(`Could not find goal "${goalName}".`);
        }
        
        const remaining = goal.targetAmount - goal.currentAmount;
        const progress = goal.targetAmount > 0 ? 
            (goal.currentAmount / goal.targetAmount) * 100 : 0;
        
        // Calculate monthly savings needed if target date exists
        let monthlyNeeded = null;
        let monthsRemaining = null;
        
        if (goal.targetDate) {
            const today = new Date();
            const target = new Date(goal.targetDate);
            monthsRemaining = Math.max(0, 
                (target.getFullYear() - today.getFullYear()) * 12 + 
                (target.getMonth() - today.getMonth())
            );
            
            if (monthsRemaining > 0 && remaining > 0) {
                monthlyNeeded = remaining / monthsRemaining;
            }
        }
        
        return {
            type: 'goal_remaining',
            success: true,
            data: {
                goal,
                remaining,
                progress,
                monthlyNeeded,
                monthsRemaining
            },
            response: {
                text: remaining > 0 ? 
                    `You need ${formatCurrency(remaining)} more for your ${goal.name} goal (${progress.toFixed(1)}% complete).` :
                    `Congratulations! Your ${goal.name} goal is complete!`,
                title: 'Goal Progress',
                details: monthlyNeeded && monthsRemaining > 0 ? 
                    `Save ${formatCurrency(monthlyNeeded)}/month for ${monthsRemaining} months` : 
                    `Current: ${formatCurrency(goal.currentAmount)} of ${formatCurrency(goal.targetAmount)}`
            }
        };
    }

    /**
     * Calculate if goal is on track
     */
    calculateIfOnTrack(goal) {
        if (!goal.targetDate || goal.currentAmount >= goal.targetAmount) {
            return true;
        }
        
        const today = new Date();
        const startDate = new Date(goal.createdAt || today);
        const targetDate = new Date(goal.targetDate);
        
        const totalDays = (targetDate - startDate) / (1000 * 60 * 60 * 24);
        const daysElapsed = (today - startDate) / (1000 * 60 * 60 * 24);
        const progressExpected = (daysElapsed / totalDays) * 100;
        
        const actualProgress = (goal.currentAmount / goal.targetAmount) * 100;
        
        return actualProgress >= (progressExpected * 0.9); // 10% buffer
    }

    /**
     * Handle portfolio return query
     */
    async handlePortfolioReturnQuery(parameters) {
        const appData = this.appState?.appData || { investmentAccounts: [] };
        
        // Calculate total portfolio value and returns
        let totalValue = 0;
        let totalCostBasis = 0;
        let totalDayChange = 0;
        
        appData.investmentAccounts.forEach(account => {
            totalValue += account.balance || 0;
            totalDayChange += account.dayChange || 0;
            
            // Estimate cost basis (would need actual data in real app)
            // For now, assume 10% gain as placeholder
            totalCostBasis += (account.balance || 0) * 0.9;
        });
        
        const totalReturn = totalValue - totalCostBasis;
        const returnPercentage = totalCostBasis > 0 ? 
            (totalReturn / totalCostBasis) * 100 : 0;
        
        // Calculate YTD performance (simplified)
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        const annualizedReturn = (returnPercentage / dayOfYear) * 365;
        
        return {
            type: 'portfolio_return',
            success: true,
            data: {
                totalValue,
                totalReturn,
                returnPercentage,
                totalDayChange,
                annualizedReturn,
                accountCount: appData.investmentAccounts.length
            },
            response: {
                text: `Your portfolio is ${returnPercentage >= 0 ? 'up' : 'down'} ${Math.abs(returnPercentage).toFixed(1)}% this year, with a total value of ${formatCurrency(totalValue)}.`,
                title: 'Portfolio Performance',
                details: `Today: ${totalDayChange >= 0 ? '+' : ''}${formatCurrency(totalDayChange)} | Total return: ${formatCurrency(totalReturn)}`
            }
        };
    }

    /**
     * Handle investment performance query
     */
    async handleInvestmentPerformanceQuery(parameters) {
        const appData = this.appState?.appData || { investmentAccounts: [] };
        
        // Collect all holdings across accounts
        const allHoldings = [];
        
        appData.investmentAccounts.forEach(account => {
            if (account.holdings) {
                account.holdings.forEach(holding => {
                    allHoldings.push({
                        ...holding,
                        accountName: account.name,
                        percentChange: holding.dayChange && holding.value ? 
                            (holding.dayChange / (holding.value - holding.dayChange)) * 100 : 0
                    });
                });
            }
        });
        
        if (allHoldings.length === 0) {
            return {
                type: 'investment_performance',
                success: true,
                data: {},
                response: {
                    text: 'No individual holdings found in your investment accounts.',
                    title: 'Investment Performance',
                    details: 'Add holdings to track individual performance'
                }
            };
        }
        
        // Sort by day change to find winners and losers
        const sortedByPerformance = [...allHoldings].sort((a, b) => 
            (b.dayChange || 0) - (a.dayChange || 0)
        );
        
        const winners = sortedByPerformance.filter(h => (h.dayChange || 0) > 0);
        const losers = sortedByPerformance.filter(h => (h.dayChange || 0) < 0);
        
        const biggestWinner = winners[0];
        const biggestLoser = losers[losers.length - 1];
        
        return {
            type: 'investment_performance',
            success: true,
            data: {
                holdings: allHoldings,
                winners,
                losers,
                biggestWinner,
                biggestLoser
            },
            response: {
                text: winners.length > 0 && losers.length > 0 ?
                    `${winners.length} holding${winners.length !== 1 ? 's' : ''} up, ${losers.length} down. Best: ${biggestWinner.symbol} (+${formatCurrency(biggestWinner.dayChange)}), Worst: ${biggestLoser.symbol} (${formatCurrency(biggestLoser.dayChange)}).` :
                    winners.length > 0 ?
                    `All ${winners.length} holdings are up! Best performer: ${biggestWinner.symbol} (+${formatCurrency(biggestWinner.dayChange)}).` :
                    `All ${losers.length} holdings are down. Worst: ${biggestLoser.symbol} (${formatCurrency(biggestLoser.dayChange)}).`,
                title: 'Investment Performance',
                details: `Total holdings: ${allHoldings.length} across ${appData.investmentAccounts.length} account${appData.investmentAccounts.length !== 1 ? 's' : ''}`
            }
        };
    }

    /**
     * Handle find transactions query
     */
    async handleFindTransactionsQuery(parameters) {
        const appData = this.appState?.appData || { transactions: [] };
        const searchMerchant = parameters.searchMerchant;
        
        if (!searchMerchant) {
            return this.createErrorResponse('Please specify what transactions to find.');
        }
        
        // Find matching transactions
        const matchingTransactions = appData.transactions.filter(t => 
            t.description.toLowerCase().includes(searchMerchant.toLowerCase())
        );
        
        if (matchingTransactions.length === 0) {
            return {
                type: 'find_transactions',
                success: true,
                data: { transactions: [], searchTerm: searchMerchant },
                response: {
                    text: `No transactions found for "${searchMerchant}".`,
                    title: 'Transaction Search',
                    details: 'Try a different search term'
                }
            };
        }
        
        // Sort by date descending
        matchingTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Calculate total
        const total = Math.abs(sumMoney(matchingTransactions.map(t => t.amount)));
        const count = matchingTransactions.length;
        const latest = matchingTransactions[0];
        
        return {
            type: 'find_transactions',
            success: true,
            data: {
                transactions: matchingTransactions,
                total,
                count,
                searchTerm: searchMerchant
            },
            response: {
                text: `Found ${count} transaction${count !== 1 ? 's' : ''} for "${searchMerchant}" totaling ${formatCurrency(total)}. Latest: ${formatDate(new Date(latest.date))} for ${formatCurrency(Math.abs(latest.amount))}.`,
                title: 'Transaction Search Results',
                details: count > 5 ? `Showing latest 5 of ${count} transactions` : `All ${count} transactions`
            }
        };
    }

    /**
     * Handle recurring charges query
     */
    async handleRecurringChargesQuery(parameters) {
        const appData = this.appState?.appData || { transactions: [], recurringBills: [] };
        
        // First show known recurring bills
        const activeBills = appData.recurringBills.filter(b => b.active !== false);
        
        // Detect potential recurring charges from transactions
        const potentialRecurring = this.detectRecurringCharges(appData.transactions);
        
        // Combine both sources
        const allRecurring = [
            ...activeBills.map(b => ({
                name: b.name,
                amount: b.amount,
                frequency: b.frequency,
                isKnown: true,
                nextDue: b.next_due
            })),
            ...potentialRecurring.filter(p => 
                !activeBills.some(b => 
                    b.name.toLowerCase() === p.merchant.toLowerCase()
                )
            ).map(p => ({
                name: p.merchant,
                amount: p.averageAmount,
                frequency: p.frequency,
                isKnown: false,
                transactionCount: p.count
            }))
        ];
        
        if (allRecurring.length === 0) {
            return {
                type: 'recurring_charges',
                success: true,
                data: {},
                response: {
                    text: 'No recurring charges or subscriptions found.',
                    title: 'Recurring Charges',
                    details: 'Add recurring bills to track subscriptions'
                }
            };
        }
        
        // Calculate total monthly cost
        const totalMonthly = sumMoney(allRecurring.map(r => 
            this.convertToMonthly(r.amount, r.frequency)
        ));
        
        return {
            type: 'recurring_charges',
            success: true,
            data: {
                recurring: allRecurring,
                totalMonthly,
                knownCount: activeBills.length,
                detectedCount: potentialRecurring.length
            },
            response: {
                text: `You have ${allRecurring.length} recurring charge${allRecurring.length !== 1 ? 's' : ''} totaling ${formatCurrency(totalMonthly)} per month.`,
                title: 'Recurring Charges & Subscriptions',
                details: potentialRecurring.length > 0 ? 
                    `${activeBills.length} tracked, ${potentialRecurring.length} detected` : 
                    `${activeBills.length} tracked subscriptions`
            }
        };
    }

    /**
     * Handle top spending query
     */
    async handleTopSpendingQuery(parameters) {
        const appData = this.appState?.appData || { transactions: [] };
        const timeRange = this.getTimeRange('this month');
        
        // Group transactions by merchant
        const merchantSpending = {};
        const categorySpending = {};
        
        appData.transactions.forEach(t => {
            if (this.isTransactionInTimeRange(t, timeRange) && t.amount < 0) {
                const amount = Math.abs(t.amount);
                
                // Group by merchant (simplified - extract from description)
                const merchant = t.description.split(' ')[0]; // Simple extraction
                merchantSpending[merchant] = (merchantSpending[merchant] || 0) + amount;
                
                // Group by category
                categorySpending[t.category] = (categorySpending[t.category] || 0) + amount;
            }
        });
        
        // Convert to arrays and sort
        const topMerchants = Object.entries(merchantSpending)
            .map(([merchant, amount]) => ({ merchant, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
            
        const topCategories = Object.entries(categorySpending)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
        
        if (topMerchants.length === 0) {
            return {
                type: 'top_spending',
                success: true,
                data: {},
                response: {
                    text: 'No spending found for this month.',
                    title: 'Top Spending',
                    details: 'No transactions to analyze'
                }
            };
        }
        
        const topMerchant = topMerchants[0];
        const topCategory = topCategories[0];
        
        return {
            type: 'top_spending',
            success: true,
            data: {
                topMerchants,
                topCategories,
                totalSpending: sumMoney(Object.values(merchantSpending))
            },
            response: {
                text: `Your top merchant is ${topMerchant.merchant} (${formatCurrency(topMerchant.amount)}). Top category: ${topCategory.category} (${formatCurrency(topCategory.amount)}).`,
                title: 'Top Spending This Month',
                details: `${topMerchants.length} merchants, ${topCategories.length} categories`
            }
        };
    }

    /**
     * Detect recurring charges from transaction history
     */
    detectRecurringCharges(transactions) {
        const merchantPatterns = {};
        
        // Group by merchant and analyze patterns
        transactions.forEach(t => {
            if (t.amount < 0) { // Only expenses
                const merchant = t.description.split(' ')[0]; // Simple extraction
                if (!merchantPatterns[merchant]) {
                    merchantPatterns[merchant] = [];
                }
                merchantPatterns[merchant].push({
                    date: new Date(t.date),
                    amount: Math.abs(t.amount)
                });
            }
        });
        
        // Find recurring patterns
        const recurring = [];
        
        for (const [merchant, charges] of Object.entries(merchantPatterns)) {
            if (charges.length >= 3) { // Need at least 3 occurrences
                // Sort by date
                charges.sort((a, b) => a.date - b.date);
                
                // Check if amounts are similar
                const amounts = charges.map(c => c.amount);
                const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
                const variance = amounts.reduce((sum, amt) => sum + Math.abs(amt - avgAmount), 0) / amounts.length;
                
                // If variance is low, likely recurring
                if (variance < avgAmount * 0.1) {
                    // Calculate frequency
                    const daysBetween = [];
                    for (let i = 1; i < charges.length; i++) {
                        const days = (charges[i].date - charges[i-1].date) / (1000 * 60 * 60 * 24);
                        daysBetween.push(days);
                    }
                    
                    const avgDays = daysBetween.reduce((a, b) => a + b, 0) / daysBetween.length;
                    
                    let frequency = 'monthly';
                    if (avgDays < 10) frequency = 'weekly';
                    else if (avgDays > 80) frequency = 'quarterly';
                    else if (avgDays > 350) frequency = 'annually';
                    
                    recurring.push({
                        merchant,
                        averageAmount: avgAmount,
                        frequency,
                        count: charges.length,
                        lastCharge: charges[charges.length - 1].date
                    });
                }
            }
        }
        
        return recurring;
    }

    /**
     * Convert amount to monthly equivalent
     */
    convertToMonthly(amount, frequency) {
        const multipliers = {
            'weekly': 4.33,
            'biweekly': 2.17,
            'monthly': 1,
            'quarterly': 0.33,
            'annually': 0.083
        };
        
        return amount * (multipliers[frequency] || 1);
    }

    /**
     * Get available query types
     */
    getSupportedQueries() {
        return {
            'Balance Queries': [
                'What\'s my balance?',
                'Show total cash',
                'How much money do I have?'
            ],
            'Net Worth Queries': [
                'What\'s my net worth?',
                'Show my total wealth',
                'How much am I worth?'
            ],
            'Debt Queries': [
                'How much debt do I have?',
                'Show my debt',
                'What do I owe?'
            ],
            'Investment Queries': [
                'What are my investments worth?',
                'How are my stocks doing?',
                'Show investment performance'
            ],
            'Spending Queries': [
                'What did I spend on groceries this month?',
                'How much for dining last month?',
                'Show entertainment expenses'
            ],
            'Health Queries': [
                'How\'s my financial health?',
                'What\'s my savings rate?',
                'Show my health score'
            ],
            'Trend Queries': [
                'How\'s my spending trending?',
                'Am I spending more or less?',
                'Compare spending to last month'
            ],
            'Bill Queries': [
                'What bills are due this week?',
                'Show overdue bills',
                'What\'s my cheapest bill?'
            ]
        };
    }

    /**
     * Handle goal timeline query - When will I reach my goal?
     */
    async handleGoalTimelineQuery(parameters) {
        try {
            const appData = this.appState?.appData || {};
            const goals = appData.savingsGoals || [];
            
            if (goals.length === 0) {
                return {
                    type: 'query.goal_timeline',
                    success: false,
                    response: {
                        text: 'You don\'t have any savings goals set up yet.',
                        title: 'No Goals Found'
                    }
                };
            }
            
            // Extract goal name from parameters
            const goalName = parameters.goalName || '';
            const targetGoal = goalName ? 
                goals.find(g => g.name.toLowerCase().includes(goalName.toLowerCase())) :
                goals[0]; // Default to first goal if no name specified
            
            if (!targetGoal) {
                return {
                    type: 'query.goal_timeline',
                    success: false,
                    response: {
                        text: `I couldn't find a goal matching "${goalName}".`,
                        title: 'Goal Not Found'
                    }
                };
            }
            
            // Calculate progress and timeline
            const currentAmount = targetGoal.currentAmount || 0;
            const targetAmount = targetGoal.targetAmount || 0;
            const remaining = targetAmount - currentAmount;
            
            if (remaining <= 0) {
                return {
                    type: 'query.goal_timeline',
                    success: true,
                    response: {
                        text: `Congratulations! You've already reached your ${targetGoal.name} goal!`,
                        title: 'Goal Achieved',
                        emoji: '🎉'
                    }
                };
            }
            
            // Calculate average monthly contribution based on recent history
            const transactions = appData.transactions || [];
            const recentDate = new Date();
            recentDate.setMonth(recentDate.getMonth() - 3);
            
            const recentContributions = transactions.filter(t => 
                new Date(t.date) >= recentDate &&
                t.category === 'Savings' &&
                t.amount > 0
            );
            
            const totalContributions = recentContributions.reduce((sum, t) => sum + t.amount, 0);
            const monthlyAverage = totalContributions / 3;
            
            if (monthlyAverage <= 0) {
                return {
                    type: 'query.goal_timeline',
                    success: true,
                    response: {
                        text: `You need ${formatCurrency(remaining)} more for your ${targetGoal.name} goal. Start saving regularly to reach it!`,
                        title: 'Goal Timeline',
                        details: 'Based on your recent saving history, you haven\'t been contributing to this goal.'
                    }
                };
            }
            
            const monthsToGoal = Math.ceil(remaining / monthlyAverage);
            const targetDate = new Date();
            targetDate.setMonth(targetDate.getMonth() + monthsToGoal);
            
            return {
                type: 'query.goal_timeline',
                success: true,
                data: {
                    goal: targetGoal.name,
                    current: currentAmount,
                    target: targetAmount,
                    remaining: remaining,
                    monthlyAverage: monthlyAverage,
                    monthsToGoal: monthsToGoal,
                    targetDate: targetDate
                },
                response: {
                    text: `At your current savings rate of ${formatCurrency(monthlyAverage)}/month, you'll reach your ${targetGoal.name} goal in ${monthsToGoal} months (${targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}).`,
                    title: 'Goal Timeline',
                    details: `${formatCurrency(currentAmount)} saved of ${formatCurrency(targetAmount)} (${Math.round((currentAmount/targetAmount) * 100)}% complete)`
                }
            };
        } catch (error) {
            debug.error('Goal timeline query error:', error);
            return this.handleQueryError(error);
        }
    }

    /**
     * Handle emergency fund query - How many months of expenses do I have saved?
     */
    async handleEmergencyFundQuery(parameters) {
        try {
            const appData = this.appState?.appData || {};
            const cashAccounts = appData.cashAccounts || [];
            const transactions = appData.transactions || [];
            const recurringBills = appData.recurringBills || [];
            
            // Calculate total savings
            const totalSavings = cashAccounts
                .filter(account => account.type === 'savings')
                .reduce((sum, account) => sum + (account.balance || 0), 0);
            
            // Calculate months of expenses covered
            const monthsCovered = FinancialCalculations.calculateEmergencyFundMonths(
                totalSavings,
                transactions,
                recurringBills
            );
            
            if (monthsCovered === Infinity) {
                return {
                    type: 'query.emergency_fund',
                    success: true,
                    response: {
                        text: 'You have no recorded expenses, so your savings could last indefinitely!',
                        title: 'Emergency Fund Status'
                    }
                };
            }
            
            const monthsRounded = Math.round(monthsCovered * 10) / 10;
            const recommended = 6; // Standard recommendation is 6 months
            
            let statusEmoji = '❌';
            let statusText = 'needs improvement';
            if (monthsCovered >= recommended) {
                statusEmoji = '✅';
                statusText = 'excellent';
            } else if (monthsCovered >= 3) {
                statusEmoji = '⚠️';
                statusText = 'good, but could be better';
            }
            
            return {
                type: 'query.emergency_fund',
                success: true,
                data: {
                    totalSavings: totalSavings,
                    monthsCovered: monthsRounded,
                    recommended: recommended,
                    status: statusText
                },
                response: {
                    text: `Your emergency fund can cover ${monthsRounded} months of expenses ${statusEmoji}`,
                    title: 'Emergency Fund Status',
                    details: `Total savings: ${formatCurrency(totalSavings)}. Recommendation: ${recommended} months of expenses. Your status: ${statusText}.`
                }
            };
        } catch (error) {
            debug.error('Emergency fund query error:', error);
            return this.handleQueryError(error);
        }
    }

    /**
     * Handle highest category query - What's my highest expense category?
     */
    async handleHighestCategoryQuery(parameters) {
        try {
            const appData = this.appState?.appData || {};
            const transactions = appData.transactions || [];
            
            // Get time period
            const timePeriod = parameters.timePeriod || 'this month';
            const dateRange = this.getDateRangeForPeriod(timePeriod);
            
            // Filter transactions for the period
            const periodTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate >= dateRange.start && 
                       tDate <= dateRange.end && 
                       t.amount < 0; // Only expenses
            });
            
            if (periodTransactions.length === 0) {
                return {
                    type: 'query.highest_category',
                    success: true,
                    response: {
                        text: `No expenses found for ${timePeriod}.`,
                        title: 'Highest Expense Category'
                    }
                };
            }
            
            // Group by category
            const categoryTotals = {};
            periodTransactions.forEach(t => {
                const category = t.category || 'Uncategorized';
                categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(t.amount);
            });
            
            // Sort categories by total
            const sortedCategories = Object.entries(categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5); // Top 5
            
            const [topCategory, topAmount] = sortedCategories[0];
            const totalExpenses = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
            const percentage = Math.round((topAmount / totalExpenses) * 100);
            
            return {
                type: 'query.highest_category',
                success: true,
                data: {
                    topCategories: sortedCategories.map(([cat, amt]) => ({
                        category: cat,
                        amount: amt,
                        percentage: Math.round((amt / totalExpenses) * 100)
                    })),
                    period: timePeriod
                },
                response: {
                    text: `Your highest expense category ${timePeriod} is ${topCategory} at ${formatCurrency(topAmount)} (${percentage}% of total spending).`,
                    title: 'Top Expense Categories',
                    details: sortedCategories.slice(1).map(([cat, amt]) => 
                        `${cat}: ${formatCurrency(amt)}`
                    ).join(', ')
                }
            };
        } catch (error) {
            debug.error('Highest category query error:', error);
            return this.handleQueryError(error);
        }
    }

    /**
     * Handle comparative spending query - Compare spending periods
     */
    async handleComparativeSpendingQuery(parameters) {
        try {
            const appData = this.appState?.appData || {};
            const transactions = appData.transactions || [];
            
            // Parse comparison period from parameters
            const comparisonText = parameters.comparison || 'last month';
            const basePeriod = parameters.timePeriod || 'this month';
            
            const baseRange = this.getDateRangeForPeriod(basePeriod);
            const compareRange = this.getDateRangeForPeriod(comparisonText);
            
            // Get transactions for both periods
            const baseTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate >= baseRange.start && 
                       tDate <= baseRange.end && 
                       t.amount < 0;
            });
            
            const compareTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return tDate >= compareRange.start && 
                       tDate <= compareRange.end && 
                       t.amount < 0;
            });
            
            const baseTotal = baseTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const compareTotal = compareTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            
            const difference = baseTotal - compareTotal;
            const percentChange = compareTotal === 0 ? 100 : 
                Math.round(((baseTotal - compareTotal) / compareTotal) * 100);
            
            // Category breakdown
            const baseByCat = this.groupByCategory(baseTransactions);
            const compareByCat = this.groupByCategory(compareTransactions);
            
            const categoryChanges = Object.keys({...baseByCat, ...compareByCat})
                .map(cat => {
                    const base = baseByCat[cat] || 0;
                    const compare = compareByCat[cat] || 0;
                    const change = base - compare;
                    return { category: cat, base, compare, change };
                })
                .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
                .slice(0, 3);
            
            const trend = difference > 0 ? 'more' : 'less';
            const emoji = difference > 0 ? '📈' : '📉';
            
            return {
                type: 'query.comparative_spending',
                success: true,
                data: {
                    basePeriod: basePeriod,
                    comparePeriod: comparisonText,
                    baseTotal: baseTotal,
                    compareTotal: compareTotal,
                    difference: Math.abs(difference),
                    percentChange: Math.abs(percentChange),
                    categoryChanges: categoryChanges
                },
                response: {
                    text: `You spent ${formatCurrency(Math.abs(difference))} ${trend} ${basePeriod} compared to ${comparisonText} (${Math.abs(percentChange)}% ${trend}) ${emoji}`,
                    title: 'Spending Comparison',
                    details: `${basePeriod}: ${formatCurrency(baseTotal)}, ${comparisonText}: ${formatCurrency(compareTotal)}`
                }
            };
        } catch (error) {
            debug.error('Comparative spending query error:', error);
            return this.handleQueryError(error);
        }
    }

    /**
     * Handle balance forecast query - Project future balance
     */
    async handleBalanceForecastQuery(parameters) {
        try {
            const appData = this.appState?.appData || {};
            const cashAccounts = appData.cashAccounts || [];
            const transactions = appData.transactions || [];
            const recurringBills = appData.recurringBills || [];
            
            // Parse target date
            const targetDateText = parameters.date || parameters.timePeriod || 'next month';
            const dateParser = new DateParser();
            const parsedDate = dateParser.parseNaturalLanguage(targetDateText);
            
            if (!parsedDate) {
                return {
                    type: 'query.balance_forecast',
                    success: false,
                    response: {
                        text: `I couldn't understand the date "${targetDateText}".`,
                        title: 'Invalid Date'
                    }
                };
            }
            
            // Calculate current total balance
            const currentBalance = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
            
            // Calculate days to project
            const today = new Date();
            const targetDate = parsedDate.endDate || parsedDate.startDate;
            const daysToProject = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysToProject <= 0) {
                return {
                    type: 'query.balance_forecast',
                    success: false,
                    response: {
                        text: 'Please specify a future date for the balance projection.',
                        title: 'Future Date Required'
                    }
                };
            }
            
            // Project balance
            const projection = FinancialCalculations.projectBalance(
                currentBalance,
                transactions,
                recurringBills,
                daysToProject
            );
            
            const willHaveEnough = projection.projectedBalance > 0;
            const emoji = willHaveEnough ? '✅' : '⚠️';
            
            return {
                type: 'query.balance_forecast',
                success: true,
                data: projection,
                response: {
                    text: `Your projected balance for ${dateParser.formatDate(targetDate)} is ${formatCurrency(projection.projectedBalance)} ${emoji}`,
                    title: 'Balance Projection',
                    details: `Based on ${formatCurrency(projection.breakdown.avgDailyIncome)}/day income and ${formatCurrency(projection.breakdown.avgDailyExpenses + projection.breakdown.recurringDaily)}/day expenses.`
                }
            };
        } catch (error) {
            debug.error('Balance forecast query error:', error);
            return this.handleQueryError(error);
        }
    }

    /**
     * Handle spending forecast query - Project future spending
     */
    async handleSpendingForecastQuery(parameters) {
        try {
            const appData = this.appState?.appData || {};
            const transactions = appData.transactions || [];
            
            // Extract category and time period
            const category = parameters.category || null;
            const timePeriod = parameters.timePeriod || 'this month';
            
            // Analyze spending trend
            const trendData = FinancialCalculations.analyzeCategoryTrend(
                transactions,
                category || 'all',
                6 // Last 6 months
            );
            
            const projection = trendData.projection;
            const trend = trendData.trend;
            const percentChange = trendData.percentChange;
            
            let trendEmoji = '➡️';
            if (trend === 'increasing') trendEmoji = '📈';
            if (trend === 'decreasing') trendEmoji = '📉';
            
            const categoryText = category ? `on ${category}` : '';
            
            return {
                type: 'query.spending_forecast',
                success: true,
                data: {
                    category: category,
                    trend: trend,
                    average: trendData.average,
                    projection: projection,
                    monthlyData: trendData.monthlyTotals,
                    percentChange: percentChange
                },
                response: {
                    text: `Based on your ${trend} trend (${Math.abs(percentChange)}%), you'll likely spend ${formatCurrency(projection)} ${categoryText} next month ${trendEmoji}`,
                    title: 'Spending Forecast',
                    details: `Average monthly: ${formatCurrency(trendData.average)}. Trend: ${trend}`
                }
            };
        } catch (error) {
            debug.error('Spending forecast query error:', error);
            return this.handleQueryError(error);
        }
    }

    /**
     * Handle debt freedom query - When will I be debt free?
     */
    async handleDebtFreedomQuery(parameters) {
        try {
            const appData = this.appState?.appData || {};
            const debtAccounts = appData.debtAccounts || [];
            
            const activeDebts = debtAccounts.filter(d => (d.balance || 0) > 0);
            
            if (activeDebts.length === 0) {
                return {
                    type: 'query.debt_freedom',
                    success: true,
                    response: {
                        text: 'Congratulations! You are already debt free! 🎉',
                        title: 'Debt Free Status'
                    }
                };
            }
            
            // Calculate payoff for each debt
            const payoffCalculations = activeDebts.map(debt => {
                const payoff = FinancialCalculations.calculateLoanPayoff(
                    debt.balance,
                    (debt.interestRate || 0) / 100,
                    debt.minimumPayment || 50,
                    0 // No extra payment for base calculation
                );
                
                return {
                    name: debt.name,
                    balance: debt.balance,
                    payoff: payoff
                };
            });
            
            // Find the debt that will take longest to pay off
            const longestPayoff = payoffCalculations.reduce((max, current) => 
                current.payoff.months > max.payoff.months ? current : max
            );
            
            const totalDebt = activeDebts.reduce((sum, d) => sum + d.balance, 0);
            const totalMonthlyPayments = activeDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
            
            return {
                type: 'query.debt_freedom',
                success: true,
                data: {
                    totalDebt: totalDebt,
                    debtCount: activeDebts.length,
                    monthlyPayments: totalMonthlyPayments,
                    longestPayoff: longestPayoff,
                    payoffDate: longestPayoff.payoff.payoffDate
                },
                response: {
                    text: `Making minimum payments, you'll be debt free in ${longestPayoff.payoff.months} months (${longestPayoff.payoff.payoffDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}).`,
                    title: 'Debt Freedom Timeline',
                    details: `Total debt: ${formatCurrency(totalDebt)}. Monthly payments: ${formatCurrency(totalMonthlyPayments)}. Consider extra payments to accelerate payoff!`
                }
            };
        } catch (error) {
            debug.error('Debt freedom query error:', error);
            return this.handleQueryError(error);
        }
    }

    /**
     * Handle anomaly detection query - Find unusual transactions
     */
    async handleAnomalyDetectionQuery(parameters) {
        try {
            const appData = this.appState?.appData || {};
            const transactions = appData.transactions || [];
            
            // Get recent transactions (last 90 days)
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 90);
            
            const recentTransactions = transactions.filter(t => 
                new Date(t.date) >= recentDate && t.amount < 0
            );
            
            if (recentTransactions.length === 0) {
                return {
                    type: 'query.anomaly_detection',
                    success: true,
                    response: {
                        text: 'No transactions found to analyze.',
                        title: 'Anomaly Detection'
                    }
                };
            }
            
            // Calculate statistics for each category
            const categoryStats = {};
            recentTransactions.forEach(t => {
                const category = t.category || 'Uncategorized';
                if (!categoryStats[category]) {
                    categoryStats[category] = [];
                }
                categoryStats[category].push(Math.abs(t.amount));
            });
            
            // Find anomalies (transactions > 2 standard deviations from mean)
            const anomalies = [];
            
            Object.entries(categoryStats).forEach(([category, amounts]) => {
                if (amounts.length < 3) return; // Need at least 3 transactions
                
                const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
                const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) / amounts.length;
                const stdDev = Math.sqrt(variance);
                const threshold = mean + (2 * stdDev);
                
                // Find transactions above threshold
                recentTransactions.forEach(t => {
                    if (t.category === category && Math.abs(t.amount) > threshold) {
                        anomalies.push({
                            transaction: t,
                            expected: mean,
                            deviation: Math.abs(t.amount) - mean
                        });
                    }
                });
            });
            
            // Sort by deviation amount
            anomalies.sort((a, b) => b.deviation - a.deviation);
            const topAnomalies = anomalies.slice(0, 5);
            
            if (topAnomalies.length === 0) {
                return {
                    type: 'query.anomaly_detection',
                    success: true,
                    response: {
                        text: 'No unusual transactions detected. Your spending patterns look consistent.',
                        title: 'No Anomalies Found',
                        emoji: '✅'
                    }
                };
            }
            
            return {
                type: 'query.anomaly_detection',
                success: true,
                data: {
                    anomalies: topAnomalies,
                    totalFound: anomalies.length
                },
                response: {
                    text: `Found ${anomalies.length} unusual transaction${anomalies.length > 1 ? 's' : ''}. The largest was ${formatCurrency(Math.abs(topAnomalies[0].transaction.amount))} at ${topAnomalies[0].transaction.description}.`,
                    title: 'Unusual Transactions Detected',
                    details: topAnomalies.slice(1, 3).map(a => 
                        `${a.transaction.description}: ${formatCurrency(Math.abs(a.transaction.amount))}`
                    ).join(', '),
                    emoji: '⚠️'
                }
            };
        } catch (error) {
            debug.error('Anomaly detection query error:', error);
            return this.handleQueryError(error);
        }
    }

    /**
     * Helper: Group transactions by category
     */
    groupByCategory(transactions) {
        const groups = {};
        transactions.forEach(t => {
            const category = t.category || 'Uncategorized';
            groups[category] = (groups[category] || 0) + Math.abs(t.amount);
        });
        return groups;
    }
}