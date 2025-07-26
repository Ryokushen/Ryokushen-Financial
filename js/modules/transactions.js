// js/modules/transactions.js
import db from '../database.js';
import { safeParseFloat, escapeHtml, formatDate, formatCurrency, getNextDueDate } from './utils.js';
import { showError, announceToScreenReader } from './ui.js';
import { validateForm, ValidationSchemas, showFieldError, clearFormErrors, ValidationRules } from './validation.js';
import { handleSavingsGoalTransactionDeletion } from './savings.js';
import { debug } from './debug.js';
import { addMoney, subtractMoney } from './financialMath.js';
import { dataIndex } from './dataIndex.js';
import { debounce } from './performanceUtils.js';
import { populateFormFromData, extractFormData } from './formUtils.js';
import { timeBudgets } from './timeBudgets.js';
import { eventManager } from './eventManager.js';
import { getCategoryIcon } from './categories.js';
import { transactionManager } from './transactionManager.js';

let currentCategoryFilter = "";
let editingTransactionId = null;
let originalTransaction = null;
let appStateReference = null;

// Function to populate the transfer-to-account dropdown
function populateTransferToAccount(type, excludeAccount = null) {
    const transferToSelect = document.getElementById("transfer-to-account");
    if (!transferToSelect) return;
    
    // Clear existing options
    transferToSelect.innerHTML = '<option value="">— Select destination account —</option>';
    
    if (!appStateReference || !appStateReference.appData) return;
    
    const { cashAccounts, debtAccounts } = appStateReference.appData;
    
    if (type === 'payment') {
        // For payments, show only credit card (debt) accounts
        const creditCards = debtAccounts.filter(a => a.type === 'Credit Card');
        creditCards.forEach(account => {
            const option = document.createElement('option');
            option.value = `cc_${account.id}`;
            option.textContent = account.name;
            transferToSelect.appendChild(option);
        });
        
        if (creditCards.length === 0) {
            transferToSelect.innerHTML = '<option value="">No credit cards available</option>';
        }
    } else if (type === 'transfer') {
        // For transfers, show cash accounts excluding the selected from account
        const activeAccounts = cashAccounts.filter(a => 
            a.isActive && `cash_${a.id}` !== excludeAccount
        );
        
        activeAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = `cash_${account.id}`;
            option.textContent = account.name;
            transferToSelect.appendChild(option);
        });
        
        if (activeAccounts.length === 0) {
            transferToSelect.innerHTML = '<option value="">No other cash accounts available</option>';
        }
    }
}

