// Investments Module - Modern Design

import { formatCurrency, maskCurrency } from './ui.js'

// Mock data for development - replace with database calls
const mockInvestmentAccounts = [
  {
    id: '1',
    name: 'Webull',
    type: 'Taxable Brokerage',
    institution: 'Apex Clearing',
    totalValue: 3234.23,
    dayChange: 124.23,
    dayChangePercent: 3.99,
    holdings: [
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
]

// Calculate portfolio summary
function calculatePortfolioSummary(accounts) {
  const summary = {
    totalValue: 0,
    dayChange: 0,
    totalGain: 456.78, // Mock value for now
    totalHoldings: 0
  }
  
  accounts.forEach(account => {
    summary.totalValue += account.totalValue
    summary.dayChange += account.dayChange
    summary.totalHoldings += account.holdings.length
  })
  
  return summary
}

// Get all holdings from all accounts
function getAllHoldings(accounts) {
  return accounts.reduce((allHoldings, account) => {
    return allHoldings.concat(account.holdings)
  }, [])
}

// Render investments page
export async function renderInvestments(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  // For now, use mock data
  const investmentAccounts = mockInvestmentAccounts
  const summary = calculatePortfolioSummary(investmentAccounts)
  
  container.innerHTML = `
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
      ${investmentAccounts.length > 0 ? investmentAccounts.map((account, index) => `
        ${index === 0 ? `
        <!-- Account Card -->
        <div class="account-card">
          <div class="account-header">
            <div class="account-info">
              <h2>${account.name} (${account.type})</h2>
              <div class="account-meta">
                <div class="meta-item">
                  <span class="meta-label">Institution:</span>
                  <span>${account.institution || 'Apex Clearing'}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Account Type:</span>
                  <span>${account.type}</span>
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
          ${getAllHoldings(investmentAccounts).length > 0 ? `
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
                ${getAllHoldings(investmentAccounts).map(holding => `
                  <tr>
                    <td>
                      <div class="symbol-cell">
                        <div class="symbol-icon">${holding.symbol.substring(0, 2)}</div>
                        <span class="symbol-name">${holding.symbol}</span>
                      </div>
                    </td>
                    <td class="shares-cell">${holding.shares.toFixed(3)}</td>
                    <td class="price-cell">${maskCurrency(holding.price, appState.privacyMode)}</td>
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
        ` : ''}
      `).join('') : `
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
  
  // Set up event handlers
  setupInvestmentEventHandlers(appState)
}

// Set up event handlers
function setupInvestmentEventHandlers(appState) {
  // Add Investment Account button
  const addAccountBtns = document.querySelectorAll('#add-investment-account-btn, #first-investment-account-btn')
  addAccountBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => showAddInvestmentAccountModal(appState))
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
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn-primary">Add Account</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  // Handle form submission
  document.getElementById('add-investment-account-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    // TODO: Save to database
    console.log('Adding investment account:', Object.fromEntries(formData))
    
    modalManager.close()
    modalManager.showNotification('Investment account added successfully', 'success')
    
    // Refresh the page
    await renderInvestments(appState)
  })
}

// Show edit investment account modal
async function showEditInvestmentAccountModal(accountId, accountName, appState) {
  const { modalManager } = await import('../app.js')
  
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
        <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  // Handle form submission
  document.getElementById('edit-investment-account-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    
    // TODO: Update in database
    modalManager.close()
    modalManager.showNotification('Investment account updated successfully', 'success')
    
    // Refresh the page
    await renderInvestments(appState)
  })
}

// Handle delete investment account
async function handleDeleteInvestmentAccount(accountId, accountName, appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Delete Investment Account?',
    message: `Are you sure you want to delete "${accountName}"? This will also delete all holdings in this account. This action cannot be undone.`,
    confirmText: 'Delete Account',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    // TODO: Delete from database
    console.log('Deleting investment account:', accountId)
    
    modalManager.showNotification('Investment account deleted successfully', 'success')
    
    // Refresh the page
    await renderInvestments(appState)
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
        <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn-primary">Add Holding</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  // Handle form submission
  document.getElementById('add-holding-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    // TODO: Save to database
    console.log('Adding holding to account:', accountId, Object.fromEntries(formData))
    
    modalManager.close()
    modalManager.showNotification('Holding added successfully', 'success')
    
    // Refresh the page
    await renderInvestments(appState)
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
        <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  // Handle form submission
  document.getElementById('edit-holding-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    
    // TODO: Update in database
    modalManager.close()
    modalManager.showNotification('Holding updated successfully', 'success')
    
    // Refresh the page
    await renderInvestments(appState)
  })
}

// Handle delete holding
async function handleDeleteHolding(holdingId, symbol, appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Delete Holding?',
    message: `Are you sure you want to delete ${symbol} from this account? This action cannot be undone.`,
    confirmText: 'Delete Holding',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    // TODO: Delete from database
    console.log('Deleting holding:', holdingId)
    
    modalManager.showNotification('Holding deleted successfully', 'success')
    
    // Refresh the page
    await renderInvestments(appState)
  }
}

// Export functions
export default {
  renderInvestments
}