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
import { eventManager } from './eventManager.js';

export function announceToScreenReader(message) {
  const announcer = document.getElementById('screen-reader-announcer');
  if (announcer) {
    announcer.textContent = message;
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }
}

export function showError(message) {
  debug.error(message);
  announceToScreenReader(`Error: ${message}`);

  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');

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

export function showSuccess(message) {
  debug.log(message);
  announceToScreenReader(message);
}

// Listen for custom show-error events from formUtils
eventManager.addEventListener(window, 'show-error', e => {
  if (e.detail && e.detail.message) {
    showError(e.detail.message);
  }
});

export function switchTab(tabName, appState) {
  // Force scroll to top when switching tabs
  window.scrollTo(0, 0);

  // Prevent any focus that might cause scrolling
  if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }

  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.remove('active');
  });

  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  const selectedTab = document.getElementById(tabName);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeButton) {
    activeButton.classList.add('active');
  }

  tabButtons.forEach(button => {
    button.classList.remove('active');
    button.setAttribute('aria-selected', 'false'); // Add
  });
  if (activeButton) {
    activeButton.classList.add('active');
    activeButton.setAttribute('aria-selected', 'true'); // Add
  }

  announceToScreenReader(`Switched to ${tabName} tab`);

  // CORRECTED LOGIC: Call specific renderers for each tab
  if (tabName === 'dashboard') {
    // Call only what's needed for the dashboard
    updateDashboard(appState);
    createCharts(appState);
  } else if (tabName === 'accounts') {
    Accounts.renderCashAccounts(appState);
  } else if (tabName === 'transactions') {
    Transactions.renderTransactions(appState);
  } else if (tabName === 'investments') {
    Investments.renderInvestmentAccountsEnhanced(appState);
    Savings.renderSavingsGoals(appState);
  } else if (tabName === 'debt') {
    Debt.renderDebtAccounts(appState);
    // Note: Debt charts are created by createCharts() in charts.js
  } else if (tabName === 'recurring') {
    Recurring.renderRecurringBills(appState);
  } else if (tabName === 'performance') {
    // Initialize performance dashboard when switching to it
    try {
      // Use dynamic import to avoid circular dependency issues
      import('./performanceDashboard.js')
        .then(module => {
          if (module.performanceDashboard) {
            module.performanceDashboard.init();
          }
        })
        .catch(error => {
          debug.error('Failed to load performance dashboard module:', error);
        });
    } catch (error) {
      debug.error('Failed to initialize performance dashboard:', error);
    }
  } else if (tabName === 'sankey') {
    try {
      import('./cashFlowSankey.js')
        .then(module => {
          if (module.cashFlowSankey) {
            window.cashFlowSankey = module.cashFlowSankey;
            module.cashFlowSankey.init();

            const periodButtons = document.querySelectorAll('.period-btn');
            periodButtons.forEach(btn => {
              btn.addEventListener('click', () => {
                periodButtons.forEach(b => b.classList.toggle('active', b === btn));
                module.cashFlowSankey.setPeriod(btn.dataset.period);
              });
            });

            const exportBtn = document.getElementById('export-sankey');
            if (exportBtn) {
              exportBtn.addEventListener('click', () => module.cashFlowSankey.exportDiagram());
            }
          }
        })
        .catch(error => {
          debug.error('Failed to load cash flow sankey module:', error);
        });
    } catch (error) {
      debug.error('Failed to initialize cash flow sankey:', error);
    }
  } else if (tabName === 'salary') {
    try {
      import('./payCalculator.js')
        .then(module => {
          if (module.payCalculator) {
            window.payCalculator = module.payCalculator;
            module.payCalculator.init();
          }
        })
        .catch(error => {
          debug.error('Failed to load pay calculator module:', error);
        });
    } catch (error) {
      debug.error('Failed to initialize pay calculator:', error);
    }
  } else if (tabName === 'settings') {
    // Initialize privacy settings when switching to settings tab
    import('./privacySettings.js')
      .then(module => {
        if (module.initializePrivacySettings) {
          setTimeout(() => module.initializePrivacySettings(), 100);
        }
      })
      .catch(error => {
        debug.error('Failed to load privacy settings module:', error);
      });
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
