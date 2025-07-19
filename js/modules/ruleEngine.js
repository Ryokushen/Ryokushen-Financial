// js/modules/ruleEngine.js
import { debug } from './debug.js'
import database from '../database.js'
import { eventManager } from './eventManager.js'

class RuleEngine {
  constructor() {
    this.operators = {
      // String operators
      contains: (value, target) => {
        if (typeof value !== 'string' || typeof target !== 'string') return false
        return value.toLowerCase().includes(target.toLowerCase())
      },
      
      equals: (value, target) => {
        return value === target
      },
      
      equals_ignore_case: (value, target) => {
        if (typeof value !== 'string' || typeof target !== 'string') return false
        return value.toLowerCase() === target.toLowerCase()
      },
      
      starts_with: (value, target) => {
        if (typeof value !== 'string' || typeof target !== 'string') return false
        return value.toLowerCase().startsWith(target.toLowerCase())
      },
      
      ends_with: (value, target) => {
        if (typeof value !== 'string' || typeof target !== 'string') return false
        return value.toLowerCase().endsWith(target.toLowerCase())
      },
      
      // Numeric operators
      greater_than: (value, target) => {
        return parseFloat(value) > parseFloat(target)
      },
      
      less_than: (value, target) => {
        return parseFloat(value) < parseFloat(target)
      },
      
      greater_than_or_equal: (value, target) => {
        return parseFloat(value) >= parseFloat(target)
      },
      
      less_than_or_equal: (value, target) => {
        return parseFloat(value) <= parseFloat(target)
      },
      
      between: (value, target) => {
        const num = parseFloat(value)
        const [min, max] = target.split(',').map(v => parseFloat(v.trim()))
        return num >= min && num <= max
      },
      
      // Special operators
      regex: (value, pattern) => {
        try {
          const regex = new RegExp(pattern, 'i')
          return regex.test(value)
        } catch (error) {
          debug.error('RuleEngine: Invalid regex pattern', pattern, error)
          return false
        }
      },
      
      in_list: (value, list) => {
        const items = list.split(',').map(item => item.trim().toLowerCase())
        return items.includes(value.toLowerCase())
      }
    }
  }

  // Process a transaction through all rules
  async process(transaction, rules) {
    for (const rule of rules) {
      if (!rule.enabled) continue
      
      const matches = this.evaluateConditions(transaction, rule.conditions)
      
      if (matches) {
        // Apply actions
        const results = await this.applyActions(transaction, rule.actions)
        
        return {
          matched: true,
          rule: rule,
          ruleId: rule.id,
          actions: results
        }
      }
    }
    
    return { matched: false }
  }

  // Find all rules that match a transaction (for preview/testing)
  findMatchingRules(transaction, rules) {
    const matches = []
    
    for (const rule of rules) {
      if (this.evaluateConditions(transaction, rule.conditions)) {
        matches.push(rule)
      }
    }
    
    return matches
  }

  // Evaluate rule conditions
  evaluateConditions(transaction, conditions) {
    if (!conditions || !conditions.items || conditions.items.length === 0) {
      return false
    }
    
    const type = conditions.type || 'AND'
    const results = conditions.items.map(condition => 
      this.evaluateCondition(transaction, condition)
    )
    
    if (type === 'AND') {
      return results.every(result => result === true)
    } else if (type === 'OR') {
      return results.some(result => result === true)
    }
    
    return false
  }

  // Evaluate a single condition
  evaluateCondition(transaction, condition) {
    const { field, operator, value, case_sensitive } = condition
    
    // Get the field value from the transaction
    let fieldValue = this.getFieldValue(transaction, field)
    
    if (fieldValue === undefined || fieldValue === null) {
      return false
    }
    
    // Handle case sensitivity for string comparisons
    if (!case_sensitive && typeof fieldValue === 'string' && operator !== 'regex') {
      fieldValue = fieldValue.toLowerCase()
    }
    
    // Get the operator function
    const operatorFn = this.operators[operator]
    if (!operatorFn) {
      debug.error('RuleEngine: Unknown operator', operator)
      return false
    }
    
    // Apply the operator
    return operatorFn(fieldValue, value)
  }

  // Get field value from transaction
  getFieldValue(transaction, field) {
    switch (field) {
      case 'description':
        return transaction.description || ''
      case 'amount':
        return Math.abs(transaction.amount) // Use absolute value for comparisons
      case 'category':
        return transaction.category || ''
      case 'account':
        return transaction.account_id
      case 'account_name':
        // Would need to be passed in or looked up
        return transaction.account_name || ''
      case 'type':
        return transaction.amount >= 0 ? 'income' : 'expense'
      case 'date':
        return transaction.date
      case 'day_of_week':
        return new Date(transaction.date).getDay()
      case 'month':
        return new Date(transaction.date).getMonth() + 1
      default:
        return transaction[field]
    }
  }

  // Apply rule actions to a transaction
  async applyActions(transaction, actions) {
    const results = []
    
    for (const action of actions) {
      try {
        const result = await this.applyAction(transaction, action)
        results.push(result)
      } catch (error) {
        debug.error('RuleEngine: Error applying action', action, error)
        results.push({ 
          success: false, 
          action: action.type, 
          error: error.message 
        })
      }
    }
    
    return results
  }

  // Apply a single action
  async applyAction(transaction, action) {
    switch (action.type) {
      case 'set_category':
        // Update the transaction category
        const { error } = await database
          .from('transactions')
          .update({ 
            category: action.value,
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id)
        
        if (error) throw error
        
        return { 
          success: true, 
          action: 'set_category', 
          value: action.value 
        }
      
      case 'add_tag':
        // Add a tag to the transaction (would need tags field in DB)
        // For now, we'll add it to the description
        const newDescription = transaction.description 
          ? `${transaction.description} #${action.value}`
          : `#${action.value}`
        
        const { error: tagError } = await database
          .from('transactions')
          .update({ 
            description: newDescription,
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id)
        
        if (tagError) throw tagError
        
        return { 
          success: true, 
          action: 'add_tag', 
          value: action.value 
        }
      
      case 'add_note':
        // Add note to transaction (using description for now)
        const noteDescription = transaction.description 
          ? `${transaction.description} | ${action.value}`
          : action.value
        
        const { error: noteError } = await database
          .from('transactions')
          .update({ 
            description: noteDescription,
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id)
        
        if (noteError) throw noteError
        
        return { 
          success: true, 
          action: 'add_note', 
          value: action.value 
        }
      
      case 'alert':
        // Emit an event for the alert (UI can handle displaying it)
        const alertData = {
          transaction,
          message: action.value,
          timestamp: new Date().toISOString()
        }
        
        // Store alert in a queue or emit event
        eventManager.emit('rule:alert', alertData)
        
        return { 
          success: true, 
          action: 'alert', 
          value: action.value 
        }
      
      default:
        return { 
          success: false, 
          action: action.type, 
          error: 'Unknown action type' 
        }
    }
  }
}

export const ruleEngine = new RuleEngine()