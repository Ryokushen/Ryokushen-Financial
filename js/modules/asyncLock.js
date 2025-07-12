// js/modules/asyncLock.js

/**
 * Async Lock/Mutex implementation for preventing race conditions
 */
export class AsyncLock {
    constructor() {
        this.queue = [];
        this.locked = false;
    }
    
    /**
     * Acquire the lock
     * @returns {Promise} Resolves when lock is acquired
     */
    async acquire() {
        return new Promise((resolve) => {
            if (!this.locked) {
                this.locked = true;
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }
    
    /**
     * Release the lock
     */
    release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        } else {
            this.locked = false;
        }
    }
    
    /**
     * Execute a function with the lock held
     * @param {Function} fn - Async function to execute
     * @returns {Promise} Result of the function
     */
    async withLock(fn) {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
    
    /**
     * Check if the lock is currently held
     */
    isLocked() {
        return this.locked;
    }
}

/**
 * Operation Queue for serializing async operations
 */
export class OperationQueue {
    constructor(concurrency = 1) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }
    
    /**
     * Add an operation to the queue
     */
    async add(operation) {
        return new Promise((resolve, reject) => {
            this.queue.push({ operation, resolve, reject });
            this.process();
        });
    }
    
    /**
     * Process the queue
     */
    async process() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }
        
        this.running++;
        const { operation, resolve, reject } = this.queue.shift();
        
        try {
            const result = await operation();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }
    
    /**
     * Wait for all operations to complete
     */
    async waitForAll() {
        while (this.running > 0 || this.queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

/**
 * Debounced async function executor
 */
export class DebouncedAsync {
    constructor(fn, delay = 1000) {
        this.fn = fn;
        this.delay = delay;
        this.timeoutId = null;
        this.pendingPromise = null;
    }
    
    /**
     * Execute the function with debouncing
     */
    execute(...args) {
        // Clear existing timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        
        // Create new promise if none exists
        if (!this.pendingPromise) {
            this.pendingPromise = new Promise((resolve, reject) => {
                this.timeoutId = setTimeout(async () => {
                    try {
                        const result = await this.fn(...args);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    } finally {
                        this.pendingPromise = null;
                        this.timeoutId = null;
                    }
                }, this.delay);
            });
        }
        
        return this.pendingPromise;
    }
    
    /**
     * Cancel pending execution
     */
    cancel() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
            this.pendingPromise = null;
        }
    }
}