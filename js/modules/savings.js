// js/modules/savings.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatDate, formatCurrency } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';

function mapSavingsGoal(goal) {
    return {
        ...goal,
        targetAmount: parseFloat(goal.target_amount),
        currentAmount: parseFloat(goal.current_amount),
        linkedAccountId: goal.linked_account_id,
        targetDate: goal.target_date,
        createdDate: goal.created_date,
        completedDate: goal.completed_date
    };
}

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("add-goal-btn")?.addEventListener("click", () => openGoalModal(appState.appData));
    document.getElementById("close-goal-modal")?.addEventListener("click", () => closeModal('goal-modal'));
    document.getElementById("cancel-goal-btn")?.addEventListener("click", () => closeModal('goal-modal'));
    document.getElementById("goal-form")?.addEventListener("submit", (e) => handleGoalSubmit(e, appState, onUpdate));

    document.getElementById("close-contribution-modal")?.addEventListener("click", () => closeModal('contribution-modal'));
    document.getElementById("cancel-contribution-btn")?.addEventListener("click", () => closeModal('contribution-modal'));
    document.getElementById("contribution-form")?.addEventListener("submit", (e) => handleContributionSubmit(e, appState, onUpdate));

    document.getElementById("savings-goals-list")?.addEventListener('click', event => {
        const target = event.target;
        const card = target.closest('.savings-goal-card');
        if (!card) return;

        const goalId = parseInt(card.getAttribute('data-id'));
        if (target.classList.contains('btn-edit-goal')) openGoalModal(appState.appData, goalId);
        if (target.classList.contains('btn-delete-goal')) deleteSavingsGoal(goalId, appState, onUpdate);
        if (target.classList.contains('btn-contribute')) openContributionModal(appState.appData, goalId);
    });
}

function openGoalModal(appData, goalId = null) {
    populateGoalAccountDropdown(appData);
    const form = document.getElementById("goal-form");
    const title = document.getElementById("goal-modal-title");
    form.reset();
    document.getElementById("goal-id").value = "";

    if (goalId) {
        const goal = appData.savingsGoals.find(g => g.id === goalId);
        if (goal) {
            title.textContent = "Edit Savings Goal";
            document.getElementById("goal-id").value = goal.id;
            document.getElementById("goal-name").value = goal.name;
            document.getElementById("goal-target").value = goal.targetAmount;
            document.getElementById("goal-account").value = goal.linkedAccountId;
            document.getElementById("goal-current").value = goal.currentAmount;
            document.getElementById("goal-target-date").value = goal.targetDate || "";
            document.getElementById("goal-description").value = goal.description || "";
        }
    } else {
        title.textContent = "Add New Savings Goal";
    }
    openModal('goal-modal');
}

async function handleGoalSubmit(event, appState, onUpdate) {
    event.preventDefault();
    try {
        const goalId = document.getElementById("goal-id").value;
        const goalData = {
            name: document.getElementById("goal-name").value,
            target_amount: safeParseFloat(document.getElementById("goal-target").value),
            linked_account_id: parseInt(document.getElementById("goal-account").value),
            current_amount: safeParseFloat(document.getElementById("goal-current").value),
            target_date: document.getElementById("goal-target-date").value || null,
            description: document.getElementById("goal-description").value,
        };

        if (!goalData.linked_account_id) {
            showError("Please select a linked savings account.");
            return;
        }

        if (goalId) {
            const savedGoal = await db.updateSavingsGoal(parseInt(goalId), goalData);
            const index = appState.appData.savingsGoals.findIndex(g => g.id === parseInt(goalId));
            if (index > -1) {
                appState.appData.savingsGoals[index] = mapSavingsGoal(savedGoal);
            }
        } else {
            goalData.created_date = new Date().toISOString().split('T')[0];
            const savedGoal = await db.addSavingsGoal(goalData);
            appState.appData.savingsGoals.push(mapSavingsGoal(savedGoal));
        }

        closeModal('goal-modal');
        onUpdate();
        announceToScreenReader("Savings goal saved successfully.");
    } catch (error) {
        showError("Failed to save savings goal.");
    }
}

function openContributionModal(appData, goalId) {
    const goal = appData.savingsGoals.find(g => g.id === goalId);
    if (!goal) return;
    document.getElementById("contribution-modal-title").textContent = `Contribute to: ${escapeHtml(goal.name)}`;
    document.getElementById("contribution-goal-id").value = goalId;
    document.getElementById("contribution-form").reset();
    openModal('contribution-modal');
}

