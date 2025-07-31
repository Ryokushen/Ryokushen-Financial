// js/modules/dataIntegrity.js
/**
 * Data Integrity Module
 * Provides utilities to check and maintain data consistency,
 * particularly for orphaned transactions and account references
 */

import { debug } from './debug.js';

/**
 * Find transactions with missing account references
 * @param {Object} appData - Application data containing transactions and accounts
 * @returns {Object} Analysis results with orphaned transactions and statistics
 */
export function findOrphanedTransactions(appData) {
  const orphaned = {
    cashAccountTransactions: [],
    debtAccountTransactions: [],
    noAccountTransactions: [],
    statistics: {
      total: 0,
      orphanedCash: 0,
      orphanedDebt: 0,
      noAccount: 0,
      orphanedAmount: 0,
    },
  };

  // Create lookup sets for efficient checking
  const cashAccountIds = new Set(appData.cashAccounts.map(a => a.id));
  const debtAccountIds = new Set(appData.debtAccounts.map(a => a.id));

  // Check each transaction
  appData.transactions.forEach(transaction => {
    orphaned.statistics.total++;

    if (transaction.account_id && !cashAccountIds.has(transaction.account_id)) {
      // Orphaned cash account transaction
      orphaned.cashAccountTransactions.push({
        ...transaction,
        missingAccountId: transaction.account_id,
        accountType: 'cash',
      });
      orphaned.statistics.orphanedCash++;
      orphaned.statistics.orphanedAmount += Math.abs(transaction.amount);
    } else if (transaction.debt_account_id && !debtAccountIds.has(transaction.debt_account_id)) {
      // Orphaned debt account transaction
      orphaned.debtAccountTransactions.push({
        ...transaction,
        missingAccountId: transaction.debt_account_id,
        accountType: 'debt',
      });
      orphaned.statistics.orphanedDebt++;
      orphaned.statistics.orphanedAmount += Math.abs(transaction.amount);
    } else if (!transaction.account_id && !transaction.debt_account_id) {
      // Transaction with no account reference at all
      orphaned.noAccountTransactions.push(transaction);
      orphaned.statistics.noAccount++;
      orphaned.statistics.orphanedAmount += Math.abs(transaction.amount);
    }
  });

  return orphaned;
}

/**
 * Generate a report of data integrity issues
 * @param {Object} appData - Application data
 * @returns {Object} Detailed integrity report
 */
export function generateIntegrityReport(appData) {
  const report = {
    timestamp: new Date().toISOString(),
    orphanedTransactions: findOrphanedTransactions(appData),
    recommendations: [],
  };

  // Add recommendations based on findings
  const { statistics } = report.orphanedTransactions;

  if (statistics.orphanedCash > 0) {
    report.recommendations.push({
      type: 'orphaned_cash_transactions',
      severity: 'warning',
      message: `Found ${statistics.orphanedCash} transactions referencing deleted cash accounts`,
      action: 'Review and reassign these transactions to existing accounts or delete them',
    });
  }

  if (statistics.orphanedDebt > 0) {
    report.recommendations.push({
      type: 'orphaned_debt_transactions',
      severity: 'warning',
      message: `Found ${statistics.orphanedDebt} transactions referencing deleted credit cards`,
      action: 'Review and reassign these transactions to existing credit cards or delete them',
    });
  }

  if (statistics.noAccount > 0) {
    report.recommendations.push({
      type: 'no_account_transactions',
      severity: 'error',
      message: `Found ${statistics.noAccount} transactions with no account reference`,
      action: 'These transactions must be assigned to an account or deleted',
    });
  }

  if (statistics.orphanedAmount > 0) {
    report.recommendations.push({
      type: 'financial_impact',
      severity: 'info',
      message: `Total amount in orphaned transactions: $${statistics.orphanedAmount.toFixed(2)}`,
      action: 'Resolving these issues will ensure accurate financial reporting',
    });
  }

  return report;
}

/**
 * Log data integrity issues to console
 * @param {Object} appData - Application data
 */
