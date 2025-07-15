#!/usr/bin/env node
/**
 * Simple test runner for Time Budget tests
 * Run with: node tests/run-time-budget-tests.js
 */

import { timeBudgets } from '../js/modules/timeBudgets.js';

// Test results tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

// Simple assertion helpers
function assertEqual(actual, expected, testName) {
    totalTests++;
    if (actual === expected) {
        passedTests++;
        console.log(`✅ PASS: ${testName}`);
        testResults.push({ test: testName, status: 'PASS' });
    } else {
        failedTests++;
        console.error(`❌ FAIL: ${testName}`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Actual: ${actual}`);
        testResults.push({ test: testName, status: 'FAIL', expected, actual });
    }
}

function assertApproxEqual(actual, expected, tolerance, testName) {
    totalTests++;
    if (Math.abs(actual - expected) <= tolerance) {
        passedTests++;
        console.log(`✅ PASS: ${testName}`);
        testResults.push({ test: testName, status: 'PASS' });
    } else {
        failedTests++;
        console.error(`❌ FAIL: ${testName}`);
        console.error(`   Expected: ${expected} ± ${tolerance}`);
        console.error(`   Actual: ${actual}`);
        testResults.push({ test: testName, status: 'FAIL', expected, actual });
    }
}

// Mock localStorage
const localStorageMock = {
    storage: {},
    getItem: function(key) {
        return this.storage[key] || null;
    },
    setItem: function(key, value) {
        this.storage[key] = value.toString();
    },
    clear: function() {
        this.storage = {};
    }
};

global.localStorage = localStorageMock;

console.log('🧪 Running Time Budget Tests...\n');

// Test 1: Initial state
console.log('📋 Test Group: Initial State');
assertEqual(timeBudgets.isEnabled(), false, 'Time budgets should be disabled by default');

// Test 2: Configuration
console.log('\n📋 Test Group: Configuration Management');
timeBudgets.setConfig({
    enabled: true,
    hourlyWage: 50,
    taxRate: 25
});

assertEqual(timeBudgets.isEnabled(), true, 'Time budgets should be enabled after config');
assertEqual(timeBudgets.getConfig().hourlyWage, 50, 'Hourly wage should be saved');
assertEqual(timeBudgets.getConfig().taxRate, 25, 'Tax rate should be saved');
assertEqual(timeBudgets.getConfig().afterTaxRate, 37.5, 'After-tax rate should be calculated correctly');

// Test 3: Time Conversion
console.log('\n📋 Test Group: Time Conversion');

// Test exact hours
let result = timeBudgets.convertToTime(75); // $75 at $37.50/hour = 2 hours
assertEqual(result.hours, 2, 'Should convert $75 to 2 hours');
assertEqual(result.minutes, 0, 'Should have 0 minutes for exact hours');
assertEqual(result.formatted, '2h', 'Should format as "2h"');

// Test with minutes
result = timeBudgets.convertToTime(56.25); // 1.5 hours
assertEqual(result.hours, 1, 'Should convert $56.25 to 1 hour');
assertEqual(result.minutes, 30, 'Should have 30 minutes');
assertEqual(result.formatted, '1h 30m', 'Should format as "1h 30m"');

// Test minutes only
result = timeBudgets.convertToTime(18.75); // 0.5 hours
assertEqual(result.hours, 0, 'Should convert $18.75 to 0 hours');
assertEqual(result.minutes, 30, 'Should have 30 minutes');
assertEqual(result.formatted, '30m', 'Should format as "30m"');

// Test 4: Edge Cases
console.log('\n📋 Test Group: Edge Cases');

// Zero wage
timeBudgets.setConfig({
    enabled: true,
    hourlyWage: 0,
    taxRate: 25
});
assertEqual(timeBudgets.convertToTime(100), null, 'Should return null for zero wage');

// 100% tax
timeBudgets.setConfig({
    enabled: true,
    hourlyWage: 50,
    taxRate: 100
});
assertEqual(timeBudgets.convertToTime(100), null, 'Should return null for 100% tax');

// Disabled
timeBudgets.setConfig({
    enabled: false,
    hourlyWage: 50,
    taxRate: 25
});
assertEqual(timeBudgets.convertToTime(100), null, 'Should return null when disabled');

// Test 5: Real-world scenarios
console.log('\n📋 Test Group: Real-world Scenarios');

// Minimum wage scenario
timeBudgets.setConfig({
    enabled: true,
    hourlyWage: 15,
    taxRate: 15
});

result = timeBudgets.convertToTime(12.75); // $12.75 at $12.75/hour = 1 hour
assertEqual(result.hours, 1, 'Minimum wage: $12.75 should equal 1 hour');

// Professional wage scenario
timeBudgets.setConfig({
    enabled: true,
    hourlyWage: 75,
    taxRate: 30
});

result = timeBudgets.convertToTime(105); // $105 at $52.50/hour = 2 hours
assertEqual(result.hours, 2, 'Professional wage: $105 should equal 2 hours');

// Test 6: Large amounts
console.log('\n📋 Test Group: Large Amounts');

timeBudgets.setConfig({
    enabled: true,
    hourlyWage: 50,
    taxRate: 25
});

result = timeBudgets.convertToTime(3750); // 100 hours
assertEqual(result.hours, 100, 'Should handle large amounts (100 hours)');
assertEqual(result.totalMinutes, 6000, 'Should calculate total minutes correctly');

// Test 7: Persistence
console.log('\n📋 Test Group: Persistence');

localStorage.clear();
timeBudgets.loadConfig();
assertEqual(timeBudgets.isEnabled(), false, 'Should default to disabled after localStorage clear');

timeBudgets.setConfig({
    enabled: true,
    hourlyWage: 60,
    taxRate: 20
});

const savedData = JSON.parse(localStorage.getItem('timeBudgetSettings'));
assertEqual(savedData.hourlyWage, 60, 'Should persist hourly wage to localStorage');
assertEqual(savedData.taxRate, 20, 'Should persist tax rate to localStorage');

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Test Summary:');
console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);
console.log('='.repeat(50));

if (failedTests === 0) {
    console.log('\n🎉 All tests passed!');
} else {
    console.log('\n⚠️  Some tests failed. Please review the failures above.');
    process.exit(1);
}

// Export results for further processing
export { testResults };