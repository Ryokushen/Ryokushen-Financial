/**
 * Time Budget Dashboard Widget
 * Displays time-based budget information and spending metrics
 */

import { timeBudgets } from '../timeBudgets.js';
import { formatCurrency, escapeHtml } from '../utils.js';
import { debug } from '../debug.js';
import { sumMoney } from '../financialMath.js';
import { switchTab } from '../ui.js';

export class TimeBudgetWidget {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.updateInterval = null;
        this.appData = null;
    }

    /**
     * Initialize the widget
     */
    init(appData) {
        this.appData = appData;
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            debug.error(`Time budget widget container not found: ${this.containerId}`);
            return;
        }

        this.render();
        this.startAutoUpdate();
        
        // Listen for wage config updates
        window.addEventListener('wage-config-updated', () => this.render());
        
        // Listen for transaction updates
        window.addEventListener('transaction-added', () => this.render());
        window.addEventListener('transaction-updated', () => this.render());
        window.addEventListener('transaction-deleted', () => this.render());
    }

    /**
     * Render the widget content
     */
    render() {
        if (!this.container) return;

        const isEnabled = timeBudgets.isEnabled();
        const config = timeBudgets.getWageConfig();

        if (!isEnabled) {
            this.container.innerHTML = this.renderDisabledState();
            this.attachEventListeners();
            return;
        }

        const timeMetrics = this.calculateTimeMetrics();
        this.container.innerHTML = this.renderEnabledState(config, timeMetrics);
    }

    /**
     * Calculate time-based metrics from transactions
     */
    calculateTimeMetrics() {
        if (!this.appData || !this.appData.transactions) {
            return {
                today: { hours: 0, minutes: 0, amount: 0 },
                thisWeek: { hours: 0, minutes: 0, amount: 0 },
                thisMonth: { hours: 0, minutes: 0, amount: 0 }
            };
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const metrics = {
            today: this.calculatePeriodMetrics(today, now),
            thisWeek: this.calculatePeriodMetrics(weekStart, now),
            thisMonth: this.calculatePeriodMetrics(monthStart, now)
        };

        return metrics;
    }

    /**
     * Calculate metrics for a specific time period
     */
    calculatePeriodMetrics(startDate, endDate) {
        const expenses = this.appData.transactions.filter(t => {
            const transDate = new Date(t.date);
            return transDate >= startDate && 
                   transDate <= endDate && 
                   t.amount < 0;
        });

        const totalAmount = Math.abs(sumMoney(expenses.map(t => t.amount)));
        const timeData = timeBudgets.convertToTime(totalAmount);

        return {
            hours: timeData?.hours || 0,
            minutes: timeData?.minutes || 0,
            amount: totalAmount,
            formatted: timeData?.formatted || '0m'
        };
    }

    /**
     * Render disabled state
     */
    renderDisabledState() {
        return `
            <div class="time-budget-widget disabled">
                <div class="widget-header">
                    <h3>⏱️ Time Budgets</h3>
                    <span class="status-badge disabled">Disabled</span>
                </div>
                <div class="widget-content">
                    <p class="empty-state">Enable time budgets in settings to see how much time your spending costs.</p>
                    <button class="btn btn-sm btn-primary go-to-settings-btn">
                        Go to Settings
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render enabled state with metrics
     */
    renderEnabledState(config, metrics) {
        const hourlyRate = config.hourlyRate || 0;
        const afterTaxRate = timeBudgets.calculateNetRate();

        return `
            <div class="time-budget-widget enabled">
                <div class="widget-header">
                    <h3>⏱️ Time Budgets</h3>
                    <span class="status-badge enabled">Active</span>
                </div>
                <div class="widget-content">
                    <div class="wage-info">
                        <span class="wage-label">Your time value:</span>
                        <span class="wage-value">${formatCurrency(afterTaxRate)}/hour after taxes</span>
                    </div>
                    
                    <div class="time-metrics">
                        <div class="metric-row">
                            <span class="metric-label">Today:</span>
                            <span class="metric-value">${metrics.today.formatted}</span>
                            <span class="metric-amount">(${formatCurrency(metrics.today.amount)})</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">This Week:</span>
                            <span class="metric-value">${metrics.thisWeek.formatted}</span>
                            <span class="metric-amount">(${formatCurrency(metrics.thisWeek.amount)})</span>
                        </div>
                        <div class="metric-row highlight">
                            <span class="metric-label">This Month:</span>
                            <span class="metric-value">${metrics.thisMonth.formatted}</span>
                            <span class="metric-amount">(${formatCurrency(metrics.thisMonth.amount)})</span>
                        </div>
                    </div>
                    
                    <div class="time-progress">
                        ${this.renderTimeProgress(metrics.thisMonth)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render time progress visualization
     */
    renderTimeProgress(monthMetrics) {
        const totalHours = monthMetrics.hours + (monthMetrics.minutes / 60);
        const workDaysInMonth = 22; // Average work days per month
        const hoursPerDay = 8;
        const totalWorkHours = workDaysInMonth * hoursPerDay;
        const percentage = Math.min((totalHours / totalWorkHours) * 100, 100);

        const getProgressColor = (pct) => {
            if (pct < 20) return 'var(--color-success)';
            if (pct < 40) return 'var(--color-primary)';
            if (pct < 60) return 'var(--color-warning)';
            return 'var(--color-error)';
        };

        return `
            <div class="progress-container">
                <div class="progress-label">
                    <span>Time worked for expenses</span>
                    <span>${percentage.toFixed(1)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%; background-color: ${getProgressColor(percentage)}"></div>
                </div>
                <div class="progress-detail">
                    ${totalHours.toFixed(1)} hours of ${totalWorkHours} monthly work hours
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to widget elements
     */
    attachEventListeners() {
        const settingsBtn = this.container.querySelector('.go-to-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                switchTab('settings', this.appData);
            });
        }
    }

    /**
     * Start auto-updating the widget
     */
    startAutoUpdate() {
        // Update every minute to keep time calculations fresh
        this.updateInterval = setInterval(() => {
            this.render();
        }, 60000);
    }

    /**
     * Destroy the widget and clean up
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     * Update app data reference
     */
    updateAppData(appData) {
        this.appData = appData;
        this.render();
    }
}

// Add widget styles
const style = document.createElement('style');
style.textContent = `
    .time-budget-widget {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .time-budget-widget.disabled {
        opacity: 0.8;
    }

    .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .widget-header h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--color-text);
    }

    .status-badge {
        font-size: 0.75rem;
        padding: 4px 8px;
        border-radius: 12px;
        font-weight: 600;
    }

    .status-badge.enabled {
        background: var(--color-success-bg);
        color: var(--color-success);
    }

    .status-badge.disabled {
        background: var(--color-muted-bg);
        color: var(--color-muted);
    }

    .wage-info {
        background: var(--color-background);
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .wage-label {
        color: var(--color-text-secondary);
        font-size: 0.9rem;
    }

    .wage-value {
        font-weight: 600;
        color: var(--color-primary);
    }

    .time-metrics {
        margin-bottom: 20px;
    }

    .metric-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid var(--color-border-light);
    }

    .metric-row:last-child {
        border-bottom: none;
    }

    .metric-row.highlight {
        background: var(--color-background);
        margin: 0 -8px;
        padding: 8px;
        border-radius: 6px;
        border: none;
    }

    .metric-label {
        color: var(--color-text-secondary);
        font-size: 0.9rem;
    }

    .metric-value {
        font-weight: 600;
        color: var(--color-text);
        font-size: 1rem;
    }

    .metric-amount {
        color: var(--color-text-secondary);
        font-size: 0.85rem;
    }

    .progress-container {
        margin-top: 16px;
    }

    .progress-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 0.85rem;
        color: var(--color-text-secondary);
    }

    .progress-bar {
        height: 8px;
        background: var(--color-background);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 4px;
    }

    .progress-fill {
        height: 100%;
        transition: width 0.3s ease;
        border-radius: 4px;
    }

    .progress-detail {
        font-size: 0.8rem;
        color: var(--color-text-secondary);
        text-align: center;
    }

    .empty-state {
        text-align: center;
        color: var(--color-text-secondary);
        margin: 20px 0;
    }

    .btn-sm {
        font-size: 0.875rem;
        padding: 6px 12px;
    }

    /* Privacy mode support */
    .privacy-mode .wage-value,
    .privacy-mode .metric-value,
    .privacy-mode .metric-amount,
    .privacy-mode .progress-detail {
        filter: blur(8px);
        user-select: none;
    }
`;
document.head.appendChild(style);