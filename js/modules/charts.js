// js/modules/charts.js
import { formatCurrency } from './utils.js';
import { calculateDebtToIncomeRatio } from './kpis.js';

let chartInstances = {};

function createDebtHealthGauge({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("debtHealthGauge").getContext("2d");
    if (!ctx) return;

    const dti = calculateDebtToIncomeRatio(appData);

    // Determine color based on DTI value
    let needleColor = CHART_COLORS[5]; // Default to error color (red)
    if (dti <= 20) needleColor = CHART_COLORS[0]; // Excellent (teal)
    else if (dti <= 35) needleColor = CHART_COLORS[7]; // Good (brown/orange)
    else if (dti <= 43) needleColor = CHART_COLORS[6]; // Fair (yellow)

    // Gauge goes from 0 to 60%. DTI values above 60% will just max out the gauge.
    const gaugeMax = 60;
    const value = Math.min(dti, gaugeMax);

    chartInstances.debtHealthGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['DTI', 'Remaining'],
            datasets: [{
                data: [value, gaugeMax - value],
                backgroundColor: [needleColor, 'rgba(0, 0, 0, 0.05)'],
                borderColor: 'transparent',
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            circumference: 180, // Makes it a semicircle
            rotation: -90,      // Starts it at the left
            cutout: '70%',      // Adjusts the thickness of the gauge
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

function createInvestmentAllocationChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("investmentAllocation").getContext("2d");
    if (!ctx) return;

    const allocationData = appData.investmentAccounts.reduce((acc, account) => {
        const type = account.accountType || 'Other';
        if (!acc[type]) {
            acc[type] = 0;
        }
        acc[type] += account.balance;
        return acc;
    }, {});

    const labels = Object.keys(allocationData);
    const data = Object.values(allocationData);

    chartInstances.investmentAllocation = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Value',
                data: data,
                backgroundColor: CHART_COLORS,
                borderColor: 'var(--color-surface-translucent)',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
            }
        }
    });
}


export function createCharts(appState) {
    try {
        Object.keys(chartInstances).forEach(key => {
            if (chartInstances[key]) {
                chartInstances[key].destroy();
            }
        });

        // Add call to the new charts
        if (document.getElementById("debtHealthGauge")) createDebtHealthGauge(appState);
        if (document.getElementById("investmentAllocation")) createInvestmentAllocationChart(appState);

        // Existing chart calls
        if (document.getElementById("netWorthChart")) createNetWorthChart(appState);
        if (document.getElementById("expenseCategoryChart")) createExpenseCategoryChart(appState);
        if (document.getElementById("cashFlowChart")) createCashFlowChart(appState);
        if (document.getElementById("assetsDebtChart")) createAssetsDebtChart(appState);

    } catch (error) {
        console.error("Error creating charts:", error);
    }
}

function createNetWorthChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("netWorthChart").getContext("2d");
    const cashAccountIds = appData.cashAccounts.map(account => account.id);
    const months = [];
    const netWorthData = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        months.push(date.toLocaleDateString("en-US", { month: "short", year: "numeric" }));

        const monthTransactions = appData.transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate.getMonth() === date.getMonth() && transactionDate.getFullYear() === date.getFullYear();
        });

        const monthCash = monthTransactions.reduce((sum, t) => {
            if (cashAccountIds.includes(t.account_id)) return sum + t.amount;
            return sum;
        }, 0);

        const totalInvestments = appData.investmentAccounts.reduce((sum, account) => sum + account.balance, 0);
        const totalDebt = appData.debtAccounts.reduce((sum, account) => sum + account.balance, 0);
        netWorthData.push(monthCash + totalInvestments - totalDebt);
    }

    chartInstances.netWorthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Net Worth',
                data: netWorthData,
                backgroundColor: 'rgba(31, 184, 205, 0.2)',
                borderColor: 'rgba(31, 184, 205, 1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function createExpenseCategoryChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("expenseCategoryChart").getContext("2d");
    const expenseData = {};

    appData.transactions
        // CORRECTED: The '&& t.category !== 'Debt'' part was removed
        .filter(t => t.amount < 0 && t.category !== 'Transfer')
        .forEach(t => {
            if (!expenseData[t.category]) {
                expenseData[t.category] = 0;
            }
            expenseData[t.category] += Math.abs(t.amount);
        });

    const labels = Object.keys(expenseData);
    const data = Object.values(expenseData);

    chartInstances.expenseCategoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: data,
                backgroundColor: CHART_COLORS,
                hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function createCashFlowChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("cashFlowChart").getContext("2d");
    const cashAccountIds = appData.cashAccounts.map(account => account.id);
    const months = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        months.push(date.toLocaleDateString("en-US", { month: "short" }));

        const monthTransactions = appData.transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate.getMonth() === date.getMonth() &&
                transactionDate.getFullYear() === date.getFullYear() &&
                cashAccountIds.includes(t.account_id);
        });

        incomeData.push(monthTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0));
        expenseData.push(Math.abs(monthTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)));
    }

    chartInstances.cashFlowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Income',
                data: incomeData,
                backgroundColor: CHART_COLORS[0],
            }, {
                label: 'Expenses',
                data: expenseData,
                backgroundColor: CHART_COLORS[5],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        }
    });
}

function createAssetsDebtChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("assetsDebtChart").getContext("2d");
    const totalCash = appData.cashAccounts.reduce((sum, account) => sum + account.balance, 0);
    const totalInvestments = appData.investmentAccounts.reduce((sum, account) => sum + account.balance, 0);
    const totalDebt = appData.debtAccounts.reduce((sum, account) => sum + account.balance, 0);

    chartInstances.assetsDebtChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Total Assets', 'Total Debt'],
            datasets: [{
                label: 'Value',
                data: [totalCash + totalInvestments, totalDebt],
                backgroundColor: [CHART_COLORS[0], CHART_COLORS[5]],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: { x: { beginAtZero: true } }
        }
    });
}