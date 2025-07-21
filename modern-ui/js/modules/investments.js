// Investments Module - Modern Design

import { formatCurrency, maskCurrency } from './ui.js'
import { 
  getInvestmentAccounts as fetchInvestmentAccounts,
  createInvestmentAccount,
  updateInvestmentAccount,
  deleteInvestmentAccount,
  getHoldings as fetchHoldings,
  createHolding,
  updateHolding,
  deleteHolding
} from './database.js'

// Mock holdings data until we implement holdings table functions
const mockHoldings = {
  '1': [
    { id: '1', symbol: 'NVDA', shares: 2.000, price: 164.92, value: 329.84 },
    { id: '2', symbol: 'AMD', shares: 2.000, price: 146.42, value: 292.84 },
    { id: '3', symbol: 'VST', shares: 0.870, price: 196.58, value: 171.02 },
    { id: '4', symbol: 'MSFT', shares: 0.170, price: 503.32, value: 85.56 },
    { id: '5', symbol: 'AMZN', shares: 5.160, price: 225.02, value: 1161.10 },
    { id: '6', symbol: 'PANW', shares: 0.840, price: 187.39, value: 157.41 },
    { id: '7', symbol: 'CRWD', shares: 0.210, price: 478.45, value: 100.47 },
    { id: '8', symbol: 'GOOGL', shares: 1.140, price: 180.19, value: 205.42 },
    { id: '9', symbol: 'NVO', shares: 4.050, price: 68.93, value: 279.17 },
    { id: '10', symbol: 'TSLA', shares: 0.180, price: 313.51, value: 56.43 },
    { id: '11', symbol: 'TEM', shares: 2.120, price: 56.88, value: 120.59 },
    { id: '12', symbol: 'AVGO', shares: 1.000, price: 274.38, value: 274.38 }
  ]
}

// Load investment accounts from database
export async function loadInvestmentAccounts() {
  try {
    console.log('Loading investment accounts from database...')
    const accounts = await fetchInvestmentAccounts()
    console.log(`Loaded ${accounts.length} investment accounts`)
    return accounts
  } catch (error) {
    console.error('Failed to load investment accounts:', error)
    return []
  }
}

// Holdings are now nested in account objects, no separate loading needed
// This function is kept for backward compatibility but simplified
export async function loadAllHoldings(accounts) {
  // Holdings are already included in the accounts from the nested query
  console.log('Holdings are nested in accounts, no separate loading needed')
  return {} // Return empty map since we don't need it anymore
}

// Calculate portfolio summary
function calculatePortfolioSummary(accounts) {
  const summary = {
    totalValue: 0,
    dayChange: 0,
    totalGain: 0, // Will be calculated when we have cost basis
    totalHoldings: 0
  }
  
  accounts.forEach(account => {
    // Use balance from database schema (not current_value)
    summary.totalValue += account.balance || 0
    
    // Use day_change from database
    summary.dayChange += account.day_change || 0
    
    // Count holdings from nested holdings array
    const holdings = account.holdings || []
    summary.totalHoldings += holdings.length
    
    // Calculate value from holdings if balance isn't set
    if (!account.balance && holdings.length > 0) {
      const holdingsValue = holdings.reduce((sum, holding) => {
        return sum + (holding.value || (holding.shares * (holding.current_price || holding.price)) || 0)
      }, 0)
      summary.totalValue += holdingsValue
    }
  })
  
  return summary
}

// Get all holdings from all accounts
function getAllHoldings(accounts) {
  return accounts.reduce((allHoldings, account) => {
    const holdings = account.holdings || []
    return allHoldings.concat(holdings)
  }, [])
}

