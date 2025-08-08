/**
 * Data indexing module for O(1) lookups and efficient data access
 */

import { debug } from './debug.js';

/**
 * Creates indexed data structures for fast lookups
 */
export class DataIndex {
  constructor() {
    this.indexes = {
      cashAccountsById: new Map(),
      investmentAccountsById: new Map(),
      debtAccountsById: new Map(),
      transactionsByAccount: new Map(),
      transactionsByDate: new Map(),
      transactionsByCategory: new Map(),
      transactionsByMerchant: new Map(),
      recurringBillsById: new Map(),
      savingsGoalsById: new Map(),
      holdingsByAccount: new Map(),
    };

    this.stats = {
      lastIndexTime: 0,
      indexCount: 0,
    };
  }

  /**
   * Rebuild all indexes from app data
   * @param {Object} appData - The application data object
   */
  rebuildIndexes(appData) {
    const startTime = performance.now();

    // Clear all indexes
    this.clearIndexes();

    // Index cash accounts
    if (appData.cashAccounts) {
      appData.cashAccounts.forEach(account => {
        this.indexes.cashAccountsById.set(account.id, account);
      });
    }

    // Index investment accounts
    if (appData.investmentAccounts) {
      appData.investmentAccounts.forEach(account => {
        this.indexes.investmentAccountsById.set(account.id, account);

        // Index holdings by account
        if (account.holdings) {
          this.indexes.holdingsByAccount.set(account.id, account.holdings);
        }
      });
    }

    // Index debt accounts
    if (appData.debtAccounts) {
      appData.debtAccounts.forEach(account => {
        this.indexes.debtAccountsById.set(account.id, account);
      });
    }

    // Index transactions
    if (appData.transactions) {
      appData.transactions.forEach(transaction => {
        // By account (cash accounts)
        const accountId =
          transaction.account_id || transaction.accountId || transaction.cashAccountId;
        if (accountId) {
          if (!this.indexes.transactionsByAccount.has(accountId)) {
            this.indexes.transactionsByAccount.set(accountId, []);
          }
          this.indexes.transactionsByAccount.get(accountId).push(transaction);
        }

        // By debt account (credit cards)
        if (transaction.debt_account_id) {
          if (!this.indexes.transactionsByAccount.has(transaction.debt_account_id)) {
            this.indexes.transactionsByAccount.set(transaction.debt_account_id, []);
          }
          this.indexes.transactionsByAccount.get(transaction.debt_account_id).push(transaction);
        }

        // By date (YYYY-MM-DD)
        const dateKey = transaction.date.split('T')[0];
        if (!this.indexes.transactionsByDate.has(dateKey)) {
          this.indexes.transactionsByDate.set(dateKey, []);
        }
        this.indexes.transactionsByDate.get(dateKey).push(transaction);

        // By category
        if (transaction.category) {
          if (!this.indexes.transactionsByCategory.has(transaction.category)) {
            this.indexes.transactionsByCategory.set(transaction.category, []);
          }
          this.indexes.transactionsByCategory.get(transaction.category).push(transaction);
        }

        // By merchant (extract from description)
        const merchant = this.extractMerchant(transaction.description);
        if (merchant) {
          if (!this.indexes.transactionsByMerchant.has(merchant)) {
            this.indexes.transactionsByMerchant.set(merchant, []);
          }
          this.indexes.transactionsByMerchant.get(merchant).push(transaction);
        }
      });
    }

    // Index recurring bills
    if (appData.recurringBills) {
      appData.recurringBills.forEach(bill => {
        this.indexes.recurringBillsById.set(bill.id, bill);
      });
    }

    // Index savings goals
    if (appData.savingsGoals) {
      appData.savingsGoals.forEach(goal => {
        this.indexes.savingsGoalsById.set(goal.id, goal);
      });
    }

    const endTime = performance.now();
    this.stats.lastIndexTime = endTime - startTime;
    this.stats.indexCount++;

    debug.log(`Indexes rebuilt in ${this.stats.lastIndexTime.toFixed(2)}ms`);
  }

  /**
   * Clear all indexes
   */
  clearIndexes() {
    Object.values(this.indexes).forEach(index => index.clear());
  }