export function setupEventListeners(appState, onUpdate) {
    
    // Store reference to appState for use in other functions
    appStateReference = appState;
    
    // Add transaction button for enhanced table
    const addTransactionBtn = document.getElementById('add-transaction-btn');
    if (addTransactionBtn) {
        eventManager.addEventListener(addTransactionBtn, 'click', () => {
            // Show the transaction form modal
            const formSection = document.querySelector('.transaction-form-section');
            if (formSection) {
                formSection.style.display = 'block';
                // Focus on first input
                const dateField = document.getElementById('transaction-date');
                if (dateField && !dateField.value) {
                    dateField.value = new Date().toISOString().split('T')[0];
                }
                dateField?.focus();
            }
        });
    }
    
    // Voice add transaction button
    const voiceAddTransactionBtn = document.getElementById('voice-add-transaction-btn');
    if (voiceAddTransactionBtn) {
        eventManager.addEventListener(voiceAddTransactionBtn, 'click', () => {
            // First, show the transaction form
            const formSection = document.querySelector('.transaction-form-section');
            if (formSection) {
                formSection.style.display = 'block';
                
                // Set today's date if not already set
                const dateField = document.getElementById('transaction-date');
                if (dateField && !dateField.value) {
                    dateField.value = new Date().toISOString().split('T')[0];
                }
                
                // Focus on the description field (best for voice input)
                const descField = document.getElementById('transaction-description');
                if (descField) {
                    setTimeout(() => descField.focus(), 100);
                }
            }
            
            // Then trigger voice command for transaction input
            if (window.globalVoiceInterface) {
                // Add a small delay to ensure form is visible
                setTimeout(() => {
                    window.globalVoiceInterface.startListening();
                }, 200);
            } else {
                showError('Voice commands are not available');
            }
        });
    }
    
    // Cancel transaction button
    const cancelTransactionBtn = document.getElementById('cancel-transaction-btn');
    if (cancelTransactionBtn) {
        eventManager.addEventListener(cancelTransactionBtn, 'click', () => {
            const formSection = document.querySelector('.transaction-form-section');
            if (formSection) {
                formSection.style.display = 'none';
            }
            // Reset the form
            const form = document.getElementById('transaction-form');
            if (form) {
                form.reset();
                // Reset date to today
                const dateField = document.getElementById('transaction-date');
                if (dateField) {
                    dateField.value = new Date().toISOString().split('T')[0];
                }
            }
            // Cancel any ongoing voice input
            if (window.voiceInput && window.voiceInput.listening) {
                window.voiceInput.stopListening();
            }
        });
    }
    
    // Helper to add and track event listeners
    const addEventListener = (elementId, event, handler) => {
        const element = document.getElementById(elementId);
        if (element) {
            eventManager.addEventListener(element, event, handler);
        }
    };
    
    // Transaction form submit
    const transactionSubmitHandler = (e) => handleTransactionSubmit(e, appState, onUpdate);
    addEventListener("transaction-form", "submit", transactionSubmitHandler);
    
    // Add account change listener
    const transactionAccount = document.getElementById("transaction-account");
    if (transactionAccount) {
        eventManager.addEventListener(transactionAccount, "change", function () {
        const categoryValue = document.getElementById("transaction-category")?.value;
        
        // Warn about Debt category with credit cards
        if (categoryValue === "Debt" && this.value && this.value.startsWith('cc_')) {
            showError("For credit card transactions, please use a regular category instead of 'Debt'. The 'Debt' category is for non-account debt payments.");
            document.getElementById("transaction-category").value = ""; // Reset the category
        }
        
        // For transfers, update the to-account dropdown to exclude the selected from account
        if (categoryValue === "Transfer") {
            populateTransferToAccount('transfer', this.value);
        }
        
        // For payments, only allow cash accounts in the from dropdown
        if (categoryValue === "Payment" && this.value && this.value.startsWith('cc_')) {
            showError("For payments, please select a cash account as the source. Credit card accounts cannot be used to pay other debts.");
            this.value = ""; // Reset the selection
        }
        });
    }

    const transactionCategory = document.getElementById("transaction-category");
    if (transactionCategory) {
        eventManager.addEventListener(transactionCategory, "change", function () {
        const debtGroup = document.getElementById("debt-account-group");
        const transferGroup = document.getElementById("transfer-account-group");
        const accountLabel = document.querySelector('label[for="transaction-account"]');
        const transferToAccount = document.getElementById("transfer-to-account");
        
        // Hide all special groups by default
        if (debtGroup) debtGroup.style.display = "none";
        if (transferGroup) transferGroup.style.display = "none";
        
        // Reset account label
        if (accountLabel) accountLabel.textContent = "Account";
        
        // Handle special categories
        if (this.value === "Debt") {
            if (debtGroup) debtGroup.style.display = "block";
        } else if (this.value === "Payment" || this.value === "Transfer") {
            // Show transfer account group
            if (transferGroup) transferGroup.style.display = "block";
            
            // Update labels based on category
            if (this.value === "Payment") {
                if (accountLabel) accountLabel.textContent = "From Account (Cash)";
                // Populate transfer-to-account with debt accounts for payments
                populateTransferToAccount('payment');
            } else if (this.value === "Transfer") {
                if (accountLabel) accountLabel.textContent = "From Account";
                // Populate transfer-to-account with cash accounts for transfers
                populateTransferToAccount('transfer');
            }
            
            // Clear the to-account selection
            if (transferToAccount) transferToAccount.value = "";
        }
        
        // Warn users about using Debt category with credit card accounts
        const accountValue = document.getElementById("transaction-account")?.value;
        if (this.value === "Debt" && accountValue && accountValue.startsWith('cc_')) {
            showError("For credit card transactions, please use a regular category instead of 'Debt'. For payments, use the 'Payment' category. The 'Debt' category is for non-account debt payments.");
            this.value = ""; // Reset the category
        }
        });
    }

    // Debounced filter handler for better performance
    const debouncedFilter = debounce((e) => {
        currentCategoryFilter = e.target.value;
        renderTransactions(appState, currentCategoryFilter);
    }, 300);
    
    const filterCategory = document.getElementById("filter-category");
    if (filterCategory) {
        eventManager.addEventListener(filterCategory, "change", debouncedFilter);
    }

    const transactionsTableBody = document.getElementById("transactions-table-body");
    if (transactionsTableBody) {
        eventManager.addEventListener(transactionsTableBody, 'click', (event) => {
        const dataId = event.target.getAttribute('data-id');
        if (!dataId) return; // Skip if no data-id attribute
        
        const transactionId = parseInt(dataId);
        if (isNaN(transactionId)) {
            debug.error('Invalid transaction ID:', dataId);
            return;
        }

        if (event.target.classList.contains('btn-delete-transaction')) {
            event.stopPropagation();
            deleteTransaction(transactionId, appState, onUpdate);
        } else if (event.target.classList.contains('btn-edit-transaction')) {
            event.stopPropagation();
            editTransaction(transactionId, appState);
        }
        });
    }

    // Cancel edit button
    const cancelEditBtn = document.getElementById("cancel-edit-btn");
    if (cancelEditBtn) {
        eventManager.addEventListener(cancelEditBtn, 'click', () => {
        debug.log('Cancel edit button clicked');
        cancelEdit();
        });
    }

    // Voice input button
    setupVoiceInput();
    
    // Listen for transaction categorization from Smart Rules
    eventManager.addEventListener(window, 'transaction:categorized', (event) => {
        if (event.detail && event.detail.transactionId) {
            const { transactionId, newCategory } = event.detail;
            
            // Update the transaction in app state
            const transaction = appState.appData.transactions.find(t => t.id === transactionId);
            if (transaction) {
                transaction.category = newCategory;
                
                // Refresh the transaction display
                renderTransactions(appState, currentCategoryFilter);
                
                debug.log(`Transaction ${transactionId} categorized as ${newCategory}`);
            }
        }
    });
    
    // Listen for request to refresh all transactions
    eventManager.addEventListener(window, 'transactions:refresh', async () => {
        try {
            // Reload transactions from database
            const freshTransactions = await db.getTransactions();
            appState.appData.transactions = freshTransactions;
            
            // Refresh the display
            renderTransactions(appState, currentCategoryFilter);
            
            debug.log('Transactions refreshed from database');
        } catch (error) {
            debug.error('Failed to refresh transactions:', error);
        }
    });
}

async function setupVoiceInput() {
    const voiceButton = document.getElementById('voice-input-btn');
    const descriptionInput = document.getElementById('transaction-description');
    
    if (!voiceButton || !descriptionInput) return;

    // Lazy load voice module only when needed
    let voiceInput = null;
    
    eventManager.addEventListener(voiceButton, 'click', async () => {
        try {
            // Load voice module on first use
            if (!voiceInput) {
                const { voiceInput: VoiceInput } = await import('./voice/voiceInput.js');
                voiceInput = VoiceInput;
                
                // Check browser support
                if (!voiceInput.isSupported) {
                    document.body.classList.add('no-voice-support');
                    voiceButton.disabled = true;
                    showError('Voice input is not supported in your browser. Please use Chrome or Safari.');
                    return;
                }
            }

            // Toggle voice input
            if (voiceInput.listening) {
                voiceInput.stopListening();
                voiceButton.classList.remove('recording');
            } else {
                const started = await voiceInput.startListening(descriptionInput, {
                    onResult: (result) => {
                        if (result.isFinal) {
                            voiceButton.classList.remove('recording');
                            announceToScreenReader('Voice input complete');
                        }
                    },
                    onSmartParsed: (smartResult) => {
                        // Handle smart parsing results
                        const { extractedData, validation, fillResult } = smartResult;
                        
                        if (validation.warnings.length > 0) {
                            debug.warn('Voice parsing warnings:', validation.warnings);
                        }
                        
                        if (fillResult.success) {
                            announceToScreenReader(`Smart voice input filled ${fillResult.fieldsChanged.length} fields`);
                        }
                    },
                    onError: (error) => {
                        voiceButton.classList.remove('recording');
                        showError(`Voice input error: ${error}`);
                    },
                    onEnd: () => {
                        voiceButton.classList.remove('recording');
                    }
                });

                if (started) {
                    voiceButton.classList.add('recording');
                    announceToScreenReader('Voice input started. Speak now.');
                }
            }
        } catch (error) {
            debug.error('Failed to setup voice input:', error);
            showError('Voice input is not available.');
            voiceButton.disabled = true;
        }
    });
}

