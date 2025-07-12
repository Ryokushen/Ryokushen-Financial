// js/modules/transactions.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatDate, formatCurrency, getNextDueDate } from './utils.js';
import { showError, announceToScreenReader } from './ui.js';
import { validateForm, ValidationSchemas, showFieldError, clearFormErrors, ValidationRules } from './validation.js';

let currentCategoryFilter = "";
let editingTransactionId = null;
let originalTransaction = null;

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("transaction-form")?.addEventListener("submit", (e) => handleTransactionSubmit(e, appState, onUpdate));

    document.getElementById("transaction-category")?.addEventListener("change", function () {
        const debtGroup = document.getElementById("debt-account-group");
        if (debtGroup) {
            debtGroup.style.display = this.value === "Debt" ? "block" : "none";
        }
    });

    document.getElementById("filter-category")?.addEventListener("change", (e) => {
        currentCategoryFilter = e.target.value;
        renderTransactions(appState, currentCategoryFilter);
    });

    document.getElementById("transactions-table-body")?.addEventListener('click', (event) => {
        const transactionId = parseInt(event.target.getAttribute('data-id'));

        if (event.target.classList.contains('btn-delete')) {
            deleteTransaction(transactionId, appState, onUpdate);
        } else if (event.target.classList.contains('btn-edit')) {
            editTransaction(transactionId, appState);
        }
    });

    // Cancel edit button
    document.getElementById("cancel-edit-btn")?.addEventListener('click', () => {
        cancelEdit();
    });
}

function editTransaction(id, appState) {
    const transaction = appState.appData.transactions.find(t => t.id === id);
    if (!transaction) {
        showError("Transaction not found.");
        return;
    }

    // Store the original transaction for reverting changes
    originalTransaction = { ...transaction };
    editingTransactionId = id;

    // Update form title and button text
    const formTitle = document.querySelector('.card__header h3');
    if (formTitle) {
        formTitle.textContent = 'Edit Transaction';
    }

    const submitBtn = document.querySelector('#transaction-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = 'Update Transaction';
    }

    // Show cancel button
    showCancelButton();

    // Populate form with transaction data
    const dateInput = document.getElementById("transaction-date");
    if (dateInput) dateInput.value = transaction.date;

    const accountSelect = document.getElementById("transaction-account");
    if (accountSelect) accountSelect.value = transaction.account_id || '';

    const categorySelect = document.getElementById("transaction-category");
    if (categorySelect) categorySelect.value = transaction.category;

    const descriptionInput = document.getElementById("transaction-description");
    if (descriptionInput) descriptionInput.value = transaction.description;

    const amountInput = document.getElementById("transaction-amount");
    if (amountInput) amountInput.value = transaction.amount;

    const clearedCheckbox = document.getElementById("transaction-cleared");
    if (clearedCheckbox) clearedCheckbox.checked = transaction.cleared;

    // Handle debt account selection
    const debtGroup = document.getElementById("debt-account-group");
    if (debtGroup) {
        if (transaction.category === "Debt" && transaction.debt_account_id) {
            debtGroup.style.display = "block";

            // Find the debt account name for the dropdown
            const debtAccount = appState.appData.debtAccounts.find(d => d.id === transaction.debt_account_id);
            const debtSelect = document.getElementById("debt-account-select");
            if (debtSelect && debtAccount) {
                debtSelect.value = debtAccount.name;
            }
        } else {
            debtGroup.style.display = "none";
        }
    }

    // Scroll to form
    const form = document.getElementById("transaction-form");
    if (form) {
        form.scrollIntoView({ behavior: 'smooth' });
    }

    announceToScreenReader("Transaction loaded for editing");
}

