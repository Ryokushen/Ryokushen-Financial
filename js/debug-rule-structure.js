// Debug script to inspect Smart Rules structure
async function debugRuleStructure() {
  console.log('🔍 Debugging Smart Rules Structure...\n');
  
  // Get the loaded rules
  const rules = window.smartRules.rules;
  console.log(`Found ${rules.length} rules loaded\n`);
  
  // Inspect each rule's structure
  rules.forEach((rule, index) => {
    console.log(`Rule ${index + 1}: "${rule.name}"`);
    console.log('Priority:', rule.priority);
    console.log('Enabled:', rule.enabled);
    
    // Inspect actions structure
    console.log('Actions:', JSON.stringify(rule.actions, null, 2));
    
    // Check if actions is an array
    if (Array.isArray(rule.actions)) {
      console.log('Actions is an array with', rule.actions.length, 'items');
      rule.actions.forEach((action, actionIndex) => {
        console.log(`  Action ${actionIndex}:`, action);
        console.log(`    Properties:`, Object.keys(action).join(', '));
      });
    } else {
      console.log('Actions is NOT an array:', typeof rule.actions);
    }
    
    console.log('---\n');
  });
  
  // Test rule processing with a fake transaction
  console.log('Testing rule processing...');
  const testTransaction = {
    id: 'test-123',
    description: 'Test grocery store',
    category: 'Uncategorized',
    amount: -50
  };
  
  // Get the rule engine
  const { ruleEngine } = await import('./modules/ruleEngine.js');
  
  // Process with each rule
  for (const rule of rules) {
    console.log(`\nTesting rule "${rule.name}"...`);
    const result = await ruleEngine.process(testTransaction, [rule]);
    console.log('Result:', result);
    
    if (result.matched) {
      console.log('Actions returned:', result.actions);
      console.log('First action structure:', result.actions?.[0]);
    }
  }
}

// Run it
debugRuleStructure();