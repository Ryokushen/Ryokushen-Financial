// Dashboard Module

import { formatCurrency, maskCurrency, createSkeleton } from './ui.js'
import { FEATURES, COLORS, HEALTH_THRESHOLDS } from '../config.js'
import { initializeDashboardCharts, refreshCharts as refreshChartsModule } from './charts.js'

// Initialize dashboard
export async function initDashboard(appState) {
  // Calculate initial metrics
  calculateMetrics(appState)
  
  // Set up real-time updates if available
  if (FEATURES.REAL_TIME_UPDATES) {
    setupRealtimeUpdates(appState)
  }
}

// Render dashboard
export async function renderDashboard(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  // Calculate metrics
  const metrics = calculateMetrics(appState)
  
  container.innerHTML = `
    <div class="dashboard-page">
      ${renderNetWorthHero(metrics, appState.privacyMode)}
      
      <div class="dashboard-layout">
        <div class="dashboard-main">
          ${renderAccountCards(metrics, appState.privacyMode)}
        </div>
        
        <div class="dashboard-sidebar">
          ${renderFinancialHealth(metrics)}
          ${renderRecentActivity(appState)}
        </div>
      </div>
      
      <div class="dashboard-bottom">
        <div class="bottom-main">
          ${renderMonthlyBudget(appState)}
        </div>
      </div>
    </div>
  `
  
  // Initialize charts after DOM is ready
  setTimeout(() => {
    initializeDashboardCharts(appState)
  }, 100)
  
  // Setup event handlers
  setupDashboardEventHandlers()
}

// Calculate dashboard metrics
function calculateMetrics(appState) {
  const { cashAccounts, investmentAccounts, debtAccounts, transactions, recurringBills } = appState.data
  
  // Calculate totals
  const totalCash = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const totalInvestments = investmentAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  const totalDebt = debtAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  
  // Calculate net worth
  const totalAssets = totalCash + totalInvestments
  const netWorth = totalAssets - totalDebt
  
  // Calculate monthly income/expenses (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const recentTransactions = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo)
  const monthlyIncome = recentTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  const monthlyExpenses = Math.abs(recentTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0))
  
  // Calculate trends by comparing to previous period (30-60 days ago)
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  
  const previousPeriodTransactions = transactions.filter(t => {
    const date = new Date(t.date)
    return date >= sixtyDaysAgo && date < thirtyDaysAgo
  })
  
  // Calculate previous period metrics
  const prevIncome = previousPeriodTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  const prevExpenses = Math.abs(previousPeriodTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0))
  
  // Calculate cash balance trend
  const cashTransactions = recentTransactions
    .filter(t => cashAccounts.some(acc => acc.id === t.account_id))
  const cashFlow = cashTransactions.reduce((sum, t) => sum + t.amount, 0)
  const prevCashTransactions = previousPeriodTransactions
    .filter(t => cashAccounts.some(acc => acc.id === t.account_id))
  const prevCashFlow = prevCashTransactions.reduce((sum, t) => sum + t.amount, 0)
  const cashChange = prevCashFlow !== 0 ? (cashFlow - prevCashFlow) / Math.abs(prevCashFlow) : 0
  
  // Calculate income/expense trends
  const incomeChange = prevIncome > 0 ? (monthlyIncome - prevIncome) / prevIncome : 0
  const expenseChange = prevExpenses > 0 ? (monthlyExpenses - prevExpenses) / prevExpenses : 0
  
  // Estimate net worth change based on cash flow (simplified since we don't have historical balances)
  const netWorthChange = totalAssets > 0 ? cashFlow / totalAssets : 0
  
  // For investment and debt changes, use placeholder values if no historical data
  const investmentChange = 0.082 // Will be calculated when investment module is updated
  const debtChange = -0.021 // Will be calculated when debt module is updated
  
  // Calculate total monthly bills from recurring bills
  const monthlyBills = recurringBills
    .filter(bill => bill.is_active)
    .reduce((total, bill) => {
      // Convert frequency to monthly amount
      let monthlyAmount = bill.amount
      switch (bill.frequency) {
        case 'weekly':
          monthlyAmount = bill.amount * 4.33 // Average weeks per month
          break
        case 'bi-weekly':
          monthlyAmount = bill.amount * 2.17
          break
        case 'quarterly':
          monthlyAmount = bill.amount / 3
          break
        case 'annually':
          monthlyAmount = bill.amount / 12
          break
        // 'monthly' is already correct
      }
      return total + monthlyAmount
    }, 0)
  
  // Calculate financial health metrics
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0
  const emergencyFund = monthlyExpenses > 0 ? totalCash / monthlyExpenses : 0
  const debtRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0
  
  return {
    totalCash,
    totalInvestments,
    totalDebt,
    totalAssets,
    netWorth,
    monthlyIncome,
    monthlyExpenses,
    monthlyBills,
    netWorthChange,
    cashChange,
    investmentChange,
    debtChange,
    incomeChange,
    expenseChange,
    savingsRate,
    emergencyFund,
    debtRatio,
  }
}

