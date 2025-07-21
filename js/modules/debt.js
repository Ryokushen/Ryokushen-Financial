// Debt Module - Modern Design

import { formatCurrency, maskCurrency } from './ui.js'
import { 
  getDebtAccounts as fetchDebtAccounts,
  createDebtAccount,
  updateDebtAccount,
  deleteDebtAccount
} from './database.js'

// Mock data for development (fallback only)
const mockDebtAccounts = [
  {
    id: '1',
    name: 'Venture X',
    type: 'Credit Card',
    institution: 'Capital One',
    balance: 319.59,
    interestRate: 28.24,
    minPayment: 40.00,
    dueDate: '2025-07-28',
    creditLimit: 10000
  },
  {
    id: '2',
    name: 'Citi Strata',
    type: 'Credit Card',
    institution: 'Citi Bank',
    balance: 0.00,
    interestRate: 28.24,
    minPayment: 10.00,
    dueDate: '2025-07-24',
    creditLimit: 5000
  },
  {
    id: '3',
    name: 'Private Student Loan',
    type: 'Student Loan',
    institution: 'Lendkey',
    balance: 11189.59,
    interestRate: 4.3,
    minPayment: 190.50,
    dueDate: '2025-07-22',
    originalAmount: 15000
  },
  {
    id: '4',
    name: 'Visa Signature Go Rewards',
    type: 'Credit Card',
    institution: 'Bank',
    balance: 1234.56,
    interestRate: 24.99,
    minPayment: 35.00,
    dueDate: '2025-08-05',
    creditLimit: 8000
  },
  {
    id: '5',
    name: 'Chase Freedom Unlimited',
    type: 'Credit Card',
    institution: 'Chase Bank',
    balance: 3567.89,
    interestRate: 21.99,
    minPayment: 125.00,
    dueDate: '2025-08-01',
    creditLimit: 15000
  },
  {
    id: '6',
    name: 'Auto Loan',
    type: 'Auto Loan',
    institution: 'Wells Fargo',
    balance: 58841.23,
    interestRate: 7.25,
    minPayment: 2065.00,
    dueDate: '2025-07-25',
    originalAmount: 75000
  }
]

// Calculate debt summary
function calculateDebtSummary(accounts) {
  const summary = {
    totalDebt: 0,
    monthlyPayments: 0,
    averageAPR: 0,
    nextPaymentDate: null,
    totalAccounts: accounts.length
  }
  
  let totalWeightedAPR = 0
  let earliestDueDate = null
  
  accounts.forEach(account => {
    summary.totalDebt += account.balance || 0
    summary.monthlyPayments += account.minimum_payment || 0
    totalWeightedAPR += (account.balance || 0) * (account.interest_rate || 0)
    
    if (account.due_date) {
      const dueDate = new Date(account.due_date)
      if (!earliestDueDate || dueDate < earliestDueDate) {
        earliestDueDate = dueDate
        summary.nextPaymentDate = account.due_date
      }
    }
  })
  
  // Calculate weighted average APR
  if (summary.totalDebt > 0) {
    summary.averageAPR = totalWeightedAPR / summary.totalDebt
  }
  
  return summary
}

