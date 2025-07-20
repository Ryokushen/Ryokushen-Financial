// Accounts Module

import { getCashAccounts, getInvestmentAccounts, getDebtAccounts } from './database.js'
import { formatCurrency, maskCurrency } from './ui.js'
import { modalManager } from '../app.js'

// Load all accounts from database
export async function loadAccounts() {
  try {
    console.log('Loading accounts from database...')
    const [cashAccounts, investmentAccounts, debtAccounts] = await Promise.all([
      getCashAccounts(),
      getInvestmentAccounts(),
      getDebtAccounts()
    ])
    
    console.log('Accounts loaded:', {
      cash: cashAccounts?.length || 0,
      investment: investmentAccounts?.length || 0,
      debt: debtAccounts?.length || 0
    })
    
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
        <div class="account-item" data-account-id="${account.id}">
          <div class="account-info">
            <h4>${account.name}</h4>
            <p>${account.type || 'Checking'}</p>
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
      
      // Show delete confirmation modal
      const confirmed = await modalManager.confirm({
        title: 'Delete Account?',
        message: `Are you sure you want to delete "${accountName}"? This action cannot be undone.`,
        confirmText: 'Delete Account',
        confirmClass: 'btn-danger',
        cancelText: 'Cancel'
      })
      
      if (confirmed) {
        try {
          const { deleteCashAccount, getCashAccounts } = await import('./database.js')
          await deleteCashAccount(accountId)
          
          // Refresh the page
          const appState = window.appState || {}
          appState.data.cashAccounts = await getCashAccounts()
          await renderAccounts(appState)
          
          // Show success message
          modalManager.showNotification('Account deleted successfully', 'success')
        } catch (error) {
          console.error('Failed to delete account:', error)
          modalManager.showNotification('Failed to delete account', 'error')
        }
      }
    })
  })
}