// js/modules/calendarUI.js
import { calendar } from './calendar.js';
import { escapeHtml, formatCurrency } from './utils.js';
import { debug } from './debug.js';
import { isPrivacyMode } from './privacy.js';
import { openModal, closeModal, showError, announceToScreenReader } from './ui.js';
import { paySchedule } from './paySchedule.js';
import { eventManager } from './eventManager.js';

export const calendarUI = {
  container: null,
  isInitialized: false,
  currentBillsData: null,

  init() {
    debug.log('CalendarUI: Initializing');
    this.container = document.getElementById('calendar-container');

    if (!this.container) {
      debug.warn('CalendarUI: Calendar container not found');
      return;
    }

    this.setupEventListeners();
    this.bindCalendarEvents();
    this.render();
    this.isInitialized = true;

    debug.log('CalendarUI: Initialized successfully');
  },

  setupEventListeners() {
    // Prevent multiple rapid clicks
    let isNavigating = false;

    // Navigation controls
    eventManager.addEventListener(this.container, 'click', e => {
      // Handle navigation buttons
      if (e.target.classList.contains('calendar-prev') || e.target.closest('.calendar-prev')) {
        e.preventDefault();
        e.stopPropagation();
        if (!isNavigating) {
          isNavigating = true;
          calendar.previousMonth();
          setTimeout(() => {
            isNavigating = false;
          }, 300);
        }
      } else if (
        e.target.classList.contains('calendar-next') ||
        e.target.closest('.calendar-next')
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (!isNavigating) {
          isNavigating = true;
          calendar.nextMonth();
          setTimeout(() => {
            isNavigating = false;
          }, 300);
        }
      } else if (e.target.classList.contains('calendar-today')) {
        e.preventDefault();
        e.stopPropagation();
        if (!isNavigating) {
          isNavigating = true;
          calendar.goToToday();
          setTimeout(() => {
            isNavigating = false;
          }, 300);
        }
      } else if (e.target.closest('#configure-pay-schedule')) {
        e.preventDefault();
        e.stopPropagation();
        this.openPayScheduleModal();
      } else if (e.target.closest('.calendar-event')) {
        // Handle event click before day click
        e.stopPropagation();
        const event = e.target.closest('.calendar-event');
        const eventId = event.dataset.eventId;
        this.handleEventClick(eventId);
      } else if (e.target.closest('.calendar-day')) {
        const day = e.target.closest('.calendar-day');
        const date = parseInt(day.dataset.date);
        if (date) {
          this.handleDayClick(date);
        }
      }
    });

    // View toggle
    const calendarViewToggle = document.getElementById('calendar-view-toggle');
    if (calendarViewToggle) {
      eventManager.addEventListener(calendarViewToggle, 'change', e => {
        this.toggleView(e.target.value);
      });
    }
  },

  bindCalendarEvents() {
    calendar.on('monthChanged', () => {
      this.render();
      // Regenerate events for the new month
      if (this.currentBillsData) {
        calendar.setEvents(this.currentBillsData);
      }
    });
    calendar.on('eventsUpdated', () => this.render());
    calendar.on('refreshRequested', () => {
      // Request fresh data from the parent module
      window.dispatchEvent(new CustomEvent('calendar:needsData'));
    });
  },

  render() {
    if (!this.container) {
      return;
    }

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const currentMonth = monthNames[calendar.currentMonth];
    const currentYear = calendar.currentYear;

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
          <div class="calendar-actions">
            <button class="btn btn--sm btn--secondary calendar-today">Today</button>
            <button class="btn btn--sm btn--primary" id="configure-pay-schedule">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
              Pay Schedule
            </button>
          </div>
        </div>
        
        ${this.renderMonthSummary()}
        
        <div class="calendar-grid">
          ${this.renderWeekDays()}
          ${this.renderCalendarDays()}
        </div>
        
        ${this.renderLegend()}
      </div>
    `;
  },

  renderWeekDays() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `
      <div class="calendar-weekdays">
        ${days.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
      </div>
    `;
  },

  renderCalendarDays() {
    const days = calendar.getCalendarDays();
    const today = new Date();
    const isCurrentMonth =
      today.getMonth() === calendar.currentMonth && today.getFullYear() === calendar.currentYear;
    const todayDate = today.getDate();

    return `
      <div class="calendar-days">
        ${days
          .map(day => {
            if (!day) {
              return '<div class="calendar-day calendar-day--empty"></div>';
            }

            const events = calendar.getEventsForDate(day);
            const isToday = isCurrentMonth && day === todayDate;
            const hasEvents = events.length > 0;

            return `
            <div class="calendar-day ${isToday ? 'calendar-day--today' : ''} ${hasEvents ? 'calendar-day--has-events' : ''}" 
                 data-date="${day}">
              <div class="calendar-day-number">${day}</div>
              ${this.renderDayEvents(events)}
            </div>
          `;
          })
          .join('')}
      </div>
    `;
  },

  renderDayEvents(events) {
    if (events.length === 0) {
      return '';
    }

    const maxDisplay = 3;
    const visibleEvents = events.slice(0, maxDisplay);
    const moreCount = events.length - maxDisplay;

    return `
      <div class="calendar-day-events">
        ${visibleEvents
          .map(event => {
            const isPayEvent = event.type === 'pay';
            const bgColor = isPayEvent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 107, 107, 0.15)';
            const borderColor = isPayEvent ? '#10B981' : '#FF6B6B';
            const amountPrefix = isPayEvent ? '+' : '-';

            return `
            <div class="calendar-event calendar-event--${event.type}" 
                 data-event-id="${event.id}"
                 style="background-color: ${bgColor}; border-left: 3px solid ${borderColor}">
              <span class="calendar-event-title">${escapeHtml(event.title)}</span>
              <span class="calendar-event-amount ${isPrivacyMode() ? 'privacy-blur' : ''}">
                ${amountPrefix}${formatCurrency(Math.abs(event.amount))}
              </span>
            </div>
          `;
          })
          .join('')}
        ${
          moreCount > 0
            ? `
          <div class="calendar-event-more">+${moreCount} more</div>
        `
            : ''
        }
      </div>
    `;
  },

  renderMonthSummary() {
    const summary = calendar.getMonthSummary();
    const privacyClass = isPrivacyMode() ? 'privacy-blur' : '';

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
    `;
  },

  renderLegend() {
    return `
      <div class="calendar-legend">
        <div class="calendar-legend-item">
          <span class="calendar-legend-dot" style="background-color: #FF6B6B"></span>
          <span>Recurring Bill</span>
        </div>
        <div class="calendar-legend-item">
          <span class="calendar-legend-dot" style="background-color: #51CF66"></span>
          <span>Income (Coming Soon)</span>
        </div>
      </div>
    `;
  },

  handleDayClick(date) {
    const events = calendar.getEventsForDate(date);
    if (events.length === 0) {
      return;
    }

    // Show day detail modal
    this.showDayDetails(date, events);
  },

  handleEventClick(eventId) {
    const event = calendar.events.find(e => e.id === eventId);
    if (!event) {
      return;
    }

    // If it's a bill, show bill details or quick pay option
    if (event.type === 'bill' && event.recurring_id) {
      this.showBillQuickActions(event);
    }
  },

  showDayDetails(date, events) {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const dateStr = `${monthNames[calendar.currentMonth]} ${date}, ${calendar.currentYear}`;

    const modalContent = `
      <div class="calendar-day-detail">
        <h3>${dateStr}</h3>
        <div class="calendar-day-detail-events">
          ${events
            .map(
              event => `
            <div class="calendar-detail-event">
              <div class="calendar-detail-event-header">
                <span class="calendar-detail-event-title" style="color: ${event.color}">
                  ${escapeHtml(event.title)}
                </span>
                <span class="calendar-detail-event-amount ${isPrivacyMode() ? 'privacy-blur' : ''}">
                  ${formatCurrency(event.amount)}
                </span>
              </div>
              <div class="calendar-detail-event-meta">
                <span>${event.category}</span>
                ${
                  event.type === 'bill'
                    ? `
                  <button class="btn btn--sm btn--primary" onclick="calendarUI.payBill('${event.recurring_id}')">
                    Pay Bill
                  </button>
                `
                    : ''
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        <div class="calendar-day-detail-total">
          <span>Total:</span>
          <span class="${isPrivacyMode() ? 'privacy-blur' : ''}">
            ${formatCurrency(events.reduce((sum, e) => sum + e.amount, 0))}
          </span>
        </div>
      </div>
    `;

    // Create a temporary modal for day details
    const modal = document.createElement('div');
    modal.className = 'modal';
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
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('modal--open'), 10);
  },

  showBillQuickActions(event) {
    // Trigger the pay bill action
    window.dispatchEvent(
      new CustomEvent('calendar:payBill', {
        detail: { billId: event.recurring_id },
      })
    );
  },

  payBill(billId) {
    // Close any open modals first
    document.querySelectorAll('.modal').forEach(m => m.remove());

    // Trigger the pay bill action
    window.dispatchEvent(
      new CustomEvent('calendar:payBill', {
        detail: { billId: parseInt(billId) },
      })
    );
  },

  toggleView(view) {
    // Future: Implement week/list views
    debug.log('CalendarUI: View toggle to', view);
  },

  updateData(bills) {
    this.currentBillsData = bills;
    calendar.setEvents(bills);
  },

  async openPayScheduleModal() {
    debug.log('CalendarUI: Opening pay schedule modal');

    const modal = document.getElementById('pay-schedule-modal');
    if (!modal) {
      debug.error('CalendarUI: Pay schedule modal not found');
      return;
    }

    // Load existing schedules
    await this.loadExistingSchedules();

    // Setup form event listeners
    this.setupPayScheduleForm();

    // Show modal
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('modal--open'), 10);

    // Focus on first input
    document.getElementById('pay-schedule-name')?.focus();
  },

  async loadExistingSchedules() {
    try {
      const schedules = await paySchedule.getActiveSchedules();
      const container = document.getElementById('existing-schedules');
      const listContainer = document.getElementById('pay-schedules-list');

      if (!container || !listContainer) {
        return;
      }

      if (schedules.length > 0) {
        container.style.display = 'block';
        listContainer.innerHTML = schedules
          .map(
            schedule => `
          <div class="pay-schedule-item">
            <div class="pay-schedule-info">
              <strong>${escapeHtml(schedule.name)}</strong>
              <span>${this.getFrequencyText(schedule.frequency)} - ${formatCurrency(schedule.amount)}</span>
            </div>
            <div class="pay-schedule-actions">
              <button class="btn btn--sm btn--outline" onclick="calendarUI.editPaySchedule('${schedule.id}')">Edit</button>
              <button class="btn btn--sm btn--danger" onclick="calendarUI.deletePaySchedule('${schedule.id}')">Delete</button>
            </div>
          </div>
        `
          )
          .join('');
      } else {
        container.style.display = 'none';
      }
    } catch (error) {
      debug.error('CalendarUI: Error loading schedules', error);
    }
  },

  getFrequencyText(frequency) {
    const texts = {
      weekly: 'Weekly',
      'bi-weekly': 'Bi-weekly',
      'semi-monthly': 'Semi-monthly',
      monthly: 'Monthly',
    };
    return texts[frequency] || frequency;
  },

  setupPayScheduleForm() {
    const form = document.getElementById('pay-schedule-form');
    const frequencySelect = document.getElementById('pay-frequency');
    const weeklyOptions = document.getElementById('weekly-options');
    const semiMonthlyOptions = document.getElementById('semi-monthly-options');
    const cancelBtn = document.getElementById('cancel-pay-schedule');
    const modal = document.getElementById('pay-schedule-modal');

    // Note: EventManager automatically prevents duplicates, so we don't need to track listeners manually

    // Close button handler
    const closeBtn = modal.querySelector('.modal-close');
    const closeHandler = () => this.closePayScheduleModal();
    if (closeBtn) {
      eventManager.addEventListener(closeBtn, 'click', closeHandler);
    }

    // Cancel button handler
    const cancelHandler = () => this.closePayScheduleModal();
    if (cancelBtn) {
      eventManager.addEventListener(cancelBtn, 'click', cancelHandler);
    }

    // Frequency change handler
    const frequencyHandler = e => {
      const frequency = e.target.value;

      // Hide all options first
      weeklyOptions.style.display = 'none';
      semiMonthlyOptions.style.display = 'none';

      // Show relevant options
      if (frequency === 'weekly') {
        weeklyOptions.style.display = 'block';
      } else if (frequency === 'semi-monthly') {
        semiMonthlyOptions.style.display = 'block';
      }
    };
    if (frequencySelect) {
      eventManager.addEventListener(frequencySelect, 'change', frequencyHandler);
    }

    // Form submit handler
    const submitHandler = async e => {
      e.preventDefault();
      await this.savePaySchedule();
    };
    if (form) {
      eventManager.addEventListener(form, 'submit', submitHandler);
    }
  },

  async savePaySchedule() {
    const form = document.getElementById('pay-schedule-form');
    const submitButton = form.querySelector('button[type="submit"]');

    // Prevent duplicate submissions
    if (submitButton.disabled) {
      return;
    }

    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    try {
      const formData = new FormData(form);

      const scheduleData = {
        name: formData.get('name'),
        frequency: formData.get('frequency'),
        start_date: formData.get('start_date'),
        amount: parseFloat(formData.get('amount')),
        is_active: true,
      };

      // Add frequency-specific fields
      if (scheduleData.frequency === 'weekly') {
        scheduleData.day_of_week = parseInt(formData.get('day_of_week'));
      } else if (scheduleData.frequency === 'semi-monthly') {
        scheduleData.day_of_month_1 = parseInt(formData.get('day_of_month_1'));
        scheduleData.day_of_month_2 = parseInt(formData.get('day_of_month_2'));
      }

      await paySchedule.createSchedule(scheduleData);

      // Refresh the schedules list
      await paySchedule.loadSchedules();

      // Refresh calendar to show new pay events
      await calendar.setEvents(this.currentBillsData);

      // Close modal
      this.closePayScheduleModal();

      // Show success message
      announceToScreenReader('Pay schedule created successfully');
    } catch (error) {
      debug.error('CalendarUI: Error saving pay schedule', error);
      showError('Failed to save pay schedule');

      // Re-enable submit button on error
      submitButton.disabled = false;
      submitButton.textContent = 'Save Schedule';
    }
  },

  closePayScheduleModal() {
    const modal = document.getElementById('pay-schedule-modal');
    if (modal) {
      modal.classList.remove('modal--open');
      setTimeout(() => {
        modal.style.display = 'none';
        // Reset form
        const form = document.getElementById('pay-schedule-form');
        if (form) {
          form.reset();
          // Reset submit button
          const submitButton = form.querySelector('button[type="submit"]');
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Schedule';
          }
        }
        // Reset frequency options
        document.getElementById('weekly-options').style.display = 'none';
        document.getElementById('semi-monthly-options').style.display = 'none';
      }, 300);
    }
  },

  async editPaySchedule(id) {
    // TODO: Implement edit functionality
    debug.log('CalendarUI: Edit pay schedule', id);
  },

  async deletePaySchedule(id) {
    if (confirm('Are you sure you want to delete this pay schedule?')) {
      try {
        await paySchedule.deleteSchedule(id);
        await this.loadExistingSchedules();
        await calendar.setEvents(this.currentBillsData);
        announceToScreenReader('Pay schedule deleted successfully');
      } catch (error) {
        debug.error('CalendarUI: Error deleting pay schedule', error);
        showError('Failed to delete pay schedule');
      }
    }
  },

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.isInitialized = false;
  },
};

// Make payBill available globally for onclick handlers
window.calendarUI = calendarUI;
