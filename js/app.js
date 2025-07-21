// Modern UI - Main Application Orchestrator

import { APP_CONFIG, FEATURES, STORAGE_KEYS } from './config.js'
import { initAuth, checkAuthStatus } from './modules/auth.js'
import { initDashboard } from './modules/dashboard.js'
import { initTheme } from './modules/theme.js'
import { initNavigation } from './modules/navigation.js'
import { showLoading, hideLoading, showError } from './modules/ui.js'
import { initSupabase, setCachedAuthUser, setSkipAuthChecks, setInitialLoad } from './modules/database.js'
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
  initialized: false, // Prevent multiple initializations
}

// Make appState globally accessible for debugging and modules
window.appState = appState

// Make loadInitialData globally accessible for modules
window.loadInitialData = loadInitialData

// Add database test functions for debugging in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  import('./modules/database.js').then(({ testDatabaseConnection, testInvestmentAccountsConnection }) => {
    window.testDB = testDatabaseConnection
    window.testInvestments = testInvestmentAccountsConnection
  })
}

// Initialize Application
async function initApp() {
  // Prevent duplicate initialization
  if (appState.initialized) {
    console.log('App already initialized, skipping')
    return
  }
  
  try {
    showLoading('Initializing Ryokushen...')
    
    // Initialize Supabase
    await initSupabase()
    
    // Initialize auth listeners first
    initAuth()
    
    // Check authentication status
    const user = await checkAuthStatus()
    
    if (!user) {
      // Show auth screen
      hideLoading()
      const { showAuthScreen } = await import('./modules/auth.js')
      showAuthScreen()
      return
    }
    
    // Mark as initialized
    appState.initialized = true
    
    // User is authenticated
    appState.user = user
    
    // Cache the authenticated user for database queries
    setCachedAuthUser(user)
    
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
    // Reset initialized flag on error
    appState.initialized = false
  }
}

// Progressive data loading state
const loadingState = {
  accounts: 'pending',
  transactions: 'pending',
  bills: 'pending',
  rules: 'pending',
  progress: 0,
  total: 4
}

// Reset loading state for forced refresh
function resetLoadingState() {
  loadingState.accounts = 'pending'
  loadingState.transactions = 'pending'
  loadingState.bills = 'pending'
  loadingState.rules = 'pending'
  loadingState.progress = 0
}

// Update loading progress
function updateLoadingProgress(module, status) {
  loadingState[module] = status
  if (status === 'loaded' || status === 'failed') {
    loadingState.progress++
  }
  
  const percentage = Math.round((loadingState.progress / loadingState.total) * 100)
  showLoading(`Loading your financial data... ${percentage}%`)
}

