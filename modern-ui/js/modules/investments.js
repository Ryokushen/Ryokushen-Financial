// Investments Module

import { formatCurrency, maskCurrency } from './ui.js'

// Render investments page
export async function renderInvestments(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  const totalValue = appState.data.investmentAccounts.reduce((sum, acc) => sum + (acc.current_value || 0), 0)
  
  container.innerHTML = `
    <div class="investments-page">
      <div class="page-header mb-6">
        <h2>Investments</h2>
        <button class="btn btn-primary">Add Investment</button>
      </div>
      
      <div class="investment-summary glass-panel mb-6">
        <h3>Portfolio Value</h3>
        <p class="text-3xl font-bold mt-2">${maskCurrency(totalValue, appState.privacyMode)}</p>
        <p class="text-positive">+12.8% this year</p>
      </div>
      
      <div class="investment-accounts">
        ${appState.data.investmentAccounts.map(account => `
          <div class="glass-panel mb-4">
            <h4>${account.name}</h4>
            <p class="text-2xl font-semibold mt-2">${maskCurrency(account.current_value, appState.privacyMode)}</p>
            <p class="text-sm text-secondary">${account.account_type || 'Brokerage'}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `
}