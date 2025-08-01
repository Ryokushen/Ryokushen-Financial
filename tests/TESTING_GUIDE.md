# Testing Guide - Ryokushen Financial

## Current Testing Status

**Last Updated**: August 1, 2025

### Available Testing Infrastructure

#### 1. Jest Configuration
The application is configured to use Jest for automated testing with:
- **Environment**: jsdom (browser environment simulation)
- **Test Pattern**: `**/tests/**/*.test.js`
- **Coverage**: Configured for `js/modules/**/*.js` (excluding voice modules)

#### 2. NPM Scripts
Available testing commands:
```bash
npm test              # Run all Jest tests (currently finds no tests)
npm run test:unit     # Run unit tests (if they existed)
npm run test:integration # Run integration tests (if they existed)
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

**Current Status**: ❌ No actual `.test.js` files exist, so `npm test` returns "No tests found"

### Manual Testing (Current Approach)

#### 1. HTML Test Files
The actual testing approach uses HTML files that must be manually opened in a browser:

**Available Test Files**:
- `performance-test.html` - Manual performance testing interface
- `test-data-generator.js` - Generates test data (not automated)
- Various debugging HTML files

#### 2. Browser Console Testing
Some features can be tested via browser console:
```javascript
// Example manual tests
window.searchTransactions({category: 'Food', minAmount: 10})
window.transactionManager.getSmartDefaults({description: 'Starbucks'})
window.dashboardUtils.captureSnapshot() // New snapshot testing utility
```

#### 3. Developer Tools Testing
- Use Chrome DevTools Performance tab for profiling
- Use Network tab for API call monitoring
- Use Console for error tracking

### Testing Recommendations

#### Option 1: Implement Automated Jest Tests
To match the documented sophisticated testing approach:

1. **Create actual test files**:
   ```
   tests/
   ├── modules/
   │   ├── dashboard.test.js
   │   ├── transactionManager.test.js
   │   ├── financialMath.test.js
   │   └── ...
   └── integration/
       ├── auth.test.js
       ├── crud.test.js
       └── ...
   ```

2. **Add missing npm scripts** mentioned in documentation:
   - `npm run test:performance`
   - `npm run test:data-index`
   - `npm run test:forms`

#### Option 2: Document Current Manual Approach
Update all test documentation to accurately reflect the HTML-based manual testing:

1. **Remove references to**:
   - Non-existent Jest test files
   - Automated test runners
   - CI/CD integration claims

2. **Document actual testing process**:
   - How to open and run HTML test files
   - Manual verification checklists
   - Browser-based testing procedures

### Current Testing Coverage

#### ✅ What's Actually Tested
- Manual browser testing of UI components
- Performance monitoring through HTML test files
- Console-based feature testing
- Visual verification of charts and dashboards

#### ❌ What's Not Tested
- Automated unit tests
- Integration tests
- API endpoint testing
- Cross-browser compatibility (automated)
- Performance regression detection

### Recommendations

1. **Short-term**: Update documentation to reflect current manual testing approach
2. **Long-term**: Implement actual Jest tests to match the sophisticated strategy described
3. **Immediate**: Remove claims about automated testing that doesn't exist

### File Locations

**Test Documentation**:
- `/tests/comprehensive-testing-strategy.md` - Aspirational (not implemented)
- `/tests/test-checklist.md` - Manual checklist (partially accurate)
- `/tests/performance-test-results.md` - Results from manual testing

**Actual Test Files**:
- `/tests/performance-test.html` - Manual performance testing
- `/tests/test-data-generator.js` - Test data utilities

**Configuration**:
- `package.json` - Jest configuration (ready but unused)
- `jest.config.js` - Does not exist (uses package.json config)