// Render net worth hero section
function renderNetWorthHero(metrics, privacyMode) {
  const changeClass = metrics.netWorthChange >= 0 ? 'positive' : 'negative'
  const changeIcon = metrics.netWorthChange >= 0 ? '📈' : '📉'
  
  return `
    <div class="net-worth-hero glass-hero">
      <div class="net-worth-content">
        <div class="net-worth-header">
          <div class="flex items-center">
            <div class="net-worth-icon">
              <span>🐷</span>
            </div>
            <div>
              <p class="net-worth-label">Total Net Worth</p>
              <p class="net-worth-value">${maskCurrency(metrics.netWorth, privacyMode)}</p>
            </div>
          </div>
          
          <div class="net-worth-trend">
            <div class="trend-indicator ${changeClass}">
              <span>${changeIcon}</span>
              <span>${metrics.netWorthChange >= 0 ? '+' : ''}${(metrics.netWorthChange * 100).toFixed(1)}%</span>
            </div>
            <p class="trend-label">vs last month</p>
          </div>
        </div>
        
        <div class="quick-stats">
          <div class="stat-card">
            <p class="stat-label">Assets</p>
            <p class="stat-value">${maskCurrency(metrics.totalAssets, privacyMode)}</p>
            <span class="stat-change ${metrics.cashChange >= 0 ? 'positive' : 'negative'}">${metrics.cashChange >= 0 ? '+' : ''}${(metrics.cashChange * 100).toFixed(1)}%</span>
          </div>
          
          <div class="stat-card">
            <p class="stat-label">Liabilities</p>
            <p class="stat-value">${maskCurrency(metrics.totalDebt, privacyMode)}</p>
            <span class="stat-change ${metrics.debtChange <= 0 ? 'positive' : 'negative'}">${metrics.debtChange >= 0 ? '+' : ''}${(metrics.debtChange * 100).toFixed(1)}%</span>
          </div>
          
          <div class="stat-card">
            <p class="stat-label">Monthly Income</p>
            <p class="stat-value">${maskCurrency(metrics.monthlyIncome, privacyMode)}</p>
            <span class="stat-change ${metrics.incomeChange >= 0 ? 'positive' : 'negative'}">${metrics.incomeChange >= 0 ? '+' : ''}${(metrics.incomeChange * 100).toFixed(1)}%</span>
          </div>
          
          <div class="stat-card">
            <p class="stat-label">Monthly Expenses</p>
            <p class="stat-value">${maskCurrency(metrics.monthlyExpenses, privacyMode)}</p>
            <span class="stat-change ${metrics.expenseChange <= 0 ? 'positive' : 'negative'}">${metrics.expenseChange >= 0 ? '+' : ''}${(metrics.expenseChange * 100).toFixed(1)}%</span>
          </div>
        </div>
        
        <div class="quick-actions">
          <button class="btn btn-primary btn-sm" id="quick-expense-btn">+ Quick Expense</button>
          <button class="btn btn-secondary btn-sm" id="quick-income-btn">+ Quick Income</button>
        </div>
      </div>
    </div>
  `
}

