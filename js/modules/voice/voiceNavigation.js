// js/modules/voice/voiceNavigation.js - Voice-Controlled App Navigation

import { debug } from '../debug.js';
import { switchTab, announceToScreenReader } from '../ui.js';
import { togglePrivacyMode, enablePanicMode } from '../privacy.js';
import { handleBiometricVoiceCommand } from './biometricVoiceCommands.js';

/**
 * Voice Navigation Handler - Controls app navigation and actions via voice
 */
export class VoiceNavigation {
  constructor(appState) {
    this.appState = appState;
    this.initializeNavigationHandlers();
  }

  /**
   * Initialize navigation and action handlers
   */
  initializeNavigationHandlers() {
    this.navigationHandlers = {
      'navigation.tab': this.handleTabNavigation.bind(this),
      'action.create': this.handleCreateAction.bind(this),
      'action.categorize': this.handleCategorizeAction.bind(this),
      'action.mark_paid': this.handleMarkPaidAction.bind(this),
      'action.filter': this.handleFilterAction.bind(this),
      'settings.privacy': this.handlePrivacyAction.bind(this),
      'settings.biometric': this.handleBiometricAction.bind(this),
      'general.help': this.handleHelpAction.bind(this),
    };

    // Tab mapping for navigation
    this.tabMappings = {
      dashboard: 'dashboard',
      accounts: 'accounts',
      transactions: 'transactions',
      investments: 'investments',
      debt: 'debt',
      recurring: 'recurring',
    };

    // Action mappings
    this.actionMappings = {
      transaction: {
        tab: 'transactions',
        action: 'openTransactionForm',
      },
      account: {
        tab: 'accounts',
        action: 'openAccountForm',
      },
      investment: {
        tab: 'investments',
        action: 'openInvestmentForm',
      },
      debt: {
        tab: 'debt',
        action: 'openDebtForm',
      },
      bill: {
        tab: 'recurring',
        action: 'openBillForm',
      },
    };
  }

  /**
   * Process navigation command and execute action
   */
  async processNavigation(intent, parameters = {}) {
    debug.log('Processing voice navigation:', intent, parameters);

    try {
      // Check if this is a biometric-related command
      if (
        intent.startsWith('settings.biometric') ||
        intent === 'query.privacy_security_status' ||
        intent === 'query.master_password_status'
      ) {
        const result = await handleBiometricVoiceCommand(parameters.originalText || '');
        if (result) {
          return {
            type: 'biometric',
            success: result.success,
            response: {
              text: result.message,
              title: 'Biometric Security',
              details: result.details || '',
            },
          };
        }
      }

      const handler = this.navigationHandlers[intent];
      if (!handler) {
        return this.createErrorResponse(`Navigation "${intent}" not supported`);
      }

      const result = await handler(parameters);
      debug.log('Navigation result:', result);
      return result;
    } catch (error) {
      debug.error('Error processing voice navigation:', error);
      return this.createErrorResponse('Failed to execute navigation command');
    }
  }

  /**
   * Handle tab navigation commands
   */
  async handleTabNavigation(parameters) {
    const { targetTab } = parameters;

    if (!targetTab || !this.tabMappings[targetTab]) {
      return this.createErrorResponse(`Unknown tab: ${targetTab}`);
    }

    try {
      const tabId = this.tabMappings[targetTab];

      // Switch to the requested tab
      switchTab(tabId, this.appState);

      // Announce the navigation
      announceToScreenReader(`Navigated to ${targetTab} tab`);

      return {
        type: 'navigation',
        success: true,
        action: 'tab_switch',
        data: {
          targetTab,
          tabId,
        },
        response: {
          text: `Switched to ${targetTab}`,
          title: 'Navigation',
          details: `Now viewing ${targetTab} section`,
        },
      };
    } catch (error) {
      debug.error('Error switching tab:', error);
      return this.createErrorResponse(`Failed to switch to ${targetTab} tab`);
    }
  }

