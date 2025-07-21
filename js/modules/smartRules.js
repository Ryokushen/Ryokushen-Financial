// Smart Rules Module

import { getSmartRules as fetchSmartRules } from './database.js'

// Load smart rules from database
export async function loadSmartRules() {
  try {
    console.log('Loading smart rules from database...')
    const rules = await fetchSmartRules()
    console.log(`Loaded ${rules.length} smart rules from database`)
    return rules
  } catch (error) {
    console.error('Failed to load smart rules:', error)
    // Return empty array as fallback
    return []
  }
}

// Process transactions with smart rules
export async function processTransactions(transactions, rules) {
  // TODO: Implement rule processing logic
  console.log('Processing transactions with smart rules...')
}

// Render rules page
export async function renderRules(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  const activeRules = appState.data.smartRules.filter(r => r.enabled !== false)
  
  container.innerHTML = `
    <div class="rules-page">
      <div class="page-header mb-6">
        <h2>Smart Rules</h2>
        <button class="btn btn-primary">Create Rule</button>
      </div>
      
      <div class="rules-summary glass-panel mb-6">
        <h3>Rules Overview</h3>
        <p class="text-secondary mt-2">${activeRules.length} active rules</p>
        <p class="text-sm text-tertiary">Automatically categorizing your transactions</p>
      </div>
      
      <div class="rules-list">
        ${renderRulesList(activeRules)}
      </div>
    </div>
  `
}

// Render rules list
function renderRulesList(rules) {
  if (!rules || rules.length === 0) {
    return '<p class="empty-state">No smart rules configured</p>'
  }
  
  return `
    <div class="glass-panel">
      ${rules.map(rule => `
        <div class="rule-item">
          <div class="rule-info">
            <h4>${rule.name}</h4>
            <p class="text-sm text-secondary">
              If ${rule.conditions?.field || 'description'} ${rule.conditions?.operator || 'contains'} "${rule.conditions?.value || ''}"
            </p>
            <p class="text-sm text-tertiary">
              Then set category to "${rule.actions?.category || 'N/A'}"
            </p>
          </div>
          <div class="rule-status">
            <span class="badge ${rule.enabled ? 'badge-success' : 'badge-disabled'}">
              ${rule.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>
      `).join('')}
    </div>
  `
}