// js/modules/privacy.js - Privacy Mode Management
import { debug } from './debug.js';
import { announceToScreenReader } from './ui.js';

class PrivacyManager {
    constructor() {
        this.isPrivate = this.loadPrivacyState();
        this.listeners = new Set();
        this.blurredElements = new WeakMap();
        this.temporarilyRevealed = new WeakSet();
        
        // Keyboard shortcut for panic mode
        this.setupKeyboardShortcuts();
        
        // Initialize privacy state on load
        if (this.isPrivate) {
            this.enablePrivacyMode();
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
        const sensitiveSelectors = [
            '.metric-value',
            '.balance',
            '.amount',
            '.transaction-amount',
            '.account-balance',
            '.holding-value',
            '.goal-amount',
            '.debt-balance',
            '.bill-amount',
            '.total-value',
            '.net-worth',
            '[data-sensitive="true"]'
        ];
        
        const elements = document.querySelectorAll(sensitiveSelectors.join(', '));
        elements.forEach(el => {
            if (!el.classList.contains('privacy-blur')) {
                el.classList.add('privacy-blur');
                
                // Store original content for click-to-reveal
                this.blurredElements.set(el, {
                    originalContent: el.textContent,
                    isRevealed: false
                });
                
                // Add click handler for temporary reveal
                el.addEventListener('click', this.handleRevealClick.bind(this));
                el.style.cursor = 'pointer';
                el.setAttribute('title', 'Click to reveal temporarily');
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
            
            // Remove click handler
            el.removeEventListener('click', this.handleRevealClick.bind(this));
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
            
            // Re-blur after 3 seconds
            setTimeout(() => {
                if (this.isPrivate && this.temporarilyRevealed.has(element)) {
                    element.classList.add('privacy-blur');
                    this.temporarilyRevealed.delete(element);
                }
            }, 3000);
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
            // Use requestAnimationFrame to ensure DOM is updated
            requestAnimationFrame(() => {
                this.blurSensitiveData();
            });
        }
    }
    
    // Check if privacy mode is enabled
    isPrivacyEnabled() {
        return this.isPrivate;
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