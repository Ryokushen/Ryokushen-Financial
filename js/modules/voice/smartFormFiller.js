// js/modules/voice/smartFormFiller.js - Smart Form Auto-Population

import { debug } from '../debug.js';
import { announceToScreenReader } from '../ui.js';

/**
 * Smart Form Filler - Automatically populates transaction forms with extracted data
 */
export class SmartFormFiller {
    constructor() {
        this.formElements = this.initializeFormElements();
        this.filledFields = new Set();
    }

    /**
     * Initialize form element references
     */
    initializeFormElements() {
        return {
            amount: document.getElementById('transaction-amount'),
            category: document.getElementById('transaction-category'), 
            description: document.getElementById('transaction-description'),
            date: document.getElementById('transaction-date'),
            account: document.getElementById('transaction-account'),
            cleared: document.getElementById('transaction-cleared'),
            debtAccount: document.getElementById('debt-account-select'),
            debtGroup: document.getElementById('debt-account-group')
        };
    }

    /**
     * Fill form with extracted transaction data
     */
    async fillForm(extractedData, options = {}) {
        debug.log('Filling form with extracted data:', extractedData);
        
        const {
            showConfirmation = true,
            highlightFields = true,
            announceChanges = true
        } = options;

        this.filledFields.clear();
        const suggestions = this.prepareSuggestions(extractedData);
        
        try {
            // Fill form fields
            await this.fillFormFields(suggestions, highlightFields);
            
            // Handle special cases (debt transactions, etc.)
            this.handleSpecialCases(extractedData);
            
            // Show confirmation if requested
            if (showConfirmation && this.filledFields.size > 0) {
                this.showConfirmationDialog(extractedData, suggestions);
            }
            
            // Announce changes for accessibility
            if (announceChanges) {
                this.announceFilledFields();
            }
            
            return {
                success: true,
                fieldsChanged: Array.from(this.filledFields),
                suggestions: suggestions
            };
            
        } catch (error) {
            debug.error('Error filling form:', error);
            return {
                success: false,
                error: error.message,
                fieldsChanged: Array.from(this.filledFields)
            };
        }
    }

    /**
     * Prepare suggestions from extracted data
     */
    prepareSuggestions(extractedData) {
        const suggestions = {};

        // Amount - always positive for form entry
        if (extractedData.amount !== null && extractedData.amount > 0) {
            suggestions.amount = extractedData.amount.toFixed(2);
        }

        // Category
        if (extractedData.category) {
            suggestions.category = extractedData.category;
        }

        // Description
        if (extractedData.description) {
            suggestions.description = this.cleanDescription(extractedData.description);
        }

        // Date
        if (extractedData.date) {
            suggestions.date = extractedData.date;
        }

        return suggestions;
    }

    /**
     * Fill individual form fields
     */
    async fillFormFields(suggestions, highlightFields) {
        // Fill amount
        if (suggestions.amount && this.formElements.amount) {
            await this.fillField('amount', suggestions.amount, highlightFields);
        }

        // Fill category
        if (suggestions.category && this.formElements.category) {
            await this.fillCategoryField(suggestions.category, highlightFields);
        }

        // Fill description
        if (suggestions.description && this.formElements.description) {
            await this.fillField('description', suggestions.description, highlightFields);
        }

        // Fill date
        if (suggestions.date && this.formElements.date) {
            await this.fillField('date', suggestions.date, highlightFields);
        }
    }

    /**
     * Fill a specific form field with highlighting
     */
    async fillField(fieldName, value, highlight = true) {
        const element = this.formElements[fieldName];
        if (!element) return;

        // Set the value
        element.value = value;
        this.filledFields.add(fieldName);

        // Trigger change event for any listeners
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Highlight the field
        if (highlight) {
            this.highlightField(element);
        }

        debug.log(`Filled field ${fieldName} with value:`, value);
    }

    /**
     * Fill category field with validation
     */
    async fillCategoryField(category, highlight = true) {
        const categoryElement = this.formElements.category;
        if (!categoryElement) return;

        // Check if category exists in options
        const options = Array.from(categoryElement.options);
        const matchingOption = options.find(option => 
            option.value.toLowerCase() === category.toLowerCase()
        );

        if (matchingOption) {
            categoryElement.value = matchingOption.value;
            this.filledFields.add('category');

            // Trigger change event for debt account visibility
            categoryElement.dispatchEvent(new Event('change', { bubbles: true }));

            if (highlight) {
                this.highlightField(categoryElement);
            }

            debug.log('Filled category field with:', matchingOption.value);
        } else {
            debug.warn('Category not found in options:', category);
        }
    }

