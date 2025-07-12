// js/modules/recurring.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatDate, formatCurrency, getDueDateClass, getDueDateText, convertToMonthly, getNextDueDate } from './utils.js';
import { showError, announceToScreenReader, openModal, closeModal } from './ui.js';

let eventListeners = [];

export function setupEventListeners(appState, onUpdate) {
    // Clean up any existing listeners first
    cleanupEventListeners();
    
    // Store references to event handlers
    const handlers = {
        openModal: () => openRecurringModal(appState.appData),
        closeModal: () => closeModal('recurring-modal'),
        cancelModal: () => closeModal('recurring-modal'),
        submitForm: (e) => handleRecurringSubmit(e, appState, onUpdate),
        listClick: (event) => {
            const id = parseInt(event.target.getAttribute('data-id'));
            if (!id) return;
            if (event.target.classList.contains('btn-pay-bill')) payRecurringBill(id, appState, onUpdate);
            if (event.target.classList.contains('btn-edit-bill')) openRecurringModal(appState.appData, id);
            if (event.target.classList.contains('btn-delete-bill')) deleteRecurringBill(id, appState, onUpdate);
        }
    };
    
    // Add event listeners and store references
    const addRecurringBtn = document.getElementById("add-recurring-btn");
    if (addRecurringBtn) {
        addRecurringBtn.addEventListener("click", handlers.openModal);
        eventListeners.push({ element: addRecurringBtn, type: "click", handler: handlers.openModal });
    }
    
    const closeRecurringModal = document.getElementById("close-recurring-modal");
    if (closeRecurringModal) {
        closeRecurringModal.addEventListener("click", handlers.closeModal);
        eventListeners.push({ element: closeRecurringModal, type: "click", handler: handlers.closeModal });
    }
    
    const cancelRecurringBtn = document.getElementById("cancel-recurring-btn");
    if (cancelRecurringBtn) {
        cancelRecurringBtn.addEventListener("click", handlers.cancelModal);
        eventListeners.push({ element: cancelRecurringBtn, type: "click", handler: handlers.cancelModal });
    }
    
    const recurringForm = document.getElementById("recurring-form");
    if (recurringForm) {
        recurringForm.addEventListener("submit", handlers.submitForm);
        eventListeners.push({ element: recurringForm, type: "submit", handler: handlers.submitForm });
    }

    const recurringList = document.getElementById("all-recurring-bills-list");
    if (recurringList) {
        recurringList.addEventListener('click', handlers.listClick);
        eventListeners.push({ element: recurringList, type: 'click', handler: handlers.listClick });
    }
}

export function cleanupEventListeners() {
    eventListeners.forEach(({ element, type, handler }) => {
        element.removeEventListener(type, handler);
    });
    eventListeners = [];
}

function openRecurringModal(appData, billId = null) {
    // First populate the account dropdown
    populateRecurringAccountDropdown(appData);

    const form = document.getElementById("recurring-form");
    const title = document.getElementById("recurring-modal-title");
    form.reset();
    document.getElementById("recurring-id").value = "";

    if (billId) {
        const bill = appData.recurringBills.find(b => b.id === billId);
        if (bill) {
            title.textContent = "Edit Recurring Bill";
            document.getElementById("recurring-id").value = bill.id;
            document.getElementById("recurring-name").value = bill.name;
            document.getElementById("recurring-category").value = bill.category;
            document.getElementById("recurring-amount").value = bill.amount;
            document.getElementById("recurring-frequency").value = bill.frequency;
            document.getElementById("recurring-next-due").value = bill.nextDue || bill.next_due;
            document.getElementById("recurring-account").value = bill.account_id;
            document.getElementById("recurring-notes").value = bill.notes || "";
            // FIX FOR ISSUE 2: Use 'active' consistently
            document.getElementById("recurring-active").checked = bill.active !== false;
        }
    } else {
        title.textContent = "Add New Recurring Bill";
        document.getElementById("recurring-active").checked = true;
        // Set default next due date to today
        document.getElementById("recurring-next-due").value = new Date().toISOString().split('T')[0];
    }
    openModal('recurring-modal');
}

function populateRecurringAccountDropdown(appData) {
    const select = document.getElementById("recurring-account");
    if (!select) return;

    const activeAccounts = appData.cashAccounts.filter(a => a.isActive);
    const currentValue = select.value;

    select.innerHTML = '<option value="" disabled selected>Select Account</option>';
    activeAccounts.forEach(account => {
        select.innerHTML += `<option value="${account.id}">${escapeHtml(account.name)}</option>`;
    });

    // Restore previous selection if it exists
    if (currentValue) {
        select.value = currentValue;
    }
}