  /**
   * Handle create/add actions
   */
  async handleCreateAction(parameters) {
    const { actionType } = parameters;

    if (!actionType || !this.actionMappings[actionType]) {
      return this.createErrorResponse(`Unknown action type: ${actionType}`);
    }

    try {
      const actionConfig = this.actionMappings[actionType];

      // Switch to appropriate tab first
      switchTab(actionConfig.tab, this.appState);

      // Wait a moment for tab to load
      await new Promise(resolve => setTimeout(resolve, 300));

      // Execute the specific action
      const actionResult = await this.executeAction(actionConfig.action, actionType);

      return {
        type: 'action',
        success: true,
        action: actionConfig.action,
        data: {
          actionType,
          targetTab: actionConfig.tab,
        },
        response: {
          text: `Ready to add new ${actionType}`,
          title: 'Action',
          details: actionResult.details || `${actionType} form opened`,
        },
      };
    } catch (error) {
      debug.error('Error executing create action:', error);
      return this.createErrorResponse(`Failed to create ${actionType}`);
    }
  }

  /**
   * Execute specific actions within tabs
   */
  async executeAction(action, actionType) {
    switch (action) {
      case 'openTransactionForm':
        // First, show the transaction form section
        const formSection = document.querySelector('.transaction-form-section');
        if (formSection) {
          formSection.style.display = 'block';
        }

        // Then focus on the transaction form
        const transactionForm = document.getElementById('transaction-form');
        if (transactionForm) {
          transactionForm.scrollIntoView({ behavior: 'smooth' });

          // Set today's date if not already set
          const dateField = document.getElementById('transaction-date');
          if (dateField && !dateField.value) {
            dateField.value = new Date().toISOString().split('T')[0];
          }

          // Focus on first input field
          const firstInput = transactionForm.querySelector('input, select');
          if (firstInput) {
            setTimeout(() => firstInput.focus(), 400);
          }
        }
        announceToScreenReader('Transaction form ready for voice input');
        return { details: 'Transaction form opened and ready for voice input' };

      case 'openAccountForm':
        // Try to trigger add account button
        const addAccountBtn = document.getElementById('add-account-btn');
        if (addAccountBtn) {
          addAccountBtn.click();
          announceToScreenReader('Account form opened');
          return { details: 'Account creation form opened' };
        }
        return { details: 'Account section opened' };

      case 'openInvestmentForm':
        // Try to trigger add investment button
        const addInvestmentBtn = document.getElementById('add-investment-btn');
        if (addInvestmentBtn) {
          addInvestmentBtn.click();
          announceToScreenReader('Investment form opened');
          return { details: 'Investment creation form opened' };
        }
        return { details: 'Investment section opened' };

      case 'openDebtForm':
        // Try to trigger add debt button
        const addDebtBtn = document.getElementById('add-debt-btn');
        if (addDebtBtn) {
          addDebtBtn.click();
          announceToScreenReader('Debt account form opened');
          return { details: 'Debt account creation form opened' };
        }
        return { details: 'Debt section opened' };

      case 'openBillForm':
        // Try to trigger add bill button
        const addBillBtn = document.getElementById('add-recurring-btn');
        if (addBillBtn) {
          addBillBtn.click();
          announceToScreenReader('Recurring bill form opened');
          return { details: 'Recurring bill form opened' };
        }
        return { details: 'Recurring bills section opened' };

      default:
        return { details: `${actionType} section opened` };
    }
  }

  /**
   * Handle privacy mode actions
   */
  async handlePrivacyAction(parameters) {
    const { privacyAction } = parameters;

    try {
      let result;
      let actionText;

      switch (privacyAction) {
        case 'enable':
          await togglePrivacyMode(true);
          actionText = 'Privacy mode enabled';
          break;

        case 'disable':
          await togglePrivacyMode(false);
          actionText = 'Privacy mode disabled';
          break;

        case 'toggle':
          await togglePrivacyMode();
          actionText = 'Privacy mode toggled';
          break;

        case 'panic':
          enablePanicMode();
          actionText = 'Panic mode activated - all sensitive data hidden';
          break;

        default:
          return this.createErrorResponse(`Unknown privacy action: ${privacyAction}`);
      }

      announceToScreenReader(actionText);

      return {
        type: 'settings',
        success: true,
        action: 'privacy_change',
        data: {
          privacyAction,
        },
        response: {
          text: actionText,
          title: 'Privacy Settings',
          details:
            privacyAction === 'panic'
              ? 'All sensitive financial data is now hidden'
              : 'Privacy settings updated',
        },
      };
    } catch (error) {
      debug.error('Error handling privacy action:', error);
      return this.createErrorResponse('Failed to change privacy settings');
    }
  }

