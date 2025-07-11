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
import { updateDashboard } from '../app.js'; // It's okay to import the specific dashboard renderer from app.js

export function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading-state">Loading...</div>';
    }
}

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
    console.error(message);
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
    } else if (tabName === "recurring") {
        Recurring.renderRecurringBills(appState);
    }
}

// Generic Modal Controls
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) closeModal(activeModal.id);
    }
});