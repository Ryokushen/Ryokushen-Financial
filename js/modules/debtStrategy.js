/**
 * Debt Strategy Module
 * Provides calculations for debt payoff strategies (Snowball, Avalanche)
 * and related financial projections
 */

import { debug } from './debug.js';

export const DebtStrategy = (() => {
    /**
     * Sort debts according to Snowball strategy (lowest balance first)
     * @param {Array} debts - Array of debt objects
     * @returns {Array} Sorted array of debts
     */
    const calculateSnowballOrder = (debts) => {
        return [...debts].sort((a, b) => a.balance - b.balance);
    };

    /**
     * Sort debts according to Avalanche strategy (highest interest rate first)
     * @param {Array} debts - Array of debt objects
     * @returns {Array} Sorted array of debts
     */
    const calculateAvalancheOrder = (debts) => {
        return [...debts].sort((a, b) => b.interestRate - a.interestRate);
    };

    /**
     * Calculate monthly interest for a debt
     * @param {number} balance - Current balance
     * @param {number} annualRate - Annual interest rate (as percentage)
     * @returns {number} Monthly interest amount
     */
    const calculateMonthlyInterest = (balance, annualRate) => {
        return (balance * (annualRate / 100)) / 12;
    };

    /**
     * Calculate payoff timeline for debts with given strategy
     * @param {Array} debts - Array of debt objects
     * @param {string} strategy - 'snowball' or 'avalanche'
     * @param {number} extraPayment - Additional monthly payment amount
     * @returns {Object} Payoff timeline and statistics
     */
    const calculatePayoffTimeline = (debts, strategy = 'avalanche', extraPayment = 0) => {
        if (!debts || debts.length === 0) {
            return {
                months: 0,
                totalInterest: 0,
                monthlySchedule: [],
                debtFreeDate: new Date()
            };
        }

        // Sort debts based on strategy
        let sortedDebts = strategy === 'snowball' 
            ? calculateSnowballOrder(debts)
            : calculateAvalancheOrder(debts);

        // Create working copies of debts with remaining balance
        let workingDebts = sortedDebts.map(debt => ({
            ...debt,
            remainingBalance: debt.balance,
            totalInterestPaid: 0,
            paidOff: false,
            paidOffMonth: null
        }));

        let monthlySchedule = [];
        let currentMonth = 0;
        let totalInterest = 0;

        // Calculate minimum total payment
        const totalMinimumPayment = workingDebts.reduce((sum, debt) => 
            sum + (debt.minimumPayment || 0), 0);

        // Continue until all debts are paid off
        while (workingDebts.some(debt => debt.remainingBalance > 0)) {
            currentMonth++;
            let monthData = {
                month: currentMonth,
                payments: [],
                totalPayment: 0,
                totalInterest: 0,
                totalPrincipal: 0,
                remainingDebts: 0
            };

            let availableExtra = extraPayment;

            // Process each debt
            for (let debt of workingDebts) {
                if (debt.remainingBalance <= 0) continue;

                // Calculate interest for this month
                const monthlyInterest = calculateMonthlyInterest(
                    debt.remainingBalance, 
                    debt.interestRate
                );

                // Determine payment amount
                let payment = debt.minimumPayment || 0;
                
                // Add extra payment to first unpaid debt (based on strategy)
                if (availableExtra > 0 && !debt.paidOff) {
                    const extraForThisDebt = Math.min(availableExtra, debt.remainingBalance + monthlyInterest - payment);
                    payment += extraForThisDebt;
                    availableExtra -= extraForThisDebt;
                }

                // Ensure payment doesn't exceed remaining balance + interest
                payment = Math.min(payment, debt.remainingBalance + monthlyInterest);

                // Calculate principal payment
                const principalPayment = payment - monthlyInterest;

                // Update debt
                debt.remainingBalance -= principalPayment;
                debt.totalInterestPaid += monthlyInterest;

                // Check if debt is paid off
                if (debt.remainingBalance <= 0.01) { // Using 0.01 to handle floating point
                    debt.remainingBalance = 0;
                    debt.paidOff = true;
                    debt.paidOffMonth = currentMonth;
                    
                    // Reallocate this debt's minimum payment to extra payment
                    availableExtra += debt.minimumPayment || 0;
                }

                // Record payment details
                monthData.payments.push({
                    debtId: debt.id,
                    debtName: debt.name,
                    payment: payment,
                    interest: monthlyInterest,
                    principal: principalPayment,
                    remainingBalance: debt.remainingBalance
                });

                monthData.totalPayment += payment;
                monthData.totalInterest += monthlyInterest;
                monthData.totalPrincipal += principalPayment;
                totalInterest += monthlyInterest;
            }

            monthData.remainingDebts = workingDebts.filter(d => d.remainingBalance > 0).length;
            monthlySchedule.push(monthData);

            // Safety check to prevent infinite loops
            if (currentMonth > 360) { // 30 years
                debug.warn('Payoff calculation exceeded 30 years');
                break;
            }
        }

        // Calculate debt free date
        const debtFreeDate = new Date();
        debtFreeDate.setMonth(debtFreeDate.getMonth() + currentMonth);

        return {
            months: currentMonth,
            totalInterest: totalInterest,
            monthlySchedule: monthlySchedule,
            debtFreeDate: debtFreeDate,
            finalDebtStatus: workingDebts.map(debt => ({
                id: debt.id,
                name: debt.name,
                paidOffMonth: debt.paidOffMonth,
                totalInterestPaid: debt.totalInterestPaid
            }))
        };
    };

    /**
     * Calculate total interest for a debt payoff strategy
     * @param {Array} debts - Array of debt objects
     * @param {string} strategy - 'snowball' or 'avalanche'
     * @param {number} extraPayment - Additional monthly payment
     * @returns {number} Total interest to be paid
     */
    const calculateTotalInterest = (debts, strategy = 'avalanche', extraPayment = 0) => {
        const timeline = calculatePayoffTimeline(debts, strategy, extraPayment);
        return timeline.totalInterest;
    };

    /**
     * Compare different payoff strategies
     * @param {Array} debts - Array of debt objects
     * @param {number} extraPayment - Additional monthly payment
     * @returns {Object} Comparison of strategies
     */
    const compareStrategies = (debts, extraPayment = 0) => {
        const avalancheTimeline = calculatePayoffTimeline(debts, 'avalanche', extraPayment);
        const snowballTimeline = calculatePayoffTimeline(debts, 'snowball', extraPayment);

        return {
            avalanche: {
                months: avalancheTimeline.months,
                totalInterest: avalancheTimeline.totalInterest,
                debtFreeDate: avalancheTimeline.debtFreeDate
            },
            snowball: {
                months: snowballTimeline.months,
                totalInterest: snowballTimeline.totalInterest,
                debtFreeDate: snowballTimeline.debtFreeDate
            },
            interestSavings: snowballTimeline.totalInterest - avalancheTimeline.totalInterest,
            timeDifference: snowballTimeline.months - avalancheTimeline.months
        };
    };

    /**
     * Calculate optimal extra payment allocation
     * @param {Array} debts - Array of debt objects
     * @param {string} strategy - 'snowball' or 'avalanche'
     * @param {number} amount - Extra payment amount to allocate
     * @returns {Array} Allocation recommendations
     */
    const allocateExtraPayment = (debts, strategy = 'avalanche', amount = 0) => {
        if (!debts || debts.length === 0 || amount <= 0) {
            return [];
        }

        // Sort debts based on strategy
        const sortedDebts = strategy === 'snowball' 
            ? calculateSnowballOrder(debts)
            : calculateAvalancheOrder(debts);

        // Simple allocation: all extra payment goes to first debt in sorted order
        // that isn't already paid off
        const targetDebt = sortedDebts.find(debt => debt.balance > 0);
        
        if (!targetDebt) {
            return [];
        }

        return [{
            debtId: targetDebt.id,
            debtName: targetDebt.name,
            extraPayment: amount,
            reason: strategy === 'snowball' 
                ? `Lowest balance ($${targetDebt.balance.toFixed(2)})`
                : `Highest interest rate (${targetDebt.interestRate}%)`
        }];
    };

    /**
     * Calculate credit utilization for credit cards
     * @param {Array} debts - Array of debt objects
     * @returns {Object} Credit utilization statistics
     */
    const calculateCreditUtilization = (debts) => {
        const creditCards = debts.filter(debt => 
            debt.type === 'Credit Card' && debt.creditLimit > 0
        );

        if (creditCards.length === 0) {
            return {
                overall: 0,
                cards: []
            };
        }

        const totalBalance = creditCards.reduce((sum, card) => sum + card.balance, 0);
        const totalLimit = creditCards.reduce((sum, card) => sum + card.creditLimit, 0);

        return {
            overall: totalLimit > 0 ? (totalBalance / totalLimit) * 100 : 0,
            cards: creditCards.map(card => ({
                id: card.id,
                name: card.name,
                utilization: (card.balance / card.creditLimit) * 100,
                balance: card.balance,
                limit: card.creditLimit
            }))
        };
    };

    return {
        calculateSnowballOrder,
        calculateAvalancheOrder,
        calculatePayoffTimeline,
        calculateTotalInterest,
        compareStrategies,
        allocateExtraPayment,
        calculateCreditUtilization
    };
})();