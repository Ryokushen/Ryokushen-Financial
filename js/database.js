// js/database.js
class FinancialDatabase {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    // Helper method for error handling
    handleError(operation, error) {
        console.error(`Error in ${operation}:`, error);
        throw new Error(`Database operation failed: ${operation}`);
    }

    // --- CASH ACCOUNTS ---
    async getCashAccounts() {
        try {
            const { data, error } = await this.supabase.from('cash_accounts').select('*').order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (error) { this.handleError('getCashAccounts', error); }
    }

    async addCashAccount(account) {
        try {
            const { data, error } = await this.supabase.from('cash_accounts').insert({
                name: account.name,
                type: account.type,
                institution: account.institution,
                notes: account.notes,
                is_active: account.isActive
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

    async deleteCashAccount(id) {
        try {
            await this.supabase.from('transactions').delete().eq('account_id', id);
            await this.supabase.from('cash_accounts').delete().eq('id', id);
            return true;
        } catch (error) {
            this.handleError('deleteCashAccount', error);
        }
    }

    // --- TRANSACTIONS ---
    async getTransactions() {
        try {
            const { data, error } = await this.supabase.from('transactions').select('*').order('date', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (error) { this.handleError('getTransactions', error); }
    }

    async addTransaction(transaction) {
        try {
            const { data, error } = await this.supabase.from('transactions').insert({
                date: transaction.date,
                account_id: transaction.account_id,
                category: transaction.category,
                description: transaction.description,
                amount: transaction.amount,
                cleared: transaction.cleared,
                debt_account_id: transaction.debt_account_id || null // FIX: Save the ID, not the name
            }).select().single();
            if (error) throw error;
            return data;
        } catch (error) { this.handleError('addTransaction', error); }
    }

    async deleteTransaction(id) {
        try {
            await this.supabase.from('transactions').delete().eq('id', id);
            return true;
        } catch (error) { this.handleError('deleteTransaction', error); }
    }

    // --- INVESTMENTS & HOLDINGS ---
    async getInvestmentAccounts() {
        try {
            const { data, error } = await this.supabase.from('investment_accounts').select(`*, holdings (*)`).order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (error) { this.handleError('getInvestmentAccounts', error); }
    }

    async addInvestmentAccount(account) {
        try {
            const { data, error } = await this.supabase.from('investment_accounts').insert({ name: account.name, institution: account.institution, account_type: account.accountType, balance: account.balance, day_change: account.dayChange }).select().single();
            if (error) throw error; return data;
        } catch (error) { this.handleError('addInvestmentAccount', error); }
    }

    async updateInvestmentAccount(id, account) {
        try {
            const { data, error } = await this.supabase.from('investment_accounts').update({ name: account.name, institution: account.institution, account_type: account.accountType, balance: account.balance, day_change: account.dayChange }).eq('id', id).select().single();
            if (error) throw error; return data;
        } catch (error) { this.handleError('updateInvestmentAccount', error); }
    }

    async deleteInvestmentAccount(id) {
        try {
            await this.supabase.from('holdings').delete().eq('account_id', id);
            await this.supabase.from('investment_accounts').delete().eq('id', id);
            return true;
        } catch (error) { this.handleError('deleteInvestmentAccount', error); }
    }

    async addHolding(accountId, holding) {
        try {
            const { data, error } = await this.supabase.from('holdings').insert({ ...holding, investment_account_id: accountId }).select().single();
            if (error) throw error; return data;
        } catch (error) { this.handleError('addHolding', error); }
    }

    async updateHolding(id, holding) {
        try {
            const { data, error } = await this.supabase.from('holdings').update(holding).eq('id', id).select().single();
            if (error) throw error; return data;
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
        try {
            const { data, error } = await this.supabase.from('debt_accounts').select('*');
            if (error) throw error;
            return data || [];
        } catch (error) { this.handleError('getDebtAccounts', error); }
    }

    async addDebtAccount(debtData) {
        try {
            const { data, error } = await this.supabase.from('debt_accounts').insert({
                name: debtData.name,
                type: debtData.type,
                institution: debtData.institution,
                balance: debtData.balance,
                interest_rate: debtData.interestRate,
                minimum_payment: debtData.minimumPayment,
                due_date: debtData.dueDate,
                credit_limit: debtData.creditLimit,
                notes: debtData.notes
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

    // --- RECURRING BILLS ---
    // FIX FOR ISSUE 2: Consistent schema mapping
    async getRecurringBills() {
        try {
            const { data, error } = await this.supabase.from('recurring_bills').select('*');
            if (error) throw error;
            return data || [];
        } catch (error) { this.handleError('getRecurringBills', error); }
    }

    async addRecurringBill(bill) {
        try {
            // FIX: Consistent mapping to 'active' column
            const billData = {
                name: bill.name,
                category: bill.category,
                amount: bill.amount,
                frequency: bill.frequency,
                next_due: bill.next_due,
                account_id: bill.account_id,
                notes: bill.notes || null,
                active: bill.active !== undefined ? bill.active : true  // Simplified, using 'active' directly
            };

            console.log('Database: Inserting bill data:', billData);

            const { data, error } = await this.supabase.from('recurring_bills').insert(billData).select().single();
            if (error) {
                console.error('Supabase insert error:', error);
                throw error;
            }
            return data;
        } catch (error) {
            console.error('addRecurringBill error:', error);
            this.handleError('addRecurringBill', error);
        }
    }

    async updateRecurringBill(id, bill) {
        try {
            // FIX: Consistent mapping to 'active' column
            const billData = {
                name: bill.name,
                category: bill.category,
                amount: bill.amount,
                frequency: bill.frequency,
                next_due: bill.next_due,
                account_id: bill.account_id,
                notes: bill.notes || null,
                active: bill.active !== undefined ? bill.active : true  // Simplified, using 'active' directly
            };

            console.log('Database: Updating bill data:', billData);

            const { data, error } = await this.supabase.from('recurring_bills').update(billData).eq('id', id).select().single();
            if (error) {
                console.error('Supabase update error:', error);
                throw error;
            }
            return data;
        } catch (error) {
            console.error('updateRecurringBill error:', error);
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
        try {
            const { data, error } = await this.supabase.from('savings_goals').select('*');
            if (error) throw error;
            return data || [];
        } catch (error) { this.handleError('getSavingsGoals', error); }
    }

    async addSavingsGoal(goalData) {
        try {
            const { data, error } = await this.supabase.from('savings_goals').insert(goalData).select().single();
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
}

const db = new FinancialDatabase();
export default db;