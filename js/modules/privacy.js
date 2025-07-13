// js/modules/privacy.js - Privacy Mode Management
import { debug } from './debug.js';
import { announceToScreenReader } from './ui.js';

// Centralized timing configuration for privacy operations
const PRIVACY_TIMING = {
    DOM_UPDATE_DELAY: 100,        // Delay for DOM updates to complete
    CHART_REFRESH_DELAY: 250,     // Delay for chart refreshes (kept higher for stability)
    REVEAL_DURATION: 3000,        // How long temporary reveals last
    MODAL_POPULATE_DELAY: 0       // Delay for modal population
};

class PrivacyManager {
    constructor() {
        this.isPrivate = this.loadPrivacyState();
        this.listeners = new Set();
        this.blurredElements = new WeakMap();
        this.temporarilyRevealed = new WeakSet();
        this.isInitialized = false;
    }
    
    // Initialize privacy manager after DOM is ready
    init() {
        if (this.isInitialized) {
            console.log('[Privacy] Already initialized');
            return;
        }
        
        console.log('[Privacy] Initializing privacy manager');
        this.isInitialized = true;
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Apply privacy state if it was previously enabled
        if (this.isPrivate) {
            console.log('[Privacy] Privacy was previously enabled, applying now');
            this.enablePrivacyMode();
        } else {
            console.log('[Privacy] Privacy mode is off');
        }
    }
    
    // Load privacy state from localStorage
    loadPrivacyState() {
        try {
            return localStorage.getItem('privacyMode') === 'true';
        } catch (e) {
            debug.warn('Could not load privacy state from localStorage:', e);
            return false;
        }
    }
    
