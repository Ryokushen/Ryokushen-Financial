// Modern UI - Main Application Orchestrator

import { APP_CONFIG, FEATURES, STORAGE_KEYS } from './config.js'
import { initAuth, checkAuthStatus } from './modules/auth.js'
import { initDashboard } from './modules/dashboard.js'
import { initTheme } from './modules/theme.js'
import { initNavigation } from './modules/navigation.js'
import { showLoading, hideLoading, showError } from './modules/ui.js'
import { initSupabase } from './modules/database.js'
import modalManager from './modules/modal.js'

// Application State
const appState = {
  user: null,
  theme: 'dark',
  privacyMode: false,
  currentPage: 'dashboard',
  data: {
    transactions: [],
    cashAccounts: [],
    investmentAccounts: [],
    debtAccounts: [],
    recurringBills: [],
    savingsGoals: [],
    smartRules: [],
  },
  cache: new Map(),
  isLoading: false,
  error: null,
}

// Make appState globally accessible for debugging
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.appState = appState
}

// Initialize Application
async function initApp() {
  try {
    showLoading('Initializing Ryokushen...')
    
    // Initialize Supabase
    await initSupabase()
    
    // Check authentication status
    const user = await checkAuthStatus()
    
    if (!user) {
      // Show auth screen
      hideLoading()
      const { showAuthScreen } = await import('./modules/auth.js')
      showAuthScreen()
      return
    }
    
    // User is authenticated
    appState.user = user
    
    // Initialize theme
    initTheme(appState)
    
    // Initialize navigation
    initNavigation(appState)
    
    // Load initial data
    await loadInitialData()
    
    // Initialize dashboard
    await initDashboard(appState)
    
    // Hide auth modal if visible
    const authModal = document.getElementById('auth-modal')
    if (authModal) {
      authModal.style.display = 'none'
    }
    
    // Setup event listeners
    setupEventListeners()
    
    // Hide loading
    hideLoading()
    
    // Show initial page
    showPage('dashboard')
    
  } catch (error) {
    console.error('Failed to initialize app:', error)
    hideLoading()
    showError('Failed to initialize application. Please refresh and try again.')
  }
}

// Load Initial Data
async function loadInitialData() {
  try {
    showLoading('Loading your financial data...')
    
    // Import data modules
    const { loadTransactions } = await import('./modules/transactions.js')
    const { loadAccounts } = await import('./modules/accounts.js')
    const { loadRecurringBills } = await import('./modules/recurringBills.js')
    const { loadSmartRules } = await import('./modules/smartRules.js')
    
    // Load data in parallel
    const [
      transactions,
      { cashAccounts, investmentAccounts, debtAccounts },
      recurringBills,
      smartRules,
    ] = await Promise.all([
      loadTransactions(),
      loadAccounts(),
      loadRecurringBills(),
      loadSmartRules(),
    ])
    
    // Update app state
    appState.data = {
      ...appState.data,
      transactions,
      cashAccounts,
      investmentAccounts,
      debtAccounts,
      recurringBills,
      smartRules,
    }
    
    // Process smart rules on loaded transactions
    if (FEATURES.SMART_RULES && smartRules.length > 0) {
      const { processTransactions } = await import('./modules/smartRules.js')
      await processTransactions(transactions, smartRules)
    }
    
  } catch (error) {
    console.error('Failed to load data:', error)
    showError('Failed to load some data. Some features may be limited.')
  }
}

// Show Page
async function showPage(pageName) {
  try {
    // Update current page
    appState.currentPage = pageName
    
    // Update navigation
    updateNavigation(pageName)
    
    // Update page title
    const pageTitle = document.getElementById('page-title')
    if (pageTitle) {
      pageTitle.textContent = pageName.charAt(0).toUpperCase() + pageName.slice(1)
    }
    
    // Load page content
    const pageContent = document.getElementById('page-content')
    if (!pageContent) return
    
    // Clear current content
    pageContent.innerHTML = ''
    pageContent.className = 'page-content animate-fadeIn'
    
    // Load page module and render
    switch (pageName) {
      case 'dashboard':
        const { renderDashboard } = await import('./modules/dashboard.js')
        await renderDashboard(appState)
        break
        
      case 'accounts':
        const { renderAccounts } = await import('./modules/accounts.js')
        await renderAccounts(appState)
        break
        
      case 'transactions':
        const { renderTransactions } = await import('./modules/transactions.js')
        await renderTransactions(appState)
        break
        
      case 'investments':
        const { renderInvestments } = await import('./modules/investments.js')
        await renderInvestments(appState)
        break
        
      case 'debt':
        const { renderDebt } = await import('./modules/debt.js')
        await renderDebt(appState)
        break
        
      case 'bills':
        const { renderBills } = await import('./modules/recurringBills.js')
        await renderBills(appState)
        break
        
      case 'rules':
        const { renderRules } = await import('./modules/smartRules.js')
        await renderRules(appState)
        break
        
      case 'settings':
        const { renderSettings } = await import('./modules/settings.js')
        await renderSettings(appState)
        break
        
      default:
        pageContent.innerHTML = '<p>Page not found</p>'
    }
    
  } catch (error) {
    console.error(`Failed to load page ${pageName}:`, error)
    showError(`Failed to load ${pageName} page`)
  }
}

