// js/modules/batchOperations.js
import { debug } from './debug.js';
import { transactionManager } from './transactionManager.js';

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
    if (this.pendingOperations.size === 0) {
      return;
    }

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

    // Convert operations to the format expected by database.js
    const updates = operations.map(op => ({
      id: op.data.id,
      updates: op.data.updates,
    }));

    // Use the new batch update method
    const results = await db.batchUpdateHoldings(updates);

    // Resolve/reject operations based on results
    operations.forEach((op, index) => {
      if (results[index].success) {
        op.resolve(results[index].data);
      } else {
        op.reject(results[index].error);
      }
    });
  }

  /**
   * Batch update savings goals
   */
  async batchUpdateSavingsGoals(operations) {
    const db = (await import('../database.js')).default;

    // Convert operations to the format expected by database.js
    const updates = operations.map(op => ({
      id: op.data.id,
      updates: op.data.updates,
    }));

    // Use the new batch update method
    const results = await db.batchUpdateSavingsGoals(updates);

    // Resolve/reject operations based on results
    operations.forEach((op, index) => {
      if (results[index].success) {
        op.resolve(results[index].data);
      } else {
        op.reject(results[index].error);
      }
    });
  }

  /**
   * Batch update transactions
   */
  async batchUpdateTransactions(operations) {
    // Convert operations to the format expected by TransactionManager
    const updates = operations.map(op => ({
      id: op.data.id,
      updates: op.data.updates,
    }));

    // Use TransactionManager's batch update method
    const results = await transactionManager.updateMultipleTransactions(updates);

    // Resolve/reject operations based on results
    operations.forEach((op, index) => {
      // Find corresponding result for this operation
      const successResult = results.successful.find(
        r => r.transaction && r.transaction.id === op.data.id
      );
      const failedResult = results.failed.find(r => r.id === op.data.id);

      if (successResult) {
        op.resolve(successResult.transaction);
      } else if (failedResult) {
        op.reject(new Error(failedResult.error));
      } else {
        op.reject(new Error('Transaction update result not found'));
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
      reject,
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
 * Batch update helper for transactions using TransactionManager
 */
export async function batchUpdateTransaction(id, updates) {
  return batchOperation('updateTransactions', { id, updates }, async () => {
    return transactionManager.updateTransaction(id, updates);
  });
}

/**
 * Batch add transactions using TransactionManager
 */
export async function batchAddTransactions(transactionsData) {
  return transactionManager.addMultipleTransactions(transactionsData);
}

/**
 * Batch delete transactions using TransactionManager
 */
export async function batchDeleteTransactions(transactionIds) {
  return transactionManager.deleteMultipleTransactions(transactionIds);
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
