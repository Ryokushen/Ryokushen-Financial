/**
 * Financial calculation utilities for advanced analytics and predictions
 */

class FinancialCalculations {
    /**
     * Calculate compound interest
     * @param {number} principal - Initial amount
     * @param {number} rate - Annual interest rate (as decimal)
     * @param {number} time - Time period in years
     * @param {number} frequency - Compounding frequency per year (12 for monthly)
     * @returns {number} Future value
     */
    static calculateCompoundInterest(principal, rate, time, frequency = 12) {
        return principal * Math.pow(1 + (rate / frequency), frequency * time);
    }
    
    /**
     * Calculate loan payoff timeline
     * @param {number} balance - Current loan balance
     * @param {number} rate - Annual interest rate (as decimal)
     * @param {number} payment - Monthly payment amount
     * @param {number} extraPayment - Additional monthly payment (default 0)
     * @returns {Object} { months, totalInterest, payoffDate }
     */
    static calculateLoanPayoff(balance, rate, payment, extraPayment = 0) {
        const monthlyRate = rate / 12;
        const totalPayment = payment + extraPayment;
        let remainingBalance = balance;
        let months = 0;
        let totalInterest = 0;
        
        // Validate that payment is sufficient
        const minimumPayment = balance * monthlyRate;
        if (totalPayment <= minimumPayment) {
            return {
                months: Infinity,
                totalInterest: Infinity,
                payoffDate: null,
                error: 'Payment insufficient to cover interest'
            };
        }
        
        while (remainingBalance > 0.01 && months < 600) { // Max 50 years
            const interestCharge = remainingBalance * monthlyRate;
            const principalPayment = Math.min(totalPayment - interestCharge, remainingBalance);
            
            totalInterest += interestCharge;
            remainingBalance -= principalPayment;
            months++;
        }
        
        const payoffDate = new Date();
        payoffDate.setMonth(payoffDate.getMonth() + months);
        
        return {
            months,
            totalInterest: Math.round(totalInterest * 100) / 100,
            payoffDate,
            monthlySavings: extraPayment > 0 ? this.calculateMonthlySavings(balance, rate, payment, extraPayment) : 0
        };
    }
    
    /**
     * Calculate monthly savings from extra payments
     */
    static calculateMonthlySavings(balance, rate, basePayment, extraPayment) {
        const basePayoff = this.calculateLoanPayoff(balance, rate, basePayment, 0);
        const acceleratedPayoff = this.calculateLoanPayoff(balance, rate, basePayment, extraPayment);
        
        const interestSaved = basePayoff.totalInterest - acceleratedPayoff.totalInterest;
        const monthsSaved = basePayoff.months - acceleratedPayoff.months;
        
        return {
            interestSaved: Math.round(interestSaved * 100) / 100,
            monthsSaved
        };
    }
    
    /**
     * Calculate moving average
     * @param {Array} values - Array of numeric values
     * @param {number} period - Period for moving average
     * @returns {Array} Moving average values
     */
    static calculateMovingAverage(values, period) {
        if (values.length < period) return [];
        
        const movingAverages = [];
        for (let i = period - 1; i < values.length; i++) {
            const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            movingAverages.push(sum / period);
        }
        
        return movingAverages;
    }
    
    /**
     * Simple linear regression for trend prediction
     * @param {Array} data - Array of {x, y} points
     * @returns {Object} { slope, intercept, predict(x) }
     */
    static linearRegression(data) {
        const n = data.length;
        if (n < 2) return null;
        
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (const point of data) {
            sumX += point.x;
            sumY += point.y;
            sumXY += point.x * point.y;
            sumX2 += point.x * point.x;
        }
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return {
            slope,
            intercept,
            predict: (x) => slope * x + intercept,
            r2: this.calculateR2(data, slope, intercept)
        };
    }
    
    /**
     * Calculate R-squared for regression quality
     */
    static calculateR2(data, slope, intercept) {
        const yMean = data.reduce((sum, p) => sum + p.y, 0) / data.length;
        let ssRes = 0, ssTot = 0;
        
        for (const point of data) {
            const yPred = slope * point.x + intercept;
            ssRes += Math.pow(point.y - yPred, 2);
            ssTot += Math.pow(point.y - yMean, 2);
        }
        
        return 1 - (ssRes / ssTot);
    }
    
    /**
     * Detect trend direction
     * @param {Array} values - Array of numeric values
     * @param {number} sensitivity - Sensitivity threshold (0-1)
     * @returns {string} 'increasing', 'decreasing', or 'stable'
     */
    static detectTrend(values, sensitivity = 0.1) {
        if (values.length < 3) return 'stable';
        
        // Create data points for regression
        const data = values.map((y, i) => ({ x: i, y }));
        const regression = this.linearRegression(data);
        
        if (!regression) return 'stable';
        
        // Calculate relative change
        const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
        const relativeSlope = Math.abs(regression.slope) / avgValue;
        
        if (relativeSlope < sensitivity) return 'stable';
        return regression.slope > 0 ? 'increasing' : 'decreasing';
    }
    
    /**
     * Calculate percentile
     * @param {Array} values - Array of numeric values
     * @param {number} percentile - Percentile to calculate (0-100)
     * @returns {number} Value at percentile
     */
    static calculatePercentile(values, percentile) {
        if (values.length === 0) return null;
        
        const sorted = [...values].sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        
        if (Math.floor(index) === index) {
            return sorted[index];
        }
        
        const lower = sorted[Math.floor(index)];
        const upper = sorted[Math.ceil(index)];
        const fraction = index - Math.floor(index);
        
        return lower + (upper - lower) * fraction;
    }
    
