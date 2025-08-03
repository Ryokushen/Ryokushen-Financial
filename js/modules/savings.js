// js/modules/savings.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatDate, formatCurrency } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import { debug } from './debug.js';
import {
  subtractMoney,
  addMoney,
  moneyGreaterThan,
  moneyLessThan,
  moneyEquals,
} from './financialMath.js';
import {
  validateForm,
  ValidationSchemas,
  showFieldError,
  clearFormErrors,
  ValidationRules,
  CrossFieldValidators,
  validateFormWithCrossFields,
} from './validation.js';
import { eventManager } from './eventManager.js';
import { transactionManager } from './transactionManager.js';

function mapSavingsGoal(goal) {
  return {
    ...goal,
    targetAmount: parseFloat(goal.target_amount),
    currentAmount: parseFloat(goal.current_amount),
    linkedAccountId: goal.linked_account_id,
    targetDate: goal.target_date,
    createdDate: goal.created_date,
    completedDate: goal.completed_date,
  };
}

export function setupEventListeners(appState, onUpdate) {
  // Cache DOM elements
  const addGoalBtn = document.getElementById('add-goal-btn');
  const closeGoalModalBtn = document.getElementById('close-goal-modal');
  const cancelGoalBtn = document.getElementById('cancel-goal-btn');
  const goalForm = document.getElementById('goal-form');
  const closeContributionModalBtn = document.getElementById('close-contribution-modal');
  const cancelContributionBtn = document.getElementById('cancel-contribution-btn');
  const contributionForm = document.getElementById('contribution-form');
  const savingsGoalsList = document.getElementById('savings-goals-list');

  if (addGoalBtn) {
    eventManager.addEventListener(addGoalBtn, 'click', () => openGoalModal(appState.appData));
  }
  if (closeGoalModalBtn) {
    eventManager.addEventListener(closeGoalModalBtn, 'click', () => closeModal('goal-modal'));
  }
  if (cancelGoalBtn) {
    eventManager.addEventListener(cancelGoalBtn, 'click', () => closeModal('goal-modal'));
  }
  if (goalForm) {
    eventManager.addEventListener(goalForm, 'submit', e => handleGoalSubmit(e, appState, onUpdate));
  }

  if (closeContributionModalBtn) {
    eventManager.addEventListener(closeContributionModalBtn, 'click', () =>
      closeModal('contribution-modal')
    );
  }
  if (cancelContributionBtn) {
    eventManager.addEventListener(cancelContributionBtn, 'click', () =>
      closeModal('contribution-modal')
    );
  }
  if (contributionForm) {
    eventManager.addEventListener(contributionForm, 'submit', e =>
      handleContributionSubmit(e, appState, onUpdate)
    );
  }

  if (savingsGoalsList) {
    eventManager.addEventListener(savingsGoalsList, 'click', event => {
      const target = event.target;
      const card = target.closest('.goal-card');
      if (!card) {
        return;
      }

      const goalId = parseInt(card.getAttribute('data-id'));
      if (target.classList.contains('btn-edit-goal')) {
        openGoalModal(appState.appData, goalId);
      }
      if (target.classList.contains('btn-delete-goal')) {
        deleteSavingsGoal(goalId, appState, onUpdate);
      }
      if (target.classList.contains('btn-contribute')) {
        openContributionModal(appState.appData, goalId);
      }
    });
  }
}

function openGoalModal(appData, goalId = null) {
  populateGoalAccountDropdown(appData);
  const form = document.getElementById('goal-form');
  const title = document.getElementById('goal-modal-title');

  // Always reset form first
  form.reset();
  document.getElementById('goal-id').value = '';

  if (goalId) {
    const goal = appData.savingsGoals.find(g => g.id === goalId);
    if (goal) {
      title.textContent = 'Edit Savings Goal';
      // Populate form fields
      document.getElementById('goal-id').value = goal.id;
      document.getElementById('goal-name').value = goal.name;
      document.getElementById('goal-target').value = goal.targetAmount;
      document.getElementById('goal-account').value = goal.linkedAccountId;
      // Current amount is now automatically tracked from linked account
      document.getElementById('goal-current').value = 0;
      document.getElementById('goal-target-date').value = goal.targetDate || '';
      document.getElementById('goal-description').value = goal.description || '';

      openModal('goal-modal', { goalId, isEdit: true });
    }
  } else {
    title.textContent = 'Add New Savings Goal';
    openModal('goal-modal', { isEdit: false });
  }
}

