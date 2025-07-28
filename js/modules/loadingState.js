// js/modules/loadingState.js

import { debug } from './debug.js';

/**
 * Loading State Manager
 * Handles loading states and operation locks to prevent concurrent operations
 */
class LoadingStateManager {
  constructor() {
    this.activeOperations = new Set();
    this.loadingElements = new Map();
  }

  /**
   * Check if an operation is currently running
   */
  isOperationActive(operationId) {
    return this.activeOperations.has(operationId);
  }

  /**
   * Start a loading state for a button
   */
  startButtonLoading(buttonId, loadingText = 'Loading...') {
    const button = document.getElementById(buttonId);
    if (!button) {
      return;
    }

    // Store original state
    this.loadingElements.set(buttonId, {
      originalText: button.textContent,
      originalDisabled: button.disabled,
    });

    // Set loading state
    button.textContent = loadingText;
    button.disabled = true;
    button.classList.add('btn--loading');
  }

  /**
   * Stop loading state for a button
   */
  stopButtonLoading(buttonId) {
    const button = document.getElementById(buttonId);
    if (!button) {
      return;
    }

    const originalState = this.loadingElements.get(buttonId);
    if (originalState) {
      button.textContent = originalState.originalText;
      button.disabled = originalState.originalDisabled;
      this.loadingElements.delete(buttonId);
    }

    button.classList.remove('btn--loading');
  }

  /**
   * Show a full-screen operation lock
   */
  showOperationLock(message = 'Processing...') {
    // Remove any existing lock
    this.hideOperationLock();

    const lockDiv = document.createElement('div');
    lockDiv.id = 'operation-lock';
    lockDiv.className = 'operation-lock';
    lockDiv.innerHTML = `
            <div class="operation-lock-message">
                <div class="operation-lock-spinner"></div>
                <p>${message}</p>
            </div>
        `;

    document.body.appendChild(lockDiv);
  }

  /**
   * Hide the operation lock
   */
  hideOperationLock() {
    const lockDiv = document.getElementById('operation-lock');
    if (lockDiv) {
      lockDiv.remove();
    }
  }

  /**
   * Execute an operation with loading state
   */
  async executeWithLoading(operationId, operation, options = {}) {
    const { buttonId, loadingText, lockScreen = false, lockMessage } = options;

    // Check if operation is already running
    if (this.isOperationActive(operationId)) {
      debug.warn(`Operation ${operationId} is already running`);
      return null;
    }

    // Mark operation as active
    this.activeOperations.add(operationId);

    // Start loading states
    if (buttonId) {
      this.startButtonLoading(buttonId, loadingText);
    }

    if (lockScreen) {
      this.showOperationLock(lockMessage);
    }

    try {
      // Execute the operation
      const result = await operation();
      return result;
    } finally {
      // Clean up loading states
      this.activeOperations.delete(operationId);

      if (buttonId) {
        this.stopButtonLoading(buttonId);
      }

      if (lockScreen) {
        this.hideOperationLock();
      }
    }
  }

  /**
   * Disable a form during submission
   */
  disableForm(formId) {
    const form = document.getElementById(formId);
    if (!form) {
      return;
    }

    const elements = form.querySelectorAll('input, select, textarea, button');
    const states = [];

    elements.forEach(element => {
      states.push({
        element,
        disabled: element.disabled,
      });
      element.disabled = true;
    });

    this.loadingElements.set(formId, states);
  }

  /**
   * Re-enable a form after submission
   */
  enableForm(formId) {
    const form = document.getElementById(formId);
    if (!form) {
      return;
    }

    const states = this.loadingElements.get(formId);
    if (states) {
      states.forEach(({ element, disabled }) => {
        element.disabled = disabled;
      });
      this.loadingElements.delete(formId);
    }
  }
}

// Create singleton instance
export const loadingState = new LoadingStateManager();

/**
 * Decorator function to add loading state to async functions
 */
export function withLoading(options = {}) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      return await loadingState.executeWithLoading(
        propertyKey,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Helper function to show temporary success state on a button
 */
export function showButtonSuccess(buttonId, successText = '✓ Success', duration = 2000) {
  const button = document.getElementById(buttonId);
  if (!button) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = successText;
  button.classList.add('btn--success');

  setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('btn--success');
  }, duration);
}

/**
 * Helper function to show temporary error state on a button
 */
export function showButtonError(buttonId, errorText = '✗ Error', duration = 2000) {
  const button = document.getElementById(buttonId);
  if (!button) {
    return;
  }

  const originalText = button.textContent;
  button.textContent = errorText;
  button.classList.add('btn--error');

  setTimeout(() => {
    button.textContent = originalText;
    button.classList.remove('btn--error');
  }, duration);
}
