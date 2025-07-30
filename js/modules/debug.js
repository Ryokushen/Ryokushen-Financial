// js/modules/debug.js

/**
 * Debug utility for managing console output
 * Set window.DEBUG = true to enable debug logging
 */

// Check if debug mode is enabled
const isDebugMode = () => {
  return (
    window.DEBUG === true ||
    localStorage.getItem('debug') === 'true' ||
    new URLSearchParams(window.location.search).has('debug')
  );
};

// Create a debug logger that only logs when debug mode is enabled
export const debug = {
  log: (...args) => {
    if (isDebugMode()) {
      console.log('[DEBUG]', ...args);
    }
  },

  info: (...args) => {
    if (isDebugMode()) {
      console.info('[INFO]', ...args);
    }
  },

  warn: (...args) => {
    if (isDebugMode()) {
      console.warn('[WARN]', ...args);
    }
  },

  error: (...args) => {
    // Always log errors, but add debug prefix in debug mode
    if (isDebugMode()) {
      console.error('[ERROR]', ...args);
    } else {
      console.error(...args);
    }
  },

  table: data => {
    if (isDebugMode()) {
      console.table(data);
    }
  },

  time: label => {
    if (isDebugMode()) {
      console.time(label);
    }
  },

  timeEnd: label => {
    if (isDebugMode()) {
      console.timeEnd(label);
    }
  },

  group: label => {
    if (isDebugMode()) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDebugMode()) {
      console.groupEnd();
    }
  },

  // Enable/disable debug mode
  enable: () => {
    window.DEBUG = true;
    localStorage.setItem('debug', 'true');
    console.log('Debug mode enabled');
  },

  disable: () => {
    window.DEBUG = false;
    localStorage.removeItem('debug');
    console.log('Debug mode disabled');
  },

  // Check if debug mode is active
  isEnabled: isDebugMode,
};
