// Debt Module

import { formatCurrency, maskCurrency } from './ui.js'

// Render debt page
export async function renderDebt(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  const totalDebt = appState.data.debtAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  
  container.innerHTML = `
    <div class="debt-page">
      <div class="page-header mb-6">
        <h2>Debt Management</h2>
        <button class="btn btn-primary">Add Debt Account</button>
      </div>
      
      <div class="debt-summary glass-panel mb-6">
        <h3>Total Debt</h3>
        <p class="text-3xl font-bold mt-2">${maskCurrency(totalDebt, appState.privacyMode)}</p>
        <p class="text-positive">-2.1% this month</p>
      </div>
      
      <div class="debt-accounts">
        ${appState.data.debtAccounts.map(account => `
          <div class="glass-panel mb-4">
            <div class="flex justify-between items-start">
              <div>
                <h4>${account.name}</h4>
                <p class="text-2xl font-semibold mt-2">${maskCurrency(account.balance, appState.privacyMode)}</p>
                <p class="text-sm text-secondary">APR: ${account.interest_rate}%</p>
              </div>
              <div class="text-right">
                ${account.credit_limit ? `
                  <p class="text-sm text-secondary">Credit Limit</p>
                  <p class="font-medium">${maskCurrency(account.credit_limit, appState.privacyMode)}</p>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}