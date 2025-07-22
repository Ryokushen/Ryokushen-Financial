// Charts Module - Chart.js Integration for Modern UI

import { formatCurrency } from './ui.js'
import { COLORS } from '../config.js'

// Chart configuration defaults
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 1000,
    easing: 'easeInOutQuart'
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        padding: 10,
        boxWidth: 12,
        boxHeight: 12,
        usePointStyle: true,
        color: 'rgba(255, 255, 255, 0.7)',
        font: {
          size: 11,
          family: "'Inter', sans-serif"
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: 'rgba(255, 255, 255, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: 12,
      bodyFont: {
        size: 12
      },
      callbacks: {
        label: function(context) {
          const label = context.label || ''
          const value = formatCurrency(context.parsed.y || context.parsed)
          return label ? `${label}: ${value}` : value
        }
      }
    }
  }
}

// Store chart instances
const chartInstances = {}

// Initialize all dashboard charts
export function initializeDashboardCharts(appState) {
  // Create containers for charts
  createChartContainers()
  
  // Initialize individual charts
  setTimeout(() => {
    createSpendingChart(appState)
    createTrendChart(appState)
    createIncomeExpenseChart(appState)
    createCategoryBreakdown(appState)
  }, 100)
}

// Create chart containers in the dashboard
function createChartContainers() {
  // Add all charts to the main section in a 2x2 grid
  const dashboardMain = document.querySelector('.dashboard-main')
  if (dashboardMain) {
    const chartsGrid = document.createElement('div')
    chartsGrid.className = 'charts-grid'
    chartsGrid.innerHTML = `
      <div class="chart-card glass-card">
        <div class="chart-header">
          <h3 class="chart-title">
            <span>📊</span>
            Spending Overview
          </h3>
        </div>
        <div class="chart-container">
          <canvas id="spending-chart"></canvas>
        </div>
      </div>
      
      <div class="chart-card glass-card">
        <div class="chart-header">
          <h3 class="chart-title">
            <span>📈</span>
            Net Worth Trend
          </h3>
        </div>
        <div class="chart-container">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>
      
      <div class="chart-card glass-card">
        <div class="chart-header">
          <h3 class="chart-title">
            <span>💰</span>
            Income vs Expenses
          </h3>
        </div>
        <div class="chart-container">
          <canvas id="income-expense-chart"></canvas>
        </div>
      </div>
      
      <div class="chart-card glass-card">
        <div class="chart-header">
          <h3 class="chart-title">
            <span>🏷️</span>
            Top Categories
          </h3>
        </div>
        <div class="chart-container">
          <canvas id="category-chart"></canvas>
        </div>
      </div>
    `
    dashboardMain.appendChild(chartsGrid)
  }
}

// Create spending donut chart
function createSpendingChart(appState) {
  const ctx = document.getElementById('spending-chart')
  if (!ctx) return
  
  // Destroy existing chart
  if (chartInstances.spending) {
    chartInstances.spending.destroy()
  }
  
  // Calculate spending by category for last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const categorySpending = {}
  appState.data.transactions
    .filter(t => {
      const isBalanceAdjustment = t.description?.includes('Balance Adjustment:') || 
                                 t.description?.includes('Debt Balance Adjustment:')
      return new Date(t.date) >= thirtyDaysAgo && t.amount < 0 && !isBalanceAdjustment
    })
    .forEach(t => {
      const category = t.category || 'Other'
      categorySpending[category] = (categorySpending[category] || 0) + Math.abs(t.amount)
    })
  
  // Sort and get top categories
  const sortedCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  
  chartInstances.spending = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sortedCategories.map(([cat]) => cat),
      datasets: [{
        data: sortedCategories.map(([, amount]) => amount),
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',  // Emerald
          'rgba(59, 130, 246, 0.8)',  // Blue
          'rgba(139, 92, 246, 0.8)',  // Purple
          'rgba(245, 158, 11, 0.8)',  // Amber
          'rgba(239, 68, 68, 0.8)',   // Red
          'rgba(107, 114, 128, 0.8)'  // Gray
        ],
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      ...chartDefaults,
      cutout: '65%',
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          ...chartDefaults.plugins.legend,
          position: 'right'
        }
      }
    }
  })
}

