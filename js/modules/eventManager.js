// js/modules/eventManager.js
import { debug } from './debug.js';

/**
 * Event Manager for proper event listener cleanup
 * Prevents memory leaks by tracking and removing event listeners
 */
class EventManager {
  constructor() {
    this.listeners = new Map();
    this.delegatedListeners = new Map();
  }

  /**
   * Add an event listener with automatic tracking
   */
  addEventListener(element, event, handler, options = {}) {
    if (!element) {
      debug.warn('EventManager: Cannot add listener to null element');
      return;
    }

    const key = this.getKey(element, event);

    // Remove existing listener if present
    this.removeEventListener(element, event);

    // Add new listener
    element.addEventListener(event, handler, options);

    // Track it
    this.listeners.set(key, { element, event, handler, options });

    debug.trace(`EventManager: Added ${event} listener to ${element.id || element.tagName}`);
  }

  /**
   * Remove a tracked event listener
   */
  removeEventListener(element, event) {
    if (!element) {
      return;
    }

    const key = this.getKey(element, event);
    const listener = this.listeners.get(key);

    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      this.listeners.delete(key);
      debug.trace(`EventManager: Removed ${event} listener from ${element.id || element.tagName}`);
    }
  }

  /**
   * Add delegated event listener (for dynamic content)
   */
  addDelegatedListener(parentElement, selector, event, handler) {
    if (!parentElement) {
      debug.warn('EventManager: Cannot add delegated listener to null parent');
      return;
    }

    const delegatedHandler = e => {
      const target = e.target.closest(selector);
      if (target && parentElement.contains(target)) {
        handler.call(target, e);
      }
    };

    const key = `${this.getKey(parentElement, event)}_${selector}`;

    // Remove existing if present
    this.removeDelegatedListener(parentElement, selector, event);

    // Add new listener
    parentElement.addEventListener(event, delegatedHandler);

    // Track it
    this.delegatedListeners.set(key, {
      parentElement,
      event,
      handler: delegatedHandler,
      selector,
    });

    debug.trace(`EventManager: Added delegated ${event} listener for ${selector}`);
  }

  /**
   * Remove delegated event listener
   */
  removeDelegatedListener(parentElement, selector, event) {
    if (!parentElement) {
      return;
    }

    const key = `${this.getKey(parentElement, event)}_${selector}`;
    const listener = this.delegatedListeners.get(key);

    if (listener) {
      listener.parentElement.removeEventListener(listener.event, listener.handler);
      this.delegatedListeners.delete(key);
      debug.trace(`EventManager: Removed delegated ${event} listener for ${selector}`);
    }
  }

  /**
   * Remove all listeners for a specific element
   */
  removeAllListenersForElement(element) {
    if (!element) {
      return;
    }

    // Remove direct listeners
    for (const [key, listener] of this.listeners) {
      if (listener.element === element) {
        element.removeEventListener(listener.event, listener.handler, listener.options);
        this.listeners.delete(key);
      }
    }

    // Remove delegated listeners
    for (const [key, listener] of this.delegatedListeners) {
      if (listener.parentElement === element) {
        element.removeEventListener(listener.event, listener.handler);
        this.delegatedListeners.delete(key);
      }
    }

    debug.trace(`EventManager: Removed all listeners for ${element.id || element.tagName}`);
  }

  /**
   * Remove all tracked listeners (cleanup)
   */
  removeAllListeners() {
    // Remove all direct listeners
    for (const listener of this.listeners.values()) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
    }
    this.listeners.clear();

    // Remove all delegated listeners
    for (const listener of this.delegatedListeners.values()) {
      listener.parentElement.removeEventListener(listener.event, listener.handler);
    }
    this.delegatedListeners.clear();

    debug.trace('EventManager: Removed all tracked listeners');
  }

  /**
   * Generate unique key for element/event combination
   */
  getKey(element, event) {
    const id =
      element.id ||
      `${element.tagName}_${Array.from(element.parentNode?.children || []).indexOf(element)}`;
    return `${id}_${event}`;
  }

  /**
   * Get count of tracked listeners
   */
  getListenerCount() {
    return this.listeners.size + this.delegatedListeners.size;
  }
}

// Export singleton instance
export const eventManager = new EventManager();

// Also export cleanup helper for modules
export function setupModuleEventListeners(setupFunction) {
  // Store current listener count
  const startCount = eventManager.getListenerCount();

  // Run setup
  const cleanup = setupFunction(eventManager);

  // Return cleanup function
  return () => {
    // Call module's cleanup if provided
    if (typeof cleanup === 'function') {
      cleanup();
    }

    // Log listener changes
    const endCount = eventManager.getListenerCount();
    if (endCount > startCount) {
      debug.warn(`Potential memory leak: ${endCount - startCount} listeners not cleaned up`);
    }
  };
}
