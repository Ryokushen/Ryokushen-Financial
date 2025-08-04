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

let errorTimeout = null;

export function showError(message, duration = 8000) {
  debug.error(message);
  announceToScreenReader(`Error: ${message}`);

  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');

  if (errorBanner && errorMessage) {
    // Clear any existing timeout
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }

    errorMessage.textContent = message;
    errorBanner.style.display = 'flex';

    // Only auto-hide for simple messages, complex errors stay visible
    if (message.length < 100 && duration > 0) {
      errorTimeout = setTimeout(() => {
        if (errorBanner.style.display === 'flex') {
          errorBanner.style.display = 'none';
        }
      }, duration);
    }
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
    debug.log('=== SWITCHING TO PERFORMANCE TAB ===');
    console.log('Chart.js status:', typeof window.Chart, window.Chart ? 'LOADED' : 'NOT LOADED');
    debug.log('Switching to performance tab...');

    // Check if Chart.js is loaded
    if (!window.Chart) {
      debug.warn('Chart.js not loaded yet, waiting...');
      // Wait for Chart.js to load
      const checkChartJs = setInterval(() => {
        if (window.Chart) {
          clearInterval(checkChartJs);
          debug.log('Chart.js now available, proceeding with dashboard init');
          loadPerformanceDashboard();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkChartJs);
        if (!window.Chart) {
          debug.error('Chart.js failed to load after 5 seconds');
          showError('Unable to load charting library. Please refresh the page.');
        }
      }, 5000);
    } else {
      loadPerformanceDashboard();
    }

    function loadPerformanceDashboard() {
      try {
        // Use dynamic import to avoid circular dependency issues
        import('./performanceDashboard.js')
          .then(module => {
            if (module && module.performanceDashboard) {
              debug.log('Performance dashboard module loaded successfully');
              // Small delay to ensure DOM is ready
              setTimeout(() => {
                debug.log('Initializing performance dashboard...');
                module.performanceDashboard
                  .init()
                  .then(() => {
                    debug.log('Performance dashboard initialized successfully');
                  })
                  .catch(error => {
                    debug.error('Error during dashboard initialization:', error);
                    showError('Failed to initialize performance dashboard');
                  });
              }, 100);
            } else {
              debug.error('performanceDashboard not found in module', module);
              showError('Performance dashboard module is not properly configured');
            }
          })
          .catch(error => {
            debug.error('Failed to load performance dashboard module:', error);
            showError('Failed to load performance dashboard');
          });
      } catch (error) {
        debug.error('Failed to initialize performance dashboard:', error);
        showError('An error occurred while loading the performance dashboard');
      }
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