    /**
     * Project future balance based on income and expenses
     * @param {number} currentBalance - Current account balance
     * @param {Array} transactions - Recent transactions
     * @param {Array} recurringBills - Recurring bills
     * @param {number} daysToProject - Number of days to project
     * @returns {Object} { projectedBalance, breakdown }
     */
    static projectBalance(currentBalance, transactions, recurringBills, daysToProject) {
        // Calculate average daily income and expenses from recent transactions
        const recentDays = 30;
        const recentDate = new Date();
        recentDate.setDate(recentDate.getDate() - recentDays);
        
        const recentTransactions = transactions.filter(t => 
            new Date(t.date) >= recentDate
        );
        
        let totalIncome = 0;
        let totalExpenses = 0;
        
        recentTransactions.forEach(t => {
            if (t.amount > 0) {
                totalIncome += t.amount;
            } else {
                totalExpenses += Math.abs(t.amount);
            }
        });
        
        const avgDailyIncome = totalIncome / recentDays;
        const avgDailyExpenses = totalExpenses / recentDays;
        
        // Calculate recurring bills impact
        let recurringMonthly = 0;
        recurringBills.forEach(bill => {
            if (bill.frequency === 'monthly') {
                recurringMonthly += bill.amount;
            } else if (bill.frequency === 'weekly') {
                recurringMonthly += bill.amount * 4.33; // Average weeks per month
            } else if (bill.frequency === 'yearly') {
                recurringMonthly += bill.amount / 12;
            }
        });
        
        const recurringDaily = recurringMonthly / 30;
        
        // Project balance
        const netDaily = avgDailyIncome - avgDailyExpenses - recurringDaily;
        const projectedBalance = currentBalance + (netDaily * daysToProject);
        
        return {
            projectedBalance: Math.round(projectedBalance * 100) / 100,
            breakdown: {
                currentBalance,
                avgDailyIncome: Math.round(avgDailyIncome * 100) / 100,
                avgDailyExpenses: Math.round(avgDailyExpenses * 100) / 100,
                recurringDaily: Math.round(recurringDaily * 100) / 100,
                netDaily: Math.round(netDaily * 100) / 100,
                daysToProject
            }
        };
    }
    
    /**
     * Calculate months of expenses covered by savings
     * @param {number} savingsBalance - Total savings
     * @param {Array} transactions - Recent transactions
     * @param {Array} recurringBills - Recurring bills
     * @returns {number} Months of expenses covered
     */
    static calculateEmergencyFundMonths(savingsBalance, transactions, recurringBills) {
        // Calculate average monthly expenses
        const recentDate = new Date();
        recentDate.setMonth(recentDate.getMonth() - 3); // Use last 3 months
        
        const recentTransactions = transactions.filter(t => 
            new Date(t.date) >= recentDate && t.amount < 0
        );
        
        const totalExpenses = recentTransactions.reduce((sum, t) => 
            sum + Math.abs(t.amount), 0
        );
        
        const avgMonthlyExpenses = totalExpenses / 3;
        
        // Add recurring bills
        let recurringMonthly = 0;
        recurringBills.forEach(bill => {
            if (bill.frequency === 'monthly') {
                recurringMonthly += bill.amount;
            } else if (bill.frequency === 'weekly') {
                recurringMonthly += bill.amount * 4.33;
            } else if (bill.frequency === 'yearly') {
                recurringMonthly += bill.amount / 12;
            }
        });
        
        const totalMonthlyExpenses = avgMonthlyExpenses + recurringMonthly;
        
        if (totalMonthlyExpenses === 0) return Infinity;
        
        return savingsBalance / totalMonthlyExpenses;
    }
    
    /**
     * Analyze spending by category trends
     * @param {Array} transactions - Transaction history
     * @param {string} category - Category to analyze
     * @param {number} months - Number of months to analyze
     * @returns {Object} Trend analysis results
     */
    static analyzeCategoryTrend(transactions, category, months = 6) {
        const monthlyTotals = [];
        const now = new Date();
        
        for (let i = months - 1; i >= 0; i--) {
            const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            
            const monthTransactions = transactions.filter(t => {
                const tDate = new Date(t.date);
                return t.category === category && 
                       tDate >= startDate && 
                       tDate <= endDate &&
                       t.amount < 0;
            });
            
            const total = monthTransactions.reduce((sum, t) => 
                sum + Math.abs(t.amount), 0
            );
            
            monthlyTotals.push({
                month: startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                total,
                count: monthTransactions.length
            });
        }
        
        // Calculate trend
        const values = monthlyTotals.map(m => m.total);
        const trend = this.detectTrend(values);
        const average = values.reduce((a, b) => a + b, 0) / values.length;
        
        // Calculate percentage change
        const firstMonth = values[0] || 0;
        const lastMonth = values[values.length - 1] || 0;
        const percentChange = firstMonth === 0 ? 0 : 
            ((lastMonth - firstMonth) / firstMonth) * 100;
        
        return {
            monthlyTotals,
            trend,
            average: Math.round(average * 100) / 100,
            percentChange: Math.round(percentChange * 10) / 10,
            projection: this.projectNextMonth(values)
        };
    }
    
    /**
     * Project next month's value based on trend
     */
    static projectNextMonth(values) {
        if (values.length < 2) return values[0] || 0;
        
        const data = values.map((y, i) => ({ x: i, y }));
        const regression = this.linearRegression(data);
        
        if (!regression || regression.r2 < 0.5) {
            // If trend is not reliable, use average
            return values.reduce((a, b) => a + b, 0) / values.length;
        }
        
        return Math.max(0, regression.predict(values.length));
    }
}

// Export for use in other modules
export default FinancialCalculations;