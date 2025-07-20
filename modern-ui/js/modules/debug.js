// Debug Module - Placeholder
console.log('Debug module loaded from modern-ui');

export function log(...args) {
  console.log('[DEBUG]', ...args);
}

export function error(...args) {
  console.error('[ERROR]', ...args);
}

export function warn(...args) {
  console.warn('[WARN]', ...args);
}

export default {
  log,
  error,
  warn
}