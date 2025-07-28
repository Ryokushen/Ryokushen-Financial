// Create a comprehensive grocery rule
async function createGroceryRule() {
  console.log('Creating grocery categorization rule...');
  
  const groceryRule = {
    name: 'Grocery Stores',
    description: 'Categorize common grocery stores and supermarkets',
    enabled: true,
    priority: 95,
    conditions: {
      type: 'OR',
      items: [
        { field: 'description', operator: 'contains', value: 'grocery' },
        { field: 'description', operator: 'contains', value: 'supermarket' },
        { field: 'description', operator: 'contains', value: 'market' },
        { field: 'description', operator: 'contains', value: 'whole foods' },
        { field: 'description', operator: 'contains', value: 'trader joe' },
        { field: 'description', operator: 'contains', value: 'safeway' },
        { field: 'description', operator: 'contains', value: 'kroger' },
        { field: 'description', operator: 'contains', value: 'walmart' },
        { field: 'description', operator: 'contains', value: 'target' },
        { field: 'description', operator: 'contains', value: 'costco' },
        { field: 'description', operator: 'contains', value: 'aldi' },
        { field: 'description', operator: 'contains', value: 'publix' }
      ]
    },
    actions: [{
      type: 'set_category',
      value: 'Groceries'
    }]
  };
  
  const result = await window.smartRules.createRule(groceryRule);
  
  if (result.error) {
    console.error('Failed to create rule:', result.error);
  } else {
    console.log('✅ Grocery rule created successfully!');
    // Reload rules
    await window.smartRules.loadRules();
    window.smartRules.debugListRules();
  }
}

// Create uncategorized rule
async function createUncategorizedRule() {
  console.log('Creating rule for uncategorized transactions...');
  
  const uncategorizedRule = {
    name: 'Process Uncategorized',
    description: 'Default rule for transactions without category',
    enabled: true,
    priority: 1, // Low priority - only if no other rules match
    conditions: {
      type: 'OR',
      items: [
        { field: 'category', operator: 'equals', value: '' },
        { field: 'category', operator: 'equals', value: 'Uncategorized' }
      ]
    },
    actions: [{
      type: 'set_category',
      value: 'Misc'
    }]
  };
  
  const result = await window.smartRules.createRule(uncategorizedRule);
  
  if (result.error) {
    console.error('Failed to create rule:', result.error);
  } else {
    console.log('✅ Uncategorized rule created successfully!');
  }
}

// Test the rules immediately
async function testRules() {
  console.log('🧪 Testing Smart Rules with various transactions...\n');
  
  const testTransactions = [
    { description: 'Whole Foods Market', category: '' },
    { description: 'WALMART SUPERCENTER', category: '' },
    { description: 'Test grocery store', category: '' },
    { description: 'Random transaction', category: '' }
  ];
  
  for (const test of testTransactions) {
    const transaction = {
      id: 'test-' + Date.now() + Math.random(),
      ...test,
      amount: -50,
      date: new Date().toISOString()
    };
    
    console.log(`Testing: "${transaction.description}"`);
    const result = await window.smartRules.processTransaction(transaction, false, true);
    
    if (result && result.matched) {
      console.log(`  ✅ Matched rule: "${result.rule.name}" → Category: "${result.actions[0].value}"`);
    } else {
      console.log(`  ❌ No match`);
    }
  }
}

console.log(`
📝 To create rules, run:
- createGroceryRule()       - Creates a rule for grocery stores
- createUncategorizedRule() - Creates a fallback rule for uncategorized items
- testRules()              - Test rules with sample transactions

🚀 Quick start: Run createGroceryRule() then testRules()
`);