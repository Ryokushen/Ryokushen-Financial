// js/modules/validation.js
import { showError } from './ui.js';
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';

// Constants for validation limits
const MAX_MONEY_AMOUNT = 999999999999.99; // ~1 trillion
const MAX_PERCENTAGE = 9999.99;
const MAX_SHARES = 999999999;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

// Validation rules
export const ValidationRules = {
  required: value => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    return null;
  },

  positiveNumber: value => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return 'Must be a valid number';
    }
    if (num <= 0) {
      return 'Must be greater than zero';
    }
    if (num > MAX_MONEY_AMOUNT) {
      return `Amount too large (max: ${MAX_MONEY_AMOUNT.toLocaleString()})`;
    }
    return null;
  },

  nonNegativeNumber: value => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return 'Must be a valid number';
    }
    if (num < 0) {
      return 'Cannot be negative';
    }
    if (num > MAX_MONEY_AMOUNT) {
      return `Amount too large (max: ${MAX_MONEY_AMOUNT.toLocaleString()})`;
    }
    return null;
  },

  nonZeroNumber: value => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return 'Must be a valid number';
    }
    if (num === 0) {
      return 'Cannot be zero';
    }
    return null;
  },

  validDate: value => {
    if (!value) {
      return 'Date is required';
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    const year = date.getFullYear();
    if (year < MIN_YEAR || year > MAX_YEAR) {
      return `Year must be between ${MIN_YEAR} and ${MAX_YEAR}`;
    }
    return null;
  },

  notFutureDate: value => {
    const dateError = ValidationRules.validDate(value);
    if (dateError) {
      return dateError;
    }

    const date = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (date > today) {
      return 'Date cannot be in the future';
    }
    return null;
  },

  futureDate: value => {
    const dateError = ValidationRules.validDate(value);
    if (dateError) {
      return dateError;
    }

    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) {
      return 'Date must be in the future';
    }
    return null;
  },

  reasonableDateRange: value => {
    const dateError = ValidationRules.validDate(value);
    if (dateError) {
      return dateError;
    }

    const date = new Date(value);
    const today = new Date();
    const fiveYearsFromNow = new Date();
    fiveYearsFromNow.setFullYear(today.getFullYear() + 5);
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(today.getFullYear() - 5);

    if (date > fiveYearsFromNow) {
      return 'Date cannot be more than 5 years in the future';
    }
    if (date < fiveYearsAgo) {
      return 'Date cannot be more than 5 years in the past';
    }
    return null;
  },

  percentage: value => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return 'Must be a valid number';
    }
    if (num < 0) {
      return 'Cannot be negative';
    }
    if (num > MAX_PERCENTAGE) {
      return `Percentage too large (max: ${MAX_PERCENTAGE}%)`;
    }
    return null;
  },

  validStockSymbol: value => {
    if (!value) {
      return 'Symbol is required';
    }
    // Stock symbols are typically 1-5 uppercase letters
    if (!/^[A-Z]{1,5}$/.test(value.toUpperCase())) {
      return 'Invalid stock symbol format';
    }
    return null;
  },

  maxAmount: max => value => {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return 'Must be a valid number';
    }
    if (num > max) {
      return `Cannot exceed ${max}`;
    }
    return null;
  },

  minLength: min => value => {
    if (!value || value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: max => value => {
    if (value && value.length > max) {
      return `Cannot exceed ${max} characters`;
    }
    return null;
  },

  maxShares: value => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > MAX_SHARES) {
      return `Too many shares (max: ${MAX_SHARES.toLocaleString()})`;
    }
    return null;
  },

  dueDateDay: value => {
    const day = parseInt(value);
    if (isNaN(day) || day < 1 || day > 31) {
      return 'Due date must be between 1 and 31';
    }
    // Warn about dates that don't exist in all months
    if (day === 31) {
      return 'Day 31 doesn\'t exist in all months. Consider using 28 or "last day of month"';
    }
    if (day === 30) {
      return "Day 30 doesn't exist in February. Consider using 28 or earlier";
    }
    if (day === 29) {
      return 'Day 29 only exists in leap years. Consider using 28 or earlier';
    }
    return null;
  },
};

// Validate a single field
export function validateField(value, rules) {
  if (!Array.isArray(rules)) {
    rules = [rules];
  }

  for (const rule of rules) {
    const error = rule(value);
    if (error) {
      return error;
    }
  }

  return null;
}

// Validate an entire form
export function validateForm(formData, validationSchema) {
  const errors = {};
  let hasErrors = false;

  for (const [field, rules] of Object.entries(validationSchema)) {
    const value = formData[field];
    const error = validateField(value, rules);

    if (error) {
      errors[field] = error;
      hasErrors = true;
    }
  }

  return { errors, hasErrors };
}

