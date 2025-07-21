// Modal Management System Module

class ModalManager {
  constructor() {
    this.activeModals = []
    this.modalStack = []
    this.focusTrap = null
    this.previousActiveElement = null
    this.init()
  }

  init() {
    // Create modal container if it doesn't exist
    if (!document.getElementById('modal-container')) {
      const container = document.createElement('div')
      container.id = 'modal-container'
      document.body.appendChild(container)
    }

    // Global event listeners
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
    document.addEventListener('click', this.handleBackdropClick.bind(this))
  }

  // Create and show a modal
  async show(options) {
    const {
      title,
      content,
      size = 'medium',
      closable = true,
      onConfirm = null,
      onCancel = null,
      confirmText = 'Save',
      cancelText = 'Cancel',
      showFooter = true,
      className = '',
      data = {}
    } = options

    // Store the currently focused element
    this.previousActiveElement = document.activeElement

    // Create modal structure
    const modalId = `modal-${Date.now()}`
    const modal = this.createModalElement(modalId, {
      title,
      content,
      size,
      closable,
      onConfirm,
      onCancel,
      confirmText,
      cancelText,
      showFooter,
      className,
      data
    })

    // Add to DOM and stack
    const container = document.getElementById('modal-container')
    container.appendChild(modal)
    this.modalStack.push({ id: modalId, element: modal, options })

    // Show modal with animation
    requestAnimationFrame(() => {
      modal.style.display = 'flex'
      modal.classList.add('modal-active')
      this.setupFocusTrap(modal)
    })

    // Return promise for confirmation dialogs
    if (onConfirm) {
      return new Promise((resolve, reject) => {
        modal.addEventListener('modal-confirm', () => resolve(true))
        modal.addEventListener('modal-cancel', () => resolve(false))
      })
    }

    return modalId
  }

  // Create modal HTML element
  createModalElement(id, options) {
    const modal = document.createElement('div')
    modal.id = id
    modal.className = `modal ${options.className}`
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', `${id}-title`)

    const sizeClasses = {
      small: 'modal-small',
      medium: 'modal-medium',
      large: 'modal-large',
      fullscreen: 'modal-fullscreen'
    }

    const contentClass = sizeClasses[options.size] || sizeClasses.medium

    modal.innerHTML = `
      <div class="modal-content glass-panel ${contentClass}">
        <div class="modal-header">
          <h3 id="${id}-title">${options.title}</h3>
          ${options.closable ? '<button class="modal-close" aria-label="Close modal">&times;</button>' : ''}
        </div>
        <div class="modal-body">
          ${typeof options.content === 'string' ? options.content : ''}
        </div>
        ${options.showFooter ? `
          <div class="modal-footer">
            ${options.onCancel !== false ? `<button class="btn btn-secondary modal-cancel">${options.cancelText}</button>` : ''}
            ${options.onConfirm ? `<button class="btn btn-primary modal-confirm">${options.confirmText}</button>` : ''}
          </div>
        ` : ''}
      </div>
    `

    // If content is a DOM element, append it
    if (options.content instanceof HTMLElement) {
      modal.querySelector('.modal-body').innerHTML = ''
      modal.querySelector('.modal-body').appendChild(options.content)
    }

    // Attach event handlers
    this.attachModalEvents(modal, options)

    return modal
  }