// Create net worth trend line chart
function createTrendChart(appState) {
  const ctx = document.getElementById('trend-chart')
  if (!ctx) return
  
  // Destroy existing chart
  if (chartInstances.trend) {
    chartInstances.trend.destroy()
  }
  
  // Calculate current net worth
  const { cashAccounts, investmentAccounts, debtAccounts } = appState.data
  const totalCash = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const totalInvestments = investmentAccounts.reduce((sum, acc) => sum + (acc.current_value || 0), 0)
  const totalDebt = debtAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const currentNetWorth = totalCash + totalInvestments - totalDebt
  
  // Generate estimated historical data based on transaction trends
  const months = []
  const netWorthData = []
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    months.push(date.toLocaleString('default', { month: 'short' }))
    
    // Calculate net transaction flow for each month
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    
    const monthlyFlow = appState.data.transactions
      .filter(t => {
        const tDate = new Date(t.date)
        const isBalanceAdjustment = t.description?.includes('Balance Adjustment:') || 
                                   t.description?.includes('Debt Balance Adjustment:')
        return tDate >= monthStart && tDate <= monthEnd && !isBalanceAdjustment
      })
      .reduce((sum, t) => sum + t.amount, 0)
    
    // Estimate historical net worth by subtracting cumulative flow
    let estimatedNetWorth = currentNetWorth
    for (let j = 0; j < i; j++) {
      // Rough estimate: subtract average monthly flow
      estimatedNetWorth -= monthlyFlow
    }
    
    netWorthData.push(Math.max(0, estimatedNetWorth))
  }
  
  chartInstances.trend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Net Worth',
        data: netWorthData,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: 'rgba(255, 255, 255, 0.8)',
        pointBorderWidth: 2
      }]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: {
              size: 11
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: {
              size: 11
            },
            callback: function(value) {
              return formatCurrency(value, true)
            }
          }
        }
      },
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          display: false
        }
      }
    }
  })
}

// Create income vs expense bar chart
function createIncomeExpenseChart(appState) {
  const ctx = document.getElementById('income-expense-chart')
  if (!ctx) return
  
  // Destroy existing chart
  if (chartInstances.incomeExpense) {
    chartInstances.incomeExpense.destroy()
  }
  
  // Calculate monthly income and expenses for last 3 months
  const monthlyData = []
  const months = []
  
  for (let i = 2; i >= 0; i--) {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - i)
    startDate.setDate(1)
    
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)
    
    const monthTransactions = appState.data.transactions.filter(t => {
      const date = new Date(t.date)
      const isBalanceAdjustment = t.description?.includes('Balance Adjustment:') || 
                                 t.description?.includes('Debt Balance Adjustment:')
      return date >= startDate && date < endDate && !isBalanceAdjustment
    })
    
    const income = monthTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
    
    const expenses = Math.abs(monthTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0))
    
    months.push(startDate.toLocaleString('default', { month: 'short' }))
    monthlyData.push({ income, expenses })
  }
  
  chartInstances.incomeExpense = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: monthlyData.map(d => d.income),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Expenses',
          data: monthlyData.map(d => d.expenses),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      ...chartDefaults,
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: {
              size: 10
            }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: {
              size: 10
            },
            callback: function(value) {
              return formatCurrency(value, true)
            }
          }
        }
      },
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          ...chartDefaults.plugins.legend,
          labels: {
            ...chartDefaults.plugins.legend.labels,
            font: {
              size: 10
            }
          }
        }
      }
    }
  })
}

// Create category breakdown horizontal bar chart
function createCategoryBreakdown(appState) {
  const ctx = document.getElementById('category-chart')
  if (!ctx) return
  
  // Destroy existing chart
  if (chartInstances.category) {
    chartInstances.category.destroy()
  }
  
  // Get top spending categories
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const categorySpending = {}
  appState.data.transactions
    .filter(t => {
      const isBalanceAdjustment = t.description?.includes('Balance Adjustment:') || 
                                 t.description?.includes('Debt Balance Adjustment:')
      return new Date(t.date) >= thirtyDaysAgo && t.amount < 0 && !isBalanceAdjustment
    })
    .forEach(t => {
      const category = t.category || 'Other'
      categorySpending[category] = (categorySpending[category] || 0) + Math.abs(t.amount)
    })
  
  const topCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
  
  chartInstances.category = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topCategories.map(([cat]) => cat),
      datasets: [{
        data: topCategories.map(([, amount]) => amount),
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)'
        ],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: {
              size: 10
            },
            callback: function(value) {
              return formatCurrency(value, true)
            }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: {
              size: 10
            }
          }
        }
      },
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          display: false
        }
      }
    }
  })
}

// Helper function to calculate net worth
function calculateNetWorth(appState) {
  const { cashAccounts, investmentAccounts, debtAccounts } = appState.data
  
  const totalCash = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const totalInvestments = investmentAccounts.reduce((sum, acc) => sum + (acc.current_value || 0), 0)
  const totalDebt = debtAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  
  return totalCash + totalInvestments - totalDebt
}

// Refresh all charts
export function refreshCharts(appState) {
  if (chartInstances.spending) createSpendingChart(appState)
  if (chartInstances.trend) createTrendChart(appState)
  if (chartInstances.incomeExpense) createIncomeExpenseChart(appState)
  if (chartInstances.category) createCategoryBreakdown(appState)
}

// Destroy all charts (cleanup)
export function destroyCharts() {
  Object.values(chartInstances).forEach(chart => {
    if (chart) chart.destroy()
  })
  Object.keys(chartInstances).forEach(key => {
    delete chartInstances[key]
  })
}