async function handleContributionSubmit(event, appState, onUpdate) {
    event.preventDefault();
    try {
        const goalId = parseInt(document.getElementById("contribution-goal-id").value);
        const amount = safeParseFloat(document.getElementById("contribution-amount").value);
        const sourceAccountId = parseInt(document.getElementById("contribution-source").value);

        if (amount <= 0) { showError("Contribution must be positive."); return; }
        if (!sourceAccountId) { showError("Please select a source account."); return; }

        const goal = appState.appData.savingsGoals.find(g => g.id === goalId);
        const savingsAccount = appState.appData.investmentAccounts.find(acc => acc.id === goal.linkedAccountId);
        const sourceAccount = appState.appData.cashAccounts.find(a => a.id === sourceAccountId);

        const withdrawal = {
            date: new Date().toISOString().split('T')[0],
            account_id: sourceAccountId,
            category: "Transfer",
            description: `Transfer to ${savingsAccount.name}`,
            amount: -amount,
            cleared: true
        };
        const savedWithdrawal = await db.addTransaction(withdrawal);
        appState.appData.transactions.unshift({ ...savedWithdrawal, amount: parseFloat(savedWithdrawal.amount) });

        if (sourceAccount) sourceAccount.balance -= amount;

        savingsAccount.balance += amount;
        await db.updateInvestmentAccount(savingsAccount.id, { balance: savingsAccount.balance });

        goal.currentAmount += amount;
        if (goal.currentAmount >= goal.targetAmount && !goal.completedDate) {
            goal.completedDate = new Date().toISOString().split('T')[0];
        }
        await db.updateSavingsGoal(goal.id, { current_amount: goal.currentAmount, completed_date: goal.completedDate });

        closeModal('contribution-modal');
        onUpdate();
        announceToScreenReader("Contribution saved.");

    } catch (error) {
        showError("Failed to process contribution.");
    }
}

async function deleteSavingsGoal(id, appState, onUpdate) {
    if (confirm("Are you sure you want to delete this savings goal?")) {
        try {
            await db.deleteSavingsGoal(id);
            appState.appData.savingsGoals = appState.appData.savingsGoals.filter(g => g.id !== id);
            onUpdate();
        } catch (error) { showError("Failed to delete savings goal."); }
    }
}

export function renderSavingsGoals(appState) {
    const list = document.getElementById("savings-goals-list");
    if (!list) return;

    if (appState.appData.savingsGoals.length === 0) {
        list.innerHTML = `<div class="empty-state">No savings goals added yet.</div>`;
        return;
    }

    list.innerHTML = appState.appData.savingsGoals.map(goal => {
        const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
        const clampedProgress = Math.min(progress, 100);

        return `
        <div class="savings-goal-card ${goal.completedDate ? 'completed' : ''} ${goal.accountDeleted ? 'error' : ''}" data-id="${goal.id}">
            ${goal.accountDeleted ? '<div class="goal-error-notice">Linked account was deleted!</div>' : ''}
            <div class="savings-goal-header">
                <h5>${escapeHtml(goal.name)}</h5>
            </div>

            <div class="savings-goal-progress-ring">
                <div class="progress-ring" style="--progress-percent: ${clampedProgress}%;">
                    <div class="progress-ring-inner">
                        <span class="progress-ring-percent">${Math.round(clampedProgress)}%</span>
                    </div>
                </div>
                <div class="progress-ring-text">
                    <span class="progress-current">${formatCurrency(goal.currentAmount)}</span>
                    <span> of </span>
                    <span class="progress-target">${formatCurrency(goal.targetAmount)}</span>
                </div>
            </div>

            <div class="savings-goal-actions">
                <button class="btn btn--primary btn--sm btn-contribute" data-id="${goal.id}" ${goal.accountDeleted ? 'disabled' : ''}>Contribute</button>
                <button class="btn btn--secondary btn--sm btn-edit-goal" data-id="${goal.id}">Edit</button>
                <button class="btn btn--outline btn--sm btn-delete-goal" data-id="${goal.id}">Delete</button>
            </div>
        </div>
        `;
    }).join('');
}

function populateGoalAccountDropdown(appData) {
    const select = document.getElementById("goal-account");
    if (!select) return;
    select.innerHTML = "<option value=\"\" disabled selected>Select Savings Account</option>";
    appData.investmentAccounts
        .filter(acc => acc.accountType === "Savings Account")
        .forEach(acc => {
            select.innerHTML += `<option value="${acc.id}">${escapeHtml(acc.name)}</option>`;
        });
}