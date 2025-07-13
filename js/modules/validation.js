// js/modules/validation.js
import { showError } from './ui.js';
import { debug } from './debug.js';

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
    
    percentage: (value) => {
        const num = parseFloat(value);
        if (isNaN(num)) {
            return 'Must be a valid number';
        }
        if (num < 0 || num > 100) {
            return 'Must be between 0 and 100';
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
        date: [ValidationRules.required, ValidationRules.notFutureDate],
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
        minimumPayment: [ValidationRules.required, ValidationRules.positiveNumber],
        dueDate: [ValidationRules.required, ValidationRules.validDate]
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
        shares: [ValidationRules.required, ValidationRules.positiveNumber],
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
    uniqueAccountName: (accountType) => async (name, formData) => {
        // This would check against existing accounts
        // For now, we'll return null (no error)
        // In a real implementation, you'd check the appState or database
        return null;
    },
    
    sufficientBalance: (accountId) => async (amount, formData) => {
        // This would check if the account has sufficient balance
        // For now, we'll return null (no error)
        return null;
    }
};

// Real-time validation setup
export function setupRealtimeValidation(formId, validationSchema) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    // Add input event listeners for real-time validation
    Object.keys(validationSchema).forEach(fieldName => {
        const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (!field) return;
        
        field.addEventListener('blur', () => {
            const error = validateField(field.value, validationSchema[fieldName]);
            if (error) {
                showFieldError(field.id || fieldName, error);
            } else {
                clearFieldError(field.id || fieldName);
            }
        });
        
        field.addEventListener('input', () => {
            // Clear error on input
            clearFieldError(field.id || fieldName);
        });
    });
}