    // Save privacy state to localStorage
    savePrivacyState() {
        try {
            localStorage.setItem('privacyMode', this.isPrivate.toString());
        } catch (e) {
            debug.warn('Could not save privacy state to localStorage:', e);
        }
    }
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + P for panic mode
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.togglePrivacy();
            }
        });
    }
    
    // Toggle privacy mode
    togglePrivacy() {
        console.log('[Privacy] Toggling privacy mode from', this.isPrivate, 'to', !this.isPrivate);
        this.isPrivate = !this.isPrivate;
        this.savePrivacyState();
        
        if (this.isPrivate) {
            this.enablePrivacyMode();
            announceToScreenReader('Privacy mode enabled');
        } else {
            this.disablePrivacyMode();
            announceToScreenReader('Privacy mode disabled');
        }
        
        // Notify all listeners
        this.notifyListeners();
    }
    
    // Enable privacy mode
    enablePrivacyMode() {
        console.log('[Privacy] Enabling privacy mode');
        document.body.classList.add('privacy-mode');
        this.blurSensitiveData();
        this.updatePrivacyIndicators();
    }
    
    // Disable privacy mode
    disablePrivacyMode() {
        document.body.classList.remove('privacy-mode');
        this.unblurSensitiveData();
        this.updatePrivacyIndicators();
    }
    
    // Blur all sensitive data
    blurSensitiveData() {
        // Optimized selectors - grouped by specificity and avoiding redundancy
        const sensitiveSelectors = [
            // Primary value selectors
            '.metric-value',
            '.account-info-value',
            '.holding-value',
            '.net-worth',
            
            // Amount-related selectors (consolidated)
            '.transaction-amount',
            '.bill-amount',
            '.recurring-bill-amount',
            '.goal-amount',
            '.total-value',
            
            // Balance selectors (consolidated)
            '.balance:not(.account-balance):not(.debt-balance)',
            '.account-balance',
            '.debt-balance',
            '.debt-value',
            
            // Other financial values
            '.payment',
            '.rate',
            
            // Data attribute selector
            '[data-sensitive="true"]'
        ];
        
        const selector = sensitiveSelectors.join(', ');
        console.log('[Privacy] Looking for elements with selector:', selector);
        const elements = document.querySelectorAll(selector);
        console.log('[Privacy] Found', elements.length, 'sensitive elements to blur');
        
        // Debug: Check specific account info values
        const accountInfoValues = document.querySelectorAll('.account-info-value');
        console.log('[Privacy] Found', accountInfoValues.length, 'account-info-value elements');
        accountInfoValues.forEach((el, index) => {
            console.log(`[Privacy] Account value ${index}:`, el.textContent, 'Classes:', el.className, 'Parent:', el.parentElement.className);
        });
        
        // Process elements in a single pass
        const processElement = (el) => {
            if (!el.classList.contains('privacy-blur') && !this.blurredElements.has(el)) {
                el.classList.add('privacy-blur');
                
                // Store original content and bind handler only once
                this.blurredElements.set(el, {
                    originalContent: el.textContent,
                    isRevealed: false,
                    handler: this.handleRevealClick.bind(this)
                });
                
                // Add click handler for temporary reveal
                el.addEventListener('click', this.blurredElements.get(el).handler);
                el.style.cursor = 'pointer';
                el.setAttribute('title', 'Click to reveal temporarily');
            }
        };
        
        // Process selected elements
        elements.forEach(processElement);
        
        // Also blur table cells containing currency values
        const tableCells = document.querySelectorAll('td');
        console.log('[Privacy] Checking', tableCells.length, 'table cells for currency values');
        let blurredCells = 0;
        
        tableCells.forEach(td => {
            // Check if cell contains currency (starts with $ or -$)
            const text = td.textContent.trim();
            if (text.match(/^-?\$[\d,]+\.?\d*/) && !td.classList.contains('privacy-blur')) {
                processElement(td);
                blurredCells++;
            }
        });
        
        console.log('[Privacy] Blurred', blurredCells, 'table cells with currency values');
    }
    
    // Unblur all sensitive data
    unblurSensitiveData() {
        const blurredElements = document.querySelectorAll('.privacy-blur');
        blurredElements.forEach(el => {
            el.classList.remove('privacy-blur');
            el.style.cursor = '';
            el.removeAttribute('title');
            
            // Remove click handler using stored reference
            const elementData = this.blurredElements.get(el);
            if (elementData && elementData.handler) {
                el.removeEventListener('click', elementData.handler);
                this.blurredElements.delete(el);
            }
        });
        
        // Clear temporary reveals
        this.temporarilyRevealed = new WeakSet();
    }
    
    // Handle click to temporarily reveal
    handleRevealClick(event) {
        const element = event.currentTarget;
        
        if (this.temporarilyRevealed.has(element)) {
            // Re-blur if already revealed
            element.classList.add('privacy-blur');
            this.temporarilyRevealed.delete(element);
        } else {
            // Temporarily reveal
            element.classList.remove('privacy-blur');
            this.temporarilyRevealed.add(element);
            
            // Re-blur after configured duration
            setTimeout(() => {
                if (this.isPrivate && this.temporarilyRevealed.has(element)) {
                    element.classList.add('privacy-blur');
                    this.temporarilyRevealed.delete(element);
                }
            }, PRIVACY_TIMING.REVEAL_DURATION);
        }
    }
    
    // Update privacy indicators in UI
    updatePrivacyIndicators() {
        // Update privacy toggle button if it exists
        const toggleBtn = document.getElementById('privacy-toggle-btn');
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', this.isPrivate);
            toggleBtn.setAttribute('aria-pressed', this.isPrivate);
            toggleBtn.innerHTML = this.isPrivate ? 
                '<i class="privacy-icon">🔒</i> Privacy On' : 
                '<i class="privacy-icon">🔓</i> Privacy Off';
        }
        
        // Update panic button visibility
        const panicBtn = document.getElementById('panic-button');
        if (panicBtn) {
            panicBtn.style.display = this.isPrivate ? 'none' : 'block';
        }
    }
    
    // Register a listener for privacy state changes
    addListener(callback) {
        this.listeners.add(callback);
    }
    
    // Remove a listener
    removeListener(callback) {
        this.listeners.delete(callback);
    }
    
    // Notify all listeners of state change
    notifyListeners() {
        console.log('[Privacy] Notifying', this.listeners.size, 'listeners of privacy state change');
        this.listeners.forEach(callback => {
            try {
                callback(this.isPrivate);
            } catch (e) {
                debug.error('Error in privacy listener:', e);
            }
        });
    }
    
    // Quick enable for panic button
    enablePanicMode() {
        if (!this.isPrivate) {
            this.togglePrivacy();
        }
    }
    
    // Re-apply privacy mode after dynamic content update
    reapplyPrivacyMode() {
        if (this.isPrivate) {
            console.log('[Privacy] Reapplying privacy mode');
            // Use multiple techniques to ensure DOM is fully updated
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.blurSensitiveData();
                    console.log('[Privacy] Reapply complete');
                }, PRIVACY_TIMING.DOM_UPDATE_DELAY);
            });
        }
    }
    
    // Check if privacy mode is enabled
    isPrivacyEnabled() {
        return this.isPrivate;
    }
    
    // Force refresh privacy mode (for debugging)
    forceRefresh() {
        console.log('[Privacy] Force refreshing privacy mode');
        if (this.isPrivate) {
            // First unblur everything
            this.unblurSensitiveData();
            // Then reapply blur
            setTimeout(() => {
                this.blurSensitiveData();
                console.log('[Privacy] Force refresh complete');
            }, PRIVACY_TIMING.DOM_UPDATE_DELAY);
        } else {
            console.log('[Privacy] Privacy mode is off, nothing to refresh');
        }
    }
    
    // Debug method to check why specific elements aren't blurred
    debugElement(selector) {
        const elements = document.querySelectorAll(selector);
        console.log(`[Privacy Debug] Found ${elements.length} elements matching "${selector}"`);
        elements.forEach((el, index) => {
            console.log(`[Privacy Debug] Element ${index}:`);
            console.log('  Text:', el.textContent);
            console.log('  Classes:', el.className);
            console.log('  Has privacy-blur:', el.classList.contains('privacy-blur'));
            console.log('  Computed display:', window.getComputedStyle(el).display);
            console.log('  Computed visibility:', window.getComputedStyle(el).visibility);
            console.log('  Parent element:', el.parentElement.tagName, el.parentElement.className);
        });
    }
}

// Create singleton instance
export const privacyManager = new PrivacyManager();

// Export convenience functions
export function togglePrivacyMode() {
    privacyManager.togglePrivacy();
}

export function isPrivacyMode() {
    return privacyManager.isPrivacyEnabled();
}

export function reapplyPrivacy() {
    privacyManager.reapplyPrivacyMode();
}

export function addPrivacyListener(callback) {
    privacyManager.addListener(callback);
}

export function removePrivacyListener(callback) {
    privacyManager.removeListener(callback);
}

export function enablePanicMode() {
    privacyManager.enablePanicMode();
}

export function forceRefreshPrivacy() {
    privacyManager.forceRefresh();
}

// Make privacyManager available globally for debugging
if (typeof window !== 'undefined') {
    window.privacyManager = privacyManager;
}

// Export timing configuration for use in other modules
export { PRIVACY_TIMING };