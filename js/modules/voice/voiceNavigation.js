// js/modules/voice/voiceNavigation.js - Voice-Controlled App Navigation

import { debug } from '../debug.js';
import { switchTab, announceToScreenReader } from '../ui.js';
import { togglePrivacyMode, enablePanicMode } from '../privacy.js';

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
            'settings.privacy': this.handlePrivacyAction.bind(this),
            'general.help': this.handleHelpAction.bind(this)
        };

        // Tab mapping for navigation
        this.tabMappings = {
            'dashboard': 'dashboard',
            'accounts': 'accounts', 
            'transactions': 'transactions',
            'investments': 'investments',
            'debt': 'debt',
            'recurring': 'recurring'
        };

        // Action mappings
        this.actionMappings = {
            'transaction': {
                tab: 'transactions',
                action: 'openTransactionForm'
            },
            'account': {
                tab: 'accounts',
                action: 'openAccountForm'
            },
            'investment': {
                tab: 'investments',
                action: 'openInvestmentForm'
            },
            'debt': {
                tab: 'debt',
                action: 'openDebtForm'
            },
            'bill': {
                tab: 'recurring',
                action: 'openBillForm'
            }
        };
    }

    /**
     * Process navigation command and execute action
     */
    async processNavigation(intent, parameters = {}) {
        debug.log('Processing voice navigation:', intent, parameters);

        try {
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
                    targetTab: targetTab,
                    tabId: tabId
                },
                response: {
                    text: `Switched to ${targetTab}`,
                    title: 'Navigation',
                    details: `Now viewing ${targetTab} section`
                }
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
                    actionType: actionType,
                    targetTab: actionConfig.tab
                },
                response: {
                    text: `Ready to add new ${actionType}`,
                    title: 'Action',
                    details: actionResult.details || `${actionType} form opened`
                }
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
                // Focus on the transaction form
                const transactionForm = document.getElementById('transaction-form');
                if (transactionForm) {
                    transactionForm.scrollIntoView({ behavior: 'smooth' });
                    
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
                    togglePrivacyMode(true);
                    actionText = 'Privacy mode enabled';
                    break;

                case 'disable':
                    togglePrivacyMode(false);
                    actionText = 'Privacy mode disabled';
                    break;

                case 'toggle':
                    togglePrivacyMode();
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
                    privacyAction: privacyAction
                },
                response: {
                    text: actionText,
                    title: 'Privacy Settings',
                    details: privacyAction === 'panic' ? 
                        'All sensitive financial data is now hidden' :
                        'Privacy settings updated'
                }
            };

        } catch (error) {
            debug.error('Error handling privacy action:', error);
            return this.createErrorResponse('Failed to change privacy settings');
        }
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
            'Try: "Enable privacy mode"'
        ];

        announceToScreenReader('Voice help information displayed');

        return {
            type: 'help',
            success: true,
            action: 'show_help',
            data: {
                commands: helpCommands
            },
            response: {
                text: 'Here are some voice commands you can try',
                title: 'Voice Commands Help',
                details: 'Speak naturally - I understand many variations!'
            }
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
                details: 'Please try a different command.'
            }
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
                'Open recurring bills'
            ],
            'Create Actions': [
                'Add new transaction',
                'Create account',
                'Add investment',
                'Create debt account',
                'Add recurring bill'
            ],
            'Settings': [
                'Enable privacy mode',
                'Disable privacy mode',
                'Toggle privacy',
                'Panic mode'
            ],
            'Help': [
                'Help',
                'What can you do?',
                'Show commands'
            ]
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
                intent: intent,
                parameters: parameters,
                response: {
                    text: 'Are you sure you want to activate panic mode?',
                    title: 'Confirmation Required',
                    details: 'This will hide all sensitive data immediately.'
                }
            };
        }

        return this.processNavigation(intent, parameters);
    }
}