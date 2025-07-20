// Transactions Module

import { getTransactions as fetchTransactions } from './database.js'
import { formatCurrency, formatDate, maskCurrency } from './ui.js'

// Load transactions from database
export async function loadTransactions() {
  try {
    const transactions = await fetchTransactions({ limit: 1000 })
    return transactions || []
  } catch (error) {
    console.error('Failed to load transactions:', error)
    return []
  }
}

// Render transactions page
export async function renderTransactions(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  container.innerHTML = `
    <div class="transactions-page">
      <div class="page-header">
        <h2>Transactions</h2>
        <button class="btn btn-primary" onclick="window.showTransactionModal()">Add Transaction</button>
      </div>
      
      <div class="transactions-filters form-container">
        <div class="form-row">
          <div class="form-group">
            <input type="text" class="form-control" placeholder="Search transactions...">
          </div>
          <div class="form-group">
            <select class="form-select">
              <option value="">All Categories</option>
              <option value="Income">Income</option>
              <option value="Housing">Housing</option>
              <option value="Transportation">Transportation</option>
              <option value="Food">Food</option>
              <option value="Shopping">Shopping</option>
              <option value="Entertainment">Entertainment</option>
            </select>
          </div>
          <div class="form-group">
            <input type="date" class="form-control">
          </div>
        </div>
      </div>
      
      <div class="transactions-list">
        ${renderTransactionsList(appState.data.transactions, appState.privacyMode)}
      </div>
    </div>
    
    ${renderTransactionModal(appState)}
  `
  
  // Set up modal functionality
  window.showTransactionModal = () => {
    const modal = document.getElementById('transaction-modal')
    if (modal) modal.style.display = 'flex'
  }
  
  window.hideTransactionModal = () => {
    const modal = document.getElementById('transaction-modal')
    if (modal) modal.style.display = 'none'
  }
}

// Render transactions list
function renderTransactionsList(transactions, privacyMode) {
  if (!transactions || transactions.length === 0) {
    return '<p class="empty-state">No transactions found</p>'
  }
  
  return `
    <div class="table-glass">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Account</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(t => `
            <tr>
              <td>${formatDate(t.date)}</td>
              <td>${t.description}</td>
              <td>${t.category}</td>
              <td>${t.account_name || 'N/A'}</td>
              <td class="text-right ${t.amount < 0 ? 'text-negative' : 'text-positive'}">
                ${maskCurrency(t.amount, privacyMode, { showPlus: true })}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

// Render transaction modal
function renderTransactionModal(appState) {
  const accounts = [...appState.data.cashAccounts, ...appState.data.investmentAccounts]
  
  return `
    <div id="transaction-modal" class="modal" style="display: none;">
      <div class="modal-content form-container">
        <div class="modal-header">
          <h3>Add Transaction</h3>
          <button class="modal-close" onclick="window.hideTransactionModal()">×</button>
        </div>
        
        <form id="transaction-form" class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="transaction-date">Date</label>
              <input type="date" id="transaction-date" class="form-control" required>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="transaction-time">Time</label>
              <input type="time" id="transaction-time" class="form-control">
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="transaction-description">Description</label>
            <input type="text" id="transaction-description" class="form-control" placeholder="Enter description" required>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="transaction-amount">Amount</label>
              <div class="input-group">
                <div class="input-group-prepend">$</div>
                <input type="number" id="transaction-amount" class="form-control" step="0.01" placeholder="0.00" required>
              </div>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="transaction-type">Type</label>
              <select id="transaction-type" class="form-select" required>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="transaction-category">Category</label>
              <select id="transaction-category" class="form-select" required>
                <option value="">Select category</option>
                <option value="Income">Income</option>
                <option value="Housing">Housing</option>
                <option value="Transportation">Transportation</option>
                <option value="Food">Food</option>
                <option value="Shopping">Shopping</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Education">Education</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label" for="transaction-account">Account</label>
              <select id="transaction-account" class="form-select" required>
                <option value="">Select account</option>
                ${accounts.map(acc => `
                  <option value="${acc.id}">${acc.name}</option>
                `).join('')}
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="transaction-notes">Notes</label>
            <textarea id="transaction-notes" class="form-textarea" placeholder="Optional notes"></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-switch">
              <input type="checkbox" id="transaction-recurring">
              <div class="form-switch-track">
                <div class="form-switch-thumb"></div>
              </div>
              <span>Recurring transaction</span>
            </label>
          </div>
          
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.hideTransactionModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Transaction</button>
          </div>
        </form>
      </div>
    </div>
  `
}