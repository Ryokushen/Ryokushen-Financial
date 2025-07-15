/**
 * Time-based Budgets Module
 * Converts monetary values to time equivalents based on user's hourly wage
 * Helps users understand the "time cost" of purchases and financial decisions
 */

import { debug } from './debug.js';
import { formatCurrency } from './utils.js';

// Storage key for wage configuration
const WAGE_CONFIG_KEY = 'wage_config';

/**
 * Time-based budget calculations and management
 */
export class TimeBudgets {
    constructor() {
        this.wageConfig = this.loadWageConfig();
        this.debug = debug;
    }

    /**
     * Load wage configuration from localStorage
     * @returns {Object} Wage configuration object
     */
    loadWageConfig() {
        try {
            const stored = localStorage.getItem(WAGE_CONFIG_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            this.debug.error('Error loading wage config:', error);
        }
        
        // Default configuration
        return {
            hourlyRate: 0,
            currency: 'USD',
            taxRate: 0,
            enabled: false,
            lastUpdated: null
        };
    }

    /**
     * Save wage configuration to localStorage
     * @param {Object} config - Wage configuration to save
     */
    saveWageConfig(config) {
        try {
            this.wageConfig = { ...this.wageConfig, ...config, lastUpdated: new Date().toISOString() };
            localStorage.setItem(WAGE_CONFIG_KEY, JSON.stringify(this.wageConfig));
            this.debug.log('Wage config saved:', this.wageConfig);
            
            // Dispatch event for other modules to react
            window.dispatchEvent(new CustomEvent('wage-config-updated', { detail: this.wageConfig }));
        } catch (error) {
            this.debug.error('Error saving wage config:', error);
        }
    }

    /**
     * Get current wage configuration
     * @returns {Object} Current wage configuration
     */
    getWageConfig() {
        return { ...this.wageConfig };
    }

    /**
     * Check if time-based budgets are enabled
     * @returns {boolean} True if enabled
     */
    isEnabled() {
        return this.wageConfig.enabled && this.wageConfig.hourlyRate > 0;
    }

    /**
     * Calculate net hourly rate after taxes
     * @param {number} grossRate - Gross hourly rate
     * @param {number} taxRate - Tax rate as decimal (e.g., 0.25 for 25%)
     * @returns {number} Net hourly rate
     */
    calculateNetRate(grossRate = this.wageConfig.hourlyRate, taxRate = this.wageConfig.taxRate) {
        return grossRate * (1 - taxRate);
    }

    /**
     * Convert monetary amount to time worked
     * @param {number} amount - Dollar amount
     * @param {boolean} useNetRate - Whether to use after-tax rate
     * @returns {Object} Time breakdown { hours, minutes, totalMinutes, formatted }
     */
    convertToTime(amount, useNetRate = true) {
        if (!this.isEnabled() || amount === 0) {
            return null;
        }

        const rate = useNetRate ? this.calculateNetRate() : this.wageConfig.hourlyRate;
        if (rate <= 0) return null;

        const totalMinutes = Math.abs(amount) / rate * 60;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);

        return {
            hours,
            minutes,
            totalMinutes,
            formatted: this.formatTime(hours, minutes),
            rate: rate
        };
    }

    /**
     * Format time for display
     * @param {number} hours - Number of hours
     * @param {number} minutes - Number of minutes
     * @returns {string} Formatted time string
     */
    formatTime(hours, minutes) {
        if (hours === 0 && minutes === 0) return '0m';
        
        if (hours === 0) {
            return `${minutes}m`;
        } else if (minutes === 0) {
            return `${hours}h`;
        } else {
            return `${hours}h ${minutes}m`;
        }
    }

    /**
     * Format time from total minutes
     * @param {number} totalMinutes - Total minutes
     * @returns {string} Formatted time string
     */
    formatMinutes(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return this.formatTime(hours, minutes);
    }

