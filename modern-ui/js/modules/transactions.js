// Transactions Module - Improved Design

import { getTransactions as fetchTransactions } from './database.js'
import { formatCurrency, formatDate, maskCurrency, debounce } from './ui.js'

// Filter state
let filterState = {
  searchQuery: '',
  category: '',
  selectedDate: null
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

// Calculate summary statistics
function calculateSummary(transactions) {
  const summary = {
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0
  }
  
  transactions.forEach(t => {
    if (t.amount > 0) {
      summary.totalIncome += t.amount
    } else {
      summary.totalExpenses += Math.abs(t.amount)
    }
  })
  
  summary.netBalance = summary.totalIncome - summary.totalExpenses
  return summary
}

// Format category name for CSS class
function getCategoryClass(category) {
  if (!category) return 'other'
  return category.toLowerCase().replace(/\s+/g, '-')
}

// Render transactions page
export async function renderTransactions(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  // Store transactions globally
  allTransactions = appState.data.transactions
  
  // Get filtered transactions and calculate summary
  const filteredTransactions = getFilteredTransactions()
  const summary = calculateSummary(filteredTransactions)
  
  // Get current date for default filter
  const today = new Date().toISOString().split('T')[0]
  
  container.innerHTML = `
    <div class="transactions-page">
      <!-- Page Header -->
      <div class="page-header">
        <h1 class="page-title">Transactions</h1>
        <button class="add-transaction-btn" id="add-transaction-btn">
          <span>+</span>
          <span>Add Transaction</span>
        </button>
      </div>
      
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-label">Total Income</div>
          <div class="summary-value summary-income">
            ${maskCurrency(summary.totalIncome, appState.privacyMode, { showPlus: true })}
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Expenses</div>
          <div class="summary-value summary-expense">
            ${maskCurrency(-summary.totalExpenses, appState.privacyMode)}
          </div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Net Balance</div>
          <div class="summary-value summary-balance">
            ${maskCurrency(summary.netBalance, appState.privacyMode, { showPlus: true })}
          </div>
        </div>
      </div>
      
      <!-- Filters Section -->
      <div class="filters-section">
        <div class="search-container">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            class="search-input" 
            id="search-input"
            placeholder="Search transactions..." 
            value="${filterState.searchQuery}"
          >
        </div>
        <select class="filter-select" id="category-filter">
          <option value="">All Categories</option>
          <option value="Income" ${filterState.category === 'Income' ? 'selected' : ''}>Income</option>
          <option value="Healthcare" ${filterState.category === 'Healthcare' ? 'selected' : ''}>Healthcare</option>
          <option value="Dining" ${filterState.category === 'Dining' ? 'selected' : ''}>Dining</option>
          <option value="Food" ${filterState.category === 'Food' ? 'selected' : ''}>Food</option>
          <option value="Transfer" ${filterState.category === 'Transfer' ? 'selected' : ''}>Transfer</option>
          <option value="Payment" ${filterState.category === 'Payment' ? 'selected' : ''}>Payment</option>
          <option value="Investment" ${filterState.category === 'Investment' ? 'selected' : ''}>Investment</option>
          <option value="Entertainment" ${filterState.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
          <option value="Shopping" ${filterState.category === 'Shopping' ? 'selected' : ''}>Shopping</option>
          <option value="Transportation" ${filterState.category === 'Transportation' ? 'selected' : ''}>Transportation</option>
          <option value="Housing" ${filterState.category === 'Housing' ? 'selected' : ''}>Housing</option>
          <option value="Utilities" ${filterState.category === 'Utilities' ? 'selected' : ''}>Utilities</option>
          <option value="Other" ${filterState.category === 'Other' ? 'selected' : ''}>Other</option>
        </select>
        <input 
          type="date" 
          class="date-input" 
          id="date-filter"
          value="${filterState.selectedDate || ''}"
        >
      </div>
      
      <!-- Transactions Table -->
      <div class="transactions-table-container">
        ${renderTransactionsTable(filteredTransactions, appState.privacyMode)}
      </div>
    </div>
  `
  
  // Set up filter event listeners
  setupFilterListeners(appState)
  
  // Set up add transaction button
  setupTransactionEventHandlers()
}

// Render transactions table
function renderTransactionsTable(transactions, privacyMode) {
  if (!transactions || transactions.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No transactions found</div>
        <div class="empty-state-subtext">
          ${hasActiveFilters() ? 'Try adjusting your filters' : 'Add your first transaction to get started'}
        </div>
      </div>
    `
  }
  
  return `
    <table class="transactions-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Account</th>
          <th>Amount</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map(t => `
          <tr data-transaction-id="${t.id}">
            <td class="date-cell">${formatDatePretty(t.date)}</td>
            <td class="description-cell">${t.description}</td>
            <td>
              <span class="category-badge category-${getCategoryClass(t.category)}">
                ${t.category || 'Other'}
              </span>
            </td>
            <td class="account-cell ${!t.account_name ? 'empty' : ''}">
              ${t.account_name || '—'}
            </td>
            <td class="amount-cell ${t.amount > 0 ? 'amount-positive' : 'amount-negative'}">
              ${maskCurrency(t.amount, privacyMode, { showPlus: t.amount > 0 })}
            </td>
            <td>
              <div class="transaction-actions">
                <button class="text-btn edit" data-transaction-id="${t.id}">Edit</button>
                <button class="text-btn delete" data-transaction-id="${t.id}" data-description="${t.description.replace(/"/g, '&quot;')}">Delete</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `
}

// Format date for display (e.g., "Jul 18, 2025")
function formatDatePretty(dateStr) {
  const date = new Date(dateStr)
  const options = { month: 'short', day: 'numeric', year: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

// Set up filter event listeners
function setupFilterListeners(appState) {
  // Search input with debounce
  const searchInput = document.getElementById('search-input')
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      filterState.searchQuery = e.target.value
      updateTransactionsView(appState)
    }, 300))
  }
  
  // Category filter
  const categoryFilter = document.getElementById('category-filter')
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      filterState.category = e.target.value
      updateTransactionsView(appState)
    })
  }
  
  // Date filter
  const dateFilter = document.getElementById('date-filter')
  if (dateFilter) {
    dateFilter.addEventListener('change', (e) => {
      filterState.selectedDate = e.target.value || null
      updateTransactionsView(appState)
    })
  }
  
  // Setup transaction action buttons
  setupTransactionActions(appState)
}

