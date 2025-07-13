// js/modules/batchOperations.js
import { debug } from './debug.js';

/**
 * Batch Operations Utility
 * Reduces N+1 query patterns by batching database operations
 */
class BatchOperationManager {
    constructor() {
        this.pendingOperations = new Map();
        this.batchTimeout = null;
        this.batchDelay = 50; // milliseconds
    }
    
    /**
     * Add an operation to the batch queue
     */
    addOperation(type, operation) {
        if (!this.pendingOperations.has(type)) {
            this.pendingOperations.set(type, []);
        }
        
        this.pendingOperations.get(type).push(operation);
        this.scheduleBatch();
    }
    
    /**
     * Schedule batch execution
     */
    scheduleBatch() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        this.batchTimeout = setTimeout(() => {
            this.executeBatch();
        }, this.batchDelay);
    }
    
    /**
     * Execute all pending operations
     */
    async executeBatch() {
        if (this.pendingOperations.size === 0) return;
        
        const operations = new Map(this.pendingOperations);
        this.pendingOperations.clear();
        this.batchTimeout = null;
        
        for (const [type, ops] of operations) {
            try {
                await this.executeBatchByType(type, ops);
            } catch (error) {
                debug.error(`Batch operation failed for type ${type}:`, error);
                // Reject all operations in this batch
                ops.forEach(op => op.reject(error));
            }
        }
    }
    
    /**
     * Execute operations by type
     */
    async executeBatchByType(type, operations) {
        switch (type) {
            case 'updateHoldings':
                await this.batchUpdateHoldings(operations);
                break;
            case 'updateSavingsGoals':
                await this.batchUpdateSavingsGoals(operations);
                break;
            case 'updateTransactions':
                await this.batchUpdateTransactions(operations);
                break;
            default:
                // Execute individually if no batch handler
                for (const op of operations) {
                    try {
                        const result = await op.execute();
                        op.resolve(result);
                    } catch (error) {
                        op.reject(error);
                    }
                }
        }
    }
    
    /**
     * Batch update holdings
     */
    async batchUpdateHoldings(operations) {
        const db = (await import('../database.js')).default;
        const supabase = db.supabase;
        
        // Process updates individually but in a single batch
        const results = [];
        const errors = [];
        
        // Use Promise.all to update all holdings in parallel
        const updatePromises = operations.map(async (op, index) => {
            try {
                const { data, error } = await supabase
                    .from('holdings')
                    .update({
                        current_price: op.data.updates.current_price,
                        value: op.data.updates.value
                    })
                    .eq('id', op.data.id)
                    .select()
                    .single();
                    
                if (error) {
                    errors[index] = error;
                    return null;
                }
                
                results[index] = data;
                return data;
            } catch (error) {
                errors[index] = error;
                return null;
            }
        });
        
        await Promise.all(updatePromises);
        
        // Resolve/reject operations based on results
        operations.forEach((op, index) => {
            if (errors[index]) {
                op.reject(errors[index]);
            } else {
                op.resolve(results[index]);
            }
        });
    }
    
    /**
     * Batch update savings goals
     */
    async batchUpdateSavingsGoals(operations) {
        const db = (await import('../database.js')).default;
        const supabase = db.supabase;
        
        // Process updates individually but in a single batch
        const results = [];
        const errors = [];
        
        // Use Promise.all to update all savings goals in parallel
        const updatePromises = operations.map(async (op, index) => {
            try {
                const { data, error } = await supabase
                    .from('savings_goals')
                    .update(op.data.updates)
                    .eq('id', op.data.id)
                    .select()
                    .single();
                    
                if (error) {
                    errors[index] = error;
                    return null;
                }
                
                results[index] = data;
                return data;
            } catch (error) {
                errors[index] = error;
                return null;
            }
        });
        
        await Promise.all(updatePromises);
        
        // Resolve/reject operations based on results
        operations.forEach((op, index) => {
            if (errors[index]) {
                op.reject(errors[index]);
            } else {
                op.resolve(results[index]);
            }
        });
    }
    
    /**
     * Batch update transactions
     */
    async batchUpdateTransactions(operations) {
        const db = (await import('../database.js')).default;
        const supabase = db.supabase;
        
        // Process updates individually but in a single batch
        const results = [];
        const errors = [];
        
        // Use Promise.all to update all transactions in parallel
        const updatePromises = operations.map(async (op, index) => {
            try {
                const { data, error } = await supabase
                    .from('transactions')
                    .update(op.data.updates)
                    .eq('id', op.data.id)
                    .select()
                    .single();
                    
                if (error) {
                    errors[index] = error;
                    return null;
                }
                
                results[index] = data;
                return data;
            } catch (error) {
                errors[index] = error;
                return null;
            }
        });
        
        await Promise.all(updatePromises);
        
        // Resolve/reject operations based on results
        operations.forEach((op, index) => {
            if (errors[index]) {
                op.reject(errors[index]);
            } else {
                op.resolve(results[index]);
            }
        });
    }
}

// Create singleton instance
export const batchManager = new BatchOperationManager();

/**
 * Helper function to create a batched database operation
 */
export function batchOperation(type, data, execute) {
    return new Promise((resolve, reject) => {
        batchManager.addOperation(type, {
            data,
            execute,
            resolve,
            reject
        });
    });
}

/**
 * Batch update helper for holdings
 */
export async function batchUpdateHolding(id, updates) {
    return batchOperation('updateHoldings', { id, updates }, async () => {
        const db = (await import('../database.js')).default;
        return db.updateHolding(id, updates);
    });
}

/**
 * Batch update helper for savings goals
 */
export async function batchUpdateSavingsGoal(id, updates) {
    return batchOperation('updateSavingsGoals', { id, updates }, async () => {
        const db = (await import('../database.js')).default;
        return db.updateSavingsGoal(id, updates);
    });
}

/**
 * Force execute any pending batches
 */
export async function flushBatch() {
    if (batchManager.batchTimeout) {
        clearTimeout(batchManager.batchTimeout);
        batchManager.batchTimeout = null;
    }
    await batchManager.executeBatch();
}