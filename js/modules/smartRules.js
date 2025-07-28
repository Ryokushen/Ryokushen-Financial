// js/modules/smartRules.js
import database from '../database.js';
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';

class SmartRules {
  constructor() {
    this.rules = [];
    this.rulesLoaded = false;
    this.cache = new Map();
    this.config = {
      processAllNewTransactions: true, // Process all new transactions regardless of initial category
      skipCategorized: true, // Skip already categorized transactions (except Uncategorized)
    };
  }

  async init() {
    debug.log('SmartRules: Initializing');
    console.log('🤖 Smart Rules: Starting initialization...'); // Console log for visibility

    try {
      await this.loadRules();

      // Listen for events that might need rule re-evaluation
      eventManager.addEventListener(window, 'transaction:added', async event => {
        debug.log('SmartRules: Received transaction:added event', event.detail);
        console.log('🤖 Smart Rules: New transaction event received!', event.detail);
        
        if (event.detail && event.detail.transaction) {
          // For new transactions, check config to determine if we should force processing
          const isNewTransaction = true; // transaction:added always indicates a new transaction
          const forceProcess = isNewTransaction && this.config.processAllNewTransactions;
          
          console.log(`🤖 Smart Rules: Processing new transaction:`, {
            description: event.detail.transaction.description,
            category: event.detail.transaction.category || 'EMPTY',
            forceProcess,
            rulesCount: this.rules.length
          });
          
          debug.log('SmartRules: Processing new transaction', {
            transactionId: event.detail.transaction.id,
            category: event.detail.transaction.category,
            description: event.detail.transaction.description,
            forceProcess,
            isNewTransaction
          });
          
          await this.processTransaction(event.detail.transaction, forceProcess, isNewTransaction);
        } else {
          console.error(
            'SmartRules: Invalid event detail structure for transaction:added',
            event.detail
          );
        }
      });
      eventManager.addEventListener(window, 'transaction:updated', async event => {
        debug.log('SmartRules: Received transaction:updated event', event.detail);
        if (event.detail && event.detail.transaction) {
          await this.processTransaction(event.detail.transaction);
        } else {
          console.error(
            'SmartRules: Invalid event detail structure for transaction:updated',
            event.detail
          );
        }
      });

      // Listen for batch events from imports and bulk operations
      eventManager.addEventListener(window, 'transaction:added:batch', async event => {
        debug.log('SmartRules: Received transaction:added:batch event', event.detail);
        if (event.detail && Array.isArray(event.detail)) {
          let processed = 0;
          const isNewTransaction = true; // Batch adds are new transactions
          const forceProcess = isNewTransaction && this.config.processAllNewTransactions;

          for (const item of event.detail) {
            if (item.transaction) {
              await this.processTransaction(item.transaction, forceProcess, isNewTransaction);
              processed++;
            }
          }
          debug.log(`SmartRules: Processed ${processed} transactions from batch`);
        }
      });

      eventManager.addEventListener(window, 'transactions:batchAdded', async event => {
        debug.log('SmartRules: Received transactions:batchAdded event', event.detail);
        if (event.detail && event.detail.transactions) {
          let processed = 0;
          const isNewTransaction = true; // Batch adds are new transactions
          const forceProcess = isNewTransaction && this.config.processAllNewTransactions;

          for (const transaction of event.detail.transactions) {
            await this.processTransaction(transaction, forceProcess, isNewTransaction);
            processed++;
          }
          debug.log(`SmartRules: Processed ${processed} transactions from batch`);

          // Dispatch completion event for UI feedback
          window.dispatchEvent(
            new CustomEvent('smartrules:batchProcessed', {
              detail: { processed, total: event.detail.transactions.length },
            })
          );
        }
      });

      eventManager.addEventListener(window, 'transaction:updated:batch', async event => {
        debug.log('SmartRules: Received transaction:updated:batch event', event.detail);
        if (event.detail && Array.isArray(event.detail)) {
          let processed = 0;
          for (const item of event.detail) {
            if (item.transaction) {
              await this.processTransaction(item.transaction);
              processed++;
            }
          }
          debug.log(`SmartRules: Processed ${processed} updated transactions from batch`);
        }
      });

      // Listen for import completion to process uncategorized transactions
      eventManager.addEventListener(window, 'transactions:imported', async event => {
        debug.log('SmartRules: Received transactions:imported event', event.detail);

        let transactionIds = [];

        // Handle different event payload structures
        if (event.detail) {
          if (event.detail.transactionIds) {
            // Direct transaction IDs array
            transactionIds = event.detail.transactionIds;
          } else if (event.detail.successful && Array.isArray(event.detail.successful)) {
            // Extract IDs from successful imports array
            transactionIds = event.detail.successful
              .map(item => item.transaction?.id)
              .filter(id => id !== undefined);
          }
        }

        if (transactionIds.length > 0) {
          debug.log(`SmartRules: Processing ${transactionIds.length} imported transactions`);
          const result = await this.applyRulesToExistingTransactions(transactionIds, false);
          debug.log('SmartRules: Import processing result:', result);

          // Dispatch completion event
          window.dispatchEvent(
            new CustomEvent('smartrules:importProcessed', {
              detail: result,
            })
          );
        } else {
          debug.warn('SmartRules: No transaction IDs found in import event');
        }
      });

      debug.log('SmartRules: Initialized successfully');
      console.log(`🤖 Smart Rules: Initialization complete! ${this.rules.length} rules loaded.`);
    } catch (error) {
      debug.error('SmartRules: Initialization failed', error);
      console.error('🤖 Smart Rules: Initialization FAILED!', error);
    }

    return this;
  }