function cancelEdit() {
    editingTransactionId = null;
    originalTransaction = null;

    // Reset form title and button text
    const formTitle = document.querySelector('.card__header h3');
    if (formTitle) {
        formTitle.textContent = 'Add New Transaction';
    }

    const submitBtn = document.querySelector('#transaction-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = 'Add Transaction';
    }

    // Hide cancel button
    hideCancelButton();

    // Reset form
    const form = document.getElementById("transaction-form");
    if (form) {
        form.reset();
    }
    const dateInput = document.getElementById("transaction-date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }
    const debtGroup = document.getElementById("debt-account-group");
    if (debtGroup) {
        debtGroup.style.display = "none";
    }

    announceToScreenReader("Edit cancelled");
}

function showCancelButton() {
    let cancelBtn = document.getElementById("cancel-edit-btn");
    if (!cancelBtn) {
        // Create cancel button if it doesn't exist
        const submitBtn = document.querySelector('#transaction-form button[type="submit"]');
        if (!submitBtn || !submitBtn.parentNode) return;
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancel-edit-btn';
        cancelBtn.className = 'btn btn--secondary';
        cancelBtn.textContent = 'Cancel Edit';
        cancelBtn.style.marginLeft = '10px';
        submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
    }
    cancelBtn.style.display = 'inline-block';
}

function hideCancelButton() {
    const cancelBtn = document.getElementById("cancel-edit-btn");
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
}

async function handleTransactionSubmit(event, appState, onUpdate) {
    event.preventDefault();
    
    // Clear previous errors
    clearFormErrors('transaction-form');

    try {
        const transactionData = {
            date: document.getElementById("transaction-date")?.value,
            account_id: parseInt(document.getElementById("transaction-account")?.value) || null,
            category: document.getElementById("transaction-category")?.value,
            description: document.getElementById("transaction-description")?.value,
            amount: safeParseFloat(document.getElementById("transaction-amount")?.value),
            cleared: document.getElementById("transaction-cleared")?.checked,
            debt_account_id: null
        };

        // Validate using validation schema
        const { errors, hasErrors } = validateForm(transactionData, ValidationSchemas.transaction);
        
        if (hasErrors) {
            // Show field-level errors
            Object.entries(errors).forEach(([field, error]) => {
                showFieldError(`transaction-${field}`, error);
            });
            showError("Please correct the errors in the form.");
            return;
        }

        // Handle debt category with sign guidance
        if (transactionData.category === "Debt") {
            const debtAccountName = document.getElementById("debt-account-select")?.value;
            if (!debtAccountName) {
                showError("Please select a debt account for this payment.");
                return;
            }

            const debtAccount = appState.appData.debtAccounts.find(d => d.name === debtAccountName);
            if (debtAccount) {
                transactionData.debt_account_id = debtAccount.id;
            }

            // Enforce sign consistency for debt: positive = charge (increase debt), negative = payment (decrease debt)
            if (transactionData.amount > 0 && !confirm("Positive amount for Debt will increase the debt balance (e.g., a charge). Proceed?")) {
                return;
            } else if (transactionData.amount < 0 && !confirm("Negative amount for Debt will decrease the debt balance (e.g., a payment). Proceed?")) {
                return;
            }
        } else {
            // Non-debt transactions need an account
            if (!transactionData.account_id || isNaN(transactionData.account_id)) {
                showError("Please select a valid account.");
                return;
            }
        }

        if (editingTransactionId) {
            // Update existing transaction
            await updateTransaction(editingTransactionId, transactionData, appState, onUpdate);
        } else {
            // Add new transaction
            await addNewTransaction(transactionData, appState, onUpdate);
        }

    } catch (error) {
        console.error("Error handling transaction:", error);
        showError("Failed to save transaction. " + error.message);
    }
}

async function addNewTransaction(transactionData, appState, onUpdate) {
    const savedTransaction = await db.addTransaction(transactionData);
    const newTransaction = {
        ...savedTransaction,
        amount: parseFloat(savedTransaction.amount),
    };

    appState.appData.transactions.unshift(newTransaction);

    // Update balances
    if (newTransaction.account_id) {
        updateCashAccountBalance(newTransaction.account_id, newTransaction.amount, appState);
    }

    if (newTransaction.category === 'Debt' && newTransaction.debt_account_id) {
        await updateDebtAccountBalance(newTransaction.debt_account_id, newTransaction.amount, appState);
    }

    // Reset form
    const form = document.getElementById("transaction-form");
    if (form) form.reset();
    const dateInput = document.getElementById("transaction-date");
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
    const debtGroup = document.getElementById("debt-account-group");
    if (debtGroup) debtGroup.style.display = "none";

    onUpdate();
    announceToScreenReader("Transaction added successfully");
}

async function updateTransaction(id, newTransactionData, appState, onUpdate) {
    if (!originalTransaction) {
        showError("Original transaction data not found.");
        return;
    }

    // First, reverse the effects of the original transaction
    await reverseTransactionEffects(originalTransaction, appState);

    // Update the transaction in the database
    const updatedTransaction = await db.updateTransaction(id, newTransactionData);

    // Update in app state
    const index = appState.appData.transactions.findIndex(t => t.id === id);
    if (index > -1) {
        appState.appData.transactions[index] = {
            ...updatedTransaction,
            amount: parseFloat(updatedTransaction.amount)
        };
    }

    // Apply the effects of the new transaction
    await applyTransactionEffects(updatedTransaction, appState);

    // Clean up edit state
    cancelEdit();

    onUpdate();
    announceToScreenReader("Transaction updated successfully");
}

async function reverseTransactionEffects(transaction, appState) {
    // Reverse cash account balance changes
    if (transaction.account_id) {
        updateCashAccountBalance(transaction.account_id, -transaction.amount, appState);
    }

    // Reverse debt account balance changes (note: sign is reversed correctly as -amount undoes the original effect)
    if (transaction.debt_account_id) {
        await updateDebtAccountBalance(transaction.debt_account_id, -transaction.amount, appState);
    }

    // Handle legacy debt transactions
    if (transaction.category === 'Debt') {
        let debtAccount;
        if (transaction.debt_account_id) {
            debtAccount = appState.appData.debtAccounts.find(d => d.id === transaction.debt_account_id);
        } else if (transaction.debt_account) {
            debtAccount = appState.appData.debtAccounts.find(d => d.name === transaction.debt_account);
            if (!debtAccount) {
                showError("Could not reverse debt payment: Account not found.");
                return;
            }
        }

        if (debtAccount) {
            const newBalance = debtAccount.balance - transaction.amount;
            await db.updateDebtBalance(debtAccount.id, newBalance);
            debtAccount.balance = newBalance;
        }
    }
}

async function applyTransactionEffects(transaction, appState) {
    const amount = parseFloat(transaction.amount);

    // Apply cash account balance changes
    if (transaction.account_id) {
        updateCashAccountBalance(transaction.account_id, amount, appState);
    }

    // Apply debt account balance changes
    if (transaction.debt_account_id) {
        await updateDebtAccountBalance(transaction.debt_account_id, amount, appState);
    }
}

function updateCashAccountBalance(accountId, amount, appState) {
    if (appState.updateAccountBalance) {
        appState.updateAccountBalance(accountId, amount);
    } else {
        const account = appState.appData.cashAccounts.find(a => a.id === accountId);
        if (account) {
            account.balance = (account.balance || 0) + amount;
        }
    }
}

async function updateDebtAccountBalance(debtAccountId, amount, appState) {
    const debtAccount = appState.appData.debtAccounts.find(d => d.id === debtAccountId);
    if (debtAccount) {
        const newBalance = debtAccount.balance + amount;
        await db.updateDebtBalance(debtAccount.id, newBalance);
        debtAccount.balance = newBalance;
    }
}

export function renderTransactions(appState, categoryFilter = currentCategoryFilter) {
    const { appData } = appState;
    const tbody = document.getElementById("transactions-table-body");
    if (!tbody) return;

    const filterSelect = document.getElementById("filter-category");
    if (filterSelect && categoryFilter) {
        filterSelect.value = categoryFilter;
    }

    let transactions = categoryFilter ?
        appData.transactions.filter(t => t.category === categoryFilter) :
        [...appData.transactions];

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (transactions.length === 0) {
        tbody.innerHTML = "<tr><td colspan=\"7\" class=\"no-transactions\">No transactions found</td></tr>";
        return;
    }

    tbody.innerHTML = transactions.map(t => {
        // Handle both cash account transactions and credit card transactions
        let accountName = 'Credit Card Transaction';

        if (t.account_id) {
            // Regular cash account transaction
            const account = appData.cashAccounts.find(a => a.id === t.account_id);
            accountName = account ? escapeHtml(account.name) : 'Unknown Account';
        } else if (t.debt_account_id) {
            // Credit card transaction - show the credit card name
            const debtAccount = appData.debtAccounts.find(d => d.id === t.debt_account_id);
            accountName = debtAccount ? `${escapeHtml(debtAccount.name)} (Credit Card)` : 'Unknown Credit Card';
        }

        let description = escapeHtml(t.description);

        // Add backward compatibility for old and new data
        if (t.category === "Debt") {
            let debtAccountName = '';
            if (t.debt_account_id) {
                const debtAccount = appData.debtAccounts.find(d => d.id === t.debt_account_id);
                if (debtAccount) {
                    debtAccountName = debtAccount.name;
                }
            } else if (t.debt_account) {
                debtAccountName = t.debt_account;
            }

            if (debtAccountName) {
                description += ` (${escapeHtml(debtAccountName)})`;
            }
        }

        // FIXED: Determine transaction color based on whether it's a cash or credit card transaction
        let amountClass;
        let displayAmount;

        if (t.account_id) {
            // Regular cash account transaction: positive = income (green), negative = expense (red)
            amountClass = t.amount >= 0 ? 'text-success' : 'text-error';
            displayAmount = formatCurrency(t.amount);
        } else if (t.debt_account_id) {
            // Credit card transaction: positive = expense/debt increase (red), negative = payment/debt decrease (green)
            amountClass = t.amount >= 0 ? 'text-error' : 'text-success';
            displayAmount = formatCurrency(t.amount);
        } else {
            // Fallback for transactions without proper account assignment
            amountClass = t.amount >= 0 ? 'text-success' : 'text-error';
            displayAmount = formatCurrency(t.amount);
        }

        // Highlight transaction being edited
        const isEditing = editingTransactionId === t.id;
        const rowClass = isEditing ? 'style="background-color: var(--color-secondary);"' : '';

        return `
        <tr ${rowClass}>
            <td>${formatDate(t.date)}</td>
            <td>${escapeHtml(accountName)}</td>
            <td>${escapeHtml(t.category)}</td>
            <td>${description}</td>
            <td class="${amountClass}">${displayAmount}</td>
            <td class="${t.cleared ? 'status-cleared' : 'status-pending'}">${t.cleared ? "Cleared" : "Pending"}</td>
            <td>
                <div class="transaction-actions">
                    <button class="btn btn-small btn-edit" data-id="${t.id}" ${isEditing ? 'disabled' : ''}>
                        ${isEditing ? 'Editing...' : 'Edit'}
                    </button>
                    <button class="btn btn-small btn-delete" data-id="${t.id}" ${isEditing ? 'disabled' : ''}>Delete</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function deleteTransaction(id, appState, onUpdate) {
    const transactionToDelete = appState.appData.transactions.find(t => t.id === id);
    if (!transactionToDelete) return;

    if (confirm("Are you sure you want to delete this transaction? This will adjust account balances and potentially revert recurring bill payments.")) {
        try {
            await db.deleteTransaction(id);

            // Handle both cash account and credit card transaction deletions
            if (transactionToDelete.account_id) {
                updateCashAccountBalance(transactionToDelete.account_id, -transactionToDelete.amount, appState);
            } else if (transactionToDelete.debt_account_id) {
                await updateDebtAccountBalance(transactionToDelete.debt_account_id, -transactionToDelete.amount, appState);
            }

            // Check if this was a recurring bill payment and revert the due date
            await handleRecurringBillReversion(transactionToDelete, appState);

            appState.appData.transactions = appState.appData.transactions.filter(t => t.id !== id);

            // Cancel edit if we're deleting the transaction being edited
            if (editingTransactionId === id) {
                cancelEdit();
            }

            onUpdate();
            announceToScreenReader("Transaction deleted");
        } catch (error) {
            console.error("Error deleting transaction:", error);
            showError("Failed to delete transaction.");
        }
    }
}

// Handle recurring bill due date reversion
async function handleRecurringBillReversion(deletedTransaction, appState) {
    const isRecurringPayment = deletedTransaction.description &&
        (deletedTransaction.description.includes('(Recurring)') ||
            deletedTransaction.description.includes('(Recurring - Credit Card)'));

    if (!isRecurringPayment) return;

    let billName = deletedTransaction.description
        .replace(' (Recurring)', '')
        .replace(' (Recurring - Credit Card)', '');

    const recurringBill = appState.appData.recurringBills.find(bill =>
        bill.name === billName || deletedTransaction.description.startsWith(bill.name)
    );

    if (!recurringBill) {
        console.warn('Could not find matching recurring bill for transaction:', deletedTransaction.description);
        return;
    }

    try {
        const currentDueDate = recurringBill.nextDue || recurringBill.next_due;
        const previousDueDate = calculatePreviousDueDate(currentDueDate, recurringBill.frequency);

        recurringBill.nextDue = previousDueDate;
        recurringBill.next_due = previousDueDate;

        await db.updateRecurringBill(recurringBill.id, {
            next_due: previousDueDate,
            active: recurringBill.active,
            payment_method: recurringBill.paymentMethod || recurringBill.payment_method,
            account_id: recurringBill.account_id,
            debt_account_id: recurringBill.debtAccountId || recurringBill.debt_account_id
        });
    } catch (error) {
        console.error('Error reverting recurring bill due date:', error);
    }
}

function calculatePreviousDueDate(currentDateStr, frequency) {
    if (!currentDateStr || !frequency) return currentDateStr;

    const currentDate = new Date(currentDateStr);
    const date = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));

    switch (frequency) {
        case 'weekly':
            date.setUTCDate(date.getUTCDate() - 7);
            break;
        case 'monthly':
            date.setUTCMonth(date.getUTCMonth() - 1);
            break;
        case 'quarterly':
            date.setUTCMonth(date.getUTCMonth() - 3);
            break;
        case 'semi-annually':
            date.setUTCMonth(date.getUTCMonth() - 6);
            break;
        case 'annually':
            date.setUTCFullYear(date.getUTCFullYear() - 1);
            break;
        default:
            return currentDateStr;
    }

    return date.toISOString().split('T')[0];
}