function editTransaction(id, appState) {
    debug.log('editTransaction called with id:', id);
    const transaction = appState.appData.transactions.find(t => t.id === id);
    if (!transaction) {
        showError("Transaction not found.");
        return;
    }
    debug.log('Found transaction:', transaction);

    // Store the original transaction for reverting changes (deep clone)
    originalTransaction = JSON.parse(JSON.stringify(transaction));
    editingTransactionId = id;

    // Update form title and button text
    const formTitle = document.querySelector('.card__header h3');
    debug.log('Form title element:', formTitle);
    if (formTitle) {
        formTitle.textContent = 'Edit Transaction';
    }

    const submitBtn = document.querySelector('#transaction-form button[type="submit"]');
    debug.log('Submit button element:', submitBtn);
    if (submitBtn) {
        submitBtn.textContent = 'Update Transaction';
    }

    // Show cancel button
    showCancelButton();

    // Populate form with transaction data using formUtils
    const formData = {
        date: transaction.date,
        account: '', // Will be set below with proper format
        category: transaction.category,
        description: transaction.description,
        amount: transaction.amount,
        cleared: transaction.cleared || false
    };
    
    // Set the account value in the correct format
    if (transaction.debt_account_id && !transaction.account_id) {
        // This is a credit card transaction
        formData.account = `cc_${transaction.debt_account_id}`;
        
        // Reverse the sign convention for user-friendly editing
        // Credit Card Sign Convention for Edit Mode:
        // - Stored purchases (negative) → Display as positive for editing
        // - Stored payments (positive) → Display as negative for editing
        // This maintains consistency with how users initially enter amounts
        
        if (transaction.amount < 0) {
            // Stored purchase (negative) -> show as positive
            formData.amount = Math.abs(transaction.amount);
            debug.log('Edit mode - Credit card purchase:', transaction.amount, 'displayed as:', formData.amount);
        } else if (transaction.amount > 0) {
            // Stored payment (positive) -> show as negative
            formData.amount = -Math.abs(transaction.amount);
            debug.log('Edit mode - Credit card payment:', transaction.amount, 'displayed as:', formData.amount);
        }
    } else if (transaction.account_id) {
        // This is a cash account transaction
        formData.account = `cash_${transaction.account_id}`;
    }
    
    // Add debt account if applicable (for old debt category transactions)
    if (transaction.category === "Debt" && transaction.debt_account_id) {
        const debtAccount = appState.appData.debtAccounts.find(d => d.id === transaction.debt_account_id);
        if (debtAccount) {
            formData['debt-account-select'] = debtAccount.name;
        }
    }
    
    // Debug log to check form data
    debug.log('Editing transaction with formData:', formData);
    
    // Check if form fields exist before populating
    const dateField = document.getElementById('transaction-date');
    const accountField = document.getElementById('transaction-account');
    const categoryField = document.getElementById('transaction-category');
    const descriptionField = document.getElementById('transaction-description');
    const amountField = document.getElementById('transaction-amount');
    const clearedField = document.getElementById('transaction-cleared');
    
    debug.log('Form fields found:', {
        date: !!dateField,
        account: !!accountField,
        category: !!categoryField,
        description: !!descriptionField,
        amount: !!amountField,
        cleared: !!clearedField
    });
    
    // Populate fields manually if they exist
    if (dateField) dateField.value = formData.date;
    if (accountField) accountField.value = formData.account;
    if (categoryField) categoryField.value = formData.category;
    if (descriptionField) descriptionField.value = formData.description;
    if (amountField) amountField.value = formData.amount;
    if (clearedField) clearedField.checked = formData.cleared;

    // Handle debt account visibility
    const debtGroup = document.getElementById("debt-account-group");
    if (debtGroup) {
        debtGroup.style.display = transaction.category === "Debt" ? "block" : "none";
    }

    // Show the transaction form section
    const formSection = document.querySelector('.transaction-form-section');
    if (formSection) {
        formSection.style.display = 'block';
    }

    // Scroll to form
    const form = document.getElementById("transaction-form");
    if (form) {
        form.scrollIntoView({ behavior: 'smooth' });
    }

    announceToScreenReader("Transaction loaded for editing");
}

