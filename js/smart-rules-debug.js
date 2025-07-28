// Smart Rules Debug Helper
// This file provides console commands to debug Smart Rules issues

window.smartRulesDebug = {
  // Test if Smart Rules is working
  async test() {
    console.log('🔍 Smart Rules Debug Test Starting...\n');
    
    // 1. Check if Smart Rules is initialized
    if (!window.smartRules) {
      console.error('❌ Smart Rules not initialized!');
      return;
    }
    console.log('✅ Smart Rules is initialized');
    
    // 2. List current rules
    window.smartRules.debugListRules();
    
    // 3. Check configuration
    const config = window.smartRules.getConfig();
    console.log('\n📋 Configuration:', config);
    
    // 4. Create a test rule if none exist
    if (window.smartRules.rules.length === 0) {
      console.log('\n📝 No rules found. Creating test rule...');
      await window.smartRules.createTestRule();
    }
    
    // 5. Test with a sample transaction
    console.log('\n🧪 Testing with sample transaction...');
    const testTransaction = {
      id: 'test-' + Date.now(),
      description: 'Test grocery store purchase',
      amount: -50.00,
      category: '', // Empty category
      date: new Date().toISOString()
    };
    
    console.log('Transaction:', testTransaction);
    const result = await window.smartRules.processTransaction(testTransaction, false, true);
    
    if (result && result.matched) {
      console.log(`✅ Rule matched! Would categorize as: ${result.actions[0].value}`);
    } else {
      console.log('❌ No rule matched');
    }
    
    console.log('\n✅ Debug test complete!');
  },
  
  // Create a test rule
  async createTestRule() {
    return await window.smartRules.createTestRule();
  },
  
  // List all rules
  listRules() {
    window.smartRules.debugListRules();
  },
  
  // Process all uncategorized transactions
  async processUncategorized() {
    console.log('🔄 Processing all uncategorized transactions...');
    const result = await window.smartRules.applyRulesToExistingTransactions();
    console.log('✅ Complete!', result);
  },
  
  // Show help
  help() {
    console.log(`
🤖 Smart Rules Debug Commands:
================================
smartRulesDebug.test()              - Run full diagnostic test
smartRulesDebug.createTestRule()    - Create a sample rule
smartRulesDebug.listRules()         - List all loaded rules
smartRulesDebug.processUncategorized() - Process all uncategorized transactions
smartRulesDebug.help()              - Show this help

To use: Open browser console and type any command above.
    `);
  }
};

// Auto-show help when loaded
console.log('🤖 Smart Rules Debug Helper loaded! Type smartRulesDebug.help() for commands.');