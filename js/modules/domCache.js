// js/modules/domCache.js

/**
 * DOM Cache Utility
 * Caches DOM element references to prevent repeated queries
 * Automatically clears cache when elements are removed from DOM
 */
class DOMCache {
    constructor(maxSize = 50) {
        this.cache = new Map();
        this.observer = null;
        this.maxSize = maxSize;
        this.accessOrder = []; // Track access order for LRU eviction
        this.initObserver();
    }
    
    /**
     * Initialize MutationObserver to detect DOM changes
     */
    initObserver() {
        if (typeof MutationObserver === 'undefined') return;
        
        this.observer = new MutationObserver((mutations) => {
            // Check if any cached elements were removed
            for (const mutation of mutations) {
                for (const node of mutation.removedNodes) {
                    this.clearRemovedElements(node);
                }
            }
        });
        
        // Start observing when DOM is ready
        if (document.body) {
            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
    /**
     * Clear cache entries for removed elements
     */
    clearRemovedElements(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        
        // Check if this node or its children are in cache
        this.cache.forEach((element, key) => {
            if (node === element || node.contains(element)) {
                this.cache.delete(key);
            }
        });
    }
    
    /**
     * Get element by ID with caching
     */
    getElementById(id) {
        const cacheKey = `#${id}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            // Verify element is still in DOM
            if (document.body.contains(cached)) {
                return cached;
            }
            this.cache.delete(cacheKey);
        }
        
        const element = document.getElementById(id);
        if (element) {
            this.setCacheEntry(cacheKey, element);
        }
        return element;
    }
    
    /**
     * Get elements by class name with caching
     */
    getElementsByClassName(className, parent = document) {
        const cacheKey = `.${className}@${parent.id || 'document'}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const elements = parent.getElementsByClassName(className);
        this.cache.set(cacheKey, elements);
        return elements;
    }
    
    /**
     * Query selector with caching
     */
    querySelector(selector, parent = document) {
        const cacheKey = `qs:${selector}@${parent.id || 'document'}`;
        
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (document.body.contains(cached)) {
                return cached;
            }
            this.cache.delete(cacheKey);
        }
        
        const element = parent.querySelector(selector);
        if (element) {
            this.cache.set(cacheKey, element);
        }
        return element;
    }
    
    /**
     * Query selector all with caching
     */
    querySelectorAll(selector, parent = document) {
        const cacheKey = `qsa:${selector}@${parent.id || 'document'}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const elements = parent.querySelectorAll(selector);
        this.cache.set(cacheKey, elements);
        return elements;
    }
    
    /**
     * Cache multiple elements at once
     */
    cacheElements(elementMap) {
        const cached = {};
        
        for (const [key, id] of Object.entries(elementMap)) {
            cached[key] = this.getElementById(id);
        }
        
        return cached;
    }
    
    /**
     * Clear specific cache entry
     */
    clear(key) {
        this.cache.delete(key);
    }
    
    /**
     * Clear all cache
     */
    clearAll() {
        this.cache.clear();
    }
    
    /**
     * Set cache entry with LRU eviction
     */
    setCacheEntry(key, value) {
        // Check if we need to evict
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }
        
        this.cache.set(key, value);
        this.updateAccessOrder(key);
    }
    
    /**
     * Update access order for LRU
     */
    updateAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        this.accessOrder.push(key);
    }
    
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        if (this.accessOrder.length === 0) return;
        
        const keyToEvict = this.accessOrder.shift();
        this.cache.delete(keyToEvict);
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            entries: Array.from(this.cache.keys()),
            oldestEntry: this.accessOrder[0] || null
        };
    }
    
    /**
     * Cleanup observer
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.clearAll();
    }
}

// Create singleton instance
export const domCache = new DOMCache();

/**
 * Helper function to cache form elements
 */
export function cacheFormElements(formId) {
    const form = domCache.getElementById(formId);
    if (!form) return null;
    
    const inputs = {};
    const elements = form.querySelectorAll('input, select, textarea');
    
    elements.forEach(element => {
        if (element.id) {
            inputs[element.id] = element;
        }
    });
    
    return inputs;
}

/**
 * Helper to get and cache modal elements
 */
export function getModalElements(modalId) {
    return {
        modal: domCache.getElementById(modalId),
        closeBtn: domCache.querySelector(`#${modalId} .modal__close`),
        form: domCache.querySelector(`#${modalId} form`),
        submitBtn: domCache.querySelector(`#${modalId} button[type="submit"]`),
        cancelBtn: domCache.querySelector(`#${modalId} .btn--secondary`)
    };
}