async function handleGoalSubmit(event, appState, onUpdate) {
  event.preventDefault();

  // Clear previous errors
  clearFormErrors('goal-form');

  try {
    const goalId = document.getElementById('goal-id').value;
    const linkedAccountId = parseInt(document.getElementById('goal-account').value);

    const goalData = {
      name: document.getElementById('goal-name').value,
      targetAmount: safeParseFloat(document.getElementById('goal-target').value),
      linkedAccountId,
      // Current amount is automatically tracked from linked account
      currentAmount: 0,
      target_date: document.getElementById('goal-target-date').value || null,
      description: document.getElementById('goal-description').value,
    };

    // Validate form data with cross-field validation
    const { errors, hasErrors } = validateFormWithCrossFields(
      goalData,
      ValidationSchemas.savingsGoal,
      CrossFieldValidators.savingsGoal
    );

    if (hasErrors) {
      // Show field-level errors
      Object.entries(errors).forEach(([field, error]) => {
        const fieldId =
          field === 'targetAmount'
            ? 'goal-target'
            : field === 'linkedAccountId'
              ? 'goal-account'
              : field === 'currentAmount'
                ? 'goal-current'
                : field === 'target_date'
                  ? 'goal-target-date'
                  : `goal-${field}`;
        showFieldError(fieldId, error);
      });
      showError('Please correct the errors in the form.');
      return;
    }

    // Convert back to snake_case for database
    const dbGoalData = {
      name: goalData.name,
      target_amount: goalData.targetAmount,
      linked_account_id: goalData.linkedAccountId,
      current_amount: goalData.currentAmount,
      target_date: goalData.target_date,
      description: goalData.description,
    };

    // UPDATED: Check if the linked account exists in either cash accounts or investment accounts
    const cashAccount = appState.appData.cashAccounts.find(acc => acc.id === linkedAccountId);
    const investmentAccount = appState.appData.investmentAccounts.find(
      acc => acc.id === linkedAccountId
    );

    if (!cashAccount && !investmentAccount) {
      showError('Selected account not found. Please choose a valid savings account.');
      return;
    }

    if (goalId) {
      const savedGoal = await db.updateSavingsGoal(parseInt(goalId), dbGoalData);
      const index = appState.appData.savingsGoals.findIndex(g => g.id === parseInt(goalId));
      if (index > -1) {
        appState.appData.savingsGoals[index] = mapSavingsGoal(savedGoal);
      }
    } else {
      dbGoalData.created_date = new Date().toISOString().split('T')[0];
      const savedGoal = await db.addSavingsGoal(dbGoalData);
      appState.appData.savingsGoals.push(mapSavingsGoal(savedGoal));
    }

    closeModal('goal-modal');
    onUpdate();
    announceToScreenReader('Savings goal saved successfully.');
  } catch (error) {
    debug.error('Error saving savings goal:', error);
    showError('Failed to save savings goal.');
  }
}

function openContributionModal(appData, goalId) {
  const goal = appData.savingsGoals.find(g => g.id === goalId);
  if (!goal) {
    return;
  }

  // Populate contribution source dropdown to include cash accounts
  populateContributionSourceDropdown(appData);

  const modalData = { goalId, goalName: escapeHtml(goal.name) };

  // Set goal ID after modal opens
  setTimeout(() => {
    document.getElementById('contribution-goal-id').value = goalId;
  }, 0);

  openModal('contribution-modal', modalData);
}

