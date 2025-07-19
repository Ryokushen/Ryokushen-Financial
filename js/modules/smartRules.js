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
      window.addEventListener('transaction:added', async (event) => {
        debug.log('SmartRules: Received transaction:added event', event.detail)
        if (event.detail && event.detail.transaction) {
          await this.processTransaction(event.detail.transaction)
        } else {
          console.error('SmartRules: Invalid event detail structure for transaction:added', event.detail)
        }
      })
      window.addEventListener('transaction:updated', async (event) => {
        debug.log('SmartRules: Received transaction:updated event', event.detail)
        if (event.detail && event.detail.transaction) {
          await this.processTransaction(event.detail.transaction)
        } else {
          console.error('SmartRules: Invalid event detail structure for transaction:updated', event.detail)
        }
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
      const transactions = await database.getTransactions()
      
      // Import rule engine once for efficiency
      const { ruleEngine } = await import('./ruleEngine.js')
      
      // Calculate matches dynamically based on actual transactions
      let totalMatches = 0
      
      // For each enabled rule, count how many transactions match
      for (const rule of allRules.filter(r => r.enabled)) {
        for (const transaction of transactions) {
          // Check if transaction matches this rule
          if (ruleEngine.evaluateConditions(transaction, rule.conditions)) {
            totalMatches++
          }
        }
      }
      
      const stats = {
        active_rules: allRules.filter(rule => rule.enabled).length,
        total_matches: totalMatches
      }
      
      debug.log(`SmartRules: Statistics calculated - ${stats.active_rules} active rules, ${totalMatches} total matches`)
      
      return { data: stats, error: null }
    } catch (error) {
      debug.error('SmartRules: Error getting statistics', error)
      return { data: { active_rules: 0, total_matches: 0 }, error }
    }
  }

  async processTransaction(transaction, forceProcess = false) {
    if (!this.rulesLoaded || this.rules.length === 0) {
      debug.log('SmartRules: No rules loaded, skipping processing')
      return null
    }
    
    debug.log('SmartRules: Processing transaction', {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category
    })
    
    // Skip processing if transaction already has a category (unless it's Uncategorized or force processing)
    if (!forceProcess && transaction.category && transaction.category !== 'Uncategorized') {
      console.warn(`SmartRules: Skipping already categorized transaction (${transaction.category}):`, transaction.description)
      return null
    }

    // Import rule engine for processing
    const { ruleEngine } = await import('./ruleEngine.js')
    
    // Process transaction through rules
    const result = await ruleEngine.process(transaction, this.rules)
    
    if (result.matched) {
      console.log(`SmartRules: Rule "${result.rule.name}" matched for transaction:`, transaction.description)
      
      // No need to update statistics - they're calculated dynamically now
      
      window.dispatchEvent(new CustomEvent('rule:matched', { detail: {
        transaction,
        rule: result.rule,
        actions: result.actions
      }}))
    } else {
      debug.log('SmartRules: No rules matched for transaction', transaction.description)
    }
    
    return result
  }


  async applyRulesToExistingTransactions(transactionIds = null, forceProcess = false) {
    try {
      console.log(`SmartRules: Applying rules to existing transactions (forceProcess: ${forceProcess})`)
      
      // Get transactions using the database method
      let transactions = await database.getTransactions()
      
      // Filter by specific transaction IDs if provided
      if (transactionIds && transactionIds.length > 0) {
        transactions = transactions.filter(t => transactionIds.includes(t.id))
      }
      
      console.log(`SmartRules: Found ${transactions.length} transactions to process`)
      
      let processed = 0
      let matched = 0
      let skipped = 0
      
      for (const transaction of transactions) {
        // Check if we should skip this transaction
        if (!forceProcess && transaction.category && transaction.category !== 'Uncategorized') {
          skipped++
          continue
        }
        
        const result = await this.processTransaction(transaction, forceProcess)
        processed++
        if (result?.matched) {
          matched++
        }
      }
      
      console.log(`SmartRules: Processing complete - Processed: ${processed}, Matched: ${matched}, Skipped: ${skipped}`)
      
      return { 
        processed, 
        matched,
        skipped,
        error: null 
      }
    } catch (error) {
      debug.error('SmartRules: Error applying rules to existing transactions', error)
      console.error('SmartRules: Error applying rules to existing transactions', error)
      return { 
        processed: 0, 
        matched: 0,
        skipped: 0,
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