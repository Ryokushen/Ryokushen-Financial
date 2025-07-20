// Transaction Forms Module - Form configurations for transaction management

import formBuilder from './formBuilder.js'
import { createTransaction, updateTransaction, getCashAccounts } from './database.js'
import modalManager from './modal.js'
import { appState } from '../app.js'

// Transaction categories
const TRANSACTION_CATEGORIES = [
  { value: 'income', label: 'Income', type: 'income' },
  { value: 'housing', label: 'Housing', type: 'expense' },
  { value: 'transportation', label: 'Transportation', type: 'expense' },
  { value: 'food', label: 'Food & Dining', type: 'expense' },
  { value: 'utilities', label: 'Utilities', type: 'expense' },
  { value: 'healthcare', label: 'Healthcare', type: 'expense' },
  { value: 'insurance', label: 'Insurance', type: 'expense' },
  { value: 'personal', label: 'Personal', type: 'expense' },
  { value: 'entertainment', label: 'Entertainment', type: 'expense' },
  { value: 'shopping', label: 'Shopping', type: 'expense' },
  { value: 'education', label: 'Education', type: 'expense' },
  { value: 'savings', label: 'Savings', type: 'transfer' },
  { value: 'investment', label: 'Investment', type: 'transfer' },
  { value: 'debt', label: 'Debt Payment', type: 'expense' },
  { value: 'other', label: 'Other', type: 'expense' }
]

// Transaction types
const TRANSACTION_TYPES = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' }
]

// Create transaction form configuration
export async function createTransactionForm(transactionData = null) {
  const isEdit = transactionData !== null
  const formId = `transaction-form-${Date.now()}`

  // Get cash accounts for the account dropdown
  const cashAccounts = await getCashAccounts()
  const accountOptions = cashAccounts.map(acc => ({
    value: acc.id,
    label: `${acc.name} (${acc.account_type})`
  }))

  // Filter categories based on transaction type
  const currentType = transactionData?.type || 'expense'
  const filteredCategories = TRANSACTION_CATEGORIES.filter(cat => 
    cat.type === currentType || cat.type === 'transfer'
  )

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
      value: transactionData?.type || 'expense',
      onChange: (value) => {
        // Update category options when type changes
        updateCategoryOptions(formId, value)
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
      value: transactionData?.amount || ''
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: filteredCategories,
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
      name: 'is_recurring',
      label: 'Recurring Transaction',
      type: 'toggle',
      placeholder: 'This is a recurring transaction',
      value: transactionData?.is_recurring || false
    }
  ]

  // Add transfer fields if type is transfer
  if (currentType === 'transfer') {
    const transferAccountField = {
      name: 'to_account_id',
      label: 'Transfer To',
      type: 'select',
      options: accountOptions.filter(opt => opt.value !== transactionData?.account_id),
      required: true,
      value: transactionData?.to_account_id || '',
      placeholder: 'Select destination account'
    }
    
    // Insert after account field
    const accountIndex = fields.findIndex(f => f.name === 'account_id')
    fields.splice(accountIndex + 1, 0, transferAccountField)
  }

  // Create form configuration
  const form = formBuilder.createForm(formId, {
    fields,
    submitText: isEdit ? 'Update Transaction' : 'Add Transaction',
    onSubmit: async (data) => {
      try {
        // Prepare transaction data
        const transactionPayload = {
          ...data,
          amount: parseFloat(data.amount),
          user_id: appState.user.id
        }

        if (isEdit) {
          await updateTransaction(transactionData.id, transactionPayload)
          await modalManager.showSuccess('Transaction updated successfully!')
        } else {
          await createTransaction(transactionPayload)
          await modalManager.showSuccess('Transaction added successfully!')
        }
        
        // Reload transactions data
        if (window.loadInitialData) {
          await window.loadInitialData()
        }
        
        // Refresh current page
        if (appState.currentPage === 'transactions' || appState.currentPage === 'dashboard') {
          const moduleName = appState.currentPage === 'transactions' ? 'transactions' : 'dashboard'
          const renderFunction = appState.currentPage === 'transactions' ? 'renderTransactions' : 'renderDashboard'
          const module = await import(`./${moduleName}.js`)
          await module[renderFunction](appState)
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
      
      // Validate transfer
      if (data.type === 'transfer') {
        if (!data.to_account_id) {
          errors.to_account_id = 'Destination account is required for transfers'
        }
        if (data.account_id === data.to_account_id) {
          errors.to_account_id = 'Cannot transfer to the same account'
        }
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

// Update category options based on transaction type
function updateCategoryOptions(formId, type) {
  const formElement = document.getElementById(formId)
  if (!formElement) return

  const categorySelect = formElement.querySelector('[name="category"]')
  if (!categorySelect) return

  // Filter categories based on type
  const filteredCategories = TRANSACTION_CATEGORIES.filter(cat => 
    cat.type === type || cat.type === 'transfer'
  )

  // Update options
  categorySelect.innerHTML = `
    <option value="">Select category</option>
    ${filteredCategories.map(cat => `
      <option value="${cat.value}">${cat.label}</option>
    `).join('')}
  `

  // Handle transfer fields
  const toAccountField = formElement.querySelector('[data-field="to_account_id"]')
  
  if (type === 'transfer') {
    // Add transfer field if not exists
    if (!toAccountField) {
      const accountField = formElement.querySelector('[data-field="account_id"]')
      if (accountField) {
        const transferField = createTransferField()
        accountField.parentNode.insertBefore(transferField, accountField.nextSibling)
      }
    }
  } else {
    // Remove transfer field if exists
    if (toAccountField) {
      toAccountField.remove()
    }
  }
}

// Create transfer field HTML
async function createTransferField() {
  const cashAccounts = await getCashAccounts()
  const accountOptions = cashAccounts.map(acc => ({
    value: acc.id,
    label: `${acc.name} (${acc.account_type})`
  }))

  const fieldDiv = document.createElement('div')
  fieldDiv.className = 'form-field form-field--full'
  fieldDiv.setAttribute('data-field', 'to_account_id')
  
  fieldDiv.innerHTML = `
    <label for="to_account_id" class="form-label">Transfer To<span class="required">*</span></label>
    <select id="to_account_id" name="to_account_id" class="form-select" required>
      <option value="">Select destination account</option>
      ${accountOptions.map(opt => `
        <option value="${opt.value}">${opt.label}</option>
      `).join('')}
    </select>
    <p class="form-error" data-error="to_account_id"></p>
  `

  return fieldDiv
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
        updateCategoryOptions(formId, e.target.value)
      })
    }
  }

  return modalId
}

// Quick expense form (simplified)
export async function showQuickExpenseModal() {
  const formId = `quick-expense-form-${Date.now()}`

  // Get cash accounts
  const cashAccounts = await getCashAccounts()
  const accountOptions = cashAccounts.map(acc => ({
    value: acc.id,
    label: `${acc.name} (${acc.account_type})`
  }))

  // Get default account (first checking account or first account)
  const defaultAccount = cashAccounts.find(acc => acc.account_type === 'checking')?.id || 
                        cashAccounts[0]?.id || ''

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
      value: 'food',
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
        const transactionPayload = {
          ...data,
          amount: parseFloat(data.amount),
          type: 'expense',
          date: new Date().toISOString().split('T')[0],
          user_id: appState.user.id
        }

        await createTransaction(transactionPayload)
        await modalManager.showSuccess('Expense added successfully!')
        
        // Reload data
        if (window.loadInitialData) {
          await window.loadInitialData()
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