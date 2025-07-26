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
            rollbacks: 0
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
        
        eventManager.addEventListener(window, 'account:deleted', (event) => {
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
            const transaction = transactions.find(t => t.id === id);
            
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
                transactions = transactions.filter(t => 
                    t.account_id === accountId || t.debt_account_id === accountId
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
            hasErrors: !isValid
        };
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
            timestamp: Date.now()
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
        debug.log('TransactionManager: Cache cleared');
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
        if (this.eventQueue.length === 0) return;
        
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
            timestamp: new Date().toISOString()
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
            hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
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
            rollbacks: 0
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
                timestamp: Date.now()
            });
            
            // Prepare and validate data
            const prepared = this.prepareTransactionData(transactionData);
            const validation = this.validateTransaction(prepared);
            
            if (!validation.valid && this.strictMode) {
                throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
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
                window.dispatchEvent(new CustomEvent('transaction:added', {
                    detail: { transaction: savedTransaction }
                }));
            }
            
            // Record successful operation
            this.recordOperation('add', prepared, { success: true, id: savedTransaction.id });
            
            // Remove from pending
            this.pendingOperations.delete(operationId);
            
            debug.log('TransactionManager: Transaction added', savedTransaction.id);
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
                timestamp: Date.now()
            });
            
            // Merge and prepare updates
            const merged = { ...original, ...updates };
            const prepared = this.prepareTransactionData(merged);
            const validation = this.validateTransaction(prepared);
            
            if (!validation.valid && this.strictMode) {
                throw new Error(`Validation failed: ${JSON.stringify(validation.errors)}`);
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
                    changes: updates
                });
            } else {
                window.dispatchEvent(new CustomEvent('transaction:updated', {
                    detail: { 
                        transaction: updatedTransaction,
                        original,
                        changes: updates
                    }
                }));
            }
            
            // Record successful operation
            this.recordOperation('update', { id, updates }, { success: true });
            
            // Remove from pending
            this.pendingOperations.delete(operationId);
            
            debug.log('TransactionManager: Transaction updated', id);
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
                timestamp: Date.now()
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
                    transaction
                });
            } else {
                window.dispatchEvent(new CustomEvent('transaction:deleted', {
                    detail: { 
                        transactionId: id,
                        transaction
                    }
                }));
            }
            
            // Record successful operation
            this.recordOperation('delete', { id, transaction }, { success: true });
            
            // Remove from pending
            this.pendingOperations.delete(operationId);
            
            debug.log('TransactionManager: Transaction deleted', id);
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
                timestamp: Date.now()
            });
            
            // Add first transaction
            const transaction1 = await this.addTransaction(fromData, { 
                ...options, 
                batchEvents: true 
            });
            savedTransactions.push(transaction1);
            
            // Add second transaction
            const transaction2 = await this.addTransaction(toData, { 
                ...options, 
                batchEvents: true 
            });
            savedTransactions.push(transaction2);
            
            // Dispatch combined event
            window.dispatchEvent(new CustomEvent('transactions:linked', {
                detail: {
                    transactions: savedTransactions,
                    type: fromData.category // 'Payment' or 'Transfer'
                }
            }));
            
            // Flush any queued events
            this.flushEventQueue();
            
            // Record successful operation
            this.recordOperation('addLinked', { fromData, toData }, { 
                success: true, 
                ids: savedTransactions.map(t => t.id) 
            });
            
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
            this.recordOperation('addLinked', { fromData, toData }, { 
                success: false, 
                error: error.message 
            });
            
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
        const applyBalanceUpdates = async () => {
            for (const update of balanceUpdates) {
                const { accountType, accountId, amount } = update;
                
                // Skip cash accounts - their balances are calculated from transactions
                if (accountType === 'cash') {
                    debug.log(`Skipping balance update for cash account ${accountId} - balances are calculated`);
                    continue;
                }
                
                // Only update debt account balances (they have stored balances)
                if (accountType === 'debt') {
                    const account = await database.getDebtAccountById(accountId);
                    const originalBalance = account?.balance || 0;
                    
                    originalBalances.set(`${accountType}_${accountId}`, originalBalance);
                    
                    // Apply balance update with sign convention for debt accounts
                    // Purchases (negative amounts) increase debt, payments (positive amounts) decrease debt
                    const newBalance = addMoney(originalBalance, -amount);
                    await database.updateDebtBalance(accountId, newBalance);
                    
                    debug.log(`Balance updated: ${accountType}_${accountId} from ${originalBalance} to ${newBalance}`);
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
                
                // Then update balances
                await applyBalanceUpdates();
                
                // Dispatch success events
                window.dispatchEvent(new CustomEvent('transaction:created:withBalance', {
                    detail: {
                        transaction: savedTransaction,
                        balanceUpdates
                    }
                }));
                
                // Also dispatch standard transaction:added event for compatibility
                window.dispatchEvent(new CustomEvent('transaction:added', {
                    detail: { transaction: savedTransaction }
                }));
                
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
        const applyBalanceAdjustments = async () => {
            for (const adjustment of balanceAdjustments) {
                const { accountType, accountId, reverseAmount, applyAmount } = adjustment;
                
                // Skip cash accounts - their balances are calculated from transactions
                if (accountType === 'cash') {
                    debug.log(`Skipping balance adjustment for cash account ${accountId} - balances are calculated`);
                    continue;
                }
                
                // Only adjust debt account balances (they have stored balances)
                if (accountType === 'debt') {
                    const account = await database.getDebtAccountById(accountId);
                    const currentBalance = account?.balance || 0;
                    
                    originalBalances.set(`${accountType}_${accountId}`, currentBalance);
                    
                    // Apply adjustment (reverse old + apply new) with debt sign convention
                    let newBalance = currentBalance;
                    if (reverseAmount !== undefined) {
                        // Reverse the original: if original was -amount, reverse with +amount
                        newBalance = addMoney(newBalance, reverseAmount);
                    }
                    if (applyAmount !== undefined) {
                        // Apply new with sign convention
                        newBalance = addMoney(newBalance, -applyAmount);
                    }
                    
                    // Update balance
                    await database.updateDebtBalance(accountId, newBalance);
                    
                    debug.log(`Balance adjusted: ${accountType}_${accountId} from ${currentBalance} to ${newBalance}`);
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
                
                // Then adjust balances
                await applyBalanceAdjustments();
                
                // Dispatch success event
                window.dispatchEvent(new CustomEvent('transaction:updated:withBalance', {
                    detail: {
                        transaction: updatedTransaction,
                        original,
                        balanceAdjustments
                    }
                }));
                
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
                    debug.log(`Skipping balance reversal for cash account ${accountId} - balances are calculated`);
                    continue;
                }
                
                // Only reverse debt account balances (they have stored balances)
                if (accountType === 'debt') {
                    const account = await database.getDebtAccountById(accountId);
                    const currentBalance = account?.balance || 0;
                    
                    originalBalances.set(`${accountType}_${accountId}`, currentBalance);
                    
                    // Apply reversal - undo the original operation
                    // Original: balance += -amount
                    // Reversal: balance -= -amount (which is balance += amount)
                    const newBalance = addMoney(currentBalance, amount);
                    
                    // Update balance
                    await database.updateDebtBalance(accountId, newBalance);
                    
                    debug.log(`Balance reversed: ${accountType}_${accountId} from ${currentBalance} to ${newBalance}`);
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
                window.dispatchEvent(new CustomEvent('transaction:deleted:withBalance', {
                    detail: {
                        transactionId: id,
                        transaction,
                        balanceReversals
                    }
                }));
                
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
            metrics: { ...this.metrics }
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
            totalFailed: 0
        };
        
        // Default options
        const batchOptions = {
            stopOnError: false,
            batchSize: this.batchSize,
            delayBetweenBatches: this.batchDelay,
            validateAll: true,
            rollbackOnFailure: false,
            ...options
        };
        
        debug.log(`TransactionManager: Starting batch add of ${transactionsData.length} transactions`);
        
        // Validate all transactions first if requested
        if (batchOptions.validateAll) {
            const validationResults = transactionsData.map((data, index) => ({
                index,
                data,
                validation: this.validateTransaction(this.prepareTransactionData(data))
            }));
            
            const invalidTransactions = validationResults.filter(r => !r.validation.valid);
            if (invalidTransactions.length > 0 && this.strictMode) {
                debug.error(`Batch validation failed: ${invalidTransactions.length} invalid transactions`);
                return {
                    ...results,
                    failed: invalidTransactions.map(r => ({
                        index: r.index,
                        data: r.data,
                        error: r.validation.errors
                    })),
                    totalFailed: invalidTransactions.length,
                    error: 'Validation failed for one or more transactions'
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
                            transaction
                        });
                        savedTransactions.push(transaction);
                        results.totalSuccess++;
                        return { success: true, transaction };
                    } catch (error) {
                        results.failed.push({
                            index: globalIndex,
                            data,
                            error: error.message
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
            window.dispatchEvent(new CustomEvent('transactions:batchAdded', {
                detail: {
                    batchId,
                    results,
                    transactions: savedTransactions
                }
            }));
            
            debug.log(`Batch add complete: ${results.totalSuccess} succeeded, ${results.totalFailed} failed`);
            
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
            totalFailed: 0
        };
        
        const batchOptions = {
            stopOnError: false,
            batchSize: this.batchSize,
            delayBetweenBatches: this.batchDelay,
            ...options
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
                        
                        const updatedTransaction = await this.updateTransaction(
                            update.id, 
                            update.updates, 
                            { batchEvents: true }
                        );
                        
                        results.successful.push({
                            index: globalIndex,
                            transaction: updatedTransaction
                        });
                        results.totalSuccess++;
                        return { success: true, transaction: updatedTransaction };
                        
                    } catch (error) {
                        results.failed.push({
                            index: globalIndex,
                            id: update.id,
                            updates: update.updates,
                            error: error.message
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
            window.dispatchEvent(new CustomEvent('transactions:batchUpdated', {
                detail: {
                    batchId,
                    results,
                    originalStates: Array.from(originalStates.values())
                }
            }));
            
            debug.log(`Batch update complete: ${results.totalSuccess} succeeded, ${results.totalFailed} failed`);
            
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
            totalFailed: 0
        };
        
        const batchOptions = {
            stopOnError: false,
            batchSize: this.batchSize,
            delayBetweenBatches: this.batchDelay,
            preserveBackup: true,
            ...options
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
                        await this.deleteTransaction(id, { batchEvents: true });
                        
                        results.successful.push({
                            index: globalIndex,
                            id,
                            transaction: deletedTransactions.get(id)
                        });
                        results.totalSuccess++;
                        return { success: true, id };
                        
                    } catch (error) {
                        results.failed.push({
                            index: globalIndex,
                            id,
                            error: error.message
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
            window.dispatchEvent(new CustomEvent('transactions:batchDeleted', {
                detail: {
                    batchId,
                    results,
                    deletedTransactions: Array.from(deletedTransactions.values())
                }
            }));
            
            debug.log(`Batch delete complete: ${results.totalSuccess} succeeded, ${results.totalFailed} failed`);
            
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
            totalFailed: 0
        };
        
        const batchOptions = {
            stopOnError: false,
            batchSize: this.batchSize,
            delayBetweenBatches: this.batchDelay,
            operationName: 'custom',
            ...options
        };
        
        debug.log(`TransactionManager: Starting batch ${batchOptions.operationName} of ${items.length} items`);
        
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
                            result
                        });
                        results.totalSuccess++;
                        return { success: true, result };
                        
                    } catch (error) {
                        results.failed.push({
                            index: globalIndex,
                            item,
                            error: error.message
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
                        percentage: (results.totalProcessed / items.length) * 100
                    });
                }
                
                if (i + batchOptions.batchSize < items.length) {
                    await new Promise(resolve => setTimeout(resolve, batchOptions.delayBetweenBatches));
                }
            }
            
            debug.log(`Batch ${batchOptions.operationName} complete: ${results.totalSuccess} succeeded, ${results.totalFailed} failed`);
            
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
            ...options
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
                category: importOptions.categoryMapping[data.category] || data.category
            }));
        }
        
        // Apply account mapping if provided
        if (importOptions.accountMapping) {
            transformedData = transformedData.map(data => ({
                ...data,
                account_id: importOptions.accountMapping[data.account_id] || data.account_id
            }));
        }
        
        // Check for duplicates if requested
        if (importOptions.duplicateCheck) {
            const existingTransactions = await this.getTransactions();
            const duplicates = [];
            
            transformedData = transformedData.filter(data => {
                const isDuplicate = existingTransactions.some(existing => 
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
            operationName: 'import'
        });
        
        // Add import metadata to result
        result.importMetadata = {
            originalCount: importData.length,
            transformedCount: transformedData.length,
            duplicatesSkipped: importData.length - transformedData.length
        };
        
        window.dispatchEvent(new CustomEvent('transactions:imported', {
            detail: result
        }));
        
        return result;
    }

    // ========== ADDITIONAL UTILITY METHODS ==========

    /**
     * Search transactions with advanced filtering
     * @param {Object} searchCriteria - Search criteria
     * @returns {Promise<Array>} Matching transactions
     */
    async searchTransactions(searchCriteria) {
        const {
            query,
            dateFrom,
            dateTo,
            amountMin,
            amountMax,
            categories,
            accounts,
            cleared,
            sortBy = 'date',
            sortOrder = 'desc',
            limit,
            offset = 0
        } = searchCriteria;
        
        // Get all transactions with basic filters
        let transactions = await this.getTransactions({
            dateFrom,
            dateTo,
            cleared
        });
        
        // Apply text search if query provided
        if (query) {
            const searchQuery = query.toLowerCase();
            transactions = transactions.filter(t => 
                t.description.toLowerCase().includes(searchQuery) ||
                t.category.toLowerCase().includes(searchQuery) ||
                (t.notes && t.notes.toLowerCase().includes(searchQuery))
            );
        }
        
        // Apply amount range filter
        if (amountMin !== undefined) {
            transactions = transactions.filter(t => Math.abs(t.amount) >= amountMin);
        }
        if (amountMax !== undefined) {
            transactions = transactions.filter(t => Math.abs(t.amount) <= amountMax);
        }
        
        // Apply category filter
        if (categories && categories.length > 0) {
            transactions = transactions.filter(t => categories.includes(t.category));
        }
        
        // Apply account filter
        if (accounts && accounts.length > 0) {
            transactions = transactions.filter(t => 
                accounts.includes(t.account_id) || 
                accounts.includes(t.debt_account_id)
            );
        }
        
        // Sort results
        transactions.sort((a, b) => {
            let compareValue = 0;
            
            switch (sortBy) {
                case 'date':
                    compareValue = new Date(a.date) - new Date(b.date);
                    break;
                case 'amount':
                    compareValue = a.amount - b.amount;
                    break;
                case 'description':
                    compareValue = a.description.localeCompare(b.description);
                    break;
                case 'category':
                    compareValue = a.category.localeCompare(b.category);
                    break;
                default:
                    compareValue = new Date(a.date) - new Date(b.date);
            }
            
            return sortOrder === 'desc' ? -compareValue : compareValue;
        });
        
        // Apply pagination
        if (limit) {
            transactions = transactions.slice(offset, offset + limit);
        }
        
        return transactions;
    }

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
            dailyAverages: {}
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
        stats.averageTransaction = stats.totalTransactions > 0 
            ? stats.netAmount / stats.totalTransactions 
            : 0;
        
        // Calculate daily averages
        if (dateFrom && dateTo) {
            const days = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24));
            stats.dailyAverages = {
                income: stats.totalIncome / days,
                expenses: stats.totalExpenses / days,
                net: stats.netAmount / days
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
            t.cleared ? 'Yes' : 'No'
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
            if (t.cleared) qif += 'C*\n';
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
                tags: [] // Can be extended to support tags
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
                amount: overrides.amount !== undefined ? overrides.amount : (template.is_income ? template.amount : -template.amount),
                debt_account_id: overrides.debt_account_id !== undefined ? overrides.debt_account_id : template.debt_account_id,
                cleared: overrides.cleared !== undefined ? overrides.cleared : false
            };
            
            // Create the transaction
            const transaction = await this.addTransaction(transactionData);
            
            // Dispatch event
            this.queueEvent('transaction:created:fromTemplate', { 
                transaction, 
                templateId,
                templateName: template.name 
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
                        isIncome: transaction.amount > 0
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
                    amount: Math.round(pattern.totalAmount / pattern.count * 100) / 100,
                    is_income: pattern.isIncome,
                    frequency: pattern.count
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
            dryRun = false // Preview without creating
        } = options;
        
        const results = {
            due: [],
            generated: [],
            failed: [],
            skipped: []
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
                        reason: 'Bill is inactive'
                    });
                    continue;
                }
                
                const nextDueDate = this.calculateNextDueDate(bill);
                if (!nextDueDate) {
                    results.skipped.push({
                        bill,
                        reason: 'Could not calculate next due date'
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
                        debt_account_id: bill.debt_account_id || null
                    };
                    
                    results.due.push({
                        bill,
                        dueDate: nextDueDate,
                        transactionData
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
                                
                                transaction = await this.createTransactionWithBalanceUpdate(
                                    transactionData,
                                    [{
                                        accountType: 'debt',
                                        accountId: bill.debt_account_id,
                                        amount: bill.amount
                                    }]
                                );
                            } else {
                                // Regular cash account transaction
                                transaction = await this.addTransaction(transactionData);
                            }
                            
                            results.generated.push({
                                bill,
                                transaction
                            });
                            
                            // Update last paid date
                            await this.updateRecurringBillLastPaid(bill.id, nextDueDate);
                            
                        } catch (error) {
                            results.failed.push({
                                bill,
                                error: error.message
                            });
                        }
                    }
                }
            }
            
            // Dispatch event with results
            this.queueEvent('recurring:generated', results);
            
            debug.log(`Recurring generation complete: ${results.generated.length} generated, ${results.due.length} due, ${results.failed.length} failed`);
            
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
                    frequency: 'monthly' // This should come from the bill
                })
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
            dryRun: true
        });
        
        return results.due.sort((a, b) => 
            new Date(a.dueDate) - new Date(b.dueDate)
        );
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
            dryRun: false
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
                source: null
            };
            
            // Get recent transactions for pattern matching
            const recentTransactions = await database.getTransactions();
            
            // First try: Exact description match
            if (description) {
                const exactMatches = recentTransactions.filter(t => 
                    t.description && 
                    t.description.toLowerCase() === description.toLowerCase()
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
                const partialMatches = recentTransactions.filter(t => 
                    t.description && 
                    t.description.toLowerCase().includes(description.toLowerCase())
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
                const categoryMatches = recentTransactions.filter(t => 
                    t.category === category
                );
                
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
                const templateMatch = templates.find(t => 
                    t.description && 
                    t.description.toLowerCase().includes(description.toLowerCase())
                );
                
                if (templateMatch && suggestions.confidence < 0.8) {
                    suggestions.category = suggestions.category || templateMatch.category;
                    suggestions.amount = suggestions.amount || templateMatch.amount;
                    suggestions.account_id = suggestions.account_id || templateMatch.account_id;
                    suggestions.debt_account_id = suggestions.debt_account_id || templateMatch.debt_account_id;
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
                source: 'error'
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
        const amounts = transactions
            .map(t => Math.abs(t.amount))
            .filter(a => a > 0);
        
        const averageAmount = amounts.length > 0
            ? Math.round((amounts.reduce((sum, a) => sum + a, 0) / amounts.length) * 100) / 100
            : null;
        
        // Most common values
        const mostCommonCategory = categoryCount.size > 0
            ? Array.from(categoryCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
            : null;
        
        const mostCommonAccount = accountCount.size > 0
            ? Array.from(accountCount.entries()).sort((a, b) => b[1] - a[1])[0][0]
            : null;
        
        return {
            mostCommonCategory,
            mostCommonAccount,
            averageAmount,
            transactionCount: transactions.length,
            categoryCount: categoryCount.size,
            accountCount: accountCount.size
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
                timestamp: new Date().toISOString()
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
                if (t.description && 
                    t.description.toLowerCase().includes(partialDescription.toLowerCase())) {
                    merchants.add(t.description);
                }
            });
            
            // Sort by relevance (exact starts with first, then contains)
            const suggestions = Array.from(merchants)
                .sort((a, b) => {
                    const aStarts = a.toLowerCase().startsWith(partialDescription.toLowerCase());
                    const bStarts = b.toLowerCase().startsWith(partialDescription.toLowerCase());
                    
                    if (aStarts && !bStarts) return -1;
                    if (!aStarts && bStarts) return 1;
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
                offset = 0
            } = filters;
            
            debug.log('Searching transactions with filters:', filters);
            
            // Get all transactions (we'll filter in memory for now)
            // In a production app, this would be done at the database level
            const allTransactions = await database.getTransactions();
            
            // Apply filters
            let filtered = allTransactions.filter(transaction => {
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
                    const accountMatch = accounts.includes(transaction.account_id) ||
                                       accounts.includes(transaction.from_account_id) ||
                                       accounts.includes(transaction.to_account_id);
                    if (!accountMatch) {
                        return false;
                    }
                }
                
                // Type filter
                if (type !== 'all') {
                    const isIncome = parseFloat(transaction.amount) > 0;
                    if (type === 'income' && !isIncome) return false;
                    if (type === 'expense' && isIncome) return false;
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
                    filters: filters
                }
            };
            
            debug.log(`Search completed: ${paginated.length} of ${totalCount} results in ${results.metadata.searchTime}ms`);
            
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
            const {
                fuzzy = true,
                highlight = true,
                limit = 50
            } = options;
            
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
                        category: []
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
                        _highlighted: highlight ? this.highlightMatches(transaction, searchTerms) : null
                    };
                })
                .filter(t => t._score > 0)
                .sort((a, b) => b._score - a._score)
                .slice(0, limit);
            
            debug.log(`Description search found ${scored.length} matches for "${searchText}"`);
            
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
            const {
                and = [],
                or = [],
                not = null,
                sortBy = 'date',
                sortOrder = 'desc',
                limit = 100
            } = query;
            
            debug.log('Executing complex query:', query);
            
            // Get all transactions
            const transactions = await database.getTransactions();
            
            // Filter transactions based on complex conditions
            const filtered = transactions.filter(transaction => {
                // Check AND conditions - all must match
                const andMatch = and.length === 0 || and.every(condition => 
                    this.evaluateCondition(transaction, condition)
                );
                
                // Check OR conditions - at least one must match
                const orMatch = or.length === 0 || or.some(condition => 
                    this.evaluateCondition(transaction, condition)
                );
                
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
                return fieldValue && 
                       typeof fieldValue === 'string' && 
                       fieldValue.toLowerCase().includes(value.toLowerCase());
                
            case 'notContains':
                return !fieldValue || 
                       typeof fieldValue !== 'string' || 
                       !fieldValue.toLowerCase().includes(value.toLowerCase());
                
            case 'startsWith':
                return fieldValue && 
                       typeof fieldValue === 'string' && 
                       fieldValue.toLowerCase().startsWith(value.toLowerCase());
                
            case 'endsWith':
                return fieldValue && 
                       typeof fieldValue === 'string' && 
                       fieldValue.toLowerCase().endsWith(value.toLowerCase());
                
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
                return Array.isArray(value) && 
                       value.length === 2 && 
                       fieldValue >= value[0] && 
                       fieldValue <= value[1];
                
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