  // Attach event handlers to modal
  attachModalEvents(modal, options) {
    const closeBtn = modal.querySelector('.modal-close')
    const confirmBtn = modal.querySelector('.modal-confirm')
    const cancelBtn = modal.querySelector('.modal-cancel')

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close(modal.id))
    }

    if (confirmBtn && options.onConfirm) {
      confirmBtn.addEventListener('click', async () => {
        try {
          const result = await options.onConfirm(options.data)
          if (result !== false) {
            modal.dispatchEvent(new CustomEvent('modal-confirm'))
            this.close(modal.id)
          }
        } catch (error) {
          console.error('Modal confirm error:', error)
          this.showError('An error occurred. Please try again.')
        }
      })
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (options.onCancel) {
          options.onCancel()
        }
        modal.dispatchEvent(new CustomEvent('modal-cancel'))
        this.close(modal.id)
      })
    }
  }

  // Close a modal
  close(modalId) {
    const modalIndex = this.modalStack.findIndex(m => m.id === modalId)
    if (modalIndex === -1) return

    const { element } = this.modalStack[modalIndex]
    
    // Remove from stack
    this.modalStack.splice(modalIndex, 1)

    // Animate out
    element.classList.remove('modal-active')
    element.classList.add('modal-closing')

    setTimeout(() => {
      element.remove()
      
      // Restore focus
      if (this.modalStack.length === 0 && this.previousActiveElement) {
        this.previousActiveElement.focus()
        this.previousActiveElement = null
      } else if (this.modalStack.length > 0) {
        // Focus on the next modal in stack
        const nextModal = this.modalStack[this.modalStack.length - 1].element
        this.setupFocusTrap(nextModal)
      }
    }, 300)
  }

  // Close all modals
  closeAll() {
    [...this.modalStack].reverse().forEach(({ id }) => this.close(id))
  }

  // Setup focus trap for accessibility
  setupFocusTrap(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element
    firstElement.focus()

    // Store trap function
    this.focusTrap = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    modal.addEventListener('keydown', this.focusTrap)
  }

  // Handle keyboard events
  handleKeyDown(e) {
    if (e.key === 'Escape' && this.modalStack.length > 0) {
      const topModal = this.modalStack[this.modalStack.length - 1]
      if (topModal.options.closable !== false) {
        this.close(topModal.id)
      }
    }
  }

  // Handle backdrop clicks
  handleBackdropClick(e) {
    if (e.target.classList.contains('modal') && e.target.classList.contains('modal-active')) {
      const modal = this.modalStack.find(m => m.element === e.target)
      if (modal && modal.options.closable !== false) {
        this.close(modal.id)
      }
    }
  }

  // Utility methods for common modal types

  // Confirmation dialog
  async confirm(message, title = 'Confirm') {
    return this.show({
      title,
      content: `<p>${message}</p>`,
      size: 'small',
      onConfirm: () => true,
      confirmText: 'Yes',
      cancelText: 'No'
    })
  }

  // Alert dialog
  async alert(message, title = 'Alert') {
    return this.show({
      title,
      content: `<p>${message}</p>`,
      size: 'small',
      onConfirm: () => true,
      confirmText: 'OK',
      onCancel: false,
      showFooter: true
    })
  }

  // Error dialog
  async showError(message, title = 'Error') {
    return this.show({
      title,
      content: `<p class="text-error">${message}</p>`,
      size: 'small',
      className: 'modal-error',
      onConfirm: () => true,
      confirmText: 'OK',
      onCancel: false,
      showFooter: true
    })
  }

  // Success dialog
  async showSuccess(message, title = 'Success') {
    return this.show({
      title,
      content: `<p class="text-success">${message}</p>`,
      size: 'small',
      className: 'modal-success',
      onConfirm: () => true,
      confirmText: 'OK',
      onCancel: false,
      showFooter: true
    })
  }

  // Loading modal
  showLoading(message = 'Loading...') {
    const loadingContent = document.createElement('div')
    loadingContent.className = 'modal-loading'
    loadingContent.innerHTML = `
      <div class="loading-spinner"></div>
      <p>${message}</p>
    `

    return this.show({
      content: loadingContent,
      closable: false,
      showFooter: false,
      size: 'small',
      className: 'modal-loading-container'
    })
  }

  // Hide loading modal
  hideLoading(modalId) {
    this.close(modalId)
  }

  // Update modal content
  updateContent(modalId, content) {
    const modal = this.modalStack.find(m => m.id === modalId)
    if (!modal) return

    const bodyElement = modal.element.querySelector('.modal-body')
    if (typeof content === 'string') {
      bodyElement.innerHTML = content
    } else if (content instanceof HTMLElement) {
      bodyElement.innerHTML = ''
      bodyElement.appendChild(content)
    }
  }

  // Get modal data
  getModalData(modalId) {
    const modal = this.modalStack.find(m => m.id === modalId)
    return modal ? modal.options.data : null
  }
  
  // Show notification toast
  showNotification(message, type = 'info', duration = 3000) {
    const notificationId = `notification-${Date.now()}`
    const notificationEl = document.createElement('div')
    notificationEl.id = notificationId
    notificationEl.className = `notification notification-${type}`
    notificationEl.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
      </div>
    `
    
    // Add to body
    document.body.appendChild(notificationEl)
    
    // Trigger animation
    requestAnimationFrame(() => {
      notificationEl.classList.add('notification-show')
    })
    
    // Auto remove after duration
    setTimeout(() => {
      notificationEl.classList.add('notification-hide')
      setTimeout(() => {
        notificationEl.remove()
      }, 300)
    }, duration)
    
    return notificationId
  }
}

// Create and export singleton instance
const modalManager = new ModalManager()

export default modalManager