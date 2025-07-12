// js/modules/transactionManager.js
import { showError } from './ui.js';

/**
 * Transaction Manager for handling multi-step operations with rollback capability
 */
export class TransactionManager {
    constructor() {
        this.operations = [];
        this.rollbackHandlers = [];
        this.completed = [];
    }
    
    /**
     * Add an operation to the transaction
     * @param {Function} operation - The operation to perform
     * @param {Function} rollback - The rollback handler if operation fails
     * @param {string} description - Description of the operation for logging
     */
    addOperation(operation, rollback, description = 'Operation') {
        this.operations.push({ operation, rollback, description });
    }
    
    /**
     * Execute all operations in the transaction
     * @returns {Promise<Array>} Array of results from all operations
     */
    async execute() {
        const results = [];
        
        try {
            // Execute each operation in sequence
            for (let i = 0; i < this.operations.length; i++) {
                const { operation, rollback, description } = this.operations[i];
                
                try {
                    console.log(`Executing: ${description}`);
                    const result = await operation();
                    results.push(result);
                    this.completed.push({ operation, rollback, result, description });
                } catch (error) {
                    console.error(`Failed: ${description}`, error);
                    // Operation failed, rollback all completed operations
                    await this.rollback();
                    throw new Error(`Transaction failed at step: ${description}. ${error.message}`);
                }
            }
            
            console.log('Transaction completed successfully');
            return results;
            
        } catch (error) {
            showError(`Transaction failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Rollback all completed operations
     */
    async rollback() {
        console.log('Starting rollback...');
        
        // Rollback in reverse order
        for (let i = this.completed.length - 1; i >= 0; i--) {
            const { rollback, description, result } = this.completed[i];
            
            if (rollback) {
                try {
                    console.log(`Rolling back: ${description}`);
                    await rollback(result);
                } catch (error) {
                    console.error(`Rollback failed for: ${description}`, error);
                    // Continue with other rollbacks even if one fails
                }
            }
        }
        
        console.log('Rollback completed');
    }
    
    /**
     * Clear the transaction
     */
    clear() {
        this.operations = [];
        this.rollbackHandlers = [];
        this.completed = [];
    }
}

/**
 * Helper function to create a transaction for common operations
 */
export function createTransaction() {
    return new TransactionManager();
}

/**
 * Example usage for a savings contribution transaction
 */
export async function executeContributionTransaction(appState, sourceAccountId, targetAccountId, amount, goalId, db) {
    const transaction = createTransaction();
    
    let withdrawalTx = null;
    let depositTx = null;
    
    // Add withdrawal operation
    transaction.addOperation(
        async () => {
            const withdrawal = {
                date: new Date().toISOString().split('T')[0],
                account_id: sourceAccountId,
                category: "Transfer",
                description: `Transfer to savings goal`,
                amount: -amount,
                cleared: true
            };
            withdrawalTx = await db.addTransaction(withdrawal);
            return withdrawalTx;
        },
        async (result) => {
            // Rollback: delete the withdrawal transaction
            if (result && result.id) {
                await db.deleteTransaction(result.id);
            }
        },
        'Create withdrawal transaction'
    );
    
    // Add deposit operation
    transaction.addOperation(
        async () => {
            const deposit = {
                date: new Date().toISOString().split('T')[0],
                account_id: targetAccountId,
                category: "Transfer",
                description: `Contribution to savings goal`,
                amount: amount,
                cleared: true
            };
            depositTx = await db.addTransaction(deposit);
            return depositTx;
        },
        async (result) => {
            // Rollback: delete the deposit transaction
            if (result && result.id) {
                await db.deleteTransaction(result.id);
            }
        },
        'Create deposit transaction'
    );
    
    // Add goal update operation
    transaction.addOperation(
        async () => {
            const goal = appState.appData.savingsGoals.find(g => g.id === goalId);
            const newAmount = goal.currentAmount + amount;
            const updates = {
                current_amount: newAmount,
                completed_date: newAmount >= goal.targetAmount ? new Date().toISOString().split('T')[0] : null
            };
            await db.updateSavingsGoal(goalId, updates);
            return { goalId, previousAmount: goal.currentAmount, newAmount };
        },
        async (result) => {
            // Rollback: restore previous goal amount
            if (result) {
                await db.updateSavingsGoal(result.goalId, {
                    current_amount: result.previousAmount,
                    completed_date: null
                });
            }
        },
        'Update savings goal progress'
    );
    
    // Execute the transaction
    try {
        const results = await transaction.execute();
        
        // Update local state only after successful transaction
        if (withdrawalTx) {
            appState.appData.transactions.unshift({ ...withdrawalTx, amount: parseFloat(withdrawalTx.amount) });
        }
        if (depositTx) {
            appState.appData.transactions.unshift({ ...depositTx, amount: parseFloat(depositTx.amount) });
        }
        
        const goal = appState.appData.savingsGoals.find(g => g.id === goalId);
        if (goal) {
            goal.currentAmount += amount;
            if (goal.currentAmount >= goal.targetAmount) {
                goal.completedDate = new Date().toISOString().split('T')[0];
            }
        }
        
        return results;
    } catch (error) {
        // Transaction failed and was rolled back
        throw error;
    }
}

/**
 * Retry helper for operations that might fail due to network issues
 */
export async function retryOperation(operation, maxRetries = 3, backoffMs = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            
            console.log(`Attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs * attempt));
        }
    }
}