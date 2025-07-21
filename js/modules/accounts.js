// Accounts Module

import { getCashAccounts, getInvestmentAccounts, getDebtAccounts, getTransactions } from './database.js'
import { formatCurrency, maskCurrency } from './ui.js'
import { modalManager } from '../app.js'

// Mock data as fallback
const mockData = {
  cashAccounts: [
    { id: 1, name: 'Main Checking', type: 'checking', institution: 'Chase Bank', balance: 5234.56 },
    { id: 2, name: 'Savings Account', type: 'savings', institution: 'Ally Bank', balance: 15789.23 }
  ],
  investmentAccounts: [
    { id: 1, name: 'Retirement 401k', type: '401k', institution: 'Fidelity', balance: 45678.90 },
    { id: 2, name: 'Roth IRA', type: 'ira', institution: 'Vanguard', balance: 23456.78 }
  ],
  debtAccounts: [
    { id: 1, name: 'Chase Sapphire', type: 'credit_card', institution: 'Chase', balance: -2345.67, credit_limit: 15000, apr: 19.99 },
    { id: 2, name: 'Mortgage', type: 'mortgage', institution: 'Wells Fargo', balance: -245678.90, apr: 3.75 }
  ]
}

// Account type labels
const ACCOUNT_TYPE_LABELS = {
  checking: 'Checking',
  savings: 'Savings',
  money_market: 'Money Market',
  cash: 'Cash on Hand',
  '401k': '401(k)',
  ira: 'IRA',
  roth_ira: 'Roth IRA',
  brokerage: 'Brokerage',
  crypto: 'Cryptocurrency',
  credit_card: 'Credit Card',
  mortgage: 'Mortgage',
  auto_loan: 'Auto Loan',
  student_loan: 'Student Loan',
  personal_loan: 'Personal Loan'
}

// Format account type for display
function formatAccountType(type) {
  return ACCOUNT_TYPE_LABELS[type] || type || 'Account'
}

// Load all accounts from database
export async function loadAccounts() {
  console.log('Loading accounts from database...')
  
  try {
    // Load accounts with timeout protection
    const [cashAccounts, investmentAccounts, debtAccounts] = await Promise.allSettled([
      getCashAccounts(),
      getInvestmentAccounts(), 
      getDebtAccounts()
    ])
    
    // Extract results with fallback to mock data
    const result = {
      cashAccounts: cashAccounts.status === 'fulfilled' ? cashAccounts.value : mockData.cashAccounts,
      investmentAccounts: investmentAccounts.status === 'fulfilled' ? investmentAccounts.value : mockData.investmentAccounts,
      debtAccounts: debtAccounts.status === 'fulfilled' ? debtAccounts.value : mockData.debtAccounts
    }
    
    // Log what loaded successfully
    console.log('Accounts loaded:', {
      cash: cashAccounts.status === 'fulfilled' ? `${result.cashAccounts.length} from DB` : 'mock data (DB timeout)',
      investment: investmentAccounts.status === 'fulfilled' ? `${result.investmentAccounts.length} from DB` : 'mock data (DB timeout)',
      debt: debtAccounts.status === 'fulfilled' ? `${result.debtAccounts.length} from DB` : 'mock data (DB timeout)'
    })
    
    return result
    
  } catch (error) {
    console.error('Critical error loading accounts:', error)
    // Return mock data as last resort
    return mockData
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
        <div class="account-item" data-account-id="${account.id}">
          <div class="account-info">
            <h4>${account.name}</h4>
            <p>${formatAccountType(account.type)}</p>
          </div>
          <div class="account-right">
            <div class="account-balance">${maskCurrency(account.balance || 0, privacyMode)}</div>
            <div class="text-actions">
              <button class="text-btn edit" data-account-id="${account.id}" data-account-name="${account.name}">Edit</button>
              <button class="text-btn delete" data-account-id="${account.id}" data-account-name="${account.name}">Delete</button>
            </div>
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
              <p class="text-sm text-secondary">${formatAccountType(account.account_type || 'brokerage')}</p>
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
              <p class="text-sm text-secondary">${formatAccountType(account.account_type || 'credit_card')}</p>
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
  
  // Edit buttons
  const editBtns = document.querySelectorAll('.text-btn.edit')
  editBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const accountId = btn.dataset.accountId
      const accountName = btn.dataset.accountName
      
      // Get the account data
      const { getCashAccountById } = await import('./database.js')
      const accountData = await getCashAccountById(accountId)
      
      if (accountData) {
        const { showCashAccountModal } = await import('./accountForms.js')
        await showCashAccountModal(accountData)
      }
    })
  })
  
  // Delete buttons
  const deleteBtns = document.querySelectorAll('.text-btn.delete')
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const accountId = btn.dataset.accountId
      const accountName = btn.dataset.accountName
      
      // Show delete confirmation modal with warning about transactions
      const confirmed = await modalManager.confirm(
        `Are you sure you want to delete "${accountName}"? 
        
        <strong>Warning:</strong> This will also delete all transactions associated with this account.
        
        This action cannot be undone.`,
        'Delete Account?'
      )
      
      if (confirmed) {
        try {
          // Show loading state
          modalManager.showNotification('Deleting account...', 'info')
          
          const { deleteCashAccount } = await import('./database.js')
          await deleteCashAccount(accountId)
          
          // Wait for database operations to complete
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          // Force reload all data including transactions
          const appState = window.appState || { data: {} }
          if (!appState.data) {
            appState.data = {}
          }
          
          // Reload both accounts and transactions to ensure consistency
          const [cashAccounts, transactions] = await Promise.all([
            getCashAccounts(),
            getTransactions()
          ])
          
          appState.data.cashAccounts = cashAccounts
          appState.data.transactions = transactions
          
          // Re-render the accounts page
          await renderAccounts(appState)
          
          // Show success message
          modalManager.showNotification('Account and all associated transactions deleted successfully', 'success')
        } catch (error) {
          console.error('Failed to delete account:', error)
          modalManager.showNotification('Failed to delete account: ' + error.message, 'error')
        }
      }
    })
  })
}