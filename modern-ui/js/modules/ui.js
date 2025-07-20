// UI Utilities Module

// Show loading overlay
export function showLoading(message = 'Loading...') {
  let overlay = document.getElementById('loading-overlay')
  
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'loading-overlay'
    overlay.className = 'loading-overlay'
    overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">${message}</div>
    `
    document.body.appendChild(overlay)
  } else {
    const loadingText = overlay.querySelector('.loading-text')
    if (loadingText) {
      loadingText.textContent = message
    }
  }
  
  overlay.style.display = 'flex'
  overlay.classList.add('animate-fadeIn')
}

// Hide loading overlay
export function hideLoading() {
  const overlay = document.getElementById('loading-overlay')
  if (overlay) {
    overlay.classList.add('animate-fadeOut')
    setTimeout(() => {
      overlay.style.display = 'none'
      overlay.classList.remove('animate-fadeOut')
    }, 300)
  }
}

// Show error message
export function showError(message, duration = 5000) {
  showToast(message, 'error', duration)
}

// Show success message
export function showSuccess(message, duration = 3000) {
  showToast(message, 'success', duration)
}

// Show info message
export function showInfo(message, duration = 3000) {
  showToast(message, 'info', duration)
}

// Show toast notification
export function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container')
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    toastContainer.style.cssText = `
      position: fixed;
      top: 80px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    `
    document.body.appendChild(toastContainer)
  }
  
  // Create toast element
  const toast = document.createElement('div')
  toast.className = `toast toast-${type} glass-panel animate-slideInRight`
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 24px;
    min-width: 300px;
    max-width: 500px;
    pointer-events: auto;
    cursor: pointer;
  `
  
  // Icons for different types
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  }
  
  // Colors for different types
  const colors = {
    success: 'rgba(16, 185, 129, 0.2)',
    error: 'rgba(239, 68, 68, 0.2)',
    info: 'rgba(59, 130, 246, 0.2)',
    warning: 'rgba(245, 158, 11, 0.2)'
  }
  
  toast.style.backgroundColor = colors[type] || colors.info
  
  toast.innerHTML = `
    <span class="toast-icon" style="font-size: 20px;">${icons[type] || icons.info}</span>
    <span class="toast-message" style="flex: 1; color: var(--text-primary);">${message}</span>
    <button class="toast-close" style="
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      font-size: 18px;
    ">×</button>
  `
  
  // Add to container
  toastContainer.appendChild(toast)
  
  // Auto remove after duration
  const removeToast = () => {
    toast.classList.add('animate-slideOutRight')
    setTimeout(() => {
      toast.remove()
      // Remove container if empty
      if (toastContainer.children.length === 0) {
        toastContainer.remove()
      }
    }, 300)
  }
  
  const timeoutId = setTimeout(removeToast, duration)
  
  // Click to dismiss
  toast.addEventListener('click', () => {
    clearTimeout(timeoutId)
    removeToast()
  })
}

// Show confirmation dialog
export function showConfirm(title, message, onConfirm, onCancel) {
  return new Promise((resolve) => {
    // Create modal backdrop
    const backdrop = document.createElement('div')
    backdrop.className = 'modal-backdrop modal-backdrop-glass animate-fadeIn'
    
    // Create modal content
    const modal = document.createElement('div')
    modal.className = 'modal-content glass-panel animate-scaleIn'
    modal.style.maxWidth = '400px'
    
    modal.innerHTML = `
      <div class="modal-header" style="margin-bottom: 24px;">
        <h3 style="margin: 0; font-size: 1.25rem;">${title}</h3>
      </div>
      <div class="modal-body" style="margin-bottom: 32px;">
        <p style="margin: 0; color: var(--text-secondary);">${message}</p>
      </div>
      <div class="modal-footer" style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn btn-glass" id="modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="modal-confirm">Confirm</button>
      </div>
    `
    
    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    
    // Handle buttons
    const confirmBtn = modal.querySelector('#modal-confirm')
    const cancelBtn = modal.querySelector('#modal-cancel')
    
    const closeModal = () => {
      backdrop.classList.add('animate-fadeOut')
      modal.classList.add('animate-scaleOut')
      setTimeout(() => {
        backdrop.remove()
      }, 300)
    }
    
    confirmBtn.addEventListener('click', () => {
      closeModal()
      if (onConfirm) onConfirm()
      resolve(true)
    })
    
    cancelBtn.addEventListener('click', () => {
      closeModal()
      if (onCancel) onCancel()
      resolve(false)
    })
    
    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal()
        if (onCancel) onCancel()
        resolve(false)
      }
    })
  })
}

// Format currency
export function formatCurrency(amount, options = {}) {
  const {
    currency = 'USD',
    locale = 'en-US',
    hideSymbol = false,
    showPlus = false
  } = options
  
  if (isNaN(amount)) return '$0.00'
  
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  
  let result = formatted
  
  if (hideSymbol) {
    result = result.replace(/[^0-9.,\s-]/g, '').trim()
  }
  
  if (amount < 0) {
    result = `-${result}`
  } else if (amount > 0 && showPlus) {
    result = `+${result}`
  }
  
  return result
}

// Format date
export function formatDate(date, format = 'short') {
  if (!date) return ''
  
  const d = new Date(date)
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      })
    case 'medium':
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    case 'long':
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    case 'relative':
      return getRelativeTime(d)
    default:
      return d.toLocaleDateString()
  }
}

// Get relative time
export function getRelativeTime(date) {
  const now = new Date()
  const d = new Date(date)
  const diff = now - d
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`
  
  return d.toLocaleDateString()
}

// Create skeleton loader
export function createSkeleton(type = 'text', options = {}) {
  const skeleton = document.createElement('div')
  skeleton.className = 'skeleton'
  
  switch (type) {
    case 'text':
      skeleton.className += ' skeleton-text'
      skeleton.style.width = options.width || '100%'
      break
    case 'value':
      skeleton.className += ' skeleton-value'
      skeleton.style.width = options.width || '120px'
      break
    case 'card':
      skeleton.style.height = options.height || '200px'
      skeleton.style.borderRadius = 'var(--radius-lg)'
      break
    case 'circle':
      skeleton.style.width = options.size || '40px'
      skeleton.style.height = options.size || '40px'
      skeleton.style.borderRadius = '50%'
      break
  }
  
  return skeleton
}

// Debounce function
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Throttle function
export function throttle(func, limit) {
  let inThrottle
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Copy to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess('Copied to clipboard')
    return true
  } catch (err) {
    console.error('Failed to copy:', err)
    showError('Failed to copy to clipboard')
    return false
  }
}

// Privacy mode utilities
export function maskValue(value, privacyMode = false) {
  if (!privacyMode) return value
  return '••••••'
}

export function maskCurrency(amount, privacyMode = false, options = {}) {
  if (!privacyMode) return formatCurrency(amount, options)
  return '••••••'
}