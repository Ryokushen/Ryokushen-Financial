// js/modules/transactionManager.js - Centralized Transaction Management System

import database from '../database.js';
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';
import { validateForm, ValidationSchemas, ValidationRules } from './validation.js';
import { safeParseFloat, formatCurrency } from './utils.js';
import { addMoney, subtractMoney } from './financialMath.js';
import { dataIndex } from './dataIndex.js';

/**
 * TransactionManager - Centralized system for managing all transaction operations
 *
 * Features:
 * - Centralized CRUD operations for transactions
 * - Atomic operations with rollback support
 * - Built-in validation and error handling
 * - Performance optimization through caching
 * - Event-driven architecture integration
 * - Batch operations support
 *
 * @class TransactionManager
 */
class TransactionManager {
  constructor() {
    // Transaction cache for performance
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Search result cache
    this.searchCache = new Map();
    this.searchCacheTimeout = 2 * 60 * 1000; // 2 minutes
    this.maxSearchCacheSize = 50;

    // Transaction state management
    this.pendingOperations = new Map();
    this.operationHistory = [];
    this.maxHistorySize = 50;

    // Performance tracking
    this.metrics = {
      operations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      rollbacks: 0,
    };

    // Batch operation settings
    this.batchSize = 50;
    this.batchDelay = 100; // ms between batch operations

    // Validation settings
    this.validationEnabled = true;
    this.strictMode = false; // When true, validation errors prevent save

    // Event batching
    this.eventQueue = [];
    this.eventBatchTimeout = null;
    this.eventBatchDelay = 50; // ms

    // Initialize state
    this.initialized = false;
    this.initTime = null;
  }

