// js/modules/rulesUI.js
import { smartRules } from './smartRules.js'
import { formatDate, escapeHtml } from './utils.js'
import { showError, showSuccess, openModal, closeModal, announceToScreenReader } from './ui.js'
import { debug } from './debug.js'
import { eventManager } from './eventManager.js'
import { categories } from './categories.js'

export const rulesUI = {
  currentEditingRule: null,

  init() {
    debug.log('RulesUI: Initializing')
    this.setupEventListeners()
    this.loadRulesList()
    this.updateSummary()
    
    // Listen for rule updates
    eventManager.on('rule:created', () => this.refresh())
    eventManager.on('rule:updated', () => this.refresh())
    eventManager.on('rule:deleted', () => this.refresh())
    eventManager.on('rule:matched', (data) => this.handleRuleMatch(data))
  },

  setupEventListeners() {
    // Add rule button
    document.getElementById('add-rule-btn')?.addEventListener('click', () => {
      this.openRuleModal()
    })

    // Modal controls
    document.getElementById('close-rule-modal')?.addEventListener('click', () => {
      closeModal('rule-modal')
    })
    
    document.getElementById('cancel-rule-btn')?.addEventListener('click', () => {
      closeModal('rule-modal')
    })

    // Form submission
    document.getElementById('rule-form')?.addEventListener('submit', (e) => {
      this.handleRuleSubmit(e)
    })

    // Apply rules button
    document.getElementById('apply-rules-btn')?.addEventListener('click', () => {
      this.applyRulesToExisting()
    })

    // Field change handler for dynamic operators
    document.querySelector('.condition-field')?.addEventListener('change', (e) => {
      this.updateOperatorOptions(e.target)
    })

    // Action type change handler
    document.getElementById('rule-action-type')?.addEventListener('change', (e) => {
      this.updateActionValueInput(e.target.value)
    })

    // Rule list delegation
    document.getElementById('rules-list-container')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('rule-toggle-switch')) {
        const ruleId = e.target.closest('.rule-item').dataset.ruleId
        this.toggleRule(ruleId, e.target.checked)
      } else if (e.target.classList.contains('btn-edit-rule')) {
        const ruleId = e.target.closest('.rule-item').dataset.ruleId
        this.editRule(ruleId)
      } else if (e.target.classList.contains('btn-delete-rule')) {
        const ruleId = e.target.closest('.rule-item').dataset.ruleId
        this.deleteRule(ruleId)
      }
    })
  },

  async loadRulesList() {
    try {
      const { data: rules, error } = await smartRules.getAllRules()
      if (error) throw error

      this.renderRulesList(rules)
    } catch (error) {
      debug.error('RulesUI: Error loading rules', error)
      showError('Failed to load rules')
    }
  },

  renderRulesList(rules) {
    const container = document.getElementById('rules-list-container')
    if (!container) return

    if (rules.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
          </svg>
          <p>No rules created yet</p>
          <p class="empty-state-hint">Create your first rule to start automating your transactions</p>
        </div>
      `
      return
    }

    container.innerHTML = rules.map(rule => `
      <div class="rule-item ${!rule.enabled ? 'disabled' : ''}" data-rule-id="${rule.id}">
        <div class="rule-header">
          <div class="rule-info">
            <div class="rule-name">
              ${escapeHtml(rule.name)}
              ${rule.priority > 0 ? `<span class="priority-badge">Priority: ${rule.priority}</span>` : ''}
            </div>
            ${rule.description ? `<div class="rule-description">${escapeHtml(rule.description)}</div>` : ''}
            <div class="rule-stats">
              <span class="rule-stat">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 11l3 3L22 4"></path>
                </svg>
                ${rule.stats?.matches || 0} matches
              </span>
              ${rule.stats?.last_matched ? `
                <span class="rule-stat">
                  Last: ${formatDate(rule.stats.last_matched)}
                </span>
              ` : ''}
            </div>
          </div>
          <div class="rule-actions">
            <label class="switch rule-toggle">
              <input type="checkbox" class="rule-toggle-switch" ${rule.enabled ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <button class="btn btn--sm btn--secondary btn-edit-rule">Edit</button>
            <button class="btn btn--sm btn--outline btn-delete-rule">Delete</button>
          </div>
        </div>
        
        <div class="rule-details">
          ${this.renderConditions(rule.conditions)}
          ${this.renderActions(rule.actions)}
        </div>
      </div>
    `).join('')
  },

  renderConditions(conditions) {
    if (!conditions || !conditions.items) return ''

    return `
      <div class="rule-conditions">
        <span class="condition-label">If:</span>
        ${conditions.items.map((condition, index) => `
          ${index > 0 ? ` ${conditions.type} ` : ''}
          ${this.formatCondition(condition)}
        `).join('')}
      </div>
    `
  },

  formatCondition(condition) {
    const fieldLabels = {
      description: 'Description',
      amount: 'Amount',
      category: 'Category',
      type: 'Transaction Type'
    }

    const operatorLabels = {
      contains: 'contains',
      equals: 'equals',
      equals_ignore_case: 'equals (ignore case)',
      starts_with: 'starts with',
      ends_with: 'ends with',
      greater_than: '>',
      less_than: '<',
      greater_than_or_equal: '≥',
      less_than_or_equal: '≤',
      between: 'between',
      regex: 'matches pattern',
      in_list: 'in'
    }

    return `${fieldLabels[condition.field] || condition.field} ${operatorLabels[condition.operator] || condition.operator} "${escapeHtml(condition.value)}"`
  },

  renderActions(actions) {
    if (!actions || actions.length === 0) return ''

    return actions.map(action => `
      <div class="rule-action">
        <span class="action-label">Then:</span>
        ${this.formatAction(action)}
      </div>
    `).join('')
  },

  formatAction(action) {
    const actionLabels = {
      set_category: 'Set category to',
      add_tag: 'Add tag',
      add_note: 'Add note',
      alert: 'Show alert'
    }

    return `${actionLabels[action.type] || action.type} "${escapeHtml(action.value)}"`
  },

  openRuleModal(ruleId = null) {
    this.currentEditingRule = ruleId
    const modal = document.getElementById('rule-modal')
    const title = document.getElementById('rule-modal-title')
    
    // Reset form
    document.getElementById('rule-form').reset()
    document.getElementById('rule-id').value = ruleId || ''
    
    if (ruleId) {
      title.textContent = 'Edit Smart Rule'
      this.loadRuleForEdit(ruleId)
    } else {
      title.textContent = 'Create Smart Rule'
      document.getElementById('rule-priority').value = '0'
      document.getElementById('rule-enabled').checked = true
    }
    
    openModal('rule-modal')
  },

  async loadRuleForEdit(ruleId) {
    try {
      const { data: rules } = await smartRules.getAllRules()
      const rule = rules.find(r => r.id === ruleId)
      
      if (!rule) {
        showError('Rule not found')
        return
      }

      // Populate form
      document.getElementById('rule-name').value = rule.name
      document.getElementById('rule-description').value = rule.description || ''
      document.getElementById('rule-priority').value = rule.priority || 0
      document.getElementById('rule-enabled').checked = rule.enabled

      // Populate condition (simplified for MVP - single condition)
      if (rule.conditions && rule.conditions.items && rule.conditions.items[0]) {
        const condition = rule.conditions.items[0]
        document.querySelector('.condition-field').value = condition.field
        this.updateOperatorOptions(document.querySelector('.condition-field'))
        document.querySelector('.condition-operator').value = condition.operator
        document.querySelector('.condition-value').value = condition.value
      }

      // Populate action (simplified for MVP - single action)
      if (rule.actions && rule.actions[0]) {
        const action = rule.actions[0]
        document.getElementById('rule-action-type').value = action.type
        this.updateActionValueInput(action.type)
        
        // Set the action value after the input is updated
        setTimeout(() => {
          const actionValueInput = document.getElementById('rule-action-value')
          if (actionValueInput) {
            actionValueInput.value = action.value
          }
        }, 0)
      }
    } catch (error) {
      debug.error('RulesUI: Error loading rule for edit', error)
      showError('Failed to load rule')
    }
  },

  updateOperatorOptions(fieldSelect) {
    const field = fieldSelect.value
    const operatorSelect = fieldSelect.parentElement.querySelector('.condition-operator')
    
    const textOperators = `
      <option value="">Select Operator</option>
      <option value="contains">Contains</option>
      <option value="equals">Equals</option>
      <option value="starts_with">Starts With</option>
      <option value="ends_with">Ends With</option>
      <option value="regex">Matches Pattern (Regex)</option>
    `
    
    const numberOperators = `
      <option value="">Select Operator</option>
      <option value="equals">Equals</option>
      <option value="greater_than">Greater Than</option>
      <option value="less_than">Less Than</option>
      <option value="greater_than_or_equal">Greater Than or Equal</option>
      <option value="less_than_or_equal">Less Than or Equal</option>
      <option value="between">Between</option>
    `

    if (field === 'amount') {
      operatorSelect.innerHTML = numberOperators
    } else {
      operatorSelect.innerHTML = textOperators
    }
  },

  updateActionValueInput(actionType) {
    const valueGroup = document.getElementById('action-value-group')
    const label = valueGroup.querySelector('label')
    
    if (actionType === 'set_category') {
      // Replace input with select for categories
      label.textContent = 'Category'
      valueGroup.innerHTML = `
        <label class="form-label" for="rule-action-value">Category</label>
        <select id="rule-action-value" class="form-control" required>
          <option value="">Select Category</option>
          ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        </select>
      `
    } else if (actionType === 'add_tag') {
      label.textContent = 'Tag Name'
      valueGroup.innerHTML = `
        <label class="form-label" for="rule-action-value">Tag Name</label>
        <input type="text" id="rule-action-value" class="form-control" required 
               placeholder="e.g., subscription, weekend">
      `
    } else if (actionType === 'add_note') {
      label.textContent = 'Note Text'
      valueGroup.innerHTML = `
        <label class="form-label" for="rule-action-value">Note Text</label>
        <input type="text" id="rule-action-value" class="form-control" required 
               placeholder="Note to add">
      `
    } else {
      label.textContent = 'Value'
      valueGroup.innerHTML = `
        <label class="form-label" for="rule-action-value">Value</label>
        <input type="text" id="rule-action-value" class="form-control" required>
      `
    }
  },

  async handleRuleSubmit(event) {
    event.preventDefault()

    try {
      const ruleId = document.getElementById('rule-id').value
      
      // Build rule data
      const ruleData = {
        name: document.getElementById('rule-name').value.trim(),
        description: document.getElementById('rule-description').value.trim(),
        priority: parseInt(document.getElementById('rule-priority').value) || 0,
        enabled: document.getElementById('rule-enabled').checked,
        conditions: {
          type: 'AND', // MVP: Single condition only
          items: [{
            field: document.querySelector('.condition-field').value,
            operator: document.querySelector('.condition-operator').value,
            value: document.querySelector('.condition-value').value.trim(),
            case_sensitive: false
          }]
        },
        actions: [{
          type: document.getElementById('rule-action-type').value,
          value: document.getElementById('rule-action-value').value.trim()
        }]
      }

      // Validate
      if (!ruleData.name) {
        showError('Rule name is required')
        return
      }

      if (!ruleData.conditions.items[0].field || !ruleData.conditions.items[0].operator || !ruleData.conditions.items[0].value) {
        showError('Please complete all condition fields')
        return
      }

      if (!ruleData.actions[0].type || !ruleData.actions[0].value) {
        showError('Please complete all action fields')
        return
      }

      // Save rule
      let result
      if (ruleId) {
        result = await smartRules.updateRule(ruleId, ruleData)
      } else {
        result = await smartRules.createRule(ruleData)
      }

      if (result.error) {
        throw result.error
      }

      closeModal('rule-modal')
      showSuccess(ruleId ? 'Rule updated successfully' : 'Rule created successfully')
      this.refresh()

    } catch (error) {
      debug.error('RulesUI: Error saving rule', error)
      showError('Failed to save rule: ' + error.message)
    }
  },

  async toggleRule(ruleId, enabled) {
    try {
      const result = await smartRules.toggleRule(ruleId, enabled)
      if (result.error) throw result.error
      
      announceToScreenReader(`Rule ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      debug.error('RulesUI: Error toggling rule', error)
      showError('Failed to toggle rule')
      // Revert the toggle
      const toggle = document.querySelector(`.rule-item[data-rule-id="${ruleId}"] .rule-toggle-switch`)
      if (toggle) toggle.checked = !enabled
    }
  },

  editRule(ruleId) {
    this.openRuleModal(ruleId)
  },

  async deleteRule(ruleId) {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return
    }

    try {
      const result = await smartRules.deleteRule(ruleId)
      if (result.error) throw result.error
      
      showSuccess('Rule deleted successfully')
      this.refresh()
    } catch (error) {
      debug.error('RulesUI: Error deleting rule', error)
      showError('Failed to delete rule')
    }
  },

  async applyRulesToExisting() {
    if (!confirm('Apply all active rules to existing transactions? This may take a moment.')) {
      return
    }

    try {
      const btn = document.getElementById('apply-rules-btn')
      btn.disabled = true
      btn.textContent = 'Applying...'

      const result = await smartRules.applyRulesToExistingTransactions()
      
      if (result.error) throw result.error

      showSuccess(`Applied rules to ${result.processed} transactions. ${result.matched} matches found.`)
      
      // Refresh transactions view if visible
      eventManager.emit('transactions:updated')
      
    } catch (error) {
      debug.error('RulesUI: Error applying rules', error)
      showError('Failed to apply rules')
    } finally {
      const btn = document.getElementById('apply-rules-btn')
      btn.disabled = false
      btn.textContent = 'Apply to Existing'
    }
  },

  async updateSummary() {
    try {
      const { data: stats } = await smartRules.getRuleStatistics()
      
      document.getElementById('active-rules-count').textContent = stats.active_rules || 0
      document.getElementById('total-matches-count').textContent = stats.total_matches || 0
    } catch (error) {
      debug.error('RulesUI: Error updating summary', error)
    }
  },

  handleRuleMatch(data) {
    // Could show a notification or update UI when a rule matches
    debug.log('Rule matched:', data.rule.name, 'on transaction:', data.transaction.description)
  },

  refresh() {
    this.loadRulesList()
    this.updateSummary()
  }
}

// Initialize when module is imported
export function initRulesUI() {
  rulesUI.init()
}