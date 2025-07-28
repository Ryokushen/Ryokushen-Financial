// js/modules/errorHandler.js

import { showError } from './ui.js';
import { debug } from './debug.js';

/**
 * Centralized error handling utilities
 */

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling(fn, errorMessage = 'An error occurred') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      debug.error(`Error in ${fn.name || 'anonymous function'}:`, error);
      showError(`${errorMessage}: ${error.message}`);
      throw error;
    }
  };
}

/**
 * Wrap database operations with consistent error handling
 */
export function withDatabaseErrorHandling(operation) {
  return async (...args) => {
    try {
      return await operation(...args);
    } catch (error) {
      // Check for specific database errors
      if (error.code === '23505') {
        showError('This item already exists.');
      } else if (error.code === '23503') {
        showError('Cannot complete operation: related data exists.');
      } else if (error.code === '42501') {
        showError('You do not have permission to perform this action.');
      } else if (error.message?.includes('Failed to fetch')) {
        showError('Network error. Please check your connection.');
      } else {
        showError(`Database error: ${error.message}`);
      }

      debug.error('Database operation failed:', error);
      throw error;
    }
  };
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on validation errors
      if (
        error.message?.includes('validation') ||
        error.message?.includes('invalid') ||
        error.code === '23505'
      ) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        debug.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Handle errors in event handlers
 */
export function errorBoundary(handler, context = 'Operation') {
  return async event => {
    try {
      await handler(event);
    } catch (error) {
      debug.error(`Error in ${context}:`, error);
      showError(`${context} failed. Please try again.`);
    }
  };
}

/**
 * Validate required fields and throw descriptive errors
 */
export function validateRequired(data, fields) {
  const missing = fields.filter(field => !data[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    debug.error('JSON parse error:', error);
    return defaultValue;
  }
}

/**
 * Create a timeout wrapper for async operations
 */
export function withTimeout(operation, timeoutMs = 30000) {
  return Promise.race([
    operation,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    ),
  ]);
}
