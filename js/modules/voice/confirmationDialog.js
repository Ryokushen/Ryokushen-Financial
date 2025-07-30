// js/modules/voice/confirmationDialog.js - Voice Input Confirmation Dialog

import { debug } from '../debug.js';
import { eventManager } from '../eventManager.js';

/**
 * Confirmation Dialog for Voice-Parsed Transactions
 */
export class ConfirmationDialog {
    constructor() {
        this.dialog = null;
        this.currentData = null;
        this.callbacks = {};
    }

    /**
     * Show confirmation dialog for parsed transaction
     */
    show(extractedData, suggestions, callbacks = {}) {
        this.currentData = extractedData;
        this.callbacks = callbacks;

        this.createDialog();
        this.populateDialog(extractedData, suggestions);
        this.showDialog();

        debug.log('Confirmation dialog shown for:', extractedData);
    }

    /**
     * Create dialog HTML structure
     */
    createDialog() {
        // Remove existing dialog
        this.hide();

        this.dialog = document.createElement('div');
        this.dialog.className = 'voice-confirmation-dialog';
        this.dialog.innerHTML = `
            <div class="voice-confirmation-overlay">
                <div class="voice-confirmation-content">
                    <div class="voice-confirmation-header">
                        <h3>Voice Input Confirmation</h3>
                        <button class="voice-confirmation-close" aria-label="Close">&times;</button>
                    </div>
                    
                    <div class="voice-confirmation-body">
                        <div class="voice-original-text">
                            <strong>You said:</strong> "<span id="voice-original"></span>"
                        </div>
                        
                        <div class="voice-confidence">
                            Confidence: <span id="voice-confidence"></span>%
                        </div>
                        
                        <div class="voice-extracted-data">
                            <h4 style="color: #e2e8f0; font-weight: 600; margin-bottom: 12px;">Extracted Information:</h4>
                            <div class="voice-data-grid">
                                <div class="voice-data-item" data-field="amount">
                                    <label>Amount:</label>
                                    <input type="number" id="confirm-amount" step="0.01" min="0">
                                </div>
                                <div class="voice-data-item" data-field="category">
                                    <label>Category:</label>
                                    <select id="confirm-category">
                                        <option value="">Select Category</option>
                                    </select>
                                </div>
                                <div class="voice-data-item" data-field="description">
                                    <label>Description:</label>
                                    <input type="text" id="confirm-description">
                                </div>
                                <div class="voice-data-item" data-field="date">
                                    <label>Date:</label>
                                    <input type="date" id="confirm-date">
                                </div>
                            </div>
                        </div>
                        
                        <div class="voice-warnings" id="voice-warnings" style="display: none;">
                            <h5>⚠️ Warnings:</h5>
                            <ul id="voice-warnings-list"></ul>
                        </div>
                    </div>
                    
                    <div class="voice-confirmation-footer">
                        <button class="btn btn--secondary" id="voice-confirm-edit">Edit & Apply</button>
                        <button class="btn btn--primary" id="voice-confirm-apply">Apply</button>
                        <button class="btn btn--outline" id="voice-confirm-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this.injectStyles();

        // Add event listeners
        this.setupEventListeners();

        document.body.appendChild(this.dialog);
    }

    /**
     * Inject CSS styles for the dialog
     */
    injectStyles() {
        if (document.getElementById('voice-confirmation-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'voice-confirmation-styles';
        styles.textContent = `
            .voice-confirmation-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .voice-confirmation-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
            }

            .voice-confirmation-content {
                position: relative;
                background: var(--glass-bg, rgba(17, 24, 39, 0.95));
                backdrop-filter: blur(20px);
                border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
                border-radius: var(--radius-xl, 20px);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                margin: 20px;
                animation: slideInUp 0.3s ease-out;
            }

