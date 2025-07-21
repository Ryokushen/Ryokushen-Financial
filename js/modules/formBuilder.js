// Form Builder Module - Reusable form components and utilities

import modalManager from './modal.js'

class FormBuilder {
  constructor() {
    this.forms = new Map()
    this.validators = new Map()
  }

  // Create a form configuration
  createForm(formId, config) {
    const form = {
      id: formId,
      fields: config.fields || [],
      onSubmit: config.onSubmit || null,
      onValidate: config.onValidate || null,
      submitText: config.submitText || 'Save',
      cancelText: config.cancelText || 'Cancel',
      className: config.className || '',
      data: config.data || {}
    }
    
    this.forms.set(formId, form)
    return form
  }

  // Build form HTML
  buildFormHTML(formId) {
    const form = this.forms.get(formId)
    if (!form) return ''

    const formHTML = `
      <form id="${formId}" class="form ${form.className}" novalidate>
        ${form.fields.map(field => this.buildFieldHTML(field)).join('')}
      </form>
    `

    return formHTML
  }

  // Build individual field HTML
  buildFieldHTML(field) {
    const {
      name,
      label,
      type = 'text',
      placeholder = '',
      required = false,
      value = '',
      options = [],
      min = '',
      max = '',
      step = '',
      rows = 3,
      helpText = '',
      className = '',
      width = 'full'
    } = field

    const widthClass = width === 'half' ? 'form-field--half' : 'form-field--full'
    const requiredMark = required ? '<span class="required">*</span>' : ''

    let fieldHTML = `
      <div class="form-field ${widthClass} ${className}" data-field="${name}">
        ${label ? `<label for="${name}" class="form-label">${label}${requiredMark}</label>` : ''}
    `

    switch (type) {
      case 'text':
      case 'email':
      case 'password':
      case 'tel':
      case 'url':
        fieldHTML += `
          <input 
            type="${type}" 
            id="${name}" 
            name="${name}" 
            class="form-input" 
            placeholder="${placeholder}"
            value="${value}"
            ${required ? 'required' : ''}
          />
        `
        break

      case 'number':
        fieldHTML += `
          <input 
            type="number" 
            id="${name}" 
            name="${name}" 
            class="form-input" 
            placeholder="${placeholder}"
            value="${value}"
            ${min ? `min="${min}"` : ''}
            ${max ? `max="${max}"` : ''}
            ${step ? `step="${step}"` : ''}
            ${required ? 'required' : ''}
          />
        `
        break

      case 'amount':
        fieldHTML += `
          <div class="input-group">
            <span class="input-group-prepend">$</span>
            <input 
              type="number" 
              id="${name}" 
              name="${name}" 
              class="form-input" 
              placeholder="${placeholder || '0.00'}"
              value="${value}"
              min="0"
              step="0.01"
              ${required ? 'required' : ''}
            />
          </div>
        `
        break

      case 'date':
        fieldHTML += `
          <input 
            type="date" 
            id="${name}" 
            name="${name}" 
            class="form-input" 
            value="${value}"
            ${required ? 'required' : ''}
          />
        `
        break

      case 'datetime':
        fieldHTML += `
          <input 
            type="datetime-local" 
            id="${name}" 
            name="${name}" 
            class="form-input" 
            value="${value}"
            ${required ? 'required' : ''}
          />
        `
        break

      case 'select':
        fieldHTML += `
          <select 
            id="${name}" 
            name="${name}" 
            class="form-select" 
            ${required ? 'required' : ''}
          >
            <option value="">${placeholder || 'Select an option'}</option>
            ${options.map(opt => `
              <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
        `
        break

      case 'textarea':
        fieldHTML += `
          <textarea 
            id="${name}" 
            name="${name}" 
            class="form-textarea" 
            rows="${rows}"
            placeholder="${placeholder}"
            ${required ? 'required' : ''}
          >${value}</textarea>
        `
        break

      case 'checkbox':
        fieldHTML += `
          <label class="form-checkbox">
            <input 
              type="checkbox" 
              id="${name}" 
              name="${name}" 
              ${value ? 'checked' : ''}
              ${required ? 'required' : ''}
            />
            <span class="checkbox-mark"></span>
            <span class="checkbox-label">${placeholder}</span>
          </label>
        `
        break

      case 'radio':
        fieldHTML += `
          <div class="form-radio-group">
            ${options.map(opt => `
              <label class="form-radio">
                <input 
                  type="radio" 
                  name="${name}" 
                  value="${opt.value}"
                  ${value === opt.value ? 'checked' : ''}
                  ${required ? 'required' : ''}
                />
                <span class="radio-mark"></span>
                <span class="radio-label">${opt.label}</span>
              </label>
            `).join('')}
          </div>
        `
        break

      case 'toggle':
        fieldHTML += `
          <label class="form-toggle">
            <input 
              type="checkbox" 
              id="${name}" 
              name="${name}" 
              ${value ? 'checked' : ''}
            />
            <span class="toggle-slider"></span>
            <span class="toggle-label">${placeholder}</span>
          </label>
        `
        break

      case 'file':
        fieldHTML += `
          <label for="${name}" class="form-file">
            <input 
              type="file" 
              id="${name}" 
              name="${name}" 
              class="form-file-input"
              ${field.accept ? `accept="${field.accept}"` : ''}
              ${field.multiple ? 'multiple' : ''}
              ${required ? 'required' : ''}
            />
            <span class="form-file-label">
              <span class="file-icon">📁</span>
              <span class="file-text">${placeholder || 'Choose file'}</span>
            </span>
          </label>
        `
        break

      case 'custom':
        fieldHTML += field.html || ''
        break
    }

    // Add help text and validation message
    fieldHTML += `
        ${helpText ? `<p class="form-help">${helpText}</p>` : ''}
        <p class="form-error" data-error="${name}"></p>
      </div>
    `

    return fieldHTML
  }

  // Show form in modal
  async showFormModal(formId, modalOptions = {}) {
    const form = this.forms.get(formId)
    if (!form) throw new Error(`Form ${formId} not found`)

    const formHTML = this.buildFormHTML(formId)
    
    const modalContent = document.createElement('div')
    modalContent.innerHTML = formHTML

    const modalId = await modalManager.show({
      title: modalOptions.title || 'Form',
      content: modalContent,
      size: modalOptions.size || 'medium',
      confirmText: form.submitText,
      cancelText: form.cancelText,
      onConfirm: async (data) => {
        // Validate form
        const formElement = document.getElementById(formId)
        const isValid = await this.validateForm(formId)
        
        if (!isValid) {
          return false // Prevent modal from closing
        }

        // Get form data
        const formData = this.getFormData(formId)
        
        // Call submit handler
        if (form.onSubmit) {
          try {
            await form.onSubmit(formData)
            return true // Close modal
          } catch (error) {
            console.error('Form submission error:', error)
            this.showFormError(formId, 'Failed to save. Please try again.')
            return false // Keep modal open
          }
        }
        
        return true
      },
      ...modalOptions
    })

    // Setup form event handlers
    this.setupFormHandlers(formId)

    return modalId
  }

  // Setup form event handlers
  setupFormHandlers(formId) {
    const form = document.getElementById(formId)
    if (!form) return

    // Real-time validation
    form.addEventListener('input', (e) => {
      if (e.target.matches('input, select, textarea')) {
        this.clearFieldError(e.target.name)
      }
    })

    // Handle form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault()
    })

    // Setup special field handlers
    this.setupSpecialFields(form)
  }

  // Setup special field handlers (file inputs, etc.)
  setupSpecialFields(form) {
    // File input handlers
    form.querySelectorAll('.form-file-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const label = e.target.nextElementSibling
        const fileText = label.querySelector('.file-text')
        
        if (e.target.files.length > 0) {
          const fileNames = Array.from(e.target.files).map(f => f.name).join(', ')
          fileText.textContent = fileNames
        } else {
          fileText.textContent = 'Choose file'
        }
      })
    })

    // Amount input formatting
    form.querySelectorAll('input[type="number"][step="0.01"]').forEach(input => {
      input.addEventListener('blur', (e) => {
        if (e.target.value) {
          e.target.value = parseFloat(e.target.value).toFixed(2)
        }
      })
    })
  }

  // Validate entire form
  async validateForm(formId) {
    const form = this.forms.get(formId)
    const formElement = document.getElementById(formId)
    if (!form || !formElement) return false

    let isValid = true
    const formData = this.getFormData(formId)

    // Custom validation
    if (form.onValidate) {
      const customErrors = await form.onValidate(formData)
      if (customErrors && typeof customErrors === 'object') {
        Object.entries(customErrors).forEach(([field, error]) => {
          this.showFieldError(field, error)
          isValid = false
        })
      }
    }

    // Field validation
    for (const field of form.fields) {
      const fieldElement = formElement.querySelector(`[name="${field.name}"]`)
      if (!fieldElement) continue

      const value = this.getFieldValue(fieldElement)
      const validation = this.validateField(field, value, formData)
      
      if (!validation.valid) {
        this.showFieldError(field.name, validation.error)
        isValid = false
      }
    }

    return isValid
  }

  // Validate individual field
  validateField(field, value, formData) {
    // Required validation
    if (field.required && !value) {
      return { valid: false, error: `${field.label || field.name} is required` }
    }

    // Type-specific validation
    switch (field.type) {
      case 'email':
        if (value && !this.isValidEmail(value)) {
          return { valid: false, error: 'Please enter a valid email address' }
        }
        break

      case 'tel':
        if (value && !this.isValidPhone(value)) {
          return { valid: false, error: 'Please enter a valid phone number' }
        }
        break

      case 'url':
        if (value && !this.isValidURL(value)) {
          return { valid: false, error: 'Please enter a valid URL' }
        }
        break

      case 'number':
      case 'amount':
        if (value) {
          const num = parseFloat(value)
          if (isNaN(num)) {
            return { valid: false, error: 'Please enter a valid number' }
          }
          if (field.min !== undefined && num < field.min) {
            return { valid: false, error: `Value must be at least ${field.min}` }
          }
          if (field.max !== undefined && num > field.max) {
            return { valid: false, error: `Value must be at most ${field.max}` }
          }
        }
        break
    }

    // Custom field validation
    if (field.validate) {
      const customValidation = field.validate(value, formData)
      if (customValidation !== true) {
        return { valid: false, error: customValidation }
      }
    }

    return { valid: true }
  }

  // Get form data
  getFormData(formId) {
    const formElement = document.getElementById(formId)
    if (!formElement) return {}

    const formData = {}
    const elements = formElement.querySelectorAll('input, select, textarea')

    elements.forEach(element => {
      const name = element.name
      if (!name) return

      formData[name] = this.getFieldValue(element)
    })

    return formData
  }

  // Get field value
  getFieldValue(element) {
    switch (element.type) {
      case 'checkbox':
        return element.checked
      case 'radio':
        return element.checked ? element.value : null
      case 'number':
        return element.value ? parseFloat(element.value) : null
      case 'file':
        return element.files
      default:
        return element.value
    }
  }

  // Show field error
  showFieldError(fieldName, error) {
    const errorElement = document.querySelector(`[data-error="${fieldName}"]`)
    if (errorElement) {
      errorElement.textContent = error
      errorElement.style.display = 'block'
    }

    const fieldElement = document.querySelector(`[name="${fieldName}"]`)
    if (fieldElement) {
      fieldElement.classList.add('error')
    }
  }

  // Clear field error
  clearFieldError(fieldName) {
    const errorElement = document.querySelector(`[data-error="${fieldName}"]`)
    if (errorElement) {
      errorElement.textContent = ''
      errorElement.style.display = 'none'
    }

    const fieldElement = document.querySelector(`[name="${fieldName}"]`)
    if (fieldElement) {
      fieldElement.classList.remove('error')
    }
  }

  // Show form-level error
  showFormError(formId, error) {
    const formElement = document.getElementById(formId)
    if (!formElement) return

    let errorDiv = formElement.querySelector('.form-error-general')
    if (!errorDiv) {
      errorDiv = document.createElement('div')
      errorDiv.className = 'form-error-general'
      formElement.prepend(errorDiv)
    }

    errorDiv.textContent = error
    errorDiv.style.display = 'block'
  }

  // Validation helpers
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  isValidPhone(phone) {
    return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10
  }

  isValidURL(url) {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  // Populate form with data
  populateForm(formId, data) {
    const formElement = document.getElementById(formId)
    if (!formElement || !data) return

    Object.entries(data).forEach(([name, value]) => {
      const element = formElement.querySelector(`[name="${name}"]`)
      if (!element) return

      switch (element.type) {
        case 'checkbox':
          element.checked = !!value
          break
        case 'radio':
          const radio = formElement.querySelector(`[name="${name}"][value="${value}"]`)
          if (radio) radio.checked = true
          break
        case 'file':
          // Cannot programmatically set file input
          break
        default:
          element.value = value || ''
      }
    })
  }

  // Clear form
  clearForm(formId) {
    const formElement = document.getElementById(formId)
    if (formElement) {
      formElement.reset()
      // Clear all errors
      formElement.querySelectorAll('.form-error').forEach(error => {
        error.textContent = ''
        error.style.display = 'none'
      })
      formElement.querySelectorAll('.error').forEach(field => {
        field.classList.remove('error')
      })
    }
  }
}

// Create and export singleton instance
const formBuilder = new FormBuilder()

export default formBuilder