    /**
     * Calculate time cost for an array of transactions
     * @param {Array} transactions - Array of transaction objects
     * @param {boolean} useNetRate - Whether to use after-tax rate
     * @returns {Object} Aggregated time costs by category
     */
    calculateTimeCostsByCategory(transactions, useNetRate = true) {
        if (!this.isEnabled() || !transactions || transactions.length === 0) {
            return {};
        }

        const timeCosts = {};
        
        transactions.forEach(transaction => {
            const category = transaction.category || 'Uncategorized';
            const timeData = this.convertToTime(transaction.amount, useNetRate);
            
            if (timeData) {
                if (!timeCosts[category]) {
                    timeCosts[category] = {
                        totalMinutes: 0,
                        totalAmount: 0,
                        count: 0
                    };
                }
                
                timeCosts[category].totalMinutes += timeData.totalMinutes;
                timeCosts[category].totalAmount += Math.abs(transaction.amount);
                timeCosts[category].count++;
            }
        });

        // Format the results
        Object.keys(timeCosts).forEach(category => {
            timeCosts[category].formatted = this.formatMinutes(timeCosts[category].totalMinutes);
        });

        return timeCosts;
    }

    /**
     * Get time insights for a set of transactions
     * @param {Array} transactions - Array of transaction objects
     * @param {string} timeFrame - Time frame for analysis (e.g., 'month', 'year')
     * @returns {Object} Time-based insights
     */
    getTimeInsights(transactions, timeFrame = 'month') {
        if (!this.isEnabled() || !transactions || transactions.length === 0) {
            return null;
        }

        const expenses = transactions.filter(t => t.amount < 0);
        const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const timeData = this.convertToTime(totalExpenses);

        if (!timeData) return null;

        const categoryCosts = this.calculateTimeCostsByCategory(expenses);
        
        // Find highest time cost category
        let highestCategory = null;
        let highestMinutes = 0;
        
        Object.entries(categoryCosts).forEach(([category, data]) => {
            if (data.totalMinutes > highestMinutes) {
                highestMinutes = data.totalMinutes;
                highestCategory = category;
            }
        });

        return {
            totalTimeWorked: timeData.formatted,
            totalMinutes: timeData.totalMinutes,
            totalAmount: totalExpenses,
            averagePerDay: timeData.totalMinutes / 30, // Approximate for month
            highestCategory,
            highestCategoryTime: highestCategory ? categoryCosts[highestCategory].formatted : null,
            categoryCosts,
            timeFrame
        };
    }

    /**
     * Create a time cost display element
     * @param {number} amount - Dollar amount
     * @param {Object} options - Display options
     * @returns {string} HTML string for time cost display
     */
    createTimeDisplay(amount, options = {}) {
        if (!this.isEnabled()) return '';

        const timeData = this.convertToTime(amount, options.useNetRate !== false);
        if (!timeData) return '';

        const className = options.className || 'time-cost-badge';
        const icon = options.showIcon !== false ? '🕐 ' : '';
        
        return `<span class="${className}" title="Time cost based on $${timeData.rate.toFixed(2)}/hour">${icon}${timeData.formatted}</span>`;
    }

    /**
     * Update wage configuration and trigger UI updates
     * @param {Object} updates - Configuration updates
     */
    updateConfig(updates) {
        this.saveWageConfig(updates);
    }

    /**
     * Toggle time-based budgets on/off
     */
    toggle() {
        this.updateConfig({ enabled: !this.wageConfig.enabled });
    }

    /**
     * Get a summary of current configuration
     * @returns {Object} Configuration summary
     */
    getConfigSummary() {
        const netRate = this.calculateNetRate();
        return {
            enabled: this.wageConfig.enabled,
            grossRate: this.wageConfig.hourlyRate,
            netRate: netRate,
            taxRate: this.wageConfig.taxRate,
            currency: this.wageConfig.currency,
            formattedGross: formatCurrency(this.wageConfig.hourlyRate),
            formattedNet: formatCurrency(netRate),
            lastUpdated: this.wageConfig.lastUpdated
        };
    }
}

// Create and export singleton instance
export const timeBudgets = new TimeBudgets();

// Export utility functions for direct use
export const {
    isEnabled,
    convertToTime,
    formatTime,
    createTimeDisplay,
    getTimeInsights
} = timeBudgets;