// Update Navigation
function updateNavigation(activePage) {
  // Update sidebar navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.page === activePage) {
      item.classList.add('active')
    } else {
      item.classList.remove('active')
    }
  })
  
  // Update mobile navigation if exists
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    if (item.dataset.page === activePage) {
      item.classList.add('active')
    } else {
      item.classList.remove('active')
    }
  })
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation clicks
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page
      if (page && page !== appState.currentPage) {
        showPage(page)
      }
    })
  })
  
  // Privacy toggle
  const privacyToggle = document.getElementById('privacy-toggle')
  if (privacyToggle) {
    privacyToggle.addEventListener('click', () => {
      togglePrivacyMode()
    })
  }
  
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle')
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      toggleTheme()
    })
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout?')) {
        await logout()
      }
    })
  }
  
  // Mobile menu toggle
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle')
  const sidebar = document.getElementById('sidebar')
  if (mobileMenuToggle && sidebar) {
    mobileMenuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open')
    })
  }
  
  // Close sidebar on mobile when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth < 768) {
      const sidebar = document.getElementById('sidebar')
      const mobileMenuToggle = document.getElementById('mobile-menu-toggle')
      if (sidebar && 
          sidebar.classList.contains('mobile-open') && 
          !sidebar.contains(e.target) && 
          e.target !== mobileMenuToggle) {
        sidebar.classList.remove('mobile-open')
      }
    }
  })
  
  // Handle resize events
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      handleResize()
    }, 250)
  })
}

// Toggle Privacy Mode
function togglePrivacyMode() {
  appState.privacyMode = !appState.privacyMode
  
  // Update UI
  document.body.classList.toggle('privacy-mode', appState.privacyMode)
  
  // Update icon
  const privacyToggle = document.getElementById('privacy-toggle')
  if (privacyToggle) {
    const icon = privacyToggle.querySelector('.theme-icon')
    if (icon) {
      icon.textContent = appState.privacyMode ? '👁️' : '👁️‍🗨️'
    }
  }
  
  // Save preference
  localStorage.setItem(STORAGE_KEYS.privacyMode, appState.privacyMode)
  
  // Refresh current page to apply privacy mode
  showPage(appState.currentPage)
}

// Toggle Theme
function toggleTheme() {
  const newTheme = appState.theme === 'dark' ? 'light' : 'dark'
  appState.theme = newTheme
  
  // Update DOM
  document.documentElement.setAttribute('data-theme', newTheme)
  
  // Update icon
  const themeToggle = document.getElementById('theme-toggle')
  if (themeToggle) {
    const icon = themeToggle.querySelector('.theme-icon')
    if (icon) {
      icon.textContent = newTheme === 'dark' ? '🌙' : '☀️'
    }
  }
  
  // Save preference
  localStorage.setItem(STORAGE_KEYS.theme, newTheme)
}

// Handle Window Resize
function handleResize() {
  const width = window.innerWidth
  
  // Close mobile sidebar on desktop
  if (width >= 768) {
    const sidebar = document.getElementById('sidebar')
    if (sidebar) {
      sidebar.classList.remove('mobile-open')
    }
  }
  
  // Refresh charts if on dashboard
  if (appState.currentPage === 'dashboard') {
    import('./modules/dashboard.js').then(({ refreshCharts }) => {
      if (refreshCharts) {
        refreshCharts(appState)
      }
    })
  }
}

// Logout
async function logout() {
  try {
    showLoading('Logging out...')
    
    const { signOut } = await import('./modules/auth.js')
    await signOut()
    
    // Clear app state
    appState.user = null
    appState.data = {
      transactions: [],
      cashAccounts: [],
      investmentAccounts: [],
      debtAccounts: [],
      recurringBills: [],
      savingsGoals: [],
      smartRules: [],
    }
    
    // Redirect to auth
    window.location.reload()
    
  } catch (error) {
    console.error('Logout failed:', error)
    hideLoading()
    showError('Failed to logout. Please try again.')
  }
}

// Global error handler
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason)
  showError('An unexpected error occurred. Please refresh if issues persist.')
})

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp)
} else {
  initApp()
}

// Export functions for modules
export {
  appState,
  showPage,
  loadInitialData,
  modalManager,
}