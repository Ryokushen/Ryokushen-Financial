// Database Module - Supabase Integration

import { API_ENDPOINTS } from '../config.js'
import { showError } from './ui.js'
import getSupabaseClient from '../supabase-client.js'

// Initialize Supabase client
export async function initSupabase() {
  const client = getSupabaseClient()
  console.log('Supabase client initialized:', !!client)
  
  // Warm up the connection with a simple query
  if (client) {
    try {
      console.log('Warming up Supabase connection...')
      const { data, error } = await client
        .from('cash_accounts')
        .select('id')
        .limit(1)
      
      if (!error) {
        console.log('Supabase connection ready')
      }
    } catch (e) {
      console.log('Warmup query failed (non-critical):', e.message)
    }
  }
  
  return client
}

// Set cached auth state (called from app.js when user is authenticated)
export function setCachedAuthUser(user) {
  cachedAuthState = {
    user: user,
    lastCheck: Date.now(),
    cacheExpiry: 30000
  }
  console.log('Auth cache updated for user:', user?.email)
}

// Get Supabase client
export function getSupabase() {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase not initialized.')
  }
  return client
}

// Query timeout configuration
const QUERY_TIMEOUT = 10000 // 10 seconds default (increased for cold starts)
const QUERY_TIMEOUT_LONG = 20000 // 20 seconds for complex queries
const QUERY_TIMEOUT_INITIAL = 15000 // 15 seconds for initial queries (cold start)
const AUTH_CHECK_TIMEOUT = 5000 // 5 seconds for auth check

// Auth state cache
let cachedAuthState = {
  user: null,
  lastCheck: 0,
  cacheExpiry: 30000 // Cache auth state for 30 seconds
}

// Global flag to skip auth checks during initial load
let skipAuthChecks = false

// Global flag for initial load (use longer timeouts)
let isInitialLoad = true

// Set whether to skip auth checks (used during initial load)
export function setSkipAuthChecks(skip) {
  skipAuthChecks = skip
  console.log('Skip auth checks:', skip)
}

// Set initial load state
export function setInitialLoad(initial) {
  isInitialLoad = initial
  console.log('Initial load:', initial)
}

