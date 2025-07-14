// js/modules/voice/voiceAnalytics.js - Voice-Activated Financial Analytics

import { debug } from '../debug.js';
import { formatCurrency, formatDate } from '../utils.js';
import { addMoney, subtractMoney, sumMoney } from '../financialMath.js';
import * as KPIs from '../kpis.js';

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
            'query.savings_rate': this.handleSavingsRateQuery.bind(this)
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
            ]
        };
    }
}