function cancelEdit() {
    debug.log('cancelEdit called');
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
        
        // Reset the account dropdown to default
        const accountSelect = document.getElementById("transaction-account");
        if (accountSelect) {
            accountSelect.value = "";
        }
    }
    const dateInput = document.getElementById("transaction-date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }
    const debtGroup = document.getElementById("debt-account-group");
    if (debtGroup) {
        debtGroup.style.display = "none";
    }
    const transferGroup = document.getElementById("transfer-account-group");
    if (transferGroup) {
        transferGroup.style.display = "none";
    }
    
    // Reset account label
    const accountLabel = document.querySelector('label[for="transaction-account"]');
    if (accountLabel) {
        accountLabel.textContent = "Account";
    }

    // Re-render transactions to remove the highlighted row
    if (appStateReference) {
        renderTransactions(appStateReference);
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
        
        // Add event listener to the newly created button
        eventManager.addEventListener(cancelBtn, 'click', () => {
            debug.log('Cancel edit button clicked (from dynamic creation)');
            cancelEdit();
        });
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
        // Get the selected account value (format: "cash_123" or "cc_123")
        const accountValue = document.getElementById("transaction-account")?.value;
        let accountId = null;
        let debtAccountId = null;
        let isCredit = false;
        
        // Parse the account type and ID
        if (accountValue && accountValue.includes('_')) {
            const parts = accountValue.split('_');
            if (parts.length === 2) {
                const [accountType, id] = parts;
                const parsedId = parseInt(id);
                
                if (!isNaN(parsedId)) {
                    if (accountType === 'cash') {
                        accountId = parsedId;
                    } else if (accountType === 'cc') {
                        debtAccountId = parsedId;
                        isCredit = true;
                    }
                } else {
                    showError("Invalid account selection.");
                    return;
                }
            } else {
                showError("Invalid account format.");
                return;
            }
        }
        
        const transactionData = {
            date: document.getElementById("transaction-date")?.value,
            account_id: accountId,
            category: document.getElementById("transaction-category")?.value,
            description: document.getElementById("transaction-description")?.value,
            amount: safeParseFloat(document.getElementById("transaction-amount")?.value),
            cleared: document.getElementById("transaction-cleared")?.checked,
            debt_account_id: debtAccountId
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

        // Handle credit card transactions (but not for Payment/Transfer categories)
        if (isCredit && transactionData.category !== "Payment" && transactionData.category !== "Transfer") {
            // Credit Card Transaction Sign Convention:
            // - UI Input: User enters purchases as positive (e.g., $50 for a purchase)
            // - UI Input: User enters payments as negative (e.g., -$100 for a payment)
            // - Storage: Purchases stored as negative (expenses reduce cash/increase debt)
            // - Storage: Payments stored as positive (payments increase cash/reduce debt)
            // - Display: Negative amounts shown in red (expenses), positive in green (payments)
            
            // Validate amount
            if (isNaN(transactionData.amount) || transactionData.amount === 0) {
                showError("Please enter a valid amount.");
                return;
            }
            
            // Apply sign convention based on transaction type
            const userAmount = transactionData.amount;
            
            if (userAmount > 0) {
                // User entered positive amount = purchase/charge
                // Store as negative (expense)
                transactionData.amount = -Math.abs(userAmount);
                debug.log('Credit card purchase:', userAmount, 'stored as:', transactionData.amount);
            } else if (userAmount < 0) {
                // User entered negative amount = payment
                // Store as positive (income/payment)  
                transactionData.amount = Math.abs(userAmount);
                debug.log('Credit card payment:', userAmount, 'stored as:', transactionData.amount);
            }
            
            // IMPORTANT: Don't process as "Debt" category if it's a credit card transaction
            // The old "Debt" category logic below is for legacy compatibility only
        } else if (transactionData.category === "Debt" && !isCredit) {
            // Old debt category logic for backwards compatibility
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
            // Cash transactions need an account
            if (!transactionData.account_id || isNaN(transactionData.account_id)) {
                showError("Please select a valid account.");
                return;
            }
        }

        // Check if this is a Payment or Transfer transaction that needs linked entries
        if ((transactionData.category === "Payment" || transactionData.category === "Transfer") && !editingTransactionId) {
            // Get the transfer-to account
            const transferToValue = document.getElementById("transfer-to-account")?.value;
            if (!transferToValue) {
                showError(`Please select a destination account for the ${transactionData.category.toLowerCase()}.`);
                return;
            }
            
            // Add linked transaction (Payment or Transfer)
            await addLinkedTransaction(transactionData, transferToValue, appState, onUpdate);
        } else if (editingTransactionId) {
            // Update existing transaction
            await updateTransaction(editingTransactionId, transactionData, appState, onUpdate);
        } else {
            // Add new single transaction
            await addNewTransaction(transactionData, appState, onUpdate);
        }

    } catch (error) {
        debug.error("Error handling transaction:", error);
        showError("Failed to save transaction. " + error.message);
    }
}

async function addLinkedTransaction(fromTransactionData, toAccountValue, appState, onUpdate) {
    try {
        // Parse the to-account type and ID
        let toAccountId = null;
        let toDebtAccountId = null;
        
        if (toAccountValue && toAccountValue.includes('_')) {
            const parts = toAccountValue.split('_');
            if (parts.length === 2) {
                const [accountType, id] = parts;
                const parsedId = parseInt(id);
                
                if (!isNaN(parsedId)) {
                    if (accountType === 'cash') {
                        toAccountId = parsedId;
                    } else if (accountType === 'cc') {
                        toDebtAccountId = parsedId;
                    }
                }
            }
        }
        
        // Create linked description
        const baseDescription = fromTransactionData.description;
        const fromAccountName = getAccountName(fromTransactionData.account_id, fromTransactionData.debt_account_id, appState);
        const toAccountName = getAccountName(toAccountId, toDebtAccountId, appState);
        
        // Create the two linked transactions
        const transaction1 = { ...fromTransactionData };
        const transaction2 = {
            date: fromTransactionData.date,
            account_id: toAccountId,
            debt_account_id: toDebtAccountId,
            category: fromTransactionData.category,
            description: baseDescription,
            cleared: fromTransactionData.cleared
        };
        
        if (fromTransactionData.category === "Payment") {
            // Payment: money goes from cash account to debt account
            // Transaction 1: Negative amount in cash account (money out)
            transaction1.amount = -Math.abs(fromTransactionData.amount);
            transaction1.description = `${baseDescription} → ${toAccountName}`;
            
            // Transaction 2: Positive amount in debt account (payment reduces debt)
            transaction2.amount = Math.abs(fromTransactionData.amount);
            transaction2.description = `${baseDescription} ← ${fromAccountName}`;
        } else if (fromTransactionData.category === "Transfer") {
            // Transfer: money goes from one cash account to another
            // Transaction 1: Negative amount in from account
            transaction1.amount = -Math.abs(fromTransactionData.amount);
            transaction1.description = `${baseDescription} → ${toAccountName}`;
            
            // Transaction 2: Positive amount in to account
            transaction2.amount = Math.abs(fromTransactionData.amount);
            transaction2.description = `${baseDescription} ← ${fromAccountName}`;
        }
        
        // Save both transactions
        const savedTransactions = [];
        const balanceChanges = [];
        
        try {
            // Save first transaction
            const saved1 = await db.addTransaction(transaction1);
            savedTransactions.push(saved1);
            
            // Save second transaction
            const saved2 = await db.addTransaction(transaction2);
            savedTransactions.push(saved2);
            
            // Update balances for both transactions
            // Transaction 1 balance update
            if (transaction1.account_id) {
                await updateCashAccountBalance(transaction1.account_id, transaction1.amount, appState);
                balanceChanges.push({ type: 'cash', id: transaction1.account_id, amount: transaction1.amount });
            } else if (transaction1.debt_account_id) {
                await updateDebtAccountBalance(transaction1.debt_account_id, transaction1.amount, appState);
                balanceChanges.push({ type: 'debt', id: transaction1.debt_account_id, amount: transaction1.amount });
            }
            
            // Transaction 2 balance update
            if (transaction2.account_id) {
                await updateCashAccountBalance(transaction2.account_id, transaction2.amount, appState);
                balanceChanges.push({ type: 'cash', id: transaction2.account_id, amount: transaction2.amount });
            } else if (transaction2.debt_account_id) {
                await updateDebtAccountBalance(transaction2.debt_account_id, transaction2.amount, appState);
                balanceChanges.push({ type: 'debt', id: transaction2.debt_account_id, amount: transaction2.amount });
            }
            
            // Add both transactions to app state
            savedTransactions.forEach(t => {
                appState.appData.transactions.unshift({
                    ...t,
                    amount: parseFloat(t.amount)
                });
            });
            
            // Reset form
            const form = document.getElementById("transaction-form");
            if (form) form.reset();
            const dateInput = document.getElementById("transaction-date");
            if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
            const transferGroup = document.getElementById("transfer-account-group");
            if (transferGroup) transferGroup.style.display = "none";
            
            // Hide the transaction form section after successful submission
            const formSection = document.querySelector('.transaction-form-section');
            if (formSection) formSection.style.display = 'none';
            
            // Reset account label
            const accountLabel = document.querySelector('label[for="transaction-account"]');
            if (accountLabel) accountLabel.textContent = "Account";
            
            onUpdate();
            announceToScreenReader(`${fromTransactionData.category} completed successfully`);
            
        } catch (error) {
            // Rollback on failure
            debug.error('Failed to create linked transactions, rolling back:', error);
            
            // Delete any saved transactions
            for (const saved of savedTransactions) {
                try {
                    await db.deleteTransaction(saved.id);
                } catch (deleteError) {
                    debug.error('Failed to rollback transaction:', deleteError);
                }
            }
            
            // Reverse any balance changes
            for (const change of balanceChanges) {
                try {
                    if (change.type === 'cash') {
                        await updateCashAccountBalance(change.id, -change.amount, appState);
                    } else if (change.type === 'debt') {
                        await updateDebtAccountBalance(change.id, -change.amount, appState);
                    }
                } catch (balanceError) {
                    debug.error('Failed to rollback balance change:', balanceError);
                }
            }
            
            throw error;
        }
        
    } catch (error) {
        debug.error('Failed to add linked transaction:', error);
        showError(`Failed to add ${fromTransactionData.category.toLowerCase()}. Please try again.`);
        throw error;
    }
}

// Helper function to get account name
function getAccountName(accountId, debtAccountId, appState) {
    if (accountId) {
        const account = appState.appData.cashAccounts.find(a => a.id === accountId);
        return account ? account.name : 'Unknown Account';
    } else if (debtAccountId) {
        const debtAccount = appState.appData.debtAccounts.find(d => d.id === debtAccountId);
        return debtAccount ? debtAccount.name : 'Unknown Account';
    }
    return 'Unknown Account';
}

async function addNewTransaction(transactionData, appState, onUpdate) {
    try {
        // Prepare balance update instructions
        const balanceUpdates = [];
        
        if (transactionData.account_id) {
            balanceUpdates.push({
                accountType: 'cash',
                accountId: transactionData.account_id,
                amount: transactionData.amount
            });
        }
        
        if (transactionData.debt_account_id) {
            // For debt accounts, negate the amount (handled by TransactionManager)
            balanceUpdates.push({
                accountType: 'debt',
                accountId: transactionData.debt_account_id,
                amount: transactionData.amount
            });
        }
        
        // Use TransactionManager for atomic operation
        const savedTransaction = await transactionManager.createTransactionWithBalanceUpdate(
            transactionData,
            balanceUpdates
        );
        
        // Update app state
        const newTransaction = {
            ...savedTransaction,
            amount: parseFloat(savedTransaction.amount)
        };
        
        // Update local balance states
        if (newTransaction.account_id) {
            const account = appState.appData.cashAccounts.find(a => a.id === newTransaction.account_id);
            if (account) {
                account.balance = addMoney(account.balance || 0, newTransaction.amount);
            }
        }
        
        if (newTransaction.debt_account_id) {
            const debtAccount = appState.appData.debtAccounts.find(d => d.id === newTransaction.debt_account_id);
            if (debtAccount) {
                // For debt accounts, negate the amount
                debtAccount.balance = addMoney(debtAccount.balance || 0, -newTransaction.amount);
            }
        }
        
        // Add to app state transactions
        appState.appData.transactions.unshift(newTransaction);

        // Reset form
        const form = document.getElementById("transaction-form");
        if (form) form.reset();
        const dateInput = document.getElementById("transaction-date");
        if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
        const debtGroup = document.getElementById("debt-account-group");
        if (debtGroup) debtGroup.style.display = "none";
        const transferGroup = document.getElementById("transfer-account-group");
        if (transferGroup) transferGroup.style.display = "none";
        
        // Hide the transaction form section after successful submission
        const formSection = document.querySelector('.transaction-form-section');
        if (formSection) formSection.style.display = 'none';
        
        // Reset account label
        const accountLabel = document.querySelector('label[for="transaction-account"]');
        if (accountLabel) accountLabel.textContent = "Account";

        onUpdate();
        announceToScreenReader("Transaction added successfully");
        
        return newTransaction;
    } catch (error) {
        debug.error('Failed to add transaction:', error);
        showError('Failed to add transaction. Please try again.');
        throw error;
    }
}

async function updateTransaction(id, newTransactionData, appState, onUpdate) {
    if (!originalTransaction) {
        showError("Original transaction data not found.");
        return;
    }

    try {
        // Prepare balance adjustments
        const balanceAdjustments = [];
        
        // Handle account changes
        if (originalTransaction.account_id || newTransactionData.account_id) {
            // Reverse original cash account
            if (originalTransaction.account_id) {
                balanceAdjustments.push({
                    accountType: 'cash',
                    accountId: originalTransaction.account_id,
                    reverseAmount: originalTransaction.amount
                });
            }
            
            // Apply new cash account
            if (newTransactionData.account_id) {
                const existing = balanceAdjustments.find(
                    adj => adj.accountType === 'cash' && adj.accountId === newTransactionData.account_id
                );
                if (existing) {
                    existing.applyAmount = newTransactionData.amount;
                } else {
                    balanceAdjustments.push({
                        accountType: 'cash',
                        accountId: newTransactionData.account_id,
                        applyAmount: newTransactionData.amount
                    });
                }
            }
        }
        
        // Handle debt account changes
        if (originalTransaction.debt_account_id || newTransactionData.debt_account_id) {
            // Reverse original debt account
            if (originalTransaction.debt_account_id) {
                balanceAdjustments.push({
                    accountType: 'debt',
                    accountId: originalTransaction.debt_account_id,
                    reverseAmount: originalTransaction.amount
                });
            }
            
            // Apply new debt account
            if (newTransactionData.debt_account_id) {
                const existing = balanceAdjustments.find(
                    adj => adj.accountType === 'debt' && adj.accountId === newTransactionData.debt_account_id
                );
                if (existing) {
                    existing.applyAmount = newTransactionData.amount;
                } else {
                    balanceAdjustments.push({
                        accountType: 'debt',
                        accountId: newTransactionData.debt_account_id,
                        applyAmount: newTransactionData.amount
                    });
                }
            }
        }
        
        // Use TransactionManager for atomic update
        const updatedTransaction = await transactionManager.updateTransactionWithBalanceAdjustment(
            id,
            newTransactionData,
            balanceAdjustments
        );
        
        // Update app state balances
        for (const adjustment of balanceAdjustments) {
            if (adjustment.accountType === 'cash') {
                const account = appState.appData.cashAccounts.find(a => a.id === adjustment.accountId);
                if (account) {
                    let newBalance = account.balance || 0;
                    if (adjustment.reverseAmount !== undefined) {
                        newBalance = subtractMoney(newBalance, adjustment.reverseAmount);
                    }
                    if (adjustment.applyAmount !== undefined) {
                        newBalance = addMoney(newBalance, adjustment.applyAmount);
                    }
                    account.balance = newBalance;
                }
            } else if (adjustment.accountType === 'debt') {
                const debtAccount = appState.appData.debtAccounts.find(d => d.id === adjustment.accountId);
                if (debtAccount) {
                    let newBalance = debtAccount.balance || 0;
                    // For debt accounts, amounts are negated
                    if (adjustment.reverseAmount !== undefined) {
                        newBalance = subtractMoney(newBalance, -adjustment.reverseAmount);
                    }
                    if (adjustment.applyAmount !== undefined) {
                        newBalance = addMoney(newBalance, -adjustment.applyAmount);
                    }
                    debtAccount.balance = newBalance;
                }
            }
        }
        
        // Update transaction in app state
        const index = appState.appData.transactions.findIndex(t => t.id === id);
        if (index > -1) {
            appState.appData.transactions[index] = {
                ...updatedTransaction,
                amount: parseFloat(updatedTransaction.amount)
            };
        }
        
        // Clean up edit state
        cancelEdit();
        onUpdate();
        announceToScreenReader("Transaction updated successfully");
        
    } catch (error) {
        debug.error('Failed to update transaction:', error);
        showError('Failed to update transaction. Please try again.');
        throw error;
    }
}

async function reverseTransactionEffects(transaction, appState) {
    // Reverse cash account balance changes
    if (transaction.account_id) {
        await updateCashAccountBalance(transaction.account_id, -transaction.amount, appState);
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
            const newBalance = subtractMoney(debtAccount.balance, transaction.amount);
            await db.updateDebtBalance(debtAccount.id, newBalance);
            debtAccount.balance = newBalance;
        }
    }
}