// Calculate days until due date
function getDaysUntilDue(dueDate) {
  const today = new Date()
  const due = new Date(dueDate)
  const diffTime = due - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Format due date
function formatDueDate(dueDate) {
  const date = new Date(dueDate)
  const options = { month: 'short', day: 'numeric', year: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

// Get debt type badge class
function getDebtTypeClass(type) {
  const typeMap = {
    'Credit Card': 'type-credit',
    'Student Loan': 'type-loan',
    'Auto Loan': 'type-auto',
    'Mortgage': 'type-mortgage'
  }
  return typeMap[type] || 'type-credit'
}

// Calculate debt breakdown by type
function calculateDebtBreakdown(accounts) {
  const breakdown = {}
  
  accounts.forEach(account => {
    if (!breakdown[account.type]) {
      breakdown[account.type] = 0
    }
    breakdown[account.type] += account.balance
  })
  
  return breakdown
}

// Render debt page
export async function renderDebt(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  // Use real debt accounts from appState or fetch directly
  let debtAccounts = appState.data.debtAccounts || []
  
  // If no accounts in appState, try to load directly
  if (debtAccounts.length === 0) {
    try {
      debtAccounts = await fetchDebtAccounts()
      appState.data.debtAccounts = debtAccounts
    } catch (error) {
      console.error('Failed to load debt accounts:', error)
      debtAccounts = [] // Use empty array on error
    }
  }
  
  const summary = calculateDebtSummary(debtAccounts)
  const breakdown = calculateDebtBreakdown(debtAccounts)
  
  container.innerHTML = `
    <div class="debt-page">
      <!-- Page Header -->
      <div class="page-header">
        <h1 class="page-title">Debt</h1>
        <button class="add-debt-btn" id="add-debt-btn">
          <span>+</span>
          <span>Add New Debt Account</span>
        </button>
      </div>
      
      <!-- Summary Section -->
      <div class="summary-section">
        <div class="summary-card">
          <div class="summary-label">Total Debt</div>
          <div class="summary-value negative">${maskCurrency(summary.totalDebt, appState.privacyMode)}</div>
          <div class="summary-subtext">Across ${summary.totalAccounts} accounts</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Monthly Payments</div>
          <div class="summary-value warning">${maskCurrency(summary.monthlyPayments, appState.privacyMode)}</div>
          <div class="summary-subtext">Total minimum due</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Average APR</div>
          <div class="summary-value">${summary.averageAPR.toFixed(2)}%</div>
          <div class="summary-subtext">Weighted average</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Next Payment</div>
          <div class="summary-value">${summary.nextPaymentDate ? new Date(summary.nextPaymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</div>
          <div class="summary-subtext ${summary.nextPaymentDate && getDaysUntilDue(summary.nextPaymentDate) <= 7 ? 'due-soon' : ''}">
            ${summary.nextPaymentDate ? `In ${getDaysUntilDue(summary.nextPaymentDate)} days` : 'No payments due'}
          </div>
        </div>
      </div>
      
      <!-- Debt Accounts Section -->
      <div class="debt-accounts-section">
        <h2 class="section-title">Debt Accounts</h2>
        <div class="debt-accounts-grid">
          ${debtAccounts.length > 0 ? debtAccounts.map(account => `
            <div class="debt-card">
              <div class="debt-card-header">
                <div class="debt-info">
                  <h3>${account.name}</h3>
                  <div class="debt-meta">
                    <span class="debt-type ${getDebtTypeClass(account.type)}">${account.type}</span>
                    <span class="meta-item">${account.institution}</span>
                  </div>
                </div>
                <div class="debt-balance">
                  <div class="balance-label">Balance</div>
                  <div class="balance-amount ${account.balance > 0 ? 'negative' : 'safe'}">
                    ${maskCurrency(account.balance, appState.privacyMode)}
                  </div>
                </div>
              </div>
              <div class="debt-details">
                <div class="detail-item">
                  <span class="detail-label">Interest Rate</span>
                  <span class="detail-value">${account.interest_rate || 0}%</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Min. Payment</span>
                  <span class="detail-value">${maskCurrency(account.minimum_payment || 0, appState.privacyMode)}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Due Date</span>
                  <span class="detail-value ${account.due_date && getDaysUntilDue(account.due_date) <= 3 ? 'due-soon' : ''} ${account.due_date && getDaysUntilDue(account.due_date) < 0 ? 'overdue' : ''}">
                    ${account.due_date ? formatDueDate(account.due_date) : 'Not set'}
                  </span>
                </div>
              </div>
              <div class="debt-actions">
                <button class="text-btn edit" data-debt-id="${account.id}" data-debt-name="${account.name}">Edit</button>
                <button class="text-btn delete" data-debt-id="${account.id}" data-debt-name="${account.name}">Delete</button>
              </div>
            </div>
          `).join('') : `
            <div class="no-debts-message">
              <div class="no-debts-icon">🎉</div>
              <div class="no-debts-text">No debt accounts!</div>
              <div class="no-debts-subtext">You're debt free! Keep up the great work.</div>
            </div>
          `}
        </div>
      </div>
      
      <!-- Payoff Strategy Section -->
      <div class="strategy-section">
        <div class="strategy-header">
          <h2 class="section-title">Payoff Strategy</h2>
        </div>
        <div class="strategy-controls">
          <div class="control-group">
            <label class="control-label">Strategy</label>
            <select class="select-input" id="payoff-strategy">
              <option value="avalanche">Avalanche (Highest Interest Rate First)</option>
              <option value="snowball">Snowball (Smallest Balance First)</option>
              <option value="custom">Custom Order</option>
            </select>
          </div>
          <div class="control-group">
            <label class="control-label">Extra Monthly Payment</label>
            <input type="number" class="number-input" id="extra-payment" placeholder="$0" value="0" min="0" step="10">
          </div>
          <button class="calculate-btn" id="calculate-payoff-btn">Calculate Payoff</button>
        </div>
      </div>
      
      <!-- Debt Analysis Section -->
      <div class="analysis-section">
        <!-- Debt Breakdown Chart -->
        <div class="chart-card">
          <h3 class="chart-title">Debt Breakdown</h3>
          <div class="donut-chart-container">
            <div class="chart-placeholder">
              Donut Chart Visualization
            </div>
          </div>
          <div class="debt-legend">
            ${Object.entries(breakdown).map(([type, amount]) => {
              let color = '#3b82f6' // Default blue for Credit Cards
              if (type === 'Student Loan') color = '#fb923c'
              else if (type === 'Auto Loan') color = '#10b981'
              else if (type === 'Mortgage') color = '#a855f7'
              return `
              <div class="legend-item">
                <div class="legend-left">
                  <span class="legend-color" style="background-color: ${color};"></span>
                  <span>${type}s</span>
                </div>
                <span class="legend-value">${maskCurrency(amount, appState.privacyMode)}</span>
              </div>
            `}).join('')}
          </div>
        </div>
        
        <!-- Payoff Timeline -->
        <div class="chart-card">
          <h3 class="chart-title">Payoff Timeline</h3>
          <div class="chart-placeholder">
            Line Chart - Balance Over Time
          </div>
          <div class="timeline-insights">
            <div class="insight-item">
              <div class="insight-value">3.5 years</div>
              <div class="insight-label">Time to debt free</div>
            </div>
            <div class="insight-item">
              <div class="insight-value">${maskCurrency(8456, appState.privacyMode)}</div>
              <div class="insight-label">Total interest paid</div>
            </div>
            <div class="insight-item">
              <div class="insight-value">Jun 2028</div>
              <div class="insight-label">Debt free date</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
  
  // Set up event handlers
  setupDebtEventHandlers(appState)
}

// Set up event handlers
function setupDebtEventHandlers(appState) {
  // Add debt button
  const addDebtBtn = document.getElementById('add-debt-btn')
  if (addDebtBtn) {
    addDebtBtn.addEventListener('click', () => showAddDebtModal(appState))
  }
  
  // Debt action buttons (edit/delete)
  document.querySelectorAll('.debt-actions .text-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const debtId = e.target.dataset.debtId
      const debtName = e.target.dataset.debtName
      
      if (e.target.classList.contains('edit')) {
        showEditDebtModal(debtId, debtName, appState)
      } else if (e.target.classList.contains('delete')) {
        await handleDeleteDebt(debtId, debtName, appState)
      }
    })
  })
  
  // Calculate payoff button
  const calculateBtn = document.getElementById('calculate-payoff-btn')
  if (calculateBtn) {
    calculateBtn.addEventListener('click', () => calculatePayoffStrategy(appState))
  }
}

// Show add debt modal
async function showAddDebtModal(appState) {
  const { modalManager } = await import('../app.js')
  
  const modalContent = `
    <h2>Add Debt Account</h2>
    <form id="add-debt-form">
      <div class="form-group">
        <label for="debt-name">Account Name</label>
        <input type="text" id="debt-name" name="name" required placeholder="e.g., Chase Freedom">
      </div>
      <div class="form-group">
        <label for="debt-type">Account Type</label>
        <select id="debt-type" name="type" required>
          <option value="">Select type...</option>
          <option value="Credit Card">Credit Card</option>
          <option value="Student Loan">Student Loan</option>
          <option value="Auto Loan">Auto Loan</option>
          <option value="Mortgage">Mortgage</option>
          <option value="Personal Loan">Personal Loan</option>
        </select>
      </div>
      <div class="form-group">
        <label for="debt-institution">Institution</label>
        <input type="text" id="debt-institution" name="institution" required placeholder="e.g., Chase Bank">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="debt-balance">Current Balance</label>
          <input type="number" id="debt-balance" name="balance" step="0.01" required placeholder="0.00">
        </div>
        <div class="form-group">
          <label for="debt-interest">Interest Rate (%)</label>
          <input type="number" id="debt-interest" name="interest_rate" step="0.01" required placeholder="0.00">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="debt-min-payment">Minimum Payment</label>
          <input type="number" id="debt-min-payment" name="minimum_payment" step="0.01" required placeholder="0.00">
        </div>
        <div class="form-group">
          <label for="debt-due-date">Due Date</label>
          <input type="date" id="debt-due-date" name="due_date" required>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.closeAll()">Cancel</button>
        <button type="submit" class="btn-primary">Add Account</button>
      </div>
    </form>
  `
  
  // Make modalManager available globally
  window.modalManager = modalManager
  
  modalManager.show({
    title: 'Add Debt Account',
    content: modalContent,
    showFooter: false
  })
  
  // Handle form submission - wait for modal to be rendered
  setTimeout(() => {
    const form = document.getElementById('add-debt-form')
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
          
          // Create debt account object with correct column names
          const newDebt = {
            name: formData.get('name'),
            type: formData.get('type'),
            institution: formData.get('institution'),
            balance: parseFloat(formData.get('balance')) || 0,
            interest_rate: parseFloat(formData.get('interest_rate')) || 0,
            minimum_payment: parseFloat(formData.get('minimum_payment')) || 0,
            due_date: formData.get('due_date') || null,
            user_id: user.id
          }
          
          await createDebtAccount(newDebt)
          
          window.modalManager.closeAll()
          window.modalManager.showNotification('Debt account added successfully', 'success')
          
          // Reload debt accounts
          appState.data.debtAccounts = await fetchDebtAccounts()
          
          // Refresh the page
          await renderDebt(appState)
        } catch (error) {
          console.error('Failed to add debt account:', error)
          window.modalManager.showNotification('Failed to add debt account', 'error')
        }
      })
    }
  }, 100)
}

// Show edit debt modal
async function showEditDebtModal(debtId, debtName, appState) {
  const { modalManager } = await import('../app.js')
  
  // Make modalManager available globally
  window.modalManager = modalManager
  
  // Find the actual debt account data
  const debtAccount = appState.data.debtAccounts.find(acc => acc.id.toString() === debtId.toString())
  if (!debtAccount) {
    modalManager.showNotification('Debt account not found', 'error')
    return
  }
  
  const modalContent = `
    <h2>Edit Debt Account</h2>
    <form id="edit-debt-form">
      <div class="form-group">
        <label for="debt-name">Account Name</label>
        <input type="text" id="debt-name" name="name" value="${debtAccount.name}" required>
      </div>
      <div class="form-group">
        <label for="debt-type">Account Type</label>
        <select id="debt-type" name="type" required>
          <option value="Credit Card" ${debtAccount.type === 'Credit Card' ? 'selected' : ''}>Credit Card</option>
          <option value="Student Loan" ${debtAccount.type === 'Student Loan' ? 'selected' : ''}>Student Loan</option>
          <option value="Auto Loan" ${debtAccount.type === 'Auto Loan' ? 'selected' : ''}>Auto Loan</option>
          <option value="Mortgage" ${debtAccount.type === 'Mortgage' ? 'selected' : ''}>Mortgage</option>
          <option value="Personal Loan" ${debtAccount.type === 'Personal Loan' ? 'selected' : ''}>Personal Loan</option>
        </select>
      </div>
      <div class="form-group">
        <label for="debt-institution">Institution</label>
        <input type="text" id="debt-institution" name="institution" value="${debtAccount.institution || ''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="debt-balance">Current Balance</label>
          <input type="number" id="debt-balance" name="balance" step="0.01" value="${debtAccount.balance || 0}" required>
        </div>
        <div class="form-group">
          <label for="debt-interest">Interest Rate (%)</label>
          <input type="number" id="debt-interest" name="interest_rate" step="0.01" value="${debtAccount.interest_rate || 0}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="debt-min-payment">Minimum Payment</label>
          <input type="number" id="debt-min-payment" name="minimum_payment" step="0.01" value="${debtAccount.minimum_payment || 0}" required>
        </div>
        <div class="form-group">
          <label for="debt-due-date">Due Date</label>
          <input type="date" id="debt-due-date" name="due_date" value="${debtAccount.due_date ? debtAccount.due_date.split('T')[0] : ''}" required>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.closeAll()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `
  
  modalManager.show({
    title: 'Edit Debt Account',
    content: modalContent,
    showFooter: false
  })
  
  // Handle form submission - wait for modal to be rendered
  setTimeout(() => {
    const form = document.getElementById('edit-debt-form')
    console.log('Edit debt form element:', form)
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault()
        const formData = new FormData(e.target)
        
        try {
          // Update debt account with correct column names
          const updates = {
            name: formData.get('name'),
            type: formData.get('type'),
            institution: formData.get('institution'),
            balance: parseFloat(formData.get('balance')) || 0,
            interest_rate: parseFloat(formData.get('interest_rate')) || 0,
            minimum_payment: parseFloat(formData.get('minimum_payment')) || 0,
            due_date: formData.get('due_date') || null
          }
          
          await updateDebtAccount(debtId, updates)
          
          modalManager.closeAll()
          modalManager.showNotification('Debt account updated successfully', 'success')
          
          // Reload debt accounts
          appState.data.debtAccounts = await fetchDebtAccounts()
          
          // Refresh the page
          await renderDebt(appState)
        } catch (error) {
          console.error('Failed to update debt account:', error)
          modalManager.showNotification('Failed to update debt account', 'error')
        }
      })
    }
  }, 100)
}

// Handle delete debt
async function handleDeleteDebt(debtId, debtName, appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm(
    `Are you sure you want to delete "${debtName}"? This action cannot be undone.`,
    'Delete Debt Account?'
  )
  
  if (confirmed) {
    try {
      await deleteDebtAccount(debtId)
      
      modalManager.showNotification('Debt account deleted successfully', 'success')
      
      // Reload debt accounts
      appState.data.debtAccounts = await fetchDebtAccounts()
      
      // Refresh the page
      await renderDebt(appState)
    } catch (error) {
      console.error('Failed to delete debt account:', error)
      modalManager.showNotification('Failed to delete debt account', 'error')
    }
  }
}

// Calculate payoff strategy
function calculatePayoffStrategy(appState) {
  const strategy = document.getElementById('payoff-strategy').value
  const extraPayment = parseFloat(document.getElementById('extra-payment').value) || 0
  
  // TODO: Implement actual payoff calculations
  console.log('Calculating payoff with strategy:', strategy, 'Extra payment:', extraPayment)
  
  // Show mock results for now
  const { modalManager } = window
  if (modalManager) {
    modalManager.showNotification('Payoff calculation complete! Scroll down to see results.', 'info')
  }
}

// Export functions
export default {
  renderDebt
}