// Show field-level validation error
export function showFieldError(fieldId, errorMessage) {
  const field = document.getElementById(fieldId);
  if (!field) {
    return;
  }

  // Add error class to field
  field.classList.add('field-error');

  // Check if error element already exists
  let errorEl = field.parentElement.querySelector('.field-error-message');

  if (!errorEl) {
    // Create error element
    errorEl = document.createElement('div');
    errorEl.className = 'field-error-message';
    field.parentElement.appendChild(errorEl);
  }

  errorEl.textContent = errorMessage;
}

// Clear field-level validation error
export function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) {
    return;
  }

  field.classList.remove('field-error');

  const errorEl = field.parentElement.querySelector('.field-error-message');
  if (errorEl) {
    errorEl.remove();
  }
}

// Clear all validation errors in a form
export function clearFormErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) {
    return;
  }

  form.querySelectorAll('.field-error').forEach(field => {
    field.classList.remove('field-error');
  });

  form.querySelectorAll('.field-error-message').forEach(errorEl => {
    errorEl.remove();
  });
}

// Common validation schemas
export const ValidationSchemas = {
  transaction: {
    date: [ValidationRules.required, ValidationRules.reasonableDateRange],
    description: [ValidationRules.required, ValidationRules.minLength(3)],
    amount: [ValidationRules.required, ValidationRules.nonZeroNumber],
    category: ValidationRules.required,
  },

  cashAccount: {
    name: [ValidationRules.required, ValidationRules.minLength(2), ValidationRules.maxLength(50)],
    type: ValidationRules.required,
    institution: ValidationRules.maxLength(100),
  },

  debtAccount: {
    name: [ValidationRules.required, ValidationRules.minLength(2), ValidationRules.maxLength(50)],
    type: ValidationRules.required,
    institution: ValidationRules.required,
    balance: [ValidationRules.required, ValidationRules.nonNegativeNumber],
    interestRate: [ValidationRules.required, ValidationRules.percentage],
    minimumPayment: [ValidationRules.required, ValidationRules.nonNegativeNumber],
    dueDate: ValidationRules.required,
  },

  recurringBill: {
    name: [ValidationRules.required, ValidationRules.minLength(2)],
    category: ValidationRules.required,
    amount: [ValidationRules.required, ValidationRules.positiveNumber],
    frequency: ValidationRules.required,
    nextDue: [ValidationRules.required, ValidationRules.futureDate],
  },

  savingsGoal: {
    name: [ValidationRules.required, ValidationRules.minLength(2)],
    targetAmount: [ValidationRules.required, ValidationRules.positiveNumber],
    linkedAccountId: ValidationRules.required,
    // currentAmount is now automatically tracked from linked account balance
  },

  holding: {
    symbol: [ValidationRules.required, ValidationRules.validStockSymbol],
    shares: [ValidationRules.required, ValidationRules.positiveNumber, ValidationRules.maxShares],
    price: [ValidationRules.required, ValidationRules.positiveNumber],
  },

  investmentAccount: {
    name: [ValidationRules.required, ValidationRules.minLength(2), ValidationRules.maxLength(50)],
    institution: [ValidationRules.required, ValidationRules.maxLength(100)],
    accountType: ValidationRules.required,
    balance: ValidationRules.nonNegativeNumber,
    dayChange: ValidationRules.required,
  },
};

// Enhanced validation with async checks (e.g., duplicate names)
export async function validateWithAsyncRules(formData, validationSchema, asyncValidators = {}) {
  // First do synchronous validation
  const { errors, hasErrors: syncHasErrors } = validateForm(formData, validationSchema);

  // Track if we find any async errors
  let asyncHasErrors = false;

  // Then do async validation
  for (const [field, validator] of Object.entries(asyncValidators)) {
    try {
      const error = await validator(formData[field], formData);
      if (error) {
        errors[field] = error;
        asyncHasErrors = true;
      }
    } catch (e) {
      debug.error(`Async validation error for field ${field}:`, e);
    }
  }

  // Combine sync and async error states
  const hasErrors = syncHasErrors || asyncHasErrors;

  return { errors, hasErrors };
}