// Render investments page
export async function renderInvestments(appState) {
  console.log('=== renderInvestments called ===')
  const container = document.getElementById('page-content')
  if (!container) {
    console.error('No page-content container found!')
    return
  }
  
  // Use real investment accounts from appState
  const investmentAccounts = appState.data.investmentAccounts || []
  
  console.log('Investment accounts in appState:', investmentAccounts)
  console.log('Number of investment accounts:', investmentAccounts.length)
  
  // Also try to load directly from database for debugging
  try {
    const directAccountsLoad = await fetchInvestmentAccounts()
    console.log('Direct database load result:', directAccountsLoad)
    console.log('Direct load count:', directAccountsLoad?.length || 0)
    
    // If appState has no accounts but database has accounts, update appState
    if ((!investmentAccounts || investmentAccounts.length === 0) && directAccountsLoad && directAccountsLoad.length > 0) {
      console.log('Found investment accounts in database but not in appState, updating...')
      appState.data.investmentAccounts = directAccountsLoad
      console.log('Updated appState.data.investmentAccounts:', appState.data.investmentAccounts)
    }
  } catch (error) {
    console.error('Direct load failed:', error)
  }
  
  // Refresh investmentAccounts after potential update
  const finalInvestmentAccounts = appState.data.investmentAccounts || []
  console.log('Final investment accounts for rendering:', finalInvestmentAccounts)
  console.log('Final investment accounts count:', finalInvestmentAccounts.length)
  
  // No need to load holdings separately - they're nested in accounts
  const summary = calculatePortfolioSummary(finalInvestmentAccounts)
  
  const htmlContent = `
    <div class="investments-page">
      <!-- Page Header -->
      <div class="page-header">
        <h1 class="page-title">Investments</h1>
        <button class="add-account-btn" id="add-investment-account-btn">
          <span>+</span>
          <span>Add Account</span>
        </button>
      </div>
      
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-label">Total Portfolio Value</div>
          <div class="summary-value">
            ${maskCurrency(summary.totalValue, appState.privacyMode)}
          </div>
          <div class="summary-change ${summary.dayChange >= 0 ? 'positive' : 'negative'}">
            <span>${summary.dayChange >= 0 ? '↑' : '↓'}</span>
            ${maskCurrency(Math.abs(summary.dayChange), appState.privacyMode)}
            (${summary.dayChange >= 0 ? '+' : ''}${((summary.dayChange / summary.totalValue) * 100).toFixed(2)}%)
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Today's Change</div>
          <div class="summary-value ${summary.dayChange >= 0 ? 'positive' : 'negative'}">
            ${maskCurrency(summary.dayChange, appState.privacyMode, { showPlus: true })}
          </div>
          <div class="summary-change ${summary.dayChange >= 0 ? 'positive' : 'negative'}">
            <span>${summary.dayChange >= 0 ? '↑' : '↓'}</span>
            <span>${summary.dayChange >= 0 ? '+' : ''}${((summary.dayChange / summary.totalValue) * 100).toFixed(2)}%</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Gain/Loss</div>
          <div class="summary-value positive">
            ${maskCurrency(summary.totalGain, appState.privacyMode, { showPlus: true })}
          </div>
          <div class="summary-change positive">
            <span>↑</span>
            <span>+16.43%</span>
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Holdings</div>
          <div class="summary-value">${summary.totalHoldings}</div>
          <div class="summary-change" style="color: #8b8b9a;">
            <span>📊</span>
            <span>Positions</span>
          </div>
        </div>
      </div>
      
      <!-- Investment Accounts -->
      ${finalInvestmentAccounts.length > 0 ? finalInvestmentAccounts.map((account, index) => {
        console.log(`Account ${account.name}:`, account.holdings?.length || 0, 'holdings')
        console.log(`Holdings for ${account.name}:`, account.holdings)
        return `
        <!-- Account Card -->
        <div class="account-card">
          <div class="account-header">
            <div class="account-info">
              <h2>${account.name} (${account.account_type || account.type})</h2>
              <div class="account-meta">
                <div class="meta-item">
                  <span class="meta-label">Institution:</span>
                  <span>${account.institution || 'Apex Clearing'}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Account Type:</span>
                  <span>${account.account_type || account.type}</span>
                </div>
              </div>
            </div>
            <div class="account-actions">
              <button class="text-btn edit" data-account-id="${account.id}" data-account-name="${account.name}">Edit</button>
              <button class="text-btn delete" data-account-id="${account.id}" data-account-name="${account.name}">Delete</button>
            </div>
          </div>
          <div class="chart-placeholder">
            Performance Chart (Last 30 Days)
          </div>
        </div>
        
        <!-- Holdings Section -->
        <div class="holdings-section">
          <div class="holdings-header">
            <h3 class="holdings-title">Holdings</h3>
            <button class="add-holding-btn" data-account-id="${account.id}">
              <span>+</span>
              <span>Add Holding</span>
            </button>
          </div>
          ${(account.holdings || []).length > 0 ? `
            <table class="holdings-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Shares</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${(account.holdings || []).map(holding => `
                  <tr>
                    <td>
                      <div class="symbol-cell">
                        <div class="symbol-icon">${holding.symbol.substring(0, 2)}</div>
                        <span class="symbol-name">${holding.symbol}</span>
                      </div>
                    </td>
                    <td class="shares-cell">${holding.shares.toFixed(3)}</td>
                    <td class="price-cell">${maskCurrency(holding.current_price || holding.price, appState.privacyMode)}</td>
                    <td class="value-cell">${maskCurrency(holding.value, appState.privacyMode)}</td>
                    <td class="action-cell">
                      <div class="table-actions">
                        <button class="icon-btn edit" data-holding-id="${holding.id}" data-symbol="${holding.symbol}" title="Edit">✏️</button>
                        <button class="icon-btn delete" data-holding-id="${holding.id}" data-symbol="${holding.symbol}" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">📊</div>
              <div class="empty-state-text">No holdings yet</div>
              <div class="empty-state-subtext">Add your first holding to start tracking</div>
            </div>
          `}
        </div>
      `
    }).join('') : `
        <div class="no-accounts-message">
          <div class="no-accounts-icon">📈</div>
          <div class="no-accounts-text">No investment accounts yet</div>
          <div class="no-accounts-subtext">Add your first investment account to start tracking your portfolio</div>
          <button class="add-account-btn" id="first-investment-account-btn">
            <span>+</span>
            <span>Add Your First Account</span>
          </button>
        </div>
      `}
    </div>
  `
  
  console.log('Setting container innerHTML...')
  container.innerHTML = htmlContent
  console.log('HTML content set, container children:', container.children.length)
  
  // Set up event handlers after a short delay to ensure DOM is ready
  setTimeout(() => {
    console.log('Setting up event handlers after rendering...')
    setupInvestmentEventHandlers(appState)
  }, 100)
}

// Set up event handlers
function setupInvestmentEventHandlers(appState) {
  console.log('Setting up investment event handlers...')
  
  // Add Investment Account button
  const addAccountBtns = document.querySelectorAll('#add-investment-account-btn, #first-investment-account-btn')
  console.log('Found add account buttons:', addAccountBtns.length)
  
  addAccountBtns.forEach(btn => {
    if (btn) {
      console.log('Attaching event listener to button:', btn.id)
      btn.addEventListener('click', () => {
        console.log('Add account button clicked!')
        showAddInvestmentAccountModal(appState)
      })
    }
  })
  
  // Account action buttons (edit/delete)
  document.querySelectorAll('.account-actions .text-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const accountId = e.target.dataset.accountId
      const accountName = e.target.dataset.accountName
      
      if (e.target.classList.contains('edit')) {
        showEditInvestmentAccountModal(accountId, accountName, appState)
      } else if (e.target.classList.contains('delete')) {
        await handleDeleteInvestmentAccount(accountId, accountName, appState)
      }
    })
  })
  
  // Add holding buttons
  document.querySelectorAll('.add-holding-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const accountId = e.target.closest('button').dataset.accountId
      showAddHoldingModal(accountId, appState)
    })
  })
  
  // Holding action buttons
  document.querySelectorAll('.holdings-table .icon-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const holdingId = e.target.dataset.holdingId
      const symbol = e.target.dataset.symbol
      
      if (e.target.classList.contains('edit')) {
        showEditHoldingModal(holdingId, symbol, appState)
      } else if (e.target.classList.contains('delete')) {
        await handleDeleteHolding(holdingId, symbol, appState)
      }
    })
  })
}

// Show add investment account modal
async function showAddInvestmentAccountModal(appState) {
  const { modalManager } = await import('../app.js')
  
  const modalContent = `
    <h2>Add Investment Account</h2>
    <form id="add-investment-account-form">
      <div class="form-group">
        <label for="account-name">Account Name</label>
        <input type="text" id="account-name" name="name" required placeholder="e.g., Fidelity 401(k)">
      </div>
      <div class="form-group">
        <label for="account-type">Account Type</label>
        <select id="account-type" name="type" required>
          <option value="">Select type...</option>
          <option value="Brokerage">Brokerage</option>
          <option value="Retirement">Retirement (401k/IRA)</option>
          <option value="Crypto">Cryptocurrency</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label for="institution">Institution (Optional)</label>
        <input type="text" id="institution" name="institution" placeholder="e.g., Fidelity, TD Ameritrade">
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.closeAll()">Cancel</button>
        <button type="submit" class="btn-primary">Add Account</button>
      </div>
    </form>
  `
  
  modalManager.show({
    title: 'Add Investment Account',
    content: modalContent,
    showFooter: false  // Don't show modal footer since we have form buttons
  })
  
  // Handle form submission - wait for modal to be rendered
  setTimeout(() => {
    const form = document.getElementById('add-investment-account-form')
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        
        try {
          // Get current user from Supabase
          const { getSupabase } = await import('./database.js')
          const supabase = getSupabase()
          const { data: { user } } = await supabase.auth.getUser()
          
          if (!user) {
            throw new Error('User not authenticated')
          }
          
          // Save to database with correct column names
          const newAccount = {
            name: formData.get('name'),
            account_type: formData.get('type'), // Changed from 'type' to 'account_type'
            institution: formData.get('institution') || null,
            user_id: user.id, // Required field
            balance: 0, // Initialize with 0 balance
            day_change: 0 // Initialize with 0 day change
          }
          
          await createInvestmentAccount(newAccount)
          
          modalManager.closeAll()
          modalManager.showNotification('Investment account added successfully', 'success')
          
          // Reload investment accounts
          appState.data.investmentAccounts = await fetchInvestmentAccounts()
          
          // Refresh the page
          await renderInvestments(appState)
        } catch (error) {
          console.error('Failed to add investment account:', error)
          modalManager.showNotification('Failed to add investment account', 'error')
        }
      })
    }
  }, 100)
}

// Show edit investment account modal
async function showEditInvestmentAccountModal(accountId, accountName, appState) {
  const { modalManager } = await import('../app.js')
  
  // Make modalManager available globally for this modal
  window.modalManager = modalManager
  
  // TODO: Load actual account data
  const modalContent = `
    <h2>Edit Investment Account</h2>
    <form id="edit-investment-account-form">
      <div class="form-group">
        <label for="account-name">Account Name</label>
        <input type="text" id="account-name" name="name" value="${accountName}" required>
      </div>
      <div class="form-group">
        <label for="account-type">Account Type</label>
        <select id="account-type" name="type" required>
          <option value="Brokerage" selected>Brokerage</option>
          <option value="Retirement">Retirement (401k/IRA)</option>
          <option value="Crypto">Cryptocurrency</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.closeAll()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `
  
  modalManager.show({
    title: 'Edit Investment Account',
    content: modalContent,
    showFooter: false  // Don't show modal footer since we have form buttons
  })
  
  // Handle form submission - wait for modal to be rendered
  setTimeout(() => {
    const form = document.getElementById('edit-investment-account-form')
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        
        console.log('Edit form submitted')
        
        try {
          // Update in database with correct column names
          const updates = {
            name: formData.get('name'),
            account_type: formData.get('type') // Changed from 'type' to 'account_type'
          }
          
          await updateInvestmentAccount(accountId, updates)
          
          console.log('About to close modal')
          console.log('window.modalManager exists:', !!window.modalManager)
          console.log('window.modalManager.closeAll exists:', !!window.modalManager.closeAll)
          
          // Close all modals (simpler approach)
          window.modalManager.closeAll()
          window.modalManager.showNotification('Investment account updated successfully', 'success')
      
      // Reload investment accounts
      appState.data.investmentAccounts = await fetchInvestmentAccounts()
      
      // Refresh the page
      await renderInvestments(appState)
    } catch (error) {
      console.error('Failed to update investment account:', error)
      modalManager.showNotification('Failed to update investment account', 'error')
    }
      })
    }
  }, 100)
}

// Handle delete investment account
async function handleDeleteInvestmentAccount(accountId, accountName, appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm(
    `Are you sure you want to delete "${accountName}"? This will also delete all holdings in this account. This action cannot be undone.`,
    'Delete Investment Account?'
  )
  
  if (confirmed) {
    try {
      // Delete from database
      await deleteInvestmentAccount(accountId)
      
      modalManager.showNotification('Investment account deleted successfully', 'success')
      
      // Reload investment accounts
      appState.data.investmentAccounts = await fetchInvestmentAccounts()
      
      // Refresh the page
      await renderInvestments(appState)
    } catch (error) {
      console.error('Failed to delete investment account:', error)
      modalManager.showNotification('Failed to delete investment account', 'error')
    }
  }
}

// Show add holding modal
async function showAddHoldingModal(accountId, appState) {
  const { modalManager } = await import('../app.js')
  
  const modalContent = `
    <h2>Add Holding</h2>
    <form id="add-holding-form">
      <div class="form-group">
        <label for="symbol">Symbol</label>
        <input type="text" id="symbol" name="symbol" required placeholder="e.g., AAPL" style="text-transform: uppercase;">
      </div>
      <div class="form-group">
        <label for="shares">Number of Shares</label>
        <input type="number" id="shares" name="shares" step="0.0001" required placeholder="e.g., 100">
      </div>
      <div class="form-group">
        <label for="price">Current Price</label>
        <input type="number" id="price" name="price" step="0.01" required placeholder="e.g., 150.25">
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.closeAll()">Cancel</button>
        <button type="submit" class="btn-primary">Add Holding</button>
      </div>
    </form>
  `
  
  modalManager.show({
    title: 'Add Holding',
    content: modalContent,
    showFooter: false  // Don't show modal footer since we have form buttons
  })
  
  // Handle form submission
  document.getElementById('add-holding-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    try {
      // Get current user from Supabase
      const { getSupabase } = await import('./database.js')
      const supabase = getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }
      
      // Save to database
      const shares = parseFloat(formData.get('shares'))
      const price = parseFloat(formData.get('price'))
      
      const newHolding = {
        investment_account_id: accountId, // Changed from account_id to investment_account_id
        symbol: formData.get('symbol').toUpperCase(),
        shares: shares,
        current_price: price,
        value: shares * price,
        user_id: user.id // Required field
      }
      
      await createHolding(newHolding)
      
      modalManager.closeAll()
      modalManager.showNotification('Holding added successfully', 'success')
      
      // Reload investment accounts to get updated holdings
      appState.data.investmentAccounts = await fetchInvestmentAccounts()
      
      // Refresh the page
      await renderInvestments(appState)
    } catch (error) {
      console.error('Failed to add holding:', error)
      modalManager.showNotification('Failed to add holding', 'error')
    }
  })
}

// Show edit holding modal
async function showEditHoldingModal(holdingId, symbol, appState) {
  const { modalManager } = await import('../app.js')
  
  // TODO: Load actual holding data
  const modalContent = `
    <h2>Edit Holding</h2>
    <form id="edit-holding-form">
      <div class="form-group">
        <label for="symbol">Symbol</label>
        <input type="text" id="symbol" name="symbol" value="${symbol}" required style="text-transform: uppercase;">
      </div>
      <div class="form-group">
        <label for="shares">Number of Shares</label>
        <input type="number" id="shares" name="shares" step="0.0001" value="100" required>
      </div>
      <div class="form-group">
        <label for="price">Current Price</label>
        <input type="number" id="price" name="price" step="0.01" value="150.25" required>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.closeAll()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `
  
  modalManager.show({
    title: 'Edit Holding',
    content: modalContent,
    showFooter: false  // Don't show modal footer since we have form buttons
  })
  
  // Handle form submission - wait for modal to be rendered
  setTimeout(() => {
    const form = document.getElementById('edit-holding-form')
    if (form) {
      form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    try {
      // Update in database
      const shares = parseFloat(formData.get('shares'))
      const price = parseFloat(formData.get('price'))
      
      const updates = {
        symbol: formData.get('symbol').toUpperCase(),
        shares: shares,
        current_price: price,
        value: shares * price
        // Note: user_id and investment_account_id should not be updated
      }
      
      await updateHolding(holdingId, updates)
      
      modalManager.closeAll()
      modalManager.showNotification('Holding updated successfully', 'success')
      
      // Reload investment accounts to get updated holdings
      appState.data.investmentAccounts = await fetchInvestmentAccounts()
      
      // Refresh the page
      await renderInvestments(appState)
    } catch (error) {
      console.error('Failed to update holding:', error)
      modalManager.showNotification('Failed to update holding', 'error')
    }
      })
    }
  }, 100)
}

// Handle delete holding
async function handleDeleteHolding(holdingId, symbol, appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm(
    `Are you sure you want to delete ${symbol} from this account? This action cannot be undone.`,
    'Delete Holding?'
  )
  
  if (confirmed) {
    try {
      // Delete from database
      await deleteHolding(holdingId)
      
      modalManager.showNotification('Holding deleted successfully', 'success')
      
      // Reload investment accounts to get updated holdings
      appState.data.investmentAccounts = await fetchInvestmentAccounts()
      
      // Refresh the page
      await renderInvestments(appState)
    } catch (error) {
      console.error('Failed to delete holding:', error)
      modalManager.showNotification('Failed to delete holding', 'error')
    }
  }
}

// Export functions
export default {
  renderInvestments
}