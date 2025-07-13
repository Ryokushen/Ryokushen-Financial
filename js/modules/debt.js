// js/modules/debt.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatCurrency, formatDate, getDueDateClass, getDueDateText } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';
import { validateForm, ValidationSchemas, showFieldError, clearFormErrors, CrossFieldValidators, validateFormWithCrossFields } from './validation.js';
import { DebtStrategy } from './debtStrategy.js';

function openDebtModal(appData, debtId = null) {
    const modalData = { debtId };
    
    if (debtId) {
        const debt = appData.debtAccounts.find(d => d.id === debtId);
        if (debt) {
            // Modal will be reset by modalManager, so populate after open
            setTimeout(() => {
                document.getElementById("debt-id").value = debt.id;
                document.getElementById("debt-name").value = debt.name;
                document.getElementById("debt-type").value = debt.type;
                document.getElementById("debt-institution").value = debt.institution;
                document.getElementById("debt-balance").value = debt.balance;
                document.getElementById("debt-interest-rate").value = debt.interestRate;
                document.getElementById("debt-minimum-payment").value = debt.minimumPayment;
                document.getElementById("debt-due-date").value = debt.dueDate;
                document.getElementById("debt-credit-limit").value = debt.creditLimit || "";
                document.getElementById("debt-notes").value = debt.notes || "";
            }, 0);
        }
    } else {
        // For new debt accounts, just ensure ID is empty after reset
        setTimeout(() => {
            document.getElementById("debt-id").value = "";
        }, 0);
    }
    
    openModal('debt-modal', modalData);
}

async function handleDebtSubmit(event, appState, onUpdate) {
    event.preventDefault();
    
    // Clear previous errors
    clearFormErrors('debt-form');
    
    try {
        const debtId = document.getElementById("debt-id").value;
        const debtData = {
            name: document.getElementById("debt-name").value,
            type: document.getElementById("debt-type").value,
            institution: document.getElementById("debt-institution").value,
            balance: safeParseFloat(document.getElementById("debt-balance").value),
            interestRate: safeParseFloat(document.getElementById("debt-interest-rate").value),
            minimumPayment: safeParseFloat(document.getElementById("debt-minimum-payment").value),
            dueDate: document.getElementById("debt-due-date").value,
            creditLimit: safeParseFloat(document.getElementById("debt-credit-limit").value) || null,
            notes: document.getElementById("debt-notes").value
        };
        
        // Validate form data with cross-field validation
        const { errors, hasErrors } = validateFormWithCrossFields(
            debtData,
            ValidationSchemas.debtAccount,
            CrossFieldValidators.debtAccount
        );
        
        if (hasErrors) {
            // Show field-level errors
            Object.entries(errors).forEach(([field, error]) => {
                showFieldError(`debt-${field}`, error);
            });
            showError("Please correct the errors in the form.");
            return;
        }

        if (debtId) {
            const savedDebt = await db.updateDebtAccount(parseInt(debtId), debtData);
            const index = appState.appData.debtAccounts.findIndex(d => d.id === parseInt(debtId));
            if (index > -1) appState.appData.debtAccounts[index] = { id: savedDebt.id, ...debtData };
        } else {
            const savedDebt = await db.addDebtAccount(debtData);
            appState.appData.debtAccounts.push({ id: savedDebt.id, ...debtData });
        }
        
        closeModal('debt-modal');
        await onUpdate();
        announceToScreenReader("Debt account saved successfully");
    } catch (error) {
        showError("Failed to save debt account.");
    }
}

async function deleteDebtAccount(id, appState, onUpdate) {
    const debt = appState.appData.debtAccounts.find(d => d.id === id);
    if (debt && confirm(`Are you sure you want to delete "${debt.name}"?`)) {
        try {
            await db.deleteDebtAccount(id);
            appState.appData.debtAccounts = appState.appData.debtAccounts.filter(d => d.id !== id);
            await onUpdate();
            announceToScreenReader("Debt account deleted");
        } catch (error) {
            showError("Failed to delete debt account.");
        }
    }
}

