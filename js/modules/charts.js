// js/modules/charts.js
import { formatCurrency, CHART_COLORS } from './utils.js';
import { calculateDebtToIncomeRatio } from './kpis.js';
import { debug } from './debug.js';
import { DebtStrategy } from './debtStrategy.js';
import { isPrivacyMode } from './privacy.js';
import { throttle } from './performanceUtils.js';

let chartInstances = {};

// Privacy-aware formatter functions to reduce code duplication
const privacyFormatters = {
    // Standard currency formatter for tooltips
    currencyTooltip: (label, value, showPercentage = false, total = null) => {
        if (isPrivacyMode()) {
            return showPercentage ? `${label}: $*** (**%)` : `${label}: $***`;
        }
        const formattedValue = formatCurrency(value);
        if (showPercentage && total !== null) {
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${formattedValue} (${percentage}%)`;
        }
        return `${label}: ${formattedValue}`;
    },
    
    // Axis tick formatter
    axisTick: (value) => {
        return isPrivacyMode() ? '$***' : formatCurrency(value);
    },
    
    // Percentage formatter
    percentage: (label, value) => {
        if (isPrivacyMode()) {
            return `${label}: **%`;
        }
        return `${label}: ${value.toFixed(1)}%`;
    },
    
    // Multi-line tooltip formatter for complex tooltips
    multiLineTooltip: (lines) => {
        if (isPrivacyMode()) {
            return lines.map(line => {
                if (line.includes('$') || line.includes('Value') || line.includes('Balance') || line.includes('Limit')) {
                    return line.replace(/\$[\d,]+\.?\d*/g, '$***');
                }
                if (line.includes('%') || line.includes('Utilization')) {
                    return line.replace(/\d+\.?\d*%/g, '**%');
                }
                return line;
            });
        }
        return lines;
    }
};

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

    const chart = new Chart(ctx, {
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
                tooltip: { 
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const dti = calculateDebtToIncomeRatio(appData);
                            return privacyFormatters.percentage('DTI', dti);
                        }
                    }
                }
            }
        },
        plugins: [{
            beforeDraw: function(chart) {
                const width = chart.width;
                const height = chart.height;
                const ctx = chart.ctx;
                
                ctx.restore();
                const fontSize = (height / 114).toFixed(2);
                ctx.font = fontSize + "em sans-serif";
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                
                const text = isPrivacyMode() ? "**%" : dti.toFixed(1) + "%";
                const textX = Math.round(width / 2);
                const textY = height - 20;
                
                ctx.fillText(text, textX, textY);
                ctx.save();
            }
        }]
    });
    
    chartInstances.debtHealthGauge = chart;
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
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            return privacyFormatters.currencyTooltip(label, context.parsed, true, total);
                        }
                    }
                }
            }
        }
    });
}


// Track if privacy mode has changed
let lastPrivacyMode = null;

// Create throttled version of createCharts for better performance
const throttledCreateCharts = throttle((appState) => {
    createChartsInternal(appState);
}, 250);

export function createCharts(appState) {
    // Use throttled version for non-critical updates
    if (document.hidden) {
        // If document is hidden, delay chart creation
        return;
    }
    throttledCreateCharts(appState);
}

// Export immediate version for critical updates
export function createChartsImmediate(appState) {
    createChartsInternal(appState);
}

// Original createCharts renamed to internal version
function createChartsInternal(appState) {
    try {
        const currentPrivacyMode = isPrivacyMode();
        const privacyModeChanged = lastPrivacyMode !== null && lastPrivacyMode !== currentPrivacyMode;
        lastPrivacyMode = currentPrivacyMode;
        
        // Get the current active tab
        const activeTab = document.querySelector('.tab-content.active');
        const activeTabId = activeTab ? activeTab.id : 'dashboard';
        
        // Only destroy and recreate charts if privacy mode changed
        if (privacyModeChanged) {
            Object.keys(chartInstances).forEach(key => {
                if (chartInstances[key]) {
                    chartInstances[key].destroy();
                    delete chartInstances[key];
                }
            });
        }

        // Only create/update charts that exist on the current tab
        if (activeTabId === 'dashboard') {
            // Dashboard charts only
            updateOrCreateChart('debtHealthGauge', () => createDebtHealthGauge({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
            updateOrCreateChart('investmentAllocation', () => createInvestmentAllocationChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
            updateOrCreateChart('netWorthChart', () => createNetWorthChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
            updateOrCreateChart('expenseCategoryChart', () => createExpenseCategoryChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
            updateOrCreateChart('cashFlowChart', () => createCashFlowChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
            updateOrCreateChart('assetsDebtChart', () => createAssetsDebtChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
        } else if (activeTabId === 'debt') {
            // Debt-specific charts only
            updateOrCreateChart('debtBreakdownChart', () => createDebtBreakdownChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
            updateOrCreateChart('payoffTimelineChart', () => createPayoffTimelineChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
            updateOrCreateChart('interestAnalysisChart', () => createInterestAnalysisChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
            updateOrCreateChart('creditUtilizationChart', () => createCreditUtilizationChart({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS }), appState);
        }
        // Other tabs don't have charts managed by createCharts()

    } catch (error) {
        debug.error("Error creating charts:", error);
    }
}

// Helper function to update existing chart or create new one
function updateOrCreateChart(chartName, createFn, appState) {
    const canvasId = getCanvasIdForChart(chartName);
    if (!document.getElementById(canvasId)) return;
    
    if (chartInstances[chartName]) {
        // Try to update existing chart data without recreating
        try {
            updateChartData(chartName, appState);
            // Use Chart.js update() method for efficient updates
            chartInstances[chartName].update('none'); // 'none' skips animations for performance
        } catch (error) {
            // If update fails, recreate the chart
            debug.warn(`Failed to update ${chartName}, recreating:`, error);
            chartInstances[chartName].destroy();
            delete chartInstances[chartName];
            createFn();
        }
    } else {
        // Create new chart
        createFn();
    }
}

// Map chart names to canvas IDs
function getCanvasIdForChart(chartName) {
    const mapping = {
        'debtHealthGauge': 'debtHealthGauge',
        'investmentAllocation': 'investmentAllocation',
        'netWorthChart': 'netWorthChart',
        'expenseCategoryChart': 'expenseCategoryChart',
        'cashFlowChart': 'cashFlowChart',
        'assetsDebtChart': 'assetsDebtChart',
        'debtBreakdownChart': 'debt-breakdown-chart',
        'payoffTimelineChart': 'payoff-timeline-chart',
        'interestAnalysisChart': 'interest-analysis-chart',
        'creditUtilizationChart': 'credit-utilization-chart',
        'investmentGrowthChart': 'investment-growth-chart',
        'contributionComparisonChart': 'contribution-comparison-chart'
    };
    return mapping[chartName] || chartName;
}

// Update chart data without recreating
function updateChartData(chartName, appState) {
    const chart = chartInstances[chartName];
    if (!chart) return;
    
    const { appData } = appState;
    
    switch (chartName) {
        case 'debtHealthGauge':
            const dti = calculateDebtToIncomeRatio(appData);
            const gaugeMax = 60;
            const value = Math.min(dti, gaugeMax);
            chart.data.datasets[0].data = [value, gaugeMax - value];
            
            // Update needle color
            let needleColor = appState.CHART_COLORS[5];
            if (dti <= 20) needleColor = appState.CHART_COLORS[0];
            else if (dti <= 35) needleColor = appState.CHART_COLORS[7];
            else if (dti <= 43) needleColor = appState.CHART_COLORS[6];
            chart.data.datasets[0].backgroundColor[0] = needleColor;
            break;
            
        case 'investmentAllocation':
            const allocationData = appData.investmentAccounts.reduce((acc, account) => {
                const type = account.accountType || 'Other';
                if (!acc[type]) acc[type] = 0;
                acc[type] += account.balance;
                return acc;
            }, {});
            chart.data.labels = Object.keys(allocationData);
            chart.data.datasets[0].data = Object.values(allocationData);
            break;
            
        case 'expenseCategoryChart':
            const expenseData = {};
            appData.transactions
                .filter(t => (t.amount < 0 && t.category !== 'Transfer') || (t.amount > 0 && t.debt_account_id && t.category !== 'Payment'))
                .forEach(t => {
                    if (!expenseData[t.category]) expenseData[t.category] = 0;
                    expenseData[t.category] += Math.abs(t.amount);
                });
            chart.data.labels = Object.keys(expenseData);
            chart.data.datasets[0].data = Object.values(expenseData);
            break;
            
        case 'assetsDebtChart':
            const totalCash = appData.cashAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
            const totalInvestments = appData.investmentAccounts.reduce((sum, account) => sum + account.balance, 0);
            const totalDebt = appData.debtAccounts.reduce((sum, account) => sum + account.balance, 0);
            chart.data.datasets[0].data = [totalCash + totalInvestments, totalDebt];
            break;
            
        // Add more cases for other charts as needed
        default:
            // For charts we haven't optimized yet, throw error to trigger recreation
            throw new Error(`Update not implemented for ${chartName}`);
    }
    
    // Update the chart
    chart.update('none'); // 'none' animation mode for better performance
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
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const privacyEnabled = isPrivacyMode();
                            return privacyFormatters.currencyTooltip('Net Worth', context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: privacyFormatters.axisTick
                    }
                }
            }
        }
    });
}

function createExpenseCategoryChart({ appData, CHART_COLORS }) {
    const ctx = document.getElementById("expenseCategoryChart").getContext("2d");
    if (!ctx) return;

    const expenseData = {};

    appData.transactions
        // Filter: negative amounts (expenses) excluding transfers, OR positive debt payments (but not Payment category to avoid double counting)
        .filter(t => (t.amount < 0 && t.category !== 'Transfer') || (t.amount > 0 && t.debt_account_id && t.category !== 'Payment'))
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
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            return privacyFormatters.currencyTooltip(label, context.parsed, true, total);
                        }
                    }
                }
            }
        }
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
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label;
                            return privacyFormatters.currencyTooltip(label, context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: privacyFormatters.axisTick
                    }
                }
            }
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
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label;
                            return privacyFormatters.currencyTooltip(label, context.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: privacyFormatters.axisTick
                    }
                }
            }
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
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            return privacyFormatters.currencyTooltip(label, context.parsed, true, total);
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
                            return privacyFormatters.currencyTooltip('Balance', context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: privacyFormatters.axisTick
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
                        callback: privacyFormatters.axisTick
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label;
                            return privacyFormatters.currencyTooltip(label, context.parsed.y);
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
                            return isPrivacyMode() ? '**%' : value + '%';
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const card = utilization.cards[context.dataIndex];
                            const lines = [
                                `Utilization: ${context.parsed.y.toFixed(1)}%`,
                                `Balance: ${formatCurrency(card.balance)}`,
                                `Limit: ${formatCurrency(card.limit)}`
                            ];
                            return privacyFormatters.multiLineTooltip(lines);
                        }
                    }
                }
            }
        }
    });
}

// Investment Planning Chart Functions
function createInvestmentGrowthChart(data, chartType) {
    const ctx = document.getElementById("investment-growth-chart")?.getContext("2d");
    if (!ctx) return;

    let chartData = {};
    let options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return privacyFormatters.currencyTooltip(context.dataset.label, context.parsed.y);
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: privacyFormatters.axisTick
                }
            }
        }
    };

    if (chartType === 'contribution' || chartType === 'retirement') {
        // Bar chart for scenarios comparison
        const scenarios = data;
        chartData = {
            labels: scenarios.map(s => `${s.rate}% Return`),
            datasets: [{
                label: chartType === 'contribution' ? 'Future Value' : 'Required Monthly',
                data: scenarios.map(s => chartType === 'contribution' ? s.futureValue : s.requiredMonthlyContribution),
                backgroundColor: CHART_COLORS[0],
                borderColor: CHART_COLORS[0],
                borderWidth: 1
            }]
        };
        
        chartInstances.investmentGrowthChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: options
        });
    } else if (chartType === 'growth') {
        // Line chart for portfolio growth over time
        const timeline = data.timeline.slice(0, Math.min(data.timeline.length, 21)); // Show max 20 years
        
        const datasets = data.returnRates.map((rate, index) => ({
            label: `${rate}% Annual Return`,
            data: timeline.map(point => point.values[`rate_${rate}`]),
            borderColor: CHART_COLORS[index],
            backgroundColor: `${CHART_COLORS[index]}20`,
            borderWidth: 2,
            fill: false,
            tension: 0.1
        }));

        chartData = {
            labels: timeline.map(point => `Year ${point.year}`),
            datasets: datasets
        };
        
        chartInstances.investmentGrowthChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: options
        });
    }
}

function createContributionComparisonChart(data, chartType) {
    const ctx = document.getElementById("contribution-comparison-chart")?.getContext("2d");
    if (!ctx) return;

    if (chartType === 'contribution') {
        // Stacked bar showing contributions vs growth
        const scenarios = data;
        
        chartInstances.contributionComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: scenarios.map(s => `${s.rate}%`),
                datasets: [{
                    label: 'Contributions',
                    data: scenarios.map(s => s.totalContributed),
                    backgroundColor: CHART_COLORS[1],
                }, {
                    label: 'Investment Growth',
                    data: scenarios.map(s => s.totalEarnings),
                    backgroundColor: CHART_COLORS[0],
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
                            callback: privacyFormatters.axisTick
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return privacyFormatters.currencyTooltip(context.dataset.label, context.parsed.y);
                            }
                        }
                    }
                }
            }
        });
    } else if (chartType === 'retirement') {
        // Pie chart showing contribution vs earnings split for middle scenario
        if (!data || data.length === 0) {
            debug.warn('No data provided for retirement chart');
            return;
        }
        
        const middleScenario = data[Math.floor(data.length / 2)];
        
        // Handle case where earnings might be negative or zero
        let contributionsValue = Math.max(0, middleScenario.totalContributions || 0);
        let earningsValue = Math.max(0, middleScenario.projectedEarnings || 0);
        
        // Special handling for cases where no contributions are needed
        if (contributionsValue === 0 && earningsValue > 0) {
            // All growth comes from existing portfolio
            contributionsValue = 0.01; // Small slice to show in legend
        } else if (earningsValue === 0 && contributionsValue > 0) {
            // No earnings (shouldn't happen but just in case)
            earningsValue = 0.01;
        } else if (contributionsValue === 0 && earningsValue === 0) {
            // Edge case - show 50/50 placeholder
            contributionsValue = 1;
            earningsValue = 1;
        }
        
        chartInstances.contributionComparisonChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Total Contributions', 'Investment Earnings'],
                datasets: [{
                    data: [contributionsValue, earningsValue],
                    backgroundColor: [CHART_COLORS[1], CHART_COLORS[0]],
                    borderColor: 'var(--color-surface-translucent)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const originalValue = context.dataIndex === 0 ? middleScenario.totalContributions : middleScenario.projectedEarnings;
                                
                                if (originalValue === 0) {
                                    return isPrivacyMode() ? `${label}: $*** (None needed!)` : `${label}: $0.00 (None needed!)`;
                                }
                                
                                const total = middleScenario.totalContributions + middleScenario.projectedEarnings;
                                return privacyFormatters.currencyTooltip(label, originalValue, true, total);
                            }
                        }
                    }
                }
            }
        });
    } else if (chartType === 'growth') {
        // Bar chart comparing final values at different return rates
        const finalYear = data.timeline[data.timeline.length - 1];
        
        chartInstances.contributionComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.returnRates.map(rate => `${rate}% Return`),
                datasets: [{
                    label: 'Final Portfolio Value',
                    data: data.returnRates.map(rate => finalYear.values[`rate_${rate}`]),
                    backgroundColor: data.returnRates.map((_, index) => CHART_COLORS[index]),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return privacyFormatters.currencyTooltip('Final Value', context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: privacyFormatters.axisTick
                        }
                    }
                }
            }
        });
    }
}

// Export function to update debt charts
window.updateDebtCharts = function(appState) {
    // Only update debt charts if we're on the debt tab
    const activeTab = document.querySelector('.tab-content.active');
    const activeTabId = activeTab ? activeTab.id : '';
    
    if (activeTabId !== 'debt') {
        return;
    }
    
    // Destroy existing debt chart instances before creating new ones
    const debtChartKeys = ['debtBreakdownChart', 'payoffTimelineChart', 'interestAnalysisChart', 'creditUtilizationChart'];
    debtChartKeys.forEach(key => {
        if (chartInstances[key]) {
            chartInstances[key].destroy();
            delete chartInstances[key];
        }
    });
    
    const chartFunctions = [
        createDebtBreakdownChart,
        createPayoffTimelineChart,
        createInterestAnalysisChart,
        createCreditUtilizationChart
    ];
    
    chartFunctions.forEach(fn => {
        try {
            fn({ appData: appState.appData, CHART_COLORS: appState.CHART_COLORS || CHART_COLORS });
        } catch (error) {
            debug.error(`Error creating debt chart:`, error);
        }
    });
};

// Export function to update investment charts
window.updateInvestmentCharts = function(data, chartType) {
    // Only update investment charts if we're on the investments tab
    const activeTab = document.querySelector('.tab-content.active');
    const activeTabId = activeTab ? activeTab.id : '';
    
    if (activeTabId !== 'investments') {
        return;
    }
    
    try {
        // Store the last data and type for privacy mode refresh
        window.lastInvestmentData = data;
        window.lastInvestmentChartType = chartType;
        
        // Destroy existing charts first
        if (chartInstances.investmentGrowthChart) {
            chartInstances.investmentGrowthChart.destroy();
            delete chartInstances.investmentGrowthChart;
        }
        if (chartInstances.contributionComparisonChart) {
            chartInstances.contributionComparisonChart.destroy();
            delete chartInstances.contributionComparisonChart;
        }
        
        createInvestmentGrowthChart(data, chartType);
        createContributionComparisonChart(data, chartType);
    } catch (error) {
        debug.error('Error creating investment charts:', error);
    }
};