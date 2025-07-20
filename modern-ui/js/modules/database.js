// Database Module - Supabase Integration

import { API_ENDPOINTS } from '../config.js'
import { showError } from './ui.js'
import getSupabaseClient from '../supabase-client.js'

// Initialize Supabase client
export async function initSupabase() {
  const client = getSupabaseClient()
  console.log('Supabase client initialized:', !!client)
  return client
}

// Get Supabase client
export function getSupabase() {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase not initialized.')
  }
  return client
}

// Generic query builder with error handling
async function executeQuery(queryFn) {
  try {
    const result = await queryFn()
    if (result.error) {
      throw result.error
    }
    return result.data
  } catch (error) {
    console.error('Database query failed:', error)
    showError('Database operation failed. Please try again.')
    throw error
  }
}

// User profile operations
export async function getUserProfile(userId) {
  const supabase = getSupabase()
  return executeQuery(() => 
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
  )
}

export async function updateUserProfile(userId, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
  )
}

// Transaction operations
export async function getTransactions(filters = {}) {
  const supabase = getSupabase()
  let query = supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
  
  // Apply filters
  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.startDate) {
    query = query.gte('date', filters.startDate)
  }
  if (filters.endDate) {
    query = query.lte('date', filters.endDate)
  }
  if (filters.limit) {
    query = query.limit(filters.limit)
  }
  
  return executeQuery(() => query)
}

export async function createTransaction(transaction) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single()
  )
}

export async function updateTransaction(id, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}

export async function deleteTransaction(id) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('transactions')
      .delete()
      .eq('id', id)
  )
}

// Account operations
export async function getCashAccounts() {
  const supabase = getSupabase()
  const accounts = await executeQuery(() =>
    supabase
      .from('cash_accounts')
      .select('*')
      .order('name')
  )
  
  // Calculate balance for each account
  const accountsWithBalances = await Promise.all(
    accounts.map(async (account) => {
      const balance = await calculateAccountBalance(account.id)
      return { ...account, balance }
    })
  )
  
  return accountsWithBalances
}

export async function getCashAccountById(id) {
  const supabase = getSupabase()
  const account = await executeQuery(() =>
    supabase
      .from('cash_accounts')
      .select('*')
      .eq('id', id)
      .single()
  )
  
  // Calculate balance
  const balance = await calculateAccountBalance(id)
  return { ...account, balance }
}

// Calculate account balance from transactions
export async function calculateAccountBalance(accountId) {
  const supabase = getSupabase()
  
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('account_id', accountId)
    
    if (error) throw error
    
    // Sum all transaction amounts
    const balance = transactions.reduce((sum, transaction) => {
      return sum + (transaction.amount || 0)
    }, 0)
    
    return balance
  } catch (error) {
    console.error('Failed to calculate balance:', error)
    return 0
  }
}

export async function createCashAccount(account) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('cash_accounts')
      .insert(account)
      .select()
      .single()
  )
}

export async function updateCashAccount(id, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('cash_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}

export async function deleteCashAccount(id) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('cash_accounts')
      .delete()
      .eq('id', id)
  )
}

// Investment account operations
export async function getInvestmentAccounts() {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('investment_accounts')
      .select('*')
      .order('name')
  )
}

export async function createInvestmentAccount(account) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('investment_accounts')
      .insert(account)
      .select()
      .single()
  )
}

export async function updateInvestmentAccount(id, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('investment_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}

export async function deleteInvestmentAccount(id) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('investment_accounts')
      .delete()
      .eq('id', id)
  )
}

// Debt account operations
export async function getDebtAccounts() {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('debt_accounts')
      .select('*')
      .order('name')
  )
}

export async function createDebtAccount(account) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('debt_accounts')
      .insert(account)
      .select()
      .single()
  )
}

export async function updateDebtAccount(id, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('debt_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}

export async function deleteDebtAccount(id) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('debt_accounts')
      .delete()
      .eq('id', id)
  )
}

// Recurring bills operations
export async function getRecurringBills() {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('recurring_bills')
      .select('*')
      .order('next_due')
  )
}

