// js/modules/bulkOperations.js
import { eventManager } from './eventManager.js';
import { transactionManager } from './transactionManager.js';
import { showError, showSuccess, announceToScreenReader } from './ui.js';
import { modalManager } from './modalManager.js';
import { populateCategoryDropdown } from './categories.js';
import { formatCurrency } from './utils.js';
import { loadingState } from './loadingState.js';
import { dataIndex } from './dataIndex.js';
import { debug } from './debug.js';

class BulkOperationsUI {
    constructor() {
        this.selectedTransactions = new Set();
        this.isActive = false;
        this.progressModal = null;
        this.categoryModal = null;
    }

    init() {
        this.setupEventListeners();
        this.createModals();
        debug.log('BulkOperations UI initialized');
    }

    setupEventListeners() {
        // Enable/disable bulk mode when clicking on any checkbox
        eventManager.addEventListener(document, 'change', (e) => {
            if (e.target.classList.contains('transaction-checkbox')) {
                this.handleCheckboxChange(e.target);
            }
        });

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('select-all-transactions');
        if (selectAllCheckbox) {
            eventManager.addEventListener(selectAllCheckbox, 'change', (e) => {
                this.handleSelectAllChange(e.target.checked);
            });
        }

        // Apply bulk action button
        const applyButton = document.getElementById('apply-bulk-action');
        if (applyButton) {
            eventManager.addEventListener(applyButton, 'click', () => {
                this.handleBulkAction();
            });
        }

        // Cancel bulk selection
        const cancelButton = document.getElementById('cancel-bulk-selection');
        if (cancelButton) {
            eventManager.addEventListener(cancelButton, 'click', () => {
                this.cancelBulkSelection();
            });
        }

        // Bulk action select change
        const actionSelect = document.getElementById('bulk-action-select');
        if (actionSelect) {
            eventManager.addEventListener(actionSelect, 'change', (e) => {
                const applyButton = document.getElementById('apply-bulk-action');
                if (applyButton) {
                    applyButton.disabled = !e.target.value || this.selectedTransactions.size === 0;
                }
            });
        }
    }

    createModals() {
        // Create progress modal HTML
        const progressModalHtml = `
            <div id="bulk-progress-modal" class="modal" style="display: none;">
                <div class="modal__backdrop"></div>
                <div class="modal__content bulk-progress-modal">
                    <h3>Processing Bulk Action</h3>
                    <div class="bulk-progress-bar">
                        <div class="bulk-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="bulk-progress-text">Processing 0 of 0 transactions...</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', progressModalHtml);

        // Create category selection modal
        const categoryModalHtml = `
            <div id="bulk-category-modal" class="modal" style="display: none;">
                <div class="modal__backdrop"></div>
                <div class="modal__content bulk-action-modal">
                    <div class="modal__header">
                        <h3>Categorize Transactions</h3>
                        <button class="modal__close" data-modal-close aria-label="Close">&times;</button>
                    </div>
                    <div class="modal__body">
                        <form class="bulk-action-form" id="bulk-category-form">
                            <div class="form-group">
                                <label for="bulk-category-select">Select Category</label>
                                <select id="bulk-category-select" class="bulk-category-select" required>
                                    <option value="">— Choose a category —</option>
                                </select>
                            </div>
                            <div class="bulk-action-summary">
                                This will update the category for <strong id="category-count">0</strong> selected transactions.
                            </div>
                        </form>
                    </div>
                    <div class="modal__footer">
                        <button type="button" class="btn btn--ghost" data-modal-close>Cancel</button>
                        <button type="button" class="btn btn--primary" id="apply-category-btn">Apply Category</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', categoryModalHtml);

        // Register modals
        modalManager.register('bulk-progress-modal');
        modalManager.register('bulk-category-modal');

        // Setup category form submit
        const applyCategoryBtn = document.getElementById('apply-category-btn');
        if (applyCategoryBtn) {
            eventManager.addEventListener(applyCategoryBtn, 'click', () => {
                this.applyBulkCategory();
            });
        }
    }

    handleCheckboxChange(checkbox) {
        const transactionId = checkbox.dataset.id;
        const row = checkbox.closest('.table-row');

        if (checkbox.checked) {
            this.selectedTransactions.add(transactionId);
            row.classList.add('selected');
        } else {
            this.selectedTransactions.delete(transactionId);
            row.classList.remove('selected');
        }

        this.updateBulkUI();
    }

