/**
 * Test Data Generator for Performance Optimization Testing
 * Generates various sized datasets for comprehensive testing
 */

class TestDataGenerator {
  constructor() {
    this.categories = [
      'Income',
      'Food',
      'Transportation',
      'Housing',
      'Utilities',
      'Entertainment',
      'Healthcare',
      'Debt',
      'Savings',
      'Shopping',
    ];
    this.merchants = [
      'Amazon',
      'Walmart',
      'Target',
      'Starbucks',
      'McDonalds',
      'Shell',
      'Costco',
      'Home Depot',
      'Best Buy',
      'Kroger',
    ];
    this.accountTypes = ['Checking', 'Savings', 'Credit Card', 'Investment'];
    this.debtTypes = ['Credit Card', 'Auto Loan', 'Mortgage', 'Student Loan', 'Personal Loan'];
  }

  /**
   * Generate test data sets of different sizes
   * @param {string} size - 'small' (100), 'medium' (1000), 'large' (10000)
   * @returns {Object} Complete test dataset
   */
  generateDataSet(size = 'medium') {
    const counts = {
      small: { transactions: 100, accounts: 5, debts: 3, bills: 5, goals: 3 },
      medium: { transactions: 1000, accounts: 10, debts: 5, bills: 10, goals: 5 },
      large: { transactions: 10000, accounts: 20, debts: 10, bills: 20, goals: 10 },
    };

    const config = counts[size] || counts.medium;

    return {
      cashAccounts: this.generateCashAccounts(config.accounts),
      debtAccounts: this.generateDebtAccounts(config.debts),
      transactions: this.generateTransactions(config.transactions, config.accounts),
      recurringBills: this.generateRecurringBills(config.bills),
      savingsGoals: this.generateSavingsGoals(config.goals),
      investmentAccounts: this.generateInvestmentAccounts(3),
    };
  }

  generateCashAccounts(count) {
    const accounts = [];
    for (let i = 1; i <= count; i++) {
      accounts.push({
        id: i,
        name: `${this.accountTypes[i % this.accountTypes.length]} Account ${i}`,
        type: this.accountTypes[i % this.accountTypes.length],
        institution: `Bank ${i}`,
        balance: this.randomFloat(100, 50000),
        isActive: true,
        is_active: true,
        notes: `Test account ${i} for performance testing`,
      });
    }
    return accounts;
  }

  generateDebtAccounts(count) {
    const accounts = [];
    for (let i = 1; i <= count; i++) {
      const creditLimit = this.randomFloat(1000, 25000);
      const balance = this.randomFloat(0, creditLimit * 0.8);

      accounts.push({
        id: i,
        name: `${this.debtTypes[i % this.debtTypes.length]} ${i}`,
        type: this.debtTypes[i % this.debtTypes.length],
        balance,
        credit_limit: creditLimit,
        creditLimit,
        interest_rate: this.randomFloat(5.99, 29.99),
        interestRate: this.randomFloat(5.99, 29.99),
        minimum_payment: Math.max(25, balance * 0.02),
        minimumPayment: Math.max(25, balance * 0.02),
        due_date: this.randomDate(1, 28),
        dueDate: this.randomDate(1, 28),
      });
    }
    return accounts;
  }

  generateTransactions(count, accountCount) {
    const transactions = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12); // 12 months ago

    for (let i = 1; i <= count; i++) {
      const date = new Date(
        startDate.getTime() + Math.random() * (Date.now() - startDate.getTime())
      );
      const category = this.categories[Math.floor(Math.random() * this.categories.length)];
      const merchant = this.merchants[Math.floor(Math.random() * this.merchants.length)];
      const isDebt = category === 'Debt';

      const transaction = {
        id: i,
        date: date.toISOString().split('T')[0],
        category,
        description: `${merchant} - Test Transaction ${i}`,
        amount: isDebt ? -this.randomFloat(25, 500) : this.randomFloat(-200, 1000),
        cleared: Math.random() > 0.2, // 80% cleared
        account_id: isDebt ? null : Math.floor(Math.random() * accountCount) + 1,
        debt_account_id: isDebt ? Math.floor(Math.random() * 3) + 1 : null,
      };

      transactions.push(transaction);
    }