export function renderDebtAccounts(appState) {
    const { appData } = appState;
    const debtAccountsList = document.getElementById("debt-accounts-list");
    if (!debtAccountsList) return;

    const totalDebt = appData.debtAccounts.reduce((sum, account) => sum + account.balance, 0);
    const totalPayments = appData.debtAccounts.reduce((sum, account) => sum + account.minimumPayment, 0);

    document.getElementById("debt-total-value").textContent = formatCurrency(totalDebt);
    document.getElementById("debt-monthly-payments").textContent = formatCurrency(totalPayments);
    
    if (appData.debtAccounts.length === 0) {
        debtAccountsList.innerHTML = `<div class="empty-state">No debt accounts.</div>`;
        return;
    }
    
    debtAccountsList.innerHTML = appData.debtAccounts.map(account => `
        <div class="debt-account" data-id="${account.id}">
            <h4>${escapeHtml(account.name)}</h4>
            <div class="account-info">
                <div class="account-info-item"><span class="account-info-label">Type</span><span class="account-info-value">${escapeHtml(account.type)}</span></div>
                <div class="account-info-item"><span class="account-info-label">Institution</span><span class="account-info-value">${escapeHtml(account.institution)}</span></div>
                <div class="account-info-item"><span class="account-info-label">Balance</span><span class="account-info-value balance">${formatCurrency(account.balance)}</span></div>
                <div class="account-info-item"><span class="account-info-label">Rate</span><span class="account-info-value rate">${account.interestRate}%</span></div>
                <div class="account-info-item"><span class="account-info-label">Min. Payment</span><span class="account-info-value payment">${formatCurrency(account.minimumPayment)}</span></div>
                <div class="account-info-item"><span class="account-info-label">Due Date</span><span class="account-info-value">${formatDate(account.dueDate)}</span></div>
            </div>
            <div class="due-date ${getDueDateClass(account.dueDate)}">${getDueDateText(account.dueDate)}</div>
            <div class="debt-actions">
                <button class="btn btn--secondary btn--sm btn-edit" data-id="${account.id}">Edit</button>
                <button class="btn btn--outline btn--sm btn-delete" data-id="${account.id}">Delete</button>
            </div>
        </div>`).join('');
}


export function populateDebtAccountDropdown(appData) {
    const debtAccountSelect = document.getElementById("debt-account-select");
    if (!debtAccountSelect) return;
    debtAccountSelect.innerHTML = "<option value=\"\">Select Debt Account</option>";
    appData.debtAccounts.forEach(account => {
        debtAccountSelect.innerHTML += `<option value="${escapeHtml(account.name)}">${escapeHtml(account.name)}</option>`;
    });
}

