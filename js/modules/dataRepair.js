// js/modules/dataRepair.js
import db from '../database.js';
import { showError, showSuccess } from './ui.js';
import { debug } from './debug.js';

/**
 * Data repair utilities for fixing orphaned transactions and other data integrity issues
 */
export const dataRepair = {
  /**
   * Find all transactions with invalid account references
   */
  async findOrphanedTransactions(appData) {
    const orphanedTransactions = [];
    const { cashAccounts, debtAccounts, transactions } = appData;

    // Create sets for O(1) lookup
    const cashAccountIds = new Set(cashAccounts.map(a => a.id));
    const debtAccountIds = new Set(debtAccounts.map(a => a.id));

    for (const transaction of transactions) {
      let isOrphaned = false;
      let reason = '';

      if (transaction.account_id && !cashAccountIds.has(transaction.account_id)) {
        isOrphaned = true;
        reason = `Cash account ${transaction.account_id} not found`;
      } else if (transaction.debt_account_id && !debtAccountIds.has(transaction.debt_account_id)) {
        isOrphaned = true;
        reason = `Debt account ${transaction.debt_account_id} not found`;
      } else if (!transaction.account_id && !transaction.debt_account_id) {
        isOrphaned = true;
        reason = 'No account reference found';
      }

      if (isOrphaned) {
        orphanedTransactions.push({
          transaction,
          reason,
        });
      }
    }

    return orphanedTransactions;
  },

  /**
   * Repair orphaned transactions by assigning them to a default account
   */
  async repairOrphanedTransactions(appData, defaultAccountId = null) {
    try {
      const orphaned = await this.findOrphanedTransactions(appData);
      
      if (orphaned.length === 0) {
        showSuccess('No orphaned transactions found.');
        return { repaired: 0, failed: 0 };
      }

      debug.log(`Found ${orphaned.length} orphaned transactions`);

      // If no default account specified, use the first active cash account
      if (!defaultAccountId && appData.cashAccounts.length > 0) {
        const activeAccount = appData.cashAccounts.find(a => a.isActive) || appData.cashAccounts[0];
        defaultAccountId = activeAccount.id;
      }

      if (!defaultAccountId) {
        showError('No accounts available to repair orphaned transactions.');
        return { repaired: 0, failed: orphaned.length };
      }

      let repaired = 0;
      let failed = 0;

      for (const { transaction, reason } of orphaned) {
        try {
          debug.log(`Repairing transaction ${transaction.id}: ${reason}`);
          
          // Update the transaction to use the default account
          const updates = {
            account_id: defaultAccountId,
            debt_account_id: null, // Clear any invalid debt account reference
          };

          await db.updateTransaction(transaction.id, updates);
          
          // Update local state
          transaction.account_id = defaultAccountId;
          transaction.debt_account_id = null;
          
          repaired++;
        } catch (error) {
          debug.error(`Failed to repair transaction ${transaction.id}:`, error);
          failed++;
        }
      }

      const message = `Repaired ${repaired} orphaned transactions${failed > 0 ? `, ${failed} failed` : ''}`;
      if (repaired > 0) {
        showSuccess(message);
      } else {
        showError(message);
      }

      return { repaired, failed };
    } catch (error) {
      debug.error('Failed to repair orphaned transactions:', error);
      showError('Failed to repair orphaned transactions.');
      throw error;
    }
  },

  /**
   * Delete orphaned transactions that cannot be repaired
   */
  async deleteOrphanedTransactions(appData) {
    try {
      const orphaned = await this.findOrphanedTransactions(appData);
      
      if (orphaned.length === 0) {
        showSuccess('No orphaned transactions found.');
        return { deleted: 0, failed: 0 };
      }

      const confirmDelete = confirm(
        `Found ${orphaned.length} orphaned transactions. Delete them permanently?`
      );
      
      if (!confirmDelete) {
        return { deleted: 0, failed: 0 };
      }

      let deleted = 0;
      let failed = 0;

      for (const { transaction } of orphaned) {
        try {
          await db.deleteTransaction(transaction.id);
          
          // Remove from local state
          const index = appData.transactions.findIndex(t => t.id === transaction.id);
          if (index > -1) {
            appData.transactions.splice(index, 1);
          }
          
          deleted++;
        } catch (error) {
          debug.error(`Failed to delete transaction ${transaction.id}:`, error);
          failed++;
        }
      }

      const message = `Deleted ${deleted} orphaned transactions${failed > 0 ? `, ${failed} failed` : ''}`;
      if (deleted > 0) {
        showSuccess(message);
      } else {
        showError(message);
      }

      return { deleted, failed };
    } catch (error) {
      debug.error('Failed to delete orphaned transactions:', error);
      showError('Failed to delete orphaned transactions.');
      throw error;
    }
  },

  /**
   * Check data integrity and provide a report
   */
  async checkDataIntegrity(appData) {
    const report = {
      orphanedTransactions: [],
      duplicateTransactions: [],
      invalidDates: [],
      negativeBalances: [],
      missingCategories: [],
    };

    // Check for orphaned transactions
    report.orphanedTransactions = await this.findOrphanedTransactions(appData);

    // Check for duplicate transactions (same date, amount, description, and account)
    const transactionMap = new Map();
    for (const transaction of appData.transactions) {
      const key = `${transaction.date}_${transaction.amount}_${transaction.description}_${transaction.account_id || transaction.debt_account_id}`;
      if (transactionMap.has(key)) {
        report.duplicateTransactions.push({
          transaction1: transactionMap.get(key),
          transaction2: transaction,
        });
      } else {
        transactionMap.set(key, transaction);
      }
    }

    // Check for invalid dates
    for (const transaction of appData.transactions) {
      const date = new Date(transaction.date);
      if (isNaN(date.getTime()) || date.getFullYear() < 2000 || date.getFullYear() > 2100) {
        report.invalidDates.push(transaction);
      }
    }

    // Check for negative cash account balances
    for (const account of appData.cashAccounts) {
      if (account.balance < 0) {
        report.negativeBalances.push(account);
      }
    }

    // Check for transactions with missing categories
    for (const transaction of appData.transactions) {
      if (!transaction.category || transaction.category.trim() === '') {
        report.missingCategories.push(transaction);
      }
    }

    return report;
  },

  /**
   * Display data integrity report
   */
  async displayIntegrityReport(appData) {
    const report = await this.checkDataIntegrity(appData);
    
    console.group('Data Integrity Report');
    console.log('Orphaned Transactions:', report.orphanedTransactions.length);
    console.log('Duplicate Transactions:', report.duplicateTransactions.length);
    console.log('Invalid Dates:', report.invalidDates.length);
    console.log('Negative Balances:', report.negativeBalances.length);
    console.log('Missing Categories:', report.missingCategories.length);
    console.groupEnd();

    // Create a detailed report message
    const issues = [];
    if (report.orphanedTransactions.length > 0) {
      issues.push(`${report.orphanedTransactions.length} orphaned transactions`);
    }
    if (report.duplicateTransactions.length > 0) {
      issues.push(`${report.duplicateTransactions.length} duplicate transactions`);
    }
    if (report.invalidDates.length > 0) {
      issues.push(`${report.invalidDates.length} transactions with invalid dates`);
    }
    if (report.negativeBalances.length > 0) {
      issues.push(`${report.negativeBalances.length} accounts with negative balances`);
    }
    if (report.missingCategories.length > 0) {
      issues.push(`${report.missingCategories.length} transactions with missing categories`);
    }

    if (issues.length === 0) {
      showSuccess('Data integrity check passed. No issues found.');
    } else {
      showError(`Data integrity issues found: ${issues.join(', ')}`);
    }

    return report;
  },
};

// Export for use in other modules
export default dataRepair;