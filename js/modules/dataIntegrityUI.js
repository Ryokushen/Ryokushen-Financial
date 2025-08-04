// js/modules/dataIntegrityUI.js
/**
 * Data Integrity UI Module
 * Provides user interface for managing orphaned transactions
 */

import { findOrphanedTransactions, suggestReassignments } from './dataIntegrity.js';
import { formatCurrency, escapeHtml, formatDate } from './utils.js';
import { showError, showSuccess } from './ui.js';
import { transactionManager } from './transactionManager.js';
import { debug } from './debug.js';
import loadingState from './loadingState.js';

/**
 * Show a modal with orphaned transactions and options to fix them
 * @param {Object} appData - Application data
 * @param {Function} onUpdate - Callback to refresh UI after changes
 */
export async function showOrphanedTransactionsModal(appData, onUpdate) {
  const orphanedData = findOrphanedTransactions(appData);
  const { statistics } = orphanedData;

  // Check if there are any orphaned transactions
  const totalOrphaned = statistics.orphanedCash + statistics.orphanedDebt + statistics.noAccount;
  if (totalOrphaned === 0) {
    showSuccess('No orphaned transactions found! Your data integrity is good.');
    return;
  }

  // Create modal HTML
  const modalHtml = `
    <div class="modal-overlay" id="orphaned-transactions-modal">
      <div class="modal-content large">
        <div class="modal-header">
          <h2>Orphaned Transactions Found</h2>
          <button class="close-btn" onclick="document.getElementById('orphaned-transactions-modal').remove()">×</button>
        </div>
        
        <div class="modal-body">
          <div class="alert alert-warning">
            <h3>Data Integrity Issues</h3>
            <p>Found ${totalOrphaned} transactions referencing deleted or missing accounts.</p>
            <ul>
              ${statistics.orphanedCash > 0 ? `<li>${statistics.orphanedCash} transactions with deleted cash accounts</li>` : ''}
              ${statistics.orphanedDebt > 0 ? `<li>${statistics.orphanedDebt} transactions with deleted credit cards</li>` : ''}
              ${statistics.noAccount > 0 ? `<li>${statistics.noAccount} transactions with no account reference</li>` : ''}
            </ul>
            <p>Total amount affected: <strong>${formatCurrency(statistics.orphanedAmount)}</strong></p>
          </div>
          
          <div class="orphaned-transactions-container">
            ${renderOrphanedTransactionsList(orphanedData, appData)}
          </div>
          
          <div class="modal-actions">
            <button class="btn btn-secondary" onclick="document.getElementById('orphaned-transactions-modal').remove()">
              Cancel
            </button>
            <button class="btn btn-danger" onclick="window.dataIntegrityUI.deleteAllOrphaned()">
              Delete All Orphaned
            </button>
            <button class="btn btn-primary" onclick="window.dataIntegrityUI.reassignSelected()">
              Reassign Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Store references for action handlers
  window.dataIntegrityUI = {
    orphanedData,
    appData,
    onUpdate,
    deleteAllOrphaned: () => deleteAllOrphanedTransactions(orphanedData, onUpdate),
    reassignSelected: () => reassignSelectedTransactions(appData, onUpdate),
  };
}

/**
 * Render the list of orphaned transactions
 */
function renderOrphanedTransactionsList(orphanedData, appData) {
  const allOrphaned = [
    ...orphanedData.cashAccountTransactions,
    ...orphanedData.debtAccountTransactions,
    ...orphanedData.noAccountTransactions,
  ];

  if (allOrphaned.length === 0) {
    return '<p>No orphaned transactions to display.</p>';
  }

  // Get suggestions for reassignment
  const cashAccounts = appData.cashAccounts.filter(a => a.isActive !== false);
  const suggestions = suggestReassignments(allOrphaned, cashAccounts);

  return `
    <table class="orphaned-transactions-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all-orphaned" onchange="window.dataIntegrityUI.toggleSelectAll(this)"></th>
          <th>Date</th>
          <th>Description</th>
          <th>Amount</th>
          <th>Category</th>
          <th>Missing Account</th>
          <th>Suggested Account</th>
        </tr>
      </thead>
      <tbody>
        ${suggestions
          .map((item, index) => {
            const t = item.transaction;
            const missingId = t.missingAccountId || 'No Account';
            const suggestedAccount = item.suggestedAccount;

            return `
            <tr data-transaction-id="${t.id}" data-index="${index}">
              <td><input type="checkbox" class="orphaned-checkbox" value="${t.id}"></td>
              <td>${formatDate(t.date)}</td>
              <td>${escapeHtml(t.description)}</td>
              <td class="${t.amount >= 0 ? 'positive' : 'negative'}">
                ${formatCurrency(t.amount)}
              </td>
              <td>${escapeHtml(t.category)}</td>
              <td class="missing-account">
                ${missingId.substring(0, 8)}...
              </td>
              <td>
                <select class="reassign-account" data-transaction-id="${t.id}">
                  <option value="">-- Select Account --</option>
                  ${cashAccounts
                    .map(
                      acc => `
                    <option value="${acc.id}" ${suggestedAccount?.id === acc.id ? 'selected' : ''}>
                      ${escapeHtml(acc.name)} ${item.confidence === 'high' && suggestedAccount?.id === acc.id ? '(Suggested)' : ''}
                    </option>
                  `
                    )
                    .join('')}
                </select>
              </td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

/**
 * Toggle select all checkboxes
 */
window.dataIntegrityUI = window.dataIntegrityUI || {};
window.dataIntegrityUI.toggleSelectAll = function (checkbox) {
  const checkboxes = document.querySelectorAll('.orphaned-checkbox');
  checkboxes.forEach(cb => (cb.checked = checkbox.checked));
};

/**
 * Delete all orphaned transactions
 */
async function deleteAllOrphanedTransactions(orphanedData, onUpdate) {
  const confirmed = confirm(
    `Are you sure you want to delete ALL ${orphanedData.statistics.orphanedCash + orphanedData.statistics.orphanedDebt + orphanedData.statistics.noAccount} orphaned transactions?\n\n` +
      `Total amount: ${formatCurrency(orphanedData.statistics.orphanedAmount)}\n\n` +
      'This action cannot be undone.'
  );

  if (!confirmed) {
    return;
  }

  // Show operation lock for potentially long operation
  loadingState.showOperationLock('Deleting orphaned transactions...');

  try {
    const allOrphaned = [
      ...orphanedData.cashAccountTransactions,
      ...orphanedData.debtAccountTransactions,
      ...orphanedData.noAccountTransactions,
    ];

    const transactionIds = allOrphaned.map(t => t.id);

    // Delete using transaction manager
    await transactionManager.deleteTransactions(transactionIds);

    loadingState.hideOperationLock();
    showSuccess(`Successfully deleted ${transactionIds.length} orphaned transactions`);
    document.getElementById('orphaned-transactions-modal').remove();

    // Refresh the UI
    if (onUpdate) {
      await onUpdate();
    }
  } catch (error) {
    loadingState.hideOperationLock();
    debug.error('Error deleting orphaned transactions:', error);
    showError('Failed to delete orphaned transactions. Please try again.');
  }
}

/**
 * Reassign selected transactions to new accounts
 */
async function reassignSelectedTransactions(appData, onUpdate) {
  const selected = document.querySelectorAll('.orphaned-checkbox:checked');
  if (selected.length === 0) {
    showError('Please select transactions to reassign');
    return;
  }

  const reassignments = [];
  let hasErrors = false;

  selected.forEach(checkbox => {
    const transactionId = checkbox.value;
    const row = checkbox.closest('tr');
    const accountSelect = row.querySelector('.reassign-account');
    const newAccountId = accountSelect.value;

    if (!newAccountId) {
      showError(
        `Please select an account for transaction: ${row.querySelector('td:nth-child(3)').textContent}`
      );
      hasErrors = true;
      return;
    }

    reassignments.push({
      transactionId,
      newAccountId,
    });
  });

  if (hasErrors) {
    return;
  }

  const confirmed = confirm(`Reassign ${reassignments.length} transactions to new accounts?`);
  if (!confirmed) {
    return;
  }

  // Show operation lock for potentially long operation
  loadingState.showOperationLock('Reassigning transactions...');

  try {
    // Update each transaction
    for (const { transactionId, newAccountId } of reassignments) {
      const transaction = appData.transactions.find(t => t.id === transactionId);
      if (transaction) {
        await transactionManager.updateTransaction(transactionId, {
          ...transaction,
          account_id: newAccountId,
          debt_account_id: null, // Clear debt account if reassigning to cash account
        });
      }
    }

    loadingState.hideOperationLock();
    showSuccess(`Successfully reassigned ${reassignments.length} transactions`);
    document.getElementById('orphaned-transactions-modal').remove();

    // Refresh the UI
    if (onUpdate) {
      await onUpdate();
    }
  } catch (error) {
    loadingState.hideOperationLock();
    debug.error('Error reassigning transactions:', error);
    showError('Failed to reassign transactions. Please try again.');
  }
}

/**
 * Add menu item to check data integrity
 */
export function addDataIntegrityMenuItem() {
  // Find the settings or tools menu
  const settingsMenu = document.querySelector('.settings-menu, .tools-menu');
  if (settingsMenu) {
    const menuItem = document.createElement('button');
    menuItem.className = 'menu-item';
    menuItem.textContent = 'Check Data Integrity';
    menuItem.onclick = () => {
      const appData = window.appState?.appData;
      const onUpdate = window.updateAllUI;
      if (appData && onUpdate) {
        showOrphanedTransactionsModal(appData, onUpdate);
      } else {
        showError('Unable to check data integrity. Please refresh the page.');
      }
    };
    settingsMenu.appendChild(menuItem);
  }
}
