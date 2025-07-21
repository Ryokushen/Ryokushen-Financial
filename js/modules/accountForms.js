// Account Forms Module - Form configurations for account management

import formBuilder from './formBuilder.js'
import { createCashAccount, updateCashAccount, createTransaction, getSupabase } from './database.js'
import modalManager from './modal.js'
import { appState } from '../app.js'

// Account types
const ACCOUNT_TYPES = {
  CASH: [
    { value: 'checking', label: 'Checking Account' },
    { value: 'savings', label: 'Savings Account' },
    { value: 'money_market', label: 'Money Market' },
    { value: 'cash', label: 'Cash on Hand' }
  ],
  INVESTMENT: [
    { value: '401k', label: '401(k)' },
    { value: 'ira', label: 'IRA' },
    { value: 'roth_ira', label: 'Roth IRA' },
    { value: 'brokerage', label: 'Brokerage' },
    { value: 'crypto', label: 'Cryptocurrency' }
  ],
  DEBT: [
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'mortgage', label: 'Mortgage' },
    { value: 'auto_loan', label: 'Auto Loan' },
    { value: 'student_loan', label: 'Student Loan' },
    { value: 'personal_loan', label: 'Personal Loan' }
  ]
}

// Currency options
const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' }
]

// Create cash account form configuration
export function createCashAccountForm(accountData = null) {
  const isEdit = accountData !== null
  const formId = `cash-account-form-${Date.now()}`

  const fields = [
    {
      name: 'name',
      label: 'Account Name',
      type: 'text',
      placeholder: 'e.g., Main Checking',
      required: true,
      value: accountData?.name || ''
    },
    {
      name: 'type',
      label: 'Account Type',
      type: 'select',
      options: ACCOUNT_TYPES.CASH,
      required: true,
      value: accountData?.type || 'checking'
    },
    {
      name: 'institution',
      label: 'Bank Name',
      type: 'text',
      placeholder: 'e.g., Chase Bank',
      value: accountData?.institution || ''
    },
    {
      name: 'initial_balance',
      label: 'Initial Balance',
      type: 'amount',
      placeholder: '0.00',
      required: true,
      value: accountData?.initial_balance || '',
      helpText: 'Starting balance for this account',
      disabled: isEdit // Can't change initial balance when editing
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Any additional notes about this account',
      rows: 3,
      value: accountData?.notes || ''
    },
    {
      name: 'is_active',
      label: 'Active Account',
      type: 'toggle',
      placeholder: 'Account is currently active',
      value: accountData?.is_active !== false
    }
  ]

  // Create form configuration
  const form = formBuilder.createForm(formId, {
    fields,
    submitText: isEdit ? 'Update Account' : 'Create Account',
    onSubmit: async (data) => {
      try {
        // Get current user
        const supabase = getSupabase()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('User not authenticated')
        
        if (isEdit) {
          // Remove fields that shouldn't be updated
          const { initial_balance, ...updateData } = data
          await updateCashAccount(accountData.id, updateData)
          await modalManager.showSuccess('Account updated successfully!')
        } else {
          // Create account
          const { initial_balance, ...accountData } = data
          const newAccount = await createCashAccount({
            ...accountData,
            user_id: user.id
          })
          
          // Create initial balance transaction if needed
          if (initial_balance && initial_balance !== 0) {
            await createTransaction({
              user_id: user.id,
              account_id: newAccount.id,
              amount: parseFloat(initial_balance), // Ensure it's a number
              description: 'Initial Balance',
              category: 'Income',
              date: new Date().toISOString().split('T')[0],
              cleared: true
              // Removed 'notes' field as it doesn't exist in transactions table
            })
            
            // Small delay to ensure transaction is saved
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          
          await modalManager.showSuccess('Account created successfully!')
        }
        
        // Reload accounts data - add delay to ensure database is updated
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        if (window.loadInitialData) {
          await window.loadInitialData(true) // Force refresh
        }
        
        // Refresh current page
        if (appState.currentPage === 'accounts') {
          const { renderAccounts } = await import('./accounts.js')
          await renderAccounts(appState)
        }
        
        return true
      } catch (error) {
        console.error('Account save error:', error)
        throw error
      }
    },
    onValidate: (data) => {
      const errors = {}
      
      // Validate initial balance for new accounts
      if (!isEdit && data.initial_balance < 0) {
        errors.initial_balance = 'Initial balance cannot be negative'
      }
      
      return Object.keys(errors).length > 0 ? errors : null
    }
  })

  return { formId, form }
}

// Show cash account form modal
export async function showCashAccountModal(accountData = null) {
  const { formId } = createCashAccountForm(accountData)
  const isEdit = accountData !== null

  return formBuilder.showFormModal(formId, {
    title: isEdit ? 'Edit Cash Account' : 'Add Cash Account',
    size: 'medium'
  })
}

// Create investment account form configuration
export function createInvestmentAccountForm(accountData = null) {
  const isEdit = accountData !== null
  const formId = `investment-account-form-${Date.now()}`

  const fields = [
    {
      name: 'name',
      label: 'Account Name',
      type: 'text',
      placeholder: 'e.g., Retirement 401k',
      required: true,
      value: accountData?.name || ''
    },
    {
      name: 'account_type',
      label: 'Account Type',
      type: 'select',
      options: ACCOUNT_TYPES.INVESTMENT,
      required: true,
      value: accountData?.account_type || '401k'
    },
    {
      name: 'institution',
      label: 'Institution',
      type: 'text',
      placeholder: 'e.g., Vanguard',
      value: accountData?.institution || ''
    },
    {
      name: 'current_value',
      label: 'Current Value',
      type: 'amount',
      placeholder: '0.00',
      required: true,
      value: accountData?.current_value || ''
    },
    {
      name: 'cost_basis',
      label: 'Cost Basis',
      type: 'amount',
      placeholder: '0.00',
      helpText: 'Total amount invested',
      value: accountData?.cost_basis || ''
    },
    {
      name: 'currency',
      label: 'Currency',
      type: 'select',
      options: CURRENCIES,
      value: accountData?.currency || 'USD'
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Any additional notes about this account',
      rows: 3,
      value: accountData?.notes || ''
    },
    {
      name: 'is_active',
      label: 'Active Account',
      type: 'toggle',
      placeholder: 'Account is currently active',
      value: accountData?.is_active !== false
    }
  ]

  // Form configuration would be similar to cash account
  // Implementation details omitted for brevity
}

// Create debt account form configuration
export function createDebtAccountForm(accountData = null) {
  const isEdit = accountData !== null
  const formId = `debt-account-form-${Date.now()}`

  const fields = [
    {
      name: 'name',
      label: 'Account Name',
      type: 'text',
      placeholder: 'e.g., Chase Visa',
      required: true,
      value: accountData?.name || ''
    },
    {
      name: 'account_type',
      label: 'Account Type',
      type: 'select',
      options: ACCOUNT_TYPES.DEBT,
      required: true,
      value: accountData?.account_type || 'credit_card'
    },
    {
      name: 'lender',
      label: 'Lender',
      type: 'text',
      placeholder: 'e.g., Chase Bank',
      value: accountData?.lender || ''
    },
    {
      name: 'balance',
      label: 'Current Balance',
      type: 'amount',
      placeholder: '0.00',
      required: true,
      value: accountData?.balance || ''
    },
    {
      name: 'credit_limit',
      label: 'Credit Limit',
      type: 'amount',
      placeholder: '0.00',
      helpText: 'For credit cards only',
      value: accountData?.credit_limit || ''
    },
    {
      name: 'interest_rate',
      label: 'Interest Rate (%)',
      type: 'number',
      placeholder: '0.00',
      step: '0.01',
      min: 0,
      max: 100,
      value: accountData?.interest_rate || ''
    },
    {
      name: 'minimum_payment',
      label: 'Minimum Payment',
      type: 'amount',
      placeholder: '0.00',
      value: accountData?.minimum_payment || ''
    },
    {
      name: 'due_date',
      label: 'Payment Due Date',
      type: 'number',
      placeholder: '15',
      min: 1,
      max: 31,
      helpText: 'Day of month payment is due',
      value: accountData?.due_date || ''
    },
    {
      name: 'currency',
      label: 'Currency',
      type: 'select',
      options: CURRENCIES,
      value: accountData?.currency || 'USD'
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Any additional notes about this account',
      rows: 3,
      value: accountData?.notes || ''
    },
    {
      name: 'is_active',
      label: 'Active Account',
      type: 'toggle',
      placeholder: 'Account is currently active',
      value: accountData?.is_active !== false
    }
  ]

  // Form configuration would be similar to cash account
  // Implementation details omitted for brevity
}