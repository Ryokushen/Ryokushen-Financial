// Test script to verify transfer functionality
console.log('Testing transfer functionality...')

// This script can be run in the browser console to test the transfer feature
// 1. Open the app in browser
// 2. Add a transaction
// 3. Select "Transfer" as type
// 4. Verify that:
//    - "To Account" field appears
//    - Category field is hidden
//    - Can select different accounts
//    - Cannot select same account for both fields
//    - Transfer creates two transactions

console.log(`
To test the transfer functionality:

1. Create at least 2 accounts (e.g., Checking and Savings)
2. Add a new transaction
3. Select "Transfer" as the type
4. Verify:
   - "To Account" field appears
   - Category field disappears
   - You can select source and destination accounts
   - Submitting creates two linked transactions

Test scenarios:
- Cash to Cash transfer
- Cash to Debt transfer (e.g., paying credit card from checking)
- Debt to Cash transfer (e.g., cash advance from credit card)
- Debt to Debt transfer (e.g., balance transfer between credit cards)
`)