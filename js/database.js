// js/database.js
import { debug } from './modules/debug.js';

class FinancialDatabase {
    constructor() {
        if (!window.supabaseClient) {
            throw new Error('Supabase client not initialized. Please check your configuration.');
        }
        this.supabase = window.supabaseClient;
    }

    // Helper method for error handling
    handleError(operation, error) {
        debug.error(`Database operation failed: ${operation}`, error);
        throw new Error(`Database operation failed: ${operation} - ${error.message}`);
    }

    // Helper method to get current user ID
    async getCurrentUserId() {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            throw new Error('User not authenticated');
        }
        return user.id;
    }

    // FIXED: Add retry logic for database operations
    async executeWithRetry(operation, operationName, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                // Don't retry on validation errors or auth errors
                if (error.message && (
                    error.message.includes('required') || 
                    error.message.includes('authenticated') ||
                    error.message.includes('validation') ||
                    error.message.includes('duplicate key') ||
                    error.message.includes('foreign key violation')
                )) {
                    throw error;
                }
                
                // Check if it's a network/timeout error worth retrying
                const isRetryable = 
                    error.code === 'PGRST301' || // Network error
                    error.code === '40001' || // Serialization failure
                    error.code === '57014' || // Query canceled
                    error.code === 'ECONNREFUSED' ||
                    error.code === 'ETIMEDOUT' ||
                    error.code === 'ENOTFOUND' ||
                    error.message?.includes('network') ||
                    error.message?.includes('timeout') ||
                    error.message?.includes('fetch');
                
                if (!isRetryable || attempt === maxRetries) {
                    throw error;
                }
                
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempt - 1) * 1000;
                debug.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    // --- CASH ACCOUNTS ---
    async getCashAccounts() {
        return this.executeWithRetry(async () => {
            const { data, error } = await this.supabase.from('cash_accounts').select('*').order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        }, 'getCashAccounts');
    }

    async addCashAccount(account) {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase.from('cash_accounts').insert({
                name: account.name,
                type: account.type,
                institution: account.institution,
                notes: account.notes,
                is_active: account.isActive,
                user_id: userId
            }).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('addCashAccount', error); }
    }

    async updateCashAccount(id, account) {
        try {
            const { data, error } = await this.supabase.from('cash_accounts').update({
                name: account.name,
                type: account.type,
                institution: account.institution,
                notes: account.notes,
                is_active: account.isActive
            }).eq('id', id).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('updateCashAccount', error); }
    }

    // FIXED: Handle partial failures in delete operations
    async deleteCashAccount(id) {
        if (!id) {
            throw new Error('Account ID is required');
        }

        try {
            // First, get all related data for potential recovery
            const { data: transactionsToDelete } = await this.supabase
                .from('transactions')
                .select('*')
                .eq('account_id', id);
            
            const { data: recurringBillsToUpdate } = await this.supabase
                .from('recurring_bills')
                .select('*')
                .eq('account_id', id);

            // Step 1: Try to delete/update related records
            const results = await Promise.allSettled([
                // Delete transactions
                this.supabase.from('transactions').delete().eq('account_id', id),
                // Update recurring bills to remove account reference
                this.supabase.from('recurring_bills').update({ account_id: null }).eq('account_id', id)
            ]);

            // Check for failures in related records
            const [transactionResult, recurringBillResult] = results;
            const failedOperations = [];

            if (transactionResult.status === 'rejected') {
                failedOperations.push('transactions');
                debug.error('Failed to delete transactions:', transactionResult.reason);
            }

            if (recurringBillResult.status === 'rejected') {
                failedOperations.push('recurring bills');
                debug.error('Failed to update recurring bills:', recurringBillResult.reason);
            }

            // If any related operations failed, don't proceed with account deletion
            if (failedOperations.length > 0) {
                throw new Error(`Failed to update related records: ${failedOperations.join(', ')}`);
            }

            // Step 2: Try to delete the account
            const { error: accountError } = await this.supabase
                .from('cash_accounts')
                .delete()
                .eq('id', id);

            if (accountError) {
                // Account deletion failed - attempt to restore data
                debug.error('Account deletion failed, attempting to restore related data...');
                
                const restorePromises = [];

                // Restore transactions if they were deleted
                if (transactionResult.status === 'fulfilled' && transactionsToDelete && transactionsToDelete.length > 0) {
                    restorePromises.push(
                        this.supabase.from('transactions').insert(transactionsToDelete)
                            .then(() => debug.log('Transactions restored successfully'))
                            .catch(err => debug.error('Failed to restore transactions:', err))
                    );
                }

                // Restore recurring bill references if they were updated
                if (recurringBillResult.status === 'fulfilled' && recurringBillsToUpdate && recurringBillsToUpdate.length > 0) {
                    const billRestorePromises = recurringBillsToUpdate.map(bill => 
                        this.supabase.from('recurring_bills')
                            .update({ account_id: id })
                            .eq('id', bill.id)
                    );
                    restorePromises.push(...billRestorePromises);
                }

                // Wait for all restore operations
                if (restorePromises.length > 0) {
                    await Promise.allSettled(restorePromises);
                    throw new Error(`Account deletion failed: ${accountError.message}. Related data has been restored where possible.`);
                } else {
                    throw new Error(`Account deletion failed: ${accountError.message}`);
                }
            }

            return true;
        } catch (error) {
            this.handleError('deleteCashAccount', error);
        }
    }

    // --- TRANSACTIONS ---
    async getTransactions() {
        return this.executeWithRetry(async () => {
            const { data, error } = await this.supabase.from('transactions').select('*').order('date', { ascending: false });
            if (error) throw error;
            return data || [];
        }, 'getTransactions');
    }

    async addTransaction(transaction) {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase.from('transactions').insert({
                date: transaction.date,
                account_id: transaction.account_id,
                category: transaction.category,
                description: transaction.description,
                amount: transaction.amount,
                cleared: transaction.cleared,
                debt_account_id: transaction.debt_account_id || null,
                user_id: userId
            }).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('addTransaction', error); }
    }

    // NEW: Update transaction method
    async updateTransaction(id, updates) {
        try {
            const { data, error } = await this.supabase.from('transactions').update({
                date: updates.date,
                account_id: updates.account_id,
                category: updates.category,
                description: updates.description,
                amount: updates.amount,
                cleared: updates.cleared,
                debt_account_id: updates.debt_account_id || null
            }).eq('id', id).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('updateTransaction', error); }
    }

    async deleteTransaction(id) {
        try {
            await this.supabase.from('transactions').delete().eq('id', id);
            return true;
        } catch (error) { this.handleError('deleteTransaction', error); }
    }

    // --- TRANSACTION TEMPLATES ---
    async getTransactionTemplates() {
        return this.executeWithRetry(async () => {
            const { data, error } = await this.supabase.from('transaction_templates').select('*').order('name', { ascending: true });
            if (error) throw error;
            return data || [];
        }, 'getTransactionTemplates');
    }
    
    async addTransactionTemplate(template) {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase.from('transaction_templates').insert({
                name: template.name,
                account_id: template.account_id,
                category: template.category,
                description: template.description,
                amount: template.amount,
                debt_account_id: template.debt_account_id || null,
                is_income: template.is_income || false,
                tags: template.tags || [],
                user_id: userId
            }).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('addTransactionTemplate', error); }
    }
    
    async updateTransactionTemplate(id, updates) {
        try {
            const { data, error } = await this.supabase.from('transaction_templates').update({
                name: updates.name,
                account_id: updates.account_id,
                category: updates.category,
                description: updates.description,
                amount: updates.amount,
                debt_account_id: updates.debt_account_id || null,
                is_income: updates.is_income || false,
                tags: updates.tags || []
            }).eq('id', id).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('updateTransactionTemplate', error); }
    }
    
    async deleteTransactionTemplate(id) {
        try {
            await this.supabase.from('transaction_templates').delete().eq('id', id);
            return true;
        } catch (error) { this.handleError('deleteTransactionTemplate', error); }
    }

    // --- INVESTMENTS & HOLDINGS ---
    async getInvestmentAccounts() {
        return this.executeWithRetry(async () => {
            const { data, error } = await this.supabase.from('investment_accounts').select(`*, holdings (*)`).order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        }, 'getInvestmentAccounts');
    }

    async addInvestmentAccount(account) {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase.from('investment_accounts').insert({ 
                name: account.name, 
                institution: account.institution, 
                account_type: account.accountType, 
                balance: account.balance, 
                day_change: account.dayChange,
                user_id: userId
            }).select().single();
            if (error) throw error; 
            return data;
        } catch (error) { this.handleError('addInvestmentAccount', error); }
    }

    async updateInvestmentAccount(id, account) {
        try {
            const { data, error } = await this.supabase.from('investment_accounts').update({ 
                name: account.name, 
                institution: account.institution, 
                account_type: account.accountType, 
                balance: account.balance, 
                day_change: account.dayChange 
            }).eq('id', id).select().single();
            if (error) throw error; 
            return data;
        } catch (error) { this.handleError('updateInvestmentAccount', error); }
    }

    // FIXED: Handle partial failures for investment account deletion
    async deleteInvestmentAccount(id) {
        if (!id) {
            throw new Error('Investment account ID is required');
        }

        try {
            // Get holdings for potential recovery
            const { data: holdingsToDelete } = await this.supabase
                .from('holdings')
                .select('*')
                .eq('investment_account_id', id);

            // Try to delete holdings first
            const { error: holdingsError } = await this.supabase
                .from('holdings')
                .delete()
                .eq('investment_account_id', id);

            if (holdingsError) {
                throw new Error(`Failed to delete holdings: ${holdingsError.message}`);
            }

            // Try to delete the account
            const { error: accountError } = await this.supabase
                .from('investment_accounts')
                .delete()
                .eq('id', id);

            if (accountError) {
                // Attempt to restore holdings
                if (holdingsToDelete && holdingsToDelete.length > 0) {
                    try {
                        await this.supabase.from('holdings').insert(holdingsToDelete);
                        throw new Error(`Account deletion failed: ${accountError.message}. Holdings have been restored.`);
                    } catch (restoreError) {
                        throw new Error(`Account deletion failed AND holdings restoration failed. Data may be in inconsistent state.`);
                    }
                }
                throw new Error(`Account deletion failed: ${accountError.message}`);
            }

            return true;
        } catch (error) { 
            this.handleError('deleteInvestmentAccount', error); 
        }
    }

    async addHolding(accountId, holding) {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase.from('holdings').insert({ 
                ...holding, 
                investment_account_id: accountId,
                user_id: userId
            }).select().single();
            if (error) throw error; 
            return data;
        } catch (error) { this.handleError('addHolding', error); }
    }

    async updateHolding(id, holding) {
        try {
            const { data, error } = await this.supabase.from('holdings').update(holding).eq('id', id).select().single();
            if (error) throw error; 
            return data;
        } catch (error) { this.handleError('updateHolding', error); }
    }

    async deleteHolding(id) {
        try {
            await this.supabase.from('holdings').delete().eq('id', id);
            return true;
        } catch (error) { this.handleError('deleteHolding', error); }
    }

    // --- DEBT ---
    async getDebtAccounts() {
        return this.executeWithRetry(async () => {
            const { data, error } = await this.supabase.from('debt_accounts').select('*');
            if (error) throw error;
            return data || [];
        }, 'getDebtAccounts');
    }

    async addDebtAccount(debtData) {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase.from('debt_accounts').insert({
                name: debtData.name,
                type: debtData.type,
                institution: debtData.institution,
                balance: debtData.balance,
                interest_rate: debtData.interestRate,
                minimum_payment: debtData.minimumPayment,
                due_date: debtData.dueDate,
                credit_limit: debtData.creditLimit,
                notes: debtData.notes,
                user_id: userId
            }).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('addDebtAccount', error); }
    }

    async updateDebtAccount(id, debtData) {
        try {
            const { data, error } = await this.supabase.from('debt_accounts').update({
                name: debtData.name,
                type: debtData.type,
                institution: debtData.institution,
                balance: debtData.balance,
                interest_rate: debtData.interestRate,
                minimum_payment: debtData.minimumPayment,
                due_date: debtData.dueDate,
                credit_limit: debtData.creditLimit,
                notes: debtData.notes
            }).eq('id', id).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('updateDebtAccount', error); }
    }

    async deleteDebtAccount(id) {
        try {
            await this.supabase.from('debt_accounts').delete().eq('id', id);
            return true;
        } catch (error) { this.handleError('deleteDebtAccount', error); }
    }

    async updateDebtBalance(debtId, newBalance) {
        try {
            const { data, error } = await this.supabase.from('debt_accounts').update({ balance: newBalance }).eq('id', debtId).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('updateDebtBalance', error); }
    }

    // Helper methods for TransactionManager
    async getCashAccountById(id) {
        try {
            const { data, error } = await this.supabase.from('cash_accounts').select('*').eq('id', id).single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('getCashAccountById', error); }
    }

    async getDebtAccountById(id) {
        try {
            const { data, error } = await this.supabase.from('debt_accounts').select('*').eq('id', id).single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('getDebtAccountById', error); }
    }


    // --- RECURRING BILLS - UPDATED TO SUPPORT CREDIT CARD PAYMENTS ---
    async getRecurringBills() {
        return this.executeWithRetry(async () => {
            const { data, error } = await this.supabase.from('recurring_bills').select('*');
            if (error) throw error;
            return data || [];
        }, 'getRecurringBills');
    }

    async addRecurringBill(bill) {
        try {
            const userId = await this.getCurrentUserId();
            // UPDATED: Support payment method and debt account
            const billData = {
                name: bill.name,
                category: bill.category,
                amount: bill.amount,
                frequency: bill.frequency,
                next_due: bill.next_due,
                account_id: bill.account_id,
                payment_method: bill.payment_method || 'cash', // 'cash' or 'credit'
                debt_account_id: bill.debt_account_id || null, // For credit card payments
                notes: bill.notes || null,
                active: bill.active !== undefined ? bill.active : true,
                user_id: userId
            };

            const { data, error } = await this.supabase.from('recurring_bills').insert(billData).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError('addRecurringBill', error);
        }
    }

    async updateRecurringBill(id, bill) {
        try {
            // UPDATED: Support payment method and debt account
            const billData = {
                name: bill.name,
                category: bill.category,
                amount: bill.amount,
                frequency: bill.frequency,
                next_due: bill.next_due || bill.next_due_date,
                account_id: bill.account_id,
                payment_method: bill.payment_method || 'cash',
                last_paid_date: bill.last_paid_date,
                debt_account_id: bill.debt_account_id || null,
                notes: bill.notes || null,
                active: bill.active !== undefined ? bill.active : true
            };

            const { data, error } = await this.supabase.from('recurring_bills').update(billData).eq('id', id).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError('updateRecurringBill', error);
        }
    }

    async getRecurringBillById(id) {
        return this.executeWithRetry(async () => {
            const { data, error } = await this.supabase.from('recurring_bills').select('*').eq('id', id).single();
            if (error) throw error;
            return data;
        }, 'getRecurringBillById');
    }

    async deleteRecurringBill(id) {
        try {
            await this.supabase.from('recurring_bills').delete().eq('id', id);
            return true;
        } catch (error) { this.handleError('deleteRecurringBill', error); }
    }

    // --- SAVINGS GOALS ---
    async getSavingsGoals() {
        return this.executeWithRetry(async () => {
            const { data, error } = await this.supabase.from('savings_goals').select('*');
            if (error) throw error;
            return data || [];
        }, 'getSavingsGoals');
    }

    async addSavingsGoal(goalData) {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase.from('savings_goals').insert({
                ...goalData,
                user_id: userId
            }).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('addSavingsGoal', error); }
    }

    async updateSavingsGoal(id, goalData) {
        try {
            const { data, error } = await this.supabase.from('savings_goals').update(goalData).eq('id', id).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('updateSavingsGoal', error); }
    }

    async deleteSavingsGoal(id) {
        try {
            await this.supabase.from('savings_goals').delete().eq('id', id);
            return true;
        } catch (error) { this.handleError('deleteSavingsGoal', error); }
    }

    // Smart Rules operations
    async getSmartRules(enabled = null) {
        try {
            let query = this.supabase.from('smart_rules').select('*')
            if (enabled !== null) {
                query = query.eq('enabled', enabled)
            }
            const { data, error } = await query.order('priority', { ascending: false })
            if (error) throw error;
            return data || [];
        } catch (error) { this.handleError('getSmartRules', error); }
    }

    async createSmartRule(ruleData) {
        try {
            const userId = await this.getCurrentUserId();
            
            // Generate UUID on client side as a fallback
            // This ensures we always have an ID even if server-side generation fails
            const id = crypto.randomUUID ? crypto.randomUUID() : 
                      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                          const r = Math.random() * 16 | 0;
                          const v = c === 'x' ? r : (r & 0x3 | 0x8);
                          return v.toString(16);
                      });
            
            // Ensure we don't pass any undefined or null values
            const insertData = {
                id: id,  // Explicitly provide ID
                user_id: userId,
                name: ruleData.name,
                description: ruleData.description || '',
                enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
                priority: ruleData.priority || 0,
                conditions: ruleData.conditions || {},
                actions: ruleData.actions || {},
                stats: ruleData.stats || { matches: 0, last_matched: null }
            };
            
            // Remove any undefined values
            Object.keys(insertData).forEach(key => {
                if (insertData[key] === undefined) {
                    delete insertData[key];
                }
            });
            
            const { data, error } = await this.supabase
                .from('smart_rules')
                .insert(insertData)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('createSmartRule', error); }
    }

    async updateSmartRule(id, updates) {
        try {
            const { data, error } = await this.supabase
                .from('smart_rules')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('updateSmartRule', error); }
    }

    async deleteSmartRule(id) {
        try {
            const { error } = await this.supabase
                .from('smart_rules')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) { this.handleError('deleteSmartRule', error); }
    }

    // --- PAY SCHEDULES ---
    async getPaySchedules(activeOnly = false) {
        try {
            let query = this.supabase.from('pay_schedules').select('*')
            if (activeOnly) {
                query = query.eq('is_active', true)
            }
            const { data, error } = await query.order('created_at', { ascending: false })
            if (error) throw error;
            return data || [];
        } catch (error) { 
            this.handleError('getPaySchedules', error);
            return [];
        }
    }

    async createPaySchedule(scheduleData) {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase.from('pay_schedules').insert({
                ...scheduleData,
                user_id: userId
            }).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('createPaySchedule', error); }
    }

    async updatePaySchedule(id, scheduleData) {
        try {
            const { data, error } = await this.supabase
                .from('pay_schedules')
                .update(scheduleData)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('updatePaySchedule', error); }
    }

    async deletePaySchedule(id) {
        try {
            const { error } = await this.supabase
                .from('pay_schedules')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) { this.handleError('deletePaySchedule', error); }
    }

    // --- BATCH OPERATIONS ---
    /**
     * Batch update holdings
     * @param {Array} updates - Array of {id, updates} objects
     * @returns {Promise<Array>} Array of results with success/error status for each update
     */
    async batchUpdateHoldings(updates) {
        const results = [];
        
        // Process updates in parallel for better performance
        const updatePromises = updates.map(async (update, index) => {
            try {
                const data = await this.updateHolding(update.id, update.updates);
                results[index] = { success: true, data };
            } catch (error) {
                results[index] = { success: false, error };
            }
        });
        
        await Promise.all(updatePromises);
        return results;
    }

    /**
     * Batch update savings goals
     * @param {Array} updates - Array of {id, updates} objects
     * @returns {Promise<Array>} Array of results with success/error status for each update
     */
    async batchUpdateSavingsGoals(updates) {
        const results = [];
        
        // Process updates in parallel for better performance
        const updatePromises = updates.map(async (update, index) => {
            try {
                const data = await this.updateSavingsGoal(update.id, update.updates);
                results[index] = { success: true, data };
            } catch (error) {
                results[index] = { success: false, error };
            }
        });
        
        await Promise.all(updatePromises);
        return results;
    }

    /**
     * Batch update transactions
     * @param {Array} updates - Array of {id, updates} objects
     * @returns {Promise<Array>} Array of results with success/error status for each update
     */
    async batchUpdateTransactions(updates) {
        const results = [];
        
        // Process updates in parallel for better performance
        const updatePromises = updates.map(async (update, index) => {
            try {
                const data = await this.updateTransaction(update.id, update.updates);
                results[index] = { success: true, data };
            } catch (error) {
                results[index] = { success: false, error };
            }
        });
        
        await Promise.all(updatePromises);
        return results;
    }

    // Financial Snapshots - Historical Tracking
    async captureFinancialSnapshot(snapshotType = 'daily') {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase
                .rpc('capture_financial_snapshot', {
                    p_user_id: userId,
                    p_snapshot_type: snapshotType
                });

            if (error) throw error;
            return data;
        } catch (error) {
            this.handleError('captureFinancialSnapshot', error);
        }
    }

    async getSnapshotComparison(comparisonType = 'month') {
        try {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase
                .rpc('get_snapshot_comparison', {
                    p_user_id: userId,
                    p_comparison_type: comparisonType
                });

            if (error) throw error;
            return data?.[0] || null; // RPC returns array, we need first row
        } catch (error) {
            this.handleError('getSnapshotComparison', error);
        }
    }

    async getHistoricalSnapshots(limit = 30, snapshotType = null) {
        try {
            const userId = await this.getCurrentUserId();
            let query = this.supabase
                .from('financial_snapshots')
                .select('*')
                .eq('user_id', userId)
                .order('snapshot_date', { ascending: false })
                .limit(limit);

            if (snapshotType) {
                query = query.eq('snapshot_type', snapshotType);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            this.handleError('getHistoricalSnapshots', error);
        }
    }

    async getDebtHistoricalChange(debtAccountId = null) {
        try {
            const userId = await this.getCurrentUserId();
            
            // Get current month and last month snapshots
            const currentDate = new Date();
            const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
            
            const { data: snapshots, error } = await this.supabase
                .from('financial_snapshots')
                .select('snapshot_date, total_debt, account_details')
                .eq('user_id', userId)
                .gte('snapshot_date', lastMonth.toISOString().split('T')[0])
                .order('snapshot_date', { ascending: false })
                .limit(2);

            if (error) throw error;
            
            if (!snapshots || snapshots.length < 2) {
                return { change: 0, isEstimate: true };
            }

            const current = snapshots[0];
            const previous = snapshots[1];
            
            if (debtAccountId && current.account_details?.debt_accounts && previous.account_details?.debt_accounts) {
                // Calculate change for specific debt account
                const currentAccount = current.account_details.debt_accounts.find(a => a.id === debtAccountId);
                const previousAccount = previous.account_details.debt_accounts.find(a => a.id === debtAccountId);
                
                if (currentAccount && previousAccount) {
                    return {
                        change: previousAccount.balance - currentAccount.balance,
                        isEstimate: false
                    };
                }
            }
            
            // Calculate total debt change
            return {
                change: previous.total_debt - current.total_debt,
                isEstimate: false
            };
        } catch (error) {
            this.handleError('getDebtHistoricalChange', error);
        }
    }

    // ==========================================
    // ATOMIC TRANSACTION SUPPORT
    // ==========================================

    /**
     * Transfer funds between accounts atomically
     * @param {string} fromAccountId - Source account ID
     * @param {string} toAccountId - Destination account ID
     * @param {number} amount - Amount to transfer
     * @param {string} description - Transfer description
     * @returns {Promise<Object>} Transfer result with transaction IDs
     */
    async transferFunds(fromAccountId, toAccountId, amount, description) {
        return this.executeWithRetry(async () => {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase
                .rpc('transfer_funds', {
                    p_from_account_id: fromAccountId,
                    p_to_account_id: toAccountId,
                    p_amount: amount,
                    p_description: description || 'Transfer',
                    p_user_id: userId
                });

            if (error) throw error;
            
            const result = data?.[0];
            if (!result?.success) {
                throw new Error(result?.message || 'Transfer failed');
            }
            
            return result;
        }, 'transferFunds');
    }

    /**
     * Process recurring payment atomically
     * @param {string} billId - Recurring bill ID
     * @returns {Promise<Object>} Payment result with transaction ID and next due date
     */
    async processRecurringPayment(billId) {
        return this.executeWithRetry(async () => {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase
                .rpc('process_recurring_payment', {
                    p_bill_id: billId,
                    p_user_id: userId
                });

            if (error) throw error;
            
            const result = data?.[0];
            if (!result?.success) {
                throw new Error(result?.message || 'Payment processing failed');
            }
            
            return result;
        }, 'processRecurringPayment');
    }

    /**
     * Import transactions in bulk atomically
     * @param {Array} transactions - Array of transaction objects
     * @returns {Promise<Object>} Import result with counts
     */
    async bulkImportTransactions(transactions) {
        return this.executeWithRetry(async () => {
            const userId = await this.getCurrentUserId();
            const { data, error } = await this.supabase
                .rpc('bulk_import_transactions', {
                    p_transactions: JSON.stringify(transactions),
                    p_user_id: userId
                });

            if (error) throw error;
            
            const result = data?.[0];
            if (!result?.success) {
                throw new Error(result?.message || 'Bulk import failed');
            }
            
            return result;
        }, 'bulkImportTransactions');
    }

    /**
     * Execute operation in a transaction-like manner with automatic rollback
     * @param {Function} operation - Async function to execute
     * @param {Function} rollback - Async function to rollback changes
     * @param {string} operationName - Name for logging
     * @returns {Promise<any>} Operation result
     */
    async executeInTransaction(operation, rollback, operationName = 'Transaction') {
        try {
            const result = await operation();
            return result;
        } catch (error) {
            debug.error(`${operationName} failed, attempting rollback`, error);
            
            if (rollback) {
                try {
                    await rollback();
                    debug.log(`${operationName} rollback successful`);
                } catch (rollbackError) {
                    debug.error(`${operationName} rollback failed`, rollbackError);
                    throw new Error(`${operationName} failed and rollback failed: ${error.message}`);
                }
            }
            
            throw error;
        }
    }

    /**
     * Check if RPC functions are available (for migration status)
     * @returns {Promise<Object>} Status of each RPC function
     */
    async checkTransactionSupport() {
        const functions = ['transfer_funds', 'process_recurring_payment', 'bulk_import_transactions'];
        const status = {};
        
        for (const func of functions) {
            try {
                // Try to get function info - this will fail if function doesn't exist
                const { error } = await this.supabase.rpc(func, {});
                status[func] = !error || !error.message.includes('not exist');
            } catch (error) {
                status[func] = false;
            }
        }
        
        return status;
    }
}

const db = new FinancialDatabase();
export default db;