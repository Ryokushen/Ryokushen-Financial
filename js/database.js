// js/database.js
class FinancialDatabase {
    constructor() {
        if (!window.supabaseClient) {
            throw new Error('Supabase client not initialized. Please check your configuration.');
        }
        this.supabase = window.supabaseClient;
    }

    // Helper method for error handling
    handleError(operation, error) {
        console.error(`Database operation failed: ${operation}`, error);
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
                console.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, error);
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
                console.error('Failed to delete transactions:', transactionResult.reason);
            }

            if (recurringBillResult.status === 'rejected') {
                failedOperations.push('recurring bills');
                console.error('Failed to update recurring bills:', recurringBillResult.reason);
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
                console.error('Account deletion failed, attempting to restore related data...');
                
                const restorePromises = [];

                // Restore transactions if they were deleted
                if (transactionResult.status === 'fulfilled' && transactionsToDelete && transactionsToDelete.length > 0) {
                    restorePromises.push(
                        this.supabase.from('transactions').insert(transactionsToDelete)
                            .then(() => console.log('Transactions restored successfully'))
                            .catch(err => console.error('Failed to restore transactions:', err))
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
                next_due: bill.next_due,
                account_id: bill.account_id,
                payment_method: bill.payment_method || 'cash',
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
            const { data, error } = await this.supabase
                .from('smart_rules')
                .insert(ruleData)
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
}

const db = new FinancialDatabase();
export default db;