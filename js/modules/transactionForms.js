// Transaction Forms Module - Form configurations for transaction management

import formBuilder from './formBuilder.js'
import { createTransaction, updateTransaction, getCashAccounts, getDebtAccounts, getSupabase } from './database.js'
import modalManager from './modal.js'
import { appState } from '../app.js'

// Transaction categories
const TRANSACTION_CATEGORIES = [
  { value: 'Income', label: 'Income', type: 'income' },
  { value: 'Housing', label: 'Housing', type: 'expense' },
  { value: 'Transportation', label: 'Transportation', type: 'expense' },
  { value: 'Food', label: 'Food & Dining', type: 'expense' },
  { value: 'Utilities', label: 'Utilities', type: 'expense' },
  { value: 'Healthcare', label: 'Healthcare', type: 'expense' },
  { value: 'Insurance', label: 'Insurance', type: 'expense' },
  { value: 'Personal', label: 'Personal', type: 'expense' },
  { value: 'Entertainment', label: 'Entertainment', type: 'expense' },
  { value: 'Shopping', label: 'Shopping', type: 'expense' },
  { value: 'Education', label: 'Education', type: 'expense' },
  { value: 'Savings', label: 'Savings', type: 'transfer' },
  { value: 'Investment', label: 'Investment', type: 'transfer' },
  { value: 'Debt', label: 'Debt Payment', type: 'expense' },
  { value: 'Other', label: 'Other', type: 'expense' }
]

// Transaction types
const TRANSACTION_TYPES = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' }
]

// Get all accounts (cash and debt) for dropdown
async function getAllAccounts() {
  const [cashAccounts, debtAccounts] = await Promise.all([
    getCashAccounts(),
    getDebtAccounts()
  ])
  
  // Combine and format accounts
  const allAccounts = [
    ...cashAccounts.map(acc => ({
      ...acc,
      display_name: `${acc.name} (${acc.type || 'Cash'})`,
      account_type: 'cash'
    })),
    ...debtAccounts.map(acc => ({
      ...acc,
      display_name: `${acc.name} (${acc.type || 'Debt'})`,
      account_type: 'debt'
    }))
  ]
  
  return allAccounts
}

// Create transaction form configuration
export async function createTransactionForm(transactionData = null) {
  const isEdit = transactionData !== null
  const formId = `transaction-form-${Date.now()}`

  // Get all accounts for the dropdown
  const allAccounts = await getAllAccounts()
  const accountOptions = allAccounts.map(acc => ({
    value: acc.id,
    label: acc.display_name
  }))

  // Determine transaction type based on amount if editing
  let currentType = 'expense'
  if (isEdit) {
    if (transactionData.amount > 0) {
      currentType = 'income'
    } else {
      currentType = transactionData.type || 'expense'
    }
  }

  const fields = [
    {
      name: 'date',
      label: 'Date',
      type: 'date',
      required: true,
      value: transactionData?.date || new Date().toISOString().split('T')[0]
    },
    {
      name: 'type',
      label: 'Type',
      type: 'select',
      options: TRANSACTION_TYPES,
      required: true,
      value: currentType,
      onChange: (value) => {
        // Update amount sign when type changes
        updateAmountSign(formId, value)
      }
    },
    {
      name: 'account_id',
      label: 'Account',
      type: 'select',
      options: accountOptions,
      required: true,
      value: transactionData?.account_id || '',
      placeholder: 'Select account'
    },
    {
      name: 'amount',
      label: 'Amount',
      type: 'amount',
      placeholder: '0.00',
      required: true,
      value: Math.abs(transactionData?.amount || 0) || ''
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: TRANSACTION_CATEGORIES,
      required: true,
      value: transactionData?.category || '',
      placeholder: 'Select category'
    },
    {
      name: 'description',
      label: 'Description',
      type: 'text',
      placeholder: 'e.g., Grocery shopping at Whole Foods',
      required: true,
      value: transactionData?.description || ''
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Additional notes or details',
      rows: 3,
      value: transactionData?.notes || ''
    },
    {
      name: 'cleared',
      label: 'Cleared',
      type: 'toggle',
      placeholder: 'Transaction has cleared',
      value: transactionData?.cleared !== false
    }
  ]

  // Create form configuration
  const form = formBuilder.createForm(formId, {
    fields,
    submitText: isEdit ? 'Update Transaction' : 'Add Transaction',
    onSubmit: async (data) => {
      try {
        // Get current user
        const supabase = getSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')
        
        // Find the selected account to check if it's a debt account
        const selectedAccount = allAccounts.find(acc => acc.id === data.account_id)
        const isDebtAccount = selectedAccount?.account_type === 'debt'
        
        // Adjust amount based on type and account type
        let amount = parseFloat(data.amount)
        
        // For debt accounts, handle the amount differently
        if (isDebtAccount) {
          // For debt accounts with standard convention:
          // - Expenses (charges) should be negative
          // - Income (payments) should be positive
          if (data.type === 'expense' && amount > 0) {
            amount = -amount
          } else if (data.type === 'income' && amount < 0) {
            amount = Math.abs(amount)
          }
        } else {
          // For cash accounts (normal behavior)
          if (data.type === 'expense' && amount > 0) {
            amount = -amount
          } else if (data.type === 'income' && amount < 0) {
            amount = Math.abs(amount)
          }
        }
        
        // Prepare transaction data
        const transactionPayload = {
          date: data.date,
          account_id: data.account_id,
          amount: amount,
          category: data.category,
          description: data.description,
          notes: data.notes || null,
          cleared: data.cleared,
          user_id: user.id
        }

        if (isEdit) {
          await updateTransaction(transactionData.id, transactionPayload)
          await modalManager.showSuccess('Transaction updated successfully!')
        } else {
          await createTransaction(transactionPayload)
          await modalManager.showSuccess('Transaction added successfully!')
        }
        
        // Reload transactions with account info
        const { getTransactions } = await import('./database.js')
        const transactions = await getTransactions()
        
        // Join account names
        const accountsMap = new Map(allAccounts.map(acc => [acc.id, acc.name]))
        const transactionsWithAccounts = transactions.map(t => ({
          ...t,
          account_name: accountsMap.get(t.account_id) || '—'
        }))
        
        // Update app state
        appState.data.transactions = transactionsWithAccounts
        
        // Refresh current page
        if (appState.currentPage === 'transactions') {
          const { renderTransactions } = await import('./transactions.js')
          await renderTransactions(appState)
        } else if (appState.currentPage === 'dashboard') {
          const { renderDashboard } = await import('./dashboard.js')
          await renderDashboard(appState)
        } else if (appState.currentPage === 'debt') {
          // Also refresh debt page if we're on it
          const { renderDebt } = await import('./debt.js')
          appState.data.debtAccounts = await getDebtAccounts()
          await renderDebt(appState)
        }
        
        return true
      } catch (error) {
        console.error('Transaction save error:', error)
        throw error
      }
    },
    onValidate: (data) => {
      const errors = {}
      
      // Validate amount
      if (data.amount <= 0) {
        errors.amount = 'Amount must be greater than 0'
      }
      
      // Validate date
      const selectedDate = new Date(data.date)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      
      if (selectedDate > today) {
        errors.date = 'Cannot create transactions in the future'
      }
      
      return Object.keys(errors).length > 0 ? errors : null
    }
  })

  return { formId, form }
}

