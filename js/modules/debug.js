// js/modules/debug.js

/**
 * Debug utility for managing console output with log levels
 * Set window.DEBUG = true to enable debug logging
 */

import { isProduction } from '../config.js';

// Log levels
export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Default log level configuration
const DEFAULT_LOG_LEVEL = isProduction ? LogLevel.ERROR : LogLevel.WARN;

// Module-specific log level overrides
const moduleLogLevels = new Map([
  ['RuleEngine', LogLevel.WARN],
  ['EventManager', LogLevel.WARN],
  ['SmartRules', LogLevel.WARN],
  ['DelegationManager', LogLevel.WARN],
  ['TransactionManager', LogLevel.INFO],
  ['Calendar', LogLevel.INFO],
  ['PaySchedule', LogLevel.INFO],
  ['DEFAULT', DEFAULT_LOG_LEVEL]
]);

// Current global log level
let globalLogLevel = DEFAULT_LOG_LEVEL;

// Check if debug mode is enabled
const isDebugMode = () => {
  return (
    window.DEBUG === true ||
    localStorage.getItem('debug') === 'true' ||
    new URLSearchParams(window.location.search).has('debug')
  );
};

// Get log level for a specific module
const getLogLevel = (module = 'DEFAULT') => {
  // Check for module-specific override in localStorage
  const storedLevel = localStorage.getItem(`logLevel_${module}`);
  if (storedLevel !== null) {
    return parseInt(storedLevel, 10);
  }
  
  // Check module-specific configuration
  if (moduleLogLevels.has(module)) {
    return moduleLogLevels.get(module);
  }
  
  // Fall back to global log level
  return globalLogLevel;
};

// Check if a log should be shown based on level
const shouldLog = (level, module = 'DEFAULT') => {
  const moduleLevel = getLogLevel(module);
  return level <= moduleLevel;
};

// Extract module name from log arguments
const extractModule = (args) => {
  if (args.length > 0 && typeof args[0] === 'string') {
    const match = args[0].match(/^([A-Za-z]+):/);
    if (match) {
      return match[1];
    }
  }
  return 'DEFAULT';
};

// Create a debug logger with log levels
export const debug = {
  // Error - Always shown unless in production
  error: (...args) => {
    if (!isProduction) {
      const module = extractModule(args);
      if (shouldLog(LogLevel.ERROR, module)) {
        console.error('[ERROR]', ...args);
      }
    }
  },
  
  // Warning - Shown for WARN level and above
  warn: (...args) => {
    if (!isProduction) {
      const module = extractModule(args);
      if (shouldLog(LogLevel.WARN, module)) {
        console.warn('[WARN]', ...args);
      }
    }
  },
  
  // Info - Shown for INFO level and above
  info: (...args) => {
    if (!isProduction) {
      const module = extractModule(args);
      if (shouldLog(LogLevel.INFO, module)) {
        console.info('[INFO]', ...args);
      }
    }
  },
  
  // Debug - Shown for DEBUG level and above
  log: (...args) => {
    if (!isProduction) {
      const module = extractModule(args);
      if (shouldLog(LogLevel.DEBUG, module)) {
        console.log('[DEBUG]', ...args);
      }
    }
  },
  
  // Trace - Most verbose, shown only at TRACE level
  trace: (...args) => {
    if (!isProduction) {
      const module = extractModule(args);
      if (shouldLog(LogLevel.TRACE, module)) {
        console.log('[TRACE]', ...args);
      }
    }
  },

  // Utility methods
  table: data => {
    if (isDebugMode() && !isProduction) {
      console.table(data);
    }
  },

  time: label => {
    if (isDebugMode() && !isProduction) {
      console.time(label);
    }
  },

  timeEnd: label => {
    if (isDebugMode() && !isProduction) {
      console.timeEnd(label);
    }
  },

  group: label => {
    if (isDebugMode() && !isProduction) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDebugMode() && !isProduction) {
      console.groupEnd();
    }
  },

  // Configuration methods
  
  // Set global log level
  setLogLevel: (level) => {
    if (typeof level === 'number' && level >= 0 && level <= 4) {
      globalLogLevel = level;
      localStorage.setItem('globalLogLevel', level.toString());
      console.log(`Global log level set to ${Object.keys(LogLevel).find(k => LogLevel[k] === level)}`);
    }
  },
  
  // Set module-specific log level
  setModuleLogLevel: (module, level) => {
    if (typeof level === 'number' && level >= 0 && level <= 4) {
      moduleLogLevels.set(module, level);
      localStorage.setItem(`logLevel_${module}`, level.toString());
      console.log(`${module} log level set to ${Object.keys(LogLevel).find(k => LogLevel[k] === level)}`);
    }
  },
  
  // Clear module-specific log level
  clearModuleLogLevel: (module) => {
    moduleLogLevels.delete(module);
    localStorage.removeItem(`logLevel_${module}`);
    console.log(`${module} log level reset to default`);
  },
  
  // Enable verbose logging for a specific module
  enableVerbose: (module) => {
    debug.setModuleLogLevel(module, LogLevel.TRACE);
  },
  
  // Disable verbose logging for a specific module
  disableVerbose: (module) => {
    debug.clearModuleLogLevel(module);
  },

  // Enable/disable debug mode (legacy support)
  enable: () => {
    window.DEBUG = true;
    localStorage.setItem('debug', 'true');
    debug.setLogLevel(LogLevel.DEBUG);
    console.log('Debug mode enabled');
  },

  disable: () => {
    window.DEBUG = false;
    localStorage.removeItem('debug');
    debug.setLogLevel(LogLevel.WARN);
    console.log('Debug mode disabled');
  },

  // Check if debug mode is active
  isEnabled: isDebugMode,
  
  // Get current log levels
  getLogLevels: () => {
    const levels = {};
    for (const [module, level] of moduleLogLevels) {
      levels[module] = Object.keys(LogLevel).find(k => LogLevel[k] === level);
    }
    levels.GLOBAL = Object.keys(LogLevel).find(k => LogLevel[k] === globalLogLevel);
    return levels;
  },
  
  // Help text
  help: () => {
    console.log(`
Debug Module Help:
==================
Log Levels: ERROR(0), WARN(1), INFO(2), DEBUG(3), TRACE(4)

Commands:
- debug.setLogLevel(level) - Set global log level
- debug.setModuleLogLevel('ModuleName', level) - Set module-specific level
- debug.enableVerbose('ModuleName') - Enable TRACE logging for module
- debug.disableVerbose('ModuleName') - Reset module to default level
- debug.getLogLevels() - Show current log levels
- debug.enable() - Enable debug mode (DEBUG level)
- debug.disable() - Disable debug mode (WARN level)

Common Modules:
- RuleEngine, EventManager, SmartRules, DelegationManager
- TransactionManager, Calendar, PaySchedule

Example:
  debug.enableVerbose('RuleEngine') - See all RuleEngine logs
  debug.setLogLevel(debug.LogLevel.INFO) - Show INFO and above globally
    `);
  }
};

// Initialize global log level from localStorage if available
const storedGlobalLevel = localStorage.getItem('globalLogLevel');
if (storedGlobalLevel !== null) {
  globalLogLevel = parseInt(storedGlobalLevel, 10);
}

// Add help to window for easy access
if (!isProduction) {
  window.debugHelp = debug.help;
  window.debug = debug;
  window.LogLevel = LogLevel;
}