    // Sort by date (newest first)
    return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  generateRecurringBills(count) {
    const bills = [];
    const frequencies = ['monthly', 'weekly', 'quarterly', 'annually'];

    for (let i = 1; i <= count; i++) {
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + Math.floor(Math.random() * 30));

      bills.push({
        id: i,
        name: `Recurring Bill ${i}`,
        amount: this.randomFloat(25, 500),
        frequency: frequencies[Math.floor(Math.random() * frequencies.length)],
        next_due: nextDue.toISOString().split('T')[0],
        nextDue: nextDue.toISOString().split('T')[0],
        active: Math.random() > 0.1, // 90% active
        payment_method: Math.random() > 0.5 ? 'cash' : 'credit',
        paymentMethod: Math.random() > 0.5 ? 'cash' : 'credit',
        account_id: Math.floor(Math.random() * 5) + 1,
        debt_account_id: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : null,
      });
    }
    return bills;
  }

  generateSavingsGoals(count) {
    const goals = [];

    for (let i = 1; i <= count; i++) {
      const targetAmount = this.randomFloat(1000, 50000);
      const currentAmount = this.randomFloat(0, targetAmount * 0.8);
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + Math.floor(Math.random() * 24) + 1);

      goals.push({
        id: i,
        name: `Savings Goal ${i}`,
        target_amount: targetAmount,
        targetAmount,
        current_amount: currentAmount,
        currentAmount,
        target_date: targetDate.toISOString().split('T')[0],
        targetDate: targetDate.toISOString().split('T')[0],
        linked_account_id: Math.floor(Math.random() * 5) + 1,
        linkedAccountId: Math.floor(Math.random() * 5) + 1,
        created_date: new Date().toISOString().split('T')[0],
        createdDate: new Date().toISOString().split('T')[0],
        completed_date:
          currentAmount >= targetAmount ? new Date().toISOString().split('T')[0] : null,
        completedDate:
          currentAmount >= targetAmount ? new Date().toISOString().split('T')[0] : null,
      });
    }
    return goals;
  }

  generateInvestmentAccounts(count) {
    const accounts = [];

    for (let i = 1; i <= count; i++) {
      const holdings = this.generateHoldings(Math.floor(Math.random() * 10) + 5);
      const totalValue = holdings.reduce((sum, holding) => sum + holding.shares * holding.price, 0);

      accounts.push({
        id: i,
        name: `Investment Account ${i}`,
        institution: `Broker ${i}`,
        accountNumber: `INV${i.toString().padStart(6, '0')}`,
        totalValue,
        holdings,
        isActive: true,
      });
    }
    return accounts;
  }

  generateHoldings(count) {
    const symbols = [
      'AAPL',
      'GOOGL',
      'MSFT',
      'AMZN',
      'TSLA',
      'NVDA',
      'META',
      'NFLX',
      'AMD',
      'INTC',
    ];
    const holdings = [];

    for (let i = 0; i < count; i++) {
      const symbol = symbols[i % symbols.length];
      holdings.push({
        symbol,
        shares: this.randomFloat(1, 100),
        price: this.randomFloat(50, 300),
        name: `${symbol} Inc.`,
      });
    }
    return holdings;
  }

  // Utility methods
  randomFloat(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  }

  randomDate(minDay, maxDay) {
    return Math.floor(Math.random() * (maxDay - minDay + 1)) + minDay;
  }

  /**
   * Generate edge case test data for stress testing
   */
  generateEdgeCaseData() {
    return {
      emptyData: {
        cashAccounts: [],
        debtAccounts: [],
        transactions: [],
        recurringBills: [],
        savingsGoals: [],
        investmentAccounts: [],
      },
      malformedData: {
        cashAccounts: [{ id: null, name: '', balance: 'invalid' }],
        transactions: [{ id: 1, amount: null, date: 'invalid-date', category: null }],
        debtAccounts: [{ id: 1, balance: undefined, creditLimit: -1000 }],
      },
      extremeData: this.generateDataSet('large'), // 10k+ records
    };
  }

  /**
   * Generate performance benchmark scenarios
   */
  generateBenchmarkScenarios() {
    return {
      baseline: this.generateDataSet('small'),
      moderate: this.generateDataSet('medium'),
      stress: this.generateDataSet('large'),
      mixed: {
        ...this.generateDataSet('medium'),
        transactions: [
          ...this.generateTransactions(5000, 10), // 5k recent transactions
          ...this.generateTransactions(5000, 10), // 5k older transactions
        ],
      },
    };
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestDataGenerator;
} else {
  window.TestDataGenerator = TestDataGenerator;
}