  /**
   * Extract merchant name from transaction description
   * @param {string} description - Transaction description
   * @returns {string|null} Merchant name or null
   */
  extractMerchant(description) {
    if (!description) {
      return null;
    }

    // Common patterns for merchant extraction
    // Remove common prefixes
    let merchant = description
      .replace(/^(purchase|payment|pos|online|recurring|subscription)\s+/i, '')
      .replace(/\s*#\d+\s*$/, '') // Remove trailing numbers
      .replace(/\s*\*+\s*$/, '') // Remove trailing asterisks
      .trim();

    // Extract first meaningful part (usually merchant name)
    const parts = merchant.split(/\s{2,}|\s+at\s+|\s+-\s+/);
    if (parts.length > 0) {
      merchant = parts[0].trim();
    }

    // Normalize
    return merchant.length > 2 ? merchant.toUpperCase() : null;
  }

  // Fast lookup methods

  /**
   * Get account by ID (O(1))
   * @param {number} id - Account ID
   * @param {string} type - Account type (cash, investment, debt)
   * @returns {Object|null} Account object or null
   */
  getAccountById(id, type = 'cash') {
    switch (type) {
      case 'cash':
        return this.indexes.cashAccountsById.get(id) || null;
      case 'investment':
        return this.indexes.investmentAccountsById.get(id) || null;
      case 'debt':
        return this.indexes.debtAccountsById.get(id) || null;
      default:
        return null;
    }
  }

  /**
   * Get transactions by account ID (O(1))
   * @param {number} accountId - Account ID
   * @returns {Array} Array of transactions
   */
  getTransactionsByAccount(accountId) {
    return this.indexes.transactionsByAccount.get(accountId) || [];
  }

  /**
   * Get transactions by date (O(1))
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Array} Array of transactions
   */
  getTransactionsByDate(date) {
    return this.indexes.transactionsByDate.get(date) || [];
  }

  /**
   * Get transactions by category (O(1))
   * @param {string} category - Category name
   * @returns {Array} Array of transactions
   */
  getTransactionsByCategory(category) {
    return this.indexes.transactionsByCategory.get(category) || [];
  }

  /**
   * Get transactions by merchant (O(1))
   * @param {string} merchant - Merchant name
   * @returns {Array} Array of transactions
   */
  getTransactionsByMerchant(merchant) {
    const normalizedMerchant = merchant.toUpperCase();
    return this.indexes.transactionsByMerchant.get(normalizedMerchant) || [];
  }

  /**
   * Get recurring bill by ID (O(1))
   * @param {number} id - Bill ID
   * @returns {Object|null} Bill object or null
   */
  getRecurringBillById(id) {
    return this.indexes.recurringBillsById.get(id) || null;
  }

  /**
   * Get savings goal by ID (O(1))
   * @param {number} id - Goal ID
   * @returns {Object|null} Goal object or null
   */
  getSavingsGoalById(id) {
    return this.indexes.savingsGoalsById.get(id) || null;
  }

  /**
   * Get holdings by account ID (O(1))
   * @param {number} accountId - Investment account ID
   * @returns {Array} Array of holdings
   */
  getHoldingsByAccount(accountId) {
    return this.indexes.holdingsByAccount.get(accountId) || [];
  }

  /**
   * Get all merchants (O(n) where n is number of unique merchants)
   * @returns {Array} Array of merchant names
   */
  getAllMerchants() {
    return Array.from(this.indexes.transactionsByMerchant.keys()).sort();
  }

  /**
   * Get all categories (O(n) where n is number of unique categories)
   * @returns {Array} Array of category names
   */
  getAllCategories() {
    return Array.from(this.indexes.transactionsByCategory.keys()).sort();
  }

  /**
   * Get transactions in date range (O(d) where d is days in range)
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Array of transactions
   */
  getTransactionsInDateRange(startDate, endDate) {
    const transactions = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0];
      const dayTransactions = this.indexes.transactionsByDate.get(dateKey);
      if (dayTransactions) {
        transactions.push(...dayTransactions);
      }
      current.setDate(current.getDate() + 1);
    }