// Function to handle transaction deletion and revert savings goal contributions
export async function handleSavingsGoalTransactionDeletion(transaction, appState) {
  // Check if this transaction is a savings goal contribution
  if (!transaction.description || !transaction.description.includes('[Savings Goal')) {
    return;
  }

  // Extract goal name from transaction description
  const goalNameMatch = transaction.description.match(/\[Savings Goal(?:: ([^\]]+))?\]/);
  if (!goalNameMatch) {
    return;
  }

  // Find the savings goal by matching the linked account
  const goal = appState.appData.savingsGoals.find(
    g => g.linkedAccountId === transaction.account_id
  );

  if (!goal) {
    debug.warn('Could not find savings goal for transaction:', transaction.description);
    return;
  }

  try {
    // Revert the contribution amount from the goal
    goal.currentAmount = subtractMoney(goal.currentAmount, Math.abs(transaction.amount));

    // Ensure currentAmount doesn't go negative
    if (moneyLessThan(goal.currentAmount, 0)) {
      goal.currentAmount = 0;
    }

    // Update completed status if needed
    if (goal.completedDate && moneyLessThan(goal.currentAmount, goal.targetAmount)) {
      goal.completedDate = null;
    }

    // Update the goal in the database
    await db.updateSavingsGoal(goal.id, {
      current_amount: goal.currentAmount,
      completed_date: goal.completedDate,
    });

    debug.log(
      `Reverted savings goal contribution: ${goal.name}, new amount: ${goal.currentAmount}`
    );
  } catch (error) {
    debug.error('Error reverting savings goal contribution:', error);
  }
}

// UPDATED: New function to populate contribution source dropdown
function populateContributionSourceDropdown(appData) {
  const select = document.getElementById('contribution-source');
  if (!select) {
    return;
  }

  select.innerHTML = '<option value="" disabled selected>Select Source Account</option>';

  // Add cash accounts as contribution sources
  appData.cashAccounts
    .filter(acc => acc.isActive)
    .forEach(acc => {
      select.innerHTML += `<option value="cash-${acc.id}">${escapeHtml(acc.name)} (Cash)</option>`;
    });

  // Add investment accounts as contribution sources (if any)
  appData.investmentAccounts
    .filter(acc => acc.accountType !== 'Savings Account') // Don't allow transferring from savings to savings
    .forEach(acc => {
      select.innerHTML += `<option value="investment-${acc.id}">${escapeHtml(acc.name)} (Investment)</option>`;
    });
}