// Update amount sign indicator based on transaction type
function updateAmountSign(formId, type) {
  const formElement = document.getElementById(formId)
  if (!formElement) return

  const amountField = formElement.querySelector('[data-field="amount"]')
  if (!amountField) return

  // Remove existing sign indicator
  const existingSign = amountField.querySelector('.amount-sign')
  if (existingSign) {
    existingSign.remove()
  }

  // Add new sign indicator
  if (type === 'expense') {
    const signSpan = document.createElement('span')
    signSpan.className = 'amount-sign negative'
    signSpan.textContent = '-'
    const label = amountField.querySelector('label')
    if (label) {
      label.insertAdjacentElement('afterend', signSpan)
    }
  }
}

// Show transaction form modal
export async function showTransactionModal(transactionData = null) {
  const { formId } = await createTransactionForm(transactionData)
  const isEdit = transactionData !== null

  const modalId = await formBuilder.showFormModal(formId, {
    title: isEdit ? 'Edit Transaction' : 'Add Transaction',
    size: 'medium'
  })

  // Setup type change handler
  const formElement = document.getElementById(formId)
  if (formElement) {
    const typeSelect = formElement.querySelector('[name="type"]')
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        updateAmountSign(formId, e.target.value)
      })
      
      // Set initial amount sign
      updateAmountSign(formId, typeSelect.value)
    }
  }

  return modalId
}

// Quick expense form (simplified)
export async function showQuickExpenseModal() {
  const formId = `quick-expense-form-${Date.now()}`

  // Get all accounts
  const allAccounts = await getAllAccounts()
  const accountOptions = allAccounts.map(acc => ({
    value: acc.id,
    label: acc.display_name
  }))

  // Get default account (first checking account or first account)
  const defaultAccount = allAccounts.find(acc => acc.type === 'checking')?.id || 
                        allAccounts[0]?.id || ''

  const expenseCategories = TRANSACTION_CATEGORIES.filter(cat => cat.type === 'expense')

  const fields = [
    {
      name: 'amount',
      label: 'Amount',
      type: 'amount',
      placeholder: '0.00',
      required: true,
      value: ''
    },
    {
      name: 'description',
      label: 'What did you spend on?',
      type: 'text',
      placeholder: 'e.g., Coffee at Starbucks',
      required: true,
      value: ''
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: expenseCategories,
      required: true,
      value: 'Food',
      width: 'half'
    },
    {
      name: 'account_id',
      label: 'Account',
      type: 'select',
      options: accountOptions,
      required: true,
      value: defaultAccount,
      width: 'half'
    }
  ]

  const form = formBuilder.createForm(formId, {
    fields,
    submitText: 'Add Expense',
    className: 'quick-expense-form',
    onSubmit: async (data) => {
      try {
        // Get current user
        const supabase = getSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')
        
        const transactionPayload = {
          ...data,
          amount: -Math.abs(parseFloat(data.amount)), // Always negative for expenses
          type: 'expense',
          date: new Date().toISOString().split('T')[0],
          cleared: false,
          user_id: user.id
        }

        await createTransaction(transactionPayload)
        await modalManager.showSuccess('Expense added successfully!')
        
        // Reload data and refresh page
        const { getTransactions } = await import('./database.js')
        const transactions = await getTransactions()
        
        // Join account names
        const accountsMap = new Map(allAccounts.map(acc => [acc.id, acc.name]))
        const transactionsWithAccounts = transactions.map(t => ({
          ...t,
          account_name: accountsMap.get(t.account_id) || '—'
        }))
        
        appState.data.transactions = transactionsWithAccounts
        
        if (appState.currentPage === 'transactions') {
          const { renderTransactions } = await import('./transactions.js')
          await renderTransactions(appState)
        }
        
        return true
      } catch (error) {
        console.error('Quick expense error:', error)
        throw error
      }
    }
  })

  return formBuilder.showFormModal(formId, {
    title: 'Quick Add Expense',
    size: 'small'
  })
}