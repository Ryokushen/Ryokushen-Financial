// js/modules/smartRules.js
import database from '../database.js'
import { eventManager } from './eventManager.js'
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
      eventManager.on('transaction:added', (transaction) => this.processTransaction(transaction))
      eventManager.on('transaction:updated', (transaction) => this.processTransaction(transaction))
      
      debug.log('SmartRules: Initialized successfully')
    } catch (error) {
      debug.error('SmartRules: Initialization failed', error)
    }
    
    return this
  }

  async loadRules() {
    try {
      const { data, error } = await database
        .from('smart_rules')
        .select('*')
        .eq('enabled', true)
        .order('priority', { ascending: false })
      
      if (error) throw error
      
      this.rules = data || []
      this.rulesLoaded = true
      this.cache.clear() // Clear cache when rules are reloaded
      
      debug.log(`SmartRules: Loaded ${this.rules.length} active rules`)
      
      eventManager.emit('rules:loaded', this.rules)
    } catch (error) {
      debug.error('SmartRules: Error loading rules', error)
      this.rules = []
    }
  }

  async createRule(ruleData) {
    try {
      const { data, error } = await database
        .from('smart_rules')
        .insert({
          name: ruleData.name,
          description: ruleData.description || '',
          enabled: ruleData.enabled !== false,
          priority: ruleData.priority || 0,
          conditions: ruleData.conditions,
          actions: ruleData.actions,
          stats: { matches: 0, last_matched: null }
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Reload rules to maintain proper priority order
      await this.loadRules()
      
      eventManager.emit('rule:created', data)
      return { data, error: null }
    } catch (error) {
      debug.error('SmartRules: Error creating rule', error)
      return { data: null, error }
    }
  }

  async updateRule(ruleId, updates) {
    try {
      const { data, error } = await database
        .from('smart_rules')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', ruleId)
        .select()
        .single()
      
      if (error) throw error
      
      // Reload rules to maintain proper priority order
      await this.loadRules()
      
      eventManager.emit('rule:updated', data)
      return { data, error: null }
    } catch (error) {
      debug.error('SmartRules: Error updating rule', error)
      return { data: null, error }
    }
  }

  async deleteRule(ruleId) {
    try {
      const { error } = await database
        .from('smart_rules')
        .delete()
        .eq('id', ruleId)
      
      if (error) throw error
      
      // Remove from local array
      this.rules = this.rules.filter(rule => rule.id !== ruleId)
      
      eventManager.emit('rule:deleted', ruleId)
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
      const { data, error } = await database
        .from('smart_rules')
        .select('*')
        .order('priority', { ascending: false })
      
      if (error) throw error
      
      return { data: data || [], error: null }
    } catch (error) {
      debug.error('SmartRules: Error getting all rules', error)
      return { data: [], error }
    }
  }

  async getRuleStatistics() {
    try {
      const { data, error } = await database
        .rpc('get_my_rule_statistics')
      
      if (error) throw error
      
      return { data: data?.[0] || {}, error: null }
    } catch (error) {
      debug.error('SmartRules: Error getting statistics', error)
      return { data: {}, error }
    }
  }

  async processTransaction(transaction) {
    if (!this.rulesLoaded || this.rules.length === 0) {
      return null
    }

    // Import rule engine for processing
    const { ruleEngine } = await import('./ruleEngine.js')
    
    // Process transaction through rules
    const result = await ruleEngine.process(transaction, this.rules)
    
    if (result.matched) {
      // Update rule statistics
      await this.updateRuleStats(result.ruleId)
      
      eventManager.emit('rule:matched', {
        transaction,
        rule: result.rule,
        actions: result.actions
      })
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
      await database
        .from('smart_rules')
        .update({ stats: newStats })
        .eq('id', ruleId)
      
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
      let query = database.from('transactions').select('*')
      
      if (transactionIds && transactionIds.length > 0) {
        query = query.in('id', transactionIds)
      }
      
      const { data: transactions, error } = await query
      
      if (error) throw error
      
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