// Render account cards
function renderAccountCards(metrics, privacyMode) {
  const cards = [
    {
      title: 'Cash Balance',
      value: metrics.totalCash,
      change: `${metrics.cashChange >= 0 ? '+' : ''}${(metrics.cashChange * 100).toFixed(1)}%`,
      icon: '💵',
      color: 'cash'
    },
    {
      title: 'Investments',
      value: metrics.totalInvestments,
      change: `${metrics.investmentChange >= 0 ? '+' : ''}${(metrics.investmentChange * 100).toFixed(1)}%`,
      icon: '📈',
      color: 'investment'
    },
    {
      title: 'Total Debt',
      value: metrics.totalDebt,
      change: `${metrics.debtChange >= 0 ? '+' : ''}${(metrics.debtChange * 100).toFixed(1)}%`,
      icon: '💳',
      color: 'debt'
    },
    {
      title: 'Monthly Bills',
      value: metrics.monthlyBills,
      change: `${metrics.expenseChange >= 0 ? '+' : ''}${(metrics.expenseChange * 100).toFixed(1)}%`,
      icon: '📅',
      color: 'monthly'
    }
  ]
  
  return `
    <div class="card-grid-4 mb-6">
      ${cards.map(card => `
        <div class="metric-card glass-card--${card.color} hover-lift">
          <div class="metric-card-header">
            <span class="metric-icon">${card.icon}</span>
            <span class="metric-change">${card.change}</span>
          </div>
          <div>
            <p class="metric-title">${card.title}</p>
            <p class="metric-value">${maskCurrency(card.value, privacyMode)}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

// Render monthly budget
function renderMonthlyBudget(appState) {
  // Calculate spending by category for current month
  const currentDate = new Date()
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  
  // Get current month transactions
  const monthTransactions = appState.data.transactions.filter(t => {
    const date = new Date(t.date)
    return date >= startOfMonth && t.amount < 0 // Only expenses
  })
  
  // Calculate spending by category
  const categorySpending = {}
  monthTransactions.forEach(t => {
    const category = t.category || 'Other'
    categorySpending[category] = (categorySpending[category] || 0) + Math.abs(t.amount)
  })
  
  // Define category icons
  const categoryIcons = {
    'Housing': '🏠',
    'Food': '🛒',
    'Transportation': '🚗',
    'Transport': '🚗',
    'Entertainment': '☕',
    'Travel': '✈️',
    'Utilities': '💡',
    'Healthcare': '🏥',
    'Shopping': '🛍️',
    'Education': '📚',
    'Income': '💼',
    'Other': '📌'
  }
  
  // Get top 5 spending categories
  const topCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  
  // Create budget items with estimated budgets (since we don't have budget module yet)
  const budgetItems = topCategories.map(([category, spent]) => {
    // Estimate budget as 120% of spent (will be replaced when budget module is implemented)
    const estimatedBudget = spent * 1.2
    return {
      category,
      spent,
      budget: estimatedBudget,
      icon: categoryIcons[category] || '💰'
    }
  })
  
  // Add any categories with 0 spending if less than 5 categories
  if (budgetItems.length < 5) {
    const missingCategories = ['Housing', 'Food', 'Transportation', 'Entertainment', 'Travel']
      .filter(cat => !budgetItems.some(item => item.category === cat))
      .slice(0, 5 - budgetItems.length)
    
    missingCategories.forEach(category => {
      budgetItems.push({
        category,
        spent: 0,
        budget: 500, // Default budget
        icon: categoryIcons[category] || '💰'
      })
    })
  }
  
  return `
    <div class="budget-card">
      <div class="budget-header">
        <h3 class="budget-title">
          <span>🎯</span>
          Monthly Budget
        </h3>
        <a href="#" class="budget-view-all">
          View All →
        </a>
      </div>
      
      <div class="budget-items">
        ${budgetItems.map(item => {
          const percentage = (item.spent / item.budget) * 100
          const status = percentage > 80 ? 'danger' : percentage > 60 ? 'warning' : 'safe'
          
          return `
            <div class="budget-item">
              <div class="budget-category">
                <span class="budget-icon">${item.icon}</span>
                <span class="budget-name">${item.category}</span>
              </div>
              
              <div class="budget-progress-container">
                <div class="budget-amounts">
                  <span class="budget-spent">${formatCurrency(item.spent)} / ${formatCurrency(item.budget)}</span>
                  <span class="budget-percentage ${status}">${percentage.toFixed(0)}%</span>
                </div>
                <div class="budget-progress">
                  <div class="budget-progress-fill bg-${status}" style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

// Render financial health score
function renderFinancialHealth(metrics) {
  // Calculate health score
  const healthScore = calculateHealthScore(metrics)
  const grade = getHealthGrade(healthScore)
  
  return `
    <div class="health-score-card">
      <div class="health-score-header">
        <span class="health-score-icon">🛡️</span>
        <h3 class="health-score-title">Financial Health</h3>
      </div>
      
      <div class="health-score-visual">
        <div class="health-score-circle">
          <svg viewBox="0 0 120 120">
            <defs>
              <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#34d399;stop-opacity:1" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="48" class="health-circle-bg" />
            <circle 
              cx="60" cy="60" r="48" 
              class="health-circle-progress"
              style="stroke-dasharray: ${2 * Math.PI * 48}; stroke-dashoffset: ${2 * Math.PI * 48 * (1 - healthScore / 100)}"
            />
          </svg>
          <div class="health-score-grade">
            <span class="grade-value">${grade}</span>
            <span class="grade-label">${getGradeLabel(grade)}</span>
          </div>
        </div>
      </div>
      
      <div class="health-metrics">
        <div class="health-metric">
          <span class="health-metric-label">Savings Rate</span>
          <div class="health-metric-value">
            <span>${metrics.savingsRate.toFixed(1)}%</span>
            <div class="health-indicator ${getHealthStatus(metrics.savingsRate, 'savingsRate')}"></div>
          </div>
        </div>
        
        <div class="health-metric">
          <span class="health-metric-label">Emergency Fund</span>
          <div class="health-metric-value">
            <span>${metrics.emergencyFund.toFixed(1)} mos</span>
            <div class="health-indicator ${getHealthStatus(metrics.emergencyFund, 'emergencyFund')}"></div>
          </div>
        </div>
        
        <div class="health-metric">
          <span class="health-metric-label">Debt Ratio</span>
          <div class="health-metric-value">
            <span>${metrics.debtRatio.toFixed(1)}%</span>
            <div class="health-indicator ${getHealthStatus(metrics.debtRatio, 'debtRatio')}"></div>
          </div>
        </div>
      </div>
    </div>
  `
}

// Render recent activity
function renderRecentActivity(appState) {
  const recentTransactions = appState.data.transactions.slice(0, 6)
  
  return `
    <div class="activity-card">
      <div class="activity-header">
        <h3 class="activity-title">
          <span>⚡</span>
          Recent Activity
        </h3>
        <a href="#" class="budget-view-all">
          View All →
        </a>
      </div>
      
      <div class="activity-list">
        ${recentTransactions.map(transaction => {
          const isIncome = transaction.amount > 0
          const icon = getTransactionIcon(transaction.category)
          
          return `
            <div class="activity-item">
              <div class="activity-icon ${isIncome ? 'income' : 'expense'}">
                <span>${icon}</span>
              </div>
              
              <div class="activity-details">
                <p class="activity-description">${transaction.description}</p>
                <p class="activity-time">${getRelativeTime(transaction.date)}</p>
              </div>
              
              <div class="activity-amount">
                <p class="activity-value ${isIncome ? 'positive' : ''}">
                  ${isIncome ? '+' : ''}${formatCurrency(Math.abs(transaction.amount))}
                </p>
              </div>
            </div>
          `
        }).join('')}
        
        ${recentTransactions.length === 0 ? '<p class="empty-state">No recent transactions</p>' : ''}
      </div>
    </div>
  `
}

// Helper functions
function calculateHealthScore(metrics) {
  // Simple scoring algorithm
  let score = 0
  
  // Savings rate (30 points max)
  if (metrics.savingsRate >= 20) score += 30
  else if (metrics.savingsRate >= 15) score += 25
  else if (metrics.savingsRate >= 10) score += 20
  else if (metrics.savingsRate >= 5) score += 10
  
  // Emergency fund (40 points max)
  if (metrics.emergencyFund >= 6) score += 40
  else if (metrics.emergencyFund >= 3) score += 30
  else if (metrics.emergencyFund >= 1) score += 20
  else if (metrics.emergencyFund >= 0.5) score += 10
  
  // Debt ratio (30 points max)
  if (metrics.debtRatio <= 20) score += 30
  else if (metrics.debtRatio <= 35) score += 20
  else if (metrics.debtRatio <= 50) score += 10
  else if (metrics.debtRatio <= 75) score += 5
  
  return Math.min(score, 100)
}

function getHealthGrade(score) {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 75) return 'B+'
  if (score >= 70) return 'B'
  if (score >= 65) return 'C+'
  if (score >= 60) return 'C'
  if (score >= 55) return 'D+'
  if (score >= 50) return 'D'
  return 'F'
}

function getGradeLabel(grade) {
  if (grade.startsWith('A')) return 'Excellent'
  if (grade.startsWith('B')) return 'Good'
  if (grade.startsWith('C')) return 'Fair'
  if (grade.startsWith('D')) return 'Poor'
  return 'Critical'
}

function getHealthStatus(value, metric) {
  const thresholds = HEALTH_THRESHOLDS[metric]
  if (!thresholds) return 'warning'
  
  if (metric === 'debtRatio') {
    // Lower is better for debt ratio
    if (value <= thresholds.excellent) return 'excellent'
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.fair) return 'warning'
    return 'danger'
  } else {
    // Higher is better for other metrics
    if (value >= thresholds.excellent) return 'excellent'
    if (value >= thresholds.good) return 'good'
    if (value >= thresholds.fair) return 'warning'
    return 'danger'
  }
}