    return transactions;
  }

  /**
   * Incremental updates for transactions to keep indexes fresh
   */
  addTransaction(transaction) {
    try {
      // Account index (cash)
      if (transaction.account_id) {
        if (!this.indexes.transactionsByAccount.has(transaction.account_id)) {
          this.indexes.transactionsByAccount.set(transaction.account_id, []);
        }
        this.indexes.transactionsByAccount.get(transaction.account_id).unshift(transaction);
      }
      // Account index (debt)
      if (transaction.debt_account_id) {
        if (!this.indexes.transactionsByAccount.has(transaction.debt_account_id)) {
          this.indexes.transactionsByAccount.set(transaction.debt_account_id, []);
        }
        this.indexes.transactionsByAccount.get(transaction.debt_account_id).unshift(transaction);
      }
      // Date index
      const dateKey = transaction.date.split('T')[0];
      if (!this.indexes.transactionsByDate.has(dateKey)) {
        this.indexes.transactionsByDate.set(dateKey, []);
      }
      this.indexes.transactionsByDate.get(dateKey).unshift(transaction);
      // Category index
      if (transaction.category) {
        if (!this.indexes.transactionsByCategory.has(transaction.category)) {
          this.indexes.transactionsByCategory.set(transaction.category, []);
        }
        this.indexes.transactionsByCategory.get(transaction.category).unshift(transaction);
      }
      // Merchant index
      const merchant = this.extractMerchant(transaction.description);
      if (merchant) {
        if (!this.indexes.transactionsByMerchant.has(merchant)) {
          this.indexes.transactionsByMerchant.set(merchant, []);
        }
        this.indexes.transactionsByMerchant.get(merchant).unshift(transaction);
      }
    } catch (e) {
      debug.warn('DataIndex.addTransaction failed, consider rebuildIndexes()', e);
    }
  }

  updateTransaction(id, updatedTransaction) {
    try {
      // Remove then re-add to keep ordering simple
      this.removeTransaction(id);
      this.addTransaction(updatedTransaction);
    } catch (e) {
      debug.warn('DataIndex.updateTransaction failed, consider rebuildIndexes()', e);
    }
  }

  removeTransaction(id) {
    try {
      // Remove from account-based indexes
      for (const [key, arr] of this.indexes.transactionsByAccount) {
        const idx = arr.findIndex(t => t.id === id);
        if (idx !== -1) arr.splice(idx, 1);
      }
      // Remove from date index
      for (const [key, arr] of this.indexes.transactionsByDate) {
        const idx = arr.findIndex(t => t.id === id);
        if (idx !== -1) arr.splice(idx, 1);
      }
      // Remove from category index
      for (const [key, arr] of this.indexes.transactionsByCategory) {
        const idx = arr.findIndex(t => t.id === id);
        if (idx !== -1) arr.splice(idx, 1);
      }
      // Remove from merchant index
      for (const [key, arr] of this.indexes.transactionsByMerchant) {
        const idx = arr.findIndex(t => t.id === id);
        if (idx !== -1) arr.splice(idx, 1);
      }
    } catch (e) {
      debug.warn('DataIndex.removeTransaction failed, consider rebuildIndexes()', e);
    }
  }

  /**
   * Get index statistics
   * @returns {Object} Index statistics
   */
  getStats() {
    return {
      ...this.stats,
      indexSizes: {
        cashAccounts: this.indexes.cashAccountsById.size,
        investmentAccounts: this.indexes.investmentAccountsById.size,
        debtAccounts: this.indexes.debtAccountsById.size,
        transactionsByAccount: this.indexes.transactionsByAccount.size,
        transactionsByDate: this.indexes.transactionsByDate.size,
        transactionsByCategory: this.indexes.transactionsByCategory.size,
        transactionsByMerchant: this.indexes.transactionsByMerchant.size,
        recurringBills: this.indexes.recurringBillsById.size,
        savingsGoals: this.indexes.savingsGoalsById.size,
        holdings: this.indexes.holdingsByAccount.size,
      },
    };
  }
}

// Create singleton instance
export const dataIndex = new DataIndex();

/**
 * Initialize data index with app data
 * @param {Object} appData - Application data
 */
export function initializeDataIndex(appData) {
  dataIndex.rebuildIndexes(appData);
}

/**
 * Update specific index when data changes
 * @param {string} type - Type of data changed
 * @param {Object} data - The changed data
 * @param {string} operation - Operation type (add, update, delete)
 */
export function updateIndex(type, data, operation) {
  // This would be called by modules when they modify data
  // For now, we'll rebuild all indexes, but this could be optimized
  // to only update the affected index
  debug.log(`Index update requested for ${type} - ${operation}`);
}
