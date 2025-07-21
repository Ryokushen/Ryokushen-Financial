// Navigation Module

import { showPage } from '../app.js'

// Initialize navigation
export function initNavigation(appState) {
  setupSidebarNavigation(appState)
  setupMobileNavigation(appState)
  setupKeyboardShortcuts(appState)
  updateUserInfo(appState)
}

// Setup sidebar navigation
function setupSidebarNavigation(appState) {
  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle')
  const sidebar = document.getElementById('sidebar')
  
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed')
      // Save preference
      localStorage.setItem('ryokushen_sidebar_collapsed', sidebar.classList.contains('collapsed'))
    })
    
    // Restore collapsed state
    const isCollapsed = localStorage.getItem('ryokushen_sidebar_collapsed') === 'true'
    if (isCollapsed) {
      sidebar.classList.add('collapsed')
    }
  }
  
  // Navigation items
  const navItems = document.querySelectorAll('.nav-item')
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault()
      const page = item.dataset.page
      if (page && page !== appState.currentPage) {
        showPage(page)
      }
    })
  })
}

// Setup mobile navigation
function setupMobileNavigation(appState) {
  // Mobile menu toggle
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle')
  const sidebar = document.getElementById('sidebar')
  
  if (mobileMenuToggle && sidebar) {
    mobileMenuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open')
    })
  }
  
  // Create mobile bottom navigation if on mobile
  if (window.innerWidth < 768) {
    createMobileBottomNav(appState)
  }
  
  // Handle resize
  window.addEventListener('resize', () => {
    if (window.innerWidth < 768) {
      if (!document.getElementById('mobile-bottom-nav')) {
        createMobileBottomNav(appState)
      }
    } else {
      const mobileNav = document.getElementById('mobile-bottom-nav')
      if (mobileNav) {
        mobileNav.remove()
      }
    }
  })
}

// Create mobile bottom navigation
function createMobileBottomNav(appState) {
  const mobileNav = document.createElement('nav')
  mobileNav.id = 'mobile-bottom-nav'
  mobileNav.className = 'mobile-bottom-nav'
  
  const navItems = [
    { page: 'dashboard', icon: '📊', label: 'Dashboard' },
    { page: 'accounts', icon: '💰', label: 'Accounts' },
    { page: 'transactions', icon: '📈', label: 'Activity' },
    { page: 'bills', icon: '📅', label: 'Bills' },
    { page: 'settings', icon: '⚙️', label: 'Settings' },
  ]
  
  navItems.forEach(item => {
    const navItem = document.createElement('div')
    navItem.className = 'mobile-nav-item'
    navItem.dataset.page = item.page
    if (item.page === appState.currentPage) {
      navItem.classList.add('active')
    }
    
    navItem.innerHTML = `
      <span class="mobile-nav-icon">${item.icon}</span>
      <span class="mobile-nav-label">${item.label}</span>
    `
    
    navItem.addEventListener('click', () => {
      if (item.page !== appState.currentPage) {
        showPage(item.page)
      }
    })
    
    mobileNav.appendChild(navItem)
  })
  
  document.body.appendChild(mobileNav)
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts(appState) {
  document.addEventListener('keydown', (e) => {
    // Skip if user is typing in an input
    if (e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable) {
      return
    }
    
    // Command/Ctrl + K - Quick search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      openQuickSearch()
      return
    }
    
    // Single key shortcuts
    switch (e.key) {
      case 'd':
        showPage('dashboard')
        break
      case 'a':
        showPage('accounts')
        break
      case 't':
        showPage('transactions')
        break
      case 'b':
        showPage('bills')
        break
      case 's':
        showPage('settings')
        break
      case '/':
        e.preventDefault()
        focusSearch()
        break
      case 'p':
        togglePrivacyMode(appState)
        break
      case '?':
        showKeyboardShortcuts()
        break
    }
  })
}

// Open quick search
function openQuickSearch() {
  // TODO: Implement quick search modal
  console.log('Quick search not yet implemented')
}

// Focus search input
function focusSearch() {
  const searchInput = document.querySelector('.search-input')
  if (searchInput) {
    searchInput.focus()
  }
}

// Toggle privacy mode
function togglePrivacyMode(appState) {
  const privacyToggle = document.getElementById('privacy-toggle')
  if (privacyToggle) {
    privacyToggle.click()
  }
}

// Show keyboard shortcuts
function showKeyboardShortcuts() {
  const shortcuts = [
    { key: 'D', description: 'Go to Dashboard' },
    { key: 'A', description: 'Go to Accounts' },
    { key: 'T', description: 'Go to Transactions' },
    { key: 'B', description: 'Go to Bills' },
    { key: 'S', description: 'Go to Settings' },
    { key: '/', description: 'Focus search' },
    { key: 'P', description: 'Toggle privacy mode' },
    { key: '⌘/Ctrl + K', description: 'Quick search' },
    { key: '?', description: 'Show shortcuts' },
  ]
  
  // Create modal content
  const content = `
    <div style="max-width: 400px;">
      <h3 style="margin-bottom: 24px;">Keyboard Shortcuts</h3>
      <div class="shortcuts-list">
        ${shortcuts.map(s => `
          <div class="shortcut-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: var(--text-secondary);">${s.description}</span>
            <kbd style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.875rem;">${s.key}</kbd>
          </div>
        `).join('')}
      </div>
    </div>
  `
  
  // Show in modal
  import('./ui.js').then(({ showModal }) => {
    if (showModal) {
      showModal('Keyboard Shortcuts', content)
    }
  })
}

// Update user info in navigation
function updateUserInfo(appState) {
  if (!appState.user) return
  
  const userName = document.getElementById('user-name')
  const userEmail = document.getElementById('user-email')
  
  if (userName) {
    userName.textContent = appState.user.user_metadata?.full_name || 'User'
  }
  
  if (userEmail) {
    userEmail.textContent = appState.user.email || ''
  }
}

// Update active navigation state
export function updateActiveNavigation(pageName) {
  // Update sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.page === pageName) {
      item.classList.add('active')
    } else {
      item.classList.remove('active')
    }
  })
  
  // Update mobile nav
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    if (item.dataset.page === pageName) {
      item.classList.add('active')
    } else {
      item.classList.remove('active')
    }
  })
}

// Check if sidebar is collapsed
export function isSidebarCollapsed() {
  const sidebar = document.getElementById('sidebar')
  return sidebar ? sidebar.classList.contains('collapsed') : false
}

// Toggle sidebar
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar')
  if (sidebar) {
    sidebar.classList.toggle('collapsed')
    localStorage.setItem('ryokushen_sidebar_collapsed', sidebar.classList.contains('collapsed'))
  }
}