async function applyTransactionEffects(transaction, appState) {
    const amount = parseFloat(transaction.amount);

    // Apply cash account balance changes
    if (transaction.account_id) {
        await updateCashAccountBalance(transaction.account_id, amount, appState);
    }

    // Apply debt account balance changes
    if (transaction.debt_account_id) {
        await updateDebtAccountBalance(transaction.debt_account_id, amount, appState);
    }
}

async function updateCashAccountBalance(accountId, amount, appState) {
    if (!accountId || isNaN(amount)) {
        debug.error('Invalid parameters for updateCashAccountBalance:', { accountId, amount });
        throw new Error('Invalid parameters for balance update');
    }

    try {
        if (appState.updateAccountBalance) {
            // Use the provided update function if available
            await Promise.resolve(appState.updateAccountBalance(accountId, amount));
        } else {
            // Direct state update with validation
            const account = appState.appData.cashAccounts.find(a => a.id === accountId);
            if (!account) {
                debug.error('Cash account not found:', accountId);
                throw new Error(`Cash account ${accountId} not found`);
            }
            
            const oldBalance = account.balance || 0;
            const newBalance = addMoney(oldBalance, amount);
            
            // Validate new balance
            if (isNaN(newBalance) || !isFinite(newBalance)) {
                debug.error('Invalid balance calculation:', { oldBalance, amount, newBalance });
                throw new Error('Invalid balance calculation');
            }
            
            debug.log('Updating cash balance:', {
                accountId,
                oldBalance,
                amount,
                newBalance
            });
            
            account.balance = newBalance;
        }
    } catch (error) {
        debug.error('Failed to update cash account balance:', error);
        throw error;
    }
}