async function handleContributionSubmit(event, appState, onUpdate) {
  event.preventDefault();

  // Clear previous errors
  clearFormErrors('contribution-form');

  try {
    const goalId = parseInt(document.getElementById('contribution-goal-id').value);
    const amount = safeParseFloat(document.getElementById('contribution-amount').value);
    const sourceValue = document.getElementById('contribution-source').value;

    // Validate contribution amount
    const amountError = ValidationRules.positiveNumber(amount);
    if (amountError) {
      showFieldError('contribution-amount', amountError);
      showError('Please correct the errors in the form.');
      return;
    }

    if (!sourceValue) {
      showFieldError('contribution-source', 'Please select a source account');
      showError('Please correct the errors in the form.');
      return;
    }

    // UPDATED: Parse the source account type and ID
    const [sourceType, sourceIdStr] = sourceValue.split('-');
    const sourceAccountId = parseInt(sourceIdStr);

    if (!sourceType || !sourceAccountId) {
      showError('Invalid source account selected.');
      return;
    }

    const goal = appState.appData.savingsGoals.find(g => g.id === goalId);
    if (!goal) {
      showError('Savings goal not found.');
      return;
    }

    // UPDATED: Find the target account (could be cash or investment account)
    const targetCashAccount = appState.appData.cashAccounts.find(
      acc => acc.id === goal.linkedAccountId
    );
    const targetInvestmentAccount = appState.appData.investmentAccounts.find(
      acc => acc.id === goal.linkedAccountId
    );

    const targetAccount = targetCashAccount || targetInvestmentAccount;
    const isTargetCashAccount = !!targetCashAccount;

    if (!targetAccount) {
      showError('Target savings account not found.');
      return;
    }

    // UPDATED: Find the source account
    let sourceAccount;
    let isSourceCashAccount = false;

    if (sourceType === 'cash') {
      sourceAccount = appState.appData.cashAccounts.find(a => a.id === sourceAccountId);
      isSourceCashAccount = true;
    } else if (sourceType === 'investment') {
      sourceAccount = appState.appData.investmentAccounts.find(a => a.id === sourceAccountId);
      isSourceCashAccount = false;
    }

    if (!sourceAccount) {
      showError('Source account not found.');
      return;
    }

    // Handle transfers between accounts
    if (isSourceCashAccount && isTargetCashAccount) {
      // Both are cash accounts - use linked transactions for proper transfer
      const fromTransaction = {
        date: new Date().toISOString().split('T')[0],
        account_id: sourceAccountId,
        category: 'Transfer',
        description: `Transfer to ${targetAccount.name} [Savings Goal: ${goal.name}]`,
        amount: -amount,
        cleared: true
      };

      const toTransaction = {
        date: new Date().toISOString().split('T')[0],
        account_id: goal.linkedAccountId,
        category: 'Transfer',
        description: `Contribution to ${goal.name} [Savings Goal]`,
        amount: amount,
        cleared: true
      };

      const linkedTransactions = await transactionManager.addLinkedTransactions(
        fromTransaction,
        toTransaction
      );

      // Add both transactions to the UI
      if (linkedTransactions && linkedTransactions.length === 2) {
        appState.appData.transactions.unshift(
          { ...linkedTransactions[0], amount: parseFloat(linkedTransactions[0].amount) },
          { ...linkedTransactions[1], amount: parseFloat(linkedTransactions[1].amount) }
        );
      }
    } else if (isSourceCashAccount) {
      // Source is cash, target is investment - create withdrawal only
      const withdrawal = {
        date: new Date().toISOString().split('T')[0],
        account_id: sourceAccountId,
        category: 'Transfer',
        description: `Transfer to ${targetAccount.name} [Savings Goal: ${goal.name}]`,
        amount: -amount,
        cleared: true,
      };
      const savedWithdrawal = await transactionManager.addTransaction(withdrawal);
      appState.appData.transactions.unshift({
        ...savedWithdrawal,
        amount: parseFloat(savedWithdrawal.amount),
      });

      // Update investment account balance
      targetAccount.balance = addMoney(targetAccount.balance, amount);
      await db.updateInvestmentAccount(targetAccount.id, { balance: targetAccount.balance });
    } else if (isTargetCashAccount) {
      // Source is investment, target is cash - create deposit only
      const deposit = {
        date: new Date().toISOString().split('T')[0],
        account_id: goal.linkedAccountId,
        category: 'Transfer',
        description: `Contribution to ${goal.name} [Savings Goal]`,
        amount,
        cleared: true,
      };
      const savedDeposit = await transactionManager.addTransaction(deposit);
      appState.appData.transactions.unshift({
        ...savedDeposit,
        amount: parseFloat(savedDeposit.amount),
      });

      // Update investment account balance
      sourceAccount.balance = subtractMoney(sourceAccount.balance, amount);
      await db.updateInvestmentAccount(sourceAccount.id, { balance: sourceAccount.balance });
    } else {
      // Both are investment accounts - just update balances
      sourceAccount.balance = subtractMoney(sourceAccount.balance, amount);
      targetAccount.balance = addMoney(targetAccount.balance, amount);
      await db.updateInvestmentAccount(sourceAccount.id, { balance: sourceAccount.balance });
      await db.updateInvestmentAccount(targetAccount.id, { balance: targetAccount.balance });
    }

    // Update savings goal progress
    goal.currentAmount = addMoney(goal.currentAmount, amount);
    if (!moneyLessThan(goal.currentAmount, goal.targetAmount) && !goal.completedDate) {
      goal.completedDate = new Date().toISOString().split('T')[0];
    }
    await db.updateSavingsGoal(goal.id, {
      current_amount: goal.currentAmount,
      completed_date: goal.completedDate,
    });

    closeModal('contribution-modal');
    onUpdate();
    announceToScreenReader('Contribution saved.');
  } catch (error) {
    debug.error('Error processing contribution:', error);
    showError('Failed to process contribution.');
  }
}

