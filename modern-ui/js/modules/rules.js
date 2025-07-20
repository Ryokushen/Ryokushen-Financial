// Smart Rules Module - Modern Design

import { formatCurrency, maskCurrency } from './ui.js'

// Mock data for development
const mockRules = [
  {
    id: '1',
    name: 'Food Delivery',
    description: 'Automatically categorize food delivery as Food',
    enabled: true,
    conditions: [
      { field: 'description', operator: 'contains', value: 'DOORDASH' },
      { field: 'description', operator: 'contains', value: 'UBER EATS' },
      { field: 'description', operator: 'contains', value: 'GRUBHUB' },
      { field: 'description', operator: 'contains', value: 'POSTMATES' },
      { field: 'description', operator: 'contains', value: 'SEAMLESS' }
    ],
    conditionLogic: 'OR',
    actions: [
      { type: 'setCategory', value: 'Dining' },
      { type: 'addTag', value: 'delivery' }
    ],
    stats: {
      matches: 4,
      lastApplied: '2025-07-19',
      created: '2025-06-15'
    }
  },
  {
    id: '2',
    name: 'Toyota Food',
    description: 'Categorize Food/Snack Purchases',
    enabled: true,
    conditions: [
      { field: 'description', operator: 'contains', value: 'Toyota' }
    ],
    conditionLogic: 'AND',
    actions: [
      { type: 'setCategory', value: 'Dining' }
    ],
    stats: {
      matches: 7,
      lastApplied: '2025-07-17',
      created: '2025-07-10'
    }
  }
]

// Calculate rules summary
function calculateRulesSummary(rules) {
  const summary = {
    activeRules: 0,
    totalMatches: 0,
    timeSaved: 0,
    successRate: 98.5
  }
  
  rules.forEach(rule => {
    if (rule.enabled) {
      summary.activeRules++
    }
    summary.totalMatches += rule.stats.matches || 0
  })
  
  // Estimate time saved (2 seconds per match)
  summary.timeSaved = Math.round((summary.totalMatches * 2) / 60)
  
  return summary
}

// Format condition for display
function formatCondition(condition) {
  const operatorText = {
    'contains': 'contains',
    'equals': 'equals',
    'startsWith': 'starts with',
    'endsWith': 'ends with',
    'greaterThan': 'is greater than',
    'lessThan': 'is less than',
    'between': 'is between'
  }
  
  return `${condition.field.charAt(0).toUpperCase() + condition.field.slice(1)} ${operatorText[condition.operator] || condition.operator} <span class="logic-value">"${condition.value}"</span>`
}

// Format action for display
function formatAction(action) {
  const actionText = {
    'setCategory': 'Set category to',
    'addTag': 'Add tag',
    'addNote': 'Add note'
  }
  
  return `${actionText[action.type] || action.type} <span class="logic-value">"${action.value}"</span>`
}

