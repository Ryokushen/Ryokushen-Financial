// js/modules/categories.js
// Transaction categories used throughout the application

// Category icon mapping
const categoryIcons = {
  'Income': '💵',
  'Groceries': '🛒',
  'Dining': '🍴',
  'Transportation': '🚗',
  'Entertainment': '🎭',
  'Shopping': '🛍️',
  'Healthcare': '🏥',
  'Bills': '💳',
  'Housing': '🏠',
  'Debt': '💳',
  'Payment': '💸',
  'Savings': '💰',
  'Investment': '📈',
  'Education': '🎓',
  'Travel': '✈️',
  'Gifts': '🎁',
  'Insurance': '🛡️',
  'Taxes': '📜',
  'ATM/Cash': '💵',
  'Fees': '💸',
  'Business': '💼',
  'Childcare': '👶',
  'Pet Care': '🐶',
  'Personal Care': '💇',
  'Home Improvement': '🔨',
  'Professional Services': '👩‍💼',
  'Interest': '💹',
  'Transfer': '🔄',
  'Misc': '📊',
  'Uncategorized': '📦',
  'Subscriptions': '📅',
  'Technology': '💻',
  'Utilities': '💡'
}

export const categories = [
  'Uncategorized',
  'ATM/Cash',
  'Bills',
  'Business',
  'Childcare',
  'Debt',
  'Dining',
  'Education',
  'Entertainment',
  'Fees',
  'Gifts',
  'Groceries',
  'Healthcare',
  'Home Improvement',
  'Housing',
  'Income',
  'Insurance',
  'Interest',
  'Investment',
  'Misc',
  'Payment',
  'Personal Care',
  'Pet Care',
  'Professional Services',
  'Savings',
  'Shopping',
  'Subscriptions',
  'Taxes',
  'Technology',
  'Transfer',
  'Transportation',
  'Travel',
  'Utilities'
]

// Get icon for a category
export function getCategoryIcon(category, isIncome = false) {
  if (isIncome || category === 'Income') {
    return '💵' // Money with wings for income
  }
  
  return categoryIcons[category] || '💼'
}

// Validate if a category is valid
export function isValidCategory(category) {
  return categories.includes(category)
}

// Get all categories with their icons
export function getCategoriesWithIcons() {
  return categories.map(category => ({
    name: category,
    icon: getCategoryIcon(category)
  }))
}

// Render category options for a select element
export function renderCategoryOptions(selectElement, selectedCategory = '', includeEmpty = true) {
  if (!selectElement) return
  
  // Clear existing options
  selectElement.innerHTML = ''
  
  // Add empty option if requested
  if (includeEmpty) {
    const emptyOption = document.createElement('option')
    emptyOption.value = ''
    emptyOption.textContent = '— Select category —'
    emptyOption.disabled = true
    emptyOption.selected = !selectedCategory
    selectElement.appendChild(emptyOption)
  }
  
  // Add category options
  categories.forEach(category => {
    const option = document.createElement('option')
    option.value = category
    option.textContent = `${getCategoryIcon(category)} ${category}`
    option.selected = category === selectedCategory
    selectElement.appendChild(option)
  })
}

// Get categories for specific types
export function getIncomeCategories() {
  return ['Income']
}

export function getExpenseCategories() {
  return categories.filter(cat => !['Income', 'Transfer', 'Payment'].includes(cat))
}

export function getSpecialCategories() {
  return ['Debt', 'Payment', 'Transfer']
}

// Check if category requires special handling
export function isSpecialCategory(category) {
  return getSpecialCategories().includes(category)
}

// Get category color for charts
export function getCategoryColor(category) {
  // This could be expanded with a proper color scheme
  const colorMap = {
    'Income': '#10b981', // Green
    'Housing': '#3b82f6', // Blue
    'Transportation': '#f59e0b', // Amber
    'Groceries': '#22c55e', // Emerald
    'Dining': '#ef4444', // Red
    'Entertainment': '#a855f7', // Purple
    'Healthcare': '#06b6d4', // Cyan
    'Debt': '#dc2626', // Red
    'Savings': '#14b8a6', // Teal
    'Investment': '#6366f1' // Indigo
  }
  
  return colorMap[category] || '#6b7280' // Default gray
}

// Populate a specific category dropdown
export function populateCategoryDropdown(selectId, selectedCategory = '', includeEmpty = true) {
  const selectElement = document.getElementById(selectId)
  if (selectElement) {
    renderCategoryOptions(selectElement, selectedCategory, includeEmpty)
  }
}

// Populate all category dropdowns on the page
export function populateAllCategoryDropdowns() {
  // Transaction form category dropdown - preserve current selection
  const transactionSelect = document.getElementById('transaction-category')
  if (transactionSelect) {
    const currentValue = transactionSelect.value
    renderCategoryOptions(transactionSelect, currentValue || 'Uncategorized', false)
  }
  
  // Filter dropdown - preserve current selection
  const filterSelect = document.getElementById('filter-category')
  if (filterSelect) {
    const currentValue = filterSelect.value
    // Clear and rebuild
    filterSelect.innerHTML = ''
    // Add "All Categories" option first
    const allOption = document.createElement('option')
    allOption.value = ''
    allOption.textContent = '— All Categories —'
    filterSelect.appendChild(allOption)
    // Add all category options
    categories.forEach(category => {
      const option = document.createElement('option')
      option.value = category
      option.textContent = `${getCategoryIcon(category)} ${category}`
      option.selected = category === currentValue
      filterSelect.appendChild(option)
    })
  }
  
  // Recurring bills category dropdown - preserve current selection
  const recurringSelect = document.getElementById('recurring-category')
  if (recurringSelect) {
    const currentValue = recurringSelect.value
    renderCategoryOptions(recurringSelect, currentValue, true)
  }
  
  // Any other category dropdowns that might exist
  const allCategorySelects = document.querySelectorAll('select[data-category-dropdown]')
  allCategorySelects.forEach(select => {
    if (!select.id || !['transaction-category', 'filter-category', 'recurring-category'].includes(select.id)) {
      const currentValue = select.value
      renderCategoryOptions(select, currentValue, true)
    }
  })
}

// Get categories grouped by type
export function getCategoryGroups() {
  return {
    income: getIncomeCategories(),
    expense: getExpenseCategories(),
    special: getSpecialCategories(),
    all: categories
  }
}