function calculateAndDisplayPayoff(appState) {
    const strategy = document.getElementById('debt-strategy-select').value;
    const extraPayment = safeParseFloat(document.getElementById('extra-payment-amount').value) || 0;
    const debts = appState.appData.debtAccounts;
    
    if (debts.length === 0) {
        showError('No debt accounts to calculate payoff for.');
        return;
    }
    
    // Calculate payoff timeline
    const timeline = DebtStrategy.calculatePayoffTimeline(debts, strategy, extraPayment);
    
    // Display results
    document.getElementById('payoff-results').style.display = 'block';
    document.getElementById('debt-free-date').textContent = formatDate(timeline.debtFreeDate);
    document.getElementById('total-interest').textContent = formatCurrency(timeline.totalInterest);
    document.getElementById('months-to-payoff').textContent = timeline.months;
    
    // Calculate strategy comparison
    const comparison = DebtStrategy.compareStrategies(debts, extraPayment);
    
    // Display comparison if there's a difference
    if (comparison.interestSavings !== 0 || comparison.timeDifference !== 0) {
        document.getElementById('strategy-comparison').style.display = 'block';
        const comparisonDiv = document.querySelector('.comparison-results');
        
        comparisonDiv.innerHTML = `
            <div class="comparison-card">
                <h5>Avalanche Method</h5>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Total Interest:</span>
                    <span class="comparison-metric-value">${formatCurrency(comparison.avalanche.totalInterest)}</span>
                </div>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Payoff Time:</span>
                    <span class="comparison-metric-value">${comparison.avalanche.months} months</span>
                </div>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Debt Free Date:</span>
                    <span class="comparison-metric-value">${formatDate(comparison.avalanche.debtFreeDate)}</span>
                </div>
            </div>
            <div class="comparison-card">
                <h5>Snowball Method</h5>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Total Interest:</span>
                    <span class="comparison-metric-value">${formatCurrency(comparison.snowball.totalInterest)}</span>
                </div>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Payoff Time:</span>
                    <span class="comparison-metric-value">${comparison.snowball.months} months</span>
                </div>
                <div class="comparison-metric">
                    <span class="comparison-metric-label">Debt Free Date:</span>
                    <span class="comparison-metric-value">${formatDate(comparison.snowball.debtFreeDate)}</span>
                </div>
            </div>
        `;
        
        // Add savings highlight if applicable
        if (comparison.interestSavings > 0) {
            comparisonDiv.innerHTML += `
                <div class="comparison-card" style="grid-column: 1 / -1;">
                    <p class="savings-highlight">
                        The Avalanche method saves ${formatCurrency(comparison.interestSavings)} in interest!
                    </p>
                </div>
            `;
        }
    }
    
    // Display extra payment allocation recommendation
    // First, remove any existing allocation recommendations
    const existingAllocation = document.querySelector('.extra-payment-allocation');
    if (existingAllocation) {
        existingAllocation.remove();
    }
    
    if (extraPayment > 0) {
        const allocation = DebtStrategy.allocateExtraPayment(debts, strategy, extraPayment);
        if (allocation.length > 0) {
            const allocationDiv = document.createElement('div');
            allocationDiv.className = 'extra-payment-allocation mt-16';
            allocationDiv.innerHTML = `
                <h4>Recommended Extra Payment Allocation</h4>
                <p>Based on your ${strategy} strategy, apply your extra ${formatCurrency(extraPayment)} monthly payment to:</p>
                <div class="allocation-recommendation">
                    <strong>${escapeHtml(allocation[0].debtName)}</strong>
                    <span class="text-secondary">(${allocation[0].reason})</span>
                </div>
            `;
            document.getElementById('payoff-results').appendChild(allocationDiv);
        }
    }
    
    // Update charts if they exist
    if (window.updateDebtCharts) {
        window.updateDebtCharts(appState);
    }
}

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("add-debt-btn")?.addEventListener("click", () => openDebtModal(appState.appData));
    document.getElementById("close-debt-modal")?.addEventListener("click", () => closeModal('debt-modal'));
    document.getElementById("cancel-debt-btn")?.addEventListener("click", () => closeModal('debt-modal'));
    document.getElementById("debt-form")?.addEventListener("submit", (e) => handleDebtSubmit(e, appState, onUpdate));

    document.getElementById("debt-accounts-list")?.addEventListener('click', (event) => {
        const target = event.target;
        const id = parseInt(target.getAttribute('data-id'));
        if (!id) return;
        
        if (target.classList.contains('btn-edit')) openDebtModal(appState.appData, id);
        if (target.classList.contains('btn-delete')) deleteDebtAccount(id, appState, onUpdate);
    });
    
    // Add new event listeners for payoff calculation
    document.getElementById("calculate-payoff-btn")?.addEventListener("click", () => calculateAndDisplayPayoff(appState));
    document.getElementById("debt-strategy-select")?.addEventListener("change", () => {
        // Recalculate if results are already shown
        if (document.getElementById('payoff-results').style.display !== 'none') {
            calculateAndDisplayPayoff(appState);
        }
    });
    document.getElementById("extra-payment-amount")?.addEventListener("input", () => {
        // Recalculate if results are already shown
        if (document.getElementById('payoff-results').style.display !== 'none') {
            calculateAndDisplayPayoff(appState);
        }
    });
}