// js/modules/transactions.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatDate, formatCurrency, getNextDueDate } from './utils.js';
import { showError, announceToScreenReader } from './ui.js';

let currentCategoryFilter = "";

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("transaction-form")?.addEventListener("submit", (e) => handleTransactionSubmit(e, appState, onUpdate));

    document.getElementById("transaction-category")?.addEventListener("change", function () {
        document.getElementById("debt-account-group").style.display = this.value === "Debt" ? "block" : "none";
    });

    document.getElementById("filter-category")?.addEventListener("change", (e) => {
        currentCategoryFilter = e.target.value;
        renderTransactions(appState, currentCategoryFilter);
    });

    document.getElementById("transactions-table-body")?.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-delete')) {
            const transactionId = parseInt(event.target.getAttribute('data-id'));
            deleteTransaction(transactionId, appState, onUpdate);
        }
    });
}

async function handleTransactionSubmit(event, appState, onUpdate) {
    event.preventDefault();
    try {
        const transactionData = {
            date: document.getElementById("transaction-date").value,
            account_id: parseInt(document.getElementById("transaction-account").value),
            category: document.getElementById("transaction-category").value,
            description: document.getElementById("transaction-description").value,
            amount: safeParseFloat(document.getElementById("transaction-amount").value),
            cleared: document.getElementById("transaction-cleared").checked,
            debt_account_id: null
        };

        if (!transactionData.account_id || isNaN(transactionData.account_id)) {
            showError("Please select a valid account.");
            return;
        }

        if (!transactionData.date || !transactionData.description) {
            showError("Please fill in all required fields.");
            return;
        }

        if (isNaN(transactionData.amount) || transactionData.amount === 0) {
            showError("Please enter a valid amount.");
            return;
        }

        if (transactionData.category === "Debt") {
            const debtAccountName = document.getElementById("debt-account-select").value;
            if (!debtAccountName) {
                showError("Please select a debt account for this payment.");
                return;
            }
            // INSERT: Additional check if no options available (empty select)
            const debtAccountSelect = document.getElementById("debt-account-select");
            if (debtAccountSelect.options.length <= 1) {  // Only the placeholder
                showError("No debt accounts available. Please add one first.");
                return;
            }
        }

        const savedTransaction = await db.addTransaction(transactionData);
        const newTransaction = {
            ...savedTransaction,
            amount: parseFloat(savedTransaction.amount),
        };

        appState.appData.transactions.unshift(newTransaction);

        if (appState.updateAccountBalance) {
            appState.updateAccountBalance(newTransaction.account_id, newTransaction.amount);
        } else {
            const account = appState.appData.cashAccounts.find(a => a.id === newTransaction.account_id);
            if (account) {
                account.balance = (account.balance || 0) + newTransaction.amount;
            }
        }

        if (newTransaction.category === 'Debt' && newTransaction.debt_account_id) {
            const debtAccount = appState.appData.debtAccounts.find(d => d.id === newTransaction.debt_account_id);
            if (debtAccount) {
                const newBalance = debtAccount.balance + newTransaction.amount; // Amount is negative
                await db.updateDebtBalance(debtAccount.id, newBalance);
                debtAccount.balance = newBalance;
            }
        }

        event.target.reset();
        document.getElementById("transaction-date").value = new Date().toISOString().split("T")[0];
        document.getElementById("debt-account-group").style.display = "none";
        onUpdate();
        announceToScreenReader("Transaction added successfully");
    } catch (error) {
        console.error("Error adding transaction:", error);
        showError("Failed to add transaction. " + error.message);
    }
}

export function renderTransactions(appState, categoryFilter = currentCategoryFilter) {
    const { appData } = appState;
    const tbody = document.getElementById("transactions-table-body");
    const filterSelect = document.getElementById("filter-category");

    if (!tbody) return;

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
        // FIX 1: Handle both cash account transactions and credit card transactions
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

        // FIX: Add backward compatibility for old and new data
        if (t.category === "Debt") {
            let debtAccountName = '';
            if (t.debt_account_id) { // Handle new transactions with an ID
                const debtAccount = appData.debtAccounts.find(d => d.id === t.debt_account_id);
                if (debtAccount) {
                    debtAccountName = debtAccount.name;
                }
            } else if (t.debt_account) { // Handle old transactions with just a name
                debtAccountName = t.debt_account;
            }

            if (debtAccountName) {
                description += ` (${escapeHtml(debtAccountName)})`;
            }
        }

        return `
        <tr>
            <td>${formatDate(t.date)}</td>
            <td>${accountName}</td>
            <td>${escapeHtml(t.category)}</td>
            <td>${description}</td>
            <td class="${t.amount >= 0 ? 'text-success' : 'text-error'}">${formatCurrency(t.amount)}</td>
            <td class="${t.cleared ? 'status-cleared' : 'status-pending'}">${t.cleared ? "Cleared" : "Pending"}</td>
            <td><div class="transaction-actions"><button class="btn btn-small btn-delete" data-id="${t.id}">Delete</button></div></td>
        </tr>`;
    }).join('');
}