export function logIntegrityIssues(appData) {
  const report = generateIntegrityReport(appData);
  const { statistics } = report.orphanedTransactions;

  if (statistics.orphanedCash > 0 || statistics.orphanedDebt > 0 || statistics.noAccount > 0) {
    debug.warn('Data Integrity Issues Found:', {
      orphanedCashTransactions: statistics.orphanedCash,
      orphanedDebtTransactions: statistics.orphanedDebt,
      noAccountTransactions: statistics.noAccount,
      totalOrphaned: statistics.orphanedCash + statistics.orphanedDebt + statistics.noAccount,
      financialImpact: `$${statistics.orphanedAmount.toFixed(2)}`,
    });

    // Log detailed recommendations
    report.recommendations.forEach(rec => {
      debug.warn(`[${rec.severity.toUpperCase()}] ${rec.type}: ${rec.message}`);
    });
  } else {
    debug.log('Data integrity check passed - no orphaned transactions found');
  }

  return report;
}

/**
 * Suggest account reassignments for orphaned transactions
 * @param {Array} orphanedTransactions - List of orphaned transactions
 * @param {Array} availableAccounts - List of available accounts to reassign to
 * @returns {Array} Suggested reassignments
 */
export function suggestReassignments(orphanedTransactions, availableAccounts) {
  const suggestions = [];

  orphanedTransactions.forEach(transaction => {
    // Try to find accounts with similar names or patterns
    const transactionDesc = transaction.description.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    availableAccounts.forEach(account => {
      const accountName = account.name.toLowerCase();

      // Simple similarity check - could be enhanced with better algorithms
      let score = 0;

      // Check if transaction description contains account name
      if (transactionDesc.includes(accountName)) {
        score += 3;
      }

      // Check if they share common words
      const transWords = transactionDesc.split(/\s+/);
      const accountWords = accountName.split(/\s+/);
      const commonWords = transWords.filter(word =>
        accountWords.some(aWord => aWord.includes(word) || word.includes(aWord))
      );
      score += commonWords.length;

      // Check institution match if available
      if (account.institution && transactionDesc.includes(account.institution.toLowerCase())) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = account;
      }
    });

    suggestions.push({
      transaction,
      suggestedAccount: bestMatch,
      confidence: bestScore > 2 ? 'high' : bestScore > 0 ? 'medium' : 'low',
      score: bestScore,
    });
  });

  return suggestions.sort((a, b) => b.score - a.score);
}

/**
 * Create a cleanup plan for orphaned transactions
 * @param {Object} integrityReport - Report from generateIntegrityReport
 * @returns {Object} Cleanup plan with actions to take
 */
export function createCleanupPlan(integrityReport) {
  const plan = {
    actions: [],
    estimatedImpact: {
      transactionsToReview: 0,
      transactionsToDelete: 0,
      transactionsToReassign: 0,
    },
  };

  const { orphanedTransactions } = integrityReport;

  // Plan for cash account orphans
  if (orphanedTransactions.cashAccountTransactions.length > 0) {
    plan.actions.push({
      type: 'review_cash_orphans',
      transactions: orphanedTransactions.cashAccountTransactions,
      recommendation:
        'Review each transaction and either reassign to an existing account or delete',
    });
    plan.estimatedImpact.transactionsToReview +=
      orphanedTransactions.cashAccountTransactions.length;
  }

  // Plan for debt account orphans
  if (orphanedTransactions.debtAccountTransactions.length > 0) {
    plan.actions.push({
      type: 'review_debt_orphans',
      transactions: orphanedTransactions.debtAccountTransactions,
      recommendation: 'Review each credit card transaction and either reassign or delete',
    });
    plan.estimatedImpact.transactionsToReview +=
      orphanedTransactions.debtAccountTransactions.length;
  }

  // Plan for no-account transactions
  if (orphanedTransactions.noAccountTransactions.length > 0) {
    plan.actions.push({
      type: 'fix_no_account',
      transactions: orphanedTransactions.noAccountTransactions,
      recommendation:
        'These transactions must be assigned to an account to maintain data integrity',
    });
    plan.estimatedImpact.transactionsToReassign +=
      orphanedTransactions.noAccountTransactions.length;
  }

  return plan;
}