  /**
   * Handle biometric-related actions
   */
  async handleBiometricAction(parameters) {
    const { originalText } = parameters;

    try {
      const result = await handleBiometricVoiceCommand(originalText || '');

      if (result) {
        // Navigate to settings if requested
        if (result.action === 'navigate_settings') {
          switchTab('settings', this.appState);
          setTimeout(() => {
            const privacySection = document.querySelector('.privacy-settings-section');
            if (privacySection) {
              privacySection.scrollIntoView({ behavior: 'smooth' });
            }
          }, 300);
        }

        return {
          type: 'biometric',
          success: result.success,
          response: {
            text: result.message,
            title: 'Biometric Security',
            details: result.details || '',
          },
        };
      }

      return this.createErrorResponse('Biometric command not recognized');
    } catch (error) {
      debug.error('Error handling biometric action:', error);
      return this.createErrorResponse('Failed to process biometric command');
    }
  }

  /**
   * Handle categorize transaction action
   */
  async handleCategorizeAction(parameters) {
    const { category } = parameters;

    if (!category) {
      return this.createErrorResponse('Please specify a category for the transaction.');
    }

    try {
      // Get the most recent transaction
      const appData = this.appState?.appData || { transactions: [] };
      if (appData.transactions.length === 0) {
        return this.createErrorResponse('No transactions found to categorize.');
      }

      // Sort by date to get most recent
      const sortedTransactions = [...appData.transactions].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      const lastTransaction = sortedTransactions[0];

      // Update the transaction category
      // Note: In a real implementation, this would update the database
      const oldCategory = lastTransaction.category;
      lastTransaction.category = category;

      announceToScreenReader(`Transaction categorized as ${category}`);

      return {
        type: 'action',
        success: true,
        action: 'categorize_transaction',
        data: {
          transactionId: lastTransaction.id,
          oldCategory,
          newCategory: category,
          transaction: lastTransaction,
        },
        response: {
          text: `Last transaction "${lastTransaction.description}" categorized as ${category}`,
          title: 'Transaction Categorized',
          details: `Changed from ${oldCategory} to ${category}`,
        },
      };
    } catch (error) {
      debug.error('Error categorizing transaction:', error);
      return this.createErrorResponse('Failed to categorize transaction');
    }
  }

  /**
   * Handle mark bill paid action
   */
  async handleMarkPaidAction(parameters) {
    const { billName } = parameters;

    if (!billName) {
      return this.createErrorResponse('Please specify which bill to mark as paid.');
    }

    try {
      // Find the bill
      const appData = this.appState?.appData || { recurringBills: [] };
      const bill = appData.recurringBills.find(
        b => b.name.toLowerCase().includes(billName.toLowerCase()) && b.active !== false
      );

      if (!bill) {
        return this.createErrorResponse(`Could not find bill "${billName}".`);
      }

      // Mark as paid (in real implementation, this would create a transaction and update next due date)
      const oldDueDate = bill.next_due;
      const paymentDate = new Date().toISOString().split('T')[0];

      // Calculate next due date based on frequency
      const nextDue = this.calculateNextDueDate(bill.next_due, bill.frequency);
      bill.next_due = nextDue;

      announceToScreenReader(`${bill.name} marked as paid`);

      return {
        type: 'action',
        success: true,
        action: 'mark_bill_paid',
        data: {
          billId: bill.id,
          billName: bill.name,
          amount: bill.amount,
          paymentDate,
          oldDueDate,
          newDueDate: nextDue,
        },
        response: {
          text: `${bill.name} marked as paid. Next due: ${nextDue}`,
          title: 'Bill Paid',
          details: `Payment of ${this.formatCurrency(bill.amount)} recorded`,
        },
      };
    } catch (error) {
      debug.error('Error marking bill as paid:', error);
      return this.createErrorResponse('Failed to mark bill as paid');
    }
  }

  /**
   * Handle filter transactions action
   */
  async handleFilterAction(parameters) {
    const { filterType } = parameters;

    if (!filterType) {
      return this.createErrorResponse('Please specify what to filter.');
    }

    try {
      // Switch to transactions tab first
      switchTab('transactions', this.appState);
      await new Promise(resolve => setTimeout(resolve, 300));

      // Apply filter based on type
      let filterText = '';
      let filterApplied = false;

      // In a real implementation, these would trigger actual UI filters
      switch (filterType) {
        case 'income':
          filterText = 'Showing only income transactions';
          filterApplied = true;
          break;

        case 'cash':
          filterText = 'Showing only cash transactions';
          filterApplied = true;
          break;

        case 'transfers':
          filterText = 'Hiding transfer transactions';
          filterApplied = true;
          break;

        case 'thisMonth':
          filterText = "Showing this month's transactions";
          filterApplied = true;
          break;

        default:
          filterText = `Filtering by ${filterType}`;
          filterApplied = true;
      }

      if (!filterApplied) {
        return this.createErrorResponse(`Unknown filter type: ${filterType}`);
      }

      announceToScreenReader(filterText);

      return {
        type: 'action',
        success: true,
        action: 'filter_transactions',
        data: {
          filterType,
          filterText,
        },
        response: {
          text: filterText,
          title: 'Filter Applied',
          details: 'Transaction view updated',
        },
      };
    } catch (error) {
      debug.error('Error applying filter:', error);
      return this.createErrorResponse('Failed to apply filter');
    }
  }