function getTransactionIcon(category) {
  const icons = {
    'Income': '💼',
    'Housing': '🏠',
    'Transportation': '🚗',
    'Food': '🍔',
    'Shopping': '🛍️',
    'Entertainment': '🎮',
    'Healthcare': '🏥',
    'Education': '📚',
    'Travel': '✈️',
    'Utilities': '💡',
    'Investment': '📈',
    'Savings': '🏦',
  }
  return icons[category] || '💰'
}

function getRelativeTime(date) {
  const now = new Date()
  const d = new Date(date)
  const diff = now - d
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`
  
  return d.toLocaleDateString()
}

// Set up real-time updates
function setupRealtimeUpdates(appState) {
  // TODO: Implement real-time subscriptions
  console.log('Real-time updates pending...')
}

// Refresh charts
export function refreshCharts(appState) {
  refreshChartsModule(appState)
}

// Setup dashboard event handlers
function setupDashboardEventHandlers() {
  // Quick Expense button
  const quickExpenseBtn = document.getElementById('quick-expense-btn')
  if (quickExpenseBtn) {
    quickExpenseBtn.addEventListener('click', async () => {
      const { showQuickExpenseModal } = await import('./transactionForms.js')
      await showQuickExpenseModal()
    })
  }
  
  // Quick Income button (reuse transaction form with income preset)
  const quickIncomeBtn = document.getElementById('quick-income-btn')
  if (quickIncomeBtn) {
    quickIncomeBtn.addEventListener('click', async () => {
      const { showTransactionModal } = await import('./transactionForms.js')
      await showTransactionModal({ type: 'income' })
    })
  }
}