async function handleRecurringSubmit(event, appState, onUpdate) {
    event.preventDefault();

    try {
        const billId = document.getElementById("recurring-id").value;
        const accountId = parseInt(document.getElementById("recurring-account").value);
        const amount = safeParseFloat(document.getElementById("recurring-amount").value);
        const nextDue = document.getElementById("recurring-next-due").value;

        // Validation
        if (!accountId || isNaN(accountId)) {
            showError("Please select a valid payment account.");
            return;
        }

        if (amount <= 0) {
            showError("Amount must be greater than zero.");
            return;
        }

        if (!nextDue) {
            showError("Please select a next due date.");
            return;
        }

        // FIX FOR ISSUE 2: Use 'active' consistently
        const billData = {
            name: document.getElementById("recurring-name").value.trim(),
            category: document.getElementById("recurring-category").value,
            amount: amount,
            frequency: document.getElementById("recurring-frequency").value,
            next_due: nextDue,
            account_id: accountId,
            notes: document.getElementById("recurring-notes").value.trim(),
            active: document.getElementById("recurring-active").checked  // Use 'active' directly
        };

        // Additional validation
        if (!billData.name) {
            showError("Bill name is required.");
            return;
        }

        if (!billData.category) {
            showError("Please select a category.");
            return;
        }

        if (!billData.frequency) {
            showError("Please select a billing frequency.");
            return;
        }

        console.log("Submitting bill data:", billData); // Debug log

        let savedBill;
        if (billId) {
            savedBill = await db.updateRecurringBill(parseInt(billId), billData);
            const index = appState.appData.recurringBills.findIndex(b => b.id === parseInt(billId));
            if (index > -1) {
                appState.appData.recurringBills[index] = {
                    ...savedBill,
                    amount: parseFloat(savedBill.amount),
                    nextDue: savedBill.next_due,
                    active: savedBill.active  // Use 'active' consistently
                };
            }
        } else {
            savedBill = await db.addRecurringBill(billData);
            appState.appData.recurringBills.push({
                ...savedBill,
                amount: parseFloat(savedBill.amount),
                nextDue: savedBill.next_due,
                active: savedBill.active  // Use 'active' consistently
            });
        }

        closeModal('recurring-modal');
        onUpdate();
        announceToScreenReader("Recurring bill saved successfully.");

    } catch (error) {
        console.error("Error saving recurring bill:", error);
        showError(`Failed to save recurring bill: ${error.message}`);
    }
}

async function deleteRecurringBill(id, appState, onUpdate) {
    const bill = appState.appData.recurringBills.find(b => b.id === id);
    if (!bill) return;

    if (confirm(`Are you sure you want to delete "${bill.name}"?`)) {
        try {
            await db.deleteRecurringBill(id);
            appState.appData.recurringBills = appState.appData.recurringBills.filter(b => b.id !== id);
            onUpdate();
            announceToScreenReader("Recurring bill deleted.");
        } catch (error) {
            console.error("Error deleting recurring bill:", error);
            showError("Failed to delete recurring bill.");
        }
    }
}

async function payRecurringBill(id, appState, onUpdate) {
    const bill = appState.appData.recurringBills.find(b => b.id === id);
    if (!bill) return;

    if (confirm(`Pay ${bill.name} for ${formatCurrency(bill.amount)}?`)) {
        try {
            const transaction = {
                date: new Date().toISOString().split('T')[0],
                account_id: bill.account_id,
                category: bill.category,
                description: `${bill.name} (Recurring)`,
                amount: -bill.amount,
                cleared: true
            };

            const savedTransaction = await db.addTransaction(transaction);
            appState.appData.transactions.unshift({ ...savedTransaction, amount: parseFloat(savedTransaction.amount) });

            // FIX FOR ISSUE 4: Use the balance update function if available
            if (appState.updateAccountBalance) {
                appState.updateAccountBalance(bill.account_id, -bill.amount);
            } else {
                const paymentAccount = appState.appData.cashAccounts.find(a => a.id === bill.account_id);
                if (paymentAccount) {
                    paymentAccount.balance -= bill.amount;
                }
            }

            const newNextDue = getNextDueDate(bill.nextDue || bill.next_due, bill.frequency);
            bill.nextDue = newNextDue;
            bill.next_due = newNextDue;

            await db.updateRecurringBill(bill.id, {
                next_due: newNextDue,
                active: bill.active  // Maintain active status
            });

            onUpdate();
            announceToScreenReader("Payment recorded successfully.");
        } catch (error) {
            console.error("Error paying bill:", error);
            showError("Failed to record payment.");
        }
    }
}

