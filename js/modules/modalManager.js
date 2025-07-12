// js/modules/modalManager.js

import { domCache } from './domCache.js';

/**
 * Centralized Modal Manager
 * Handles all modal operations with consistent behavior
 */
class ModalManager {
    constructor() {
        this.activeModals = new Set();
        this.modalConfig = new Map();
        this.initialized = false;
        this.eventListeners = new Map();
        this.boundHandlers = {
            keydown: null,
            click: null
        };
    }
    
    /**
     * Initialize modal manager
     */
    init() {
        if (this.initialized) return;
        
        // Create bound event handlers that can be removed later
        this.boundHandlers.keydown = (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                // Get the most recently opened modal
                const modalsArray = Array.from(this.activeModals);
                if (modalsArray.length > 0) {
                    const lastModal = modalsArray[modalsArray.length - 1];
                    const config = this.modalConfig.get(lastModal);
                    if (config && config.closeOnEscape !== false) {
                        this.close(lastModal);
                    }
                }
            }
        };
        
        this.boundHandlers.click = (e) => {
            if (e.target.classList.contains('modal') && this.activeModals.size > 0) {
                const modalId = e.target.id;
                if (this.activeModals.has(modalId)) {
                    const config = this.modalConfig.get(modalId);
                    if (config && config.closeOnClickOutside !== false) {
                        this.close(modalId);
                    }
                }
            }
        };
        
        // Setup global event listeners with bound handlers
        document.addEventListener('keydown', this.boundHandlers.keydown);
        document.addEventListener('click', this.boundHandlers.click);
        
        this.initialized = true;
    }
    
    /**
     * Register a modal with its configuration
     */
    register(modalId, config = {}) {
        const defaultConfig = {
            onOpen: null,
            onClose: null,
            closeOnEscape: true,
            closeOnClickOutside: true,
            formId: null,
            resetFormOnOpen: true,
            resetFormOnClose: true
        };
        
        this.modalConfig.set(modalId, { ...defaultConfig, ...config });
        
        // Setup event listeners for this modal
        this.setupModalListeners(modalId);
    }
    
    /**
     * Setup event listeners for a specific modal
     */
    setupModalListeners(modalId) {
        const config = this.modalConfig.get(modalId);
        if (!config) return;
        
        const modal = domCache.getElementById(modalId);
        if (!modal) return;
        
        // Clean up existing listeners for this modal
        this.cleanupModalListeners(modalId);
        
        // Store listeners for this modal
        const modalListeners = [];
        
        // Find and setup close buttons
        const closeButtons = modal.querySelectorAll('[data-modal-close], .modal__close, .btn--cancel');
        closeButtons.forEach(btn => {
            const closeHandler = (e) => {
                e.preventDefault();
                this.close(modalId);
            };
            btn.addEventListener('click', closeHandler);
            modalListeners.push({ element: btn, event: 'click', handler: closeHandler });
        });
        
        // Setup form submission if configured
        if (config.formId) {
            const form = domCache.getElementById(config.formId);
            if (form && config.onSubmit) {
                const submitHandler = async (e) => {
                    e.preventDefault();
                    await config.onSubmit(e);
                };
                form.addEventListener('submit', submitHandler);
                modalListeners.push({ element: form, event: 'submit', handler: submitHandler });
            }
        }
        
        // Store all listeners for cleanup later
        this.eventListeners.set(modalId, modalListeners);
    }
    
    /**
     * Clean up event listeners for a specific modal
     */
    cleanupModalListeners(modalId) {
        const listeners = this.eventListeners.get(modalId);
        if (!listeners) return;
        
        listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        
        this.eventListeners.delete(modalId);
    }
    
    /**
     * Open a modal
     */
    open(modalId, data = {}) {
        this.init(); // Ensure initialized
        
        const modal = domCache.getElementById(modalId);
        if (!modal) {
            console.error(`Modal ${modalId} not found`);
            return;
        }
        
        const config = this.modalConfig.get(modalId) || {};
        
        // Reset form if configured
        if (config.formId && config.resetFormOnOpen) {
            const form = domCache.getElementById(config.formId);
            if (form) form.reset();
        }
        
        // Call onOpen callback
        if (config.onOpen) {
            config.onOpen(modal, data);
        }
        
        // Show modal
        modal.style.display = 'block';
        modal.classList.add('modal--active');
        document.body.classList.add('modal-open');
        
        this.activeModals.add(modalId);
        
        // Focus first input
        setTimeout(() => {
            const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) firstInput.focus();
        }, 100);
        
        // Announce to screen readers
        this.announceToScreenReader(`${modal.getAttribute('aria-label') || 'Modal'} opened`);
    }
    
    /**
     * Close a modal
     */
    close(modalId) {
        const modal = domCache.getElementById(modalId);
        if (!modal) return;
        
        const config = this.modalConfig.get(modalId) || {};
        
        // Call onClose callback
        if (config.onClose) {
            config.onClose(modal);
        }
        
        // Reset form if configured
        if (config.formId && config.resetFormOnClose) {
            const form = domCache.getElementById(config.formId);
            if (form) form.reset();
        }
        
        // Hide modal
        modal.style.display = 'none';
        modal.classList.remove('modal--active');
        
        this.activeModals.delete(modalId);
        
        // Remove body class if no active modals
        if (this.activeModals.size === 0) {
            document.body.classList.remove('modal-open');
        }
        
        // Announce to screen readers
        this.announceToScreenReader(`${modal.getAttribute('aria-label') || 'Modal'} closed`);
    }
    
    /**
     * Toggle a modal
     */
    toggle(modalId, data = {}) {
        if (this.activeModals.has(modalId)) {
            this.close(modalId);
        } else {
            this.open(modalId, data);
        }
    }
    
    /**
     * Close all open modals
     */
    closeAll() {
        const modals = Array.from(this.activeModals);
        modals.forEach(modalId => this.close(modalId));
    }
    
    /**
     * Check if a modal is open
     */
    isOpen(modalId) {
        return this.activeModals.has(modalId);
    }
    
    /**
     * Announce to screen readers
     */
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.classList.add('sr-only');
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => announcement.remove(), 1000);
    }
    
    /**
     * Destroy the modal manager and clean up all event listeners
     */
    destroy() {
        // Remove global event listeners
        if (this.boundHandlers.keydown) {
            document.removeEventListener('keydown', this.boundHandlers.keydown);
        }
        if (this.boundHandlers.click) {
            document.removeEventListener('click', this.boundHandlers.click);
        }
        
        // Clean up all modal-specific event listeners
        this.eventListeners.forEach((listeners, modalId) => {
            this.cleanupModalListeners(modalId);
        });
        
        // Clear all data
        this.activeModals.clear();
        this.modalConfig.clear();
        this.eventListeners.clear();
        this.boundHandlers = { keydown: null, click: null };
        this.initialized = false;
    }
    
    /**
     * Create modal HTML structure
     */
    createModal(options) {
        const {
            id,
            title,
            content,
            footer,
            size = 'medium',
            closeButton = true
        } = options;
        
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = `modal modal--${size}`;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', title);
        
        modal.innerHTML = `
            <div class="modal__content">
                <div class="modal__header">
                    <h2 class="modal__title">${title}</h2>
                    ${closeButton ? '<button class="modal__close" aria-label="Close modal">&times;</button>' : ''}
                </div>
                <div class="modal__body">
                    ${content}
                </div>
                ${footer ? `<div class="modal__footer">${footer}</div>` : ''}
            </div>
        `;
        
        document.body.appendChild(modal);
        this.register(id);
        
        return modal;
    }
}

