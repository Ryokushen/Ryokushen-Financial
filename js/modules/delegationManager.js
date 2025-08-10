// js/modules/delegationManager.js
import { debug } from './debug.js';
import { eventManager } from './eventManager.js';

/**
 * Delegation Manager for efficient event handling on dynamic content
 * Reduces memory usage and improves performance by using event delegation
 */
class DelegationManager {
  constructor() {
    this.handlers = new Map();
    this.delegatedContainers = new WeakMap();
  }

  /**
   * Set up event delegation for a container with multiple action types
   * @param {HTMLElement} container - The container element
   * @param {Object} config - Configuration object with action handlers
   * @param {Object} config.handlers - Object mapping action names to handler functions
   * @param {string} config.selector - CSS selector for delegated elements (default: '[data-action]')
   * @param {string} config.actionAttribute - Attribute name for actions (default: 'data-action')
   * @param {Array<string>} config.events - Event types to listen for (default: ['click'])
   * @returns {Function} Cleanup function to remove all delegated listeners
   */
  setupDelegation(container, config = {}) {
    if (!container) {
      debug.warn('DelegationManager: Cannot set up delegation on null container');
      return () => {};
    }

    const {
      handlers = {},
      selector = '[data-action]',
      actionAttribute = 'data-action',
      events = ['click']
    } = config;

    const cleanupFunctions = [];

    events.forEach(eventType => {
      const delegatedHandler = (e) => {
        const target = e.target.closest(selector);
        if (!target || !container.contains(target)) return;

        const action = target.getAttribute(actionAttribute);
        if (!action) return;

        const handler = handlers[action];
        if (typeof handler === 'function') {
          handler.call(target, e, target);
        } else {
          debug.warn(`DelegationManager: No handler found for action "${action}"`);
        }
      };

      eventManager.addEventListener(container, eventType, delegatedHandler);
      cleanupFunctions.push(() => eventManager.removeEventListener(container, eventType));
    });

    // Store configuration for this container
    this.delegatedContainers.set(container, { handlers, selector, actionAttribute, events });

    debug.log(`DelegationManager: Set up delegation on ${container.id || container.className || container.tagName}`);

    // Return cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
      debug.log(`DelegationManager: Cleaned up delegation on ${container.id || container.className || container.tagName}`);
    };
  }

  /**
   * Set up delegation for common CRUD operations
   * @param {HTMLElement} container - The container element
   * @param {Object} handlers - Object with edit, delete, add, toggle handlers
   * @returns {Function} Cleanup function
   */
  setupCrudDelegation(container, handlers = {}) {
    const defaultHandlers = {
      edit: handlers.edit || null,
      delete: handlers.delete || null,
      add: handlers.add || null,
      toggle: handlers.toggle || null,
      view: handlers.view || null,
      ...handlers
    };

    // Filter out null handlers
    const activeHandlers = Object.entries(defaultHandlers)
      .filter(([, handler]) => handler !== null)
      .reduce((acc, [key, handler]) => ({ ...acc, [key]: handler }), {});

    return this.setupDelegation(container, {
      handlers: activeHandlers,
      selector: '[data-action]',
      actionAttribute: 'data-action',
      events: ['click']
    });
  }

  /**
   * Set up delegation for form inputs with debouncing
   * @param {HTMLElement} container - The container element
   * @param {Object} handlers - Object mapping input names to handler functions
   * @param {number} debounceMs - Debounce delay in milliseconds
   * @returns {Function} Cleanup function
   */
  setupInputDelegation(container, handlers = {}, debounceMs = 300) {
    const debouncedHandlers = {};
    const timeouts = new Map();

    // Create debounced versions of handlers
    Object.entries(handlers).forEach(([name, handler]) => {
      debouncedHandlers[name] = (e, target) => {
        const timeoutId = timeouts.get(name);
        if (timeoutId) clearTimeout(timeoutId);

        timeouts.set(name, setTimeout(() => {
          handler(e, target);
          timeouts.delete(name);
        }, debounceMs));
      };
    });

    const cleanup = this.setupDelegation(container, {
      handlers: debouncedHandlers,
      selector: 'input[data-input-name], select[data-input-name], textarea[data-input-name]',
      actionAttribute: 'data-input-name',
      events: ['input', 'change']
    });

    return () => {
      cleanup();
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.clear();
    };
  }

  /**
   * Set up delegation for list items (transactions, rules, etc.)
   * @param {HTMLElement} container - The container element (table or list)
   * @param {Object} config - Configuration with handlers and options
   * @returns {Function} Cleanup function
   */
  setupListDelegation(container, config = {}) {
    const {
      onEdit,
      onDelete,
      onToggle,
      onSelect,
      onView,
      customActions = {},
      itemSelector = 'tr, li, .list-item',
      idAttribute = 'data-id'
    } = config;

    const handlers = {
      ...(onEdit && { edit: (e, target) => {
        const item = target.closest(itemSelector);
        const id = item?.getAttribute(idAttribute);
        if (id) onEdit(id, item, e);
      }}),
      ...(onDelete && { delete: (e, target) => {
        const item = target.closest(itemSelector);
        const id = item?.getAttribute(idAttribute);
        if (id) onDelete(id, item, e);
      }}),
      ...(onToggle && { toggle: (e, target) => {
        const item = target.closest(itemSelector);
        const id = item?.getAttribute(idAttribute);
        if (id) onToggle(id, item, e);
      }}),
      ...(onSelect && { select: (e, target) => {
        const item = target.closest(itemSelector);
        const id = item?.getAttribute(idAttribute);
        if (id) onSelect(id, item, e);
      }}),
      ...(onView && { view: (e, target) => {
        const item = target.closest(itemSelector);
        const id = item?.getAttribute(idAttribute);
        if (id) onView(id, item, e);
      }})
    };

    // Add custom actions
    Object.entries(customActions).forEach(([action, handler]) => {
      handlers[action] = (e, target) => {
        const item = target.closest(itemSelector);
        const id = item?.getAttribute(idAttribute);
        if (id) handler(id, item, e);
      };
    });

    return this.setupDelegation(container, {
      handlers,
      selector: '[data-action]',
      actionAttribute: 'data-action'
    });
  }

  /**
   * Convert existing element-specific listeners to delegation
   * @param {HTMLElement} container - The container to apply delegation to
   * @param {string} selector - Selector for elements that currently have listeners
   * @param {string} event - Event type
   * @param {Function} handler - Handler function that will receive (event, element)
   * @returns {Function} Cleanup function
   */
  convertToDelegate(container, selector, event, handler) {
    // Remove existing listeners from individual elements
    const elements = container.querySelectorAll(selector);
    elements.forEach(el => {
      // Note: This won't remove listeners not tracked by eventManager
      eventManager.removeEventListener(el, event);
    });

    // Set up delegated listener
    const delegatedHandler = (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) {
        handler(e, target);
      }
    };

    eventManager.addEventListener(container, event, delegatedHandler);

    return () => eventManager.removeEventListener(container, event);
  }

  /**
   * Get statistics about delegated containers
   */
  getStats() {
    return {
      handlersCount: this.handlers.size,
      containersTracked: eventManager.getListenerCount()
    };
  }
}

// Export singleton instance
export const delegationManager = new DelegationManager();

// Export helper functions for common patterns
export function setupTableDelegation(tableElement, handlers) {
  return delegationManager.setupListDelegation(tableElement, {
    ...handlers,
    itemSelector: 'tr',
    idAttribute: 'data-id'
  });
}

export function setupListDelegation(listElement, handlers) {
  return delegationManager.setupListDelegation(listElement, {
    ...handlers,
    itemSelector: 'li, .list-item',
    idAttribute: 'data-id'
  });
}

export function setupCardDelegation(containerElement, handlers) {
  return delegationManager.setupListDelegation(containerElement, {
    ...handlers,
    itemSelector: '.card, .card-item',
    idAttribute: 'data-id'
  });
}