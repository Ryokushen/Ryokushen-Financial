// Process uncategorized transactions with Smart Rules
async function processUncategorized() {
  // Check for uncategorized transactions
  const transactions = window.transactionManager.getAllTransactions();
  const uncategorized = transactions.filter(t => !t.category || t.category === '' || t.category === 'Uncategorized');

  console.log(`Found ${uncategorized.length} uncategorized transactions`);

  // Show first 5 uncategorized transactions
  console.log('\nFirst 5 uncategorized transactions:');
  uncategorized.slice(0, 5).forEach(t => {
    console.log(`- "${t.description}" on ${t.date} for $${Math.abs(t.amount)}`);
  });

  // Process them with Smart Rules
  if (uncategorized.length > 0) {
    console.log('\nProcessing with Smart Rules...');
    let matched = 0;
    
    for (const transaction of uncategorized) {
      const result = await window.smartRules.processTransaction(transaction, true, true);
      if (result && result.matched) {
        matched++;
        console.log(`✅ Matched: "${transaction.description}" → ${result.actions[0].value}`);
      }
    }
    
    console.log(`\nProcessed ${uncategorized.length} transactions, matched ${matched}`);
    
    // Refresh the UI
    window.dispatchEvent(new Event('transaction:updated'));
  }
}

// Auto-run
processUncategorized();