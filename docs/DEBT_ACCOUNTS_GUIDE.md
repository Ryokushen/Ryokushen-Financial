# Debt Accounts Guide

## How Debt Accounts Work

Debt accounts (credit cards, loans) in Ryokushen Financial work differently from cash accounts to properly track what you owe.

### Key Concepts

1. **Dynamic Balance Calculation**: Like cash accounts, debt account balances are calculated from their transaction history, not stored statically.

2. **Inverted Transaction Logic**:
   - **Purchases/Expenses** (positive transactions) → Increase debt balance
   - **Payments** (negative transactions) → Decrease debt balance

### Transaction Types

#### 1. Credit Card Purchase
When you buy something with a credit card:
- Create an **expense transaction** on the credit card account
- Amount: Positive (e.g., $50.00)
- Effect: Increases the credit card balance by $50

#### 2. Credit Card Payment
When you pay your credit card from checking:
- Create **two transactions**:
  - **From Checking**: Negative amount (e.g., -$500.00)
  - **To Credit Card**: Negative amount (e.g., -$500.00)
- Effect: Decreases both checking balance and credit card debt

### Example Workflow

1. **Initial State**:
   - Checking Account: $5,000
   - Credit Card: $0 debt

2. **Make Purchase** (Coffee for $5):
   - Transaction: +$5.00 on Credit Card
   - New Credit Card Balance: $5.00 debt

3. **Make Another Purchase** (Groceries for $100):
   - Transaction: +$100.00 on Credit Card
   - New Credit Card Balance: $105.00 debt

4. **Pay Credit Card** ($105 from Checking):
   - Transaction 1: -$105.00 from Checking
   - Transaction 2: -$105.00 to Credit Card
   - New Checking Balance: $4,895
   - New Credit Card Balance: $0 debt

### Setting Up Debt Accounts

1. Go to the **Debt** page
2. Click **"Add New Debt Account"**
3. Enter:
   - Account name (e.g., "Chase Sapphire")
   - Type (Credit Card, Loan, etc.)
   - Interest rate
   - Minimum payment
   - Credit limit (for credit cards)
   - Initial balance (if any)

### Best Practices

1. **Track All Purchases**: Enter every transaction made with the credit card
2. **Categorize Properly**: Use appropriate categories (Food, Shopping, etc.)
3. **Regular Payments**: Set up recurring transactions for minimum payments
4. **Monitor Utilization**: Keep track of balance vs. credit limit

### Technical Implementation

The system uses the same transaction-based approach as cash accounts but inverts the logic:

```javascript
// For debt accounts:
// Positive amounts (purchases) increase debt
// Negative amounts (payments) decrease debt
balance = transactions.reduce((sum, transaction) => {
  const amount = transaction.amount || 0
  return sum + Math.abs(amount) * (amount > 0 ? 1 : -1)
}, 0)
```

This ensures that:
- Spending on the card increases what you owe
- Payments to the card decrease what you owe
- The balance always reflects your current debt accurately
