/**
 * Performance utility functions for debouncing, throttling, and optimization
 */

import { debug } from './debug.js';

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @param {Object} options - Options object
 * @returns {Function} The debounced function
 */
export function debounce(func, wait, options = {}) {
    let timeout;
    let result;
    const { leading = false, trailing = true, maxWait } = options;
    let lastCallTime;
    let lastInvokeTime = 0;
    let maxing = 'maxWait' in options;
    
    function invokeFunc(time) {
        const args = lastArgs;
        const thisArg = lastThis;
        
        lastArgs = lastThis = undefined;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
    }
    
    function leadingEdge(time) {
        lastInvokeTime = time;
        timeout = setTimeout(timerExpired, wait);
        return leading ? invokeFunc(time) : result;
    }
    
    function remainingWait(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;
        const timeWaiting = wait - timeSinceLastCall;
        
        return maxing
            ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
            : timeWaiting;
    }
    
    function shouldInvoke(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;
        
        return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
            (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
    }
    
    function timerExpired() {
        const time = Date.now();
        if (shouldInvoke(time)) {
            return trailingEdge(time);
        }
        timeout = setTimeout(timerExpired, remainingWait(time));
    }
    
    function trailingEdge(time) {
        timeout = undefined;
        
        if (trailing && lastArgs) {
            return invokeFunc(time);
        }
        lastArgs = lastThis = undefined;
        return result;
    }
    
    function cancel() {
        if (timeout !== undefined) {
            clearTimeout(timeout);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timeout = undefined;
    }
    
    function flush() {
        return timeout === undefined ? result : trailingEdge(Date.now());
    }
    
    function debounced(...args) {
        const time = Date.now();
        const isInvoking = shouldInvoke(time);
        
        lastArgs = args;
        lastThis = this;
        lastCallTime = time;
        
        if (isInvoking) {
            if (timeout === undefined) {
                return leadingEdge(lastCallTime);
            }
            if (maxing) {
                timeout = setTimeout(timerExpired, wait);
                return invokeFunc(lastCallTime);
            }
        }
        if (timeout === undefined) {
            timeout = setTimeout(timerExpired, wait);
        }
        return result;
    }
    
    let lastArgs;
    let lastThis;
    
    debounced.cancel = cancel;
    debounced.flush = flush;
    return debounced;
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 * @param {Function} func - The function to throttle
 * @param {number} wait - The number of milliseconds to throttle invocations to
 * @param {Object} options - Options object
 * @returns {Function} The throttled function
 */
export function throttle(func, wait, options = {}) {
    let leading = true;
    let trailing = true;
    
    if (typeof options === 'object') {
        leading = 'leading' in options ? !!options.leading : leading;
        trailing = 'trailing' in options ? !!options.trailing : trailing;
    }
    
    return debounce(func, wait, {
        leading,
        trailing,
        maxWait: wait
    });
}

/**
 * Batches multiple function calls into a single execution
 * @param {Function} func - The function to batch
 * @param {number} wait - The time window for batching
 * @returns {Function} The batched function
 */
export function batch(func, wait = 0) {
    let pending = false;
    let args = [];
    
    const execute = () => {
        const currentArgs = args;
        args = [];
        pending = false;
        func(currentArgs);
    };
    
    return function batched(arg) {
        args.push(arg);
        
        if (!pending) {
            pending = true;
            if (wait === 0) {
                Promise.resolve().then(execute);
            } else {
                setTimeout(execute, wait);
            }
        }
    };
}

/**
 * Request animation frame based throttling for smooth animations
 * @param {Function} func - The function to throttle
 * @returns {Function} The throttled function
 */
export function rafThrottle(func) {
    let rafId = null;
    let lastArgs = null;
    
    const throttled = function(...args) {
        lastArgs = args;
        
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                func.apply(this, lastArgs);
                rafId = null;
            });
        }
    };
    
    throttled.cancel = () => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };
    
    return throttled;
}

/**
 * Memoizes a function with a TTL (time to live)
 * @param {Function} func - The function to memoize
 * @param {number} ttl - Time to live in milliseconds
 * @param {Function} keyResolver - Optional function to resolve cache key
 * @returns {Function} The memoized function
 */
export function memoizeWithTTL(func, ttl = 60000, keyResolver) {
    const cache = new Map();
    
    const memoized = function(...args) {
        const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
        const cached = cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < ttl) {
            debug.log(`Cache hit for key: ${key}`);
            return cached.value;
        }
        
        const result = func.apply(this, args);
        cache.set(key, {
            value: result,
            timestamp: Date.now()
        });
        
        // Clean up old entries
        if (cache.size > 1000) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
        }
        
        return result;
    };
    
    memoized.clear = () => cache.clear();
    memoized.delete = (key) => cache.delete(key);
    
    return memoized;
}

/**
 * Lazy loads a module or component
 * @param {Function} loader - Function that returns a promise
 * @returns {Function} Function that loads the module on first call
 */
export function lazy(loader) {
    let module = null;
    let loading = null;
    
    return async function(...args) {
        if (module) {
            return module;
        }
        
        if (loading) {
            return loading;
        }
        
        loading = loader().then(m => {
            module = m;
            loading = null;
            return m;
        });
        
        return loading;
    };
}

/**
 * Creates a performance observer for measuring function execution time
 * @param {string} name - Name for the performance mark
 * @returns {Object} Object with start and end methods
 */
export function createPerformanceObserver(name) {
    const markStart = `${name}-start`;
    const markEnd = `${name}-end`;
    const measureName = `${name}-duration`;
    
    return {
        start() {
            performance.mark(markStart);
        },
        
        end() {
            performance.mark(markEnd);
            performance.measure(measureName, markStart, markEnd);
            
            const measure = performance.getEntriesByName(measureName)[0];
            if (measure) {
                debug.log(`${name} took ${measure.duration.toFixed(2)}ms`);
            }
            
            // Clean up marks
            performance.clearMarks(markStart);
            performance.clearMarks(markEnd);
            performance.clearMeasures(measureName);
            
            return measure ? measure.duration : 0;
        }
    };
}