async function deleteTransaction(id, appState, onUpdate) {
    const transactionToDelete = appState.appData.transactions.find(t => t.id === id);
    if (!transactionToDelete) return;

    if (confirm("Are you sure you want to delete this transaction? This will adjust account balances and potentially revert recurring bill payments.")) {
        try {
            await db.deleteTransaction(id);

            // FIX 2: Handle both cash account and credit card transaction deletions
            if (transactionToDelete.account_id) {
                // Regular cash account transaction
                if (appState.updateAccountBalance) {
                    appState.updateAccountBalance(transactionToDelete.account_id, -transactionToDelete.amount);
                } else {
                    const account = appState.appData.cashAccounts.find(a => a.id === transactionToDelete.account_id);
                    if (account) {
                        account.balance -= transactionToDelete.amount;
                    }
                }
            } else if (transactionToDelete.debt_account_id) {
                // Credit card transaction - reduce the debt balance
                const debtAccount = appState.appData.debtAccounts.find(d => d.id === transactionToDelete.debt_account_id);
                if (debtAccount) {
                    const newBalance = debtAccount.balance - transactionToDelete.amount; // Reverse the charge
                    await db.updateDebtBalance(debtAccount.id, newBalance);
                    debtAccount.balance = newBalance;
                }
            }

            // Handle legacy debt transactions
            if (transactionToDelete.category === 'Debt') {
                let debtAccount;
                if (transactionToDelete.debt_account_id) {
                    debtAccount = appState.appData.debtAccounts.find(d => d.id === transactionToDelete.debt_account_id);
                } else if (transactionToDelete.debt_account) {
                    debtAccount = appState.appData.debtAccounts.find(d => d.name === transactionToDelete.debt_account);
                    if (!debtAccount) {
                        console.error(`Debt account "${transactionToDelete.debt_account}" not found for reversal.`);
                        showError("Could not reverse debt payment: Account not found.");
                        return;
                    }
                }

                if (debtAccount) {
                    const newBalance = debtAccount.balance - transactionToDelete.amount; // Reverses the payment
                    await db.updateDebtBalance(debtAccount.id, newBalance);
                    debtAccount.balance = newBalance;
                }
            }

            // FIX 3: Check if this was a recurring bill payment and revert the due date
            await handleRecurringBillReversion(transactionToDelete, appState);

            appState.appData.transactions = appState.appData.transactions.filter(t => t.id !== id);

            onUpdate();
            announceToScreenReader("Transaction deleted");
        } catch (error) {
            console.error("Error deleting transaction:", error);
            showError("Failed to delete transaction.");
        }
    }
}

// FIX 3: New function to handle recurring bill due date reversion
async function handleRecurringBillReversion(deletedTransaction, appState) {
    // Check if this transaction was from a recurring bill payment
    const isRecurringPayment = deletedTransaction.description &&
        (deletedTransaction.description.includes('(Recurring)') ||
            deletedTransaction.description.includes('(Recurring - Credit Card)'));

    if (!isRecurringPayment) return;

    // Extract the bill name from the description
    let billName = deletedTransaction.description
        .replace(' (Recurring)', '')
        .replace(' (Recurring - Credit Card)', '');

    // Find the matching recurring bill
    const recurringBill = appState.appData.recurringBills.find(bill =>
        bill.name === billName || deletedTransaction.description.startsWith(bill.name)
    );

    if (!recurringBill) {
        console.warn('Could not find matching recurring bill for transaction:', deletedTransaction.description);
        return;
    }

    try {
        // Calculate what the previous due date should have been
        const currentDueDate = recurringBill.nextDue || recurringBill.next_due;
        const previousDueDate = calculatePreviousDueDate(currentDueDate, recurringBill.frequency);

        // Update the bill's due date back to the previous date
        recurringBill.nextDue = previousDueDate;
        recurringBill.next_due = previousDueDate;

        // Update in database
        await db.updateRecurringBill(recurringBill.id, {
            next_due: previousDueDate,
            active: recurringBill.active,
            payment_method: recurringBill.paymentMethod || recurringBill.payment_method,
            account_id: recurringBill.account_id,
            debt_account_id: recurringBill.debtAccountId || recurringBill.debt_account_id
        });

        console.log(`Reverted ${billName} due date from ${currentDueDate} to ${previousDueDate}`);
    } catch (error) {
        console.error('Error reverting recurring bill due date:', error);
        // Don't throw - this is a nice-to-have feature, don't break the deletion
    }
}

// Helper function to calculate the previous due date based on frequency
function calculatePreviousDueDate(currentDateStr, frequency) {
    if (!currentDateStr || !frequency) return currentDateStr;

    const currentDate = new Date(currentDateStr);
    const date = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate());

    switch (frequency) {
        case 'weekly':
            date.setDate(date.getDate() - 7);
            break;
        case 'monthly':
            date.setMonth(date.getMonth() - 1);
            break;
        case 'quarterly':
            date.setMonth(date.getMonth() - 3);
            break;
        case 'semi-annually':
            date.setMonth(date.getMonth() - 6);
            break;
        case 'annually':
            date.setFullYear(date.getFullYear() - 1);
            break;
        default:
            return currentDateStr;
    }

    return date.toISOString().split('T')[0];
}