  async loadRules() {
    try {
      const rules = await database.getSmartRules(true); // true = enabled only

      this.rules = rules || [];
      this.rulesLoaded = true;
      this.cache.clear(); // Clear cache when rules are reloaded

      debug.log(`SmartRules: Loaded ${this.rules.length} active rules`);
      
      // Log details about loaded rules for debugging
      if (this.rules.length > 0) {
        this.rules.forEach(rule => {
          debug.log(`SmartRules: Rule "${rule.name}" - enabled: ${rule.enabled}, priority: ${rule.priority}`);
        });
      } else {
        debug.warn('SmartRules: No active rules found! Rules will not be applied automatically.');
      }

      window.dispatchEvent(new CustomEvent('rules:loaded', { detail: this.rules }));
    } catch (error) {
      debug.error('SmartRules: Error loading rules', error);
      this.rules = [];
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
        stats: { matches: 0, last_matched: null },
      };

      const data = await database.createSmartRule(ruleToCreate);

      // Reload rules to maintain proper priority order
      await this.loadRules();

      window.dispatchEvent(new CustomEvent('rule:created', { detail: data }));
      return { data, error: null };
    } catch (error) {
      debug.error('SmartRules: Error creating rule', error);
      return { data: null, error };
    }
  }

  async updateRule(ruleId, updates) {
    try {
      const updatesWithTimestamp = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const data = await database.updateSmartRule(ruleId, updatesWithTimestamp);

      // Reload rules to maintain proper priority order
      await this.loadRules();

      window.dispatchEvent(new CustomEvent('rule:updated', { detail: data }));
      return { data, error: null };
    } catch (error) {
      debug.error('SmartRules: Error updating rule', error);
      return { data: null, error };
    }
  }

  async deleteRule(ruleId) {
    try {
      await database.deleteSmartRule(ruleId);

      // Remove from local array
      this.rules = this.rules.filter(rule => rule.id !== ruleId);

      window.dispatchEvent(new CustomEvent('rule:deleted', { detail: ruleId }));
      return { error: null };
    } catch (error) {
      debug.error('SmartRules: Error deleting rule', error);
      return { error };
    }
  }

  async toggleRule(ruleId, enabled) {
    return this.updateRule(ruleId, { enabled });
  }

  /**
   * Update Smart Rules configuration
   * @param {Object} config - Configuration options
   * @returns {Object} Updated configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    debug.log('SmartRules: Configuration updated', this.config);
    return this.config;
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Create a simple test rule for debugging
   * @returns {Promise<Object>} Result of rule creation
   */
  async createTestRule() {
    console.log('🤖 Smart Rules: Creating test rule for debugging...');
    
    const testRule = {
      name: 'Test Grocery Rule',
      description: 'Categorize transactions with "grocery" in description as Groceries',
      enabled: true,
      priority: 100,
      conditions: {
        field: 'description',
        operator: 'contains',
        value: 'grocery'
      },
      actions: [{
        type: 'set_category',
        value: 'Groceries'
      }]
    };
    
    const result = await this.createRule(testRule);
    
    if (result.error) {
      console.error('🤖 Smart Rules: Failed to create test rule:', result.error);
    } else {
      console.log('🤖 Smart Rules: Test rule created successfully!');
      await this.loadRules(); // Reload rules to include the new one
    }
    
    return result;
  }

  /**
   * Debug helper to list all loaded rules
   */
  debugListRules() {
    console.log('🤖 Smart Rules: Current loaded rules:');
    if (this.rules.length === 0) {
      console.log('   ❌ No rules loaded!');
    } else {
      this.rules.forEach((rule, index) => {
        console.log(`   ${index + 1}. "${rule.name}" - ${rule.enabled ? '✅ Enabled' : '❌ Disabled'} - Priority: ${rule.priority}`);
      });
    }
    console.log(`   Total: ${this.rules.length} rules`);
  }

  async getAllRules() {
    try {
      const data = await database.getSmartRules(); // null = get all rules (enabled and disabled)

      return { data: data || [], error: null };
    } catch (error) {
      debug.error('SmartRules: Error getting all rules', error);
      return { data: [], error };
    }
  }

  async getRuleStatistics() {
    try {
      const allRules = await database.getSmartRules();
      const transactions = await database.getTransactions();

      // Import rule engine once for efficiency
      const { ruleEngine } = await import('./ruleEngine.js');

      // Calculate matches dynamically based on actual transactions
      let totalMatches = 0;

      // For each enabled rule, count how many transactions match
      for (const rule of allRules.filter(r => r.enabled)) {
        for (const transaction of transactions) {
          // Check if transaction matches this rule
          if (ruleEngine.evaluateConditions(transaction, rule.conditions)) {
            totalMatches++;
          }
        }
      }

      const stats = {
        active_rules: allRules.filter(rule => rule.enabled).length,
        total_matches: totalMatches,
      };

      debug.log(
        `SmartRules: Statistics calculated - ${stats.active_rules} active rules, ${totalMatches} total matches`
      );

      return { data: stats, error: null };
    } catch (error) {
      debug.error('SmartRules: Error getting statistics', error);
      return { data: { active_rules: 0, total_matches: 0 }, error };
    }
  }

  async processTransaction(transaction, forceProcess = false, isNewTransaction = false) {
    if (!this.rulesLoaded || this.rules.length === 0) {
      debug.log('SmartRules: No rules loaded, skipping processing');
      return null;
    }

    debug.log('SmartRules: Processing transaction', {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      isNewTransaction,
      forceProcess,
    });

    // Skip processing logic based on configuration and transaction state
    // Check if transaction has a meaningful category (not empty, not "Uncategorized")
    const hasCategory =
      transaction.category && 
      transaction.category.trim() !== '' && 
      transaction.category !== 'Uncategorized';
    
    // Enhanced logging to debug categorization issues
    debug.log('SmartRules: Category check', {
      category: transaction.category,
      hasCategory,
      isEmpty: !transaction.category || transaction.category.trim() === '',
      isUncategorized: transaction.category === 'Uncategorized',
      willProcess: !hasCategory || forceProcess || isNewTransaction,
    });
    
    const shouldSkip =
      !forceProcess &&
      this.config.skipCategorized &&
      hasCategory &&
      !isNewTransaction;

    if (shouldSkip) {
      debug.log(
        `SmartRules: Skipping already categorized transaction (${transaction.category}):`,
        transaction.description
      );
      return null;
    }
    
    // Log when processing transactions without categories
    if (!transaction.category || transaction.category.trim() === '' || transaction.category === 'Uncategorized') {
      debug.log(
        `SmartRules: Processing uncategorized transaction (category: "${transaction.category}"):`,
        transaction.description
      );
    }

    // Import rule engine for processing
    const { ruleEngine } = await import('./ruleEngine.js');

    // Process transaction through rules
    const startTime = Date.now();
    const result = await ruleEngine.process(transaction, this.rules);
    const processingTime = Date.now() - startTime;

    if (result.matched) {
      const newCategory = result.actions?.find(a => a.type === 'set_category')?.value;
      
      console.log(`🤖 Smart Rules: MATCH FOUND! Rule "${result.rule.name}" will categorize as "${newCategory}"`);
      
      debug.log('SmartRules: Rule match found', {
        ruleName: result.rule.name,
        ruleId: result.rule.id,
        transactionId: transaction.id,
        transactionDescription: transaction.description,
        originalCategory: transaction.category,
        newCategory: newCategory,
        processingTime: `${processingTime}ms`,
        isNewTransaction,
        forceProcess,
      });

      // No need to update statistics - they're calculated dynamically now

      window.dispatchEvent(
        new CustomEvent('rule:matched', {
          detail: {
            transaction,
            rule: result.rule,
            actions: result.actions,
          },
        })
      );
    } else {
      console.log(`🤖 Smart Rules: No match found for "${transaction.description}" (checked ${this.rules.length} rules)`);
      
      debug.log('SmartRules: No rules matched', {
        transactionId: transaction.id,
        transactionDescription: transaction.description,
        category: transaction.category,
        rulesChecked: this.rules.length,
        processingTime: `${processingTime}ms`,
        isNewTransaction,
        forceProcess,
      });
    }

    return result;
  }

  async applyRulesToExistingTransactions(transactionIds = null, forceProcess = false) {
    try {
      debug.log('SmartRules: Starting batch rule application', {
        forceProcess,
        specificIds: transactionIds ? transactionIds.length : 'all',
        timestamp: new Date().toISOString(),
      });

      // Get transactions using the database method
      let transactions = await database.getTransactions();

      // Filter by specific transaction IDs if provided
      if (transactionIds && transactionIds.length > 0) {
        transactions = transactions.filter(t => transactionIds.includes(t.id));
        debug.log(
          `SmartRules: Filtered to ${transactions.length} specific transactions from ${transactionIds.length} IDs`
        );
      }

      debug.log(`SmartRules: Found ${transactions.length} transactions to process`);

      let processed = 0;
      let matched = 0;
      let skipped = 0;

      for (const transaction of transactions) {
        // Check if we should skip this transaction
        if (!forceProcess && transaction.category && transaction.category !== 'Uncategorized') {
          skipped++;
          continue;
        }

        const result = await this.processTransaction(transaction, forceProcess);
        processed++;
        if (result?.matched) {
          matched++;
        }
      }

      const endTime = Date.now();

      debug.log('SmartRules: Batch processing complete', {
        totalTransactions: transactions.length,
        processed,
        matched,
        skipped,
        successRate: processed > 0 ? `${Math.round((matched / processed) * 100)}%` : '0%',
        averageTime:
          processed > 0
            ? `${Math.round((endTime - Date.now() + processed * 50) / processed)}ms`
            : 'N/A',
        timestamp: new Date().toISOString(),
      });

      return {
        processed,
        matched,
        skipped,
        error: null,
      };
    } catch (error) {
      debug.error('SmartRules: Error applying rules to existing transactions', error);
      console.error('SmartRules: Error applying rules to existing transactions', error);
      return {
        processed: 0,
        matched: 0,
        skipped: 0,
        error,
      };
    }
  }

  // Get rules that would match a specific transaction (for testing/preview)
  async previewRules(transaction) {
    if (!this.rulesLoaded) {
      await this.loadRules();
    }

    const { ruleEngine } = await import('./ruleEngine.js');
    return ruleEngine.findMatchingRules(transaction, this.rules);
  }
}

export const smartRules = new SmartRules();
