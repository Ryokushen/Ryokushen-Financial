// js/modules/ruleTemplatesUI.js
import { debug } from './debug.js'
import { escapeHtml } from './utils.js'
import { openModal, closeModal, showError, announceToScreenReader } from './ui.js'
import { smartRules } from './smartRules.js'
import { getTemplateCategories, getTemplatesByCategory, createRuleFromTemplate } from './ruleTemplates.js'

export const ruleTemplatesUI = {
  initialized: false,
  selectedCategory: null,
  selectedTemplate: null,

  init() {
    if (this.initialized) return
    
    debug.log('RuleTemplatesUI: Initializing')
    this.setupEventListeners()
    this.initialized = true
    
    return this
  },

  setupEventListeners() {
    // Template button in rules UI
    const templateBtn = document.getElementById('use-template-btn')
    if (templateBtn) {
      templateBtn.addEventListener('click', () => this.openTemplateModal())
    }
    
    // Template modal events
    const modal = document.getElementById('rule-template-modal')
    if (modal) {
      modal.querySelector('.modal-close')?.addEventListener('click', () => {
        this.closeTemplateModal()
      })
      
      const cancelBtn = modal.querySelector('#cancel-template')
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.closeTemplateModal())
      }
      
      const useBtn = modal.querySelector('#use-template')
      if (useBtn) {
        useBtn.addEventListener('click', () => this.useSelectedTemplate())
      }
    }
  },

  openTemplateModal() {
    debug.log('RuleTemplatesUI: Opening template modal')
    
    const modal = document.getElementById('rule-template-modal')
    if (!modal) {
      debug.error('RuleTemplatesUI: Template modal not found')
      return
    }
    
    // Reset state
    this.selectedCategory = null
    this.selectedTemplate = null
    
    // Render categories
    this.renderCategories()
    
    // Clear template list
    const templateList = document.getElementById('template-list')
    if (templateList) {
      templateList.innerHTML = '<p class="template-hint">Select a category to view templates</p>'
    }
    
    // Disable use button
    const useBtn = document.getElementById('use-template')
    if (useBtn) {
      useBtn.disabled = true
    }
    
    // Show modal
    modal.style.display = 'block'
    setTimeout(() => modal.classList.add('modal--open'), 10)
  },

  closeTemplateModal() {
    const modal = document.getElementById('rule-template-modal')
    if (modal) {
      modal.classList.remove('modal--open')
      setTimeout(() => {
        modal.style.display = 'none'
      }, 300)
    }
  },

  renderCategories() {
    const container = document.getElementById('template-categories')
    if (!container) return
    
    const categories = getTemplateCategories()
    
    container.innerHTML = categories.map(cat => `
      <div class="template-category ${this.selectedCategory === cat.id ? 'selected' : ''}" 
           data-category="${cat.id}">
        <h4>${escapeHtml(cat.name)}</h4>
        <p>${escapeHtml(cat.description)}</p>
        <span class="template-count">${cat.templateCount} templates</span>
      </div>
    `).join('')
    
    // Add click handlers
    container.querySelectorAll('.template-category').forEach(el => {
      el.addEventListener('click', () => {
        const categoryId = el.dataset.category
        this.selectCategory(categoryId)
      })
    })
  },

  selectCategory(categoryId) {
    debug.log('RuleTemplatesUI: Selected category', categoryId)
    
    this.selectedCategory = categoryId
    this.selectedTemplate = null
    
    // Update UI
    document.querySelectorAll('.template-category').forEach(el => {
      el.classList.toggle('selected', el.dataset.category === categoryId)
    })
    
    // Render templates for category
    this.renderTemplates(categoryId)
    
    // Disable use button since no template is selected
    const useBtn = document.getElementById('use-template')
    if (useBtn) {
      useBtn.disabled = true
    }
  },

  renderTemplates(categoryId) {
    const container = document.getElementById('template-list')
    if (!container) return
    
    const templates = getTemplatesByCategory(categoryId)
    
    if (templates.length === 0) {
      container.innerHTML = '<p class="template-hint">No templates available for this category</p>'
      return
    }
    
    container.innerHTML = templates.map(template => `
      <div class="template-item ${this.selectedTemplate === template.id ? 'selected' : ''}" 
           data-template="${template.id}">
        <div class="template-header">
          <h5>${escapeHtml(template.name)}</h5>
          <span class="template-description">${escapeHtml(template.description)}</span>
        </div>
        <div class="template-preview">
          ${this.renderRulePreview(template.rule)}
        </div>
      </div>
    `).join('')
    
    // Add click handlers
    container.querySelectorAll('.template-item').forEach(el => {
      el.addEventListener('click', () => {
        const templateId = el.dataset.template
        this.selectTemplate(templateId)
      })
    })
  },

  renderRulePreview(rule) {
    return `
      <div class="rule-preview">
        <div class="preview-conditions">
          <span class="preview-label">If:</span>
          ${this.renderConditionsPreview(rule.conditions)}
        </div>
        <div class="preview-actions">
          <span class="preview-label">Then:</span>
          ${rule.actions.map(action => this.renderActionPreview(action)).join(', ')}
        </div>
      </div>
    `
  },

  renderConditionsPreview(conditions, depth = 0) {
    if (!conditions) return ''
    
    // Single condition
    if (conditions.field) {
      return this.formatConditionPreview(conditions)
    }
    
    // Condition group
    if (conditions.items) {
      const items = conditions.items.map((item, index) => {
        const itemStr = this.renderConditionsPreview(item, depth + 1)
        return index > 0 ? ` ${conditions.type} ${itemStr}` : itemStr
      }).join('')
      
      // Add parentheses for nested groups
      return depth > 0 && conditions.items.length > 1 ? `(${items})` : items
    }
    
    return ''
  },

  formatConditionPreview(condition) {
    const fieldLabels = {
      description: 'Description',
      amount: 'Amount',
      category: 'Category',
      type: 'Type'
    }
    
    const operatorLabels = {
      contains: 'contains',
      equals: '=',
      greater_than: '>',
      less_than: '<',
      in_list: 'in'
    }
    
    const field = fieldLabels[condition.field] || condition.field
    const op = operatorLabels[condition.operator] || condition.operator
    
    return `${field} ${op} "${escapeHtml(condition.value)}"`
  },

  renderActionPreview(action) {
    const actionLabels = {
      set_category: 'Set category to',
      add_tag: 'Add tag',
      add_note: 'Add note'
    }
    
    const label = actionLabels[action.type] || action.type
    return `${label} "${escapeHtml(action.value)}"`
  },

  selectTemplate(templateId) {
    debug.log('RuleTemplatesUI: Selected template', templateId)
    
    this.selectedTemplate = templateId
    
    // Update UI
    document.querySelectorAll('.template-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.template === templateId)
    })
    
    // Enable use button
    const useBtn = document.getElementById('use-template')
    if (useBtn) {
      useBtn.disabled = false
    }
  },

  async useSelectedTemplate() {
    if (!this.selectedCategory || !this.selectedTemplate) {
      showError('Please select a template')
      return
    }
    
    debug.log('RuleTemplatesUI: Using template', this.selectedCategory, this.selectedTemplate)
    
    try {
      // Create rule from template
      const rule = createRuleFromTemplate(this.selectedCategory, this.selectedTemplate)
      
      if (!rule) {
        showError('Failed to create rule from template')
        return
      }
      
      // Option 1: Directly create the rule (recommended for complex conditions)
      const confirmCreate = confirm(`Create rule "${rule.name}"?\n\nThis will add the rule to your Smart Rules list.`)
      
      if (confirmCreate) {
        // Directly create the rule using smartRules
        const result = await smartRules.createRule(rule)
        
        if (result.error) {
          showError('Failed to create rule: ' + result.error.message)
          return
        }
        
        // Close template modal
        this.closeTemplateModal()
        
        // Refresh the rules list
        const { rulesUI } = await import('./rulesUI.js')
        if (rulesUI && rulesUI.loadRulesList) {
          await rulesUI.loadRulesList()
        }
        
        announceToScreenReader('Rule created successfully from template')
      }
    } catch (error) {
      debug.error('RuleTemplatesUI: Error using template', error)
      showError('Failed to use template')
    }
  },

  populateRuleForm(rule) {
    // Populate basic fields
    document.getElementById('rule-name').value = rule.name
    document.getElementById('rule-description').value = rule.description || ''
    document.getElementById('rule-enabled').checked = rule.enabled
    document.getElementById('rule-priority').value = rule.priority || 0
    
    // For now, we'll store the complex conditions as JSON
    // In a full implementation, we'd have a visual condition builder
    const conditionsField = document.getElementById('rule-conditions-json')
    if (conditionsField) {
      conditionsField.value = JSON.stringify(rule.conditions, null, 2)
    }
    
    const actionsField = document.getElementById('rule-actions-json')
    if (actionsField) {
      actionsField.value = JSON.stringify(rule.actions, null, 2)
    }
    
    // If the rule modal isn't open, open it
    const ruleModal = document.getElementById('rule-modal')
    if (ruleModal && ruleModal.style.display === 'none') {
      openModal('rule-modal')
    }
  }
}