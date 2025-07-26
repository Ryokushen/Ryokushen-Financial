// js/modules/voice/voiceResponseSystem.js - Voice Response & Feedback System

import { debug } from '../debug.js';
import { formatCurrency, escapeHtml } from '../utils.js';
import { announceToScreenReader } from '../ui.js';
import { eventManager } from '../eventManager.js';

/**
 * Voice Response System - Handles visual and audio feedback for voice commands
 */
export class VoiceResponseSystem {
    constructor() {
        this.responseContainer = null;
        this.currentResponse = null;
        this.initializeResponseUI();
    }

    /**
     * Initialize response UI components
     */
    initializeResponseUI() {
        this.createResponseContainer();
        this.injectStyles();
    }

    /**
     * Create response container
     */
    createResponseContainer() {
        // Remove existing container
        const existing = document.getElementById('voice-response-container');
        if (existing) {
            existing.remove();
        }

        this.responseContainer = document.createElement('div');
        this.responseContainer.id = 'voice-response-container';
        this.responseContainer.className = 'voice-response-container';
        this.responseContainer.style.display = 'none';

        document.body.appendChild(this.responseContainer);
    }

    /**
     * Inject CSS styles for response system
     */
    injectStyles() {
        if (document.getElementById('voice-response-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'voice-response-styles';
        styles.textContent = `
            .voice-response-container {
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 9999;
                max-width: 400px;
                animation: slideInRight 0.3s ease-out;
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            .voice-response-card {
                background: var(--color-surface, white);
                border: 2px solid var(--color-primary, #007bff);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 123, 255, 0.15);
                margin-bottom: 12px;
                overflow: hidden;
                animation: slideIn 0.3s ease-out;
            }

            .voice-response-header {
                background: var(--color-primary, #007bff);
                color: white;
                padding: 12px 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .voice-response-title {
                font-weight: bold;
                font-size: 16px;
                margin: 0;
            }

            .voice-response-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s;
            }

            .voice-response-close:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .voice-response-body {
                padding: 16px;
            }

            .voice-response-text {
                font-size: 18px;
                font-weight: 600;
                color: var(--color-text, #333);
                margin-bottom: 8px;
            }

            .voice-response-details {
                font-size: 14px;
                color: var(--color-text-secondary, #666);
                margin-bottom: 16px;
            }

            .voice-response-data {
                background: var(--color-surface-secondary, #f8f9fa);
                border-radius: 8px;
                padding: 12px;
                margin-top: 12px;
            }

            .voice-data-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 12px;
            }

            .voice-data-item {
                text-align: center;
            }

            .voice-data-label {
                font-size: 12px;
                color: var(--color-text-secondary, #666);
                margin-bottom: 4px;
            }

            .voice-data-value {
                font-size: 16px;
                font-weight: bold;
                color: var(--color-text, #333);
            }

            .voice-data-value.positive {
                color: var(--color-success, #28a745);
            }

            .voice-data-value.negative {
                color: var(--color-error, #dc3545);
            }

            .voice-transactions-list {
                margin-top: 12px;
                max-height: 200px;
                overflow-y: auto;
            }

            .voice-transaction-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid var(--color-border, #eee);
                font-size: 13px;
            }

            .voice-transaction-item:last-child {
                border-bottom: none;
            }

            .voice-transaction-desc {
                flex: 1;
                color: var(--color-text, #333);
            }

            .voice-transaction-amount {
                font-weight: bold;
                margin-left: 8px;
            }

            .voice-error-card {
                background: var(--color-error-bg, #f8d7da);
                border-color: var(--color-error, #dc3545);
            }

            .voice-error-card .voice-response-header {
                background: var(--color-error, #dc3545);
            }

            .voice-help-commands {
                display: grid;
                gap: 8px;
                margin-top: 12px;
            }

            .voice-help-command {
                background: var(--color-surface-secondary, #f8f9fa);
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                color: var(--color-text, #333) !important;
                border: 1px solid var(--color-border, #eee);
            }
            
            /* Dark mode / theme fix for help commands */
            .dark-theme .voice-help-command,
            .dark .voice-help-command {
                background: var(--color-surface-secondary, #2a2a2a);
                color: var(--color-text, #e0e0e0) !important;
                border-color: var(--color-border, #444);
            }

            .voice-response-icon {
                font-size: 20px;
                margin-right: 8px;
            }

            /* Mobile responsive */
            @media (max-width: 480px) {
                .voice-response-container {
                    left: 10px;
                    right: 10px;
                    top: 70px;
                    max-width: none;
                }
            }

            /* Privacy mode compatibility */
            .privacy-mode .voice-response-container {
                display: none !important;
            }

            /* Auto-hide animation */
            .voice-response-card.auto-hiding {
                animation: fadeOut 0.5s ease-in-out forwards;
            }

            @keyframes fadeOut {
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Display response for voice command result
     */
    displayResponse(result, autoHide = true) {
        debug.log('Displaying voice response:', result);

        this.currentResponse = result;
        this.responseContainer.innerHTML = '';

        const card = this.createResponseCard(result);
        this.responseContainer.appendChild(card);
        this.responseContainer.style.display = 'block';

        // Announce response for accessibility
        if (result.response && result.response.text) {
            announceToScreenReader(result.response.text);
        }

        // Auto-hide after delay (except for errors and help)
        if (autoHide && !['error', 'help'].includes(result.type)) {
            setTimeout(() => {
                this.hideResponse();
            }, 8000);
        }
    }

    /**
     * Create response card based on result type
     */
    createResponseCard(result) {
        const card = document.createElement('div');
        card.className = `voice-response-card ${result.type === 'error' ? 'voice-error-card' : ''}`;

        const header = this.createResponseHeader(result);
        const body = this.createResponseBody(result);

        card.appendChild(header);
        card.appendChild(body);

        return card;
    }

    /**
     * Create response header
     */
    createResponseHeader(result) {
        const header = document.createElement('div');
        header.className = 'voice-response-header';

        const icon = this.getResponseIcon(result.type);
        const title = result.response?.title || this.getDefaultTitle(result.type);

        header.innerHTML = `
            <h3 class="voice-response-title">
                <span class="voice-response-icon">${icon}</span>
                ${escapeHtml(title)}
            </h3>
            <button class="voice-response-close" aria-label="Close response">&times;</button>
        `;

        // Add close functionality
        const closeBtn = header.querySelector('.voice-response-close');
        if (closeBtn) {
            eventManager.addEventListener(closeBtn, 'click', () => {
                this.hideResponse();
            });
        }

        return header;
    }

    /**
     * Create response body with type-specific content
     */
    createResponseBody(result) {
        const body = document.createElement('div');
        body.className = 'voice-response-body';

        switch (result.type) {
            case 'balance':
            case 'networth':
            case 'debt':
            case 'investments':
                body.appendChild(this.createFinancialResponseBody(result));
                break;
            case 'spending':
            case 'merchant_spending':
                body.appendChild(this.createSpendingResponseBody(result));
                break;
            case 'health':
                body.appendChild(this.createHealthResponseBody(result));
                break;
            case 'help':
                body.appendChild(this.createHelpResponseBody(result));
                break;
            case 'navigation':
            case 'action':
            case 'settings':
                body.appendChild(this.createActionResponseBody(result));
                break;
            case 'error':
                body.appendChild(this.createErrorResponseBody(result));
                break;
            default:
                body.appendChild(this.createDefaultResponseBody(result));
        }

        return body;
    }

    /**
     * Create financial response body (balance, net worth, etc.)
     */
    createFinancialResponseBody(result) {
        const container = document.createElement('div');
        
        container.innerHTML = `
            <div class="voice-response-text">${escapeHtml(result.response.text)}</div>
            <div class="voice-response-details">${escapeHtml(result.response.details)}</div>
        `;

        // Add data visualization for complex responses
        if (result.type === 'networth' && result.data) {
            const dataGrid = document.createElement('div');
            dataGrid.className = 'voice-response-data';
            dataGrid.innerHTML = `
                <div class="voice-data-grid">
                    <div class="voice-data-item">
                        <div class="voice-data-label">Cash</div>
                        <div class="voice-data-value positive">${formatCurrency(result.data.totalCash)}</div>
                    </div>
                    <div class="voice-data-item">
                        <div class="voice-data-label">Investments</div>
                        <div class="voice-data-value positive">${formatCurrency(result.data.totalInvestments)}</div>
                    </div>
                    <div class="voice-data-item">
                        <div class="voice-data-label">Debt</div>
                        <div class="voice-data-value negative">${formatCurrency(result.data.totalDebt)}</div>
                    </div>
                </div>
            `;
            container.appendChild(dataGrid);
        }

        return container;
    }

    /**
     * Create spending response body
     */
    createSpendingResponseBody(result) {
        const container = document.createElement('div');
        
        container.innerHTML = `
            <div class="voice-response-text">${escapeHtml(result.response.text)}</div>
            <div class="voice-response-details">${escapeHtml(result.response.details)}</div>
        `;

        // Add recent transactions if available
        if (result.data?.transactions && result.data.transactions.length > 0) {
            const transactionsList = document.createElement('div');
            transactionsList.className = 'voice-transactions-list';
            transactionsList.innerHTML = '<div class="voice-data-label" style="margin-bottom: 8px;">Recent Transactions:</div>';

            result.data.transactions.forEach(transaction => {
                const item = document.createElement('div');
                item.className = 'voice-transaction-item';
                item.innerHTML = `
                    <span class="voice-transaction-desc">${escapeHtml(transaction.description)}</span>
                    <span class="voice-transaction-amount negative">${formatCurrency(Math.abs(transaction.amount))}</span>
                `;
                transactionsList.appendChild(item);
            });

            container.appendChild(transactionsList);
        }

        return container;
    }

    /**
     * Create health response body
     */
    createHealthResponseBody(result) {
        const container = document.createElement('div');
        
        container.innerHTML = `
            <div class="voice-response-text">${escapeHtml(result.response.text)}</div>
            <div class="voice-response-details">${escapeHtml(result.response.details)}</div>
        `;

        if (result.data) {
            const dataGrid = document.createElement('div');
            dataGrid.className = 'voice-response-data';
            
            let gridItems = '';
            if (result.data.savingsRate !== undefined) {
                gridItems += `
                    <div class="voice-data-item">
                        <div class="voice-data-label">Savings Rate</div>
                        <div class="voice-data-value">${result.data.savingsRate.toFixed(1)}%</div>
                    </div>
                `;
            }
            if (result.data.emergencyRatio !== undefined && isFinite(result.data.emergencyRatio)) {
                gridItems += `
                    <div class="voice-data-item">
                        <div class="voice-data-label">Emergency Fund</div>
                        <div class="voice-data-value">${result.data.emergencyRatio.toFixed(1)} months</div>
                    </div>
                `;
            }

            if (gridItems) {
                dataGrid.innerHTML = `<div class="voice-data-grid">${gridItems}</div>`;
                container.appendChild(dataGrid);
            }
        }

        return container;
    }

    /**
     * Create help response body
     */
    createHelpResponseBody(result) {
        const container = document.createElement('div');
        
        container.innerHTML = `
            <div class="voice-response-text">${escapeHtml(result.response.text)}</div>
            <div class="voice-response-details">${escapeHtml(result.response.details)}</div>
        `;

        if (result.data?.commands) {
            const commandsList = document.createElement('div');
            commandsList.className = 'voice-help-commands';

            result.data.commands.forEach(command => {
                const commandItem = document.createElement('div');
                commandItem.className = 'voice-help-command';
                commandItem.textContent = command;
                commandsList.appendChild(commandItem);
            });

            container.appendChild(commandsList);
        }

        return container;
    }

    /**
     * Create action response body (navigation, settings, etc.)
     */
    createActionResponseBody(result) {
        const container = document.createElement('div');
        
        container.innerHTML = `
            <div class="voice-response-text">${escapeHtml(result.response.text)}</div>
            <div class="voice-response-details">${escapeHtml(result.response.details)}</div>
        `;

        return container;
    }

    /**
     * Create error response body
     */
    createErrorResponseBody(result) {
        const container = document.createElement('div');
        
        container.innerHTML = `
            <div class="voice-response-text">${escapeHtml(result.response.text)}</div>
            <div class="voice-response-details">${escapeHtml(result.response.details)}</div>
        `;

        return container;
    }

    /**
     * Create default response body
     */
    createDefaultResponseBody(result) {
        const container = document.createElement('div');
        
        container.innerHTML = `
            <div class="voice-response-text">${escapeHtml(result.response?.text || 'Command processed')}</div>
            <div class="voice-response-details">${escapeHtml(result.response?.details || '')}</div>
        `;

        return container;
    }

    /**
     * Get icon for response type
     */
    getResponseIcon(type) {
        const icons = {
            'balance': '💰',
            'networth': '📊',
            'debt': '💳',
            'investments': '📈',
            'spending': '🛍️',
            'merchant_spending': '🏪',
            'health': '❤️',
            'navigation': '🧭',
            'action': '⚡',
            'settings': '⚙️',
            'help': '❓',
            'error': '⚠️'
        };
        return icons[type] || '💬';
    }

    /**
     * Get default title for response type
     */
    getDefaultTitle(type) {
        const titles = {
            'balance': 'Account Balance',
            'networth': 'Net Worth',
            'debt': 'Debt Summary',
            'investments': 'Investment Portfolio',
            'spending': 'Spending Analysis',
            'merchant_spending': 'Merchant Spending',
            'health': 'Financial Health',
            'navigation': 'Navigation',
            'action': 'Action Complete',
            'settings': 'Settings',
            'help': 'Voice Commands',
            'error': 'Error'
        };
        return titles[type] || 'Voice Response';
    }

    /**
     * Hide response
     */
    hideResponse() {
        if (this.responseContainer) {
            const card = this.responseContainer.querySelector('.voice-response-card');
            if (card) {
                card.classList.add('auto-hiding');
                setTimeout(() => {
                    this.responseContainer.style.display = 'none';
                    this.responseContainer.innerHTML = '';
                }, 500);
            } else {
                this.responseContainer.style.display = 'none';
            }
        }
        this.currentResponse = null;
    }

    /**
     * Check if response is currently visible
     */
    isVisible() {
        return this.responseContainer && 
               this.responseContainer.style.display !== 'none' && 
               this.currentResponse !== null;
    }

    /**
     * Clear all responses
     */
    clearAll() {
        this.hideResponse();
    }

    /**
     * Update response (for real-time data updates)
     */
    updateResponse(newResult) {
        if (this.isVisible() && this.currentResponse?.type === newResult.type) {
            this.displayResponse(newResult, false);
        }
    }
}