async function deleteSavingsGoal(id, appState, onUpdate) {
  if (confirm('Are you sure you want to delete this savings goal?')) {
    try {
      await db.deleteSavingsGoal(id);
      appState.appData.savingsGoals = appState.appData.savingsGoals.filter(g => g.id !== id);
      onUpdate();
    } catch (error) {
      showError('Failed to delete savings goal.');
    }
  }
}

export function renderSavingsGoals(appState) {
  const list = document.getElementById('savings-goals-list');
  if (!list) {
    return;
  }

  if (appState.appData.savingsGoals.length === 0) {
    list.innerHTML = '<div class="empty-state">No savings goals added yet.</div>';
    return;
  }

  list.innerHTML = appState.appData.savingsGoals
    .map(goal => {
      // Check if linked account exists and show appropriate status
      const cashAccount = appState.appData.cashAccounts.find(
        acc => acc.id === goal.linkedAccountId
      );
      const investmentAccount = appState.appData.investmentAccounts.find(
        acc => acc.id === goal.linkedAccountId
      );
      const linkedAccount = cashAccount || investmentAccount;
      const accountDeleted = !linkedAccount;

      // Use the goal's tracked current amount, not the entire account balance
      const currentAmount = goal.currentAmount || 0;

      const progress = goal.targetAmount > 0 ? (currentAmount / goal.targetAmount) * 100 : 0;
      const clampedProgress = Math.min(progress, 100);

      // Determine icon based on completion status
      const icon = goal.completedDate ? '✅' : '🎯';

      return `
        <div class="goal-card ${goal.completedDate ? 'completed' : ''} ${accountDeleted ? 'error' : ''}" data-id="${goal.id}">
            ${accountDeleted ? '<div class="goal-error-notice">Linked account was deleted!</div>' : ''}
            
            <div class="goal-card__icon">${icon}</div>
            
            <div class="goal-card__name">${escapeHtml(goal.name)}</div>
            
            <div class="goal-card__progress">
                <div class="goal-card__progress-bar">
                    <div class="goal-card__progress-fill" style="width: ${clampedProgress}%"></div>
                </div>
                <div class="goal-card__progress-text">
                    <div class="goal-card__progress-percent">${Math.round(clampedProgress)}%</div>
                    <div class="goal-card__amounts">
                        <span class="goal-card__current">${formatCurrency(currentAmount)}</span>
                        <span class="goal-card__target">of ${formatCurrency(goal.targetAmount)}</span>
                    </div>
                </div>
            </div>

            <div class="goal-card__actions">
                <button class="btn btn--primary btn-contribute" data-id="${goal.id}" ${accountDeleted ? 'disabled' : ''}>Contribute</button>
                <button class="btn btn--secondary btn-edit-goal" data-id="${goal.id}">Edit</button>
                <button class="icon-btn btn-delete-goal" data-id="${goal.id}" title="Delete">🗑️</button>
            </div>
        </div>
        `;
    })
    .join('');
}

// UPDATED: Modified to include both cash and investment savings accounts
function populateGoalAccountDropdown(appData) {
  const select = document.getElementById('goal-account');
  if (!select) {
    return;
  }

  select.innerHTML = '<option value="" disabled selected>Select Savings Account</option>';

  // Add cash accounts with type "Savings"
  appData.cashAccounts
    .filter(acc => acc.type === 'Savings' && acc.isActive)
    .forEach(acc => {
      select.innerHTML += `<option value="${acc.id}">${escapeHtml(acc.name)} (Cash Savings)</option>`;
    });

  // Add investment accounts with type "Savings Account"
  appData.investmentAccounts
    .filter(acc => acc.accountType === 'Savings Account')
    .forEach(acc => {
      select.innerHTML += `<option value="${acc.id}">${escapeHtml(acc.name)} (Investment Savings)</option>`;
    });
}