// Render rules page
export async function renderRules(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  const rules = mockRules
  const summary = calculateRulesSummary(rules)
  
  container.innerHTML = `
    <div class="rules-page">
      <!-- Page Header -->
      <div class="page-header">
        <h1 class="page-title">Smart Rules</h1>
        <div class="header-actions">
          <button class="header-btn add-rule-btn" id="add-rule-btn">
            <span>+</span>
            <span>Add Rule</span>
          </button>
          <button class="header-btn secondary-btn" id="use-template-btn">
            <span>📋</span>
            <span>Use Template</span>
          </button>
          <button class="header-btn secondary-btn" id="reprocess-btn">
            <span>🔄</span>
            <span>Reprocess All</span>
          </button>
        </div>
      </div>
      
      <!-- Summary Cards -->
      <div class="summary-section">
        <div class="summary-card">
          <div class="summary-label">Active Rules</div>
          <div class="summary-value active">${summary.activeRules}</div>
          <div class="summary-subtext">Currently running</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Matches</div>
          <div class="summary-value matches">${summary.totalMatches}</div>
          <div class="summary-subtext">Transactions categorized</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Time Saved</div>
          <div class="summary-value processing">~${summary.timeSaved} min</div>
          <div class="summary-subtext">Per month automated</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Success Rate</div>
          <div class="summary-value efficiency">${summary.successRate}%</div>
          <div class="summary-subtext">Accuracy score</div>
        </div>
      </div>
      
      <!-- Your Rules Section -->
      <div class="rules-section">
        <div class="section-header">
          <h2 class="section-title">Your Rules</h2>
          <div class="apply-toggle">
            <span>Apply to Existing</span>
            <div class="toggle-switch" id="apply-existing-toggle">
              <div class="toggle-slider"></div>
            </div>
          </div>
        </div>
        
        <div class="rules-grid">
          ${rules.length > 0 ? rules.map(rule => `
            <div class="rule-card${!rule.enabled ? ' disabled' : ''}">
              <div class="rule-header">
                <div class="rule-info">
                  <h3 class="rule-name">${rule.name}</h3>
                  <p class="rule-description">${rule.description}</p>
                </div>
                <div class="rule-controls">
                  <div class="rule-toggle${rule.enabled ? ' active' : ''}" data-rule-id="${rule.id}">
                    <div class="rule-toggle-slider"></div>
                  </div>
                  <div class="rule-actions">
                    <button class="action-btn edit" data-rule-id="${rule.id}" data-rule-name="${rule.name}">Edit</button>
                    <button class="action-btn delete" data-rule-id="${rule.id}" data-rule-name="${rule.name}">Delete</button>
                  </div>
                </div>
              </div>
              
              <div class="rule-logic">
                <div class="logic-section">
                  <div class="logic-label">
                    <span class="logic-icon if-icon">IF</span>
                    <span>Conditions</span>
                  </div>
                  <div class="logic-content">
                    ${rule.conditions.map((condition, index) => 
                      `${formatCondition(condition)}${index < rule.conditions.length - 1 ? `<span class="logic-operator"> ${rule.conditionLogic} </span>` : ''}`
                    ).join('')}
                  </div>
                </div>
                <div class="logic-section">
                  <div class="logic-label">
                    <span class="logic-icon then-icon">THEN</span>
                    <span>Actions</span>
                  </div>
                  <div class="logic-content">
                    ${rule.actions.map(action => `• ${formatAction(action)}`).join('<br>')}
                  </div>
                </div>
              </div>
              
              <div class="rule-stats">
                <div class="stat-item">
                  <span class="stat-label">Matches</span>
                  <span class="stat-value">${rule.stats.matches}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Last Applied</span>
                  <span class="stat-value">${new Date(rule.stats.lastApplied).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Created</span>
                  <span class="stat-value">${new Date(rule.stats.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </div>
            </div>
          `).join('') : `
            <div class="empty-state">
              <div class="empty-icon">🎯</div>
              <div class="empty-title">No Rules Yet</div>
              <div class="empty-text">Create your first rule to start automating transaction categorization</div>
            </div>
          `}
        </div>
      </div>
      
      <!-- Templates Section -->
      <div class="templates-section">
        <h3 class="templates-title">Need More Rules?</h3>
        <p class="templates-description">
          Browse our library of pre-built rule templates for common transactions, or let AI suggest rules based on your spending patterns.
        </p>
        <button class="templates-btn" id="browse-templates-btn">Browse Templates</button>
      </div>
    </div>
  `
  
  // Set up event handlers
  setupRulesEventHandlers(appState)
}

// Set up event handlers
function setupRulesEventHandlers(appState) {
  // Add rule button
  const addRuleBtn = document.getElementById('add-rule-btn')
  if (addRuleBtn) {
    addRuleBtn.addEventListener('click', () => showAddRuleModal(appState))
  }
  
  // Use template button
  const useTemplateBtn = document.getElementById('use-template-btn')
  if (useTemplateBtn) {
    useTemplateBtn.addEventListener('click', () => showTemplatesModal(appState))
  }
  
  // Reprocess button
  const reprocessBtn = document.getElementById('reprocess-btn')
  if (reprocessBtn) {
    reprocessBtn.addEventListener('click', () => handleReprocessAll(appState))
  }
  
  // Browse templates button
  const browseTemplatesBtn = document.getElementById('browse-templates-btn')
  if (browseTemplatesBtn) {
    browseTemplatesBtn.addEventListener('click', () => showTemplatesModal(appState))
  }
  
  // Apply to existing toggle
  const applyExistingToggle = document.getElementById('apply-existing-toggle')
  if (applyExistingToggle) {
    applyExistingToggle.addEventListener('click', (e) => {
      e.currentTarget.classList.toggle('active')
    })
  }
  
  // Rule toggles
  document.querySelectorAll('.rule-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      const ruleId = e.currentTarget.dataset.ruleId
      toggleRule(ruleId, e.currentTarget, appState)
    })
  })
  
  // Rule actions
  document.querySelectorAll('.rule-actions .action-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const ruleId = e.target.dataset.ruleId
      const ruleName = e.target.dataset.ruleName
      
      if (e.target.classList.contains('edit')) {
        showEditRuleModal(ruleId, ruleName, appState)
      } else if (e.target.classList.contains('delete')) {
        await handleDeleteRule(ruleId, ruleName, appState)
      }
    })
  })
}