// Load Initial Data Progressively
async function loadInitialData(forceRefresh = false) {
  try {
    // Reset loading state if forcing refresh
    if (forceRefresh) {
      resetLoadingState()
      appState.cache.clear() // Clear any cached data
    }
    
    showLoading('Loading your financial data... 0%')
    
    // Skip auth checks during initial load since we know user is authenticated
    setSkipAuthChecks(true)
    
    // Mark as initial load for longer timeouts
    setInitialLoad(true)
    
    // Import data modules
    const modules = {
      accounts: await import('./modules/accounts.js'),
      transactions: await import('./modules/transactions.js'),
      bills: await import('./modules/recurringBills.js'),
      rules: await import('./modules/smartRules.js')
    }
    
    // Load critical data first (accounts needed for dashboard)
    try {
      updateLoadingProgress('accounts', 'loading')
      const accountData = await modules.accounts.loadAccounts()
      appState.data = {
        ...appState.data,
        cashAccounts: accountData.cashAccounts || [],
        investmentAccounts: accountData.investmentAccounts || [],
        debtAccounts: accountData.debtAccounts || []
      }
      updateLoadingProgress('accounts', 'loaded')
    } catch (error) {
      console.error('Failed to load accounts:', error)
      updateLoadingProgress('accounts', 'failed')
      // Continue with empty accounts
      appState.data.cashAccounts = []
      appState.data.investmentAccounts = []
      appState.data.debtAccounts = []
    }
    
    // Load transactions (limited to recent ones for dashboard)
    try {
      updateLoadingProgress('transactions', 'loading')
      const transactions = await modules.transactions.loadTransactions()
      appState.data.transactions = transactions || []
      updateLoadingProgress('transactions', 'loaded')
    } catch (error) {
      console.error('Failed to load transactions:', error)
      updateLoadingProgress('transactions', 'failed')
      appState.data.transactions = []
    }
    
    // Load bills and rules in background (not critical for dashboard)
    const backgroundPromises = []
    
    // Load bills
    backgroundPromises.push(
      modules.bills.loadRecurringBills()
        .then(bills => {
          appState.data.recurringBills = bills || []
          updateLoadingProgress('bills', 'loaded')
        })
        .catch(error => {
          console.error('Failed to load bills:', error)
          appState.data.recurringBills = []
          updateLoadingProgress('bills', 'failed')
        })
    )
    
    // Load smart rules
    backgroundPromises.push(
      modules.rules.loadSmartRules()
        .then(rules => {
          appState.data.smartRules = rules || []
          updateLoadingProgress('rules', 'loaded')
          
          // Process rules if enabled
          if (FEATURES.SMART_RULES && rules.length > 0 && appState.data.transactions.length > 0) {
            return modules.rules.processTransactions(appState.data.transactions, rules)
          }
        })
        .catch(error => {
          console.error('Failed to load rules:', error)
          appState.data.smartRules = []
          updateLoadingProgress('rules', 'failed')
        })
    )
    
    // Wait for background tasks with timeout
    await Promise.race([
      Promise.all(backgroundPromises),
      new Promise(resolve => setTimeout(resolve, 10000)) // 10s timeout for background tasks
    ])
    
  } catch (error) {
    console.error('Failed to load data:', error)
    showError('Failed to load some data. Some features may be limited.')
  } finally {
    // Re-enable auth checks after initial load
    setSkipAuthChecks(false)
    
    // Reset initial load flag
    setInitialLoad(false)
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
        console.log('=== ROUTING TO INVESTMENTS PAGE ===')
        try {
          console.log('Importing investments module...')
          const investmentsModule = await import(`./modules/investments.js?t=${Date.now()}`)
          console.log('Investments module imported:', investmentsModule)
          console.log('renderInvestments function:', investmentsModule.renderInvestments)
          
          console.log('Calling renderInvestments...')
          await investmentsModule.renderInvestments(appState)
          console.log('renderInvestments completed')
        } catch (error) {
          console.error('Error in investments routing:', error)
        }
        break
        
      case 'debt':
        const { renderDebt } = await import('./modules/debt.js?t=' + Date.now())
        await renderDebt(appState)
        break
        
      case 'bills':
        const { renderBills } = await import('./modules/bills.js')
        await renderBills(appState)
        break
        
      case 'rules':
        const { renderRules } = await import('./modules/rules.js')
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

// Continue initialization after authentication
export async function continueWithUser(user) {
  // Prevent duplicate initialization
  if (appState.initialized) {
    console.log('App already initialized, skipping continueWithUser')
    return
  }
  
  try {
    showLoading('Loading your financial data...')
    
    // Mark as initialized early to prevent race conditions
    appState.initialized = true
    
    // User is authenticated
    appState.user = user
    
    // Cache the authenticated user for database queries
    setCachedAuthUser(user)
    
    // Initialize theme
    initTheme(appState)
    
    // Initialize navigation
    initNavigation(appState)
    
    // Load initial data
    await loadInitialData()
    
    // Initialize dashboard
    await initDashboard(appState)
    
    // Setup event listeners
    setupEventListeners()
    
    // Hide loading
    hideLoading()
    
    // Show initial page
    showPage('dashboard')
    
  } catch (error) {
    console.error('Failed to continue initialization:', error)
    hideLoading()
    showError('Failed to load application. Please refresh and try again.')
    // Reset initialized flag on error
    appState.initialized = false
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

// Export default for auth module
export default { continueWithUser }