// js/modules/charts.js
import { formatCurrency, CHART_COLORS } from './utils.js';
import { calculateDebtToIncomeRatio } from './kpis.js';
import { debug } from './debug.js';
import { DebtStrategy } from './debtStrategy.js';

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
        
        // Debt-specific charts
        if (document.getElementById("debt-breakdown-chart")) createDebtBreakdownChart({ appData: appState.appData, CHART_COLORS });
        if (document.getElementById("payoff-timeline-chart")) createPayoffTimelineChart({ appData: appState.appData, CHART_COLORS });
        if (document.getElementById("interest-analysis-chart")) createInterestAnalysisChart({ appData: appState.appData, CHART_COLORS });
        if (document.getElementById("credit-utilization-chart")) createCreditUtilizationChart({ appData: appState.appData, CHART_COLORS });

    } catch (error) {
        debug.error("Error creating charts:", error);
    }
}

function createNetWorthChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("netWorthChart").getContext("2d");
    if (!ctx) return;

    // Calculate total investments and debt first (your addition—good!)
    const totalInvestments = appData.investmentAccounts.reduce((sum, account) => sum + account.balance, 0);
    const totalDebt = appData.debtAccounts.reduce((sum, account) => sum + account.balance, 0);

    const cashAccountIds = appData.cashAccounts.map(account => account.id);
    const months = [];
    const netWorthData = [];
    const sortedTransactions = [...appData.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    let runningCash = 0;

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i, 1);  // Start of month
        const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);  // End of month

        months.push(date.toLocaleDateString("en-US", { month: "short", year: "numeric" }));

        // UPDATE: Compute full cumulative up to endDate (remove - runningCash for true accumulation)
        runningCash = sortedTransactions
            .filter(t => new Date(t.date) <= endDate && cashAccountIds.includes(t.account_id))
            .reduce((sum, t) => sum + t.amount, 0);

        // UPDATE: Use runningCash instead of monthCash
        netWorthData.push(runningCash + totalInvestments - totalDebt);
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
    if (!ctx) return;

    const expenseData = {};

    appData.transactions
        // CORRECTED: The '&& t.category !== 'Debt'' part was removed
        .filter(t => (t.amount < 0 && t.category !== 'Transfer') || (t.amount > 0 && t.debt_account_id))
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
    if (!ctx) return;

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
        expenseData.push(Math.abs(monthTransactions.filter(t => t.amount < 0 || (t.amount > 0 && t.debt_account_id)).reduce((sum, t) => sum + (t.amount < 0 ? t.amount : -t.amount), 0)));
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
    if (!ctx) return;

    const totalCash = appData.cashAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
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

function createDebtBreakdownChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("debt-breakdown-chart")?.getContext("2d");
    if (!ctx) return;

    // Group debts by type
    const debtByType = appData.debtAccounts.reduce((acc, debt) => {
        const type = debt.type || 'Other';
        if (!acc[type]) {
            acc[type] = 0;
        }
        acc[type] += debt.balance;
        return acc;
    }, {});

    const labels = Object.keys(debtByType);
    const data = Object.values(debtByType);

    chartInstances.debtBreakdownChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Debt by Type',
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
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = formatCurrency(context.parsed);
                            const percentage = ((context.parsed / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createPayoffTimelineChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("payoff-timeline-chart")?.getContext("2d");
    if (!ctx) return;

    // Get current strategy and extra payment from UI if available
    const strategy = document.getElementById('debt-strategy-select')?.value || 'avalanche';
    const extraPayment = parseFloat(document.getElementById('extra-payment-amount')?.value) || 0;

    // Calculate payoff timeline
    const timeline = DebtStrategy.calculatePayoffTimeline(appData.debtAccounts, strategy, extraPayment);
    
    if (timeline.monthlySchedule.length === 0) {
        return;
    }

    // Prepare data for chart (show first 24 months or all if less)
    const monthsToShow = Math.min(timeline.monthlySchedule.length, 24);
    const labels = Array.from({length: monthsToShow}, (_, i) => `Month ${i + 1}`);
    
    // Calculate remaining balances for each month
    const totalBalanceData = [];
    let currentTotalBalance = appData.debtAccounts.reduce((sum, debt) => sum + debt.balance, 0);
    
    totalBalanceData.push(currentTotalBalance); // Starting balance
    
    for (let i = 0; i < monthsToShow; i++) {
        const monthData = timeline.monthlySchedule[i];
        currentTotalBalance -= monthData.totalPrincipal;
        totalBalanceData.push(Math.max(0, currentTotalBalance));
    }

    chartInstances.payoffTimelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Start', ...labels],
            datasets: [{
                label: 'Total Debt Balance',
                data: totalBalanceData,
                borderColor: CHART_COLORS[5],
                backgroundColor: 'rgba(219, 69, 69, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Balance: ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function createInterestAnalysisChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("interest-analysis-chart")?.getContext("2d");
    if (!ctx) return;

    // Calculate monthly interest for each debt
    const debtLabels = appData.debtAccounts.map(debt => debt.name);
    const monthlyInterestData = appData.debtAccounts.map(debt => {
        return (debt.balance * (debt.interestRate / 100)) / 12;
    });
    const minimumPaymentData = appData.debtAccounts.map(debt => debt.minimumPayment || 0);
    const principalData = appData.debtAccounts.map((debt, index) => {
        return Math.max(0, minimumPaymentData[index] - monthlyInterestData[index]);
    });

    chartInstances.interestAnalysisChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: debtLabels,
            datasets: [{
                label: 'Principal',
                data: principalData,
                backgroundColor: CHART_COLORS[0],
            }, {
                label: 'Interest',
                data: monthlyInterestData,
                backgroundColor: CHART_COLORS[5],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label;
                            const value = formatCurrency(context.parsed.y);
                            return `${label}: ${value}`;
                        }
                    }
                }
            }
        }
    });
}

function createCreditUtilizationChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("credit-utilization-chart")?.getContext("2d");
    if (!ctx) return;

    const utilization = DebtStrategy.calculateCreditUtilization(appData.debtAccounts);
    
    if (utilization.cards.length === 0) {
        // No credit cards with limits, show empty state
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'var(--color-text-secondary)';
        ctx.fillText('No credit cards with limits found', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    const labels = utilization.cards.map(card => card.name);
    const utilizationData = utilization.cards.map(card => card.utilization);
    
    // Color code based on utilization percentage
    const backgroundColors = utilizationData.map(util => {
        if (util <= 30) return CHART_COLORS[0]; // Good (green/teal)
        if (util <= 50) return CHART_COLORS[6]; // Fair (yellow)
        return CHART_COLORS[5]; // Poor (red)
    });

    chartInstances.creditUtilizationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Credit Utilization %',
                data: utilizationData,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const card = utilization.cards[context.dataIndex];
                            return [
                                `Utilization: ${context.parsed.y.toFixed(1)}%`,
                                `Balance: ${formatCurrency(card.balance)}`,
                                `Limit: ${formatCurrency(card.limit)}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

// Export function to update debt charts
window.updateDebtCharts = function(appState) {
    const chartFunctions = [
        createDebtBreakdownChart,
        createPayoffTimelineChart,
        createInterestAnalysisChart,
        createCreditUtilizationChart
    ];
    
    chartFunctions.forEach(fn => {
        try {
            fn({ appData: appState.appData, CHART_COLORS });
        } catch (error) {
            debug.error(`Error creating debt chart:`, error);
        }
    });
};