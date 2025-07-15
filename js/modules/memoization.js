// js/modules/memoization.js

/**
 * Memoization utility for expensive calculations
 * Includes TTL (time-to-live) support and dependency tracking
 */
class MemoizationCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.dependencies = new Map();
        this.maxSize = maxSize;
        this.accessOrder = []; // Track access order for LRU eviction
    }
    
    /**
     * Generate cache key from arguments
     */
    generateKey(functionName, args) {
        return `${functionName}:${JSON.stringify(args)}`;
    }
    
    /**
     * Memoize a function with optional TTL
     */
    memoize(fn, options = {}) {
        const {
            name = fn.name || 'anonymous',
            ttl = null, // Time to live in milliseconds
            dependencies = [] // Array of dependency keys that invalidate this cache
        } = options;
        
        return (...args) => {
            const key = this.generateKey(name, args);
            
            // Check if cached value exists and is still valid
            if (this.cache.has(key)) {
                const cached = this.cache.get(key);
                
                // Check TTL
                if (!ttl || (Date.now() - cached.timestamp < ttl)) {
                    // Update access order for LRU
                    this.updateAccessOrder(key);
                    return cached.value;
                }
            }
            
            // Compute new value
            const value = fn(...args);
            
            // Check if we need to evict entries
            if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
                this.evictLRU();
            }
            
            // Store in cache
            this.cache.set(key, {
                value,
                timestamp: Date.now(),
                dependencies
            });
            
            // Update access order
            this.updateAccessOrder(key);
            
            // Track dependencies
            dependencies.forEach(dep => {
                if (!this.dependencies.has(dep)) {
                    this.dependencies.set(dep, new Set());
                }
                this.dependencies.get(dep).add(key);
            });
            
            return value;
        };
    }
    
    /**
     * Invalidate cache entries by dependency
     */
    invalidate(dependency) {
        if (this.dependencies.has(dependency)) {
            const keysToInvalidate = this.dependencies.get(dependency);
            keysToInvalidate.forEach(key => {
                this.cache.delete(key);
            });
            this.dependencies.delete(dependency);
        }
    }
    
    /**
     * Clear specific function's cache
     */
    clearFunction(functionName) {
        const keysToDelete = [];
        this.cache.forEach((value, key) => {
            if (key.startsWith(functionName + ':')) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this.cache.delete(key));
    }
    
    /**
     * Clear all cache
     */
    clearAll() {
        this.cache.clear();
        this.dependencies.clear();
    }
    
    /**
     * Update access order for LRU eviction
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
        const cached = this.cache.get(keyToEvict);
        
        // Clean up dependencies
        if (cached && cached.dependencies) {
            cached.dependencies.forEach(dep => {
                const depSet = this.dependencies.get(dep);
                if (depSet) {
                    depSet.delete(keyToEvict);
                    if (depSet.size === 0) {
                        this.dependencies.delete(dep);
                    }
                }
            });
        }
        
        this.cache.delete(keyToEvict);
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            dependencies: this.dependencies.size,
            oldestEntry: this.accessOrder[0] || null
        };
    }
}

// Create singleton instance
export const memoCache = new MemoizationCache();

/**
 * Decorator for class methods
 */
export function memoized(options = {}) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = memoCache.memoize(originalMethod, {
            name: `${target.constructor.name}.${propertyKey}`,
            ...options
        });
        return descriptor;
    };
}

/**
 * Transaction-specific memoization helper
 */
export class TransactionMemoizer {
    constructor() {
        this.groupedByMonth = null;
        this.groupedByCategory = null;
        this.lastTransactionCount = 0;
        this.lastUpdateTime = null;
    }
    
    /**
     * Check if transactions have changed
     */
    hasTransactionsChanged(transactions) {
        return transactions.length !== this.lastTransactionCount;
    }
    
    /**
     * Group transactions by month with caching
     */
    groupTransactionsByMonth(transactions) {
        if (this.groupedByMonth && !this.hasTransactionsChanged(transactions)) {
            return this.groupedByMonth;
        }
        
        const groups = new Map();
        
        transactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!groups.has(monthKey)) {
                groups.set(monthKey, []);
            }
            groups.get(monthKey).push(transaction);
        });
        
        this.groupedByMonth = groups;
        this.lastTransactionCount = transactions.length;
        this.lastUpdateTime = Date.now();
        
        return groups;
    }
    
    /**
     * Group transactions by category with caching
     */
    groupTransactionsByCategory(transactions) {
        if (this.groupedByCategory && !this.hasTransactionsChanged(transactions)) {
            return this.groupedByCategory;
        }
        
        const groups = new Map();
        
        transactions.forEach(transaction => {
            const category = transaction.category || 'Uncategorized';
            
            if (!groups.has(category)) {
                groups.set(category, []);
            }
            groups.get(category).push(transaction);
        });
        
        this.groupedByCategory = groups;
        this.lastTransactionCount = transactions.length;
        
        return groups;
    }
    
    /**
     * Clear all transaction caches
     */
    clearCache() {
        this.groupedByMonth = null;
        this.groupedByCategory = null;
        this.lastTransactionCount = 0;
        this.lastUpdateTime = null;
    }
}

// Create transaction-specific memoizer
export const transactionMemoizer = new TransactionMemoizer();