    handleSelectAllChange(checked) {
        const checkboxes = document.querySelectorAll('.transaction-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            this.handleCheckboxChange(checkbox);
        });
    }

    updateBulkUI() {
        const toolbar = document.getElementById('bulk-operations-toolbar');
        const selectedCount = document.getElementById('selected-count');
        const actionSelect = document.getElementById('bulk-action-select');
        const applyButton = document.getElementById('apply-bulk-action');
        const selectAllCheckbox = document.getElementById('select-all-transactions');

        if (this.selectedTransactions.size > 0) {
            // Show toolbar
            if (toolbar) toolbar.style.display = 'flex';
            this.isActive = true;

            // Update count
            if (selectedCount) selectedCount.textContent = this.selectedTransactions.size;

            // Enable controls
            if (actionSelect) actionSelect.disabled = false;
            if (applyButton && actionSelect?.value) {
                applyButton.disabled = false;
            }

            // Update select all checkbox state
            const totalCheckboxes = document.querySelectorAll('.transaction-checkbox').length;
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = this.selectedTransactions.size === totalCheckboxes;
                selectAllCheckbox.indeterminate = 
                    this.selectedTransactions.size > 0 && this.selectedTransactions.size < totalCheckboxes;
            }
        } else {
            // Hide toolbar
            if (toolbar) toolbar.style.display = 'none';
            this.isActive = false;

            // Reset controls
            if (actionSelect) {
                actionSelect.value = '';
                actionSelect.disabled = true;
            }
            if (applyButton) applyButton.disabled = true;
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            }
        }
    }

    cancelBulkSelection() {
        // Uncheck all checkboxes
        const checkboxes = document.querySelectorAll('.transaction-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const row = checkbox.closest('.table-row');
            if (row) row.classList.remove('selected');
        });

        // Clear selection
        this.selectedTransactions.clear();
        this.updateBulkUI();

        announceToScreenReader('Bulk selection cancelled');
    }

    async handleBulkAction() {
        const actionSelect = document.getElementById('bulk-action-select');
        if (!actionSelect || !actionSelect.value) return;

        const action = actionSelect.value;
        const count = this.selectedTransactions.size;

        switch (action) {
            case 'categorize':
                this.showCategoryModal();
                break;
            case 'delete':
                this.confirmBulkDelete(count);
                break;
            case 'export':
                this.exportTransactions();
                break;
            default:
                showError('Unknown bulk action');
        }
    }

    showCategoryModal() {
        // Populate category dropdown
        const categorySelect = document.getElementById('bulk-category-select');
        if (categorySelect) {
            populateCategoryDropdown(categorySelect);
        }

        // Update count
        const countElement = document.getElementById('category-count');
        if (countElement) {
            countElement.textContent = this.selectedTransactions.size;
        }

        modalManager.open('bulk-category-modal');
    }

    async applyBulkCategory() {
        const categorySelect = document.getElementById('bulk-category-select');
        if (!categorySelect || !categorySelect.value) {
            showError('Please select a category');
            return;
        }

        const category = categorySelect.value;
        const transactionIds = Array.from(this.selectedTransactions);

        modalManager.close('bulk-category-modal');
        this.showProgressModal('Categorizing transactions...', transactionIds.length);

        try {
            // Prepare updates
            const updates = transactionIds.map(id => ({
                id,
                updates: { category }
            }));

            // Use TransactionManager's batch update
            const results = await transactionManager.updateMultipleTransactions(updates, {
                onProgress: (progress) => {
                    this.updateProgress(progress.processed, progress.total);
                }
            });

            this.hideProgressModal();

            if (results.failed.length > 0) {
                showError(`Updated ${results.successful.length} transactions. ${results.failed.length} failed.`);
            } else {
                showSuccess(`Successfully categorized ${results.successful.length} transactions`);
            }

            // Clear selection and refresh
            this.cancelBulkSelection();
            window.dispatchEvent(new CustomEvent('transaction:updated'));

        } catch (error) {
            this.hideProgressModal();
            showError('Failed to categorize transactions: ' + error.message);
            debug.error('Bulk categorize error:', error);
        }
    }

    confirmBulkDelete(count) {
        const message = `Are you sure you want to delete ${count} transaction${count > 1 ? 's' : ''}? This action cannot be undone.`;
        
        if (confirm(message)) {
            this.performBulkDelete();
        }
    }

    async performBulkDelete() {
        const transactionIds = Array.from(this.selectedTransactions);
        this.showProgressModal('Deleting transactions...', transactionIds.length);

        try {
            // Use TransactionManager's batch delete
            const results = await transactionManager.deleteMultipleTransactions(transactionIds, {
                onProgress: (progress) => {
                    this.updateProgress(progress.processed, progress.total);
                }
            });

            this.hideProgressModal();

            if (results.failed.length > 0) {
                showError(`Deleted ${results.successful.length} transactions. ${results.failed.length} failed.`);
            } else {
                showSuccess(`Successfully deleted ${results.successful.length} transactions`);
            }

            // Clear selection and refresh
            this.cancelBulkSelection();
            window.dispatchEvent(new CustomEvent('transaction:deleted'));

        } catch (error) {
            this.hideProgressModal();
            showError('Failed to delete transactions: ' + error.message);
            debug.error('Bulk delete error:', error);
        }
    }

    async exportTransactions() {
        try {
            const transactionIds = Array.from(this.selectedTransactions);
            const transactions = [];

            // Get transaction details
            for (const id of transactionIds) {
                const transaction = await transactionManager.getTransaction(id);
                if (transaction) {
                    transactions.push(transaction);
                }
            }

            if (transactions.length === 0) {
                showError('No transactions to export');
                return;
            }

            // Convert to CSV
            const csv = this.transactionsToCSV(transactions);
            
            // Download file
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showSuccess(`Exported ${transactions.length} transactions`);
            this.cancelBulkSelection();

        } catch (error) {
            showError('Failed to export transactions: ' + error.message);
            debug.error('Export error:', error);
        }
    }

    transactionsToCSV(transactions) {
        const headers = ['Date', 'Description', 'Category', 'Amount', 'Account', 'Type', 'Notes'];
        const rows = [headers];

        transactions.forEach(t => {
            const accountName = this.getAccountName(t);
            const type = t.amount >= 0 ? 'Income' : 'Expense';
            
            rows.push([
                t.date,
                t.description,
                t.category,
                Math.abs(t.amount).toFixed(2),
                accountName,
                type,
                t.notes || ''
            ]);
        });

        return rows.map(row => row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(cell).replace(/"/g, '""');
            return escaped.includes(',') ? `"${escaped}"` : escaped;
        }).join(',')).join('\n');
    }

    getAccountName(transaction) {
        if (transaction.account_id) {
            const account = dataIndex.indexes?.cashAccountsById?.get(transaction.account_id);
            return account ? account.name : 'Unknown Account';
        } else if (transaction.debt_account_id) {
            const debtAccount = dataIndex.indexes?.debtAccountsById?.get(transaction.debt_account_id);
            return debtAccount ? `${debtAccount.name} (Credit Card)` : 'Unknown Credit Card';
        }
        return 'N/A';
    }

    showProgressModal(message, total) {
        const modal = document.getElementById('bulk-progress-modal');
        const progressText = modal.querySelector('.bulk-progress-text');
        
        if (progressText) {
            progressText.textContent = `${message} 0 of ${total}...`;
        }

        modalManager.open('bulk-progress-modal');
        this.updateProgress(0, total);
    }

    updateProgress(current, total) {
        const progressFill = document.querySelector('.bulk-progress-fill');
        const progressText = document.querySelector('.bulk-progress-text');
        
        if (progressFill) {
            const percentage = total > 0 ? (current / total) * 100 : 0;
            progressFill.style.width = `${percentage}%`;
        }

        if (progressText) {
            const currentMessage = progressText.textContent.split(' 0 of')[0];
            progressText.textContent = `${currentMessage} ${current} of ${total}...`;
        }
    }

    hideProgressModal() {
        modalManager.close('bulk-progress-modal');
    }

    cleanup() {
        this.cancelBulkSelection();
        eventManager.removeListeners('bulkOperations');
    }
}

// Create singleton instance
export const bulkOperationsUI = new BulkOperationsUI();