// Update transactions view with current filters
function updateTransactionsView(appState) {
  // Recalculate filtered transactions and summary
  const filteredTransactions = getFilteredTransactions()
  const summary = calculateSummary(filteredTransactions)
  
  // Update summary cards
  document.querySelector('.summary-income').textContent = 
    maskCurrency(summary.totalIncome, appState.privacyMode, { showPlus: true })
  document.querySelector('.summary-expense').textContent = 
    maskCurrency(-summary.totalExpenses, appState.privacyMode)
  document.querySelector('.summary-balance').textContent = 
    maskCurrency(summary.netBalance, appState.privacyMode, { showPlus: true })
  
  // Update table
  const tableContainer = document.querySelector('.transactions-table-container')
  if (tableContainer) {
    tableContainer.innerHTML = renderTransactionsTable(filteredTransactions, appState.privacyMode)
    
    // Re-attach action listeners
    setupTransactionActions(appState)
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
      (t.notes && t.notes.toLowerCase().includes(query)) ||
      (t.category && t.category.toLowerCase().includes(query))
    )
  }
  
  // Apply category filter
  if (filterState.category) {
    filtered = filtered.filter(t => t.category === filterState.category)
  }
  
  // Apply date filter
  if (filterState.selectedDate) {
    const filterDate = new Date(filterState.selectedDate)
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
  return filterState.searchQuery || filterState.category || filterState.selectedDate
}

// Setup transaction action buttons (edit/delete)
function setupTransactionActions(appState) {
  const tableContainer = document.querySelector('.transactions-table-container')
  if (!tableContainer) return
  
  // Use event delegation for better performance
  tableContainer.addEventListener('click', async (e) => {
    // Handle edit button clicks
    if (e.target.classList.contains('edit')) {
      e.stopPropagation()
      const transactionId = e.target.dataset.transactionId
      const transaction = allTransactions.find(t => t.id === transactionId)
      
      if (transaction) {
        const { showTransactionModal } = await import('./transactionForms.js')
        await showTransactionModal(transaction)
      }
    }
    
    // Handle delete button clicks
    if (e.target.classList.contains('delete')) {
      e.stopPropagation()
      const transactionId = e.target.dataset.transactionId
      const description = e.target.dataset.description
      
      // Import modal manager
      const { modalManager } = await import('../app.js')
      
      // Show delete confirmation modal
      const confirmed = await modalManager.confirm({
        title: 'Delete Transaction?',
        message: `Are you sure you want to delete "${description}"? This action cannot be undone.`,
        confirmText: 'Delete Transaction',
        confirmClass: 'btn-danger',
        cancelText: 'Cancel'
      })
      
      if (confirmed) {
        try {
          const { deleteTransaction, getTransactions } = await import('./database.js')
          await deleteTransaction(transactionId)
          
          // Reload transactions
          allTransactions = await getTransactions({ limit: 1000 })
          updateTransactionsView(appState)
          
          // Show success message
          modalManager.showNotification('Transaction deleted successfully', 'success')
        } catch (error) {
          console.error('Failed to delete transaction:', error)
          modalManager.showNotification('Failed to delete transaction', 'error')
        }
      }
    }
  })
}

// Setup transaction event handlers
function setupTransactionEventHandlers() {
  // Add Transaction button
  const addTransactionBtn = document.getElementById('add-transaction-btn')
  if (addTransactionBtn) {
    addTransactionBtn.addEventListener('click', async () => {
      const { showTransactionModal } = await import('./transactionForms.js')
      await showTransactionModal()
    })
  }
}