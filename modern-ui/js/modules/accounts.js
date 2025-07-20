// Accounts Module

import { getCashAccounts, getInvestmentAccounts, getDebtAccounts } from './database.js'
import { formatCurrency, maskCurrency } from './ui.js'
import { modalManager } from '../app.js'

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
      <div class="page-header">
        <h2>Accounts</h2>
        <button class="btn btn-primary" id="add-cash-account-btn">
          <span>+</span>
          <span>Add Cash Account</span>
        </button>
      </div>
      
      <div class="cash-balance-card">
        <div class="balance-label">Total Cash Balance</div>
        <div class="balance-amount">${maskCurrency(totalCash, appState.privacyMode)}</div>
        <div class="balance-change">
          <span>↑</span>
          <span>+5.2%</span>
        </div>
      </div>
      
      <section>
        <h3 class="section-title">Cash Accounts</h3>
        ${renderCashAccounts(appState.data.cashAccounts, appState.privacyMode)}
      </section>
    </div>
  `
  
  // Setup event handlers
  setupAccountsEventHandlers()
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
    <div class="account-list">
      ${accounts.map(account => `
        <div class="account-item">
          <div class="account-info">
            <h4>${account.name}</h4>
            <p>${account.account_type || 'Checking'}</p>
          </div>
          <div class="account-balance">
            <p>${maskCurrency(account.balance, privacyMode)}</p>
          </div>
        </div>
      `).join('')}
      ${accounts.length === 0 ? '<p class="empty-state">No cash accounts yet. Click "Add Cash Account" to get started.</p>' : ''}
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

// Setup event handlers for accounts page
function setupAccountsEventHandlers() {
  // Add Cash Account button
  const addCashBtn = document.getElementById('add-cash-account-btn')
  if (addCashBtn) {
    addCashBtn.addEventListener('click', async () => {
      const { showCashAccountModal } = await import('./accountForms.js')
      await showCashAccountModal()
    })
  }
}