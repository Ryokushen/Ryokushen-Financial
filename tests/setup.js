/**
 * Jest test setup file
 * Configures the test environment for all tests
 */

// Mock localStorage for all tests
const localStorageMock = {
  storage: {},
  getItem(key) {
    return this.storage[key] || null;
  },
  setItem(key, value) {
    this.storage[key] = value.toString();
  },
  removeItem(key) {
    delete this.storage[key];
  },
  clear() {
    this.storage = {};
  },
};

global.localStorage = localStorageMock;

// Mock window.location for tests that need it
delete window.location;
window.location = {
  hostname: 'localhost',
  protocol: 'http:',
  href: 'http://localhost',
  reload: () => {},
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
});
