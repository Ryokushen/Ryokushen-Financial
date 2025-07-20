// Theme Module

import config from '../config.js'

// Initialize theme
export function initTheme(appState) {
  // Load saved theme or use default
  const savedTheme = localStorage.getItem(config.STORAGE_KEYS.theme) || config.APP_CONFIG.theme
  
  // Apply theme
  setTheme(savedTheme)
  appState.theme = savedTheme
  
  // Listen for system theme changes
  if (savedTheme === 'system') {
    watchSystemTheme(appState)
  }
}

// Set theme
export function setTheme(theme) {
  const root = document.documentElement
  
  if (theme === 'system') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
  } else {
    root.setAttribute('data-theme', theme)
  }
  
  // Update theme toggle icon
  updateThemeIcon(theme)
  
  // Save preference
  localStorage.setItem(config.STORAGE_KEYS.theme, theme)
}

// Update theme icon
function updateThemeIcon(theme) {
  const themeToggle = document.getElementById('theme-toggle')
  if (!themeToggle) return
  
  const icon = themeToggle.querySelector('.theme-icon')
  if (!icon) return
  
  const actualTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  
  icon.textContent = actualTheme === 'dark' ? '🌙' : '☀️'
}

// Watch system theme changes
function watchSystemTheme(appState) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  
  mediaQuery.addEventListener('change', (e) => {
    if (appState.theme === 'system') {
      const newTheme = e.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', newTheme)
      updateThemeIcon('system')
    }
  })
}

// Get current theme
export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark'
}

// Toggle theme
export function toggleTheme(appState) {
  const themes = ['light', 'dark', 'system']
  const currentIndex = themes.indexOf(appState.theme)
  const nextIndex = (currentIndex + 1) % themes.length
  const nextTheme = themes[nextIndex]
  
  setTheme(nextTheme)
  appState.theme = nextTheme
  
  if (nextTheme === 'system') {
    watchSystemTheme(appState)
  }
}

// Apply theme-specific styles
export function applyThemeStyles() {
  const theme = getCurrentTheme()
  
  // Update Chart.js theme
  if (window.Chart) {
    const isDark = theme === 'dark'
    
    Chart.defaults.color = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
    Chart.defaults.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    Chart.defaults.plugins.legend.labels.color = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
    Chart.defaults.plugins.tooltip.backgroundColor = isDark ? 'rgba(15, 22, 35, 0.9)' : 'rgba(255, 255, 255, 0.9)'
    Chart.defaults.plugins.tooltip.titleColor = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
    Chart.defaults.plugins.tooltip.bodyColor = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)'
    Chart.defaults.plugins.tooltip.borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
  }
}