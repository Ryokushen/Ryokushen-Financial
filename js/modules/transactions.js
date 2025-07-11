// js/modules/transactions.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatDate, formatCurrency, getNextDueDate } from './utils.js';
import { showError, announceToScreenReader } from './ui.js';

let currentCategoryFilter = "";
let editingTransactionId = null;
let originalTransaction = null;

export function setupEventListeners(appState, onUpdate) {
    document.getElementById("transaction-form")?.addEventListener("submit", (e) => handleTransactionSubmit(e, appState, onUpdate));

    // NEW: Enhanced category change handler for Transfer
    document.getElementById("transaction-category")?.addEventListener("change", function () {
        const category = this.value;

        // Show/hide debt account group
        document.getElementById("debt-account-group").style.display = category === "Debt" ? "block" : "none";

        // NEW: Show/hide transfer account groups
        const transferFromGroup = document.getElementById("transfer-from-group");
        const transferToGroup = document.getElementById("transfer-to-group");
        const regularAccountGroup = document.querySelector('.form-group:has(#transaction-account)');

        if (category === "Transfer") {
            // Show transfer-specific fields, hide regular account field
            if (transferFromGroup) transferFromGroup.style.display = "block";
            if (transferToGroup) transferToGroup.style.display = "block";
            if (regularAccountGroup) regularAccountGroup.style.display = "none";
        } else {
            // Hide transfer-specific fields, show regular account field
            if (transferFromGroup) transferFromGroup.style.display = "none";
            if (transferToGroup) transferToGroup.style.display = "none";
            if (regularAccountGroup) regularAccountGroup.style.display = "block";
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
    document.getElementById("transaction-date").value = transaction.date;
    document.getElementById("transaction-category").value = transaction.category;
    document.getElementById("transaction-description").value = transaction.description;
    document.getElementById("transaction-amount").value = Math.abs(transaction.amount); // Always show positive for editing
    document.getElementById("transaction-cleared").checked = transaction.cleared;

    // Handle different transaction types
    if (transaction.category === "Transfer") {
        // For transfer transactions, we'll just edit them as regular transactions for now
        // Full transfer editing would require more complex logic to find the paired transaction
        document.getElementById("transaction-account").value = transaction.account_id || '';
        document.getElementById("transaction-category").dispatchEvent(new Event('change'));
    } else if (transaction.category === "Debt" && transaction.debt_account_id) {
        document.getElementById("debt-account-group").style.display = "block";
        const debtAccount = appState.appData.debtAccounts.find(d => d.id === transaction.debt_account_id);
        if (debtAccount) {
            document.getElementById("debt-account-select").value = debtAccount.name;
        }
    } else {
        document.getElementById("transaction-account").value = transaction.account_id || '';
    }

    // Trigger category change to show/hide appropriate fields
    document.getElementById("transaction-category").dispatchEvent(new Event('change'));

    // Scroll to form
    document.getElementById("transaction-form").scrollIntoView({ behavior: 'smooth' });

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
    document.getElementById("transaction-form").reset();
    document.getElementById("transaction-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("debt-account-group").style.display = "none";

    // Reset transfer fields visibility
    const transferFromGroup = document.getElementById("transfer-from-group");
    const transferToGroup = document.getElementById("transfer-to-group");
    const regularAccountGroup = document.querySelector('.form-group:has(#transaction-account)');

    if (transferFromGroup) transferFromGroup.style.display = "none";
    if (transferToGroup) transferToGroup.style.display = "none";
    if (regularAccountGroup) regularAccountGroup.style.display = "block";

    announceToScreenReader("Edit cancelled");
}

function showCancelButton() {
    let cancelBtn = document.getElementById("cancel-edit-btn");
    if (!cancelBtn) {
        // Create cancel button if it doesn't exist
        const submitBtn = document.querySelector('#transaction-form button[type="submit"]');
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.id = 'cancel-edit-btn';
        cancelBtn.className = 'btn btn--secondary';
        cancelBtn.textContent = 'Cancel Edit';
        cancelBtn.style.marginLeft = '10px';

        if (submitBtn && submitBtn.parentNode) {
            submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
        }
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

    try {
        const category = document.getElementById("transaction-category").value;
        const amount = safeParseFloat(document.getElementById("transaction-amount").value);
        const date = document.getElementById("transaction-date").value;
        const description = document.getElementById("transaction-description").value;
        const cleared = document.getElementById("transaction-cleared").checked;

        // Validation
        if (!date || !description) {
            showError("Please fill in all required fields.");
            return;
        }

        if (isNaN(amount) || amount <= 0) {
            showError("Please enter a valid positive amount.");
            return;
        }

        // NEW: Handle Transfer category differently
        if (category === "Transfer") {
            return await handleTransferTransaction(amount, date, description, cleared, appState, onUpdate);
        }

        // Handle regular transactions
        const transactionData = {
            date: date,
            account_id: null,
            category: category,
            description: description,
            amount: amount,
            cleared: cleared,
            debt_account_id: null
        };

        // Handle debt category
        if (category === "Debt") {
            const debtAccountName = document.getElementById("debt-account-select").value;
            if (!debtAccountName) {
                showError("Please select a debt account for this payment.");
                return;
            }

            const debtAccount = appState.appData.debtAccounts.find(d => d.name === debtAccountName);
            if (debtAccount) {
                transactionData.debt_account_id = debtAccount.id;
                transactionData.amount = -amount; // Debt payments are negative
            }
        } else {
            // Non-debt transactions need an account
            const accountId = parseInt(document.getElementById("transaction-account").value);
            if (!accountId || isNaN(accountId)) {
                showError("Please select a valid account.");
                return;
            }
            transactionData.account_id = accountId;

            // Determine if amount should be negative based on category
            if (['Bills', 'Groceries', 'Fees', 'Misc'].includes(category)) {
                transactionData.amount = -amount; // Expenses are negative
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

// NEW: Handle transfer transactions with dual account updates
async function handleTransferTransaction(amount, date, description, cleared, appState, onUpdate) {
    const fromAccountId = parseInt(document.getElementById("transfer-from-account").value);
    const toAccountId = parseInt(document.getElementById("transfer-to-account").value);

    // Validation
    if (!fromAccountId || !toAccountId) {
        showError("Please select both source and destination accounts for transfers.");
        return;
    }

    if (fromAccountId === toAccountId) {
        showError("Cannot transfer to the same account.");
        return;
    }

    // Find accounts to validate they exist and check balance
    const fromAccount = [...appState.appData.cashAccounts, ...appState.appData.investmentAccounts]
        .find(acc => acc.id === fromAccountId);
    const toAccount = [...appState.appData.cashAccounts, ...appState.appData.investmentAccounts]
        .find(acc => acc.id === toAccountId);

    if (!fromAccount || !toAccount) {
        showError("One or both selected accounts not found.");
        return;
    }

    // Check sufficient balance for cash accounts
    if (appState.appData.cashAccounts.find(acc => acc.id === fromAccountId)) {
        if (fromAccount.balance < amount) {
            showError(`Insufficient funds. Available: ${formatCurrency(fromAccount.balance)}`);
            return;
        }
    }

    try {
        // Create withdrawal transaction
        const withdrawalData = {
            date: date,
            account_id: appState.appData.cashAccounts.find(acc => acc.id === fromAccountId) ? fromAccountId : null,
            category: "Transfer",
            description: `Transfer to ${toAccount.name}`,
            amount: -amount,
            cleared: cleared,
            debt_account_id: null
        };

        const savedWithdrawal = await db.addTransaction(withdrawalData);
        appState.appData.transactions.unshift({
            ...savedWithdrawal,
            amount: parseFloat(savedWithdrawal.amount)
        });

        // Update source account balance
        if (appState.appData.cashAccounts.find(acc => acc.id === fromAccountId)) {
            // Cash account - update through transaction system
            if (appState.updateAccountBalance) {
                appState.updateAccountBalance(fromAccountId, -amount);
            } else {
                fromAccount.balance -= amount;
            }
        } else {
            // Investment account - update directly
            fromAccount.balance -= amount;
            await db.updateInvestmentAccount(fromAccountId, { balance: fromAccount.balance });
        }

        // Create deposit transaction (if destination is cash account)
        if (appState.appData.cashAccounts.find(acc => acc.id === toAccountId)) {
            const depositData = {
                date: date,
                account_id: toAccountId,
                category: "Transfer",
                description: `Transfer from ${fromAccount.name}`,
                amount: amount,
                cleared: cleared,
                debt_account_id: null
            };

            const savedDeposit = await db.addTransaction(depositData);
            appState.appData.transactions.unshift({
                ...savedDeposit,
                amount: parseFloat(savedDeposit.amount)
            });

            // Update destination cash account balance
            if (appState.updateAccountBalance) {
                appState.updateAccountBalance(toAccountId, amount);
            } else {
                toAccount.balance += amount;
            }
        } else {
            // Investment account - update directly
            toAccount.balance += amount;
            await db.updateInvestmentAccount(toAccountId, { balance: toAccount.balance });
        }

        // Reset form
        document.getElementById("transaction-form").reset();
        document.getElementById("transaction-date").value = new Date().toISOString().split("T")[0];
        document.getElementById("transaction-category").dispatchEvent(new Event('change'));

        onUpdate();
        announceToScreenReader(`Successfully transferred ${formatCurrency(amount)} from ${fromAccount.name} to ${toAccount.name}`);

    } catch (error) {
        console.error("Error processing transfer:", error);
        showError("Failed to process transfer. Please try again.");
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
    document.getElementById("transaction-form").reset();
    document.getElementById("transaction-date").value = new Date().toISOString().split("T")[0];
    document.getElementById("debt-account-group").style.display = "none";

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

    // Reverse debt account balance changes
    if (transaction.debt_account_id) {
        await updateDebtAccountBalance(transaction.debt_account_id, -transaction.amount, appState);
    }

    // Handle legacy debt transactions
    if (transaction.category === 'Debt' && transaction.debt_account && !transaction.debt_account_id) {
        const debtAccount = appState.appData.debtAccounts.find(d => d.name === transaction.debt_account);
        if (debtAccount) {
            await updateDebtAccountBalance(debtAccount.id, -transaction.amount, appState);
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
            <td>${accountName}</td>
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
                    const newBalance = debtAccount.balance - transactionToDelete.amount;
                    await db.updateDebtBalance(debtAccount.id, newBalance);
                    debtAccount.balance = newBalance;
                }
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

        console.log(`Reverted ${billName} due date from ${currentDueDate} to ${previousDueDate}`);
    } catch (error) {
        console.error('Error reverting recurring bill due date:', error);
    }
}

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