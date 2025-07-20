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
        <button class="btn btn-primary">Add Transaction</button>
      </div>
      
      <div class="transactions-filters">
        <input type="text" class="input-glass" placeholder="Search transactions...">
        <select class="input-glass">
          <option>All Categories</option>
          <option>Income</option>
          <option>Housing</option>
          <option>Transportation</option>
          <option>Food</option>
        </select>
        <input type="date" class="input-glass">
      </div>
      
      <div class="transactions-list">
        ${renderTransactionsList(appState.data.transactions, appState.privacyMode)}
      </div>
    </div>
  `
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