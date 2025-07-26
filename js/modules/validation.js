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
    required: (value) => {
        if (value === null || value === undefined || value === '') {
            return 'This field is required';
        }
        return null;
    },
    
    positiveNumber: (value) => {
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
    
    nonNegativeNumber: (value) => {
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
    
    nonZeroNumber: (value) => {
        const num = parseFloat(value);
        if (isNaN(num)) {
            return 'Must be a valid number';
        }
        if (num === 0) {
            return 'Cannot be zero';
        }
        return null;
    },
    
    validDate: (value) => {
        if (!value) return 'Date is required';
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
    
    notFutureDate: (value) => {
        const dateError = ValidationRules.validDate(value);
        if (dateError) return dateError;
        
        const date = new Date(value);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        if (date > today) {
            return 'Date cannot be in the future';
        }
        return null;
    },
    
    futureDate: (value) => {
        const dateError = ValidationRules.validDate(value);
        if (dateError) return dateError;
        
        const date = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (date < today) {
            return 'Date must be in the future';
        }
        return null;
    },
    
    reasonableDateRange: (value) => {
        const dateError = ValidationRules.validDate(value);
        if (dateError) return dateError;
        
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
    
    percentage: (value) => {
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
    
    validStockSymbol: (value) => {
        if (!value) return 'Symbol is required';
        // Stock symbols are typically 1-5 uppercase letters
        if (!/^[A-Z]{1,5}$/.test(value.toUpperCase())) {
            return 'Invalid stock symbol format';
        }
        return null;
    },
    
    maxAmount: (max) => (value) => {
        const num = parseFloat(value);
        if (isNaN(num)) {
            return 'Must be a valid number';
        }
        if (num > max) {
            return `Cannot exceed ${max}`;
        }
        return null;
    },
    
    minLength: (min) => (value) => {
        if (!value || value.length < min) {
            return `Must be at least ${min} characters`;
        }
        return null;
    },
    
    maxLength: (max) => (value) => {
        if (value && value.length > max) {
            return `Cannot exceed ${max} characters`;
        }
        return null;
    },
    
    maxShares: (value) => {
        const num = parseFloat(value);
        if (!isNaN(num) && num > MAX_SHARES) {
            return `Too many shares (max: ${MAX_SHARES.toLocaleString()})`;
        }
        return null;
    },
    
    dueDateDay: (value) => {
        const day = parseInt(value);
        if (isNaN(day) || day < 1 || day > 31) {
            return 'Due date must be between 1 and 31';
        }
        // Warn about dates that don't exist in all months
        if (day === 31) {
            return 'Day 31 doesn\'t exist in all months. Consider using 28 or "last day of month"';
        }
        if (day === 30) {
            return 'Day 30 doesn\'t exist in February. Consider using 28 or earlier';
        }
        if (day === 29) {
            return 'Day 29 only exists in leap years. Consider using 28 or earlier';
        }
        return null;
    }
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
    if (!field) return;
    
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
    if (!field) return;
    
    field.classList.remove('field-error');
    
    const errorEl = field.parentElement.querySelector('.field-error-message');
    if (errorEl) {
        errorEl.remove();
    }
}

// Clear all validation errors in a form
export function clearFormErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
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
        category: ValidationRules.required
    },
    
    cashAccount: {
        name: [ValidationRules.required, ValidationRules.minLength(2), ValidationRules.maxLength(50)],
        type: ValidationRules.required,
        institution: ValidationRules.maxLength(100)
    },
    
    debtAccount: {
        name: [ValidationRules.required, ValidationRules.minLength(2), ValidationRules.maxLength(50)],
        type: ValidationRules.required,
        institution: ValidationRules.required,
        balance: [ValidationRules.required, ValidationRules.nonNegativeNumber],
        interestRate: [ValidationRules.required, ValidationRules.percentage],
        minimumPayment: [ValidationRules.required, ValidationRules.nonNegativeNumber],
        dueDate: ValidationRules.required
    },
    
    recurringBill: {
        name: [ValidationRules.required, ValidationRules.minLength(2)],
        category: ValidationRules.required,
        amount: [ValidationRules.required, ValidationRules.positiveNumber],
        frequency: ValidationRules.required,
        nextDue: [ValidationRules.required, ValidationRules.futureDate]
    },
    
    savingsGoal: {
        name: [ValidationRules.required, ValidationRules.minLength(2)],
        targetAmount: [ValidationRules.required, ValidationRules.positiveNumber],
        linkedAccountId: ValidationRules.required,
        currentAmount: ValidationRules.nonNegativeNumber
    },
    
    holding: {
        symbol: [ValidationRules.required, ValidationRules.validStockSymbol],
        shares: [ValidationRules.required, ValidationRules.positiveNumber, ValidationRules.maxShares],
        price: [ValidationRules.required, ValidationRules.positiveNumber]
    },
    
    investmentAccount: {
        name: [ValidationRules.required, ValidationRules.minLength(2), ValidationRules.maxLength(50)],
        institution: [ValidationRules.required, ValidationRules.maxLength(100)],
        accountType: ValidationRules.required,
        balance: ValidationRules.nonNegativeNumber,
        dayChange: ValidationRules.required
    }
};

// Enhanced validation with async checks (e.g., duplicate names)
export async function validateWithAsyncRules(formData, validationSchema, asyncValidators = {}) {
    // First do synchronous validation
    const { errors, hasErrors } = validateForm(formData, validationSchema);
    
    // Then do async validation
    for (const [field, validator] of Object.entries(asyncValidators)) {
        try {
            const error = await validator(formData[field], formData);
            if (error) {
                errors[field] = error;
                hasErrors = true;
            }
        } catch (e) {
            debug.error(`Async validation error for field ${field}:`, e);
        }
    }
    
    return { errors, hasErrors };
}

// Common async validators
export const AsyncValidators = {
    uniqueAccountName: (existingAccounts, currentId = null) => async (name, formData) => {
        // Check if name already exists in accounts (case-insensitive)
        const nameLower = name.toLowerCase().trim();
        const duplicate = existingAccounts.find(account => 
            account.name.toLowerCase().trim() === nameLower && 
            account.id !== currentId
        );
        
        if (duplicate) {
            return `An account with the name "${name}" already exists`;
        }
        return null;
    },
    
    uniqueDebtAccountName: (existingDebtAccounts, currentId = null) => async (name, formData) => {
        // Check if name already exists in debt accounts (case-insensitive)
        const nameLower = name.toLowerCase().trim();
        const duplicate = existingDebtAccounts.find(account => 
            account.name.toLowerCase().trim() === nameLower && 
            account.id !== currentId
        );
        
        if (duplicate) {
            return `A debt account with the name "${name}" already exists`;
        }
        return null;
    },
    
    uniqueInvestmentAccountName: (existingInvestmentAccounts, currentId = null) => async (name, formData) => {
        // Check if name already exists in investment accounts (case-insensitive)
        const nameLower = name.toLowerCase().trim();
        const duplicate = existingInvestmentAccounts.find(account => 
            account.name.toLowerCase().trim() === nameLower && 
            account.id !== currentId
        );
        
        if (duplicate) {
            return `An investment account with the name "${name}" already exists`;
        }
        return null;
    },
    
    sufficientBalance: (getAccountBalance) => async (amount, formData) => {
        // Check if the account has sufficient balance
        if (!formData.accountId || !getAccountBalance) {
            return null; // Skip validation if no account selected
        }
        
        const balance = await getAccountBalance(formData.accountId);
        if (balance < amount) {
            return `Insufficient balance. Available: ${balance.toFixed(2)}`;
        }
        return null;
    }
};

// Cross-field validators
export const CrossFieldValidators = {
    savingsGoal: (formData) => {
        const errors = {};
        
        // Check if current amount exceeds target amount
        if (formData.currentAmount > formData.targetAmount) {
            errors.currentAmount = 'Current amount cannot exceed target amount';
        }
        
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
    
    debtAccount: (formData) => {
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
        if (formData.type === 'Credit Card' && formData.creditLimit && formData.balance > formData.creditLimit) {
            errors.balance = 'Balance cannot exceed credit limit';
        }
        
        return errors;
    },
    
    recurringBill: (formData) => {
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
    }
};

// Enhanced validation function with cross-field support
export function validateFormWithCrossFields(formData, validationSchema, crossFieldValidator) {
    // First do field-level validation
    const { errors: fieldErrors, hasErrors: hasFieldErrors } = validateForm(formData, validationSchema);
    
    // Then do cross-field validation
    const crossFieldErrors = crossFieldValidator ? crossFieldValidator(formData) : {};
    
    // Merge errors
    const allErrors = { ...fieldErrors, ...crossFieldErrors };
    const hasErrors = hasFieldErrors || Object.keys(crossFieldErrors).length > 0;
    
    return { errors: allErrors, hasErrors };
}

// Real-time validation setup
export function setupRealtimeValidation(formId, validationSchema) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // Add input event listeners for real-time validation
    Object.keys(validationSchema).forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (!field) return;
        
        eventManager.addEventListener(field, 'blur', () => {
            const error = validateField(field.value, validationSchema[fieldName]);
            if (error) {
                showFieldError(field.id || fieldName, error);
            } else {
                clearFieldError(field.id || fieldName);
            }
        });
        
        eventManager.addEventListener(field, 'input', () => {
            // Clear error on input
            clearFieldError(field.id || fieldName);
        });
    });
}