// js/modules/calendarUI.js
import { calendar } from './calendar.js'
import { escapeHtml, formatCurrency } from './utils.js'
import { debug } from './debug.js'
import { privacy } from './privacy.js'
import { openModal, closeModal, showError } from './ui.js'

export const calendarUI = {
  container: null,
  isInitialized: false,

  init() {
    debug.log('CalendarUI: Initializing')
    this.container = document.getElementById('calendar-container')
    
    if (!this.container) {
      debug.warn('CalendarUI: Calendar container not found')
      return
    }

    this.setupEventListeners()
    this.bindCalendarEvents()
    this.render()
    this.isInitialized = true
    
    debug.log('CalendarUI: Initialized successfully')
  },

  setupEventListeners() {
    // Navigation controls
    this.container.addEventListener('click', (e) => {
      if (e.target.classList.contains('calendar-prev')) {
        calendar.previousMonth()
      } else if (e.target.classList.contains('calendar-next')) {
        calendar.nextMonth()
      } else if (e.target.classList.contains('calendar-today')) {
        calendar.goToToday()
      } else if (e.target.closest('.calendar-day')) {
        const day = e.target.closest('.calendar-day')
        const date = parseInt(day.dataset.date)
        if (date) {
          this.handleDayClick(date)
        }
      } else if (e.target.closest('.calendar-event')) {
        const event = e.target.closest('.calendar-event')
        const eventId = event.dataset.eventId
        this.handleEventClick(eventId)
      }
    })

    // View toggle
    document.getElementById('calendar-view-toggle')?.addEventListener('change', (e) => {
      this.toggleView(e.target.value)
    })
  },

  bindCalendarEvents() {
    calendar.on('monthChanged', () => this.render())
    calendar.on('eventsUpdated', () => this.render())
    calendar.on('refreshRequested', () => {
      // Request fresh data from the parent module
      window.dispatchEvent(new CustomEvent('calendar:needsData'))
    })
  },

  render() {
    if (!this.container) return

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December']
    const currentMonth = monthNames[calendar.currentMonth]
    const currentYear = calendar.currentYear

    this.container.innerHTML = `
      <div class="calendar-wrapper">
        <div class="calendar-header">
          <div class="calendar-navigation">
            <button class="btn btn--sm btn--outline calendar-prev" aria-label="Previous month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <h3 class="calendar-month-year">${currentMonth} ${currentYear}</h3>
            <button class="btn btn--sm btn--outline calendar-next" aria-label="Next month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
          <button class="btn btn--sm btn--secondary calendar-today">Today</button>
        </div>
        
        ${this.renderMonthSummary()}
        
        <div class="calendar-grid">
          ${this.renderWeekDays()}
          ${this.renderCalendarDays()}
        </div>
        
        ${this.renderLegend()}
      </div>
    `
  },

  renderWeekDays() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `
      <div class="calendar-weekdays">
        ${days.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
      </div>
    `
  },

  renderCalendarDays() {
    const days = calendar.getCalendarDays()
    const today = new Date()
    const isCurrentMonth = today.getMonth() === calendar.currentMonth && 
                          today.getFullYear() === calendar.currentYear
    const todayDate = today.getDate()

    return `
      <div class="calendar-days">
        ${days.map(day => {
          if (!day) {
            return '<div class="calendar-day calendar-day--empty"></div>'
          }

          const events = calendar.getEventsForDate(day)
          const isToday = isCurrentMonth && day === todayDate
          const hasEvents = events.length > 0

          return `
            <div class="calendar-day ${isToday ? 'calendar-day--today' : ''} ${hasEvents ? 'calendar-day--has-events' : ''}" 
                 data-date="${day}">
              <div class="calendar-day-number">${day}</div>
              ${this.renderDayEvents(events)}
            </div>
          `
        }).join('')}
      </div>
    `
  },

  renderDayEvents(events) {
    if (events.length === 0) return ''

    const maxDisplay = 3
    const visibleEvents = events.slice(0, maxDisplay)
    const moreCount = events.length - maxDisplay

    return `
      <div class="calendar-day-events">
        ${visibleEvents.map(event => `
          <div class="calendar-event calendar-event--${event.type}" 
               data-event-id="${event.id}"
               style="background-color: ${event.color}20; border-left: 3px solid ${event.color}">
            <span class="calendar-event-title">${escapeHtml(event.title)}</span>
            <span class="calendar-event-amount ${privacy.isEnabled() ? 'privacy-blur' : ''}">
              ${formatCurrency(event.amount)}
            </span>
          </div>
        `).join('')}
        ${moreCount > 0 ? `
          <div class="calendar-event-more">+${moreCount} more</div>
        ` : ''}
      </div>
    `
  },

  renderMonthSummary() {
    const summary = calendar.getMonthSummary()
    const privacyClass = privacy.isEnabled() ? 'privacy-blur' : ''

    return `
      <div class="calendar-summary">
        <div class="calendar-summary-item">
          <span class="calendar-summary-label">Bills</span>
          <span class="calendar-summary-value calendar-summary-value--negative ${privacyClass}">
            ${formatCurrency(summary.totalBills)}
          </span>
          <span class="calendar-summary-count">${summary.billCount} bills</span>
        </div>
        <div class="calendar-summary-item">
          <span class="calendar-summary-label">Income</span>
          <span class="calendar-summary-value calendar-summary-value--positive ${privacyClass}">
            ${formatCurrency(summary.totalPay)}
          </span>
          <span class="calendar-summary-count">${summary.payCount} payments</span>
        </div>
        <div class="calendar-summary-item">
          <span class="calendar-summary-label">Net</span>
          <span class="calendar-summary-value ${summary.netFlow >= 0 ? 'calendar-summary-value--positive' : 'calendar-summary-value--negative'} ${privacyClass}">
            ${formatCurrency(summary.netFlow)}
          </span>
        </div>
      </div>
    `
  },

  renderLegend() {
    return `
      <div class="calendar-legend">
        <div class="calendar-legend-item">
          <span class="calendar-legend-dot" style="background-color: #3B82F6"></span>
          <span>Recurring Bill</span>
        </div>
        <div class="calendar-legend-item">
          <span class="calendar-legend-dot" style="background-color: #10B981"></span>
          <span>Income (Coming Soon)</span>
        </div>
      </div>
    `
  },

  handleDayClick(date) {
    const events = calendar.getEventsForDate(date)
    if (events.length === 0) return

    // Show day detail modal
    this.showDayDetails(date, events)
  },

  handleEventClick(eventId) {
    const event = calendar.events.find(e => e.id === eventId)
    if (!event) return

    // If it's a bill, show bill details or quick pay option
    if (event.type === 'bill' && event.recurring_id) {
      this.showBillQuickActions(event)
    }
  },

  showDayDetails(date, events) {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December']
    const dateStr = `${monthNames[calendar.currentMonth]} ${date}, ${calendar.currentYear}`
    
    const modalContent = `
      <div class="calendar-day-detail">
        <h3>${dateStr}</h3>
        <div class="calendar-day-detail-events">
          ${events.map(event => `
            <div class="calendar-detail-event">
              <div class="calendar-detail-event-header">
                <span class="calendar-detail-event-title" style="color: ${event.color}">
                  ${escapeHtml(event.title)}
                </span>
                <span class="calendar-detail-event-amount ${privacy.isEnabled() ? 'privacy-blur' : ''}">
                  ${formatCurrency(event.amount)}
                </span>
              </div>
              <div class="calendar-detail-event-meta">
                <span>${event.category}</span>
                ${event.type === 'bill' ? `
                  <button class="btn btn--sm btn--primary" onclick="calendarUI.payBill('${event.recurring_id}')">
                    Pay Bill
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="calendar-day-detail-total">
          <span>Total:</span>
          <span class="${privacy.isEnabled() ? 'privacy-blur' : ''}">
            ${formatCurrency(events.reduce((sum, e) => sum + e.amount, 0))}
          </span>
        </div>
      </div>
    `

    // Create a temporary modal for day details
    const modal = document.createElement('div')
    modal.className = 'modal'
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Day Details</h2>
          <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
        </div>
        <div class="modal-body">
          ${modalContent}
        </div>
      </div>
    `
    document.body.appendChild(modal)
    setTimeout(() => modal.classList.add('modal--open'), 10)
  },

  showBillQuickActions(event) {
    // Trigger the pay bill action
    window.dispatchEvent(new CustomEvent('calendar:payBill', { 
      detail: { billId: event.recurring_id }
    }))
  },

  payBill(billId) {
    // Close any open modals first
    document.querySelectorAll('.modal').forEach(m => m.remove())
    
    // Trigger the pay bill action
    window.dispatchEvent(new CustomEvent('calendar:payBill', { 
      detail: { billId: parseInt(billId) }
    }))
  },

  toggleView(view) {
    // Future: Implement week/list views
    debug.log('CalendarUI: View toggle to', view)
  },

  updateData(bills) {
    calendar.setEvents(bills)
  },

  destroy() {
    if (this.container) {
      this.container.innerHTML = ''
    }
    this.isInitialized = false
  }
}

// Make payBill available globally for onclick handlers
window.calendarUI = calendarUI