// Toggle rule enabled state
function toggleRule(ruleId, toggleElement, appState) {
  toggleElement.classList.toggle('active')
  const ruleCard = toggleElement.closest('.rule-card')
  if (!toggleElement.classList.contains('active')) {
    ruleCard.classList.add('disabled')
  } else {
    ruleCard.classList.remove('disabled')
  }
  
  // TODO: Update rule in database
  console.log('Toggling rule:', ruleId)
}

// Show add rule modal
async function showAddRuleModal(appState) {
  const { modalManager } = await import('../app.js')
  
  const modalContent = `
    <h2>Create Smart Rule</h2>
    <form id="add-rule-form">
      <div class="form-group">
        <label for="rule-name">Rule Name</label>
        <input type="text" id="rule-name" name="name" required placeholder="e.g., Amazon Purchases">
      </div>
      <div class="form-group">
        <label for="rule-description">Description</label>
        <input type="text" id="rule-description" name="description" placeholder="Automatically categorize Amazon purchases">
      </div>
      
      <div class="form-section">
        <h3>If Conditions</h3>
        <div id="conditions-container">
          <div class="condition-row">
            <select name="field" class="condition-field">
              <option value="description">Description</option>
              <option value="amount">Amount</option>
              <option value="merchant">Merchant</option>
            </select>
            <select name="operator" class="condition-operator">
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="startsWith">Starts with</option>
              <option value="greaterThan">Greater than</option>
              <option value="lessThan">Less than</option>
            </select>
            <input type="text" name="value" class="condition-value" placeholder="Value" required>
          </div>
        </div>
        <button type="button" class="btn-secondary" id="add-condition-btn">+ Add Condition</button>
      </div>
      
      <div class="form-section">
        <h3>Then Actions</h3>
        <div class="form-group">
          <label for="action-category">Set Category</label>
          <select id="action-category" name="category">
            <option value="">Don't change</option>
            <option value="Dining">Dining</option>
            <option value="Shopping">Shopping</option>
            <option value="Transportation">Transportation</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Utilities">Utilities</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="action-tags">Add Tags (comma separated)</label>
          <input type="text" id="action-tags" name="tags" placeholder="e.g., online, subscription">
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn-primary">Create Rule</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  // Add condition button handler
  document.getElementById('add-condition-btn')?.addEventListener('click', () => {
    const container = document.getElementById('conditions-container')
    const newCondition = document.createElement('div')
    newCondition.className = 'condition-row'
    newCondition.innerHTML = `
      <select name="field" class="condition-field">
        <option value="description">Description</option>
        <option value="amount">Amount</option>
        <option value="merchant">Merchant</option>
      </select>
      <select name="operator" class="condition-operator">
        <option value="contains">Contains</option>
        <option value="equals">Equals</option>
        <option value="startsWith">Starts with</option>
        <option value="greaterThan">Greater than</option>
        <option value="lessThan">Less than</option>
      </select>
      <input type="text" name="value" class="condition-value" placeholder="Value" required>
      <button type="button" class="remove-condition-btn" onclick="this.parentElement.remove()">×</button>
    `
    container.appendChild(newCondition)
  })
  
  // Handle form submission
  document.getElementById('add-rule-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    // TODO: Save to database
    console.log('Creating rule:', Object.fromEntries(formData))
    
    modalManager.close()
    modalManager.showNotification('Smart rule created successfully', 'success')
    
    // Refresh the page
    await renderRules(appState)
  })
}

// Show edit rule modal
async function showEditRuleModal(ruleId, ruleName, appState) {
  const { modalManager } = await import('../app.js')
  
  // TODO: Load actual rule data
  const rule = mockRules.find(r => r.id === ruleId)
  
  const modalContent = `
    <h2>Edit Smart Rule</h2>
    <form id="edit-rule-form">
      <div class="form-group">
        <label for="rule-name">Rule Name</label>
        <input type="text" id="rule-name" name="name" value="${rule.name}" required>
      </div>
      <div class="form-group">
        <label for="rule-description">Description</label>
        <input type="text" id="rule-description" name="description" value="${rule.description}">
      </div>
      
      <div class="form-section">
        <h3>If Conditions</h3>
        <div id="conditions-container">
          ${rule.conditions.map((condition, index) => `
            <div class="condition-row">
              <select name="field" class="condition-field">
                <option value="description" ${condition.field === 'description' ? 'selected' : ''}>Description</option>
                <option value="amount" ${condition.field === 'amount' ? 'selected' : ''}>Amount</option>
                <option value="merchant" ${condition.field === 'merchant' ? 'selected' : ''}>Merchant</option>
              </select>
              <select name="operator" class="condition-operator">
                <option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>Contains</option>
                <option value="equals" ${condition.operator === 'equals' ? 'selected' : ''}>Equals</option>
                <option value="startsWith" ${condition.operator === 'startsWith' ? 'selected' : ''}>Starts with</option>
                <option value="greaterThan" ${condition.operator === 'greaterThan' ? 'selected' : ''}>Greater than</option>
                <option value="lessThan" ${condition.operator === 'lessThan' ? 'selected' : ''}>Less than</option>
              </select>
              <input type="text" name="value" class="condition-value" value="${condition.value}" required>
              ${index > 0 ? '<button type="button" class="remove-condition-btn" onclick="this.parentElement.remove()">×</button>' : ''}
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn-secondary" id="add-condition-btn">+ Add Condition</button>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  // Handle form submission
  document.getElementById('edit-rule-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    
    // TODO: Update in database
    modalManager.close()
    modalManager.showNotification('Rule updated successfully', 'success')
    
    // Refresh the page
    await renderRules(appState)
  })
}

// Handle delete rule
async function handleDeleteRule(ruleId, ruleName, appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Delete Smart Rule?',
    message: `Are you sure you want to delete "${ruleName}"? This action cannot be undone.`,
    confirmText: 'Delete Rule',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    // TODO: Delete from database
    console.log('Deleting rule:', ruleId)
    
    modalManager.showNotification('Rule deleted successfully', 'success')
    
    // Refresh the page
    await renderRules(appState)
  }
}

// Show templates modal
async function showTemplatesModal(appState) {
  const { modalManager } = await import('../app.js')
  
  const templates = [
    { name: 'Subscription Services', description: 'Identify and categorize recurring subscriptions', category: 'Popular' },
    { name: 'Food & Dining', description: 'Categorize restaurants and food delivery', category: 'Popular' },
    { name: 'Transportation', description: 'Categorize Uber, Lyft, gas, and parking', category: 'Popular' },
    { name: 'Online Shopping', description: 'Categorize Amazon, eBay, and other online stores', category: 'Shopping' },
    { name: 'Utilities', description: 'Categorize electric, gas, water, and internet bills', category: 'Bills' },
    { name: 'Healthcare', description: 'Categorize medical, dental, and pharmacy expenses', category: 'Health' }
  ]
  
  const modalContent = `
    <h2>Rule Templates</h2>
    <div class="templates-grid">
      ${templates.map(template => `
        <div class="template-card">
          <h3>${template.name}</h3>
          <p>${template.description}</p>
          <span class="template-category">${template.category}</span>
          <button class="btn-primary use-template-btn" data-template="${template.name}">Use Template</button>
        </div>
      `).join('')}
    </div>
    <div class="form-actions">
      <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Close</button>
    </div>
  `
  
  modalManager.show(modalContent)
  
  // Handle template selection
  document.querySelectorAll('.use-template-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const templateName = e.target.dataset.template
      modalManager.close()
      modalManager.showNotification(`Template "${templateName}" applied successfully`, 'success')
      await renderRules(appState)
    })
  })
}

// Handle reprocess all
async function handleReprocessAll(appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Reprocess All Transactions?',
    message: 'This will apply all active rules to your existing transactions. This may take a few moments.',
    confirmText: 'Reprocess',
    confirmClass: 'btn-primary',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    modalManager.showNotification('Reprocessing transactions...', 'info')
    
    // TODO: Actually reprocess transactions
    setTimeout(() => {
      modalManager.showNotification('All transactions reprocessed successfully', 'success')
    }, 2000)
  }
}

// Export functions
export default {
  renderRules
}