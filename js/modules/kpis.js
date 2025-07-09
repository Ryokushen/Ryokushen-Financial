// js/modules/kpis.js

/**
 * Groups transactions by month for the last N months.
 * @param {Array} transactions - The array of all transactions.
 * @param {number} numberOfMonths - The number of months to look back.
 * @returns {Map<string, Array>} A map where keys are 'YYYY-MM' and values are arrays of transactions for that month.
 */
function groupTransactionsByMonth(transactions, numberOfMonths = 6) {
    const monthlyGroups = new Map();
    const today = new Date();

    for (let i = 0; i < numberOfMonths; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyGroups.set(key, []);
    }

    transactions.forEach(t => {
        const transactionDate = new Date(t.date);
        const key = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyGroups.has(key)) {
            monthlyGroups.get(key).push(t);
        }
    });

    return monthlyGroups;
}

/**
 * Calculates average monthly income based on transactions.
 * @param {Array} transactions - The array of all transactions.
 * @returns {number} The average monthly income.
 */
function calculateAverageMonthlyIncome(transactions) {
    const monthlyGroups = groupTransactionsByMonth(transactions);
    let totalIncome = 0;
    let monthsWithIncome = 0;

    monthlyGroups.forEach(monthTransactions => {
        const monthlyIncome = monthTransactions
            .filter(t => t.category === 'Income') //
            .reduce((sum, t) => sum + t.amount, 0);

        if (monthlyIncome > 0) {
            totalIncome += monthlyIncome;
            monthsWithIncome++;
        }
    });

    return monthsWithIncome > 0 ? totalIncome / monthsWithIncome : 0;
}

/**
 * Calculates average monthly expenses based on transactions.
 * @param {Array} transactions - The array of all transactions.
 * @returns {number} The average monthly expenses (as a positive number).
 */
function calculateAverageMonthlyExpenses(transactions) {
    const monthlyGroups = groupTransactionsByMonth(transactions);
    let totalExpenses = 0;
    let monthsWithExpenses = 0;

    monthlyGroups.forEach(monthTransactions => {
        const monthlyExpense = monthTransactions
            .filter(t => t.amount < 0 && t.category !== 'Transfer' && t.category !== 'Debt') //
            .reduce((sum, t) => sum + t.amount, 0);

        if (monthlyExpense < 0) {
            totalExpenses += monthlyExpense;
            monthsWithExpenses++;
        }
    });

    const average = monthsWithExpenses > 0 ? totalExpenses / monthsWithExpenses : 0;
    return Math.abs(average); // Return as a positive value
}


// --- EXPORTED KPI FUNCTIONS ---

/**
 * Calculates the emergency fund ratio in months.
 * @param {object} appData - The main application data object.
 * @returns {number} The number of months of expenses covered by cash accounts.
 */
export function calculateEmergencyFundRatio(appData) {
    const totalCash = appData.cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0); //
    const averageMonthlyExpenses = calculateAverageMonthlyExpenses(appData.transactions);

    if (averageMonthlyExpenses === 0) return Infinity; // Avoid division by zero
    return totalCash / averageMonthlyExpenses;
}

/**
 * Calculates the debt-to-income (DTI) ratio.
 * @param {object} appData - The main application data object.
 * @returns {number} The DTI ratio as a percentage.
 */
export function calculateDebtToIncomeRatio(appData) {
    const totalMonthlyDebtPayments = appData.debtAccounts.reduce((sum, acc) => sum + acc.minimumPayment, 0); //
    const averageMonthlyIncome = calculateAverageMonthlyIncome(appData.transactions);

    if (averageMonthlyIncome === 0) return Infinity; // Avoid division by zero
    return (totalMonthlyDebtPayments / averageMonthlyIncome) * 100;
}

/**
 * Calculates the net savings rate.
 * @param {object} appData - The main application data object.
 * @returns {number} The savings rate as a percentage of income.
 */
export function calculateSavingsRate(appData) {
    const averageMonthlyIncome = calculateAverageMonthlyIncome(appData.transactions);
    const averageMonthlyExpenses = calculateAverageMonthlyExpenses(appData.transactions);

    if (averageMonthlyIncome === 0) return 0;

    const netSavings = averageMonthlyIncome - averageMonthlyExpenses;
    return (netSavings / averageMonthlyIncome) * 100;
}

/**
 * Calculates an overall financial health score based on key metrics.
 * @param {object} kpiResults - An object containing the calculated KPIs.
 * @returns {{score: string, status: string}} An object with the final letter grade and status text.
 */
export function calculateOverallHealthScore(kpiResults) {
    const { emergencyRatio, dti, savingsRate } = kpiResults;
    let points = 0;

    // Emergency Fund Score (4 points max)
    if (emergencyRatio >= 6) points += 4;
    else if (emergencyRatio >= 3) points += 3;
    else if (emergencyRatio >= 1) points += 2;
    else points += 1;

    // DTI Score (4 points max) - Lower is better
    if (dti <= 20) points += 4;
    else if (dti <= 35) points += 3;
    else if (dti <= 43) points += 2;
    else points += 1;

    // Savings Rate Score (4 points max)
    if (savingsRate >= 20) points += 4;
    else if (savingsRate >= 10) points += 3;
    else if (savingsRate >= 5) points += 2;
    else points += 1;

    const averageScore = points / 3;
    
    if (averageScore >= 3.8) return { score: "A+", status: "Excellent" };
    if (averageScore >= 3.5) return { score: "A", status: "Excellent" };
    if (averageScore >= 3.0) return { score: "B+", status: "Good" };
    if (averageScore >= 2.5) return { score: "B", status: "Good" };
    if (averageScore >= 2.0) return { score: "C+", status: "Fair" };
    if (averageScore >= 1.5) return { score: "C", status: "Fair" };
    
    return { score: "D", status: "Needs Improvement" };
}