// js/modules/debt.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatCurrency, formatDate, getDueDateClass, getDueDateText } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';

function openDebtModal(appData, debtId = null) {
    const form = document.getElementById("debt-form");
    const title = document.getElementById("debt-modal-title");

    if (debtId) {
        const debt = appData.debtAccounts.find(d => d.id === debtId);
        if (debt) {
            title.textContent = "Edit Debt Account";
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
        }
    } else {
        title.textContent = "Add New Debt Account";
        form.reset();
        document.getElementById("debt-id").value = "";
    }
    openModal('debt-modal');
}

async function handleDebtSubmit(event, appState, onUpdate) {
    event.preventDefault();
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

let eventListeners = [];

export function setupEventListeners(appState, onUpdate) {
    // Clean up any existing listeners first
    cleanupEventListeners();
    
    // Store references to event handlers
    const handlers = {
        openModal: () => openDebtModal(appState.appData),
        closeModal: () => closeModal('debt-modal'),
        cancelModal: () => closeModal('debt-modal'),
        submitForm: (e) => handleDebtSubmit(e, appState, onUpdate),
        listClick: (event) => {
            const target = event.target;
            const id = parseInt(target.getAttribute('data-id'));
            if (!id) return;
            
            if (target.classList.contains('btn-edit')) openDebtModal(appState.appData, id);
            if (target.classList.contains('btn-delete')) deleteDebtAccount(id, appState, onUpdate);
        }
    };
    
    // Add event listeners and store references
    const addDebtBtn = document.getElementById("add-debt-btn");
    if (addDebtBtn) {
        addDebtBtn.addEventListener("click", handlers.openModal);
        eventListeners.push({ element: addDebtBtn, type: "click", handler: handlers.openModal });
    }
    
    const closeDebtModal = document.getElementById("close-debt-modal");
    if (closeDebtModal) {
        closeDebtModal.addEventListener("click", handlers.closeModal);
        eventListeners.push({ element: closeDebtModal, type: "click", handler: handlers.closeModal });
    }
    
    const cancelDebtBtn = document.getElementById("cancel-debt-btn");
    if (cancelDebtBtn) {
        cancelDebtBtn.addEventListener("click", handlers.cancelModal);
        eventListeners.push({ element: cancelDebtBtn, type: "click", handler: handlers.cancelModal });
    }
    
    const debtForm = document.getElementById("debt-form");
    if (debtForm) {
        debtForm.addEventListener("submit", handlers.submitForm);
        eventListeners.push({ element: debtForm, type: "submit", handler: handlers.submitForm });
    }

    const debtList = document.getElementById("debt-accounts-list");
    if (debtList) {
        debtList.addEventListener('click', handlers.listClick);
        eventListeners.push({ element: debtList, type: 'click', handler: handlers.listClick });
    }
}

export function cleanupEventListeners() {
    eventListeners.forEach(({ element, type, handler }) => {
        element.removeEventListener(type, handler);
    });
    eventListeners = [];
}