export function renderRecurringBills(appState) {
    const { appData } = appState;
    renderSummary(appData);
    renderUpcomingBills(appData);
    renderAllRecurringBills(appData);
}

function renderSummary(appData) {
    const activeBills = appData.recurringBills.filter(bill => bill.active !== false);
    const monthlyTotal = activeBills.reduce((sum, bill) => sum + convertToMonthly(bill.amount, bill.frequency), 0);

    document.getElementById("recurring-monthly-total").textContent = formatCurrency(monthlyTotal);
    document.getElementById("recurring-annual-total").textContent = formatCurrency(monthlyTotal * 12);
    document.getElementById("recurring-count").textContent = activeBills.length.toString();
}

function renderUpcomingBills(appData) {
    const upcomingList = document.getElementById("upcoming-bills-list");
    if (!upcomingList) return;

    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const upcomingBills = appData.recurringBills
        .filter(bill => {
            const dueDate = new Date(bill.nextDue || bill.next_due);
            const isActive = bill.active !== false;
            return isActive && dueDate >= today && dueDate <= thirtyDaysFromNow;
        })
        .sort((a, b) => new Date(a.nextDue || a.next_due) - new Date(b.nextDue || b.next_due));

    if (upcomingBills.length === 0) {
        upcomingList.innerHTML = `<div class="empty-state">No bills due in the next 30 days.</div>`;
        return;
    }

    upcomingList.innerHTML = upcomingBills.map(bill => {
        const account = appData.cashAccounts.find(a => a.id === bill.account_id);
        const dueDate = bill.nextDue || bill.next_due;
        return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-description">${escapeHtml(bill.name)}</div>
                    <div class="transaction-details">${formatDate(dueDate)} - ${account ? escapeHtml(account.name) : 'N/A'}</div>
                </div>
                <div class="transaction-amount negative">${formatCurrency(-bill.amount)}</div>
            </div>
        `;
    }).join('');
}

function renderAllRecurringBills(appData) {
    const billsList = document.getElementById("all-recurring-bills-list");
    if (!billsList) return;

    if (appData.recurringBills.length === 0) {
        billsList.innerHTML = `<div class="empty-state">No recurring bills added yet.</div>`;
        return;
    }

    billsList.innerHTML = appData.recurringBills.map(bill => {
        const account = appData.cashAccounts.find(a => a.id === bill.account_id);
        const isActive = bill.active !== false;
        const dueDate = bill.nextDue || bill.next_due;

        return `
        <div class="recurring-bill-card ${isActive ? '' : 'inactive'}" data-id="${bill.id}">
            <div class="recurring-bill-header">
                <h5>${escapeHtml(bill.name)}</h5>
                <div class="recurring-bill-amount">${formatCurrency(bill.amount)}</div>
            </div>
            <div class="recurring-bill-info">
                <div class="recurring-bill-detail">
                    <span class="label">Next Due:</span>
                    <span class="value ${getDueDateClass(dueDate)}">${formatDate(dueDate)}</span>
                </div>
                <div class="recurring-bill-detail">
                    <span class="label">Frequency:</span>
                    <span class="value">${escapeHtml(bill.frequency)}</span>
                </div>
                <div class="recurring-bill-detail">
                    <span class="label">Payment Account:</span>
                    <span class="value">${account ? escapeHtml(account.name) : 'N/A'}</span>
                </div>
                <div class="recurring-bill-detail">
                    <span class="label">Status:</span>
                    <span class="value">${isActive ? 'Active' : 'Inactive'}</span>
                </div>
            </div>
            <div class="recurring-bill-actions">
                ${isActive ? `<button class="btn btn--primary btn--sm btn-pay-bill" data-id="${bill.id}">Pay Bill</button>` : ''}
                <button class="btn btn--secondary btn--sm btn-edit-bill" data-id="${bill.id}">Edit</button>
                <button class="btn btn--outline btn--sm btn-delete-bill" data-id="${bill.id}">Delete</button>
            </div>
        </div>
        `;
    }).join('');
}