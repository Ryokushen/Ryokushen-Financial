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
  { value: 'Transfer', label: 'Transfer', type: 'transfer' },
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
    // Check if this is a transfer transaction
    if (transactionData.category === 'Transfer' || 
        ['Savings', 'Investment', 'Transfer'].includes(transactionData.category)) {
      currentType = 'transfer'
    } else if (transactionData.amount > 0) {
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
        // Show/hide To Account field for transfers
        updateTransferFields(formId, value)
      }
    },
    {
      name: 'account_id',
      label: 'Account',
      type: 'select',
      options: accountOptions,
      required: true,
      value: transactionData?.account_id || '',
      placeholder: 'Select account',
      onChange: (value) => {
        // Update the "To Account" dropdown to exclude the selected account
        updateToAccountOptions(formId, value, accountOptions)
      }
    },
    {
      name: 'to_account_id',
      label: 'To Account',
      type: 'select',
      options: accountOptions.filter(acc => acc.value !== transactionData?.account_id),
      required: false,
      value: transactionData?.to_account_id || '',
      placeholder: 'Select destination account',
      hidden: currentType !== 'transfer',
      className: 'transfer-only'
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
        
        // Handle transfers differently
        if (data.type === 'transfer') {
          // Validate that both accounts are selected
          if (!data.to_account_id) {
            throw new Error('Please select a destination account for the transfer')
          }
          
          if (data.account_id === data.to_account_id) {
            throw new Error('Cannot transfer to the same account')
          }
          
          const fromAccount = allAccounts.find(acc => acc.id === data.account_id)
          const toAccount = allAccounts.find(acc => acc.id === data.to_account_id)
          
          const transferAmount = parseFloat(data.amount)
          
          // Create two linked transactions for the transfer
          const transferNote = data.notes ? `Transfer: ${data.notes}` : 'Transfer'
          
          // Transaction 1: Withdrawal from source account
          const fromTransaction = {
            date: data.date,
            account_id: data.account_id,
            amount: fromAccount?.account_type === 'debt' ? transferAmount : -transferAmount,
            category: 'Transfer',
            description: `Transfer to ${toAccount?.name || 'Account'}`,
            notes: transferNote,
            cleared: data.cleared,
            user_id: user.id
          }
          
          // Transaction 2: Deposit to destination account
          const toTransaction = {
            date: data.date,
            account_id: data.to_account_id,
            amount: toAccount?.account_type === 'debt' ? -transferAmount : transferAmount,
            category: 'Transfer',
            description: `Transfer from ${fromAccount?.name || 'Account'}`,
            notes: transferNote,
            cleared: data.cleared,
            user_id: user.id
          }
          
          // Create both transactions
          if (isEdit) {
            // For edits, we'll need to update the transfer logic later
            throw new Error('Editing transfers is not yet supported')
          } else {
            await createTransaction(fromTransaction)
            await createTransaction(toTransaction)
            await modalManager.showSuccess('Transfer completed successfully!')
          }
        } else {
          // Handle regular income/expense transactions
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

// Show/hide transfer-related fields
function updateTransferFields(formId, type) {
  const form = document.getElementById(formId)
  if (!form) return

  const toAccountField = form.querySelector('.form-group:has([name="to_account_id"])')
  const categoryField = form.querySelector('.form-group:has([name="category"])')
  
  if (type === 'transfer') {
    // Show To Account field
    if (toAccountField) {
      toAccountField.style.display = 'block'
      const toAccountSelect = toAccountField.querySelector('select')
      if (toAccountSelect) {
        toAccountSelect.required = true
      }
    }
    // Hide category field for transfers
    if (categoryField) {
      categoryField.style.display = 'none'
      const categorySelect = categoryField.querySelector('select')
      if (categorySelect) {
        categorySelect.required = false
        categorySelect.value = 'Transfer'
      }
    }
  } else {
    // Hide To Account field
    if (toAccountField) {
      toAccountField.style.display = 'none'
      const toAccountSelect = toAccountField.querySelector('select')
      if (toAccountSelect) {
        toAccountSelect.required = false
      }
    }
    // Show category field
    if (categoryField) {
      categoryField.style.display = 'block'
      const categorySelect = categoryField.querySelector('select')
      if (categorySelect) {
        categorySelect.required = true
      }
    }
  }
}

// Update To Account options to exclude the selected From account
function updateToAccountOptions(formId, selectedAccountId, allAccountOptions) {
  const form = document.getElementById(formId)
  if (!form) return
  
  const toAccountSelect = form.querySelector('[name="to_account_id"]')
  if (!toAccountSelect) return
  
  // Get current value
  const currentValue = toAccountSelect.value
  
  // Clear options
  toAccountSelect.innerHTML = '<option value="">Select destination account</option>'
  
  // Add filtered options
  allAccountOptions
    .filter(acc => acc.value !== selectedAccountId)
    .forEach(acc => {
      const option = document.createElement('option')
      option.value = acc.value
      option.textContent = acc.label
      if (acc.value === currentValue) {
        option.selected = true
      }
      toAccountSelect.appendChild(option)
    })
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

  // Setup type change handler and initial visibility
  const formElement = document.getElementById(formId)
  if (formElement) {
    const typeSelect = formElement.querySelector('[name="type"]')
    if (typeSelect) {
      // Set initial visibility
      updateAmountSign(formId, typeSelect.value)
      updateTransferFields(formId, typeSelect.value)
      
      // The event listener is already set up in the form configuration
    }
    
    // Setup account change handler for transfers
    const accountSelect = formElement.querySelector('[name="account_id"]')
    if (accountSelect) {
      // Get all account options for the To Account field updates
      const allAccounts = await getAllAccounts()
      const accountOptions = allAccounts.map(acc => ({
        value: acc.id,
        label: acc.display_name
      }))
      
      accountSelect.addEventListener('change', (e) => {
        updateToAccountOptions(formId, e.target.value, accountOptions)
      })
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