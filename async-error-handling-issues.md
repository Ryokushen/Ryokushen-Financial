# Async Functions Lacking Proper Error Handling

## Summary
After analyzing the codebase, I found several async operations that lack proper error handling. These could potentially cause unhandled promise rejections and impact user experience.

## Identified Issues

### 1. Event Handlers with Async Functions Without Try-Catch

#### File: `js/modules/validation.js`
- **Line 554-562**: Blur event handler with async validation
```javascript
eventManager.addEventListener(field, 'blur', async () => {
    validationState[fieldName].isDirty = true;
    await validateFieldWithFeedback(field, fieldName, validationSchema[fieldName], {
        showSuccessState,
        asyncValidator: asyncValidators[fieldName],
        formData: getFormData(form),
        crossFieldValidator
    });
});
```
**Risk**: If `validateFieldWithFeedback` throws an error, it will be an unhandled promise rejection.

- **Line 579-588**: setTimeout with async callback
```javascript
debounceTimers[fieldName] = setTimeout(async () => {
    if (validationState[fieldName].isDirty || field.value) {
        await validateFieldWithFeedback(field, fieldName, validationSchema[fieldName], {
            showSuccessState,
            asyncValidator: asyncValidators[fieldName],
            formData: getFormData(form),
            crossFieldValidator
        });
    }
}, debounceTime);
```
**Risk**: Async operations in setTimeout without error handling.

#### File: `js/app.js`
- **Line ~4850**: Privacy toggle without error handling
```javascript
eventManager.addEventListener(privacyToggleBtn, 'click', async () => {
    await togglePrivacyMode();
});
```
**Risk**: If `togglePrivacyMode` fails, the error is not caught.

#### File: `js/modules/formUtils.js`
- **Line ~87**: Form submit handler
```javascript
eventManager.addEventListener(form, 'submit', async e => {
    e.preventDefault();
    await handlers.onSubmit(e);
});
```
**Risk**: Form submission errors are not caught at this level.

### 2. Async Functions Without Try-Catch Blocks

#### File: `js/modules/performanceDashboard.js`
- **Line ~737**: `getChartData()` method
```javascript
async getChartData() {
    switch (this.currentView) {
        case 'trends':
            return this.getTrendsChartData();
        case 'categories':
            return this.getCategoriesChartData();
        case 'merchants':
            return this.getMerchantsChartData();
        case 'topExpenses':
            return await this.getTopExpensesChartData();
        case 'forecast':
            return this.getForecastChartData();
        default:
            return this.getTrendsChartData();
    }
}
```
**Risk**: If `getTopExpensesChartData()` throws, it propagates up uncaught.

#### File: `js/modules/supabaseAuth.js`
- **Line ~115**: `waitForInit()` method
```javascript
async waitForInit() {
    await this.initPromise;
}
```
**Risk**: If `initPromise` rejects, this method will throw without handling.

#### File: `js/modules/transactionTemplates.js`
- **Line ~150**: `init()` method
```javascript
async init() {
    this.setupEventListeners();
    this.registerModals();
    await this.loadTemplates();
    debug.log('Transaction Templates UI initialized');
}
```
**Risk**: If `loadTemplates()` fails, the entire initialization fails.

### 3. Database Operations Without Error Handling

#### File: `js/modules/recurring.js`
- **Line ~305**: Database operation without immediate error handling
```javascript
savedBill = await db.updateRecurringBill(parseInt(billId), billData);
```
**Risk**: While this is inside a try-catch block, the pattern is used elsewhere without protection.

### 4. Event Listeners with Multiple Async Operations

#### File: `js/modules/smartRules.js`
Multiple event listeners execute async operations without try-catch:
- `transaction:added` event handler
- `transaction:created:withBalance` event handler
- `transaction:updated` event handler
- `transaction:added:batch` event handler
- `transactions:batchAdded` event handler
- `transaction:updated:batch` event handler
- `transactions:imported` event handler

**Risk**: Each processes transactions asynchronously without error boundaries.

## Recommendations

### 1. Wrap Async Event Handlers
Add a utility function to wrap async event handlers:
```javascript
function asyncHandler(fn) {
    return async (...args) => {
        try {
            await fn(...args);
        } catch (error) {
            debug.error('Async handler error:', error);
            // Optionally show user-friendly error
        }
    };
}
```

### 2. Add Error Boundaries to Critical Paths
- Form submissions
- Data loading operations
- UI updates
- File operations

### 3. Implement Global Promise Rejection Handler
Add to app initialization:
```javascript
window.addEventListener('unhandledrejection', event => {
    debug.error('Unhandled promise rejection:', event.reason);
    // Log to error tracking service
    event.preventDefault();
});
```

### 4. Review and Update Patterns
- Always use try-catch in async event handlers
- Consider using `.catch()` for promise chains
- Implement proper error propagation
- Add user-friendly error messages

## Priority Areas
1. **High**: Form validation handlers - directly impact user experience
2. **High**: Smart rules event handlers - process financial data
3. **Medium**: UI event handlers (privacy toggle, etc.)
4. **Medium**: Chart/dashboard rendering functions
5. **Low**: Initialization functions (usually run once)