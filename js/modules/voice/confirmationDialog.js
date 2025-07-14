// js/modules/voice/confirmationDialog.js - Voice Input Confirmation Dialog

import { debug } from '../debug.js';

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
                        <h3>🎤 Voice Input Confirmation</h3>
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
                            <h4>Extracted Information:</h4>
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
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
            }

            .voice-confirmation-content {
                position: relative;
                background: var(--color-surface, white);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
                padding: 20px;
                border-bottom: 1px solid var(--color-border, #e0e0e0);
            }

            .voice-confirmation-header h3 {
                margin: 0;
                color: var(--color-text, #333);
            }

            .voice-confirmation-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--color-text-secondary, #666);
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .voice-confirmation-body {
                padding: 20px;
            }

            .voice-original-text {
                background: var(--color-surface-secondary, #f8f9fa);
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 16px;
                font-style: italic;
            }

            .voice-confidence {
                text-align: center;
                margin-bottom: 20px;
                font-weight: bold;
                color: var(--color-primary, #007bff);
            }

            .voice-data-grid {
                display: grid;
                gap: 16px;
                margin-top: 12px;
            }

            .voice-data-item {
                display: flex;
                flex-direction: column;
            }

            .voice-data-item label {
                font-weight: bold;
                margin-bottom: 4px;
                color: var(--color-text, #333);
            }

            .voice-data-item input,
            .voice-data-item select {
                padding: 8px 12px;
                border: 1px solid var(--color-border, #ddd);
                border-radius: 4px;
                font-size: 14px;
            }

            .voice-data-item input:focus,
            .voice-data-item select:focus {
                outline: none;
                border-color: var(--color-primary, #007bff);
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
            }

            .voice-warnings {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 6px;
                padding: 12px;
                margin-top: 16px;
            }

            .voice-warnings h5 {
                margin: 0 0 8px 0;
                color: #856404;
            }

            .voice-warnings ul {
                margin: 0;
                padding-left: 20px;
                color: #856404;
            }

            .voice-confirmation-footer {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                padding: 20px;
                border-top: 1px solid var(--color-border, #e0e0e0);
            }

            .voice-confirmation-footer .btn {
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                border: none;
            }

            .btn--primary {
                background: var(--color-primary, #007bff);
                color: white;
            }

            .btn--secondary {
                background: var(--color-secondary, #6c757d);
                color: white;
            }

            .btn--outline {
                background: transparent;
                border: 1px solid var(--color-border, #ddd);
                color: var(--color-text, #333);
            }

            .btn:hover {
                opacity: 0.9;
                transform: translateY(-1px);
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Setup event listeners for dialog
     */
    setupEventListeners() {
        // Close button
        this.dialog.querySelector('.voice-confirmation-close').addEventListener('click', () => {
            this.hide();
        });

        // Overlay click to close
        this.dialog.querySelector('.voice-confirmation-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hide();
            }
        });

        // Footer buttons
        this.dialog.querySelector('#voice-confirm-apply').addEventListener('click', () => {
            this.handleApply(false);
        });

        this.dialog.querySelector('#voice-confirm-edit').addEventListener('click', () => {
            this.handleApply(true);
        });

        this.dialog.querySelector('#voice-confirm-cancel').addEventListener('click', () => {
            this.hide();
        });

        // Escape key to close
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
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
            document.removeEventListener('keydown', this.handleKeyDown.bind(this));
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