/**
 * Form utility functions to reduce code duplication across modules
 */

import { debug } from './debug.js';

/**
 * Extract form data from a form element
 * @param {string} formId - The form element ID
 * @param {Array<string>} fields - Field names to extract
 * @returns {Object} Object with field values
 */
export function extractFormData(formId, fields) {
    const data = {};
    const form = document.getElementById(formId);
    
    if (!form) {
        debug.warn(`Form with ID ${formId} not found`);
        return data;
    }
    
    fields.forEach(field => {
        const element = form.querySelector(`#${field}`);
        if (element) {
            if (element.type === 'checkbox') {
                data[field] = element.checked;
            } else if (element.type === 'number') {
                data[field] = element.value ? parseFloat(element.value) : null;
            } else {
                data[field] = element.value.trim();
            }
        }
    });
    
    return data;
}

/**
 * Populate form fields from data object
 * @param {string} formId - The form element ID
 * @param {Object} data - Data object with field values
 * @param {string} fieldPrefix - Optional prefix for field IDs
 */
export function populateFormFromData(formId, data, fieldPrefix = '') {
    const form = document.getElementById(formId);
    
    if (!form) {
        debug.warn(`Form with ID ${formId} not found`);
        return;
    }
    
    Object.entries(data).forEach(([field, value]) => {
        const fieldId = fieldPrefix ? `${fieldPrefix}-${field}` : field;
        const element = form.querySelector(`#${fieldId}`);
        
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else {
                element.value = value ?? '';
            }
        }
    });
}

/**
 * Display validation errors on form fields
 * @param {Object} errors - Object with field names and error messages
 * @param {string} fieldPrefix - Optional prefix for field IDs
 */
export function displayValidationErrors(errors, fieldPrefix = '') {
    // Clear existing errors first
    clearFormErrors();
    
    // Display new errors
    Object.entries(errors).forEach(([field, error]) => {
        const fieldId = fieldPrefix ? `${fieldPrefix}-${field}` : field;
        showFieldError(fieldId, error);
    });
    
    if (Object.keys(errors).length > 0) {
        showError("Please correct the errors in the form.");
    }
}

/**
 * Clear all form errors
 */
export function clearFormErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.form-field').forEach(el => {
        el.classList.remove('error');
    });
}

/**
 * Show error for a specific field
 * @param {string} fieldId - The field element ID
 * @param {string} error - Error message
 */
export function showFieldError(fieldId, error) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('error');
        const errorElement = field.parentElement.querySelector('.field-error');
        if (errorElement) {
            errorElement.textContent = error;
            errorElement.style.display = 'block';
        }
    }
}

/**
 * Reset form to initial state
 * @param {string} formId - The form element ID
 */
export function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        clearFormErrors();
    }
}

/**
 * Setup common modal event listeners
 * @param {string} modalId - The modal ID
 * @param {Object} handlers - Event handlers object
 */
export function setupModalEventListeners(modalId, handlers = {}) {
    const modalName = modalId.replace('-modal', '');
    
    // Close button
    const closeBtn = document.getElementById(`close-${modalName}-modal`);
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (handlers.onClose) handlers.onClose();
            closeModal(modalId);
        });
    }
    
    // Cancel button
    const cancelBtn = document.getElementById(`cancel-${modalName}-btn`);
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (handlers.onCancel) handlers.onCancel();
            closeModal(modalId);
        });
    }
    
    // Form submission
    const form = document.getElementById(`${modalName}-form`);
    if (form && handlers.onSubmit) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handlers.onSubmit(e);
        });
    }
}

/**
 * Create a generic form submit handler
 * @param {Object} config - Configuration object
 * @returns {Function} Form submit handler
 */
export function createFormSubmitHandler(config) {
    const {
        formId,
        fields,
        validate,
        save,
        onSuccess,
        fieldPrefix = ''
    } = config;
    
    return async function(e) {
        if (e) e.preventDefault();
        
        // Clear previous errors
        clearFormErrors();
        
        // Extract form data
        const data = extractFormData(formId, fields);
        
        // Validate
        if (validate) {
            const errors = await validate(data);
            if (Object.keys(errors).length > 0) {
                displayValidationErrors(errors, fieldPrefix);
                return;
            }
        }
        
        // Save
        try {
            const result = await save(data);
            if (onSuccess) {
                await onSuccess(result);
            }
        } catch (error) {
            debug.error('Form submission error:', error);
            showError(error.message || 'An error occurred while saving.');
        }
    };
}

/**
 * Helper to show error message (imports from ui.js would create circular dependency)
 */
function showError(message) {
    const event = new CustomEvent('show-error', { detail: { message } });
    window.dispatchEvent(event);
}

/**
 * Helper to close modal (imports from modalManager would create circular dependency)
 */
function closeModal(modalId) {
    const event = new CustomEvent('close-modal', { detail: { modalId } });
    window.dispatchEvent(event);
}