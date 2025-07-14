// js/modules/ui.js
// REMOVED: import { updateAllDisplays } from '../app.js';
import * as Accounts from './accounts.js';
import * as Transactions from './transactions.js';
import * as Investments from './investments.js';
import * as Debt from './debt.js';
import * as Recurring from './recurring.js';
import * as Savings from './savings.js';
// We need these two to properly render the dashboard tab specifically
import { createCharts } from './charts.js';
import { updateDashboard } from './dashboard.js'; // Import from dashboard module
import { modalManager } from './modalManager.js';
import { debug } from './debug.js';
import { reapplyPrivacy } from './privacy.js';


export function announceToScreenReader(message) {
    const announcer = document.getElementById("screen-reader-announcer");
    if (announcer) {
        announcer.textContent = message;
        setTimeout(() => {
            announcer.textContent = "";
        }, 1000);
    }
}

export function showError(message) {
    debug.error(message);
    announceToScreenReader("Error: " + message);

    const errorBanner = document.getElementById("error-banner");
    const errorMessage = document.getElementById("error-message");

    if (errorBanner && errorMessage) {
        errorMessage.textContent = message;
        errorBanner.style.display = 'flex';

        setTimeout(() => {
            if (errorBanner.style.display === 'flex') {
                errorBanner.style.display = 'none';
            }
        }, 5000);
    }
}

export function switchTab(tabName, appState) {
    const tabContents = document.querySelectorAll(".tab-content");
    tabContents.forEach(content => {
        content.classList.remove("active");
    });

    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(button => {
        button.classList.remove("active");
    });

    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add("active");
    }

    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add("active");
    }

    tabButtons.forEach(button => {
        button.classList.remove("active");
        button.setAttribute('aria-selected', 'false');  // Add
    });
    if (activeButton) {
        activeButton.classList.add("active");
        activeButton.setAttribute('aria-selected', 'true');  // Add
    }

    announceToScreenReader(`Switched to ${tabName} tab`);

    // CORRECTED LOGIC: Call specific renderers for each tab
    if (tabName === "dashboard") {
        // Call only what's needed for the dashboard
        updateDashboard(appState);
        createCharts(appState);
    } else if (tabName === "accounts") {
        Accounts.renderCashAccounts(appState);
    } else if (tabName === "transactions") {
        Transactions.renderTransactions(appState);
    } else if (tabName === "investments") {
        Investments.renderInvestmentAccountsEnhanced(appState);
        Savings.renderSavingsGoals(appState);
    } else if (tabName === "debt") {
        Debt.renderDebtAccounts(appState);
        // Create debt-specific charts when switching to debt tab
        if (window.updateDebtCharts) {
            window.updateDebtCharts(appState);
        }
    } else if (tabName === "recurring") {
        Recurring.renderRecurringBills(appState);
    }
    
    // Reapply privacy mode after rendering new content
    setTimeout(() => {
        reapplyPrivacy();
    }, 100);
}

// Use modalManager for all modal operations
export const openModal = modalManager.open.bind(modalManager);
export const closeModal = modalManager.close.bind(modalManager);

// Escape key handler is already managed by modalManager