// Common async validators
export const AsyncValidators = {
  uniqueAccountName:
    (existingAccounts, currentId = null) =>
    async (name, formData) => {
      // Check if name already exists in accounts (case-insensitive)
      const nameLower = name.toLowerCase().trim();
      const duplicate = existingAccounts.find(
        account => account.name.toLowerCase().trim() === nameLower && account.id !== currentId
      );

      if (duplicate) {
        return `An account with the name "${name}" already exists`;
      }
      return null;
    },

  uniqueDebtAccountName:
    (existingDebtAccounts, currentId = null) =>
    async (name, formData) => {
      // Check if name already exists in debt accounts (case-insensitive)
      const nameLower = name.toLowerCase().trim();
      const duplicate = existingDebtAccounts.find(
        account => account.name.toLowerCase().trim() === nameLower && account.id !== currentId
      );

      if (duplicate) {
        return `A debt account with the name "${name}" already exists`;
      }
      return null;
    },

  uniqueInvestmentAccountName:
    (existingInvestmentAccounts, currentId = null) =>
    async (name, formData) => {
      // Check if name already exists in investment accounts (case-insensitive)
      const nameLower = name.toLowerCase().trim();
      const duplicate = existingInvestmentAccounts.find(
        account => account.name.toLowerCase().trim() === nameLower && account.id !== currentId
      );

      if (duplicate) {
        return `An investment account with the name "${name}" already exists`;
      }
      return null;
    },

  sufficientBalance: getAccountBalance => async (amount, formData) => {
    // Check if the account has sufficient balance
    if (!formData.accountId || !getAccountBalance) {
      return null; // Skip validation if no account selected
    }

    const balance = await getAccountBalance(formData.accountId);
    if (balance < amount) {
      return `Insufficient balance. Available: ${balance.toFixed(2)}`;
    }
    return null;
  },
};

