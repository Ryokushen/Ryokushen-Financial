// Transactions Module

import { getTransactions as fetchTransactions } from './database.js'
import { formatCurrency, formatDate, maskCurrency, debounce } from './ui.js'

// Filter state
let filterState = {
  searchQuery: '',
  category: '',
  startDate: null,
  endDate: null
}

// Store original transactions
let allTransactions = []

// Load transactions from database
export async function loadTransactions() {
  try {
    const transactions = await fetchTransactions({ limit: 1000 })
    allTransactions = transactions || []
    return allTransactions
  } catch (error) {
    console.error('Failed to load transactions:', error)
    allTransactions = []
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
            <input type="text" id="search-input" class="form-control" placeholder="Search transactions..." value="${filterState.searchQuery}">
          </div>
          <div class="form-group">
            <select id="category-filter" class="form-select">
              <option value="">All Categories</option>
              <option value="Income" ${filterState.category === 'Income' ? 'selected' : ''}>Income</option>
              <option value="Housing" ${filterState.category === 'Housing' ? 'selected' : ''}>Housing</option>
              <option value="Transportation" ${filterState.category === 'Transportation' ? 'selected' : ''}>Transportation</option>
              <option value="Food" ${filterState.category === 'Food' ? 'selected' : ''}>Food</option>
              <option value="Shopping" ${filterState.category === 'Shopping' ? 'selected' : ''}>Shopping</option>
              <option value="Entertainment" ${filterState.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
              <option value="Healthcare" ${filterState.category === 'Healthcare' ? 'selected' : ''}>Healthcare</option>
              <option value="Education" ${filterState.category === 'Education' ? 'selected' : ''}>Education</option>
              <option value="Other" ${filterState.category === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <input type="date" id="date-filter" class="form-control" value="${filterState.startDate || ''}">
          </div>
        </div>
        ${hasActiveFilters() ? `
          <div class="filter-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.clearFilters()">Clear Filters</button>
            <span class="filter-count">${getFilteredTransactions().length} results found</span>
          </div>
        ` : ''}
      </div>
      
      <div class="transactions-list">
        ${renderTransactionsList(getFilteredTransactions(), appState.privacyMode)}
      </div>
    </div>
    
    ${renderTransactionModal(appState)}
  `
  
  // Store transactions globally
  allTransactions = appState.data.transactions
  
  // Set up modal functionality
  window.showTransactionModal = () => {
    const modal = document.getElementById('transaction-modal')
    if (modal) modal.style.display = 'flex'
  }
  
  window.hideTransactionModal = () => {
    const modal = document.getElementById('transaction-modal')
    if (modal) modal.style.display = 'none'
  }
  
  // Set up filter functionality
  window.clearFilters = () => {
    filterState = {
      searchQuery: '',
      category: '',
      startDate: null,
      endDate: null
    }
    updateTransactionsList(appState.privacyMode)
  }
  
  // Set up filter event listeners
  setupFilterListeners(appState.privacyMode)
}

// Set up filter event listeners
function setupFilterListeners(privacyMode) {
  // Search input with debounce
  const searchInput = document.getElementById('search-input')
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      filterState.searchQuery = e.target.value
      updateTransactionsList(privacyMode)
    }, 300))
  }
  
  // Category filter
  const categoryFilter = document.getElementById('category-filter')
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      filterState.category = e.target.value
      updateTransactionsList(privacyMode)
    })
  }
  
  // Date filter
  const dateFilter = document.getElementById('date-filter')
  if (dateFilter) {
    dateFilter.addEventListener('change', (e) => {
      filterState.startDate = e.target.value || null
      updateTransactionsList(privacyMode)
    })
  }
}

// Update transactions list with current filters
function updateTransactionsList(privacyMode) {
  const transactionsList = document.querySelector('.transactions-list')
  if (transactionsList) {
    transactionsList.innerHTML = renderTransactionsList(getFilteredTransactions(), privacyMode)
  }
  
  // Update filter UI
  const container = document.querySelector('.transactions-page')
  if (container) {
    // Re-render just the filters section to update the clear button and count
    const filtersHtml = `
      <div class="transactions-filters form-container">
        <div class="form-row">
          <div class="form-group">
            <input type="text" id="search-input" class="form-control" placeholder="Search transactions..." value="${filterState.searchQuery}">
          </div>
          <div class="form-group">
            <select id="category-filter" class="form-select">
              <option value="">All Categories</option>
              <option value="Income" ${filterState.category === 'Income' ? 'selected' : ''}>Income</option>
              <option value="Housing" ${filterState.category === 'Housing' ? 'selected' : ''}>Housing</option>
              <option value="Transportation" ${filterState.category === 'Transportation' ? 'selected' : ''}>Transportation</option>
              <option value="Food" ${filterState.category === 'Food' ? 'selected' : ''}>Food</option>
              <option value="Shopping" ${filterState.category === 'Shopping' ? 'selected' : ''}>Shopping</option>
              <option value="Entertainment" ${filterState.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
              <option value="Healthcare" ${filterState.category === 'Healthcare' ? 'selected' : ''}>Healthcare</option>
              <option value="Education" ${filterState.category === 'Education' ? 'selected' : ''}>Education</option>
              <option value="Other" ${filterState.category === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="form-group">
            <input type="date" id="date-filter" class="form-control" value="${filterState.startDate || ''}">
          </div>
        </div>
        ${hasActiveFilters() ? `
          <div class="filter-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.clearFilters()">Clear Filters</button>
            <span class="filter-count">${getFilteredTransactions().length} results found</span>
          </div>
        ` : ''}
      </div>
    `
    const existingFilters = container.querySelector('.transactions-filters')
    if (existingFilters) {
      existingFilters.outerHTML = filtersHtml
      // Re-attach event listeners
      setupFilterListeners(privacyMode)
    }
  }
}

// Get filtered transactions based on current filter state
function getFilteredTransactions() {
  let filtered = [...allTransactions]
  
  // Apply search filter
  if (filterState.searchQuery) {
    const query = filterState.searchQuery.toLowerCase()
    filtered = filtered.filter(t => 
      t.description.toLowerCase().includes(query) ||
      (t.notes && t.notes.toLowerCase().includes(query))
    )
  }
  
  // Apply category filter
  if (filterState.category) {
    filtered = filtered.filter(t => t.category === filterState.category)
  }
  
  // Apply date filter
  if (filterState.startDate) {
    const filterDate = new Date(filterState.startDate)
    filtered = filtered.filter(t => {
      const transactionDate = new Date(t.date)
      return transactionDate.toDateString() === filterDate.toDateString()
    })
  }
  
  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date))
  
  return filtered
}

// Check if any filters are active
function hasActiveFilters() {
  return filterState.searchQuery || filterState.category || filterState.startDate
}

// Render transactions list
function renderTransactionsList(transactions, privacyMode) {
  if (!transactions || transactions.length === 0) {
    const message = hasActiveFilters() 
      ? 'No transactions match your filters' 
      : 'No transactions found'
    return `<p class="empty-state">${message}</p>`
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