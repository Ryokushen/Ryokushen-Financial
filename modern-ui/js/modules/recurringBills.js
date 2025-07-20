// Recurring Bills Module

import { getRecurringBills as fetchRecurringBills } from './database.js'
import { formatCurrency, formatDate, maskCurrency } from './ui.js'

// Load recurring bills from database
export async function loadRecurringBills() {
  try {
    const bills = await fetchRecurringBills()
    return bills || []
  } catch (error) {
    console.error('Failed to load recurring bills:', error)
    return []
  }
}

// Render bills page
export async function renderBills(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  const activeBills = appState.data.recurringBills.filter(b => b.active !== false)
  const totalMonthly = calculateMonthlyTotal(activeBills)
  
  container.innerHTML = `
    <div class="bills-page">
      <div class="page-header mb-6">
        <h2>Recurring Bills</h2>
        <button class="btn btn-primary">Add Bill</button>
      </div>
      
      <div class="bills-summary glass-panel mb-6">
        <h3>Monthly Summary</h3>
        <p class="text-3xl font-bold mt-2">${maskCurrency(totalMonthly, appState.privacyMode)}</p>
        <p class="text-secondary">${activeBills.length} active bills</p>
      </div>
      
      <div class="bills-list">
        ${renderBillsList(activeBills, appState.privacyMode)}
      </div>
    </div>
  `
}

// Calculate monthly total
function calculateMonthlyTotal(bills) {
  return bills.reduce((sum, bill) => {
    const monthlyAmount = getMonthlyAmount(bill)
    return sum + monthlyAmount
  }, 0)
}

// Get monthly amount based on frequency
function getMonthlyAmount(bill) {
  const amount = bill.amount || 0
  switch (bill.frequency) {
    case 'weekly':
      return amount * 4.33 // Average weeks per month
    case 'bi-weekly':
      return amount * 2.17
    case 'monthly':
      return amount
    case 'quarterly':
      return amount / 3
    case 'annually':
      return amount / 12
    default:
      return amount
  }
}

// Render bills list
function renderBillsList(bills, privacyMode) {
  if (!bills || bills.length === 0) {
    return '<p class="empty-state">No recurring bills</p>'
  }
  
  return `
    <div class="glass-panel">
      ${bills.map(bill => `
        <div class="bill-item">
          <div class="bill-info">
            <h4>${bill.name}</h4>
            <p class="text-sm text-secondary">${bill.category} • ${bill.frequency}</p>
            <p class="text-sm text-tertiary">Next due: ${formatDate(bill.next_due)}</p>
          </div>
          <div class="bill-amount">
            <p class="text-lg font-semibold">${maskCurrency(bill.amount, privacyMode)}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `
}