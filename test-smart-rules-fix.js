// Test script to verify Smart Rules auto-categorization fix
// Run this in the browser console when the app is loaded

async function testSmartRulesFix() {
    console.log('=== Testing Smart Rules Auto-Categorization Fix ===');
    
    // Enable debug mode
    if (window.debug) {
        window.debug.enable(true);
        console.log('✓ Debug mode enabled');
    }
    
    // Check if smartRules is initialized
    if (!window.smartRules) {
        console.error('✗ Smart Rules not initialized');
        return;
    }
    console.log('✓ Smart Rules initialized');
    
    // Get current rules
    const rules = await window.smartRules.getRules();
    console.log(`✓ Found ${rules.length} active rules`);
    
    // Create a test rule if needed
    const testRuleName = 'Test Auto-Categorization Rule';
    let testRule = rules.find(r => r.name === testRuleName);
    
    if (!testRule) {
        console.log('Creating test rule...');
        testRule = await database.saveSmartRule({
            name: testRuleName,
            conditions: [
                {
                    field: 'description',
                    operator: 'contains',
                    value: 'AUTOTEST'
                }
            ],
            actions: [
                {
                    type: 'set_category',
                    value: 'Bills'
                }
            ],
            enabled: true,
            priority: 1
        });
        await window.smartRules.loadRules();
        console.log('✓ Test rule created');
    } else {
        console.log('✓ Test rule already exists');
    }
    
    // Get accounts
    const accounts = await database.getAccounts();
    if (accounts.length === 0) {
        console.error('✗ No accounts found. Please create an account first.');
        return;
    }
    console.log(`✓ Found ${accounts.length} accounts`);
    
    // Test 1: Create transaction with empty category
    console.log('\n--- Test 1: Transaction with empty category ---');
    const test1Transaction = await transactionManager.addTransaction({
        date: new Date().toISOString().split('T')[0],
        description: 'AUTOTEST Transaction with empty category',
        amount: -50.00,
        account_id: accounts[0].id,
        category: '' // Empty category
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check result
    const test1Result = await database.getTransaction(test1Transaction.id);
    console.log(`Original category: "${test1Transaction.category}"`);
    console.log(`Final category: "${test1Result.category}"`);
    console.log(`Test 1 Result: ${test1Result.category === 'Bills' ? '✓ PASSED' : '✗ FAILED'}`);
    
    // Test 2: Create transaction with no category property
    console.log('\n--- Test 2: Transaction with no category property ---');
    const test2Transaction = await transactionManager.addTransaction({
        date: new Date().toISOString().split('T')[0],
        description: 'AUTOTEST Transaction with no category',
        amount: -75.00,
        account_id: accounts[0].id
        // No category property at all
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check result
    const test2Result = await database.getTransaction(test2Transaction.id);
    console.log(`Original category: ${test2Transaction.category}`);
    console.log(`Final category: "${test2Result.category}"`);
    console.log(`Test 2 Result: ${test2Result.category === 'Bills' ? '✓ PASSED' : '✗ FAILED'}`);
    
    // Test 3: Create transaction with "Uncategorized"
    console.log('\n--- Test 3: Transaction with "Uncategorized" ---');
    const test3Transaction = await transactionManager.addTransaction({
        date: new Date().toISOString().split('T')[0],
        description: 'AUTOTEST Transaction with Uncategorized',
        amount: -100.00,
        account_id: accounts[0].id,
        category: 'Uncategorized'
    });
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check result
    const test3Result = await database.getTransaction(test3Transaction.id);
    console.log(`Original category: "${test3Transaction.category}"`);
    console.log(`Final category: "${test3Result.category}"`);
    console.log(`Test 3 Result: ${test3Result.category === 'Bills' ? '✓ PASSED' : '✗ FAILED'}`);
    
    // Cleanup
    console.log('\n--- Cleaning up test data ---');
    await transactionManager.deleteTransaction(test1Transaction.id);
    await transactionManager.deleteTransaction(test2Transaction.id);
    await transactionManager.deleteTransaction(test3Transaction.id);
    console.log('✓ Test transactions deleted');
    
    console.log('\n=== Test Complete ===');
    console.log('Note: Check the console for Smart Rules debug logs to see the processing details.');
}

// Instructions
console.log('Smart Rules Auto-Categorization Test Script Loaded');
console.log('Run testSmartRulesFix() to test the fix');
console.log('Make sure you have at least one account created before running the test.');