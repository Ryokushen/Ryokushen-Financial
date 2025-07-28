// js/modules/calendar.js
import { debug } from './debug.js';
import { formatDate, formatCurrency } from './utils.js';
import { getNextDueDate } from './utils.js';
import { paySchedule } from './paySchedule.js';
import { eventManager } from './eventManager.js';

export class Calendar {
  constructor() {
    this.currentDate = new Date();
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
    this.selectedDate = null;
    this.events = [];
    this.listeners = new Map();
  }

  init() {
    debug.log('Calendar: Initializing');
    this.setupEventListeners();
    return this;
  }

  setupEventListeners() {
    // Listen for data updates
    eventManager.addEventListener(window, 'recurring:updated', () => this.refreshEvents());
    eventManager.addEventListener(window, 'recurring:deleted', () => this.refreshEvents());
    eventManager.addEventListener(window, 'transaction:added', () => this.refreshEvents());
  }

  setMonth(month, year) {
    this.currentMonth = month;
    this.currentYear = year;
    this.notifyListeners('monthChanged', { month, year });
  }

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.notifyListeners('monthChanged', { month: this.currentMonth, year: this.currentYear });
  }

  previousMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.notifyListeners('monthChanged', { month: this.currentMonth, year: this.currentYear });
  }

  goToToday() {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.selectedDate = today;
    this.notifyListeners('monthChanged', { month: this.currentMonth, year: this.currentYear });
  }

  getDaysInMonth(month = this.currentMonth, year = this.currentYear) {
    return new Date(year, month + 1, 0).getDate();
  }

  getFirstDayOfMonth(month = this.currentMonth, year = this.currentYear) {
    return new Date(year, month, 1).getDay();
  }

  getCalendarDays() {
    const daysInMonth = this.getDaysInMonth();
    const firstDay = this.getFirstDayOfMonth();
    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    // Add empty cells to complete the grid (6 rows x 7 days = 42 cells)
    const totalCells = 42;
    while (days.length < totalCells) {
      days.push(null);
    }

    return days;
  }

  generateRecurringBillEvents(bills) {
    const events = [];
    const startOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    const endOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);

    debug.log('Calendar: Generating events for', bills.length, 'bills');
    debug.log('Calendar: Month range', startOfMonth, 'to', endOfMonth);

    bills.forEach(bill => {
      if (!bill.active && bill.active !== undefined) {return}

      // Get the next due date
      let dueDate = new Date(bill.next_due || bill.nextDue);
      debug.log('Calendar: Processing bill', bill.name, 'due date:', dueDate);

      // If the due date is before the current month, calculate the next occurrence
      while (dueDate < startOfMonth) {
        dueDate = getNextDueDate(dueDate, bill.frequency);
      }

      // Add all occurrences within the current month
      while (dueDate <= endOfMonth) {
        if (dueDate >= startOfMonth) {
          events.push({
            id: `bill_${bill.id}_${dueDate.getTime()}`,
            type: 'bill',
            date: new Date(dueDate),
            title: bill.name,
            amount: bill.amount,
            category: bill.category,
            recurring_id: bill.id,
            paymentMethod: bill.payment_method || 'cash',
            color: this.getCategoryColor(bill.category),
          });
        }

        // Get next occurrence based on frequency
        dueDate = getNextDueDate(dueDate, bill.frequency);
      }
    });

    return events;
  }

  getCategoryColor(category) {
    const colors = {
      Housing: '#8B5CF6',
      Transportation: '#3B82F6',
      Food: '#10B981',
      Healthcare: '#EC4899',
      Entertainment: '#F59E0B',
      Shopping: '#EF4444',
      Utilities: '#6366F1',
      Insurance: '#14B8A6',
      Debt: '#DC2626',
      Savings: '#059669',
      Education: '#7C3AED',
      'Personal Care': '#F97316',
      Gifts: '#DB2777',
      Taxes: '#6B7280',
      Fees: '#78716C',
      Travel: '#0EA5E9',
      Other: '#71717A',
    };
    return colors[category] || '#71717A';
  }

  async setEvents(bills = []) {
    debug.log('Calendar: setEvents called with', bills.length, 'bills');

    // Generate bill events
    const billEvents = this.generateRecurringBillEvents(bills);

    // Generate pay events
    const payEvents = await this.generatePayEvents();

    // Combine all events
    this.events = [...billEvents, ...payEvents];

    debug.log(
      'Calendar: Generated',
      this.events.length,
      'events (',
      billEvents.length,
      'bills,',
      payEvents.length,
      'pay days)'
    );
    this.notifyListeners('eventsUpdated', this.events);
  }

  async generatePayEvents() {
    const events = [];

    try {
      // Ensure pay schedules are loaded
      if (!paySchedule.loaded) {
        await paySchedule.init();
      }

      // Get pay events for current month
      const payDates = paySchedule.getAllPayEventsForMonth(this.currentMonth, this.currentYear);

      payDates.forEach((payEvent, index) => {
        events.push({
          id: `pay_${payEvent.schedule.id}_${payEvent.date.getTime()}`,
          type: 'pay',
          date: payEvent.date,
          title: payEvent.schedule.name || 'Payday',
          amount: payEvent.amount,
          category: 'Income',
          schedule_id: payEvent.schedule.id,
          color: '#10B981', // Green for income
        });
      });
    } catch (error) {
      debug.error('Calendar: Error generating pay events', error);
    }

    return events;
  }

  getEventsForDate(date) {
    return this.events.filter(event => {
      return (
        event.date.getDate() === date &&
        event.date.getMonth() === this.currentMonth &&
        event.date.getFullYear() === this.currentYear
      );
    });
  }

  getMonthSummary() {
    const monthEvents = this.events.filter(event => {
      return (
        event.date.getMonth() === this.currentMonth && event.date.getFullYear() === this.currentYear;
      );
    });

    const totalBills = monthEvents
      .filter(e => e.type === 'bill')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalPay = monthEvents
      .filter(e => e.type === 'pay')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      totalBills,
      totalPay,
      netFlow: totalPay - totalBills,
      billCount: monthEvents.filter(e => e.type === 'bill').length,
      payCount: monthEvents.filter(e => e.type === 'pay').length,
    };
  }

  refreshEvents() {
    // This will be called by the UI to refresh with new data
    this.notifyListeners('refreshRequested');
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  destroy() {
    this.listeners.clear();
    window.removeEventListener('recurring:updated', () => this.refreshEvents());
    window.removeEventListener('recurring:deleted', () => this.refreshEvents());
    window.removeEventListener('transaction:added', () => this.refreshEvents());
  }
}

export const calendar = new Calendar();