    /**
     * Handle special transaction cases
     */
    handleSpecialCases(extractedData) {
        // Handle debt transactions
        if (extractedData.category === 'Debt' || extractedData.type === 'debt_payment') {
            this.handleDebtTransaction(extractedData);
        }

        // Handle income transactions  
        if (extractedData.type === 'income') {
            this.handleIncomeTransaction(extractedData);
        }
    }

    /**
     * Handle debt transaction specifics
     */
    handleDebtTransaction(extractedData) {
        // Show debt account group if hidden
        if (this.formElements.debtGroup) {
            this.formElements.debtGroup.style.display = 'block';
        }

        // Note: Debt account selection would need app data to populate
        debug.log('Debt transaction detected - debt account group shown');
    }

    /**
     * Handle income transaction specifics  
     */
    handleIncomeTransaction(extractedData) {
        // Income transactions are typically positive
        // Could add income-specific logic here
        debug.log('Income transaction detected');
    }

    /**
     * Clean description text
     */
    cleanDescription(description) {
        return description
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
            .trim()
            .substring(0, 100); // Limit length
    }

    /**
     * Highlight a filled field
     */
    highlightField(element) {
        // Add highlight class
        element.classList.add('voice-filled');
        
        // Remove highlight after delay
        setTimeout(() => {
            element.classList.remove('voice-filled');
        }, 3000);
    }

    /**
     * Show confirmation dialog for extracted data
     */
    showConfirmationDialog(extractedData, suggestions) {
        const confidence = extractedData.confidence || 0;
        const fieldsText = Array.from(this.filledFields).join(', ');
        
        // Create confirmation message
        let message = `Voice extracted: `;
        const parts = [];
        
        if (suggestions.amount) parts.push(`$${suggestions.amount}`);
        if (suggestions.category) parts.push(suggestions.category);
        if (suggestions.description) parts.push(`"${suggestions.description}"`);
        
        message += parts.join(' for ');
        message += ` (${confidence}% confidence)`;

        // Show as a temporary status message
        this.showTemporaryMessage(message, 'success');
        
        debug.log('Confirmation shown:', message);
    }

    /**
     * Show temporary message to user
     */
    showTemporaryMessage(message, type = 'info') {
        // Create or get message container
        let container = document.getElementById('voice-temp-message');
        if (!container) {
            container = document.createElement('div');
            container.id = 'voice-temp-message';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                padding: 12px 20px;
                border-radius: 6px;
                font-weight: bold;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
            `;
            document.body.appendChild(container);
        }

        // Set message and styling
        container.textContent = message;
        container.className = `voice-message-${type}`;
        
        // Style based on type
        const styles = {
            success: 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;',
            warning: 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;',
            error: 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;',
            info: 'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;'
        };
        
        container.style.cssText += styles[type] || styles.info;
        container.style.display = 'block';

        // Auto-hide after delay
        setTimeout(() => {
            if (container.parentNode) {
                container.style.opacity = '0';
                setTimeout(() => {
                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                }, 300);
            }
        }, 4000);
    }

    /**
     * Announce filled fields for accessibility
     */
    announceFilledFields() {
        if (this.filledFields.size === 0) return;

        const fieldCount = this.filledFields.size;
        const message = `Voice input filled ${fieldCount} field${fieldCount > 1 ? 's' : ''}: ${Array.from(this.filledFields).join(', ')}`;
        
        announceToScreenReader(message);
    }

    /**
     * Clear all highlighted fields
     */
    clearHighlights() {
        const highlightedFields = document.querySelectorAll('.voice-filled');
        highlightedFields.forEach(field => {
            field.classList.remove('voice-filled');
        });
    }

    /**
     * Validate filled form data
     */
    validateFilledForm() {
        const validation = {
            isValid: true,
            warnings: [],
            errors: []
        };

        // Check required fields
        if (this.formElements.amount && !this.formElements.amount.value) {
            validation.errors.push('Amount is required');
            validation.isValid = false;
        }

        if (this.formElements.category && !this.formElements.category.value) {
            validation.errors.push('Category is required');
            validation.isValid = false;
        }

        if (this.formElements.description && !this.formElements.description.value) {
            validation.errors.push('Description is required');
            validation.isValid = false;
        }

        return validation;
    }

    /**
     * Get current form data
     */
    getCurrentFormData() {
        return {
            amount: this.formElements.amount?.value || '',
            category: this.formElements.category?.value || '',
            description: this.formElements.description?.value || '',
            date: this.formElements.date?.value || '',
            account: this.formElements.account?.value || '',
            cleared: this.formElements.cleared?.checked || false
        };
    }
}