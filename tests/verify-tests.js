// Test verification script to check for any errors after refactoring

import { modalManager } from './js/modules/modalManager.js';
import { openModal, closeModal } from './js/modules/ui.js';
import { privacyManager, isPrivacyMode, togglePrivacyMode } from './js/modules/privacy.js';
import { debug } from './js/modules/debug.js';
import { formatCurrency, formatDate, getDueDateClass } from './js/modules/utils.js';

console.log('Starting automated test verification...\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, details = '') {
    if (condition) {
        console.log(`✅ PASS: ${testName}`);
        testsPassed++;
    } else {
        console.error(`❌ FAIL: ${testName} - ${details}`);
        testsFailed++;
    }
}

// Test 1: Modal Manager exists and has correct methods
console.log('\n--- Testing Modal System ---');
assert(typeof modalManager === 'object', 'Modal Manager exists');
assert(typeof modalManager.open === 'function', 'modalManager.open is a function');
assert(typeof modalManager.close === 'function', 'modalManager.close is a function');
assert(typeof openModal === 'function', 'openModal is exported from ui.js');
assert(typeof closeModal === 'function', 'closeModal is exported from ui.js');

// Test 2: Privacy Manager functionality
console.log('\n--- Testing Privacy System ---');
assert(typeof privacyManager === 'object', 'Privacy Manager exists');
assert(typeof isPrivacyMode === 'function', 'isPrivacyMode is a function');
assert(typeof togglePrivacyMode === 'function', 'togglePrivacyMode is a function');
assert(typeof privacyManager.isPrivacyEnabled === 'function', 'Privacy manager has isPrivacyEnabled');

// Test that removed methods don't exist
assert(typeof privacyManager.debugElement === 'undefined', 'debugElement method was removed');

// Test 3: Debug module functionality
console.log('\n--- Testing Debug Module ---');
assert(typeof debug === 'object', 'Debug object exists');
assert(typeof debug.log === 'function', 'debug.log is a function');
assert(typeof debug.error === 'function', 'debug.error is a function');

// Test that removed exports don't exist
assert(typeof window.DEBUG === 'undefined', 'DEBUG constant not exported to window');
assert(typeof window.debugOnly === 'undefined', 'debugOnly not exported to window');
assert(typeof window.replaceConsoleLog === 'undefined', 'replaceConsoleLog not exported to window');

// Test 4: Utils module functionality
console.log('\n--- Testing Utils Module ---');
assert(typeof formatCurrency === 'function', 'formatCurrency is a function');
assert(formatCurrency(1234.56) === '$1,234.56', 'formatCurrency works correctly');
assert(typeof formatDate === 'function', 'formatDate is a function');
assert(typeof getDueDateClass === 'function', 'getDueDateClass is a function');

// Test that removed functions don't exist
assert(typeof window.safeParseInt === 'undefined', 'safeParseInt was removed');
assert(typeof window.getDaysUntilText === 'undefined', 'getDaysUntilText was removed');
assert(typeof window.DEFAULT_CASH_ACCOUNTS === 'undefined', 'DEFAULT_CASH_ACCOUNTS was removed');

// Test 5: Check for console.log statements in production code
console.log('\n--- Checking for Console Logs ---');
const checkForConsoleLogs = async () => {
    const filesToCheck = [
        './js/modules/charts.js',
        './js/modules/privacy.js',
        './js/app.js'
    ];
    
    let consoleLogsFound = 0;
    
    for (const file of filesToCheck) {
        try {
            const response = await fetch(file);
            const text = await response.text();
            const matches = text.match(/console\.log\(/g);
            if (matches) {
                consoleLogsFound += matches.length;
                console.warn(`Found ${matches.length} console.log statements in ${file}`);
            }
        } catch (error) {
            console.error(`Could not check ${file}: ${error.message}`);
        }
    }
    
    assert(consoleLogsFound === 0, 'No console.log statements in refactored files', 
        `Found ${consoleLogsFound} console.log statements`);
};

// Test 6: Privacy mode toggle
console.log('\n--- Testing Privacy Toggle ---');
const initialPrivacyState = isPrivacyMode();
togglePrivacyMode();
const afterToggle = isPrivacyMode();
assert(afterToggle !== initialPrivacyState, 'Privacy mode toggles correctly');
togglePrivacyMode(); // Toggle back

// Test 7: Chart update functions
console.log('\n--- Testing Chart Functions ---');
assert(typeof window.updateDebtCharts === 'function', 'updateDebtCharts is available globally');
assert(typeof window.updateInvestmentCharts === 'function', 'updateInvestmentCharts is available globally');

// Run async tests
(async () => {
    await checkForConsoleLogs();
    
    // Final summary
    console.log('\n========================================');
    console.log(`Total Tests: ${testsPassed + testsFailed}`);
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log('========================================');
    
    if (testsFailed === 0) {
        console.log('\n🎉 All tests passed! The refactoring was successful.');
    } else {
        console.error('\n⚠️  Some tests failed. Please review the failures above.');
    }
})();