export async function createRecurringBill(bill) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('recurring_bills')
      .insert(bill)
      .select()
      .single()
  )
}

export async function updateRecurringBill(id, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('recurring_bills')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}

export async function deleteRecurringBill(id) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('recurring_bills')
      .delete()
      .eq('id', id)
  )
}

// Smart rules operations
export async function getSmartRules() {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('smart_rules')
      .select('*')
      .order('priority')
  )
}

export async function createSmartRule(rule) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('smart_rules')
      .insert(rule)
      .select()
      .single()
  )
}

export async function updateSmartRule(id, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('smart_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}

export async function deleteSmartRule(id) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('smart_rules')
      .delete()
      .eq('id', id)
  )
}

// Batch operations
export async function batchCreateTransactions(transactions) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('transactions')
      .insert(transactions)
      .select()
  )
}

export async function batchUpdateTransactions(updates) {
  const supabase = getSupabase()
  const promises = updates.map(({ id, data }) =>
    supabase
      .from('transactions')
      .update(data)
      .eq('id', id)
  )
  
  return Promise.all(promises)
}

// Real-time subscriptions
export function subscribeToTransactions(callback) {
  const supabase = getSupabase()
  
  const subscription = supabase
    .channel('transactions-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions'
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()
  
  return subscription
}

export function subscribeToAccounts(callback) {
  const supabase = getSupabase()
  
  const channels = []
  
  // Subscribe to all account tables
  const tables = ['cash_accounts', 'investment_accounts', 'debt_accounts']
  
  tables.forEach(table => {
    const channel = supabase
      .channel(`${table}-channel`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        (payload) => {
          callback({ ...payload, table })
        }
      )
      .subscribe()
    
    channels.push(channel)
  })
  
  return channels
}

// Unsubscribe from real-time updates
export async function unsubscribe(subscription) {
  if (Array.isArray(subscription)) {
    return Promise.all(subscription.map(s => s.unsubscribe()))
  }
  return subscription.unsubscribe()
}

// Category operations
export async function getCategories() {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('categories')
      .select('*')
      .order('name')
  )
}

export async function createCategory(category) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('categories')
      .insert(category)
      .select()
      .single()
  )
}

export async function updateCategory(id, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}

export async function deleteCategory(id) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('categories')
      .delete()
      .eq('id', id)
  )
}

// Analytics queries
export async function getSpendingByCategory(startDate, endDate) {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .rpc('get_spending_by_category', {
      start_date: startDate,
      end_date: endDate
    })
  
  if (error) throw error
  return data
}

export async function getMonthlyTrends(months = 12) {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .rpc('get_monthly_trends', {
      months_back: months
    })
  
  if (error) throw error
  return data
}

export async function getNetWorthHistory() {
  const supabase = getSupabase()
  
  const { data, error } = await supabase
    .rpc('get_net_worth_history')
  
  if (error) throw error
  return data
}

// Export all functions
export default {
  initSupabase,
  getSupabase,
  // User
  getUserProfile,
  updateUserProfile,
  // Transactions
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  batchCreateTransactions,
  batchUpdateTransactions,
  // Cash Accounts
  getCashAccounts,
  getCashAccountById,
  createCashAccount,
  updateCashAccount,
  deleteCashAccount,
  calculateAccountBalance,
  // Investment Accounts
  getInvestmentAccounts,
  createInvestmentAccount,
  updateInvestmentAccount,
  deleteInvestmentAccount,
  // Debt Accounts
  getDebtAccounts,
  createDebtAccount,
  updateDebtAccount,
  deleteDebtAccount,
  // Recurring Bills
  getRecurringBills,
  createRecurringBill,
  updateRecurringBill,
  deleteRecurringBill,
  // Smart Rules
  getSmartRules,
  createSmartRule,
  updateSmartRule,
  deleteSmartRule,
  // Real-time
  subscribeToTransactions,
  subscribeToAccounts,
  unsubscribe,
  // Analytics
  getSpendingByCategory,
  getMonthlyTrends,
  getNetWorthHistory,
  // Categories
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
}