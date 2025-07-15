// js/modules/privacy.js - Privacy Mode Management with Biometric Authentication
import { debug } from './debug.js';
import { announceToScreenReader, showError } from './ui.js';
import { 
    isBiometricSupported, 
    isBiometricRegistered, 
    authenticateWithBiometric,
    registerBiometric,
    clearBiometricRegistration 
} from './biometricAuth.js';

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
        this.biometricEnabled = this.loadBiometricPreference();
        this.biometricBypassTimeout = null;
    }
    
    // Initialize privacy manager after DOM is ready
    init() {
        if (this.isInitialized) {
            return;
        }
        
        this.isInitialized = true;
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Apply privacy state if it was previously enabled
        if (this.isPrivate) {
            this.enablePrivacyMode();
        }
        
        // Update biometric status in UI
        this.updateBiometricUI();
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
    
    // Load biometric preference from localStorage
    loadBiometricPreference() {
        try {
            return localStorage.getItem('biometricPrivacy') === 'true';
        } catch (e) {
            debug.warn('Could not load biometric preference:', e);
            return false;
        }
    }
    
    // Save biometric preference to localStorage
    saveBiometricPreference() {
        try {
            localStorage.setItem('biometricPrivacy', this.biometricEnabled.toString());
        } catch (e) {
            debug.warn('Could not save biometric preference:', e);
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
    
    // Toggle privacy mode with biometric authentication if enabled
    async togglePrivacy() {
        // If enabling privacy mode and biometric is enabled and registered
        if (!this.isPrivate && this.biometricEnabled && isBiometricRegistered()) {
            try {
                // Check if we're within the bypass timeout
                if (this.biometricBypassTimeout && Date.now() < this.biometricBypassTimeout) {
                    debug.log('Within biometric bypass timeout, skipping authentication');
                } else {
                    // Require biometric authentication
                    const authenticated = await authenticateWithBiometric();
                    if (!authenticated) {
                        showError('Biometric authentication failed. Privacy mode not enabled.');
                        return;
                    }
                    
                    // Set bypass timeout for 5 minutes
                    this.biometricBypassTimeout = Date.now() + (5 * 60 * 1000);
                }
            } catch (error) {
                showError(error.message || 'Biometric authentication failed');
                return;
            }
        }
        
        this.isPrivate = !this.isPrivate;
        this.savePrivacyState();
        
        if (this.isPrivate) {
            this.enablePrivacyMode();
            announceToScreenReader('Privacy mode enabled');
        } else {
            this.disablePrivacyMode();
            announceToScreenReader('Privacy mode disabled');
            // Clear bypass timeout when disabling privacy mode
            this.biometricBypassTimeout = null;
        }
        
        // Notify all listeners
        this.notifyListeners();
    }
    
    // Enable biometric authentication for privacy mode
    async enableBiometricAuth() {
        if (!isBiometricSupported()) {
            throw new Error('Biometric authentication is not supported on this device');
        }
        
        try {
            if (!isBiometricRegistered()) {
                await registerBiometric();
            }
            
            this.biometricEnabled = true;
            this.saveBiometricPreference();
            this.updateBiometricUI();
            
            return true;
        } catch (error) {
            debug.error('Failed to enable biometric auth:', error);
            throw error;
        }
    }
    
    // Disable biometric authentication
    disableBiometricAuth() {
        this.biometricEnabled = false;
        this.saveBiometricPreference();
        this.biometricBypassTimeout = null;
        clearBiometricRegistration();
        this.updateBiometricUI();
    }
    
    // Update biometric UI elements
    updateBiometricUI() {
        const biometricStatus = document.getElementById('biometric-status');
        if (biometricStatus) {
            if (!isBiometricSupported()) {
                biometricStatus.textContent = 'Not supported on this device';
                biometricStatus.className = 'biometric-status unsupported';
            } else if (this.biometricEnabled && isBiometricRegistered()) {
                biometricStatus.textContent = 'Enabled';
                biometricStatus.className = 'biometric-status enabled';
            } else {
                biometricStatus.textContent = 'Disabled';
                biometricStatus.className = 'biometric-status disabled';
            }
        }
    }
    
    // Enable privacy mode
    enablePrivacyMode() {
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
        const elements = document.querySelectorAll(selector);
        
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
        
        tableCells.forEach(td => {
            // Check if cell contains currency (starts with $ or -$)
            const text = td.textContent.trim();
            if (text.match(/^-?\$[\d,]+\.?\d*/) && !td.classList.contains('privacy-blur')) {
                processElement(td);
            }
        });
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
            // Use multiple techniques to ensure DOM is fully updated
            requestAnimationFrame(() => {
                setTimeout(() => {
                    this.blurSensitiveData();
                }, PRIVACY_TIMING.DOM_UPDATE_DELAY);
            });
        }
    }
    
    // Check if privacy mode is enabled
    isPrivacyEnabled() {
        return this.isPrivate;
    }
    
    // Check if biometric auth is enabled
    isBiometricEnabled() {
        return this.biometricEnabled && isBiometricRegistered();
    }
    
    // Force refresh privacy mode (for debugging)
    forceRefresh() {
        if (this.isPrivate) {
            // First unblur everything
            this.unblurSensitiveData();
            // Then reapply blur
            setTimeout(() => {
                this.blurSensitiveData();
            }, PRIVACY_TIMING.DOM_UPDATE_DELAY);
        }
    }
    
}

// Create singleton instance
export const privacyManager = new PrivacyManager();

// Export convenience functions
export function togglePrivacyMode() {
    return privacyManager.togglePrivacy();
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

// Biometric authentication functions
export async function enableBiometricPrivacy() {
    return privacyManager.enableBiometricAuth();
}

export function disableBiometricPrivacy() {
    privacyManager.disableBiometricAuth();
}

export function isBiometricPrivacyEnabled() {
    return privacyManager.isBiometricEnabled();
}

// Make privacyManager available globally for debugging
if (typeof window !== 'undefined') {
    window.privacyManager = privacyManager;
}

// Export timing configuration for use in other modules
export { PRIVACY_TIMING };