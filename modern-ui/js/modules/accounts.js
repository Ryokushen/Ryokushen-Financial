// Accounts Module

import { getCashAccounts, getInvestmentAccounts, getDebtAccounts } from './database.js'
import { formatCurrency, maskCurrency } from './ui.js'

// Load all accounts from database
export async function loadAccounts() {
  try {
    const [cashAccounts, investmentAccounts, debtAccounts] = await Promise.all([
      getCashAccounts(),
      getInvestmentAccounts(),
      getDebtAccounts()
    ])
    
    return {
      cashAccounts: cashAccounts || [],
      investmentAccounts: investmentAccounts || [],
      debtAccounts: debtAccounts || []
    }
  } catch (error) {
    console.error('Failed to load accounts:', error)
    return {
      cashAccounts: [],
      investmentAccounts: [],
      debtAccounts: []
    }
  }
}

// Render accounts page (cash accounts only)
export async function renderAccounts(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  const totalCash = calculateTotalCash(appState.data.cashAccounts)
  
  container.innerHTML = `
    <div class="accounts-page">
      <div class="page-header mb-6">
        <h2>Cash Accounts</h2>
        <button class="btn btn-primary">Add Cash Account</button>
      </div>
      
      <div class="mb-6">
        <div class="metric-card glass-card--cash" style="max-width: 300px;">
          <div class="metric-card-header">
            <span class="metric-icon">💰</span>
            <span class="metric-change">+5.2%</span>
          </div>
          <div>
            <p class="metric-title">Total Cash Balance</p>
            <p class="metric-value">${maskCurrency(totalCash, appState.privacyMode)}</p>
          </div>
        </div>
      </div>
      
      <div class="accounts-sections">
        ${renderCashAccounts(appState.data.cashAccounts, appState.privacyMode)}
      </div>
    </div>
  `
}

// Calculate totals
function calculateTotalCash(accounts) {
  return accounts.reduce((sum, account) => sum + (account.balance || 0), 0)
}

function calculateTotalInvestments(accounts) {
  return accounts.reduce((sum, account) => sum + (account.current_value || 0), 0)
}

function calculateTotalDebt(accounts) {
  return accounts.reduce((sum, account) => sum + (account.balance || 0), 0)
}

// Render cash accounts section
function renderCashAccounts(accounts, privacyMode) {
  return `
    <div class="account-section glass-panel mb-6">
      <div class="account-list">
        ${accounts.map(account => `
          <div class="account-item">
            <div class="account-info">
              <h4>${account.name}</h4>
              <p class="text-sm text-secondary">${account.account_type || 'Checking'}</p>
            </div>
            <div class="account-balance">
              <p class="text-lg font-semibold">${maskCurrency(account.balance, privacyMode)}</p>
            </div>
          </div>
        `).join('')}
        ${accounts.length === 0 ? '<p class="empty-state">No cash accounts yet. Click "Add Cash Account" to get started.</p>' : ''}
      </div>
    </div>
  `
}

// Render investment accounts section
function renderInvestmentAccounts(accounts, privacyMode) {
  return `
    <div class="account-section glass-panel mb-6">
      <h3 class="mb-4">Investment Accounts</h3>
      <div class="account-list">
        ${accounts.map(account => `
          <div class="account-item">
            <div class="account-info">
              <h4>${account.name}</h4>
              <p class="text-sm text-secondary">${account.account_type || 'Brokerage'}</p>
            </div>
            <div class="account-balance">
              <p class="text-lg font-semibold">${maskCurrency(account.current_value, privacyMode)}</p>
              <p class="text-sm ${account.total_return >= 0 ? 'text-positive' : 'text-negative'}">
                ${account.total_return >= 0 ? '+' : ''}${formatCurrency(account.total_return)}
              </p>
            </div>
          </div>
        `).join('')}
        ${accounts.length === 0 ? '<p class="empty-state">No investment accounts</p>' : ''}
      </div>
    </div>
  `
}

// Render debt accounts section
function renderDebtAccounts(accounts, privacyMode) {
  return `
    <div class="account-section glass-panel">
      <h3 class="mb-4">Debt Accounts</h3>
      <div class="account-list">
        ${accounts.map(account => `
          <div class="account-item">
            <div class="account-info">
              <h4>${account.name}</h4>
              <p class="text-sm text-secondary">${account.account_type || 'Credit Card'}</p>
              <p class="text-xs text-tertiary">APR: ${account.interest_rate}%</p>
            </div>
            <div class="account-balance">
              <p class="text-lg font-semibold">${maskCurrency(account.balance, privacyMode)}</p>
              ${account.credit_limit ? `
                <p class="text-sm text-secondary">
                  Limit: ${maskCurrency(account.credit_limit, privacyMode)}
                </p>
              ` : ''}
            </div>
          </div>
        `).join('')}
        ${accounts.length === 0 ? '<p class="empty-state">No debt accounts</p>' : ''}
      </div>
    </div>
  `
}