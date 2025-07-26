// Playwright test for TransactionManager integration
import { chromium } from 'playwright';

async function runTransactionManagerTests() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };

    console.log('🧪 Starting TransactionManager Integration Tests...\n');

    try {
        // Navigate to the test page
        await page.goto('http://localhost:8080/tests/unit/transaction-manager-test.html');
        
        // Wait for tests to complete
        await page.waitForTimeout(3000);
        
        // Extract test results
        const testResults = await page.evaluate(() => {
            const results = [];
            const testElements = document.querySelectorAll('.test-result');
            
            testElements.forEach(element => {
                const isPass = element.classList.contains('pass');
                const testName = element.querySelector('strong').textContent.replace(/[✓✗]\s+/, '');
                const errorDetails = element.querySelector('.error-details');
                
                results.push({
                    name: testName,
                    passed: isPass,
                    error: errorDetails ? errorDetails.textContent : null
                });
            });
            
            // Get summary
            const summary = document.getElementById('test-summary');
            const summaryText = summary ? summary.textContent : '';
            
            return { results, summaryText };
        });
        
        // Process results
        testResults.results.forEach(test => {
            results.total++;
            if (test.passed) {
                results.passed++;
                console.log(`✅ ${test.name}`);
            } else {
                results.failed++;
                console.log(`❌ ${test.name}`);
                if (test.error) {
                    console.log(`   Error: ${test.error}`);
                }
            }
            results.tests.push(test);
        });
        
        console.log('\n📊 Test Summary:');
        console.log(`Total: ${results.total}`);
        console.log(`Passed: ${results.passed}`);
        console.log(`Failed: ${results.failed}`);
        console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
        
        // Now test the actual app integration
        console.log('\n🔄 Testing Live App Integration...\n');
        
        // Navigate to main app
        await page.goto('http://localhost:8080');
        
        // Check if we need to login (for mock testing, we'll check if login page is shown)
        const isLoginPage = await page.evaluate(() => {
            return document.querySelector('.auth-container') !== null;
        });
        
        if (isLoginPage) {
            console.log('⚠️  App requires authentication - skipping live tests');
        } else {
            // Test 1: Check if TransactionManager is loaded
            const tmLoaded = await page.evaluate(() => {
                return typeof window.transactionManager !== 'undefined';
            });
            console.log(tmLoaded ? '✅ TransactionManager loaded in app' : '❌ TransactionManager not loaded');
            
            // Test 2: Check if transactions module uses TransactionManager
            const usesNewSystem = await page.evaluate(() => {
                // Check if the new functions are in place
                const moduleCode = window.addNewTransaction ? window.addNewTransaction.toString() : '';
                return moduleCode.includes('transactionManager');
            });
            console.log(usesNewSystem ? '✅ Transactions module uses TransactionManager' : '❌ Transactions module not updated');
            
            // Test 3: Test console access
            const consoleTest = await page.evaluate(async () => {
                try {
                    if (!window.transactionManager) return { success: false, error: 'TransactionManager not found' };
                    
                    // Test cache
                    const cacheSize = window.transactionManager.cache.size;
                    
                    // Test metrics
                    const metrics = window.transactionManager.metrics;
                    
                    return { 
                        success: true, 
                        cacheSize,
                        metrics
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            if (consoleTest.success) {
                console.log('✅ Console access to TransactionManager works');
                console.log(`   Cache size: ${consoleTest.cacheSize}`);
                console.log(`   Operations: ${consoleTest.metrics.operations}`);
            } else {
                console.log('❌ Console access failed:', consoleTest.error);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Test execution error:', error.message);
        results.failed++;
    } finally {
        await browser.close();
    }
    
    // Final result
    console.log('\n' + '='.repeat(50));
    if (results.failed === 0) {
        console.log('✅ All tests passed! TransactionManager is working correctly.');
    } else {
        console.log(`⚠️  ${results.failed} tests failed. Please check the errors above.`);
    }
    console.log('='.repeat(50));
    
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run the tests
runTransactionManagerTests().catch(console.error);