// Cross-field validators
export const CrossFieldValidators = {
  savingsGoal: formData => {
    const errors = {};

    // currentAmount is now automatically tracked from linked account balance

    // Check if target date is in the past
    if (formData.target_date) {
      const targetDate = new Date(formData.target_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (targetDate < today) {
        errors.target_date = 'Target date must be in the future';
      }
    }

    return errors;
  },

  debtAccount: formData => {
    const errors = {};

    // Check if minimum payment exceeds balance (allow 0/0 for paid-off accounts)
    // For low balances (under $25), allow minimum payment to exceed balance
    // since credit cards often have minimum payment requirements
    if (formData.minimumPayment > formData.balance && formData.balance > 25) {
      errors.minimumPayment = 'Minimum payment cannot exceed current balance';
    }

    // Check if minimum payment is 0 but balance is not 0
    if (formData.minimumPayment === 0 && formData.balance > 0) {
      errors.minimumPayment = 'Minimum payment cannot be zero when there is an outstanding balance';
    }

    // Check if balance exceeds credit limit (for credit cards)
    if (
      formData.type === 'Credit Card' &&
      formData.creditLimit &&
      formData.balance > formData.creditLimit
    ) {
      errors.balance = 'Balance cannot exceed credit limit';
    }

    return errors;
  },

  recurringBill: formData => {
    const errors = {};

    // Check if next due date is valid
    if (formData.nextDue) {
      const nextDue = new Date(formData.nextDue);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Allow today but not past dates
      if (nextDue < today) {
        errors.nextDue = 'Next due date cannot be in the past';
      }
    }

    return errors;
  },
};

// Enhanced validation function with cross-field support
export function validateFormWithCrossFields(formData, validationSchema, crossFieldValidator) {
  // First do field-level validation
  const { errors: fieldErrors, hasErrors: hasFieldErrors } = validateForm(
    formData,
    validationSchema
  );

  // Then do cross-field validation
  const crossFieldErrors = crossFieldValidator ? crossFieldValidator(formData) : {};

  // Merge errors
  const allErrors = { ...fieldErrors, ...crossFieldErrors };
  const hasErrors = hasFieldErrors || Object.keys(crossFieldErrors).length > 0;

  return { errors: allErrors, hasErrors };
}

// Real-time validation setup with enhanced feedback
export function setupRealtimeValidation(formId, validationSchema, options = {}) {
  const form = document.getElementById(formId);
  if (!form) {
    return;
  }

  const {
    validateOnInput = true,
    validateOnBlur = true,
    showSuccessState = true,
    debounceTime = 300,
    crossFieldValidator = null,
    asyncValidators = {},
  } = options;

  // Track validation state
  const validationState = {};
  const debounceTimers = {};

  // Add input event listeners for real-time validation
  Object.keys(validationSchema).forEach(fieldName => {
    const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
    if (!field) {
      return;
    }

    // Initialize field state
    validationState[fieldName] = { isValid: true, isDirty: false };

    // Blur event - always validate
    if (validateOnBlur) {
      eventManager.addEventListener(field, 'blur', async () => {
        try {
          validationState[fieldName].isDirty = true;
          await validateFieldWithFeedback(field, fieldName, validationSchema[fieldName], {
            showSuccessState,
            asyncValidator: asyncValidators[fieldName],
            formData: getFormData(form),
            crossFieldValidator,
          });
        } catch (error) {
          debug.error('Validation error on blur:', error);
          showFieldError(field.id || fieldName, 'Validation failed. Please try again.');
        }
      });
    }

    // Input event - validate with debounce
    if (validateOnInput) {
      eventManager.addEventListener(field, 'input', () => {
        // Clear existing timer
        if (debounceTimers[fieldName]) {
          clearTimeout(debounceTimers[fieldName]);
        }

        // Show loading state if async validation
        if (asyncValidators[fieldName] && field.value) {
          showFieldLoading(field.id || fieldName);
        }

        // Set new timer
        debounceTimers[fieldName] = setTimeout(async () => {
          try {
            if (validationState[fieldName].isDirty || field.value) {
              await validateFieldWithFeedback(field, fieldName, validationSchema[fieldName], {
                showSuccessState,
                asyncValidator: asyncValidators[fieldName],
                formData: getFormData(form),
                crossFieldValidator,
              });
            }
          } catch (error) {
            debug.error('Validation error on input:', error);
            showFieldError(field.id || fieldName, 'Validation failed. Please try again.');
          }
        }, debounceTime);
      });
    }

    // Focus event - clear error if field is empty
    eventManager.addEventListener(field, 'focus', () => {
      if (!field.value && !validationState[fieldName].isDirty) {
        clearFieldFeedback(field.id || fieldName);
      }
    });
  });

  // Return validation state getter for form-level validation
  return {
    getValidationState: () => validationState,
    validateAll: async () => {
      const results = await Promise.all(
        Object.keys(validationSchema).map(async fieldName => {
          const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
          if (field) {
            validationState[fieldName].isDirty = true;
            return validateFieldWithFeedback(field, fieldName, validationSchema[fieldName], {
              showSuccessState,
              asyncValidator: asyncValidators[fieldName],
              formData: getFormData(form),
              crossFieldValidator,
            });
          }
          return true;
        })
      );
      return results.every(result => result);
    },
  };
}

// Enhanced field validation with visual feedback
async function validateFieldWithFeedback(field, fieldName, rules, options = {}) {
  const { showSuccessState, asyncValidator, formData, crossFieldValidator } = options;

  // Synchronous validation
  const error = validateField(field.value, rules);

  if (error) {
    showFieldError(field.id || fieldName, error);
    return false;
  }

  // Async validation if provided
  if (asyncValidator && field.value) {
    try {
      showFieldLoading(field.id || fieldName);
      const asyncError = await asyncValidator(field.value, formData);
      if (asyncError) {
        showFieldError(field.id || fieldName, asyncError);
        return false;
      }
    } catch (e) {
      debug.error('Async validation error:', e);
    }
  }

  // Cross-field validation if provided
  if (crossFieldValidator && formData) {
    const crossFieldErrors = crossFieldValidator(formData);
    if (crossFieldErrors[fieldName]) {
      showFieldError(field.id || fieldName, crossFieldErrors[fieldName]);
      return false;
    }
  }

  // All validations passed
  if (showSuccessState && field.value) {
    showFieldSuccess(field.id || fieldName);
  } else {
    clearFieldFeedback(field.id || fieldName);
  }

  return true;
}

// Show field loading state
export function showFieldLoading(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  clearFieldFeedback(fieldId);
  field.classList.add('field-loading');

  // Add loading indicator
  let loadingEl = field.parentElement.querySelector('.field-loading-indicator');
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.className = 'field-loading-indicator';
    loadingEl.innerHTML = '<span class="spinner"></span> Validating...';
    field.parentElement.appendChild(loadingEl);
  }
}

// Show field success state
export function showFieldSuccess(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  clearFieldFeedback(fieldId);
  field.classList.add('field-success');

  // Add success indicator
  let successEl = field.parentElement.querySelector('.field-success-indicator');
  if (!successEl) {
    successEl = document.createElement('div');
    successEl.className = 'field-success-indicator';
    successEl.innerHTML = '✓';
    field.parentElement.appendChild(successEl);
  }
}

// Clear all field feedback
export function clearFieldFeedback(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  field.classList.remove('field-error', 'field-success', 'field-loading');

  const indicators = field.parentElement.querySelectorAll(
    '.field-error-message, .field-success-indicator, .field-loading-indicator'
  );
  indicators.forEach(el => el.remove());
}

// Helper to get form data
function getFormData(form) {
  const formData = new FormData(form);
  const data = {};
  for (const [key, value] of formData.entries()) {
    data[key] = value;
  }
  return data;
}