            @keyframes slideInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .voice-confirmation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--space-5, 20px);
                margin-bottom: var(--space-4, 16px);
            }

            .voice-confirmation-header h3 {
                margin: 0;
                color: #ffffff;
                font-size: var(--font-size-lg, 1.25rem);
                font-weight: 700;
            }

            .voice-confirmation-close {
                background: var(--glass-bg, rgba(255, 255, 255, 0.1));
                border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
                font-size: 20px;
                cursor: pointer;
                color: #e2e8f0;
                padding: 0;
                width: 32px;
                height: 32px;
                border-radius: var(--radius-md, 8px);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }

            .voice-confirmation-close:hover {
                background: var(--glass-hover, rgba(255, 255, 255, 0.15));
                border-color: rgba(255, 255, 255, 0.2);
            }

            .voice-confirmation-body {
                padding: 0 var(--space-5, 20px) var(--space-5, 20px);
            }

            .voice-original-text {
                background: var(--glass-bg, rgba(255, 255, 255, 0.05));
                border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
                padding: var(--space-3, 12px);
                border-radius: var(--radius-md, 8px);
                margin-bottom: var(--space-4, 16px);
                font-style: italic;
                color: #e2e8f0;
            }

            .voice-confidence {
                text-align: center;
                margin-bottom: var(--space-5, 20px);
                font-weight: 600;
                color: var(--color-primary, #3b82f6);
                font-size: 0.9rem;
            }

            .voice-data-grid {
                display: grid;
                gap: var(--space-4, 16px);
                margin-top: var(--space-3, 12px);
            }

            .voice-data-item {
                display: flex;
                flex-direction: column;
            }

            .voice-data-item label {
                font-weight: 600;
                margin-bottom: var(--space-1, 4px);
                color: #e2e8f0;
                font-size: 0.875rem;
            }

            .voice-data-item input,
            .voice-data-item select {
                background: var(--glass-bg, rgba(255, 255, 255, 0.05));
                border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
                border-radius: var(--radius-md, 8px);
                padding: var(--space-2, 8px) var(--space-3, 12px);
                color: #ffffff;
                font-size: 14px;
                transition: all 0.2s ease;
            }

            .voice-data-item input::placeholder,
            .voice-data-item select::placeholder {
                color: #94a3b8;
                opacity: 1;
            }

            .voice-data-item select option {
                background: var(--glass-bg, #1f2937);
                color: #ffffff;
            }

            .voice-data-item input:focus,
            .voice-data-item select:focus {
                outline: none;
                border-color: var(--color-primary, #3b82f6);
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
                background: var(--glass-hover, rgba(255, 255, 255, 0.1));
            }

            .voice-warnings {
                background: rgba(251, 191, 36, 0.1);
                border: 1px solid rgba(251, 191, 36, 0.3);
                border-radius: var(--radius-md, 8px);
                padding: var(--space-3, 12px);
                margin-top: var(--space-4, 16px);
            }

            .voice-warnings h5 {
                margin: 0 0 8px 0;
                color: #fbbf24;
                font-weight: 600;
            }

            .voice-warnings ul {
                margin: 0;
                padding-left: 20px;
                color: #fcd34d;
            }

            .voice-confirmation-footer {
                display: flex;
                justify-content: flex-end;
                gap: var(--space-3, 12px);
                padding: var(--space-5, 20px);
                margin-top: var(--space-4, 16px);
            }

            .voice-confirmation-footer .btn {
                padding: var(--space-2, 8px) var(--space-4, 16px);
                border-radius: var(--radius-md, 8px);
                cursor: pointer;
                font-weight: 600;
                font-size: 0.875rem;
                transition: all 0.2s ease;
                border: none;
            }

            .btn--primary {
                background: linear-gradient(135deg, var(--color-primary, #3b82f6), var(--color-teal, #14b8a6));
                color: white;
            }

            .btn--primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
            }

            .btn--secondary {
                background: var(--glass-bg, rgba(255, 255, 255, 0.1));
                border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
                color: #e2e8f0;
            }

            .btn--secondary:hover {
                background: var(--glass-hover, rgba(255, 255, 255, 0.15));
                border-color: rgba(255, 255, 255, 0.2);
            }

            .btn--outline {
                background: transparent;
                border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.1));
                color: #e2e8f0;
            }

            .btn--outline:hover {
                background: var(--glass-bg, rgba(255, 255, 255, 0.05));
                border-color: rgba(255, 255, 255, 0.2);
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Setup event listeners for dialog
     */
    setupEventListeners() {
        // Close button
        const closeBtn = this.dialog.querySelector('.voice-confirmation-close');
        if (closeBtn) {
            eventManager.addEventListener(closeBtn, 'click', () => {
                this.hide();
            });
        }

        // Overlay click to close
        const overlay = this.dialog.querySelector('.voice-confirmation-overlay');
        if (overlay) {
            eventManager.addEventListener(overlay, 'click', (e) => {
                if (e.target === e.currentTarget) {
                    this.hide();
                }
            });
        }

        // Footer buttons
        const applyBtn = this.dialog.querySelector('#voice-confirm-apply');
        if (applyBtn) {
            eventManager.addEventListener(applyBtn, 'click', () => {
                this.handleApply(false);
            });
        }

        const editBtn = this.dialog.querySelector('#voice-confirm-edit');
        if (editBtn) {
            eventManager.addEventListener(editBtn, 'click', () => {
                this.handleApply(true);
            });
        }

        const cancelBtn = this.dialog.querySelector('#voice-confirm-cancel');
        if (cancelBtn) {
            eventManager.addEventListener(cancelBtn, 'click', () => {
                this.hide();
            });
        }

        // Escape key to close
        eventManager.addEventListener(document, 'keydown', this.handleKeyDown.bind(this));
    }

    /**
     * Handle keyboard events
     */
    handleKeyDown(e) {
        if (e.key === 'Escape' && this.dialog) {
            this.hide();
        }
    }

    /**
     * Populate dialog with extracted data
     */
    populateDialog(extractedData, suggestions) {
        // Original text
        this.dialog.querySelector('#voice-original').textContent = extractedData.originalText;

        // Confidence
        this.dialog.querySelector('#voice-confidence').textContent = Math.round(extractedData.confidence || 0);

        // Populate form fields
        if (suggestions.amount) {
            this.dialog.querySelector('#confirm-amount').value = suggestions.amount;
        }

        if (suggestions.description) {
            this.dialog.querySelector('#confirm-description').value = suggestions.description;
        }

        if (suggestions.date) {
            this.dialog.querySelector('#confirm-date').value = suggestions.date;
        }

        // Populate category dropdown
        this.populateCategoryDropdown(suggestions.category);

        // Show warnings if any
        this.showValidationWarnings(extractedData);
    }

    /**
     * Populate category dropdown with options
     */
    populateCategoryDropdown(selectedCategory) {
        const categorySelect = this.dialog.querySelector('#confirm-category');
        const originalCategorySelect = document.getElementById('transaction-category');

        if (originalCategorySelect) {
            // Copy options from main form
            categorySelect.innerHTML = originalCategorySelect.innerHTML;
            if (selectedCategory) {
                categorySelect.value = selectedCategory;
            }
        }
    }

    /**
     * Show validation warnings
     */
    showValidationWarnings(extractedData) {
        const warningsDiv = this.dialog.querySelector('#voice-warnings');
        const warningsList = this.dialog.querySelector('#voice-warnings-list');

        const warnings = [];
        
        if (extractedData.confidence < 70) {
            warnings.push('Low confidence in voice recognition');
        }
        
        if (!extractedData.amount) {
            warnings.push('No amount detected - please enter manually');
        }
        
        if (!extractedData.category) {
            warnings.push('No category detected - please select manually');
        }

        if (warnings.length > 0) {
            warningsList.innerHTML = warnings.map(w => `<li>${w}</li>`).join('');
            warningsDiv.style.display = 'block';
        } else {
            warningsDiv.style.display = 'none';
        }
    }

    /**
     * Handle apply button click
     */
    handleApply(allowEdit) {
        const formData = {
            amount: this.dialog.querySelector('#confirm-amount').value,
            category: this.dialog.querySelector('#confirm-category').value,
            description: this.dialog.querySelector('#confirm-description').value,
            date: this.dialog.querySelector('#confirm-date').value
        };

        if (this.callbacks.onConfirm) {
            this.callbacks.onConfirm(formData, allowEdit);
        }

        this.hide();
    }

    /**
     * Show the dialog
     */
    showDialog() {
        if (this.dialog) {
            this.dialog.style.display = 'flex';
            // Focus first input
            const firstInput = this.dialog.querySelector('input, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    /**
     * Hide the dialog
     */
    hide() {
        if (this.dialog) {
            // EventManager will handle cleanup of event listeners when the DOM element is removed
            if (this.dialog.parentNode) {
                this.dialog.parentNode.removeChild(this.dialog);
            }
            this.dialog = null;
        }

        if (this.callbacks.onCancel) {
            this.callbacks.onCancel();
        }
    }
}