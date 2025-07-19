// js/modules/smartRules.js
import database from '../database.js'
import { debug } from './debug.js'

class SmartRules {
  constructor() {
    this.rules = []
    this.rulesLoaded = false
    this.cache = new Map()
  }

  async init() {
    debug.log('SmartRules: Initializing')
    
    try {
      await this.loadRules()
      
      // Listen for events that might need rule re-evaluation
      window.addEventListener('transaction:added', (event) => {
        if (event.detail) this.processTransaction(event.detail)
      })
      window.addEventListener('transaction:updated', (event) => {
        if (event.detail) this.processTransaction(event.detail)
      })
      
      debug.log('SmartRules: Initialized successfully')
    } catch (error) {
      debug.error('SmartRules: Initialization failed', error)
    }
    
    return this
  }

  async loadRules() {
    try {
      const rules = await database.getSmartRules(true) // true = enabled only
      
      this.rules = rules || []
      this.rulesLoaded = true
      this.cache.clear() // Clear cache when rules are reloaded
      
      debug.log(`SmartRules: Loaded ${this.rules.length} active rules`)
      
      window.dispatchEvent(new CustomEvent('rules:loaded', { detail: this.rules }))
    } catch (error) {
      debug.error('SmartRules: Error loading rules', error)
      this.rules = []
    }
  }

  async createRule(ruleData) {
    try {
      const ruleToCreate = {
        name: ruleData.name,
        description: ruleData.description || '',
        enabled: ruleData.enabled !== false,
        priority: ruleData.priority || 0,
        conditions: ruleData.conditions,
        actions: ruleData.actions,
        stats: { matches: 0, last_matched: null }
      }
      
      const data = await database.createSmartRule(ruleToCreate)
      
      // Reload rules to maintain proper priority order
      await this.loadRules()
      
      window.dispatchEvent(new CustomEvent('rule:created', { detail: data }))
      return { data, error: null }
    } catch (error) {
      debug.error('SmartRules: Error creating rule', error)
      return { data: null, error }
    }
  }

  async updateRule(ruleId, updates) {
    try {
      const updatesWithTimestamp = {
        ...updates,
        updated_at: new Date().toISOString()
      }
      
      const data = await database.updateSmartRule(ruleId, updatesWithTimestamp)
      
      // Reload rules to maintain proper priority order
      await this.loadRules()
      
      window.dispatchEvent(new CustomEvent('rule:updated', { detail: data }))
      return { data, error: null }
    } catch (error) {
      debug.error('SmartRules: Error updating rule', error)
      return { data: null, error }
    }
  }

  async deleteRule(ruleId) {
    try {
      await database.deleteSmartRule(ruleId)
      
      // Remove from local array
      this.rules = this.rules.filter(rule => rule.id !== ruleId)
      
      window.dispatchEvent(new CustomEvent('rule:deleted', { detail: ruleId }))
      return { error: null }
    } catch (error) {
      debug.error('SmartRules: Error deleting rule', error)
      return { error }
    }
  }

  async toggleRule(ruleId, enabled) {
    return this.updateRule(ruleId, { enabled })
  }

  async getAllRules() {
    try {
      const data = await database.getSmartRules() // null = get all rules (enabled and disabled)
      
      return { data: data || [], error: null }
    } catch (error) {
      debug.error('SmartRules: Error getting all rules', error)
      return { data: [], error }
    }
  }

  async getRuleStatistics() {
    try {
      const allRules = await database.getSmartRules()
      
      const stats = {
        active_rules: allRules.filter(rule => rule.enabled).length,
        total_matches: allRules.reduce((sum, rule) => sum + (rule.stats?.matches || 0), 0)
      }
      
      return { data: stats, error: null }
    } catch (error) {
      debug.error('SmartRules: Error getting statistics', error)
      return { data: { active_rules: 0, total_matches: 0 }, error }
    }
  }

  async processTransaction(transaction) {
    if (!this.rulesLoaded || this.rules.length === 0) {
      return null
    }
    
    // Skip processing if transaction already has a category (unless it's Uncategorized)
    if (transaction.category && transaction.category !== 'Uncategorized') {
      debug.log('SmartRules: Skipping categorized transaction', transaction.id)
      return null
    }

    // Import rule engine for processing
    const { ruleEngine } = await import('./ruleEngine.js')
    
    // Process transaction through rules
    const result = await ruleEngine.process(transaction, this.rules)
    
    if (result.matched) {
      // Update rule statistics
      await this.updateRuleStats(result.ruleId)
      
      window.dispatchEvent(new CustomEvent('rule:matched', { detail: {
        transaction,
        rule: result.rule,
        actions: result.actions
      }}))
    }
    
    return result
  }

  async updateRuleStats(ruleId) {
    try {
      const rule = this.rules.find(r => r.id === ruleId)
      if (!rule) return
      
      const newStats = {
        matches: (rule.stats?.matches || 0) + 1,
        last_matched: new Date().toISOString()
      }
      
      // Update in database
      await database.updateSmartRule(ruleId, { stats: newStats })
      
      // Update in local cache
      if (rule.stats) {
        rule.stats = newStats
      }
    } catch (error) {
      debug.error('SmartRules: Error updating rule stats', error)
    }
  }

  async applyRulesToExistingTransactions(transactionIds = null) {
    try {
      // Get transactions using the database method
      let transactions = await database.getTransactions()
      
      // Filter by specific transaction IDs if provided
      if (transactionIds && transactionIds.length > 0) {
        transactions = transactions.filter(t => transactionIds.includes(t.id))
      }
      
      let processed = 0
      let matched = 0
      
      for (const transaction of transactions) {
        const result = await this.processTransaction(transaction)
        processed++
        if (result?.matched) {
          matched++
        }
      }
      
      return { 
        processed, 
        matched, 
        error: null 
      }
    } catch (error) {
      debug.error('SmartRules: Error applying rules to existing transactions', error)
      return { 
        processed: 0, 
        matched: 0, 
        error 
      }
    }
  }

  // Get rules that would match a specific transaction (for testing/preview)
  async previewRules(transaction) {
    if (!this.rulesLoaded) {
      await this.loadRules()
    }
    
    const { ruleEngine } = await import('./ruleEngine.js')
    return ruleEngine.findMatchingRules(transaction, this.rules)
  }
}

export const smartRules = new SmartRules()