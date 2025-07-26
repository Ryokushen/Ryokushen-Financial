/**
 * Time Settings UI Module
 * Handles the user interface for time-based budget configuration
 */

import { timeBudgets } from './timeBudgets.js';
import { showError } from './ui.js';
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';

/**
 * Show a success message to the user
 */
function showMessage(message, type = 'info') {
    // For now, use debug log - can be enhanced later
    debug.log(`[${type.toUpperCase()}] ${message}`);
    
    // Could also show a temporary UI element
    const messageEl = document.createElement('div');
    messageEl.className = `message message--${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#d4edda' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : '#0c5460'};
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
        messageEl.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => messageEl.remove(), 300);
    }, 3000);
}

/**
 * Initialize time settings UI
 */
export function initializeTimeSettings() {
    debug.log('Initializing time settings UI');
    
    // Get DOM elements
    const enableToggle = document.getElementById('enable-time-budgets');
    const wageForm = document.getElementById('wage-config-form');
    const hourlyWageInput = document.getElementById('hourly-wage');
    const taxRateInput = document.getElementById('tax-rate');
    const wagePreview = document.getElementById('wage-preview');
    const settingsBody = document.getElementById('time-settings-body');
    
    if (!enableToggle || !wageForm) {
        debug.warn('Time settings elements not found');
        return;
    }
    
    // Load existing configuration
    loadExistingConfig();
    
    // Setup event listeners
    eventManager.addEventListener(enableToggle, 'change', handleToggleChange);
    eventManager.addEventListener(wageForm, 'submit', handleWageFormSubmit);
    eventManager.addEventListener(hourlyWageInput, 'input', updatePreview);
    eventManager.addEventListener(taxRateInput, 'input', updatePreview);
    
    // Listen for configuration updates from other sources
    eventManager.addEventListener(window, 'wage-config-updated', handleConfigUpdate);
    
    /**
     * Load existing configuration from timeBudgets module
     */
    function loadExistingConfig() {
        const config = timeBudgets.getWageConfig();
        
        enableToggle.checked = config.enabled;
        hourlyWageInput.value = config.hourlyRate || '';
        taxRateInput.value = config.taxRate ? (config.taxRate * 100) : '';
        
        updateUIState(config.enabled);
        if (config.enabled && config.hourlyRate > 0) {
            updatePreview();
        }
    }
    
    /**
     * Handle toggle change
     */
    function handleToggleChange(e) {
        const enabled = e.target.checked;
        
        if (enabled && !hourlyWageInput.value) {
            // If enabling but no wage set, focus on wage input
            hourlyWageInput.focus();
            showMessage('Please set your hourly wage to enable time-based budgets', 'info');
        }
        
        updateUIState(enabled);
        
        // Save the enabled state
        timeBudgets.updateConfig({ enabled });
    }
    
    /**
     * Update UI state based on enabled status
     */
    function updateUIState(enabled) {
        if (enabled) {
            settingsBody.style.display = 'block';
            wageForm.querySelectorAll('input, button').forEach(el => {
                el.disabled = false;
            });
        } else {
            // Keep form visible but indicate it's disabled
            wageForm.querySelectorAll('input, button').forEach(el => {
                el.disabled = true;
            });
            wagePreview.style.display = 'none';
        }
    }
    
    /**
     * Handle wage form submission
     */
    function handleWageFormSubmit(e) {
        e.preventDefault();
        
        const hourlyRate = parseFloat(hourlyWageInput.value) || 0;
        const taxRate = parseFloat(taxRateInput.value) / 100 || 0;
        
        if (hourlyRate <= 0) {
            showError('Please enter a valid hourly wage');
            hourlyWageInput.focus();
            return;
        }
        
        if (taxRate < 0 || taxRate > 1) {
            showError('Tax rate must be between 0 and 100');
            taxRateInput.focus();
            return;
        }
        
        // Save configuration
        timeBudgets.updateConfig({
            hourlyRate,
            taxRate,
            enabled: true
        });
        
        // Update toggle if it wasn't already checked
        if (!enableToggle.checked) {
            enableToggle.checked = true;
        }
        
        showMessage('Time settings saved successfully!', 'success');
        updatePreview();
    }
    
    /**
     * Update the preview based on current input values
     */
    function updatePreview() {
        const hourlyRate = parseFloat(hourlyWageInput.value) || 0;
        const taxRate = parseFloat(taxRateInput.value) / 100 || 0;
        
        if (hourlyRate <= 0) {
            wagePreview.style.display = 'none';
            return;
        }
        
        // Create temporary config for preview
        const netRate = hourlyRate * (1 - taxRate);
        
        // Update preview examples
        const examples = [
            { amount: 50, element: 'preview-50' },
            { amount: 200, element: 'preview-200' },
            { amount: 1000, element: 'preview-1000' }
        ];
        
        examples.forEach(({ amount, element }) => {
            const timeMinutes = amount / netRate * 60;
            const hours = Math.floor(timeMinutes / 60);
            const minutes = Math.round(timeMinutes % 60);
            
            let formatted;
            if (hours === 0) {
                formatted = `${minutes}m`;
            } else if (minutes === 0) {
                formatted = `${hours}h`;
            } else {
                formatted = `${hours}h ${minutes}m`;
            }
            
            const el = document.getElementById(element);
            if (el) {
                el.textContent = formatted;
            }
        });
        
        wagePreview.style.display = 'block';
    }
    
    /**
     * Handle configuration updates from other sources
     */
    function handleConfigUpdate(e) {
        const config = e.detail;
        loadExistingConfig();
        debug.log('Time settings updated from external source:', config);
    }
}

/**
 * Export settings data for backup/export functionality
 */
export function exportTimeSettings() {
    return timeBudgets.getWageConfig();
}

/**
 * Import settings data from backup
 */
export function importTimeSettings(data) {
    if (data && typeof data.hourlyRate === 'number') {
        timeBudgets.updateConfig(data);
        initializeTimeSettings(); // Reload UI
        return true;
    }
    return false;
}