async function updateDebtAccountBalance(debtAccountId, amount, appState) {
    const debtAccount = appState.appData.debtAccounts.find(d => d.id === debtAccountId);
    if (!debtAccount) {
        debug.error('Debt account not found:', debtAccountId);
        throw new Error(`Debt account ${debtAccountId} not found`);
    }
    
    try {
        // Credit Card Balance Update Logic:
        // - Stored purchases (negative) → Increase debt balance (negate to positive)
        // - Stored payments (positive) → Decrease debt balance (negate to negative)
        // This maintains the accounting principle: debt increases are positive, decreases are negative
        
        const balanceChange = -amount;
        const oldBalance = debtAccount.balance || 0;
        const newBalance = addMoney(oldBalance, balanceChange);
        
        // Enhanced debugging to track the issue
        debug.log('Credit Card Balance Update Debug:', {
            accountId: debtAccountId,
            accountName: debtAccount.name,
            transactionAmount: amount,
            balanceChange: balanceChange,
            oldBalance: oldBalance,
            newBalance: newBalance,
            isPayment: amount > 0,
            isPurchase: amount < 0
        });
        
        debug.log('Updating debt balance:', {
            accountId: debtAccountId,
            transactionAmount: amount,
            balanceChange: balanceChange,
            oldBalance: oldBalance,
            newBalance: newBalance
        });
        
        await db.updateDebtBalance(debtAccount.id, newBalance);
        debtAccount.balance = newBalance;
    } catch (error) {
        debug.error('Failed to update debt account balance:', error);
        throw error;
    }
}

