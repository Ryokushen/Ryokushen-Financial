// js/modules/transactionManager.js - Centralized Transaction Management System

import database from '../database.js';
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';
import { validateForm, ValidationSchemas, ValidationRules } from './validation.js';
import { safeParseFloat, formatCurrency } from './utils.js';
import { addMoney, subtractMoney } from './financialMath.js';
import { dataIndex } from './dataIndex.js';
import { memoize } from './memoization.js';
import { performanceUtils } from './performanceUtils.js';

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
        
        const { errors, hasErrors } = validateForm(transactionData, ValidationSchemas.transaction);
        
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
                
                // Store original balance
                let originalBalance = 0;
                if (accountType === 'cash') {
                    const account = await database.getCashAccountById(accountId);
                    originalBalance = account?.balance || 0;
                } else if (accountType === 'debt') {
                    const account = await database.getDebtAccountById(accountId);
                    originalBalance = account?.balance || 0;
                }
                
                originalBalances.set(`${accountType}_${accountId}`, originalBalance);
                
                // Apply balance update
                const newBalance = addMoney(originalBalance, amount);
                
                if (accountType === 'cash') {
                    await database.updateCashBalance(accountId, newBalance);
                } else if (accountType === 'debt') {
                    await database.updateDebtBalance(accountId, newBalance);
                }
                
                debug.log(`Balance updated: ${accountType}_${accountId} from ${originalBalance} to ${newBalance}`);
            }
        };
        
        // Prepare rollback function
        const rollbackBalances = async () => {
            for (const [key, originalBalance] of originalBalances) {
                const [accountType, accountId] = key.split('_');
                
                if (accountType === 'cash') {
                    await database.updateCashBalance(parseInt(accountId), originalBalance);
                } else if (accountType === 'debt') {
                    await database.updateDebtBalance(parseInt(accountId), originalBalance);
                }
                
                debug.log(`Balance rolled back: ${key} to ${originalBalance}`);
            }
        };
        
        // Execute atomic operation
        return await this.executeWithRollback(
            async () => {
                // Create transaction first
                savedTransaction = await this.addTransaction(transactionData);
                
                // Then update balances
                await applyBalanceUpdates();
                
                // Dispatch success event
                window.dispatchEvent(new CustomEvent('transaction:created:withBalance', {
                    detail: {
                        transaction: savedTransaction,
                        balanceUpdates
                    }
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
                
                // Get current balance
                let currentBalance = 0;
                if (accountType === 'cash') {
                    const account = await database.getCashAccountById(accountId);
                    currentBalance = account?.balance || 0;
                } else if (accountType === 'debt') {
                    const account = await database.getDebtAccountById(accountId);
                    currentBalance = account?.balance || 0;
                }
                
                originalBalances.set(`${accountType}_${accountId}`, currentBalance);
                
                // Apply adjustment (reverse old + apply new)
                let newBalance = currentBalance;
                if (reverseAmount !== undefined) {
                    newBalance = subtractMoney(newBalance, reverseAmount);
                }
                if (applyAmount !== undefined) {
                    newBalance = addMoney(newBalance, applyAmount);
                }
                
                // Update balance
                if (accountType === 'cash') {
                    await database.updateCashBalance(accountId, newBalance);
                } else if (accountType === 'debt') {
                    await database.updateDebtBalance(accountId, newBalance);
                }
                
                debug.log(`Balance adjusted: ${accountType}_${accountId} from ${currentBalance} to ${newBalance}`);
            }
        };
        
        // Prepare rollback function
        const rollbackBalances = async () => {
            for (const [key, originalBalance] of originalBalances) {
                const [accountType, accountId] = key.split('_');
                
                if (accountType === 'cash') {
                    await database.updateCashBalance(parseInt(accountId), originalBalance);
                } else if (accountType === 'debt') {
                    await database.updateDebtBalance(parseInt(accountId), originalBalance);
                }
                
                debug.log(`Balance rolled back: ${key} to ${originalBalance}`);
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
                
                // Get current balance
                let currentBalance = 0;
                if (accountType === 'cash') {
                    const account = await database.getCashAccountById(accountId);
                    currentBalance = account?.balance || 0;
                } else if (accountType === 'debt') {
                    const account = await database.getDebtAccountById(accountId);
                    currentBalance = account?.balance || 0;
                }
                
                originalBalances.set(`${accountType}_${accountId}`, currentBalance);
                
                // Apply reversal
                const newBalance = subtractMoney(currentBalance, amount);
                
                // Update balance
                if (accountType === 'cash') {
                    await database.updateCashBalance(accountId, newBalance);
                } else if (accountType === 'debt') {
                    await database.updateDebtBalance(accountId, newBalance);
                }
                
                debug.log(`Balance reversed: ${accountType}_${accountId} from ${currentBalance} to ${newBalance}`);
            }
        };
        
        // Prepare rollback function
        const rollbackBalances = async () => {
            for (const [key, originalBalance] of originalBalances) {
                const [accountType, accountId] = key.split('_');
                
                if (accountType === 'cash') {
                    await database.updateCashBalance(parseInt(accountId), originalBalance);
                } else if (accountType === 'debt') {
                    await database.updateDebtBalance(parseInt(accountId), originalBalance);
                }
                
                debug.log(`Balance rolled back: ${key} to ${originalBalance}`);
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
}

// Create and export singleton instance
export const transactionManager = new TransactionManager();