// Create a promise that rejects after timeout
function createTimeoutPromise(ms, queryName = 'Database query') {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${queryName} timed out after ${ms}ms`))
    }, ms)
  })
}

// Wrapper to add timeout to any promise with retry logic
async function withTimeout(promise, timeoutMs = QUERY_TIMEOUT, queryName = 'Database query', retryCount = 0) {
  try {
    const result = await Promise.race([
      promise,
      createTimeoutPromise(timeoutMs, queryName)
    ])
    return result
  } catch (error) {
    console.error(`Query timeout or error for ${queryName}:`, error.message)
    
    // Retry once on timeout with longer timeout
    if (error.message.includes('timed out') && retryCount === 0) {
      console.log(`Retrying ${queryName} with longer timeout...`)
      return withTimeout(promise, timeoutMs * 2, queryName, retryCount + 1)
    }
    
    throw error
  }
}

// Check if auth is cached and still valid
async function getCachedAuth(forceCache = false) {
  const now = Date.now()
  
  // If we have a cached user and it's still valid (or forced), return it immediately
  if (cachedAuthState.user && (forceCache || (now - cachedAuthState.lastCheck) < cachedAuthState.cacheExpiry)) {
    return cachedAuthState.user
  }
  
  // Only refresh cache if not forced and cache is expired
  if (!forceCache) {
    try {
      const supabase = getSupabase()
      const { data: { user } } = await withTimeout(
        supabase.auth.getUser(),
        AUTH_CHECK_TIMEOUT,
        'Auth check'
      )
      
      cachedAuthState = {
        user: user,
        lastCheck: now,
        cacheExpiry: 30000
      }
      
      return user
    } catch (error) {
      // Return last known user if auth check fails
      if (cachedAuthState.user) {
        console.log('Auth check failed, using cached user')
        return cachedAuthState.user
      }
      throw error
    }
  }
  
  return null
}

// Generic query builder with error handling and timeout
async function executeQuery(queryFn, options = {}) {
  const {
    timeout = isInitialLoad ? QUERY_TIMEOUT_INITIAL : QUERY_TIMEOUT,
    queryName = 'Database query',
    fallbackData = null,
    skipAuth = false,
    trustContext = false // New option to trust the context and use cached auth
  } = options
  
  try {
    // Check if user is authenticated (unless skipped)
    if (!skipAuth && !skipAuthChecks) {
      // Use cached auth in trusted contexts (like initial load after sign in)
      const user = await getCachedAuth(trustContext)
      if (!user) {
        throw new Error('User not authenticated')
      }
    }
    
    // Execute the query with timeout
    const result = await withTimeout(
      queryFn(),
      timeout,
      queryName
    )
    
    if (result.error) {
      throw result.error
    }
    
    return result.data
  } catch (error) {
    console.error(`${queryName} failed:`, error.message)
    
    // Handle specific error types
    if (error.message === 'User not authenticated') {
      showError('Please sign in to continue.')
      throw error
    } else if (error.message.includes('timed out')) {
      // Don't show error for auth timeouts if we have fallback data
      if (!error.message.includes('Auth check') || fallbackData === null) {
        showError(`Loading is taking longer than expected. Please try again.`)
      }
      // Return fallback data if provided
      if (fallbackData !== null) {
        console.log(`Returning fallback data for ${queryName}`)
        return fallbackData
      }
    } else {
      showError('Database operation failed. Please try again.')
    }
    
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
  
  // Set timeout based on expected data size
  const timeout = filters.limit && filters.limit <= 100 ? QUERY_TIMEOUT : QUERY_TIMEOUT_LONG
  
  return executeQuery(
    () => query,
    {
      queryName: 'Get transactions',
      timeout: timeout,
      fallbackData: [],
      trustContext: true // Trust cached auth during initial load
    }
  )
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

// Delete all transactions for an account
export async function deleteTransactionsByAccountId(accountId) {
  const supabase = getSupabase()
  
  // First, check how many transactions will be deleted
  const { data: transactions, error: countError } = await supabase
    .from('transactions')
    .select('id')
    .eq('account_id', accountId)
  
  if (countError) {
    console.error('Failed to count transactions:', countError)
  } else {
    console.log(`Found ${transactions?.length || 0} transactions to delete for account ${accountId}`)
  }
  
  // Delete all transactions for this account
  const result = await executeQuery(() =>
    supabase
      .from('transactions')
      .delete()
      .eq('account_id', accountId),
    {
      queryName: 'Delete account transactions',
      timeout: QUERY_TIMEOUT_LONG // Use longer timeout for potentially many deletions
    }
  )
  
  console.log(`Deleted transactions for account ${accountId}`)
  return result
}

// Account operations
export async function getCashAccounts() {
  const supabase = getSupabase()
  
  try {
    // First, get all cash accounts
    const accounts = await executeQuery(
      () => supabase
        .from('cash_accounts')
        .select('*')
        .order('name'),
      {
        queryName: 'Get cash accounts',
        timeout: isInitialLoad ? QUERY_TIMEOUT_INITIAL : QUERY_TIMEOUT,
        fallbackData: [],
        trustContext: true // Trust cached auth during initial load
      }
    )
    
    if (!accounts || accounts.length === 0) {
      return []
    }
    
    // Get all account IDs
    const accountIds = accounts.map(acc => acc.id)
    
    // Single query to get all balances at once (fixes N+1 problem)
    const balances = await executeQuery(
      async () => {
        const { data, error } = await supabase
          .from('transactions')
          .select('account_id, amount')
          .in('account_id', accountIds)
        
        if (error) return { error, data: null }
        
        // Calculate balances in memory
        const balanceMap = {}
        accountIds.forEach(id => balanceMap[id] = 0)
        
        data.forEach(transaction => {
          if (transaction.account_id && transaction.amount) {
            balanceMap[transaction.account_id] += transaction.amount
          }
        })
        
        return { data: balanceMap, error: null }
      },
      {
        queryName: 'Calculate account balances',
        timeout: QUERY_TIMEOUT_LONG, // 15s for potentially large query
        fallbackData: {},
        trustContext: true // Trust cached auth during initial load
      }
    )
    
    // Combine accounts with their balances
    const accountsWithBalances = accounts.map(account => ({
      ...account,
      balance: balances[account.id] || 0
    }))
    
    return accountsWithBalances
    
  } catch (error) {
    console.error('Failed to get cash accounts:', error)
    // Return empty array as fallback
    return []
  }
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
  
  try {
    // First, delete all transactions associated with this account
    console.log(`Starting deletion process for account ${id}...`)
    
    // Delete transactions first (this is critical)
    await deleteTransactionsByAccountId(id)
    
    // Add a small delay to ensure transaction deletion is fully processed
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Then delete the account itself
    console.log(`Deleting cash account ${id}...`)
    const result = await executeQuery(() =>
      supabase
        .from('cash_accounts')
        .delete()
        .eq('id', id),
      {
        queryName: 'Delete cash account'
      }
    )
    
    console.log(`Successfully deleted account ${id}`)
    return result
    
  } catch (error) {
    console.error('Failed to delete cash account:', error)
    throw error
  }
}

// Investment account operations
export async function getInvestmentAccounts() {
  const supabase = getSupabase()
  
  console.log('Querying investment_accounts table with nested holdings...')
  
  const result = await executeQuery(
    () => supabase
      .from('investment_accounts')
      .select('*, holdings (*)')
      .order('name'),
    {
      queryName: 'Get investment accounts',
      timeout: QUERY_TIMEOUT,
      fallbackData: [],
      trustContext: true // Trust cached auth during initial load
    }
  )
  
  console.log('Investment accounts query result:', result)
  console.log('Number of investment accounts found:', result?.length || 0)
  if (result?.length > 0) {
    console.log('First account holdings:', result[0].holdings)
  }
  
  return result
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
  
  try {
    // First, delete all holdings associated with this account
    console.log(`Deleting all holdings for investment account ${id}...`)
    await executeQuery(() =>
      supabase
        .from('holdings')
        .delete()
        .eq('account_id', id),
      {
        queryName: 'Delete account holdings'
      }
    )
    
    // Then delete the account itself
    console.log(`Deleting investment account ${id}...`)
    return executeQuery(() =>
      supabase
        .from('investment_accounts')
        .delete()
        .eq('id', id),
      {
        queryName: 'Delete investment account'
      }
    )
  } catch (error) {
    console.error('Failed to delete investment account:', error)
    throw error
  }
}

// Debt account operations
export async function getDebtAccounts() {
  const supabase = getSupabase()
  
  try {
    // First, get all debt accounts
    const accounts = await executeQuery(
      () => supabase
        .from('debt_accounts')
        .select('*')
        .order('name'),
      {
        queryName: 'Get debt accounts',
        timeout: QUERY_TIMEOUT,
        fallbackData: [],
        trustContext: true
      }
    )
    
    if (!accounts || accounts.length === 0) {
      return []
    }
    
    // Get all account IDs
    const accountIds = accounts.map(acc => acc.id)
    
    // Calculate dynamic balances from transactions (like cash accounts)
    const balances = await executeQuery(
      async () => {
        const { data, error } = await supabase
          .from('transactions')
          .select('account_id, amount')
          .in('account_id', accountIds)
        
        if (error) return { error, data: null }
        
        // Calculate balances for debt accounts
        // For debt accounts (credit cards), the standard convention is:
        // - Negative transactions (charges) increase debt
        // - Positive transactions (payments) decrease debt
        const balanceMap = {}
        accountIds.forEach(id => balanceMap[id] = 0)
        
        data.forEach(transaction => {
          if (transaction.account_id && transaction.amount) {
            // Simply invert the transaction amount for debt calculation
            // Negative amount (charge) becomes positive debt
            // Positive amount (payment) becomes negative debt
            balanceMap[transaction.account_id] += -transaction.amount
          }
        })
        
        return { data: balanceMap, error: null }
      },
      {
        queryName: 'Calculate debt balances',
        timeout: QUERY_TIMEOUT_LONG,
        fallbackData: {},
        trustContext: true
      }
    )
    
    // Combine accounts with their calculated balances
    // If there's a stored balance and no transactions, use the stored balance as initial balance
    const accountsWithBalances = accounts.map(account => ({
      ...account,
      calculated_balance: balances[account.id] || 0,
      balance: balances[account.id] !== undefined ? balances[account.id] : (account.balance || 0)
    }))
    
    return accountsWithBalances
    
  } catch (error) {
    console.error('Failed to get debt accounts:', error)
    return []
  }
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
  
  try {
    // First, delete all transactions associated with this account
    console.log(`Deleting all transactions for debt account ${id}...`)
    await deleteTransactionsByAccountId(id)
    
    // Add a small delay to ensure transaction deletion is fully processed
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Then delete the account itself
    console.log(`Deleting debt account ${id}...`)
    return executeQuery(() =>
      supabase
        .from('debt_accounts')
        .delete()
        .eq('id', id),
      {
        queryName: 'Delete debt account'
      }
    )
  } catch (error) {
    console.error('Failed to delete debt account:', error)
    throw error
  }
}

// Calculate debt account balance from transactions
export async function calculateDebtBalance(accountId) {
  const supabase = getSupabase()
  
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount')
      .eq('account_id', accountId)
    
    if (error) throw error
    
    // For debt accounts with standard convention:
    // - Negative amounts (charges) increase debt
    // - Positive amounts (payments) decrease debt
    const balance = transactions.reduce((sum, transaction) => {
      const amount = transaction.amount || 0
      // Simply invert the amount
      return sum + (-amount)
    }, 0)
    
    return balance
  } catch (error) {
    console.error('Failed to calculate debt balance:', error)
    return 0
  }
}

// Recurring bills operations
export async function getRecurringBills() {
  const supabase = getSupabase()
  return executeQuery(
    () => supabase
      .from('recurring_bills')
      .select('*')
      .order('next_due'),
    {
      queryName: 'Get recurring bills',
      timeout: QUERY_TIMEOUT,
      fallbackData: [],
      trustContext: true // Trust cached auth during initial load
    }
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
  return executeQuery(
    () => supabase
      .from('smart_rules')
      .select('*')
      .order('priority'),
    {
      queryName: 'Get smart rules',
      timeout: QUERY_TIMEOUT,
      fallbackData: [],
      trustContext: true // Trust cached auth during initial load
    }
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

// Holdings operations
export async function getHoldings(accountId = null) {
  const supabase = getSupabase()
  let query = supabase
    .from('holdings')
    .select('*')
    .order('symbol')
  
  if (accountId) {
    query = query.eq('account_id', accountId)
  }
  
  return executeQuery(
    () => query,
    {
      queryName: 'Get holdings',
      timeout: QUERY_TIMEOUT,
      fallbackData: [],
      trustContext: true
    }
  )
}

export async function createHolding(holding) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('holdings')
      .insert(holding)
      .select()
      .single()
  )
}

export async function updateHolding(id, updates) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('holdings')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
  )
}

export async function deleteHolding(id) {
  const supabase = getSupabase()
  return executeQuery(() =>
    supabase
      .from('holdings')
      .delete()
      .eq('id', id)
  )
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

// Create default categories for a new user
export async function createDefaultCategoriesForUser(userId) {
  const defaultCategories = [
    { user_id: userId, name: 'Income', icon: '💰', color: '#10b981' },
    { user_id: userId, name: 'Housing', icon: '🏠', color: '#3b82f6' },
    { user_id: userId, name: 'Transportation', icon: '🚗', color: '#8b5cf6' },
    { user_id: userId, name: 'Food', icon: '🍔', color: '#f59e0b' },
    { user_id: userId, name: 'Utilities', icon: '💡', color: '#06b6d4' },
    { user_id: userId, name: 'Healthcare', icon: '🏥', color: '#ef4444' },
    { user_id: userId, name: 'Entertainment', icon: '🎬', color: '#ec4899' },
    { user_id: userId, name: 'Shopping', icon: '🛍️', color: '#f97316' },
    { user_id: userId, name: 'Education', icon: '📚', color: '#6366f1' },
    { user_id: userId, name: 'Travel', icon: '✈️', color: '#14b8a6' },
    { user_id: userId, name: 'Insurance', icon: '🛡️', color: '#84cc16' },
    { user_id: userId, name: 'Savings', icon: '🏦', color: '#22c55e' },
    { user_id: userId, name: 'Investment', icon: '📈', color: '#0ea5e9' },
    { user_id: userId, name: 'Debt Payment', icon: '💳', color: '#dc2626' },
    { user_id: userId, name: 'Other', icon: '📌', color: '#64748b' }
  ]
  
  const supabase = getSupabase()
  
  try {
    // Check if user already has categories
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
    
    if (existing && existing.length > 0) {
      console.log('User already has categories')
      return existing
    }
    
    // Create categories
    const { data, error } = await supabase
      .from('categories')
      .insert(defaultCategories)
      .select()
    
    if (error) throw error
    
    console.log(`Created ${data.length} default categories for user`)
    return data
  } catch (error) {
    console.error('Failed to create default categories:', error)
    throw error
  }
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

// Test investment accounts directly (for debugging)
export async function testInvestmentAccountsConnection() {
  console.log('Testing investment accounts connection...')
  try {
    const supabase = getSupabase()
    const start = Date.now()
    
    // Query investment accounts directly
    const { data, error } = await supabase
      .from('investment_accounts')
      .select('*')
    
    const elapsed = Date.now() - start
    
    if (error) {
      console.error('Investment accounts test failed:', error)
      return { success: false, error: error.message, elapsed }
    }
    
    console.log(`Investment accounts test successful in ${elapsed}ms:`, data)
    console.log(`Found ${data?.length || 0} investment accounts`)
    return { success: true, data, elapsed }
  } catch (e) {
    console.error('Investment accounts test error:', e)
    return { success: false, error: e.message }
  }
}

// Test database connection directly (for debugging)
export async function testDatabaseConnection() {
  console.log('Testing direct database connection...')
  try {
    const supabase = getSupabase()
    const start = Date.now()
    
    // Simple query with no auth check
    const { data, error } = await supabase
      .from('cash_accounts')
      .select('id, name')
      .limit(1)
    
    const elapsed = Date.now() - start
    
    if (error) {
      console.error('Database test failed:', error)
      return { success: false, error: error.message, elapsed }
    }
    
    console.log(`Database test successful in ${elapsed}ms:`, data)
    return { success: true, data, elapsed }
  } catch (e) {
    console.error('Database test error:', e)
    return { success: false, error: e.message }
  }
}

// Export all functions
export default {
  initSupabase,
  getSupabase,
  testDatabaseConnection,
  // User
  getUserProfile,
  updateUserProfile,
  // Transactions
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteTransactionsByAccountId,
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
  calculateDebtBalance,
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
  // Holdings
  getHoldings,
  createHolding,
  updateHolding,
  deleteHolding,
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
  createDefaultCategoriesForUser,
}