  /**
   * Calculate next due date based on frequency
   */
  calculateNextDueDate(currentDue, frequency) {
    const date = new Date(currentDue);

    switch (frequency) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'annually':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }

    return date.toISOString().split('T')[0];
  }

  /**
   * Format currency (simple version)
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  /**
   * Handle help requests
   */
  async handleHelpAction(parameters) {
    const helpCommands = [
      'Try: "What\'s my balance?"',
      'Try: "Show my net worth"',
      'Try: "Go to transactions"',
      'Try: "Add new transaction"',
      'Try: "What did I spend on groceries?"',
      'Try: "Enable privacy mode"',
      'Try: "Privacy security status"',
      'Try: "Enable biometric authentication"',
    ];

    announceToScreenReader('Voice help information displayed');

    return {
      type: 'help',
      success: true,
      action: 'show_help',
      data: {
        commands: helpCommands,
      },
      response: {
        text: 'Here are some voice commands you can try',
        title: 'Voice Commands Help',
        details: 'Speak naturally - I understand many variations!',
      },
    };
  }

  /**
   * Check if tab exists and is accessible
   */
  isTabAccessible(tabId) {
    const tabButton = document.getElementById(`${tabId}-tab-btn`);
    const tabContent = document.getElementById(tabId);
    return tabButton && tabContent && !tabButton.disabled;
  }

  /**
   * Get current active tab
   */
  getCurrentTab() {
    const activeTab = document.querySelector('.tab-btn.active');
    return activeTab ? activeTab.getAttribute('data-tab') : null;
  }

  /**
   * Navigate back to previous tab
   */
  goBack() {
    if (this.previousTab && this.isTabAccessible(this.previousTab)) {
      switchTab(this.previousTab, this.appState);
      announceToScreenReader(`Returned to ${this.previousTab} tab`);
      return true;
    }
    return false;
  }

  /**
   * Create error response
   */
  createErrorResponse(message) {
    return {
      type: 'error',
      success: false,
      error: message,
      response: {
        text: message,
        title: 'Navigation Error',
        details: 'Please try a different command.',
      },
    };
  }

  /**
   * Update app state reference
   */
  updateAppState(newAppState) {
    this.appState = newAppState;
  }

  /**
   * Get supported navigation commands
   */
  getSupportedNavigations() {
    return {
      'Tab Navigation': [
        'Go to dashboard',
        'Show accounts',
        'Open transactions',
        'View investments',
        'Show debt',
        'Open recurring bills',
      ],
      'Create Actions': [
        'Add new transaction',
        'Create account',
        'Add investment',
        'Create debt account',
        'Add recurring bill',
      ],
      Settings: ['Enable privacy mode', 'Disable privacy mode', 'Toggle privacy', 'Panic mode'],
      'Biometric Security': [
        'Privacy security status',
        'Enable biometric authentication',
        'Disable biometric authentication',
        'Master password status',
      ],
      Help: ['Help', 'What can you do?', 'Show commands'],
    };
  }

  /**
   * Check if command requires confirmation
   */
  requiresConfirmation(intent, parameters) {
    // Panic mode should require confirmation
    if (intent === 'settings.privacy' && parameters.privacyAction === 'panic') {
      return true;
    }
    return false;
  }

  /**
   * Execute command with confirmation if needed
   */
  async executeWithConfirmation(intent, parameters, confirmed = false) {
    if (this.requiresConfirmation(intent, parameters) && !confirmed) {
      return {
        type: 'confirmation_required',
        success: false,
        requiresConfirmation: true,
        intent,
        parameters,
        response: {
          text: 'Are you sure you want to activate panic mode?',
          title: 'Confirmation Required',
          details: 'This will hide all sensitive data immediately.',
        },
      };
    }

    return this.processNavigation(intent, parameters);
  }
}