// Create singleton instance
export const modalManager = new ModalManager();

/**
 * Helper function to setup common modals
 */
export function setupCommonModals() {
    // Investment Account Modal
    modalManager.register('investment-account-modal', {
        formId: 'investment-account-form',
        onOpen: (modal, data) => {
            const title = modal.querySelector('.modal__title, #investment-account-modal-title');
            if (title) {
                title.textContent = data.accountId ? 'Edit Investment Account' : 'Add New Investment Account';
            }
        }
    });
    
    // Savings Goal Modal
    modalManager.register('goal-modal', {
        formId: 'goal-form',
        resetFormOnOpen: false, // Don't auto-reset, let the openGoalModal function handle it
        onOpen: (modal, data) => {
            const title = modal.querySelector('.modal__title, #goal-modal-title');
            if (title) {
                title.textContent = data && data.isEdit ? 'Edit Savings Goal' : 'Add New Savings Goal';
            }
        }
    });
    
    // Debt Account Modal
    modalManager.register('debt-modal', {
        formId: 'debt-form',
        onOpen: (modal, data) => {
            const title = modal.querySelector('.modal__title, #debt-modal-title');
            if (title) {
                title.textContent = data.debtId ? 'Edit Debt Account' : 'Add New Debt Account';
            }
        }
    });
    
    // Add more modal configurations as needed
}

/**
 * Simplified modal functions for backward compatibility
 */
export function openModal(modalId, data) {
    modalManager.open(modalId, data);
}

export function closeModal(modalId) {
    modalManager.close(modalId);
}

export function toggleModal(modalId, data) {
    modalManager.toggle(modalId, data);
}