  /**
   * Initialize the TransactionManager
   * @returns {Promise<TransactionManager>}
   */
  async init() {
    try {
      debug.log('TransactionManager: Initializing...');

      // Setup event listeners for cache invalidation
      this.setupEventListeners();

      // Load initial transaction data into cache if needed
      // Note: We'll lazy-load as needed to avoid initial performance hit

      // Mark as initialized
      this.initialized = true;
      this.initTime = Date.now();

      debug.log('TransactionManager: Initialized successfully');
      return this;
    } catch (error) {
      debug.error('TransactionManager: Initialization failed', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for cache management
   */
  setupEventListeners() {
    // Listen for events that should invalidate cache
    eventManager.addEventListener(window, 'user:logout', () => {
      this.clearCache();
    });

    eventManager.addEventListener(window, 'account:updated', () => {
      // Invalidate transactions for updated account
      this.invalidateCacheByPattern('account:*');
    });

    eventManager.addEventListener(window, 'account:deleted', event => {
      if (event.detail?.accountId) {
        this.invalidateCacheByPattern(`account:${event.detail.accountId}:*`);
      }
    });
  }

  /**
   * Get transaction by ID
   * @param {number} id - Transaction ID
   * @returns {Promise<Object|null>}
   */
  async getTransaction(id) {
    const cacheKey = `transaction:${id}`;

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;

    try {
      // Fetch from database
      const transactions = await database.getTransactions();
      // Convert id to number for comparison since database IDs are numeric
      const numericId = parseInt(id, 10);
      const transaction = transactions.find(t => t.id === numericId || t.id === id);

      if (transaction) {
        this.setCache(cacheKey, transaction);
      }

      return transaction || null;
    } catch (error) {
      debug.error('TransactionManager: Failed to get transaction', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Get all transactions with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>}
   */
  async getTransactions(options = {}) {
    const { accountId, category, dateFrom, dateTo, cleared } = options;

    // Build cache key from options
    const cacheKey = this.buildCacheKey('transactions', options);

    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;

    try {
      // Fetch all transactions
      let transactions = await database.getTransactions();

      // Apply filters
      if (accountId !== undefined) {
        transactions = transactions.filter(
          t => t.account_id === accountId || t.debt_account_id === accountId
        );
      }

      if (category) {
        transactions = transactions.filter(t => t.category === category);
      }

      if (dateFrom) {
        transactions = transactions.filter(t => new Date(t.date) >= new Date(dateFrom));
      }

      if (dateTo) {
        transactions = transactions.filter(t => new Date(t.date) <= new Date(dateTo));
      }

      if (cleared !== undefined) {
        transactions = transactions.filter(t => t.cleared === cleared);
      }

      // Cache the filtered results
      this.setCache(cacheKey, transactions);

      return transactions;
    } catch (error) {
      debug.error('TransactionManager: Failed to get transactions', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Get all transactions without any filtering
   * @returns {Promise<Array>} All transactions
   */
  async getAllTransactions() {
    try {
      // Check cache first
      const cacheKey = 'all_transactions';
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }

      // Fetch from database
      this.metrics.cacheMisses++;
      const transactions = await database.getTransactions();

      // Cache the results
      this.setCache(cacheKey, transactions);

      return transactions;
    } catch (error) {
      debug.error('Failed to get all transactions', error);
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Validate transaction data
   * @param {Object} transactionData - Transaction data to validate
   * @returns {Object} Validation result
   */
  validateTransaction(transactionData) {
    if (!this.validationEnabled) {
      return { valid: true, errors: {} };
    }

    const { errors } = validateForm(transactionData, ValidationSchemas.transaction);

    // Additional custom validations
    const customErrors = {};

    // Validate amount
    if (isNaN(transactionData.amount) || transactionData.amount === 0) {
      customErrors.amount = 'Amount must be a non-zero number';
    }

    // Validate account selection
    if (!transactionData.account_id && !transactionData.debt_account_id) {
      customErrors.account = 'An account must be selected';
    }

    // Validate special categories
    if (transactionData.category === 'Transfer' || transactionData.category === 'Payment') {
      if (!transactionData.linkedTransactionId && !transactionData.skipLinkedValidation) {
        customErrors.category = `${transactionData.category} requires a linked transaction`;
      }
    }

    // Merge errors
    const allErrors = { ...errors, ...customErrors };
    const isValid = Object.keys(allErrors).length === 0;

    return {
      valid: isValid,
      errors: allErrors,
      hasErrors: !isValid,
    };
  }

  /**
   * Validate that account IDs exist in the database
   * @param {Object} transactionData - Transaction data with account IDs
   * @returns {Promise<Object>} Validation result with account existence checks
   */
  async validateAccountsExist(transactionData) {
    const errors = {};

    try {
      // Check cash account if specified
      if (transactionData.account_id) {
        try {
          const account = await database.getCashAccountById(transactionData.account_id);
          if (!account) {
            errors.account_id = 'Cash account not found';
          }
        } catch (error) {
          // If the error is specifically about not finding the account
          if (error.message && error.message.includes('getCashAccountById')) {
            errors.account_id = 'Invalid cash account ID';
          } else {
            // Re-throw unexpected errors
            throw error;
          }
        }
      }

      // Check debt account if specified
      if (transactionData.debt_account_id) {
        try {
          const debtAccount = await database.getDebtAccountById(transactionData.debt_account_id);
          if (!debtAccount) {
            errors.debt_account_id = 'Debt account not found';
          }
        } catch (error) {
          // If the error is specifically about not finding the account
          if (error.message && error.message.includes('getDebtAccountById')) {
            errors.debt_account_id = 'Invalid debt account ID';
          } else {
            // Re-throw unexpected errors
            throw error;
          }
        }
      }

      return {
        valid: Object.keys(errors).length === 0,
        errors,
        hasErrors: Object.keys(errors).length > 0,
      };
    } catch (error) {
      debug.error('TransactionManager: Error validating account existence', error);
      return {
        valid: false,
        errors: { general: 'Error validating accounts' },
        hasErrors: true,
      };
    }
  }

  /**
   * Prepare transaction data for saving
   * @param {Object} transactionData - Raw transaction data
   * @returns {Object} Prepared transaction data
   */
  prepareTransactionData(transactionData) {
    const prepared = { ...transactionData };

    // Ensure amount is a number
    prepared.amount = safeParseFloat(prepared.amount);

    // Handle credit card sign convention
    if (prepared.debt_account_id && !prepared.account_id) {
      // Credit card transaction
      if (prepared.category !== 'Payment' && prepared.category !== 'Transfer') {
        // Apply sign convention
        if (prepared.userAmount !== undefined) {
          // User amount provided (from UI)
          const userAmount = prepared.userAmount;
          if (userAmount > 0) {
            // Purchase: store as negative
            prepared.amount = -Math.abs(userAmount);
          } else if (userAmount < 0) {
            // Payment: store as positive
            prepared.amount = Math.abs(userAmount);
          }
          delete prepared.userAmount; // Remove UI-specific field
        }
      }
    }

    // Set defaults
    prepared.cleared = prepared.cleared || false;
    prepared.date = prepared.date || new Date().toISOString().split('T')[0];

    // Ensure a category is set - default to 'Uncategorized' if empty or missing
    if (!prepared.category || prepared.category.trim() === '') {
      prepared.category = 'Uncategorized';
    }

    return prepared;
  }

  /**
   * Cache management methods
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidateCache(key) {
    this.cache.delete(key);
  }

  invalidateCacheByPattern(pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clearCache() {
    this.cache.clear();
    this.searchCache.clear();
    debug.log('TransactionManager: Cache cleared');
  }

  /**
   * Cleanup search cache
   * @param {boolean} force - Force cleanup regardless of timeout
   * @returns {number} Number of entries cleaned
   */
  cleanupSearchCache(force = false) {
    const now = Date.now();
    let cleaned = 0;

    this.searchCache.forEach((result, key) => {
      if (force || now - result.timestamp > this.searchCacheTimeout) {
        this.searchCache.delete(key);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Get search cache key
   * @private
   */
  getSearchCacheKey(type, params) {
    return `${type}:${JSON.stringify(params)}`;
  }

  /**
   * Get cached search results
   * @private
   */
  getCachedSearchResults(key) {
    const cached = this.searchCache.get(key);

    if (cached && Date.now() - cached.timestamp < this.searchCacheTimeout) {
      this.metrics.cacheHits++;
      debug.log(`Search cache hit for key: ${key}`);
      return cached.results;
    }

    this.metrics.cacheMisses++;
    return null;
  }

  /**
   * Cache search results
   * @private
   */
  cacheSearchResults(key, results) {
    // Limit cache size
    if (this.searchCache.size >= this.maxSearchCacheSize) {
      // Remove oldest entry
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }

    this.searchCache.set(key, {
      results,
      timestamp: Date.now(),
    });

    debug.log(`Cached search results for key: ${key}`);
  }

  /**
   * Invalidate search cache
   */
  invalidateSearchCache() {
    this.searchCache.clear();
    debug.log('Search cache invalidated');
  }

  /**
   * Build cache key from options
   */
  buildCacheKey(prefix, options) {
    const parts = [prefix];
    const sortedKeys = Object.keys(options).sort();
    for (const key of sortedKeys) {
      if (options[key] !== undefined && options[key] !== null) {
        parts.push(`${key}:${options[key]}`);
      }
    }
    return parts.join(':');
  }

  /**
   * Queue event for batched dispatch
   */
  queueEvent(eventName, detail) {
    this.eventQueue.push({ eventName, detail });

    // Clear existing timeout
    if (this.eventBatchTimeout) {
      clearTimeout(this.eventBatchTimeout);
    }

    // Set new timeout
    this.eventBatchTimeout = setTimeout(() => {
      this.flushEventQueue();
    }, this.eventBatchDelay);
  }

  /**
   * Flush queued events
   */
  flushEventQueue() {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Group events by type
    const groupedEvents = events.reduce((acc, event) => {
      if (!acc[event.eventName]) {
        acc[event.eventName] = [];
      }
      acc[event.eventName].push(event.detail);
      return acc;
    }, {});

    // Dispatch grouped events
    for (const [eventName, details] of Object.entries(groupedEvents)) {
      if (details.length === 1) {
        // Single event
        window.dispatchEvent(new CustomEvent(eventName, { detail: details[0] }));
      } else {
        // Batch event
        window.dispatchEvent(new CustomEvent(`${eventName}:batch`, { detail: details }));
      }
    }
  }

  /**
   * Record operation for history tracking
   */
  recordOperation(type, data, result) {
    const operation = {
      id: Date.now(),
      type,
      data,
      result,
      timestamp: new Date().toISOString(),
    };

    this.operationHistory.unshift(operation);

    // Limit history size
    if (this.operationHistory.length > this.maxHistorySize) {
      this.operationHistory = this.operationHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      operations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      rollbacks: 0,
    };
  }

  // ========== CORE CRUD OPERATIONS ==========

  /**
   * Add a new transaction
   * @param {Object} transactionData - Transaction data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created transaction
   */
  async addTransaction(transactionData, options = {}) {
    const operationId = Date.now();
    this.metrics.operations++;

    try {
      // Store operation for potential rollback
      this.pendingOperations.set(operationId, {
        type: 'add',
        data: transactionData,
        timestamp: Date.now(),
      });

      // Prepare and validate data
      const prepared = this.prepareTransactionData(transactionData);
      const validation = this.validateTransaction(prepared);

      if (!validation.valid && this.strictMode) {
        throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
      }

      // Validate account existence
      const accountValidation = await this.validateAccountsExist(prepared);
      if (!accountValidation.valid) {
        throw new Error(`Invalid account reference: ${JSON.stringify(accountValidation.errors)}`);
      }

      // Save to database
      const savedTransaction = await database.addTransaction(prepared);

      // Clear relevant caches
      this.invalidateCacheByPattern('transactions:*');
      this.invalidateCache(`transaction:${savedTransaction.id}`);

      // Update indexes if available
      if (dataIndex?.addTransaction) {
        dataIndex.addTransaction(savedTransaction);
      }

      // Queue event (or dispatch immediately if not batching)
      if (options.batchEvents) {
        this.queueEvent('transaction:added', { transaction: savedTransaction });
      } else {
        window.dispatchEvent(
          new CustomEvent('transaction:added', {
            detail: { transaction: savedTransaction },
          })
        );
      }

      // Record successful operation
      this.recordOperation('add', prepared, { success: true, id: savedTransaction.id });

      // Remove from pending
      this.pendingOperations.delete(operationId);

      debug.log('TransactionManager: Transaction added', savedTransaction.id);

      // Invalidate search cache since data changed
      this.invalidateSearchCache();

      return savedTransaction;
    } catch (error) {
      this.metrics.errors++;

      // Record failed operation
      this.recordOperation('add', transactionData, { success: false, error: error.message });

      // Remove from pending
      this.pendingOperations.delete(operationId);

      debug.error('TransactionManager: Failed to add transaction', error);
      throw error;
    }
  }

  /**
   * Update an existing transaction
   * @param {number} id - Transaction ID
   * @param {Object} updates - Updates to apply
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransaction(id, updates, options = {}) {
    const operationId = Date.now();
    this.metrics.operations++;

    try {
      // Get original transaction for rollback
      const original = await this.getTransaction(id);
      if (!original) {
        throw new Error(`Transaction ${id} not found`);
      }

      // Store operation for potential rollback
      this.pendingOperations.set(operationId, {
        type: 'update',
        id,
        original,
        updates,
        timestamp: Date.now(),
      });

      // Merge and prepare updates
      const merged = { ...original, ...updates };
      const prepared = this.prepareTransactionData(merged);
      const validation = this.validateTransaction(prepared);

      if (!validation.valid && this.strictMode) {
        throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
      }

      // Validate account existence if account IDs changed
      if (updates.account_id !== undefined || updates.debt_account_id !== undefined) {
        const accountValidation = await this.validateAccountsExist(prepared);
        if (!accountValidation.valid) {
          throw new Error(`Invalid account reference: ${JSON.stringify(accountValidation.errors)}`);
        }
      }

      // Update in database
      const updatedTransaction = await database.updateTransaction(id, prepared);

      // Clear relevant caches
      this.invalidateCacheByPattern('transactions:*');
      this.invalidateCache(`transaction:${id}`);

      // Update indexes if available
      if (dataIndex?.updateTransaction) {
        dataIndex.updateTransaction(id, updatedTransaction);
      }

      // Queue event (or dispatch immediately if not batching)
      if (options.batchEvents) {
        this.queueEvent('transaction:updated', {
          transaction: updatedTransaction,
          original,
          changes: updates,
        });
      } else {
        window.dispatchEvent(
          new CustomEvent('transaction:updated', {
            detail: {
              transaction: updatedTransaction,
              original,
              changes: updates,
            },
          })
        );
      }

      // Record successful operation
      this.recordOperation('update', { id, updates }, { success: true });

      // Remove from pending
      this.pendingOperations.delete(operationId);

      debug.log('TransactionManager: Transaction updated', id);

      // Invalidate search cache since data changed
      this.invalidateSearchCache();

      return updatedTransaction;
    } catch (error) {
      this.metrics.errors++;

      // Record failed operation
      this.recordOperation('update', { id, updates }, { success: false, error: error.message });

      // Remove from pending
      this.pendingOperations.delete(operationId);

      debug.error('TransactionManager: Failed to update transaction', error);
      throw error;
    }
  }

  /**
   * Delete a transaction
   * @param {number} id - Transaction ID
   * @param {Object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async deleteTransaction(id, options = {}) {
    const operationId = Date.now();
    this.metrics.operations++;

    try {
      // Get transaction for rollback and event data
      const transaction = await this.getTransaction(id);
      if (!transaction) {
        throw new Error(`Transaction ${id} not found`);
      }

      // Store operation for potential rollback
      this.pendingOperations.set(operationId, {
        type: 'delete',
        transaction,
        timestamp: Date.now(),
      });

      // Delete from database
      await database.deleteTransaction(id);

      // Clear relevant caches
      this.invalidateCacheByPattern('transactions:*');
      this.invalidateCache(`transaction:${id}`);

      // Update indexes if available
      if (dataIndex?.removeTransaction) {
        dataIndex.removeTransaction(id);
      }

      // Queue event (or dispatch immediately if not batching)
      if (options.batchEvents) {
        this.queueEvent('transaction:deleted', {
          transactionId: id,
          transaction,
        });
      } else {
        window.dispatchEvent(
          new CustomEvent('transaction:deleted', {
            detail: {
              transactionId: id,
              transaction,
            },
          })
        );
      }

      // Record successful operation
      this.recordOperation('delete', { id, transaction }, { success: true });

      // Remove from pending
      this.pendingOperations.delete(operationId);

      debug.log('TransactionManager: Transaction deleted', id);

      // Invalidate search cache since data changed
      this.invalidateSearchCache();

      return true;
    } catch (error) {
      this.metrics.errors++;

      // Record failed operation
      this.recordOperation('delete', { id }, { success: false, error: error.message });

      // Remove from pending
      this.pendingOperations.delete(operationId);

      debug.error('TransactionManager: Failed to delete transaction', error);
      throw error;
    }
  }

  /**
   * Add linked transactions (for Payment/Transfer categories)
   * @param {Object} fromData - Source transaction data
   * @param {Object} toData - Destination transaction data
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Array of created transactions
   */
  async addLinkedTransactions(fromData, toData, options = {}) {
    const operationId = Date.now();
    const savedTransactions = [];

    try {
      // Store operation for rollback
      this.pendingOperations.set(operationId, {
        type: 'addLinked',
        fromData,
        toData,
        timestamp: Date.now(),
      });

      // Add first transaction
      const transaction1 = await this.addTransaction(fromData, {
        ...options,
        batchEvents: true,
      });
      savedTransactions.push(transaction1);

      // Add second transaction
      const transaction2 = await this.addTransaction(toData, {
        ...options,
        batchEvents: true,
      });
      savedTransactions.push(transaction2);

      // Dispatch combined event
      window.dispatchEvent(
        new CustomEvent('transactions:linked', {
          detail: {
            transactions: savedTransactions,
            type: fromData.category, // 'Payment' or 'Transfer'
          },
        })
      );

      // Flush any queued events
      this.flushEventQueue();

      // Record successful operation
      this.recordOperation(
        'addLinked',
        { fromData, toData },
        {
          success: true,
          ids: savedTransactions.map(t => t.id),
        }
      );

      // Remove from pending
      this.pendingOperations.delete(operationId);

      return savedTransactions;
    } catch (error) {
      this.metrics.errors++;
      this.metrics.rollbacks++;

      // Rollback any saved transactions
      for (const saved of savedTransactions) {
        try {
          await this.deleteTransaction(saved.id, { batchEvents: true });
        } catch (rollbackError) {
          debug.error('TransactionManager: Failed to rollback transaction', rollbackError);
        }
      }

      // Record failed operation
      this.recordOperation(
        'addLinked',
        { fromData, toData },
        {
          success: false,
          error: error.message,
        }
      );

      // Remove from pending
      this.pendingOperations.delete(operationId);

      // Flush any queued events
      this.flushEventQueue();

      debug.error('TransactionManager: Failed to add linked transactions', error);
      throw error;
    }
  }

  /**
   * Get pending operations
   * @returns {Array} Array of pending operations
   */
  getPendingOperations() {
    return Array.from(this.pendingOperations.values());
  }

  /**
   * Clear pending operations older than timeout
   * @param {number} timeout - Timeout in milliseconds (default: 5 minutes)
   */
  clearStalePendingOperations(timeout = 5 * 60 * 1000) {
    const now = Date.now();
    let cleared = 0;

    for (const [id, operation] of this.pendingOperations) {
      if (now - operation.timestamp > timeout) {
        this.pendingOperations.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      debug.log(`TransactionManager: Cleared ${cleared} stale pending operations`);
    }

    return cleared;
  }

  // ========== ATOMIC OPERATIONS WITH ROLLBACK ==========

  /**
   * Execute a transaction operation with automatic rollback on failure
   * @param {Function} operation - Async operation to execute
   * @param {Function} rollback - Async rollback function
   * @param {string} operationName - Name for logging
   * @returns {Promise<any>} Operation result
   */
  async executeWithRollback(operation, rollback, operationName = 'Operation') {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      debug.error(`${operationName} failed, attempting rollback`, error);
      this.metrics.rollbacks++;

      try {
        await rollback();
        debug.log(`${operationName} rollback successful`);
      } catch (rollbackError) {
        debug.error(`${operationName} rollback failed`, rollbackError);
        throw new Error(`${operationName} failed and rollback failed: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Create a transaction with balance updates (atomic)
   * @param {Object} transactionData - Transaction data
   * @param {Object} balanceUpdates - Balance update instructions
   * @returns {Promise<Object>} Created transaction with updated balances
   */
  async createTransactionWithBalanceUpdate(transactionData, balanceUpdates) {
    let savedTransaction = null;
    const originalBalances = new Map();

    // Prepare balance update functions
    const applyBalanceUpdates = async transaction => {
      for (const update of balanceUpdates) {
        const { accountType, accountId, amount } = update;

        // Skip cash accounts - their balances are calculated from transactions
        if (accountType === 'cash') {
          debug.log(
            `Skipping balance update for cash account ${accountId} - balances are calculated`
          );
          continue;
        }

        // Only update debt account balances (they have stored balances)
        if (accountType === 'debt') {
          const account = await database.getDebtAccountById(accountId);
          const originalBalance = account?.balance || 0;

          originalBalances.set(`${accountType}_${accountId}`, originalBalance);

          // Apply balance update with special handling for "Debt" category
          let balanceChange;
          if (transaction && transaction.category === 'Debt') {
            // For "Debt" category, use amount as-is
            // Negative payment reduces debt, positive charge increases debt
            balanceChange = amount;
          } else {
            // For other transactions (credit card), negate
            // This maintains the existing sign convention for credit card transactions
            balanceChange = -amount;
          }
          const newBalance = addMoney(originalBalance, balanceChange);
          await database.updateDebtBalance(accountId, newBalance);

          debug.log(
            `Balance updated: ${accountType}_${accountId} from ${originalBalance} to ${newBalance} (category: ${transaction?.category || 'N/A'})`
          );
        }
      }
    };

    // Prepare rollback function
    const rollbackBalances = async () => {
      for (const [key, originalBalance] of originalBalances) {
        const [accountType, accountId] = key.split('_');

        // Only rollback debt account balances (cash accounts don't have stored balances)
        if (accountType === 'debt') {
          await database.updateDebtBalance(parseInt(accountId), originalBalance);
          debug.log(`Balance rolled back: ${key} to ${originalBalance}`);
        }
        // Cash accounts don't need rollback - their balances are calculated
      }
    };

    // Execute atomic operation
    return await this.executeWithRollback(
      async () => {
        // Create transaction first
        savedTransaction = await this.addTransaction(transactionData);

        // Then update balances (passing the saved transaction for category checking)
        await applyBalanceUpdates(savedTransaction);

        // Dispatch success events
        window.dispatchEvent(
          new CustomEvent('transaction:created:withBalance', {
            detail: {
              transaction: savedTransaction,
              balanceUpdates,
            },
          })
        );

        // Also dispatch standard transaction:added event for compatibility
        window.dispatchEvent(
          new CustomEvent('transaction:added', {
            detail: { transaction: savedTransaction },
          })
        );

        return savedTransaction;
      },
      async () => {
        // Rollback balance updates
        await rollbackBalances();

        // Delete the transaction if it was created
        if (savedTransaction) {
          try {
            await this.deleteTransaction(savedTransaction.id, { batchEvents: true });
          } catch (deleteError) {
            debug.error('Failed to delete transaction during rollback', deleteError);
          }
        }
      },
      'Create transaction with balance update'
    );
  }

  /**
   * Update a transaction with balance adjustments (atomic)
   * @param {number} id - Transaction ID
   * @param {Object} updates - Transaction updates
   * @param {Object} balanceAdjustments - Balance adjustment instructions
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransactionWithBalanceAdjustment(id, updates, balanceAdjustments) {
    const original = await this.getTransaction(id);
    if (!original) {
      throw new Error(`Transaction ${id} not found`);
    }

    let updatedTransaction = null;
    const originalBalances = new Map();

    // Prepare balance adjustment functions
    const applyBalanceAdjustments = async transaction => {
      for (const adjustment of balanceAdjustments) {
        const { accountType, accountId, reverseAmount, applyAmount } = adjustment;

        // Skip cash accounts - their balances are calculated from transactions
        if (accountType === 'cash') {
          debug.log(
            `Skipping balance adjustment for cash account ${accountId} - balances are calculated`
          );
          continue;
        }

        // Only adjust debt account balances (they have stored balances)
        if (accountType === 'debt') {
          const account = await database.getDebtAccountById(accountId);
          const currentBalance = account?.balance || 0;

          originalBalances.set(`${accountType}_${accountId}`, currentBalance);

          // Apply adjustment (reverse old + apply new) with special handling for "Debt" category
          let newBalance = currentBalance;

          // First, reverse the original transaction if needed
          if (reverseAmount !== undefined) {
            // Need to know if the ORIGINAL transaction was "Debt" category
            // The 'original' transaction is available in the outer scope
            let reverseBalanceChange;
            if (original && original.category === 'Debt') {
              // Original was "Debt" category, so it used amount as-is
              // To reverse, we negate it
              reverseBalanceChange = -reverseAmount;
            } else {
              // Original was credit card transaction, so it negated the amount
              // To reverse a negation, we use the amount as-is
              reverseBalanceChange = reverseAmount;
            }
            newBalance = addMoney(newBalance, reverseBalanceChange);
          }

          // Then apply the new amount if needed
          if (applyAmount !== undefined) {
            // Apply new with category-specific sign convention
            let balanceChange;
            if (transaction && transaction.category === 'Debt') {
              // For "Debt" category, use amount as-is
              balanceChange = applyAmount;
            } else {
              // For other transactions (credit card), negate
              balanceChange = -applyAmount;
            }
            newBalance = addMoney(newBalance, balanceChange);
          }

          // Update balance
          await database.updateDebtBalance(accountId, newBalance);

          debug.log(
            `Balance adjusted: ${accountType}_${accountId} from ${currentBalance} to ${newBalance} (category: ${transaction?.category || 'N/A'})`
          );
        }
      }
    };

    // Prepare rollback function
    const rollbackBalances = async () => {
      for (const [key, originalBalance] of originalBalances) {
        const [accountType, accountId] = key.split('_');

        // Only rollback debt account balances (cash accounts don't have stored balances)
        if (accountType === 'debt') {
          await database.updateDebtBalance(parseInt(accountId), originalBalance);
          debug.log(`Balance rolled back: ${key} to ${originalBalance}`);
        }
        // Cash accounts don't need rollback - their balances are calculated
      }
    };

    // Execute atomic operation
    return await this.executeWithRollback(
      async () => {
        // Update transaction first
        updatedTransaction = await this.updateTransaction(id, updates);

        // Then adjust balances (passing the updated transaction for category checking)
        await applyBalanceAdjustments(updatedTransaction);

        // Dispatch success event
        window.dispatchEvent(
          new CustomEvent('transaction:updated:withBalance', {
            detail: {
              transaction: updatedTransaction,
              original,
              balanceAdjustments,
            },
          })
        );

        return updatedTransaction;
      },
      async () => {
        // Rollback balance updates
        await rollbackBalances();

        // Revert transaction update
        if (updatedTransaction) {
          try {
            await database.updateTransaction(id, original);
            // Clear cache for reverted transaction
            this.invalidateCache(`transaction:${id}`);
          } catch (revertError) {
            debug.error('Failed to revert transaction during rollback', revertError);
          }
        }
      },
      'Update transaction with balance adjustment'
    );
  }

  /**
   * Delete a transaction with balance reversal (atomic)
   * @param {number} id - Transaction ID
   * @param {Object} balanceReversals - Balance reversal instructions
   * @returns {Promise<boolean>} Success status
   */
  async deleteTransactionWithBalanceReversal(id, balanceReversals) {
    const transaction = await this.getTransaction(id);
    if (!transaction) {
      throw new Error(`Transaction ${id} not found`);
    }

    const originalBalances = new Map();

    // Prepare balance reversal functions
    const applyBalanceReversals = async () => {
      for (const reversal of balanceReversals) {
        const { accountType, accountId, amount } = reversal;

        // Skip cash accounts - their balances are calculated from transactions
        if (accountType === 'cash') {
          debug.log(
            `Skipping balance reversal for cash account ${accountId} - balances are calculated`
          );
          continue;
        }

        // Only reverse debt account balances (they have stored balances)
        if (accountType === 'debt') {
          const account = await database.getDebtAccountById(accountId);
          const currentBalance = account?.balance || 0;

          originalBalances.set(`${accountType}_${accountId}`, currentBalance);

          // Apply reversal - undo the original operation with category-specific logic
          let balanceChange;
          if (transaction && transaction.category === 'Debt') {
            // For "Debt" category, the original operation used amount as-is
            // So reversal is simply negating the amount
            balanceChange = -amount;
          } else {
            // For other transactions (credit card), the original operation negated the amount
            // So reversal is the amount itself (double negative becomes positive)
            balanceChange = amount;
          }
          const newBalance = addMoney(currentBalance, balanceChange);

          // Update balance
          await database.updateDebtBalance(accountId, newBalance);

          debug.log(
            `Balance reversed: ${accountType}_${accountId} from ${currentBalance} to ${newBalance} (category: ${transaction?.category || 'N/A'})`
          );
        }
      }
    };

    // Prepare rollback function
    const rollbackBalances = async () => {
      for (const [key, originalBalance] of originalBalances) {
        const [accountType, accountId] = key.split('_');

        // Only rollback debt account balances (cash accounts don't have stored balances)
        if (accountType === 'debt') {
          await database.updateDebtBalance(parseInt(accountId), originalBalance);
          debug.log(`Balance rolled back: ${key} to ${originalBalance}`);
        }
        // Cash accounts don't need rollback - their balances are calculated
      }
    };

    // Execute atomic operation
    return await this.executeWithRollback(
      async () => {
        // Delete transaction first
        await this.deleteTransaction(id);

        // Then reverse balances
        await applyBalanceReversals();

        // Dispatch success event
        window.dispatchEvent(
          new CustomEvent('transaction:deleted:withBalance', {
            detail: {
              transactionId: id,
              transaction,
              balanceReversals,
            },
          })
        );

        return true;
      },
      async () => {
        // Rollback balance reversals
        await rollbackBalances();

        // Re-add the transaction
        try {
          const restoredTransaction = await database.addTransaction(transaction);
          this.invalidateCache(`transaction:${restoredTransaction.id}`);
          debug.log('Transaction restored during rollback', restoredTransaction.id);
        } catch (restoreError) {
          debug.error('Failed to restore transaction during rollback', restoreError);
          throw new Error('Critical: Failed to restore transaction after balance rollback');
        }
      },
      'Delete transaction with balance reversal'
    );
  }

  /**
   * Create a rollback checkpoint
   * @returns {Object} Checkpoint data
   */
  createCheckpoint() {
    return {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      pendingOperations: new Map(this.pendingOperations),
      cacheSnapshot: new Map(this.cache),
      metrics: { ...this.metrics },
    };
  }

  /**
   * Restore from checkpoint
   * @param {Object} checkpoint - Checkpoint data
   */
  restoreFromCheckpoint(checkpoint) {
    this.pendingOperations = new Map(checkpoint.pendingOperations);
    this.cache = new Map(checkpoint.cacheSnapshot);
    this.metrics = { ...checkpoint.metrics };

    debug.log('TransactionManager: Restored from checkpoint', checkpoint.id);
  }

  // ========== BATCH OPERATIONS ==========

  /**
   * Add multiple transactions in batch
   * @param {Array} transactionsData - Array of transaction data objects
   * @param {Object} options - Batch operation options
   * @returns {Promise<Object>} Batch operation result
   */
  async addMultipleTransactions(transactionsData, options = {}) {
    const batchId = Date.now();
    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    // Default options
    const batchOptions = {
      stopOnError: false,
      batchSize: this.batchSize,
      delayBetweenBatches: this.batchDelay,
      validateAll: true,
      rollbackOnFailure: false,
      ...options,
    };

    debug.log(`TransactionManager: Starting batch add of ${transactionsData.length} transactions`);

    // Validate all transactions first if requested
    if (batchOptions.validateAll) {
      const validationResults = transactionsData.map((data, index) => ({
        index,
        data,
        validation: this.validateTransaction(this.prepareTransactionData(data)),
      }));

      const invalidTransactions = validationResults.filter(r => !r.validation.valid);
      if (invalidTransactions.length > 0 && this.strictMode) {
        debug.error(`Batch validation failed: ${invalidTransactions.length} invalid transactions`);
        return {
          ...results,
          failed: invalidTransactions.map(r => ({
            index: r.index,
            data: r.data,
            error: r.validation.errors,
          })),
          totalFailed: invalidTransactions.length,
          error: 'Validation failed for one or more transactions',
        };
      }
    }

    // Process in batches
    const savedTransactions = [];
    try {
      for (let i = 0; i < transactionsData.length; i += batchOptions.batchSize) {
        const batch = transactionsData.slice(i, i + batchOptions.batchSize);

        // Process batch
        const batchPromises = batch.map(async (data, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            const transaction = await this.addTransaction(data, { batchEvents: true });
            results.successful.push({
              index: globalIndex,
              transaction,
            });
            savedTransactions.push(transaction);
            results.totalSuccess++;
            return { success: true, transaction };
          } catch (error) {
            results.failed.push({
              index: globalIndex,
              data,
              error: error.message,
            });
            results.totalFailed++;

            if (batchOptions.stopOnError) {
              throw new Error(`Batch stopped at index ${globalIndex}: ${error.message}`);
            }

            return { success: false, error };
          }
        });

        // Wait for batch to complete
        await Promise.all(batchPromises);
        results.totalProcessed = i + batch.length;

        // Add delay between batches
        if (i + batchOptions.batchSize < transactionsData.length) {
          await new Promise(resolve => setTimeout(resolve, batchOptions.delayBetweenBatches));
        }
      }

      // Flush events and dispatch batch complete event
      this.flushEventQueue();
      window.dispatchEvent(
        new CustomEvent('transactions:batchAdded', {
          detail: {
            batchId,
            results,
            transactions: savedTransactions,
          },
        })
      );

      debug.log(
        `Batch add complete: ${results.totalSuccess} succeeded, ${results.totalFailed} failed`
      );
    } catch (error) {
      debug.error('Batch add operation failed:', error);

      // Rollback if requested
      if (batchOptions.rollbackOnFailure && savedTransactions.length > 0) {
        debug.log('Rolling back successful transactions...');
        for (const transaction of savedTransactions) {
          try {
            await this.deleteTransaction(transaction.id, { batchEvents: true });
          } catch (rollbackError) {
            debug.error('Rollback failed for transaction:', transaction.id, rollbackError);
          }
        }
        this.flushEventQueue();
      }

      results.error = error.message;
    }

    return results;
  }

  /**
   * Update multiple transactions in batch
   * @param {Array} updates - Array of {id, updates} objects
   * @param {Object} options - Batch operation options
   * @returns {Promise<Object>} Batch operation result
   */
  async updateMultipleTransactions(updates, options = {}) {
    const batchId = Date.now();
    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    const batchOptions = {
      stopOnError: false,
      batchSize: this.batchSize,
      delayBetweenBatches: this.batchDelay,
      ...options,
    };

    debug.log(`TransactionManager: Starting batch update of ${updates.length} transactions`);

    // Store original states for potential rollback
    const originalStates = new Map();

    try {
      // First, fetch all originals
      for (const update of updates) {
        const original = await this.getTransaction(update.id);
        if (original) {
          originalStates.set(update.id, original);
        }
      }

      // Process in batches
      for (let i = 0; i < updates.length; i += batchOptions.batchSize) {
        const batch = updates.slice(i, i + batchOptions.batchSize);

        const batchPromises = batch.map(async (update, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            if (!originalStates.has(update.id)) {
              throw new Error(`Transaction ${update.id} not found`);
            }

            const updatedTransaction = await this.updateTransaction(update.id, update.updates, {
              batchEvents: true,
            });

            results.successful.push({
              index: globalIndex,
              transaction: updatedTransaction,
            });
            results.totalSuccess++;
            return { success: true, transaction: updatedTransaction };
          } catch (error) {
            results.failed.push({
              index: globalIndex,
              id: update.id,
              updates: update.updates,
              error: error.message,
            });
            results.totalFailed++;

            if (batchOptions.stopOnError) {
              throw new Error(`Batch stopped at index ${globalIndex}: ${error.message}`);
            }

            return { success: false, error };
          }
        });

        await Promise.all(batchPromises);
        results.totalProcessed = i + batch.length;

        if (i + batchOptions.batchSize < updates.length) {
          await new Promise(resolve => setTimeout(resolve, batchOptions.delayBetweenBatches));
        }
      }

      // Flush events
      this.flushEventQueue();
      window.dispatchEvent(
        new CustomEvent('transactions:batchUpdated', {
          detail: {
            batchId,
            results,
            originalStates: Array.from(originalStates.values()),
          },
        })
      );

      debug.log(
        `Batch update complete: ${results.totalSuccess} succeeded, ${results.totalFailed} failed`
      );
    } catch (error) {
      debug.error('Batch update operation failed:', error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Delete multiple transactions in batch
   * @param {Array} transactionIds - Array of transaction IDs
   * @param {Object} options - Batch operation options
   * @returns {Promise<Object>} Batch operation result
   */
  async deleteMultipleTransactions(transactionIds, options = {}) {
    const batchId = Date.now();
    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    const batchOptions = {
      stopOnError: false,
      batchSize: this.batchSize,
      delayBetweenBatches: this.batchDelay,
      preserveBackup: true,
      ...options,
    };

    debug.log(`TransactionManager: Starting batch delete of ${transactionIds.length} transactions`);

    // Store deleted transactions for potential recovery
    const deletedTransactions = new Map();

    try {
      // First, backup all transactions if requested
      if (batchOptions.preserveBackup) {
        for (const id of transactionIds) {
          const transaction = await this.getTransaction(id);
          if (transaction) {
            deletedTransactions.set(id, transaction);
          }
        }
      }

      // Process in batches
      for (let i = 0; i < transactionIds.length; i += batchOptions.batchSize) {
        const batch = transactionIds.slice(i, i + batchOptions.batchSize);

        const batchPromises = batch.map(async (id, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            // Check if this is a credit card transaction that needs balance reversal
            const transaction = deletedTransactions.get(id);
            if (transaction && transaction.debt_account_id) {
              // Credit card transaction - use atomic balance reversal
              const balanceReversals = [
                {
                  accountType: 'debt',
                  accountId: transaction.debt_account_id,
                  amount: transaction.amount,
                },
              ];
              await this.deleteTransactionWithBalanceReversal(id, balanceReversals);
            } else {
              // Regular transaction or cash account transaction
              await this.deleteTransaction(id, { batchEvents: true });
            }

            results.successful.push({
              index: globalIndex,
              id,
              transaction: deletedTransactions.get(id),
            });
            results.totalSuccess++;
            return { success: true, id };
          } catch (error) {
            results.failed.push({
              index: globalIndex,
              id,
              error: error.message,
            });
            results.totalFailed++;

            if (batchOptions.stopOnError) {
              throw new Error(`Batch stopped at index ${globalIndex}: ${error.message}`);
            }

            return { success: false, error };
          }
        });

        await Promise.all(batchPromises);
        results.totalProcessed = i + batch.length;

        if (i + batchOptions.batchSize < transactionIds.length) {
          await new Promise(resolve => setTimeout(resolve, batchOptions.delayBetweenBatches));
        }
      }

      // Flush events
      this.flushEventQueue();
      window.dispatchEvent(
        new CustomEvent('transactions:batchDeleted', {
          detail: {
            batchId,
            results,
            deletedTransactions: Array.from(deletedTransactions.values()),
          },
        })
      );

      debug.log(
        `Batch delete complete: ${results.totalSuccess} succeeded, ${results.totalFailed} failed`
      );
    } catch (error) {
      debug.error('Batch delete operation failed:', error);
      results.error = error.message;
    }

    // Store backup for potential recovery
    if (batchOptions.preserveBackup && deletedTransactions.size > 0) {
      results.backup = Array.from(deletedTransactions.values());
    }

    return results;
  }

  /**
   * Process transactions with a custom operation
   * @param {Array} items - Array of items to process
   * @param {Function} operation - Async operation to perform on each item
   * @param {Object} options - Batch operation options
   * @returns {Promise<Object>} Batch operation result
   */
  async batchProcess(items, operation, options = {}) {
    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    const batchOptions = {
      stopOnError: false,
      batchSize: this.batchSize,
      delayBetweenBatches: this.batchDelay,
      operationName: 'custom',
      ...options,
    };

    debug.log(
      `TransactionManager: Starting batch ${batchOptions.operationName} of ${items.length} items`
    );

    try {
      for (let i = 0; i < items.length; i += batchOptions.batchSize) {
        const batch = items.slice(i, i + batchOptions.batchSize);

        const batchPromises = batch.map(async (item, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            const result = await operation(item, globalIndex);

            results.successful.push({
              index: globalIndex,
              item,
              result,
            });
            results.totalSuccess++;
            return { success: true, result };
          } catch (error) {
            results.failed.push({
              index: globalIndex,
              item,
              error: error.message,
            });
            results.totalFailed++;

            if (batchOptions.stopOnError) {
              throw new Error(`Batch stopped at index ${globalIndex}: ${error.message}`);
            }

            return { success: false, error };
          }
        });

        await Promise.all(batchPromises);
        results.totalProcessed = i + batch.length;

        // Progress callback
        if (batchOptions.onProgress) {
          batchOptions.onProgress({
            processed: results.totalProcessed,
            total: items.length,
            percentage: (results.totalProcessed / items.length) * 100,
          });
        }

        if (i + batchOptions.batchSize < items.length) {
          await new Promise(resolve => setTimeout(resolve, batchOptions.delayBetweenBatches));
        }
      }

      debug.log(
        `Batch ${batchOptions.operationName} complete: ${results.totalSuccess} succeeded, ${results.totalFailed} failed`
      );
    } catch (error) {
      debug.error(`Batch ${batchOptions.operationName} operation failed:`, error);
      results.error = error.message;
    }

    return results;
  }

  /**
   * Import transactions from external data
   * @param {Array} importData - Array of transaction data to import
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importTransactions(importData, options = {}) {
    const importOptions = {
      duplicateCheck: true,
      transformFunction: null,
      categoryMapping: null,
      accountMapping: null,
      ...options,
    };

    debug.log(`TransactionManager: Importing ${importData.length} transactions`);

    // Transform data if function provided
    let transformedData = importData;
    if (importOptions.transformFunction) {
      transformedData = importData.map(importOptions.transformFunction);
    }

    // Apply category mapping if provided
    if (importOptions.categoryMapping) {
      transformedData = transformedData.map(data => ({
        ...data,
        category: importOptions.categoryMapping[data.category] || data.category,
      }));
    }

    // Apply account mapping if provided
    if (importOptions.accountMapping) {
      transformedData = transformedData.map(data => ({
        ...data,
        account_id: importOptions.accountMapping[data.account_id] || data.account_id,
      }));
    }

    // Check for duplicates if requested
    if (importOptions.duplicateCheck) {
      const existingTransactions = await this.getTransactions();
      const duplicates = [];

      transformedData = transformedData.filter(data => {
        const isDuplicate = existingTransactions.some(
          existing =>
            existing.date === data.date &&
            existing.amount === data.amount &&
            existing.description === data.description
        );

        if (isDuplicate) {
          duplicates.push(data);
        }

        return !isDuplicate;
      });

      if (duplicates.length > 0) {
        debug.log(`Found ${duplicates.length} duplicate transactions, skipping`);
      }
    }

    // Import using batch add
    const result = await this.addMultipleTransactions(transformedData, {
      ...options,
      operationName: 'import',
    });

    // Add import metadata to result
    result.importMetadata = {
      originalCount: importData.length,
      transformedCount: transformedData.length,
      duplicatesSkipped: importData.length - transformedData.length,
    };

    window.dispatchEvent(
      new CustomEvent('transactions:imported', {
        detail: result,
      })
    );

    return result;
  }

  // ========== ADDITIONAL UTILITY METHODS ==========

  // Removed duplicate searchTransactions method - using the more comprehensive one below

  /**
   * Get transaction statistics
   * @param {Object} options - Statistics options
   * @returns {Promise<Object>} Transaction statistics
   */
  async getTransactionStatistics(options = {}) {
    const { dateFrom, dateTo } = options;

    const transactions = await this.getTransactions({ dateFrom, dateTo });

    const stats = {
      totalTransactions: transactions.length,
      totalIncome: 0,
      totalExpenses: 0,
      netAmount: 0,
      averageTransaction: 0,
      largestIncome: 0,
      largestExpense: 0,
      categoryCounts: {},
      categoryTotals: {},
      monthlyTotals: {},
      dailyAverages: {},
    };

    // Calculate basic statistics
    transactions.forEach(t => {
      const amount = t.amount;

      if (amount > 0) {
        stats.totalIncome += amount;
        stats.largestIncome = Math.max(stats.largestIncome, amount);
      } else {
        stats.totalExpenses += Math.abs(amount);
        stats.largestExpense = Math.max(stats.largestExpense, Math.abs(amount));
      }

      // Category statistics
      if (!stats.categoryCounts[t.category]) {
        stats.categoryCounts[t.category] = 0;
        stats.categoryTotals[t.category] = 0;
      }
      stats.categoryCounts[t.category]++;
      stats.categoryTotals[t.category] += amount;

      // Monthly statistics
      const monthKey = t.date.substring(0, 7); // YYYY-MM
      if (!stats.monthlyTotals[monthKey]) {
        stats.monthlyTotals[monthKey] = { income: 0, expenses: 0, net: 0 };
      }
      if (amount > 0) {
        stats.monthlyTotals[monthKey].income += amount;
      } else {
        stats.monthlyTotals[monthKey].expenses += Math.abs(amount);
      }
      stats.monthlyTotals[monthKey].net += amount;
    });

    // Calculate derived statistics
    stats.netAmount = stats.totalIncome - stats.totalExpenses;
    stats.averageTransaction =
      stats.totalTransactions > 0 ? stats.netAmount / stats.totalTransactions : 0;

    // Calculate daily averages
    if (dateFrom && dateTo) {
      const days = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
      stats.dailyAverages = {
        income: stats.totalIncome / days,
        expenses: stats.totalExpenses / days,
        net: stats.netAmount / days,
      };
    }

    return stats;
  }

  /**
   * Export transactions to various formats
   * @param {Array} transactions - Transactions to export
   * @param {string} format - Export format (csv, json, qif)
   * @returns {string} Exported data
   */
  exportTransactions(transactions, format = 'csv') {
    switch (format.toLowerCase()) {
      case 'csv':
        return this.exportToCSV(transactions);
      case 'json':
        return this.exportToJSON(transactions);
      case 'qif':
        return this.exportToQIF(transactions);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to CSV format
   */
  exportToCSV(transactions) {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Account', 'Cleared'];
    const rows = transactions.map(t => [
      t.date,
      `"${t.description.replace(/"/g, '""')}"`,
      t.category,
      t.amount,
      t.account_name || 'N/A',
      t.cleared ? 'Yes' : 'No',
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Export to JSON format
   */
  exportToJSON(transactions) {
    return JSON.stringify(transactions, null, 2);
  }

  /**
   * Export to QIF format
   */
  exportToQIF(transactions) {
    let qif = '!Type:Bank\n';

    transactions.forEach(t => {
      qif += `D${t.date}\n`;
      qif += `T${t.amount}\n`;
      qif += `P${t.description}\n`;
      qif += `L${t.category}\n`;
      if (t.cleared) {
        qif += 'C*\n';
      }
      qif += '^\n';
    });

    return qif;
  }

  // ===== TRANSACTION TEMPLATES =====

  /**
   * Get all transaction templates
   * @returns {Promise<Array>} Array of templates
   */
  async getTransactionTemplates() {
    try {
      const templates = await database.getTransactionTemplates();
      debug.log(`Retrieved ${templates.length} transaction templates`);
      return templates;
    } catch (error) {
      debug.error('Failed to get transaction templates', error);
      throw error;
    }
  }

  /**
   * Create a transaction template from an existing transaction
   * @param {number} transactionId - ID of transaction to use as template
   * @param {string} templateName - Name for the template
   * @returns {Promise<Object>} Created template
   */
  async createTemplateFromTransaction(transactionId, templateName) {
    try {
      // Get the transaction
      const transaction = await this.getTransaction(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Create template data
      const templateData = {
        name: templateName,
        account_id: transaction.account_id,
        category: transaction.category,
        description: transaction.description,
        amount: Math.abs(transaction.amount), // Store absolute amount
        debt_account_id: transaction.debt_account_id,
        is_income: transaction.amount > 0,
        tags: [], // Can be extended to support tags
      };

      // Save template
      const template = await database.addTransactionTemplate(templateData);

      // Dispatch event
      this.queueEvent('template:created', { template });

      debug.log(`Created template "${templateName}" from transaction ${transactionId}`);
      return template;
    } catch (error) {
      debug.error('Failed to create template from transaction', error);
      throw error;
    }
  }

  /**
   * Create a new transaction template
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  async createTemplate(templateData) {
    try {
      // Validate template data
      if (!templateData.name) {
        throw new Error('Template name is required');
      }

      // Ensure amount is positive
      if (templateData.amount) {
        templateData.amount = Math.abs(templateData.amount);
      }

      // Save template
      const template = await database.addTransactionTemplate(templateData);

      // Dispatch event
      this.queueEvent('template:created', { template });

      debug.log(`Created template "${templateData.name}"`);
      return template;
    } catch (error) {
      debug.error('Failed to create template', error);
      throw error;
    }
  }

  /**
   * Update a transaction template
   * @param {number} templateId - Template ID
   * @param {Object} updates - Updated data
   * @returns {Promise<Object>} Updated template
   */
  async updateTemplate(templateId, updates) {
    try {
      // Ensure amount is positive if provided
      if (updates.amount !== undefined) {
        updates.amount = Math.abs(updates.amount);
      }

      // Update template
      const template = await database.updateTransactionTemplate(templateId, updates);

      // Dispatch event
      this.queueEvent('template:updated', { template });

      debug.log(`Updated template ${templateId}`);
      return template;
    } catch (error) {
      debug.error('Failed to update template', error);
      throw error;
    }
  }

  /**
   * Delete a transaction template
   * @param {number} templateId - Template ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTemplate(templateId) {
    try {
      await database.deleteTransactionTemplate(templateId);

      // Dispatch event
      this.queueEvent('template:deleted', { templateId });

      debug.log(`Deleted template ${templateId}`);
      return true;
    } catch (error) {
      debug.error('Failed to delete template', error);
      throw error;
    }
  }

  /**
   * Create a transaction from a template
   * @param {number} templateId - Template ID
   * @param {Object} overrides - Override template values (e.g., date, amount)
   * @returns {Promise<Object>} Created transaction
   */
  async createTransactionFromTemplate(templateId, overrides = {}) {
    try {
      // Get the template
      const templates = await this.getTransactionTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      // Build transaction data from template
      const transactionData = {
        date: overrides.date || new Date().toISOString().split('T')[0],
        account_id: overrides.account_id || template.account_id,
        category: overrides.category || template.category,
        description: overrides.description || template.description,
        amount:
          overrides.amount !== undefined
            ? overrides.amount
            : template.is_income
              ? template.amount
              : -template.amount,
        debt_account_id:
          overrides.debt_account_id !== undefined
            ? overrides.debt_account_id
            : template.debt_account_id,
        cleared: overrides.cleared !== undefined ? overrides.cleared : false,
      };

      // Create the transaction
      const transaction = await this.addTransaction(transactionData);

      // Dispatch event
      this.queueEvent('transaction:created:fromTemplate', {
        transaction,
        templateId,
        templateName: template.name,
      });

      debug.log(`Created transaction from template "${template.name}"`);
      return transaction;
    } catch (error) {
      debug.error('Failed to create transaction from template', error);
      throw error;
    }
  }

  /**
   * Get suggested templates based on transaction patterns
   * @param {number} limit - Maximum number of suggestions
   * @returns {Promise<Array>} Suggested template data
   */
  async getSuggestedTemplates(limit = 5) {
    try {
      // Get recent transactions
      const recentTransactions = await database.getTransactions();

      // Count frequency of description/category combinations
      const patterns = new Map();

      recentTransactions.forEach(transaction => {
        // Create a key from category and cleaned description
        const cleanDescription = transaction.description
          .toLowerCase()
          .replace(/\d+/g, '') // Remove numbers
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();

        const key = `${transaction.category}|${cleanDescription}`;

        if (!patterns.has(key)) {
          patterns.set(key, {
            category: transaction.category,
            description: transaction.description,
            account_id: transaction.account_id,
            debt_account_id: transaction.debt_account_id,
            count: 0,
            totalAmount: 0,
            isIncome: transaction.amount > 0,
          });
        }

        const pattern = patterns.get(key);
        pattern.count++;
        pattern.totalAmount += Math.abs(transaction.amount);
      });

      // Sort by frequency and filter out existing templates
      const existingTemplates = await this.getTransactionTemplates();
      const existingKeys = new Set(
        existingTemplates.map(t => `${t.category}|${t.description.toLowerCase()}`)
      );

      const suggestions = Array.from(patterns.entries())
        .filter(([key, pattern]) => {
          // Only suggest if used at least 3 times and not already a template
          return pattern.count >= 3 && !existingKeys.has(key);
        })
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(([key, pattern]) => ({
          name: `${pattern.category}: ${pattern.description}`,
          category: pattern.category,
          description: pattern.description,
          account_id: pattern.account_id,
          debt_account_id: pattern.debt_account_id,
          amount: Math.round((pattern.totalAmount / pattern.count) * 100) / 100,
          is_income: pattern.isIncome,
          frequency: pattern.count,
        }));

      debug.log(`Generated ${suggestions.length} template suggestions`);
      return suggestions;
    } catch (error) {
      debug.error('Failed to get suggested templates', error);
      throw error;
    }
  }

  // ===== RECURRING TRANSACTION GENERATION =====

  /**
   * Generate transactions for due recurring bills
   * @param {Array} recurringBills - Array of recurring bills
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generation results
   */
  async generateRecurringTransactions(recurringBills, options = {}) {
    const {
      daysAhead = 0, // Generate for bills due in next N days (0 = only today)
      autoProcess = false, // Automatically create transactions
      dryRun = false, // Preview without creating
    } = options;

    const results = {
      due: [],
      generated: [],
      failed: [],
      skipped: [],
    };

    try {
      const today = new Date();
      const targetDate = new Date();
      targetDate.setDate(today.getDate() + daysAhead);

      // Filter bills that are due
      for (const bill of recurringBills) {
        if (!bill.is_active) {
          results.skipped.push({
            bill,
            reason: 'Bill is inactive',
          });
          continue;
        }

        const nextDueDate = this.calculateNextDueDate(bill);
        if (!nextDueDate) {
          results.skipped.push({
            bill,
            reason: 'Could not calculate next due date',
          });
          continue;
        }

        const dueDate = new Date(nextDueDate);

        // Check if bill is due within target date range
        if (dueDate <= targetDate) {
          const transactionData = {
            date: nextDueDate,
            account_id: bill.account_id,
            category: bill.category,
            description: `${bill.name} (Recurring)`,
            amount: -bill.amount, // Expenses are negative
            cleared: false,
            debt_account_id: bill.debt_account_id || null,
          };

          results.due.push({
            bill,
            dueDate: nextDueDate,
            transactionData,
          });

          // Generate transaction if autoProcess is enabled
          if (autoProcess && !dryRun) {
            try {
              let transaction;

              // Check payment method
              const paymentMethod = bill.payment_method || 'cash';

              if (paymentMethod === 'credit' && bill.debt_account_id) {
                // Credit card payment with balance update
                transactionData.account_id = null;
                transactionData.amount = bill.amount; // Positive for debt
                transactionData.description = `${bill.name} (Recurring - Credit Card)`;

                transaction = await this.createTransactionWithBalanceUpdate(transactionData, [
                  {
                    accountType: 'debt',
                    accountId: bill.debt_account_id,
                    amount: bill.amount,
                  },
                ]);
              } else {
                // Regular cash account transaction
                transaction = await this.addTransaction(transactionData);
              }

              results.generated.push({
                bill,
                transaction,
              });

              // Update last paid date
              await this.updateRecurringBillLastPaid(bill.id, nextDueDate);
            } catch (error) {
              results.failed.push({
                bill,
                error: error.message,
              });
            }
          }
        }
      }

      // Dispatch event with results
      this.queueEvent('recurring:generated', results);

      debug.log(
        `Recurring generation complete: ${results.generated.length} generated, ${results.due.length} due, ${results.failed.length} failed`
      );

      return results;
    } catch (error) {
      debug.error('Failed to generate recurring transactions', error);
      throw error;
    }
  }

  /**
   * Calculate next due date for a recurring bill
   * @param {Object} bill - Recurring bill
   * @returns {string|null} Next due date in YYYY-MM-DD format
   */
  calculateNextDueDate(bill) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let nextDue;

      if (bill.last_paid_date) {
        // Calculate from last paid date
        const lastPaidDate = new Date(bill.last_paid_date);
        // Validate the date
        if (isNaN(lastPaidDate.getTime())) {
          debug.warn('Invalid last_paid_date for bill:', bill.name, bill.last_paid_date);
          nextDue = new Date(today);
        } else {
          nextDue = lastPaidDate;
        }
      } else if (bill.next_due_date) {
        // Use stored next due date
        const storedNextDue = new Date(bill.next_due_date);
        // Validate the date
        if (isNaN(storedNextDue.getTime())) {
          debug.warn('Invalid next_due_date for bill:', bill.name, bill.next_due_date);
          nextDue = new Date(today);
        } else {
          nextDue = storedNextDue;

          // If it's in the past, calculate next occurrence
          if (nextDue < today) {
            nextDue = today;
          } else {
            return bill.next_due_date; // Already future date
          }
        }
      } else {
        // Start from today if no reference date
        nextDue = new Date(today);
      }

      // Add frequency period
      switch (bill.frequency) {
        case 'daily':
          nextDue.setDate(nextDue.getDate() + 1);
          break;
        case 'weekly':
          nextDue.setDate(nextDue.getDate() + 7);
          break;
        case 'biweekly':
          nextDue.setDate(nextDue.getDate() + 14);
          break;
        case 'monthly':
          nextDue.setMonth(nextDue.getMonth() + 1);
          break;
        case 'quarterly':
          nextDue.setMonth(nextDue.getMonth() + 3);
          break;
        case 'annually':
          nextDue.setFullYear(nextDue.getFullYear() + 1);
          break;
        default:
          return null;
      }

      // If next due is still in the past, keep advancing until future
      while (nextDue <= today) {
        switch (bill.frequency) {
          case 'daily':
            nextDue.setDate(nextDue.getDate() + 1);
            break;
          case 'weekly':
            nextDue.setDate(nextDue.getDate() + 7);
            break;
          case 'biweekly':
            nextDue.setDate(nextDue.getDate() + 14);
            break;
          case 'monthly':
            nextDue.setMonth(nextDue.getMonth() + 1);
            break;
          case 'quarterly':
            nextDue.setMonth(nextDue.getMonth() + 3);
            break;
          case 'annually':
            nextDue.setFullYear(nextDue.getFullYear() + 1);
            break;
        }
      }

      // Validate the final date before returning
      if (isNaN(nextDue.getTime())) {
        debug.error('Invalid date calculated for bill:', bill.name);
        return null;
      }

      return nextDue.toISOString().split('T')[0];
    } catch (error) {
      debug.error('Failed to calculate next due date', error);
      return null;
    }
  }

  /**
   * Update recurring bill's last paid date
   * @param {number} billId - Bill ID
   * @param {string} paidDate - Date paid in YYYY-MM-DD format
   * @returns {Promise<void>}
   */
  async updateRecurringBillLastPaid(billId, paidDate) {
    try {
      await database.updateRecurringBill(billId, {
        last_paid_date: paidDate,
        next_due_date: this.calculateNextDueDate({
          last_paid_date: paidDate,
          frequency: 'monthly', // This should come from the bill
        }),
      });
    } catch (error) {
      debug.error('Failed to update recurring bill last paid date', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Preview upcoming recurring transactions
   * @param {Array} recurringBills - Array of recurring bills
   * @param {number} daysAhead - Number of days to look ahead
   * @returns {Promise<Array>} Array of upcoming transactions
   */
  async previewUpcomingRecurring(recurringBills, daysAhead = 30) {
    const results = await this.generateRecurringTransactions(recurringBills, {
      daysAhead,
      autoProcess: false,
      dryRun: true,
    });

    return results.due.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }

  /**
   * Auto-generate recurring transactions that are due
   * This can be called periodically (e.g., daily) to create due transactions
   * @param {Array} recurringBills - Array of recurring bills
   * @returns {Promise<Object>} Generation results
   */
  async autoGenerateDueTransactions(recurringBills) {
    return this.generateRecurringTransactions(recurringBills, {
      daysAhead: 0, // Only today's bills
      autoProcess: true,
      dryRun: false,
    });
  }

  // ===== SMART DEFAULTS & PATTERN RECOGNITION =====

  /**
   * Get smart defaults for a new transaction based on patterns
   * @param {Object} partialData - Partial transaction data (e.g., description)
   * @returns {Promise<Object>} Suggested defaults
   */
  async getSmartDefaults(partialData = {}) {
    try {
      const { description, category, account_id } = partialData;
      const suggestions = {
        category: null,
        amount: null,
        account_id: null,
        debt_account_id: null,
        confidence: 0,
        source: null,
      };

      // Get recent transactions for pattern matching
      const recentTransactions = await database.getTransactions();

      // First try: Exact description match
      if (description) {
        const exactMatches = recentTransactions.filter(
          t => t.description && t.description.toLowerCase() === description.toLowerCase()
        );

        if (exactMatches.length > 0) {
          // Use the most recent exact match
          const match = exactMatches[0];
          suggestions.category = match.category;
          suggestions.amount = Math.abs(match.amount);
          suggestions.account_id = match.account_id;
          suggestions.debt_account_id = match.debt_account_id;
          suggestions.confidence = 0.95;
          suggestions.source = 'exact_match';

          debug.log(`Found exact match for "${description}"`);
          return suggestions;
        }
      }

      // Second try: Partial description match
      if (description && description.length > 3) {
        const partialMatches = recentTransactions.filter(
          t => t.description && t.description.toLowerCase().includes(description.toLowerCase())
        );

        if (partialMatches.length > 0) {
          // Analyze patterns in partial matches
          const patterns = this.analyzeTransactionPatterns(partialMatches);

          if (patterns.mostCommonCategory) {
            suggestions.category = patterns.mostCommonCategory;
            suggestions.confidence += 0.3;
          }

          if (patterns.averageAmount) {
            suggestions.amount = patterns.averageAmount;
            suggestions.confidence += 0.2;
          }

          if (patterns.mostCommonAccount) {
            suggestions.account_id = patterns.mostCommonAccount;
            suggestions.confidence += 0.2;
          }

          suggestions.source = 'partial_match';
          debug.log(`Found partial matches for "${description}"`);
        }
      }

      // Third try: Category-based defaults
      if (category && !suggestions.category) {
        const categoryMatches = recentTransactions.filter(t => t.category === category);

        if (categoryMatches.length > 0) {
          const patterns = this.analyzeTransactionPatterns(categoryMatches);

          if (!suggestions.amount && patterns.averageAmount) {
            suggestions.amount = patterns.averageAmount;
            suggestions.confidence += 0.15;
          }

          if (!suggestions.account_id && patterns.mostCommonAccount) {
            suggestions.account_id = patterns.mostCommonAccount;
            suggestions.confidence += 0.15;
          }

          suggestions.source = suggestions.source || 'category_match';
        }
      }

      // Fourth try: Check transaction templates
      const templates = await this.getTransactionTemplates();
      if (description && templates.length > 0) {
        const templateMatch = templates.find(
          t => t.description && t.description.toLowerCase().includes(description.toLowerCase())
        );

        if (templateMatch && suggestions.confidence < 0.8) {
          suggestions.category = suggestions.category || templateMatch.category;
          suggestions.amount = suggestions.amount || templateMatch.amount;
          suggestions.account_id = suggestions.account_id || templateMatch.account_id;
          suggestions.debt_account_id =
            suggestions.debt_account_id || templateMatch.debt_account_id;
          suggestions.confidence = Math.max(suggestions.confidence, 0.7);
          suggestions.source = 'template_match';
          suggestions.templateId = templateMatch.id;
          suggestions.templateName = templateMatch.name;
        }
      }

      // Cap confidence at 1.0
      suggestions.confidence = Math.min(suggestions.confidence, 1.0);

      debug.log('Smart defaults generated:', suggestions);
      return suggestions;
    } catch (error) {
      debug.error('Failed to get smart defaults', error);
      return {
        category: null,
        amount: null,
        account_id: null,
        debt_account_id: null,
        confidence: 0,
        source: 'error',
      };
    }
  }

  /**
   * Analyze patterns in a set of transactions
   * @param {Array} transactions - Array of transactions to analyze
   * @returns {Object} Pattern analysis results
   */
  analyzeTransactionPatterns(transactions) {
    if (!transactions || transactions.length === 0) {
      return {};
    }

    // Category frequency
    const categoryCount = new Map();
    transactions.forEach(t => {
      if (t.category) {
        categoryCount.set(t.category, (categoryCount.get(t.category) || 0) + 1);
      }
    });

    // Account frequency
    const accountCount = new Map();
    transactions.forEach(t => {
      if (t.account_id) {
        accountCount.set(t.account_id, (accountCount.get(t.account_id) || 0) + 1);
      }
    });

    // Amount statistics
    const amounts = transactions.map(t => Math.abs(t.amount)).filter(a => a > 0);

    const averageAmount =
      amounts.length > 0
        ? Math.round((amounts.reduce((sum, a) => sum + a, 0) / amounts.length) * 100) / 100
        : null;

    // Most common values
    const mostCommonCategory =
      categoryCount.size > 0
        ? Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    const mostCommonAccount =
      accountCount.size > 0
        ? Array.from(accountCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
        : null;

    return {
      mostCommonCategory,
      mostCommonAccount,
      averageAmount,
      transactionCount: transactions.length,
      categoryCount: categoryCount.size,
      accountCount: accountCount.size,
    };
  }

  /**
   * Learn from user corrections to improve future suggestions
   * @param {Object} suggested - What was suggested
   * @param {Object} actual - What the user actually chose
   * @returns {Promise<void>}
   */
  async learnFromCorrection(suggested, actual) {
    try {
      // This could be extended to store correction patterns
      // For now, just log for analysis
      debug.log('User correction recorded:', {
        suggested,
        actual,
        timestamp: new Date().toISOString(),
      });

      // Could store this in a learning table for future ML features
      // await database.addTransactionCorrection({ suggested, actual });
    } catch (error) {
      debug.error('Failed to record correction', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get merchant suggestions based on description
   * @param {string} partialDescription - Partial merchant name
   * @returns {Promise<Array>} Array of merchant suggestions
   */
  async getMerchantSuggestions(partialDescription) {
    try {
      if (!partialDescription || partialDescription.length < 2) {
        return [];
      }

      const recentTransactions = await database.getTransactions();

      // Extract unique descriptions that match
      const merchants = new Set();

      recentTransactions.forEach(t => {
        if (
          t.description &&
          t.description.toLowerCase().includes(partialDescription.toLowerCase())
        ) {
          merchants.add(t.description);
        }
      });

      // Sort by relevance (exact starts with first, then contains)
      const suggestions = Array.from(merchants)
        .sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(partialDescription.toLowerCase());
          const bStarts = b.toLowerCase().startsWith(partialDescription.toLowerCase());

          if (aStarts && !bStarts) {
            return -1;
          }
          if (!aStarts && bStarts) {
            return 1;
          }
          return a.localeCompare(b);
        })
        .slice(0, 10); // Limit to 10 suggestions

      return suggestions;
    } catch (error) {
      debug.error('Failed to get merchant suggestions', error);
      return [];
    }
  }

  /**
   * Advanced search for transactions with multiple filter options
   * @param {Object} filters - Search filters
   * @param {string} filters.searchText - Text to search in description/notes
   * @param {Date} filters.startDate - Start date for date range
   * @param {Date} filters.endDate - End date for date range
   * @param {number} filters.minAmount - Minimum transaction amount
   * @param {number} filters.maxAmount - Maximum transaction amount
   * @param {Array<string>} filters.categories - Array of categories to include
   * @param {Array<string>} filters.accounts - Array of account IDs to include
   * @param {string} filters.type - Transaction type ('income', 'expense', 'all')
   * @param {string} filters.sortBy - Sort field ('date', 'amount', 'description')
   * @param {string} filters.sortOrder - Sort order ('asc', 'desc')
   * @param {number} filters.limit - Maximum results to return
   * @param {number} filters.offset - Results offset for pagination
   * @returns {Promise<Object>} Search results with transactions and metadata
   */
  async searchTransactions(filters = {}) {
    try {
      // Check cache first
      const cacheKey = this.getSearchCacheKey('filters', filters);
      const cached = this.getCachedSearchResults(cacheKey);
      if (cached) {
        return cached;
      }

      const startTime = Date.now();

      // Extract and validate filters
      const {
        searchText = '',
        startDate = null,
        endDate = null,
        minAmount = null,
        maxAmount = null,
        categories = [],
        accounts = [],
        type = 'all',
        sortBy = 'date',
        sortOrder = 'desc',
        limit = 100,
        offset = 0,
      } = filters;

      debug.log('Searching transactions with filters:', filters);

      // Get all transactions (we'll filter in memory for now)
      // In a production app, this would be done at the database level
      const allTransactions = await database.getTransactions();

      // Apply filters
      const filtered = allTransactions.filter(transaction => {
        // Text search
        if (searchText) {
          const searchLower = searchText.toLowerCase();
          const descMatch = transaction.description?.toLowerCase().includes(searchLower);
          const notesMatch = transaction.notes?.toLowerCase().includes(searchLower);
          const categoryMatch = transaction.category?.toLowerCase().includes(searchLower);

          if (!descMatch && !notesMatch && !categoryMatch) {
            return false;
          }
        }

        // Date range filter
        if (startDate && new Date(transaction.date) < startDate) {
          return false;
        }
        if (endDate && new Date(transaction.date) > endDate) {
          return false;
        }

        // Amount range filter
        const amount = Math.abs(parseFloat(transaction.amount));
        if (minAmount !== null && amount < minAmount) {
          return false;
        }
        if (maxAmount !== null && amount > maxAmount) {
          return false;
        }

        // Category filter
        if (categories.length > 0 && !categories.includes(transaction.category)) {
          return false;
        }

        // Account filter
        if (accounts.length > 0) {
          const accountMatch =
            accounts.includes(transaction.account_id) ||
            accounts.includes(transaction.from_account_id) ||
            accounts.includes(transaction.to_account_id);
          if (!accountMatch) {
            return false;
          }
        }

        // Type filter
        if (type !== 'all') {
          const isIncome = parseFloat(transaction.amount) > 0;
          if (type === 'income' && !isIncome) {
            return false;
          }
          if (type === 'expense' && isIncome) {
            return false;
          }
        }

        return true;
      });

      // Sort results
      filtered.sort((a, b) => {
        let compareValue = 0;

        switch (sortBy) {
          case 'amount':
            compareValue = Math.abs(parseFloat(a.amount)) - Math.abs(parseFloat(b.amount));
            break;
          case 'description':
            compareValue = (a.description || '').localeCompare(b.description || '');
            break;
          case 'date':
          default:
            compareValue = new Date(a.date) - new Date(b.date);
            break;
        }

        return sortOrder === 'asc' ? compareValue : -compareValue;
      });

      // Calculate totals before pagination
      const totalCount = filtered.length;
      const totalAmount = filtered.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalIncome = filtered
        .filter(t => parseFloat(t.amount) > 0)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalExpense = filtered
        .filter(t => parseFloat(t.amount) < 0)
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      // Apply pagination
      const paginated = filtered.slice(offset, offset + limit);

      // Prepare results
      const results = {
        transactions: paginated,
        metadata: {
          totalCount,
          returnedCount: paginated.length,
          offset,
          limit,
          totalAmount,
          totalIncome,
          totalExpense,
          searchTime: Date.now() - startTime,
          filters,
        },
      };

      debug.log(
        `Search completed: ${paginated.length} of ${totalCount} results in ${results.metadata.searchTime}ms`
      );

      // Add to search history
      this.addToSearchHistory('filters', filters, totalCount);

      // Cache results
      this.cacheSearchResults(cacheKey, results);

      return results;
    } catch (error) {
      debug.error('Transaction search failed', error);
      throw error;
    }
  }

  /**
   * Full-text search across transaction descriptions and notes
   * @param {string} searchText - Text to search for
   * @param {Object} options - Search options
   * @param {boolean} options.fuzzy - Enable fuzzy matching
   * @param {boolean} options.highlight - Add highlighting to matches
   * @param {number} options.limit - Maximum results
   * @returns {Promise<Array>} Array of matching transactions with relevance scores
   */
  async searchByDescription(searchText, options = {}) {
    try {
      // Check cache first
      const cacheKey = this.getSearchCacheKey('text', { searchText, options });
      const cached = this.getCachedSearchResults(cacheKey);
      if (cached) {
        return cached;
      }

      const { fuzzy = true, highlight = true, limit = 50 } = options;

      if (!searchText || searchText.trim().length === 0) {
        return [];
      }

      const searchLower = searchText.toLowerCase().trim();
      const searchTerms = searchLower.split(/\s+/);

      // Get all transactions
      const transactions = await database.getTransactions();

      // Score and filter transactions
      const scored = transactions
        .map(transaction => {
          let score = 0;
          const matches = {
            description: [],
            notes: [],
            category: [],
          };

          // Check description
          if (transaction.description) {
            const descLower = transaction.description.toLowerCase();
            searchTerms.forEach(term => {
              if (descLower.includes(term)) {
                score += 10;
                matches.description.push(term);
              } else if (fuzzy && this.fuzzyMatch(term, descLower)) {
                score += 5;
                matches.description.push(term);
              }
            });
          }

          // Check notes
          if (transaction.notes) {
            const notesLower = transaction.notes.toLowerCase();
            searchTerms.forEach(term => {
              if (notesLower.includes(term)) {
                score += 7;
                matches.notes.push(term);
              } else if (fuzzy && this.fuzzyMatch(term, notesLower)) {
                score += 3;
                matches.notes.push(term);
              }
            });
          }

          // Check category
          if (transaction.category) {
            const categoryLower = transaction.category.toLowerCase();
            searchTerms.forEach(term => {
              if (categoryLower.includes(term)) {
                score += 5;
                matches.category.push(term);
              }
            });
          }

          // Bonus for exact matches
          if (transaction.description?.toLowerCase() === searchLower) {
            score += 20;
          }

          return {
            ...transaction,
            _score: score,
            _matches: matches,
            _highlighted: highlight ? this.highlightMatches(transaction, searchTerms) : null,
          };
        })
        .filter(t => t._score > 0)
        .sort((a, b) => b._score - a._score)
        .slice(0, limit);

      debug.log(`Description search found ${scored.length} matches for "${searchText}"`);

      // Add to search history
      this.addToSearchHistory('text', { searchText, options }, scored.length);

      // Cache results
      this.cacheSearchResults(cacheKey, scored);

      return scored;
    } catch (error) {
      debug.error('Description search failed', error);
      throw error;
    }
  }

  /**
   * Simple fuzzy matching helper
   * @private
   */
  fuzzyMatch(needle, haystack) {
    const hlen = haystack.length;
    const nlen = needle.length;

    if (nlen > hlen) {
      return false;
    }

    if (nlen === hlen) {
      return needle === haystack;
    }

    outer: for (let i = 0, j = 0; i < nlen; i++) {
      const nch = needle.charCodeAt(i);
      while (j < hlen) {
        if (haystack.charCodeAt(j++) === nch) {
          continue outer;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Highlight search matches in transaction fields
   * @private
   */
  highlightMatches(transaction, searchTerms) {
    const highlighted = {};

    ['description', 'notes', 'category'].forEach(field => {
      if (transaction[field]) {
        let text = transaction[field];
        searchTerms.forEach(term => {
          const regex = new RegExp(`(${term})`, 'gi');
          text = text.replace(regex, '**$1**');
        });
        highlighted[field] = text;
      }
    });

    return highlighted;
  }

  /**
   * Search with complex query object supporting AND/OR conditions
   * @param {Object} query - Complex query object
   * @param {Array} query.and - Array of conditions that must all match (AND)
   * @param {Array} query.or - Array of conditions where at least one must match (OR)
   * @param {Object} query.not - Conditions that must NOT match
   * @param {string} query.sortBy - Sort field
   * @param {string} query.sortOrder - Sort order
   * @param {number} query.limit - Result limit
   * @returns {Promise<Array>} Matching transactions
   *
   * @example
   * searchWithQuery({
   *   and: [
   *     { field: 'category', operator: 'equals', value: 'Food' },
   *     { field: 'amount', operator: 'between', value: [10, 50] }
   *   ],
   *   or: [
   *     { field: 'description', operator: 'contains', value: 'coffee' },
   *     { field: 'description', operator: 'contains', value: 'lunch' }
   *   ]
   * })
   */
  async searchWithQuery(query) {
    try {
      // Check cache first
      const cacheKey = this.getSearchCacheKey('query', query);
      const cached = this.getCachedSearchResults(cacheKey);
      if (cached) {
        return cached;
      }

      const {
        and = [],
        or = [],
        not = null,
        sortBy = 'date',
        sortOrder = 'desc',
        limit = 100,
      } = query;

      debug.log('Executing complex query:', query);

      // Get all transactions
      const transactions = await database.getTransactions();

      // Filter transactions based on complex conditions
      const filtered = transactions.filter(transaction => {
        // Check AND conditions - all must match
        const andMatch =
          and.length === 0 ||
          and.every(condition => this.evaluateCondition(transaction, condition));

        // Check OR conditions - at least one must match
        const orMatch =
          or.length === 0 || or.some(condition => this.evaluateCondition(transaction, condition));

        // Check NOT conditions - none must match
        const notMatch = !not || !this.evaluateCondition(transaction, not);

        return andMatch && orMatch && notMatch;
      });

      // Sort results
      filtered.sort((a, b) => {
        let compareValue = 0;

        switch (sortBy) {
          case 'amount':
            compareValue = Math.abs(parseFloat(a.amount)) - Math.abs(parseFloat(b.amount));
            break;
          case 'description':
            compareValue = (a.description || '').localeCompare(b.description || '');
            break;
          case 'date':
          default:
            compareValue = new Date(a.date) - new Date(b.date);
            break;
        }

        return sortOrder === 'asc' ? compareValue : -compareValue;
      });

      // Apply limit
      const results = filtered.slice(0, limit);

      debug.log(`Complex query found ${results.length} results`);

      // Add to search history
      this.addToSearchHistory('query', query, results.length);

      // Cache results
      this.cacheSearchResults(cacheKey, results);

      return results;
    } catch (error) {
      debug.error('Complex query failed', error);
      throw error;
    }
  }

  /**
   * Evaluate a single condition against a transaction
   * @private
   */
  evaluateCondition(transaction, condition) {
    const { field, operator, value } = condition;

    // Get the field value from the transaction
    let fieldValue = transaction[field];

    // Handle special fields
    if (field === 'amount') {
      fieldValue = parseFloat(fieldValue);
    } else if (field === 'date') {
      fieldValue = new Date(fieldValue);
    }

    // Evaluate based on operator
    switch (operator) {
      case 'equals':
      case '=':
        return fieldValue === value;

      case 'notEquals':
      case '!=':
        return fieldValue !== value;

      case 'contains':
        return (
          fieldValue &&
          typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().includes(value.toLowerCase())
        );

      case 'notContains':
        return (
          !fieldValue ||
          typeof fieldValue !== 'string' ||
          !fieldValue.toLowerCase().includes(value.toLowerCase())
        );

      case 'startsWith':
        return (
          fieldValue &&
          typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().startsWith(value.toLowerCase())
        );

      case 'endsWith':
        return (
          fieldValue &&
          typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().endsWith(value.toLowerCase())
        );

      case 'greaterThan':
      case '>':
        return fieldValue > value;

      case 'greaterThanOrEqual':
      case '>=':
        return fieldValue >= value;

      case 'lessThan':
      case '<':
        return fieldValue < value;

      case 'lessThanOrEqual':
      case '<=':
        return fieldValue <= value;

      case 'between':
        return (
          Array.isArray(value) &&
          value.length === 2 &&
          fieldValue >= value[0] &&
          fieldValue <= value[1]
        );

      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);

      case 'notIn':
        return !Array.isArray(value) || !value.includes(fieldValue);

      case 'isNull':
        return fieldValue === null || fieldValue === undefined;

      case 'isNotNull':
        return fieldValue !== null && fieldValue !== undefined;

      case 'isEmpty':
        return !fieldValue || fieldValue === '';

      case 'isNotEmpty':
        return fieldValue && fieldValue !== '';

      case 'regex':
        try {
          const regex = new RegExp(value, 'i');
          return regex.test(fieldValue);
        } catch {
          return false;
        }

      default:
        debug.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Save a search for future use
   * @param {Object} search - Search to save
   * @param {string} search.name - Name for the saved search
   * @param {string} search.description - Description of the search
   * @param {Object} search.filters - Search filters (for searchTransactions)
   * @param {Object} search.query - Complex query (for searchWithQuery)
   * @param {string} search.type - Type of search ('filters' or 'query')
   * @returns {Promise<Object>} Saved search object
   */
  async saveSearch(search) {
    try {
      const { name, description = '', filters = null, query = null, type = 'filters' } = search;

      if (!name) {
        throw new Error('Search name is required');
      }

      if (!filters && !query) {
        throw new Error('Either filters or query must be provided');
      }

      const savedSearch = {
        id: Date.now().toString(),
        name,
        description,
        type,
        filters,
        query,
        created_at: new Date().toISOString(),
        last_used: null,
        use_count: 0,
      };

      // Get existing saved searches
      const savedSearches = await this.getSavedSearches();

      // Check for duplicate names
      if (savedSearches.some(s => s.name === name)) {
        throw new Error(`A search with name "${name}" already exists`);
      }

      // Add new search
      savedSearches.push(savedSearch);

      // Save to localStorage (in production, this would go to database)
      localStorage.setItem('saved_searches', JSON.stringify(savedSearches));

      debug.log(`Saved search: ${name}`);

      // Emit event
      this.queueEvent('search:saved', { search: savedSearch });

      return savedSearch;
    } catch (error) {
      debug.error('Failed to save search', error);
      throw error;
    }
  }

  /**
   * Get all saved searches
   * @returns {Promise<Array>} Array of saved searches
   */
  async getSavedSearches() {
    try {
      const savedSearchesJson = localStorage.getItem('saved_searches');
      const savedSearches = savedSearchesJson ? JSON.parse(savedSearchesJson) : [];

      // Sort by most recently used
      savedSearches.sort((a, b) => {
        if (!a.last_used && !b.last_used) {
          return 0;
        }
        if (!a.last_used) {
          return 1;
        }
        if (!b.last_used) {
          return -1;
        }
        return new Date(b.last_used) - new Date(a.last_used);
      });

      return savedSearches;
    } catch (error) {
      debug.error('Failed to get saved searches', error);
      return [];
    }
  }

  /**
   * Run a saved search by ID
   * @param {string} searchId - ID of the saved search
   * @returns {Promise<Object|Array>} Search results
   */
  async runSavedSearch(searchId) {
    try {
      const savedSearches = await this.getSavedSearches();
      const savedSearch = savedSearches.find(s => s.id === searchId);

      if (!savedSearch) {
        throw new Error(`Saved search with ID ${searchId} not found`);
      }

      // Update usage stats
      savedSearch.last_used = new Date().toISOString();
      savedSearch.use_count++;

      // Save updated stats
      localStorage.setItem('saved_searches', JSON.stringify(savedSearches));

      debug.log(`Running saved search: ${savedSearch.name}`);

      // Run the appropriate search
      if (savedSearch.type === 'query' && savedSearch.query) {
        return await this.searchWithQuery(savedSearch.query);
      } else if (savedSearch.filters) {
        return await this.searchTransactions(savedSearch.filters);
      } else {
        throw new Error('Invalid saved search format');
      }
    } catch (error) {
      debug.error('Failed to run saved search', error);
      throw error;
    }
  }

  /**
   * Delete a saved search
   * @param {string} searchId - ID of the search to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteSavedSearch(searchId) {
    try {
      const savedSearches = await this.getSavedSearches();
      const index = savedSearches.findIndex(s => s.id === searchId);

      if (index === -1) {
        throw new Error(`Saved search with ID ${searchId} not found`);
      }

      const deletedSearch = savedSearches.splice(index, 1)[0];

      // Save updated list
      localStorage.setItem('saved_searches', JSON.stringify(savedSearches));

      debug.log(`Deleted saved search: ${deletedSearch.name}`);

      // Emit event
      this.queueEvent('search:deleted', { search: deletedSearch });

      return true;
    } catch (error) {
      debug.error('Failed to delete saved search', error);
      throw error;
    }
  }

  /**
   * Get search history (last N searches)
   * @param {number} limit - Number of searches to return
   * @returns {Promise<Array>} Recent search history
   */
  async getSearchHistory(limit = 10) {
    try {
      const historyJson = localStorage.getItem('search_history');
      const history = historyJson ? JSON.parse(historyJson) : [];

      return history.slice(0, limit);
    } catch (error) {
      debug.error('Failed to get search history', error);
      return [];
    }
  }

  /**
   * Add a search to history
   * @private
   */
  async addToSearchHistory(searchType, params, resultCount) {
    try {
      const history = await this.getSearchHistory(50);

      const historyEntry = {
        id: Date.now().toString(),
        type: searchType,
        params,
        resultCount,
        timestamp: new Date().toISOString(),
      };

      // Add to beginning
      history.unshift(historyEntry);

      // Keep only last 50
      if (history.length > 50) {
        history.pop();
      }

      localStorage.setItem('search_history', JSON.stringify(history));
    } catch (error) {
      debug.error('Failed to add to search history', error);
      // Don't throw - this is not critical
    }
  }

  // ===============================================
  // PHASE 4: ANALYTICS & INSIGHTS
  // ===============================================

  /**
   * Get spending trends over time with various grouping options
   * @param {Object} options - Analysis options
   * @param {number} options.months - Number of months to analyze (default: 12)
   * @param {Array<string>} options.categories - Filter by specific categories
   * @param {string} options.groupBy - Group by 'month', 'category', or 'merchant'
   * @param {boolean} options.includeIncome - Include income in analysis
   * @returns {Promise<Object>} Trend analysis results
   */
  async getSpendingTrends(options = {}) {
    try {
      const startTime = Date.now();
      const { months = 12, categories = [], groupBy = 'month', includeIncome = false } = options;

      // Check analytics cache first
      const cacheKey = `spending_trends_${months}_${groupBy}_${includeIncome}_${categories.join(',')}`;
      const cached = await this.getAnalyticsFromCache(cacheKey);
      if (cached) {
        debug.log('Analytics cache hit for spending trends');
        return cached;
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get transactions in date range
      const transactions = await database.getTransactions();
      const filtered = transactions.filter(t => {
        const tDate = new Date(t.date);
        const isInRange = tDate >= startDate && tDate <= endDate;
        const isExpense = parseFloat(t.amount) < 0 || t.debt_account_id;
        const isIncome = parseFloat(t.amount) > 0 && !t.debt_account_id;
        const includeTransaction = includeIncome ? true : isExpense;
        const categoryMatch = categories.length === 0 || categories.includes(t.category);

        return isInRange && includeTransaction && categoryMatch;
      });

      // Group transactions based on groupBy parameter
      const grouped = this.groupTransactionsForTrends(filtered, groupBy);

      // Calculate trends
      const trends = this.calculateTrends(grouped, groupBy);

      // Calculate summary statistics
      const summary = {
        totalSpending: filtered
          .filter(t => parseFloat(t.amount) < 0 || t.debt_account_id)
          .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0),
        totalIncome: includeIncome
          ? filtered
              .filter(t => parseFloat(t.amount) > 0 && !t.debt_account_id)
              .reduce((sum, t) => sum + parseFloat(t.amount), 0)
          : 0,
        averageMonthlySpending: 0,
        trendDirection: 'stable',
        percentageChange: 0,
      };

      // Calculate monthly average
      const monthlyTotals = Object.values(grouped).map(group =>
        group.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0)
      );
      summary.averageMonthlySpending =
        monthlyTotals.length > 0
          ? monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length
          : 0;

      // Determine trend direction
      if (monthlyTotals.length >= 2) {
        const firstHalf = monthlyTotals.slice(0, Math.floor(monthlyTotals.length / 2));
        const secondHalf = monthlyTotals.slice(Math.floor(monthlyTotals.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        summary.percentageChange = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
        summary.trendDirection =
          summary.percentageChange > 5
            ? 'increasing'
            : summary.percentageChange < -5
              ? 'decreasing'
              : 'stable';
      }

      const result = {
        data: trends,
        summary,
        metadata: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          transactionCount: filtered.length,
          groupBy,
          analysisTime: Date.now() - startTime,
        },
      };

      // Cache the results
      await this.cacheAnalyticsResult(cacheKey, result, 3600); // 1 hour TTL

      return result;
    } catch (error) {
      debug.error('Failed to get spending trends', error);
      throw error;
    }
  }

  /**
   * Get category-specific spending trends
   * @param {string} categoryName - Category to analyze
   * @param {number} months - Number of months to analyze
   * @returns {Promise<Object>} Category trend analysis
   */
  async getCategoryTrends(categoryName, months = 6) {
    try {
      // Use getSpendingTrends with category filter
      const trends = await this.getSpendingTrends({
        months,
        categories: [categoryName],
        groupBy: 'month',
      });

      // Add category-specific analysis
      const transactions = await database.getTransactions();
      const categoryTransactions = transactions.filter(
        t => t.category === categoryName && parseFloat(t.amount) < 0
      );

      // Calculate variance and standard deviation
      const amounts = categoryTransactions.map(t => Math.abs(parseFloat(t.amount)));
      const mean = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;

      const variance =
        amounts.length > 0
          ? amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) / amounts.length
          : 0;
      const stdDev = Math.sqrt(variance);

      // Find outliers (amounts > 2 standard deviations from mean)
      const outliers = categoryTransactions.filter(t => {
        const amount = Math.abs(parseFloat(t.amount));
        return Math.abs(amount - mean) > 2 * stdDev;
      });

      return {
        ...trends,
        statistics: {
          mean,
          median: this.calculateMedian(amounts),
          standardDeviation: stdDev,
          variance,
          outlierCount: outliers.length,
          outliers: outliers.slice(0, 10), // Return top 10 outliers
        },
      };
    } catch (error) {
      debug.error('Failed to get category trends', error);
      throw error;
    }
  }

  /**
   * Analyze spending by merchant/description patterns
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Merchant analysis results
   */
  async getMerchantAnalysis(options = {}) {
    try {
      const { months = 6, minTransactions = 2, limit = 20 } = options;

      // Check cache
      const cacheKey = `merchant_analysis_${months}_${minTransactions}_${limit}`;
      const cached = await this.getAnalyticsFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Get transactions
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const transactions = await database.getTransactions();
      const filtered = transactions.filter(t => {
        const tDate = new Date(t.date);
        return (
          tDate >= startDate && tDate <= endDate && (parseFloat(t.amount) < 0 || t.debt_account_id)
        );
      });

      // Group by merchant (description patterns)
      const merchantMap = new Map();

      filtered.forEach(t => {
        const description = (t.description || '').toLowerCase().trim();
        if (!description) {
          return;
        }

        // Extract merchant name (simple pattern matching)
        const merchantKey = this.extractMerchantName(description);

        if (!merchantMap.has(merchantKey)) {
          merchantMap.set(merchantKey, {
            merchant: merchantKey,
            transactions: [],
            totalAmount: 0,
            categories: new Set(),
            firstSeen: t.date,
            lastSeen: t.date,
          });
        }

        const merchant = merchantMap.get(merchantKey);
        merchant.transactions.push(t);
        merchant.totalAmount += Math.abs(parseFloat(t.amount));
        merchant.categories.add(t.category);

        if (new Date(t.date) < new Date(merchant.firstSeen)) {
          merchant.firstSeen = t.date;
        }
        if (new Date(t.date) > new Date(merchant.lastSeen)) {
          merchant.lastSeen = t.date;
        }
      });

      // Convert to array and filter by minimum transactions
      const merchants = Array.from(merchantMap.values())
        .filter(m => m.transactions.length >= minTransactions)
        .map(m => ({
          ...m,
          categories: Array.from(m.categories),
          averageAmount: m.totalAmount / m.transactions.length,
          frequency: m.transactions.length,
          daysSinceLastTransaction: Math.floor(
            (new Date() - new Date(m.lastSeen)) / (1000 * 60 * 60 * 24)
          ),
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, limit);

      const result = {
        merchants,
        summary: {
          uniqueMerchants: merchantMap.size,
          totalAnalyzed: filtered.length,
          topCategory: this.getMostCommonValue(merchants.flatMap(m => m.categories)),
        },
      };

      // Cache results
      await this.cacheAnalyticsResult(cacheKey, result, 3600);

      return result;
    } catch (error) {
      debug.error('Failed to get merchant analysis', error);
      throw error;
    }
  }

  /**
   * Helper method to group transactions for trend analysis
   * @private
   */
  groupTransactionsForTrends(transactions, groupBy) {
    const grouped = {};

    transactions.forEach(t => {
      let key;

      switch (groupBy) {
        case 'category':
          key = t.category || 'Uncategorized';
          break;
        case 'merchant':
          key = this.extractMerchantName(t.description || '');
          break;
        case 'month':
        default:
          const date = new Date(t.date);
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(t);
    });

    return grouped;
  }

  /**
   * Calculate trends from grouped data
   * @private
   */
  calculateTrends(grouped, groupBy) {
    const trends = [];

    Object.entries(grouped).forEach(([key, transactions]) => {
      const total = transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      trends.push({
        label: key,
        value: total,
        count: transactions.length,
        average: total / transactions.length,
      });
    });

    // Sort based on groupBy type
    if (groupBy === 'month') {
      trends.sort((a, b) => a.label.localeCompare(b.label));
    } else {
      trends.sort((a, b) => b.value - a.value);
    }

    return trends;
  }

  /**
   * Extract merchant name from transaction description
   * @private
   */
  extractMerchantName(description) {
    // Simple merchant extraction - can be enhanced
    const cleaned = description
      .toLowerCase()
      .replace(/\s+#\d+/, '') // Remove store numbers
      .replace(/\s+\d{2}\/\d{2}/, '') // Remove dates
      .replace(/\s+[a-z]{2}\s*$/, '') // Remove state codes
      .trim();

    // Take first 2-3 words as merchant identifier
    const words = cleaned.split(/\s+/).slice(0, 3);
    return words.join(' ');
  }

  /**
   * Calculate median of an array of numbers
   * @private
   */
  calculateMedian(numbers) {
    if (numbers.length === 0) {
      return 0;
    }

    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }

  /**
   * Get analytics from cache
   * @private
   */
  async getAnalyticsFromCache(key) {
    // Temporarily disable cache due to 406 errors
    return null;

    /* Commented out while cache is disabled
    try {
      // Sanitize the cache key to ensure it's URL-safe
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);

      const user = await database.getCurrentUserId();
      const { data, error } = await database.supabase
        .from('transaction_analytics_cache')
        .select('*')
        .eq('user_id', user)
        .eq('metric_type', sanitizedKey)
        .single();

      if (error) {
        // Cache miss is expected, not an error
        return null;
      }

      if (data && data.computed_data) {
        const age = (Date.now() - new Date(data.last_computed).getTime()) / 1000;
        if (age < data.ttl) {
          return data.computed_data;
        }
      }

      return null;
    } catch (error) {
      // Cache lookup failed
      return null;
    }
    */
  }

  /**
   * Cache analytics result
   * @private
   */
  async cacheAnalyticsResult(key, data, ttl = 3600) {
    // Temporarily disable cache due to 406 errors
    return;

    /* Commented out while cache is disabled
    try {
      // Sanitize the cache key to ensure it's URL-safe
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);

      const user = await database.getCurrentUserId();
      await database.supabase.from('transaction_analytics_cache').upsert({
        user_id: user,
        metric_type: sanitizedKey,
        date_range: { start: new Date().toISOString() },
        computed_data: data,
        ttl,
      });
    } catch (error) {
      // Cache write failed
      debug.error('Failed to cache analytics result', error);
    }
    */
  }

  /**
   * Get the most common value from an array
   * @private
   * @param {Array} arr - Array of values
   * @returns {*} Most common value or null
   */
  getMostCommonValue(arr) {
    if (!arr || arr.length === 0) {
      return null;
    }

    const frequency = {};
    let maxCount = 0;
    let mostCommon = null;

    arr.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
      if (frequency[item] > maxCount) {
        maxCount = frequency[item];
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  // ============================================================================
  // PHASE 4 - MILESTONE 2: ANOMALY DETECTION & PREDICTIVE ANALYTICS
  // ============================================================================

  /**
   * Detect anomalous transactions using statistical methods
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Anomalies with confidence scores
   */
  async detectAnomalies(options = {}) {
    const startTime = Date.now();
    debug.log('Detecting transaction anomalies', options);

    try {
      const {
        sensitivity = 'medium',
        categories = [],
        lookbackDays = 90,
        methods = ['zscore', 'iqr'],
        includePositive = true,
      } = options;

      // Get transactions for analysis
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const searchResult = await this.searchTransactions({
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        categories: categories.length > 0 ? categories : undefined,
      });

      const transactions = searchResult.transactions || [];

      if (transactions.length < 10) {
        return {
          anomalies: [],
          summary: {
            totalAnalyzed: transactions.length,
            anomaliesFound: 0,
            message: 'Insufficient data for anomaly detection',
          },
        };
      }

      // Calculate statistical measures by category
      const categoryStats = new Map();
      const overallAmounts = [];

      transactions.forEach(t => {
        const amount = Math.abs(t.amount);
        overallAmounts.push(amount);

        const category = t.category || 'Uncategorized';
        if (!categoryStats.has(category)) {
          categoryStats.set(category, []);
        }
        categoryStats.get(category).push(amount);
      });

      // Define sensitivity thresholds
      const sensitivityThresholds = {
        low: { zscore: 3, iqrMultiplier: 2.5 },
        medium: { zscore: 2.5, iqrMultiplier: 2 },
        high: { zscore: 2, iqrMultiplier: 1.5 },
      };
      const threshold = sensitivityThresholds[sensitivity];

      const anomalies = [];

      // Analyze each transaction
      for (const transaction of transactions) {
        const amount = Math.abs(transaction.amount);
        const category = transaction.category || 'Uncategorized';
        const categoryAmounts = categoryStats.get(category);

        let isAnomaly = false;
        const anomalyReasons = [];
        let confidenceScore = 0;

        // Method 1: Z-score detection
        if (methods.includes('zscore')) {
          // Use category-specific stats if enough data
          const amounts = categoryAmounts.length >= 5 ? categoryAmounts : overallAmounts;
          const stats = this.calculateStatistics(amounts);

          if (stats.stdDev > 0) {
            const zScore = Math.abs((amount - stats.mean) / stats.stdDev);
            if (zScore > threshold.zscore) {
              isAnomaly = true;
              anomalyReasons.push({
                method: 'z-score',
                score: zScore.toFixed(2),
                threshold: threshold.zscore,
              });
              confidenceScore += (zScore / threshold.zscore) * 0.5;
            }
          }
        }

        // Method 2: IQR detection
        if (methods.includes('iqr')) {
          const amounts = categoryAmounts.length >= 5 ? categoryAmounts : overallAmounts;
          const iqrStats = this.calculateIQR(amounts);

          const lowerBound = iqrStats.q1 - threshold.iqrMultiplier * iqrStats.iqr;
          const upperBound = iqrStats.q3 + threshold.iqrMultiplier * iqrStats.iqr;

          if (amount < lowerBound || amount > upperBound) {
            isAnomaly = true;
            const deviation =
              amount > upperBound
                ? (amount - upperBound) / iqrStats.iqr
                : (lowerBound - amount) / iqrStats.iqr;
            anomalyReasons.push({
              method: 'iqr',
              deviation: deviation.toFixed(2),
              bounds: {
                lower: lowerBound.toFixed(2),
                upper: upperBound.toFixed(2),
              },
            });
            confidenceScore += Math.min(deviation * 0.3, 0.5);
          }
        }

        // Method 3: Frequency-based detection
        if (transaction.description) {
          const merchant = this.extractMerchantName(transaction.description);
          const merchantTransactions = transactions.filter(
            t => t.description && this.extractMerchantName(t.description) === merchant
          );

          if (merchantTransactions.length >= 3) {
            const merchantAmounts = merchantTransactions.map(t => Math.abs(t.amount));
            const merchantStats = this.calculateStatistics(merchantAmounts);

            if (merchantStats.stdDev > 0) {
              const deviation = Math.abs(amount - merchantStats.mean) / merchantStats.mean;
              if (deviation > 0.5) {
                // 50% deviation from typical
                isAnomaly = true;
                anomalyReasons.push({
                  method: 'merchant-pattern',
                  typicalAmount: merchantStats.mean.toFixed(2),
                  deviation: `${(deviation * 100).toFixed(0)}%`,
                });
                confidenceScore += deviation * 0.2;
              }
            }
          }
        }

        // Skip positive transactions if not included
        if (!includePositive && transaction.amount > 0) {
          isAnomaly = false;
        }

        if (isAnomaly) {
          confidenceScore = Math.min(confidenceScore, 1); // Cap at 100%
          anomalies.push({
            transaction,
            confidence: confidenceScore,
            reasons: anomalyReasons,
            severity: confidenceScore > 0.7 ? 'high' : confidenceScore > 0.4 ? 'medium' : 'low',
          });
        }
      }

      // Sort by confidence score
      anomalies.sort((a, b) => b.confidence - a.confidence);

      const result = {
        anomalies: anomalies.slice(0, 50), // Limit to top 50
        summary: {
          totalAnalyzed: transactions.length,
          anomaliesFound: anomalies.length,
          sensitivity,
          methods,
          timeRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
          },
        },
        performance: {
          executionTime: Date.now() - startTime,
        },
      };

      return result;
    } catch (error) {
      debug.error('Failed to detect anomalies', error);
      throw error;
    }
  }

  /**
   * Get real-time spending alerts
   * @param {Object} options - Alert options
   * @returns {Promise<Object>} Active alerts
   */
  async getSpendingAlerts(options = {}) {
    const startTime = Date.now();
    debug.log('Getting spending alerts', options);

    try {
      const {
        includedAlertTypes = ['overspending', 'unusual_merchant', 'category_spike', 'velocity'],
        lookbackDays = 30,
        realtimeWindow = 7, // Days for recent activity
      } = options;

      const alerts = [];
      const now = new Date();

      // Get recent transactions for real-time analysis
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - realtimeWindow);

      const recentTransactions = await this.searchTransactions({
        dateRange: {
          start: recentDate.toISOString(),
          end: now.toISOString(),
        },
      });

      // Get historical data for comparison
      const historicalDate = new Date();
      historicalDate.setDate(historicalDate.getDate() - lookbackDays);

      const historicalTransactions = await this.searchTransactions({
        dateRange: {
          start: historicalDate.toISOString(),
          end: recentDate.toISOString(),
        },
      });

      // Alert Type 1: Overspending Detection
      if (includedAlertTypes.includes('overspending')) {
        const categorySpending = new Map();
        const historicalCategorySpending = new Map();

        // Calculate recent spending by category
        recentTransactions.forEach(t => {
          if (t.amount < 0) {
            const category = t.category || 'Uncategorized';
            categorySpending.set(
              category,
              (categorySpending.get(category) || 0) + Math.abs(t.amount)
            );
          }
        });

        // Calculate historical average
        historicalTransactions.forEach(t => {
          if (t.amount < 0) {
            const category = t.category || 'Uncategorized';
            historicalCategorySpending.set(
              category,
              (historicalCategorySpending.get(category) || 0) + Math.abs(t.amount)
            );
          }
        });

        // Compare and generate alerts
        const daysInHistorical = lookbackDays - realtimeWindow;
        categorySpending.forEach((amount, category) => {
          const historicalTotal = historicalCategorySpending.get(category) || 0;
          const historicalDaily = historicalTotal / daysInHistorical;
          const recentDaily = amount / realtimeWindow;

          if (historicalDaily > 0 && recentDaily > historicalDaily * 1.5) {
            alerts.push({
              type: 'overspending',
              severity: recentDaily > historicalDaily * 2 ? 'high' : 'medium',
              category,
              message: `Spending in ${category} is ${((recentDaily / historicalDaily - 1) * 100).toFixed(0)}% higher than usual`,
              details: {
                recentDailyAverage: recentDaily,
                historicalDailyAverage: historicalDaily,
                totalRecent: amount,
                increase: recentDaily - historicalDaily,
              },
              timestamp: now.toISOString(),
            });
          }
        });
      }

      // Alert Type 2: Unusual Merchant Detection
      if (includedAlertTypes.includes('unusual_merchant')) {
        const recentMerchants = new Set();
        const historicalMerchants = new Set();

        recentTransactions.forEach(t => {
          if (t.description) {
            const merchant = this.extractMerchantName(t.description);
            if (merchant) {
              recentMerchants.add(merchant);
            }
          }
        });

        historicalTransactions.forEach(t => {
          if (t.description) {
            const merchant = this.extractMerchantName(t.description);
            if (merchant) {
              historicalMerchants.add(merchant);
            }
          }
        });

        // Find new merchants
        const newMerchants = [];
        recentMerchants.forEach(merchant => {
          if (!historicalMerchants.has(merchant)) {
            const merchantTransactions = recentTransactions.filter(
              t => t.description && this.extractMerchantName(t.description) === merchant
            );
            const totalSpent = merchantTransactions.reduce(
              (sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0),
              0
            );

            if (totalSpent > 50) {
              // Only alert for significant amounts
              newMerchants.push({ merchant, totalSpent, count: merchantTransactions.length });
            }
          }
        });

        if (newMerchants.length > 0) {
          newMerchants.forEach(({ merchant, totalSpent, count }) => {
            alerts.push({
              type: 'unusual_merchant',
              severity: totalSpent > 200 ? 'high' : 'medium',
              merchant,
              message: `New merchant detected: ${merchant}`,
              details: {
                totalSpent,
                transactionCount: count,
                firstSeen: recentDate.toISOString(),
              },
              timestamp: now.toISOString(),
            });
          });
        }
      }

      // Alert Type 3: Category Spike Detection
      if (includedAlertTypes.includes('category_spike')) {
        const todayTransactions = recentTransactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate.toDateString() === now.toDateString();
        });

        const todayByCategory = new Map();
        todayTransactions.forEach(t => {
          if (t.amount < 0) {
            const category = t.category || 'Uncategorized';
            todayByCategory.set(
              category,
              (todayByCategory.get(category) || 0) + Math.abs(t.amount)
            );
          }
        });

        todayByCategory.forEach((amount, category) => {
          // Get typical daily spending for this category
          const categoryHistory = historicalTransactions.filter(
            t => t.category === category && t.amount < 0
          );
          const historicalTotal = categoryHistory.reduce((sum, t) => sum + Math.abs(t.amount), 0);
          const dailyAverage = historicalTotal / (lookbackDays - realtimeWindow);

          if (dailyAverage > 0 && amount > dailyAverage * 3) {
            alerts.push({
              type: 'category_spike',
              severity: 'high',
              category,
              message: `Unusual spike in ${category} spending today`,
              details: {
                todayTotal: amount,
                typicalDaily: dailyAverage,
                multiplier: (amount / dailyAverage).toFixed(1),
              },
              timestamp: now.toISOString(),
            });
          }
        });
      }

      // Alert Type 4: Velocity Detection (rapid spending)
      if (includedAlertTypes.includes('velocity')) {
        // Check last 24 hours
        const last24h = new Date();
        last24h.setDate(last24h.getDate() - 1);

        const last24hTransactions = recentTransactions.filter(
          t => new Date(t.date) >= last24h && t.amount < 0
        );

        if (last24hTransactions.length >= 10) {
          const total24h = last24hTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

          // Compare to typical daily spending
          const allExpenses = historicalTransactions.filter(t => t.amount < 0);
          const totalHistorical = allExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
          const dailyAverage = totalHistorical / (lookbackDays - realtimeWindow);

          if (total24h > dailyAverage * 2) {
            alerts.push({
              type: 'velocity',
              severity: 'high',
              message: 'Rapid spending detected in last 24 hours',
              details: {
                last24hTotal: total24h,
                transactionCount: last24hTransactions.length,
                typicalDaily: dailyAverage,
                multiplier: (total24h / dailyAverage).toFixed(1),
              },
              timestamp: now.toISOString(),
            });
          }
        }
      }

      // Sort alerts by severity
      const severityOrder = { high: 3, medium: 2, low: 1 };
      alerts.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

      return {
        alerts,
        summary: {
          totalAlerts: alerts.length,
          highSeverity: alerts.filter(a => a.severity === 'high').length,
          mediumSeverity: alerts.filter(a => a.severity === 'medium').length,
          lowSeverity: alerts.filter(a => a.severity === 'low').length,
        },
        performance: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      debug.error('Failed to get spending alerts', error);
      throw error;
    }
  }

  /**
   * Calculate basic statistics for an array of values
   * @private
   * @param {Array<number>} values - Array of numeric values
   * @returns {Object} Statistics including mean, stdDev, min, max
   */
  calculateStatistics(values) {
    if (!values || values.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };
    }

    const n = values.length;
    const mean = values.reduce((sum, val) => sum + val, 0) / n;

    // Calculate standard deviation
    const variance =
      values.reduce((sum, val) => {
        const diff = val - mean;
        return sum + diff * diff;
      }, 0) / n;

    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      count: n,
    };
  }

  // Removed duplicate calculateStatistics method

  /**
   * Calculate IQR (Interquartile Range) statistics
   * @private
   * @param {Array<number>} values - Array of numeric values
   * @returns {Object} IQR statistics
   */
  calculateIQR(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    return { q1, q3, iqr, median: sorted[Math.floor(n / 2)] };
  }

  /**
   * Predict monthly spending based on historical data
   * @param {Object} options - Prediction options
   * @returns {Promise<Object>} Spending predictions with confidence intervals
   */
  async predictMonthlySpending(options = {}) {
    const startTime = Date.now();
    debug.log('Predicting monthly spending', options);

    try {
      const {
        months = 3,
        categories = [],
        confidence = 0.95,
        lookbackMonths = 12,
        includeSeasonality = true,
      } = options;

      // Get historical transactions
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - lookbackMonths);

      const searchResult = await this.searchTransactions({
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        categories: categories.length > 0 ? categories : undefined,
      });

      const transactions = searchResult.transactions || [];

      if (transactions.length < 30) {
        return {
          predictions: [],
          summary: {
            message: 'Insufficient data for reliable predictions',
            dataPoints: transactions.length,
          },
        };
      }

      // Group by month and calculate monthly totals
      const monthlyData = new Map();
      const categoryMonthlyData = new Map();

      transactions.forEach(t => {
        const date = new Date(t.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const category = t.category || 'Uncategorized';

        // Overall monthly totals
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { income: 0, expenses: 0 });
        }

        if (t.amount > 0) {
          monthlyData.get(monthKey).income += t.amount;
        } else {
          monthlyData.get(monthKey).expenses += Math.abs(t.amount);
        }

        // Category-specific monthly totals
        if (categories.length === 0 || categories.includes(category)) {
          const catKey = `${category}-${monthKey}`;
          if (!categoryMonthlyData.has(catKey)) {
            categoryMonthlyData.set(catKey, { category, month: monthKey, amount: 0 });
          }
          categoryMonthlyData.get(catKey).amount += Math.abs(t.amount);
        }
      });

      // Convert to arrays and sort by month
      const monthlyArray = Array.from(monthlyData.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Calculate trends using linear regression
      const predictions = [];

      // Simple linear regression for expenses
      const expenseValues = monthlyArray.map(m => m.expenses);
      const expenseTrend = this.calculateLinearRegression(expenseValues);

      for (let i = 1; i <= months; i++) {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + i);
        const targetMonth = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

        // Apply seasonality adjustment if enabled
        let seasonalFactor = 1;
        if (includeSeasonality && monthlyArray.length >= 12) {
          const targetMonthIndex = targetDate.getMonth();
          const sameMonthData = monthlyArray.filter(
            (m, idx) => new Date(m.month).getMonth() === targetMonthIndex
          );

          if (sameMonthData.length > 0) {
            const avgSameMonth =
              sameMonthData.reduce((sum, m) => sum + m.expenses, 0) / sameMonthData.length;
            const overallAvg = expenseValues.reduce((sum, v) => sum + v, 0) / expenseValues.length;
            seasonalFactor = avgSameMonth / overallAvg;
          }
        }

        // Calculate prediction
        const baseProjection =
          expenseTrend.slope * (monthlyArray.length + i) + expenseTrend.intercept;
        const adjustedProjection = baseProjection * seasonalFactor;

        // Calculate confidence interval
        const stdError = this.calculateStandardError(expenseValues, expenseTrend);
        const tValue = this.getTValue(confidence, expenseValues.length - 2);
        const margin =
          tValue *
          stdError *
          Math.sqrt(
            1 +
              1 / expenseValues.length +
              Math.pow(i, 2) /
                expenseValues.reduce(
                  (sum, _, idx) => sum + Math.pow(idx - expenseValues.length / 2, 2),
                  0
                )
          );

        // Income prediction (simpler - use average)
        const avgIncome = monthlyArray.reduce((sum, m) => sum + m.income, 0) / monthlyArray.length;

        // Category predictions if requested
        const categoryPredictions = [];
        if (categories.length > 0) {
          categories.forEach(category => {
            const catData = Array.from(categoryMonthlyData.values())
              .filter(d => d.category === category)
              .sort((a, b) => a.month.localeCompare(b.month))
              .map(d => d.amount);

            if (catData.length >= 3) {
              const catTrend = this.calculateLinearRegression(catData);
              const catProjection = catTrend.slope * (catData.length + i) + catTrend.intercept;
              categoryPredictions.push({
                category,
                predicted: Math.max(0, catProjection),
                trend: catTrend.slope > 0 ? 'increasing' : 'decreasing',
              });
            }
          });
        }

        predictions.push({
          month: targetMonth,
          expenses: {
            predicted: Math.max(0, adjustedProjection),
            confidenceInterval: {
              lower: Math.max(0, adjustedProjection - margin),
              upper: adjustedProjection + margin,
            },
            seasonalAdjustment: (seasonalFactor - 1) * 100,
          },
          income: {
            predicted: avgIncome,
            confidence: 'Based on historical average',
          },
          netCashFlow: avgIncome - adjustedProjection,
          categories: categoryPredictions,
        });
      }

      // Calculate accuracy metrics based on historical data
      const accuracy = this.calculatePredictionAccuracy(monthlyArray);

      return {
        predictions,
        summary: {
          dataPoints: transactions.length,
          monthsAnalyzed: monthlyArray.length,
          confidence: confidence * 100,
          accuracy,
          trends: {
            expenses: expenseTrend.slope > 0 ? 'increasing' : 'decreasing',
            monthlyChange: expenseTrend.slope,
          },
        },
        performance: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      debug.error('Failed to predict monthly spending', error);
      throw error;
    }
  }

  /**
   * Forecast cash flow based on recurring bills and spending patterns
   * @param {number} days - Number of days to forecast
   * @returns {Promise<Object>} Daily balance projections
   */
  async getCashFlowForecast(days = 30) {
    const startTime = Date.now();
    debug.log(`Getting cash flow forecast for ${days} days`);

    try {
      // Get current cash balance
      const cashAccounts = await database.getCashAccounts();
      const currentBalance = cashAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

      // Get recurring bills
      const recurringBills = await database.getRecurringBills();
      const activeBills = recurringBills.filter(b => b.active !== false);

      // Get recent spending patterns (last 90 days)
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - 90);

      const recentTransactions = await this.searchTransactions({
        dateRange: {
          start: lookbackDate.toISOString(),
          end: new Date().toISOString(),
        },
      });

      // Calculate daily spending patterns by day of week
      const dailyPatterns = this.calculateDailySpendingPatterns(recentTransactions);

      // Get pay schedules
      const paySchedules = await database.getPaySchedules(true);

      // Build daily forecast
      const forecast = [];
      let runningBalance = currentBalance;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < days; i++) {
        const forecastDate = new Date(today);
        forecastDate.setDate(forecastDate.getDate() + i);

        const dayOfWeek = forecastDate.getDay();
        const dateStr = forecastDate.toISOString().split('T')[0];

        let dayIncome = 0;
        let dayExpenses = 0;
        const scheduledTransactions = [];

        // Check for scheduled income (pay schedules)
        paySchedules.forEach(schedule => {
          if (this.isPayday(forecastDate, schedule)) {
            dayIncome += schedule.amount;
            scheduledTransactions.push({
              type: 'income',
              description: schedule.name,
              amount: schedule.amount,
              category: 'Income',
            });
          }
        });

        // Check for scheduled bills
        activeBills.forEach(bill => {
          if (this.isBillDue(forecastDate, bill)) {
            dayExpenses += bill.amount;
            scheduledTransactions.push({
              type: 'bill',
              description: bill.name,
              amount: bill.amount,
              category: bill.category,
            });
          }
        });

        // Add predicted daily spending based on patterns
        const predictedSpending = dailyPatterns[dayOfWeek] || 0;
        dayExpenses += predictedSpending;

        // Calculate end of day balance
        runningBalance = runningBalance + dayIncome - dayExpenses;

        // Determine alerts
        const alerts = [];
        if (runningBalance < 0) {
          alerts.push({
            type: 'negative_balance',
            severity: 'high',
            message: 'Projected negative balance',
          });
        } else if (runningBalance < 500) {
          alerts.push({
            type: 'low_balance',
            severity: 'medium',
            message: 'Projected low balance',
          });
        }

        // Check for large scheduled transactions
        scheduledTransactions.forEach(trans => {
          if (trans.amount > runningBalance * 0.5 && trans.type === 'bill') {
            alerts.push({
              type: 'large_payment',
              severity: 'medium',
              message: `Large payment: ${trans.description}`,
            });
          }
        });

        forecast.push({
          date: dateStr,
          dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
            dayOfWeek
          ],
          startBalance: runningBalance - dayIncome + dayExpenses,
          income: dayIncome,
          expenses: dayExpenses,
          endBalance: runningBalance,
          scheduledTransactions,
          predictedSpending,
          alerts,
        });
      }

      // Calculate summary statistics
      const minBalance = Math.min(...forecast.map(f => f.endBalance));
      const criticalDates = forecast.filter(f => f.alerts.length > 0);
      const totalIncome = forecast.reduce((sum, f) => sum + f.income, 0);
      const totalExpenses = forecast.reduce((sum, f) => sum + f.expenses, 0);

      return {
        forecast,
        summary: {
          currentBalance,
          projectedBalance: runningBalance,
          minBalance,
          avgDailySpending: totalExpenses / days,
          totalIncome,
          totalExpenses,
          netChange: runningBalance - currentBalance,
          criticalDates: criticalDates.length,
          alerts: {
            negativeDays: forecast.filter(f => f.endBalance < 0).length,
            lowBalanceDays: forecast.filter(f => f.endBalance < 500).length,
          },
        },
        recommendations: this.generateCashFlowRecommendations(forecast, minBalance),
        performance: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      debug.error('Failed to get cash flow forecast', error);
      throw error;
    }
  }

  /**
   * Calculate linear regression for trend analysis
   * @private
   * @param {Array<number>} values - Y values (X is assumed to be indices)
   * @returns {Object} Slope and intercept
   */
  calculateLinearRegression(values) {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Calculate standard error for predictions
   * @private
   */
  calculateStandardError(actual, regression) {
    const predicted = actual.map((_, i) => regression.slope * i + regression.intercept);
    const residuals = actual.map((y, i) => y - predicted[i]);
    const sse = residuals.reduce((sum, r) => sum + r * r, 0);
    return Math.sqrt(sse / (actual.length - 2));
  }

  /**
   * Get t-value for confidence interval
   * @private
   */
  getTValue(confidence, df) {
    // Simplified t-table for common confidence levels
    const tTable = {
      0.9: { 10: 1.812, 20: 1.725, 30: 1.697, 50: 1.676 },
      0.95: { 10: 2.228, 20: 2.086, 30: 2.042, 50: 2.009 },
      0.99: { 10: 3.169, 20: 2.845, 30: 2.75, 50: 2.678 },
    };

    const conf = confidence >= 0.99 ? 0.99 : confidence >= 0.95 ? 0.95 : 0.9;
    const adjustedDf = df > 50 ? 50 : df > 30 ? 30 : df > 20 ? 20 : 10;

    return tTable[conf][adjustedDf] || 2.0;
  }

  /**
   * Calculate prediction accuracy based on historical data
   * @private
   */
  calculatePredictionAccuracy(monthlyData) {
    if (monthlyData.length < 6) {
      return null;
    }

    // Use first 75% for training, last 25% for testing
    const splitIndex = Math.floor(monthlyData.length * 0.75);
    const training = monthlyData.slice(0, splitIndex);
    const testing = monthlyData.slice(splitIndex);

    const expenseValues = training.map(m => m.expenses);
    const trend = this.calculateLinearRegression(expenseValues);

    let totalError = 0;
    testing.forEach((actual, i) => {
      const predicted = trend.slope * (training.length + i) + trend.intercept;
      const error = Math.abs(actual.expenses - predicted) / actual.expenses;
      totalError += error;
    });

    const mape = (totalError / testing.length) * 100;
    return {
      mape: mape.toFixed(1),
      accuracy: Math.max(0, 100 - mape).toFixed(1),
    };
  }

  /**
   * Calculate daily spending patterns
   * @private
   */
  calculateDailySpendingPatterns(transactions) {
    const patterns = Array(7).fill(0);
    const counts = Array(7).fill(0);

    transactions.forEach(t => {
      if (t.amount < 0) {
        const dayOfWeek = new Date(t.date).getDay();
        patterns[dayOfWeek] += Math.abs(t.amount);
        counts[dayOfWeek]++;
      }
    });

    return patterns.map((total, i) => (counts[i] > 0 ? total / counts[i] : 0));
  }

  /**
   * Check if date is a payday
   * @private
   */
  isPayday(date, schedule) {
    if (!schedule.is_active) {
      return false;
    }

    const nextPayDate = new Date(schedule.next_pay_date);
    return date.toDateString() === nextPayDate.toDateString();
  }

  /**
   * Check if bill is due
   * @private
   */
  isBillDue(date, bill) {
    if (!bill.active) {
      return false;
    }

    const nextDue = new Date(bill.next_due);
    return date.toDateString() === nextDue.toDateString();
  }

  /**
   * Generate cash flow recommendations
   * @private
   */
  generateCashFlowRecommendations(forecast, minBalance) {
    const recommendations = [];

    if (minBalance < 0) {
      const firstNegativeDay = forecast.find(f => f.endBalance < 0);
      recommendations.push({
        priority: 'high',
        type: 'negative_balance',
        message: `Projected negative balance on ${firstNegativeDay.date}`,
        action: 'Consider reducing expenses or moving payment dates',
      });
    }

    if (minBalance < 500 && minBalance >= 0) {
      recommendations.push({
        priority: 'medium',
        type: 'low_balance',
        message: 'Balance projected to drop below $500',
        action: 'Build emergency buffer or reduce discretionary spending',
      });
    }

    // Check for clustering of bills
    const highExpenseDays = forecast.filter(f => f.expenses > f.income * 2);
    if (highExpenseDays.length > 3) {
      recommendations.push({
        priority: 'medium',
        type: 'expense_clustering',
        message: 'Multiple high-expense days detected',
        action: 'Consider spreading out bill payment dates',
      });
    }

    return recommendations;
  }

  /**
   * Get comprehensive transaction insights
   * @returns {Promise<Object>} Transaction insights and patterns
   */
  async getTransactionInsights() {
    const startTime = Date.now();
    debug.log('Getting transaction insights');

    try {
      // Get transactions for last 6 months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);

      const searchResult = await this.searchTransactions({
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });

      const transactions = searchResult.transactions || [];

      if (transactions.length < 20) {
        return {
          insights: {
            message: 'Insufficient data for meaningful insights',
            dataPoints: transactions.length,
          },
        };
      }

      // Calculate spending velocity
      const now = new Date();
      const daysSinceStart = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
      const totalExpenses = transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      // Recent velocity (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentExpenses = transactions
        .filter(t => t.amount < 0 && new Date(t.date) >= thirtyDaysAgo)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const averageVelocity = totalExpenses / daysSinceStart;
      const recentVelocity = recentExpenses / 30;

      // Time patterns analysis
      const timePatterns = {
        byHour: Array(24).fill(0),
        byDayOfWeek: Array(7).fill(0),
        byDayOfMonth: Array(31).fill(0),
        counts: {
          byHour: Array(24).fill(0),
          byDayOfWeek: Array(7).fill(0),
          byDayOfMonth: Array(31).fill(0),
        },
      };

      transactions.forEach(t => {
        if (t.amount < 0) {
          const date = new Date(t.date);
          const hour = date.getHours();
          const dayOfWeek = date.getDay();
          const dayOfMonth = date.getDate() - 1; // 0-indexed

          timePatterns.byHour[hour] += Math.abs(t.amount);
          timePatterns.byDayOfWeek[dayOfWeek] += Math.abs(t.amount);
          timePatterns.byDayOfMonth[dayOfMonth] += Math.abs(t.amount);

          timePatterns.counts.byHour[hour]++;
          timePatterns.counts.byDayOfWeek[dayOfWeek]++;
          timePatterns.counts.byDayOfMonth[dayOfMonth]++;
        }
      });

      // Find peak times
      const peakHour = timePatterns.byHour.indexOf(Math.max(...timePatterns.byHour));
      const peakDayOfWeek = timePatterns.byDayOfWeek.indexOf(Math.max(...timePatterns.byDayOfWeek));
      const peakDayOfMonth =
        timePatterns.byDayOfMonth.indexOf(Math.max(...timePatterns.byDayOfMonth)) + 1;

      // Category distribution analysis
      const categoryDistribution = new Map();
      const categoryChanges = new Map();

      // Split into first and second half for trend analysis
      const midPoint = new Date(
        startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2
      );

      transactions.forEach(t => {
        if (t.amount < 0) {
          const category = t.category || 'Uncategorized';
          const amount = Math.abs(t.amount);

          if (!categoryDistribution.has(category)) {
            categoryDistribution.set(category, {
              total: 0,
              count: 0,
              firstHalf: 0,
              secondHalf: 0,
            });
          }

          const catData = categoryDistribution.get(category);
          catData.total += amount;
          catData.count++;

          if (new Date(t.date) < midPoint) {
            catData.firstHalf += amount;
          } else {
            catData.secondHalf += amount;
          }
        }
      });

      // Calculate category trends
      const categoryInsights = [];
      categoryDistribution.forEach((data, category) => {
        const percentOfTotal = (data.total / totalExpenses) * 100;
        const avgTransaction = data.total / data.count;
        const trend =
          data.secondHalf > data.firstHalf * 1.1
            ? 'increasing'
            : data.secondHalf < data.firstHalf * 0.9
              ? 'decreasing'
              : 'stable';

        categoryInsights.push({
          category,
          total: data.total,
          percentOfTotal,
          avgTransaction,
          count: data.count,
          trend,
          monthlyAverage: data.total / 6,
        });
      });

      // Sort by total spending
      categoryInsights.sort((a, b) => b.total - a.total);

      // Payment method analysis
      const paymentMethods = {
        cash: { count: 0, total: 0 },
        credit: { count: 0, total: 0 },
      };

      transactions.forEach(t => {
        if (t.debt_account_id) {
          paymentMethods.credit.count++;
          paymentMethods.credit.total += Math.abs(t.amount);
        } else {
          paymentMethods.cash.count++;
          paymentMethods.cash.total += Math.abs(t.amount);
        }
      });

      // Transaction size analysis
      const amounts = transactions
        .filter(t => t.amount < 0)
        .map(t => Math.abs(t.amount))
        .sort((a, b) => a - b);

      const sizeDistribution = {
        small: amounts.filter(a => a < 50).length,
        medium: amounts.filter(a => a >= 50 && a < 200).length,
        large: amounts.filter(a => a >= 200 && a < 500).length,
        veryLarge: amounts.filter(a => a >= 500).length,
      };

      // Merchant diversity
      const uniqueMerchants = new Set();
      const merchantFrequency = new Map();

      transactions.forEach(t => {
        if (t.description) {
          const merchant = this.extractMerchantName(t.description);
          if (merchant) {
            uniqueMerchants.add(merchant);
            merchantFrequency.set(merchant, (merchantFrequency.get(merchant) || 0) + 1);
          }
        }
      });

      // Find most frequent merchants
      const topMerchants = Array.from(merchantFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([merchant, count]) => ({ merchant, count }));

      return {
        insights: {
          spendingVelocity: {
            current: recentVelocity,
            average: averageVelocity,
            trend:
              recentVelocity > averageVelocity * 1.1
                ? 'increasing'
                : recentVelocity < averageVelocity * 0.9
                  ? 'decreasing'
                  : 'stable',
            percentChange: ((recentVelocity - averageVelocity) / averageVelocity) * 100,
          },
          timePatterns: {
            peakHour: {
              hour: peakHour,
              display: `${peakHour}:00 - ${peakHour + 1}:00`,
              avgSpending: timePatterns.byHour[peakHour] / timePatterns.counts.byHour[peakHour],
            },
            peakDayOfWeek: {
              day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
                peakDayOfWeek
              ],
              index: peakDayOfWeek,
              avgSpending:
                timePatterns.byDayOfWeek[peakDayOfWeek] /
                timePatterns.counts.byDayOfWeek[peakDayOfWeek],
            },
            peakDayOfMonth: {
              day: peakDayOfMonth,
              avgSpending:
                timePatterns.byDayOfMonth[peakDayOfMonth - 1] /
                timePatterns.counts.byDayOfMonth[peakDayOfMonth - 1],
            },
            weekendVsWeekday: {
              weekend:
                (timePatterns.byDayOfWeek[0] + timePatterns.byDayOfWeek[6]) /
                (timePatterns.counts.byDayOfWeek[0] + timePatterns.counts.byDayOfWeek[6]),
              weekday:
                (timePatterns.byDayOfWeek[1] +
                  timePatterns.byDayOfWeek[2] +
                  timePatterns.byDayOfWeek[3] +
                  timePatterns.byDayOfWeek[4] +
                  timePatterns.byDayOfWeek[5]) /
                (timePatterns.counts.byDayOfWeek[1] +
                  timePatterns.counts.byDayOfWeek[2] +
                  timePatterns.counts.byDayOfWeek[3] +
                  timePatterns.counts.byDayOfWeek[4] +
                  timePatterns.counts.byDayOfWeek[5]),
            },
          },
          categoryInsights: categoryInsights.slice(0, 10),
          paymentMethods: {
            cashPreference: (paymentMethods.cash.count / transactions.length) * 100,
            creditPreference: (paymentMethods.credit.count / transactions.length) * 100,
            avgCashTransaction: paymentMethods.cash.total / paymentMethods.cash.count,
            avgCreditTransaction: paymentMethods.credit.total / paymentMethods.credit.count,
          },
          transactionSizes: {
            distribution: sizeDistribution,
            median: amounts[Math.floor(amounts.length / 2)],
            average: totalExpenses / amounts.length,
          },
          merchantDiversity: {
            uniqueMerchants: uniqueMerchants.size,
            topMerchants,
            merchantsPerMonth: uniqueMerchants.size / 6,
          },
        },
        summary: {
          totalTransactions: transactions.length,
          totalExpenses,
          periodDays: daysSinceStart,
        },
        performance: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      debug.error('Failed to get transaction insights', error);
      throw error;
    }
  }

  /**
   * Get budget performance metrics
   * @param {Object} budgets - Budget configuration
   * @returns {Promise<Object>} Budget performance analysis
   */
  async getBudgetPerformance(budgets = {}) {
    const startTime = Date.now();
    debug.log('Getting budget performance', budgets);

    try {
      // Default budgets if not provided
      const defaultBudgets = {
        Food: 600,
        Transportation: 200,
        Shopping: 300,
        Entertainment: 150,
        Bills: 800,
        Healthcare: 100,
        Other: 200,
      };

      const activeBudgets = { ...defaultBudgets, ...budgets };

      // Get current month transactions
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const currentMonthTransactions = await this.searchTransactions({
        dateRange: {
          start: startOfMonth.toISOString(),
          end: now.toISOString(),
        },
      });

      // Get last 3 months for trend analysis
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const historicalTransactions = await this.searchTransactions({
        dateRange: {
          start: threeMonthsAgo.toISOString(),
          end: startOfMonth.toISOString(),
        },
      });

      // Calculate current month spending by category
      const currentSpending = new Map();
      currentMonthTransactions.forEach(t => {
        if (t.amount < 0) {
          const category = t.category || 'Other';
          currentSpending.set(category, (currentSpending.get(category) || 0) + Math.abs(t.amount));
        }
      });

      // Calculate historical average by category
      const historicalByMonth = new Map();
      historicalTransactions.forEach(t => {
        if (t.amount < 0) {
          const date = new Date(t.date);
          const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
          const category = t.category || 'Other';
          const key = `${monthKey}-${category}`;

          historicalByMonth.set(key, (historicalByMonth.get(key) || 0) + Math.abs(t.amount));
        }
      });

      // Calculate averages
      const categoryAverages = new Map();
      const monthsCount = 3;

      Object.keys(activeBudgets).forEach(category => {
        let total = 0;
        for (let i = 0; i < monthsCount; i++) {
          const checkDate = new Date(threeMonthsAgo);
          checkDate.setMonth(checkDate.getMonth() + i);
          const monthKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}`;
          const key = `${monthKey}-${category}`;
          total += historicalByMonth.get(key) || 0;
        }
        categoryAverages.set(category, total / monthsCount);
      });

      // Calculate days elapsed and remaining in month
      const daysInMonth = endOfMonth.getDate();
      const daysElapsed = now.getDate();
      const daysRemaining = daysInMonth - daysElapsed;
      const monthProgress = daysElapsed / daysInMonth;

      // Analyze each budget category
      const categoryPerformance = [];
      let totalBudget = 0;
      let totalSpent = 0;
      let totalProjected = 0;

      Object.entries(activeBudgets).forEach(([category, budget]) => {
        const spent = currentSpending.get(category) || 0;
        const dailyBudget = budget / daysInMonth;
        const expectedSpending = dailyBudget * daysElapsed;
        const projectedTotal = (spent / daysElapsed) * daysInMonth;
        const historicalAvg = categoryAverages.get(category) || 0;

        totalBudget += budget;
        totalSpent += spent;
        totalProjected += projectedTotal;

        // Determine status
        let status, statusMessage;
        const percentUsed = (spent / budget) * 100;
        const expectedPercent = monthProgress * 100;

        if (percentUsed > 100) {
          status = 'over_budget';
          statusMessage = `Over budget by ${formatCurrency(spent - budget)}`;
        } else if (percentUsed > expectedPercent + 10) {
          status = 'at_risk';
          statusMessage = 'Spending faster than planned';
        } else if (percentUsed < expectedPercent - 20) {
          status = 'under_budget';
          statusMessage = 'Well under budget';
        } else {
          status = 'on_track';
          statusMessage = 'On track';
        }

        // Calculate pace
        const dailyPace = spent / daysElapsed;
        const requiredPace = (budget - spent) / daysRemaining;

        categoryPerformance.push({
          category,
          budget,
          spent,
          remaining: Math.max(0, budget - spent),
          percentUsed,
          projectedTotal,
          status,
          statusMessage,
          pace: {
            current: dailyPace,
            required: Math.max(0, requiredPace),
            sustainable: requiredPace > 0,
          },
          vsHistorical: {
            average: historicalAvg,
            difference: spent - historicalAvg * monthProgress,
            trend:
              spent > historicalAvg * monthProgress * 1.1
                ? 'higher'
                : spent < historicalAvg * monthProgress * 0.9
                  ? 'lower'
                  : 'similar',
          },
        });
      });

      // Sort by percent used (highest first)
      categoryPerformance.sort((a, b) => b.percentUsed - a.percentUsed);

      // Generate recommendations
      const recommendations = [];

      // Over budget categories
      const overBudget = categoryPerformance.filter(c => c.status === 'over_budget');
      if (overBudget.length > 0) {
        recommendations.push({
          priority: 'high',
          type: 'over_budget',
          categories: overBudget.map(c => c.category),
          message: `${overBudget.length} categories are over budget`,
          action: 'Review and reduce spending in these categories immediately',
        });
      }

      // At risk categories
      const atRisk = categoryPerformance.filter(c => c.status === 'at_risk');
      if (atRisk.length > 0) {
        recommendations.push({
          priority: 'medium',
          type: 'at_risk',
          categories: atRisk.map(c => c.category),
          message: `${atRisk.length} categories at risk of going over budget`,
          action: 'Monitor closely and reduce spending pace',
        });
      }

      // Optimization opportunities
      const underutilized = categoryPerformance.filter(
        c => c.percentUsed < 50 && monthProgress > 0.7
      );
      if (underutilized.length > 0) {
        recommendations.push({
          priority: 'low',
          type: 'optimization',
          categories: underutilized.map(c => c.category),
          message: 'Some budgets are significantly underutilized',
          action: 'Consider reallocating funds to overspent categories',
        });
      }

      // Calculate overall metrics
      const overallStatus =
        totalProjected > totalBudget
          ? 'over_budget'
          : totalProjected > totalBudget * 0.9
            ? 'at_risk'
            : 'on_track';

      return {
        budgetPerformance: {
          categories: categoryPerformance,
          overall: {
            totalBudget,
            totalSpent,
            totalRemaining: totalBudget - totalSpent,
            percentUsed: (totalSpent / totalBudget) * 100,
            projectedTotal: totalProjected,
            projectedSurplus: totalBudget - totalProjected,
            status: overallStatus,
            daysRemaining,
            monthProgress: monthProgress * 100,
          },
          recommendations,
          insights: {
            biggestSpenders: categoryPerformance.slice(0, 3).map(c => ({
              category: c.category,
              spent: c.spent,
              percentOfTotal: (c.spent / totalSpent) * 100,
            })),
            mostOverBudget: overBudget.slice(0, 3),
            bestPerformers: categoryPerformance
              .filter(c => c.status === 'on_track' || c.status === 'under_budget')
              .slice(-3)
              .reverse(),
          },
        },
        summary: {
          month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
          daysInMonth,
          daysElapsed,
          categoriesTracked: categoryPerformance.length,
        },
        performance: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      debug.error('Failed to get budget performance', error);
      throw error;
    }
  }

  // ============================================================================
  // PHASE 4 - MILESTONE 3: PERFORMANCE OPTIMIZATION & INTEGRATION
  // ============================================================================

  /**
   * Get comprehensive performance metrics
   * @returns {Object} Performance metrics and statistics
   */
  getPerformanceMetrics() {
    const now = Date.now();

    // Calculate cache metrics
    const cacheStats = {
      size: this.cache.size,
      hitRate:
        this.metrics.cacheHits > 0
          ? (
              (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) *
              100
            ).toFixed(2)
          : 0,
      hits: this.metrics.cacheHits,
      misses: this.metrics.cacheMisses,
      evictions: 0, // Track when implementing LRU
    };

    // Calculate search cache metrics
    const searchCacheStats = {
      size: this.searchCache.size,
      maxSize: this.maxSearchCacheSize,
      utilizationPercent: ((this.searchCache.size / this.maxSearchCacheSize) * 100).toFixed(2),
    };

    // Operation metrics
    const operationStats = {
      totalOperations: this.metrics.operations,
      errorRate:
        this.metrics.operations > 0
          ? ((this.metrics.errors / this.metrics.operations) * 100).toFixed(2)
          : 0,
      rollbackRate:
        this.metrics.operations > 0
          ? ((this.metrics.rollbacks / this.metrics.operations) * 100).toFixed(2)
          : 0,
    };

    // Memory usage estimation
    const memoryStats = {
      cacheMemoryMB: this.estimateCacheMemory(),
      pendingOperations: this.pendingOperations.size,
      eventQueueSize: this.eventQueue.length,
      historySize: this.operationHistory.length,
    };

    // Performance optimization suggestions
    const suggestions = [];

    if (cacheStats.hitRate < 60) {
      suggestions.push({
        type: 'cache_optimization',
        message: 'Low cache hit rate detected. Consider increasing cache timeout.',
        impact: 'high',
      });
    }

    if (searchCacheStats.utilizationPercent > 90) {
      suggestions.push({
        type: 'search_cache',
        message: 'Search cache nearly full. Old entries will be evicted.',
        impact: 'medium',
      });
    }

    if (operationStats.errorRate > 5) {
      suggestions.push({
        type: 'error_rate',
        message: 'High error rate detected. Review error logs.',
        impact: 'high',
      });
    }

    if (memoryStats.pendingOperations > 10) {
      suggestions.push({
        type: 'pending_operations',
        message: 'Many pending operations. Ensure cleanup is running.',
        impact: 'medium',
      });
    }

    return {
      timestamp: now,
      cache: cacheStats,
      searchCache: searchCacheStats,
      operations: operationStats,
      memory: memoryStats,
      suggestions,
      uptime: {
        initialized: this.initialized,
        uptimeMs: this.initialized ? now - (this.initTime || now) : 0,
      },
    };
  }

  /**
   * Optimize performance based on usage patterns
   * @returns {Promise<Object>} Optimization results
   */
  async optimizePerformance() {
    debug.log('Running performance optimization');
    const startTime = Date.now();
    const actions = [];

    try {
      const metrics = this.getPerformanceMetrics();

      // 1. Cache optimization
      if (metrics.cache.hitRate < 60 && this.cacheTimeout < 10 * 60 * 1000) {
        this.cacheTimeout = Math.min(this.cacheTimeout * 1.5, 10 * 60 * 1000);
        actions.push({
          action: 'increased_cache_timeout',
          oldValue: this.cacheTimeout / 1.5,
          newValue: this.cacheTimeout,
        });
      }

      // 2. Search cache cleanup
      if (metrics.searchCache.utilizationPercent > 80) {
        const oldSize = this.searchCache.size;
        this.cleanupSearchCache(true); // Force cleanup
        actions.push({
          action: 'search_cache_cleanup',
          entriesRemoved: oldSize - this.searchCache.size,
        });
      }

      // 3. Pending operations cleanup
      if (metrics.memory.pendingOperations > 5) {
        const cleaned = this.cleanupPendingOperations();
        actions.push({
          action: 'pending_operations_cleanup',
          operationsCleaned: cleaned,
        });
      }

      // 4. History trimming
      if (this.operationHistory.length > this.maxHistorySize) {
        const trimmed = this.operationHistory.length - this.maxHistorySize;
        this.operationHistory = this.operationHistory.slice(-this.maxHistorySize);
        actions.push({
          action: 'history_trimmed',
          entriesRemoved: trimmed,
        });
      }

      // 5. Predictive cache warming for frequently accessed data
      await this.warmFrequentlyAccessedCache();

      return {
        success: true,
        actions,
        metrics: {
          before: metrics,
          after: this.getPerformanceMetrics(),
        },
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      debug.error('Performance optimization failed', error);
      return {
        success: false,
        error: error.message,
        actions,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get data quality report
   * @returns {Promise<Object>} Data quality analysis
   */
  async getDataQualityReport() {
    const startTime = Date.now();
    debug.log('Generating data quality report');

    try {
      // Get all transactions for analysis
      const allTransactions = await this.getAllTransactions();

      if (allTransactions.length === 0) {
        return {
          summary: {
            message: 'No transactions to analyze',
            totalTransactions: 0,
          },
        };
      }

      // Quality metrics
      const issues = [];
      const metrics = {
        totalTransactions: allTransactions.length,
        missingCategories: 0,
        uncategorized: 0,
        missingDescriptions: 0,
        potentialDuplicates: 0,
        invalidAmounts: 0,
        futureDated: 0,
        suspiciousDates: 0,
      };

      // Track patterns for duplicate detection
      const transactionPatterns = new Map();
      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Analyze each transaction
      allTransactions.forEach(transaction => {
        // Check for missing/invalid data
        if (!transaction.category) {
          metrics.missingCategories++;
          issues.push({
            type: 'missing_category',
            transactionId: transaction.id,
            severity: 'medium',
          });
        } else if (transaction.category === 'Uncategorized') {
          metrics.uncategorized++;
        }

        if (!transaction.description || transaction.description.trim() === '') {
          metrics.missingDescriptions++;
          issues.push({
            type: 'missing_description',
            transactionId: transaction.id,
            severity: 'low',
          });
        }

        if (transaction.amount === 0 || isNaN(transaction.amount)) {
          metrics.invalidAmounts++;
          issues.push({
            type: 'invalid_amount',
            transactionId: transaction.id,
            severity: 'high',
          });
        }

        // Date validation
        const transDate = new Date(transaction.date);
        if (transDate > today) {
          metrics.futureDated++;
          issues.push({
            type: 'future_date',
            transactionId: transaction.id,
            date: transaction.date,
            severity: 'medium',
          });
        }

        if (transDate < oneYearAgo) {
          metrics.suspiciousDates++;
          issues.push({
            type: 'old_date',
            transactionId: transaction.id,
            date: transaction.date,
            severity: 'low',
          });
        }

        // Duplicate detection
        const pattern = `${transaction.date}|${transaction.amount}|${transaction.description}`;
        if (transactionPatterns.has(pattern)) {
          metrics.potentialDuplicates++;
          issues.push({
            type: 'potential_duplicate',
            transactionId: transaction.id,
            matchingId: transactionPatterns.get(pattern),
            severity: 'high',
          });
        } else {
          transactionPatterns.set(pattern, transaction.id);
        }
      });

      // Calculate quality score
      const qualityScore = this.calculateDataQualityScore(metrics);

      // Generate recommendations
      const recommendations = [];

      if (metrics.uncategorized > allTransactions.length * 0.1) {
        recommendations.push({
          priority: 'high',
          type: 'categorization',
          message: `${metrics.uncategorized} transactions need categorization`,
          action: 'Run Smart Rules or bulk categorization',
        });
      }

      if (metrics.potentialDuplicates > 0) {
        recommendations.push({
          priority: 'high',
          type: 'duplicates',
          message: `${metrics.potentialDuplicates} potential duplicate transactions found`,
          action: 'Review and remove duplicates',
        });
      }

      if (metrics.missingDescriptions > allTransactions.length * 0.2) {
        recommendations.push({
          priority: 'medium',
          type: 'descriptions',
          message: 'Many transactions lack descriptions',
          action: 'Add descriptions for better searchability',
        });
      }

      // Category distribution analysis
      const categoryDistribution = new Map();
      allTransactions.forEach(t => {
        const cat = t.category || 'Uncategorized';
        categoryDistribution.set(cat, (categoryDistribution.get(cat) || 0) + 1);
      });

      return {
        summary: {
          totalTransactions: allTransactions.length,
          qualityScore,
          scoreRating:
            qualityScore >= 90
              ? 'Excellent'
              : qualityScore >= 75
                ? 'Good'
                : qualityScore >= 60
                  ? 'Fair'
                  : 'Needs Improvement',
        },
        metrics,
        issues: issues.slice(0, 100), // Limit to first 100 issues
        recommendations,
        categoryDistribution: Array.from(categoryDistribution.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([category, count]) => ({
            category,
            count,
            percentage: ((count / allTransactions.length) * 100).toFixed(2),
          })),
        performance: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      debug.error('Failed to generate data quality report', error);
      throw error;
    }
  }

  /**
   * Get Smart Rule recommendations based on patterns
   * @returns {Promise<Object>} Rule recommendations
   */
  async getSmartRuleRecommendations() {
    const startTime = Date.now();
    debug.log('Generating Smart Rule recommendations');

    try {
      // Get recent transactions and existing rules
      const lookbackDays = 90;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const searchResult = await this.searchTransactions({
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });

      const transactions = searchResult.transactions || [];
      const existingRules = await database.getSmartRules(true);

      // Track patterns
      const merchantPatterns = new Map();
      const descriptionPatterns = new Map();
      const amountPatterns = new Map();

      // Analyze transactions for patterns
      transactions.forEach(transaction => {
        // Skip if already has a category
        if (!transaction.category || transaction.category === 'Uncategorized') {
          return;
        }

        // Merchant patterns
        if (transaction.description) {
          const merchant = this.extractMerchantName(transaction.description);
          if (merchant) {
            if (!merchantPatterns.has(merchant)) {
              merchantPatterns.set(merchant, new Map());
            }
            const categories = merchantPatterns.get(merchant);
            categories.set(transaction.category, (categories.get(transaction.category) || 0) + 1);
          }

          // Description keyword patterns
          const keywords = transaction.description.toLowerCase().split(/\s+/);
          keywords.forEach(keyword => {
            if (keyword.length > 3 && !this.isCommonWord(keyword)) {
              if (!descriptionPatterns.has(keyword)) {
                descriptionPatterns.set(keyword, new Map());
              }
              const categories = descriptionPatterns.get(keyword);
              categories.set(transaction.category, (categories.get(transaction.category) || 0) + 1);
            }
          });
        }

        // Amount range patterns
        const amountRange = this.getAmountRange(Math.abs(transaction.amount));
        const rangeKey = `${amountRange.min}-${amountRange.max}`;
        if (!amountPatterns.has(rangeKey)) {
          amountPatterns.set(rangeKey, new Map());
        }
        const categories = amountPatterns.get(rangeKey);
        categories.set(transaction.category, (categories.get(transaction.category) || 0) + 1);
      });

      // Generate recommendations
      const recommendations = [];

      // Merchant-based rules
      merchantPatterns.forEach((categories, merchant) => {
        const sortedCategories = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);

        if (sortedCategories.length > 0 && sortedCategories[0][1] >= 3) {
          const dominantCategory = sortedCategories[0][0];
          const confidence =
            sortedCategories[0][1] / Array.from(categories.values()).reduce((a, b) => a + b, 0);

          // Check if rule already exists
          const ruleExists = existingRules.some(
            rule => rule.conditions?.description?.contains === merchant
          );

          if (!ruleExists && confidence > 0.8) {
            recommendations.push({
              type: 'merchant',
              priority: 'high',
              confidence: (confidence * 100).toFixed(0),
              rule: {
                name: `Auto-categorize ${merchant} transactions`,
                description: `Automatically categorize transactions from ${merchant} as ${dominantCategory}`,
                conditions: {
                  description: {
                    contains: merchant,
                  },
                },
                actions: {
                  setCategory: dominantCategory,
                },
              },
              evidence: {
                totalTransactions: Array.from(categories.values()).reduce((a, b) => a + b, 0),
                categoryBreakdown: sortedCategories,
              },
            });
          }
        }
      });

      // Keyword-based rules
      descriptionPatterns.forEach((categories, keyword) => {
        const sortedCategories = Array.from(categories.entries()).sort((a, b) => b[1] - a[1]);

        if (sortedCategories.length > 0 && sortedCategories[0][1] >= 5) {
          const dominantCategory = sortedCategories[0][0];
          const total = Array.from(categories.values()).reduce((a, b) => a + b, 0);
          const confidence = sortedCategories[0][1] / total;

          if (confidence > 0.75 && total >= 10) {
            recommendations.push({
              type: 'keyword',
              priority: 'medium',
              confidence: (confidence * 100).toFixed(0),
              rule: {
                name: `Categorize "${keyword}" transactions`,
                description: `Transactions containing "${keyword}" likely belong to ${dominantCategory}`,
                conditions: {
                  description: {
                    contains: keyword,
                    caseSensitive: false,
                  },
                },
                actions: {
                  setCategory: dominantCategory,
                },
              },
              evidence: {
                totalTransactions: total,
                categoryBreakdown: sortedCategories,
              },
            });
          }
        }
      });

      // Sort recommendations by priority and confidence
      recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return parseFloat(b.confidence) - parseFloat(a.confidence);
      });

      return {
        recommendations: recommendations.slice(0, 20), // Top 20 recommendations
        summary: {
          totalPatterns: merchantPatterns.size + descriptionPatterns.size,
          merchantPatterns: merchantPatterns.size,
          keywordPatterns: descriptionPatterns.size,
          existingRules: existingRules.length,
          transactionsAnalyzed: transactions.length,
        },
        performance: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      debug.error('Failed to generate Smart Rule recommendations', error);
      throw error;
    }
  }

  /**
   * Evaluate effectiveness of existing Smart Rules
   * @returns {Promise<Object>} Rule effectiveness analysis
   */
  async evaluateRuleEffectiveness() {
    const startTime = Date.now();
    debug.log('Evaluating Smart Rule effectiveness');

    try {
      const rules = await database.getSmartRules();

      if (rules.length === 0) {
        return {
          summary: {
            message: 'No Smart Rules to evaluate',
            totalRules: 0,
          },
        };
      }

      // Get recent transactions to analyze
      const lookbackDays = 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);

      const transactions = await this.searchTransactions({
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      });

      // Evaluate each rule
      const evaluations = [];

      for (const rule of rules) {
        const evaluation = {
          ruleId: rule.id,
          ruleName: rule.name,
          enabled: rule.enabled,
          matches: 0,
          potentialMatches: 0,
          accuracy: 0,
          suggestions: [],
        };

        // Count matches and analyze effectiveness
        transactions.forEach(transaction => {
          // Check if rule conditions would match
          const wouldMatch = this.checkRuleConditions(transaction, rule.conditions);

          if (wouldMatch) {
            evaluation.potentialMatches++;

            // Check if the action was already applied
            if (rule.actions.setCategory && transaction.category === rule.actions.setCategory) {
              evaluation.matches++;
            }
          }
        });

        // Calculate metrics
        if (evaluation.potentialMatches > 0) {
          evaluation.accuracy = ((evaluation.matches / evaluation.potentialMatches) * 100).toFixed(
            2
          );
        }

        // Generate suggestions
        if (!rule.enabled && evaluation.potentialMatches > 10) {
          evaluation.suggestions.push({
            type: 'enable_rule',
            message: 'This rule matches many transactions. Consider enabling it.',
            impact: 'high',
          });
        }

        if (rule.enabled && evaluation.accuracy < 50 && evaluation.potentialMatches > 5) {
          evaluation.suggestions.push({
            type: 'review_conditions',
            message: 'Low accuracy suggests rule conditions may be too broad.',
            impact: 'medium',
          });
        }

        if (rule.enabled && evaluation.potentialMatches === 0) {
          evaluation.suggestions.push({
            type: 'no_matches',
            message: 'Rule has not matched any recent transactions.',
            impact: 'low',
          });
        }

        evaluations.push(evaluation);
      }

      // Calculate overall statistics
      const activeRules = evaluations.filter(e => e.enabled);
      const totalMatches = evaluations.reduce((sum, e) => sum + e.matches, 0);
      const totalPotentialMatches = evaluations.reduce((sum, e) => sum + e.potentialMatches, 0);

      // Sort by effectiveness
      evaluations.sort((a, b) => b.matches - a.matches);

      return {
        evaluations,
        summary: {
          totalRules: rules.length,
          activeRules: activeRules.length,
          totalMatches,
          totalPotentialMatches,
          overallAccuracy:
            totalPotentialMatches > 0
              ? ((totalMatches / totalPotentialMatches) * 100).toFixed(2)
              : 0,
          transactionsAnalyzed: transactions.length,
          timeWindow: `Last ${lookbackDays} days`,
        },
        recommendations: {
          topPerformers: evaluations.filter(e => e.matches > 10).slice(0, 5),
          needsAttention: evaluations.filter(e => e.suggestions.length > 0).slice(0, 5),
          inactive: evaluations.filter(e => e.potentialMatches === 0 && e.enabled),
        },
        performance: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      debug.error('Failed to evaluate rule effectiveness', error);
      throw error;
    }
  }

  /**
   * Helper: Estimate cache memory usage
   * @private
   */
  estimateCacheMemory() {
    // Rough estimation: assume average transaction is 500 bytes
    const avgTransactionSize = 500;
    const cacheSize = this.cache.size * avgTransactionSize;
    const searchCacheSize = this.searchCache.size * avgTransactionSize * 20; // Results arrays
    return ((cacheSize + searchCacheSize) / 1024 / 1024).toFixed(2);
  }

  /**
   * Helper: Cleanup pending operations
   * @private
   */
  cleanupPendingOperations() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    let cleaned = 0;

    this.pendingOperations.forEach((operation, id) => {
      if (now - operation.timestamp > timeout) {
        this.pendingOperations.delete(id);
        cleaned++;
      }
    });

    return cleaned;
  }

  /**
   * Helper: Warm cache with frequently accessed data
   * @private
   */
  async warmFrequentlyAccessedCache() {
    try {
      // Pre-load current month transactions
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      await this.searchTransactions({
        dateRange: {
          start: startOfMonth.toISOString(),
          end: now.toISOString(),
        },
      });

      debug.log('Cache warmed with current month transactions');
    } catch (error) {
      debug.error('Failed to warm cache', error);
    }
  }

  /**
   * Helper: Calculate data quality score
   * @private
   */
  calculateDataQualityScore(metrics) {
    const weights = {
      categorization: 0.3,
      descriptions: 0.2,
      amounts: 0.2,
      duplicates: 0.2,
      dates: 0.1,
    };

    const scores = {
      categorization: Math.max(0, 100 - (metrics.uncategorized / metrics.totalTransactions) * 100),
      descriptions: Math.max(
        0,
        100 - (metrics.missingDescriptions / metrics.totalTransactions) * 100
      ),
      amounts: Math.max(0, 100 - (metrics.invalidAmounts / metrics.totalTransactions) * 100),
      duplicates: Math.max(
        0,
        100 - (metrics.potentialDuplicates / metrics.totalTransactions) * 200
      ),
      dates: Math.max(
        0,
        100 - ((metrics.futureDated + metrics.suspiciousDates) / metrics.totalTransactions) * 100
      ),
    };

    let totalScore = 0;
    Object.entries(scores).forEach(([key, score]) => {
      totalScore += score * weights[key];
    });

    return Math.round(totalScore);
  }

  /**
   * Helper: Check if word is common
   * @private
   */
  isCommonWord(word) {
    const commonWords = ['the', 'and', 'for', 'with', 'from', 'payment', 'purchase', 'transaction'];
    return commonWords.includes(word.toLowerCase());
  }

  /**
   * Helper: Get amount range for pattern detection
   * @private
   */
  getAmountRange(amount) {
    if (amount < 10) {
      return { min: 0, max: 10 };
    }
    if (amount < 50) {
      return { min: 10, max: 50 };
    }
    if (amount < 100) {
      return { min: 50, max: 100 };
    }
    if (amount < 500) {
      return { min: 100, max: 500 };
    }
    if (amount < 1000) {
      return { min: 500, max: 1000 };
    }
    return { min: 1000, max: 999999 };
  }

  /**
   * Helper: Check if transaction matches rule conditions
   * @private
   */
  checkRuleConditions(transaction, conditions) {
    if (!conditions) {
      return false;
    }

    // Check description conditions
    if (conditions.description) {
      if (conditions.description.contains) {
        const searchStr =
          conditions.description.caseSensitive === false
            ? transaction.description?.toLowerCase()
            : transaction.description;
        const searchTerm =
          conditions.description.caseSensitive === false
            ? conditions.description.contains.toLowerCase()
            : conditions.description.contains;

        if (!searchStr || !searchStr.includes(searchTerm)) {
          return false;
        }
      }
    }

    // Check amount conditions
    if (conditions.amount) {
      const amount = Math.abs(transaction.amount);
      if (conditions.amount.min !== undefined && amount < conditions.amount.min) {
        return false;
      }
      if (conditions.amount.max !== undefined && amount > conditions.amount.max) {
        return false;
      }
      if (conditions.amount.equals !== undefined && amount !== conditions.amount.equals) {
        return false;
      }
    }

    // Check category conditions
    if (conditions.category) {
      if (conditions.category.equals && transaction.category !== conditions.category.equals) {
        return false;
      }
      if (conditions.category.in && !conditions.category.in.includes(transaction.category)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Cleanup method
   */
  cleanup() {
    // Clear cache
    this.clearCache();

    // Clear pending operations
    this.pendingOperations.clear();

    // Clear event queue
    if (this.eventBatchTimeout) {
      clearTimeout(this.eventBatchTimeout);
    }
    this.eventQueue = [];

    // Reset metrics
    this.resetMetrics();

    debug.log('TransactionManager: Cleanup complete');
  }
}

// Create and export singleton instance
export const transactionManager = new TransactionManager();

// Console helpers for Phase 4 Analytics
if (typeof window !== 'undefined') {
  // Milestone 1: Core Analytics
  window.getSpendingTrends = options => transactionManager.getSpendingTrends(options);
  window.getCategoryTrends = (category, months) =>
    transactionManager.getCategoryTrends(category, months);
  window.getMerchantAnalysis = options => transactionManager.getMerchantAnalysis(options);

  // Milestone 2: Anomaly Detection & Predictive Analytics
  window.detectAnomalies = options => transactionManager.detectAnomalies(options);
  window.getSpendingAlerts = options => transactionManager.getSpendingAlerts(options);
  window.predictMonthlySpending = options => transactionManager.predictMonthlySpending(options);
  window.getCashFlowForecast = days => transactionManager.getCashFlowForecast(days);
  window.getTransactionInsights = () => transactionManager.getTransactionInsights();
  window.getBudgetPerformance = budgets => transactionManager.getBudgetPerformance(budgets);

  // Milestone 3: Performance Optimization & Integration
  window.getPerformanceMetrics = () => transactionManager.getPerformanceMetrics();
  window.optimizePerformance = () => transactionManager.optimizePerformance();
  window.getDataQualityReport = () => transactionManager.getDataQualityReport();
  window.getSmartRuleRecommendations = () => transactionManager.getSmartRuleRecommendations();
  window.evaluateRuleEffectiveness = () => transactionManager.evaluateRuleEffectiveness();

  // Analytics methods are now available on window object
  // Removed verbose console logging to keep console clean
}
