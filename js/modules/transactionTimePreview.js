/**
 * Transaction Time Preview Module
 * Shows real-time time cost preview when entering transaction amounts
 */

import { timeBudgets } from './timeBudgets.js';
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';

/**
 * Initialize transaction time preview
 */
export function initializeTransactionTimePreview() {
    const amountInput = document.getElementById('transaction-amount');
    const categorySelect = document.getElementById('transaction-category');
    const previewContainer = document.getElementById('transaction-time-preview');
    const previewBadge = previewContainer?.querySelector('.time-cost-badge');
    
    if (!amountInput || !previewContainer || !previewBadge) {
        debug.warn('Transaction time preview elements not found', {
            amountInput: !!amountInput,
            previewContainer: !!previewContainer,
            previewBadge: !!previewBadge
        });
        return;
    }
    
    debug.log('Transaction time preview initialized');
    
    // Initially hide the preview
    previewContainer.style.display = 'none';
    
    // Update preview on amount change
    eventManager.addEventListener(amountInput, 'input', updatePreview);
    if (categorySelect) {
        eventManager.addEventListener(categorySelect, 'change', updatePreview);
    }
    
    // Listen for wage config updates
    eventManager.addEventListener(window, 'wage-config-updated', updatePreview);
    
    function updatePreview() {
        debug.log('updatePreview called', {
            enabled: timeBudgets.isEnabled(),
            amount: amountInput.value,
            category: categorySelect?.value
        });
        if (!timeBudgets.isEnabled()) {
            previewContainer.style.display = 'none';
            return;
        }
        
        const amount = parseFloat(amountInput.value) || 0;
        const category = categorySelect?.value || '';
        
        // Show preview for any non-zero amount
        // For positive amounts, only show if it's an expense category
        const expenseCategories = ['Food', 'Transportation', 'Shopping', 'Entertainment', 
                                   'Healthcare', 'Education', 'Groceries', 'Debt', 'Fees', 
                                   'Bills', 'Utilities', 'Insurance', 'Other'];
        
        const shouldShowPreview = amount !== 0 && (amount < 0 || expenseCategories.includes(category));
        
        debug.log('Preview visibility check', {
            amount,
            category,
            shouldShowPreview,
            isExpenseCategory: expenseCategories.includes(category)
        });
        
        if (!shouldShowPreview) {
            previewContainer.style.display = 'none';
            return;
        }
        
        const absoluteAmount = Math.abs(amount);
        const timeData = timeBudgets.convertToTime(absoluteAmount);
        
        if (!timeData) {
            previewContainer.style.display = 'none';
            return;
        }
        
        // Update preview
        previewBadge.innerHTML = `🕐 This will cost ${timeData.formatted} of work`;
        previewContainer.style.display = 'block';
        
        // Add color coding based on time cost
        if (timeData.totalMinutes > 480) { // More than 8 hours
            previewBadge.style.color = 'var(--color-error)';
        } else if (timeData.totalMinutes > 240) { // More than 4 hours
            previewBadge.style.color = 'var(--color-warning)';
        } else {
            previewBadge.style.color = 'var(--color-primary)';
        }
    }
}

/**
 * Show time cost notification after transaction is added
 */
export function showTransactionTimeNotification(amount, category) {
    if (!timeBudgets.isEnabled() || amount >= 0) return;
    
    const timeData = timeBudgets.convertToTime(Math.abs(amount));
    if (!timeData) return;
    
    // Create a notification element
    const notification = document.createElement('div');
    notification.className = 'time-cost-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <strong>Time Impact:</strong> You just spent ${timeData.formatted} of work on ${category}
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideUp 0.3s ease-out;
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            transform: translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes slideDown {
        from {
            transform: translateY(0);
            opacity: 1;
        }
        to {
            transform: translateY(100%);
            opacity: 0;
        }
    }
    
    .time-cost-preview {
        font-size: 0.9em;
        transition: all 0.3s ease;
    }
    
    .time-cost-notification {
        font-size: 0.95em;
        line-height: 1.4;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }
`;
document.head.appendChild(style);