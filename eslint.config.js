import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    ignores: [
      'node_modules/**',
      'package-lock.json',
      '**/*.min.js',
      'dist/**',
      'build/**',
      'coverage/**',
      '.eslintcache',
      'logs/**',
      'tmp/**',
      'temp/**',
      '.cache/**',
      '.parcel-cache/**',
      'docs/**',
      'vendor/**',
      'lib/**',
      'libraries/**',
      '*.db',
      '*.sqlite*',
      '*.bak',
      '*.backup',
      '**/__pycache__/**',
      '*.pyc',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Event: 'readonly',
        EventTarget: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        HTMLCollection: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',

        // Chart.js global
        Chart: 'readonly',

        // Web APIs
        FileReader: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        ImageData: 'readonly',
        DOMParser: 'readonly',
        XMLHttpRequest: 'readonly',
        AbortController: 'readonly',

        // Audio/Speech APIs
        SpeechRecognition: 'readonly',
        webkitSpeechRecognition: 'readonly',
        SpeechSynthesisUtterance: 'readonly',
        speechSynthesis: 'readonly',

        // Crypto API
        crypto: 'readonly',

        // IndexedDB
        indexedDB: 'readonly',

        // Performance API
        performance: 'readonly',

        // Service Worker
        ServiceWorker: 'readonly',

        // Additional browser globals
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        showSuccess: 'readonly', // Global function
      },
    },
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      // Prettier integration
      ...prettier.rules,
      'prettier/prettier': 'error',

      // Code quality rules - relaxed for large codebase
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-console': 'off', // We use console for debugging, but prefer debug module
      'no-debugger': 'error',
      'no-alert': 'warn',

      // ES6+ rules
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',

      // Best practices
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',

      // Error prevention
      'no-undef': 'error',
      'no-unused-expressions': 'warn', // Relaxed for development
      'no-unreachable': 'error',
      'no-duplicate-imports': 'warn', // Sometimes we need multiple imports from same module
      'no-case-declarations': 'warn', // Allow lexical declarations in case blocks
      'no-dupe-class-members': 'warn', // Allow method overloading patterns
      'no-dupe-keys': 'warn', // Allow for complex object patterns

      // Style preferences (handled by Prettier mostly)
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],

      // Financial app specific - be more lenient
      'no-magic-numbers': 'off', // Too many false positives in financial calculations
    },
  },
  {
    // Special rules for test files
    files: ['tests/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        // Jest testing globals
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    rules: {
      'no-magic-numbers': 'off', // Tests often use magic numbers
    },
  },
];