// Virtual scrolling configuration
const VISIBLE_ROWS = 50; // Number of rows to render at once
const BUFFER_ROWS = 10; // Extra rows to render for smooth scrolling
let visibleStartIndex = 0;

export function renderTransactions(appState, categoryFilter = currentCategoryFilter) {
    const { appData } = appState;
    const tbody = document.getElementById("transactions-table-body");
    if (!tbody) return;

    const filterSelect = document.getElementById("filter-category");
    if (filterSelect && categoryFilter) {
        filterSelect.value = categoryFilter;
    }

    // Use dataIndex for faster category filtering
    let transactions = categoryFilter ?
        dataIndex.getTransactionsByCategory(categoryFilter) :
        [...appData.transactions];

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (transactions.length === 0) {
        tbody.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">No transactions found</div>';
        return;
    }

    // For very large transaction lists, use virtual scrolling
    if (transactions.length > 100) {
        renderTransactionsVirtual(tbody, transactions, appState);
        return;
    }

    // For smaller lists, render all at once
    tbody.innerHTML = transactions.map(t => {
        // Handle both cash account transactions and credit card transactions
        let accountName = 'Credit Card Transaction';

        if (t.account_id) {
            // Regular cash account transaction - use index for O(1) lookup
            const account = (dataIndex?.indexes?.cashAccountsById?.get(t.account_id)) || 
                           appData.cashAccounts.find(a => a.id === t.account_id);
            accountName = account ? escapeHtml(account.name) : 'Unknown Account';
        } else if (t.debt_account_id) {
            // Credit card transaction - show the credit card name - use index for O(1) lookup
            const debtAccount = (dataIndex?.indexes?.debtAccountsById?.get(t.debt_account_id)) ||
                               appData.debtAccounts.find(d => d.id === t.debt_account_id);
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

        // Consistent color logic for all transactions:
        // Positive = income/payment (green), Negative = expense (red)
        const amountClass = t.amount >= 0 ? 'text-success' : 'text-error';
        const displayAmount = formatCurrency(t.amount);

        // Highlight transaction being edited
        const isEditing = editingTransactionId === t.id;
        const rowClass = isEditing ? 'style="background-color: var(--color-secondary);"' : '';

        const isIncome = t.category === 'Income' || t.amount > 0;
        const categoryIcon = getCategoryIcon(t.category, isIncome);
        
        // Determine status badge
        let statusBadge = '';
        if (!t.cleared) {
            statusBadge = '<span class="status-badge status-badge--warning">Pending</span>';
        } else {
            statusBadge = '<span class="status-badge">Cleared</span>';
        }
        
        return `
        <div class="table-row ${isEditing ? 'editing' : ''}">
            <div class="table-transaction">
                <div class="table-icon">${categoryIcon}</div>
                <div>
                    <div style="font-weight: 600;">${description}</div>
                    <div class="text-muted" style="font-size: 14px;">${escapeHtml(accountName)}</div>
                </div>
            </div>
            <div class="table-amount ${amountClass}" data-sensitive="true">
                ${displayAmount}
                ${timeBudgets.isEnabled() && t.amount < 0 ? timeBudgets.createTimeDisplay(Math.abs(t.amount), { className: 'time-cost-badge', showIcon: true }) : ''}
            </div>
            <div>${formatDate(t.date)}</div>
            <div>${statusBadge}</div>
            <div class="quick-actions">
                <button class="icon-btn btn-edit-transaction" data-id="${t.id}" ${isEditing ? 'disabled' : ''} title="${isEditing ? 'Editing...' : 'Edit'}">✏️</button>
                <button class="icon-btn btn-delete-transaction" data-id="${t.id}" ${isEditing ? 'disabled' : ''} title="Delete">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

async function deleteTransaction(id, appState, onUpdate) {
    const transactionToDelete = appState.appData.transactions.find(t => t.id === id);
    if (!transactionToDelete) {
        showError("Transaction not found.");
        return;
    }

    if (confirm("Are you sure you want to delete this transaction? This will adjust account balances and potentially revert recurring bill payments.")) {
        try {
            // Prepare balance reversal instructions
            const balanceReversals = [];
            
            if (transactionToDelete.account_id) {
                balanceReversals.push({
                    accountType: 'cash',
                    accountId: transactionToDelete.account_id,
                    amount: transactionToDelete.amount
                });
            }
            
            if (transactionToDelete.debt_account_id) {
                balanceReversals.push({
                    accountType: 'debt',
                    accountId: transactionToDelete.debt_account_id,
                    amount: transactionToDelete.amount
                });
            }

            // Use TransactionManager for atomic deletion
            await transactionManager.deleteTransactionWithBalanceReversal(id, balanceReversals);

            // Check if this was a recurring bill payment and revert the due date
            await handleRecurringBillReversion(transactionToDelete, appState);

            // Check if this was a savings goal contribution and revert the goal amount
            await handleSavingsGoalTransactionDeletion(transactionToDelete, appState);

            // Remove from app state
            appState.appData.transactions = appState.appData.transactions.filter(t => t.id !== id);

            // Balance updates are handled by:
            // - TransactionManager for debt accounts (stored balances)
            // - calculateAccountBalances() via onUpdate() for cash accounts (calculated balances)

            // Cancel edit if we're deleting the transaction being edited
            if (editingTransactionId === id) {
                cancelEdit();
            }

            onUpdate();
            
            // Dispatch event for Smart Rules to refresh statistics
            window.dispatchEvent(new CustomEvent('transaction:deleted', {
                detail: { transactionId: id }
            }));
            
            announceToScreenReader("Transaction deleted");
        } catch (error) {
            debug.error("Error deleting transaction:", error);
            showError("Failed to delete transaction. Please try again.");
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
        debug.warn('Could not find matching recurring bill for transaction:', deletedTransaction.description);
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
        debug.error('Error reverting recurring bill due date:', error);
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

// Virtual scrolling implementation
function renderTransactionsVirtual(tbody, transactions, appState) {
    const { appData } = appState;
    const container = tbody.parentElement;
    
    // Create a wrapper for virtual scrolling if it doesn't exist
    let wrapper = container.querySelector('.virtual-scroll-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'virtual-scroll-wrapper';
        wrapper.style.position = 'relative';
        wrapper.style.height = `${transactions.length * 40}px`; // Approximate row height
        
        container.style.overflow = 'auto';
        container.style.height = '600px'; // Fixed height for scrolling
        
        // Add scroll listener with throttling
        import('./utils.js').then(module => {
            const { throttle } = module;
            eventManager.addEventListener(container, 'scroll', throttle(() => {
                const scrollTop = container.scrollTop;
                const rowHeight = 40;
                const newStartIndex = Math.floor(scrollTop / rowHeight);
                
                if (Math.abs(newStartIndex - visibleStartIndex) > 5) {
                    visibleStartIndex = newStartIndex;
                    renderVisibleTransactions(tbody, transactions, appState);
                }
            }, 100));
        }).catch(error => {
            debug.error('Failed to load utils module for virtual scrolling:', error);
            // Fallback: Add scroll listener without throttling
            eventManager.addEventListener(container, 'scroll', () => {
                const scrollTop = container.scrollTop;
                const rowHeight = 40;
                const newStartIndex = Math.floor(scrollTop / rowHeight);
                
                if (Math.abs(newStartIndex - visibleStartIndex) > 5) {
                    visibleStartIndex = newStartIndex;
                    renderVisibleTransactions(tbody, transactions, appState);
                }
            });
        });
    }
    
    renderVisibleTransactions(tbody, transactions, appState);
}

function renderVisibleTransactions(tbody, transactions, appState) {
    const { appData } = appState;
    const startIndex = Math.max(0, visibleStartIndex - BUFFER_ROWS);
    const endIndex = Math.min(transactions.length, visibleStartIndex + VISIBLE_ROWS + BUFFER_ROWS);
    const visibleTransactions = transactions.slice(startIndex, endIndex);
    
    // Clear and render only visible rows
    tbody.innerHTML = '';
    
    // Add spacer for rows above
    if (startIndex > 0) {
        const spacer = document.createElement('tr');
        spacer.style.height = `${startIndex * 40}px`;
        tbody.appendChild(spacer);
    }
    
    // Render visible transactions
    visibleTransactions.forEach(t => {
        const row = createTransactionRow(t, appData);
        tbody.appendChild(row);
    });
    
    // Add spacer for rows below
    if (endIndex < transactions.length) {
        const spacer = document.createElement('tr');
        spacer.style.height = `${(transactions.length - endIndex) * 40}px`;
        tbody.appendChild(spacer);
    }
}

function createTransactionRow(t, appData) {
    const row = document.createElement('tr');
    
    // Handle both cash account transactions and credit card transactions
    let accountName = 'Credit Card Transaction';
    
    if (t.account_id) {
        // Use dataIndex for O(1) lookup if available
        const account = (dataIndex?.indexes?.cashAccountsById?.get(t.account_id)) || 
                       appData.cashAccounts.find(a => a.id === t.account_id);
        accountName = account ? escapeHtml(account.name) : 'Unknown Account';
    } else if (t.debt_account_id) {
        const debtAccount = (dataIndex?.indexes?.debtAccountsById?.get(t.debt_account_id)) ||
                           appData.debtAccounts.find(d => d.id === t.debt_account_id);
        accountName = debtAccount ? `${escapeHtml(debtAccount.name)} (Credit Card)` : 'Unknown Credit Card';
    }
    
    let description = escapeHtml(t.description);
    
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
    
    // Consistent color logic for all transactions:
    // Positive = income/payment (green), Negative = expense (red)
    const amountClass = t.amount >= 0 ? 'text-success' : 'text-error';
    const displayAmount = formatCurrency(t.amount);
    
    const isEditing = editingTransactionId === t.id;
    if (isEditing) {
        row.style.backgroundColor = 'var(--color-secondary)';
    }
    
    row.innerHTML = `
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(accountName)}</td>
        <td>${t.category === 'Uncategorized' ? '<span class="badge badge--warning">Uncategorized</span>' : escapeHtml(t.category)}</td>
        <td>${description}</td>
        <td class="${amountClass}" data-sensitive="true">
            <div class="transaction-amount-container">
                <span class="monetary-amount">${displayAmount}</span>
                ${timeBudgets.isEnabled() && t.amount < 0 ? timeBudgets.createTimeDisplay(Math.abs(t.amount), { className: 'time-cost-badge', showIcon: true }) : ''}
            </div>
        </td>
        <td class="${t.cleared ? 'status-cleared' : 'status-pending'}">${t.cleared ? "Cleared" : "Pending"}</td>
        <td>
            <div class="transaction-actions">
                <button class="btn btn-small btn-edit-transaction" data-id="${t.id}" ${isEditing ? 'disabled' : ''}>
                    ${isEditing ? 'Editing...' : 'Edit'}
                </button>
                <button class="btn btn-small btn-delete-transaction" data-id="${t.id}" ${isEditing ? 'disabled' : ''}>Delete</button>
            </div>
        </td>
    `;
    
    return row;
}

// Cleanup function to remove all event listeners
export function cleanup() {
    // Note: eventManager handles all listener cleanup automatically
    
    // Clear module-level state
    currentCategoryFilter = "";
    editingTransactionId = null;
    originalTransaction = null;
    appStateReference = null;
    
    debug.log('Transaction module cleaned up');
}