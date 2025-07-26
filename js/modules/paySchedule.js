// js/modules/paySchedule.js
import database from '../database.js'
import { debug } from './debug.js'
import { formatDate } from './utils.js'
import { eventManager } from './eventManager.js'

class PaySchedule {
  constructor() {
    this.schedules = []
    this.loaded = false
  }

  async init() {
    debug.log('PaySchedule: Initializing')
    await this.loadSchedules()
    this.setupEventListeners()
    return this
  }

  setupEventListeners() {
    // Listen for wage config updates from time budget
    eventManager.addEventListener(window, 'wage-config-updated', (event) => {
      debug.log('PaySchedule: Wage config updated', event.detail)
      // Could auto-update pay amounts if desired
    })
  }

  async loadSchedules() {
    try {
      this.schedules = await database.getPaySchedules()
      this.loaded = true
      debug.log('PaySchedule: Loaded schedules', this.schedules)
    } catch (error) {
      debug.error('PaySchedule: Error loading schedules', error)
      this.schedules = []
    }
  }

  async createSchedule(scheduleData) {
    try {
      const newSchedule = await database.createPaySchedule(scheduleData)
      this.schedules.push(newSchedule)
      
      window.dispatchEvent(new CustomEvent('paySchedule:created', { 
        detail: { schedule: newSchedule } 
      }))
      
      return newSchedule
    } catch (error) {
      debug.error('PaySchedule: Error creating schedule', error)
      throw error
    }
  }

  async updateSchedule(id, scheduleData) {
    try {
      const updated = await database.updatePaySchedule(id, scheduleData)
      const index = this.schedules.findIndex(s => s.id === id)
      if (index !== -1) {
        this.schedules[index] = updated
      }
      
      window.dispatchEvent(new CustomEvent('paySchedule:updated', { 
        detail: { schedule: updated } 
      }))
      
      return updated
    } catch (error) {
      debug.error('PaySchedule: Error updating schedule', error)
      throw error
    }
  }

  async deleteSchedule(id) {
    try {
      await database.deletePaySchedule(id)
      this.schedules = this.schedules.filter(s => s.id !== id)
      
      window.dispatchEvent(new CustomEvent('paySchedule:deleted', { 
        detail: { scheduleId: id } 
      }))
      
      return true
    } catch (error) {
      debug.error('PaySchedule: Error deleting schedule', error)
      throw error
    }
  }

  /**
   * Calculate next pay date based on frequency and last pay date
   */
  calculateNextPayDate(schedule, fromDate = new Date()) {
    const startDate = new Date(schedule.start_date)
    
    switch (schedule.frequency) {
      case 'weekly':
        return this.getNextWeeklyDate(startDate, schedule.day_of_week || startDate.getDay(), fromDate)
      
      case 'bi-weekly':
        return this.getNextBiWeeklyDate(startDate, fromDate)
      
      case 'semi-monthly':
        return this.getNextSemiMonthlyDate(schedule.day_of_month_1, schedule.day_of_month_2, fromDate)
      
      case 'monthly':
        return this.getNextMonthlyDate(startDate.getDate(), fromDate)
      
      default:
        return null
    }
  }

  getNextWeeklyDate(startDate, dayOfWeek, fromDate) {
    const next = new Date(fromDate)
    const daysUntilNext = (dayOfWeek - next.getDay() + 7) % 7
    
    if (daysUntilNext === 0 && next <= fromDate) {
      next.setDate(next.getDate() + 7)
    } else {
      next.setDate(next.getDate() + daysUntilNext)
    }
    
    return next
  }

  getNextBiWeeklyDate(startDate, fromDate) {
    const daysDiff = Math.floor((fromDate - startDate) / (1000 * 60 * 60 * 24))
    const weeksPassed = Math.floor(daysDiff / 14)
    const nextDate = new Date(startDate)
    nextDate.setDate(nextDate.getDate() + (weeksPassed + 1) * 14)
    
    if (nextDate <= fromDate) {
      nextDate.setDate(nextDate.getDate() + 14)
    }
    
    return nextDate
  }

  getNextSemiMonthlyDate(day1, day2, fromDate) {
    const year = fromDate.getFullYear()
    const month = fromDate.getMonth()
    const currentDay = fromDate.getDate()
    
    // Sort days to ensure proper order
    const days = [day1, day2].sort((a, b) => a - b)
    
    // Check if we can use a day in the current month
    for (const day of days) {
      if (day > currentDay) {
        return new Date(year, month, Math.min(day, this.getDaysInMonth(year, month)))
      }
    }
    
    // Otherwise, use the first day of next month
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    return new Date(nextYear, nextMonth, Math.min(days[0], this.getDaysInMonth(nextYear, nextMonth)))
  }

  getNextMonthlyDate(dayOfMonth, fromDate) {
    const year = fromDate.getFullYear()
    const month = fromDate.getMonth()
    const currentDay = fromDate.getDate()
    
    if (dayOfMonth > currentDay) {
      // Use this month
      return new Date(year, month, Math.min(dayOfMonth, this.getDaysInMonth(year, month)))
    } else {
      // Use next month
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      return new Date(nextYear, nextMonth, Math.min(dayOfMonth, this.getDaysInMonth(nextYear, nextMonth)))
    }
  }

  getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate()
  }

  /**
   * Get all pay dates for a given month
   */
  getPayDatesForMonth(schedule, month, year) {
    const payDates = []
    const startOfMonth = new Date(year, month, 1)
    const endOfMonth = new Date(year, month + 1, 0)
    
    let currentDate = new Date(startOfMonth)
    
    while (currentDate <= endOfMonth) {
      const nextPayDate = this.calculateNextPayDate(schedule, currentDate)
      
      if (!nextPayDate || nextPayDate > endOfMonth) {
        break
      }
      
      if (nextPayDate >= startOfMonth && nextPayDate <= endOfMonth) {
        payDates.push({
          date: new Date(nextPayDate),
          amount: schedule.amount,
          schedule: schedule
        })
      }
      
      currentDate = new Date(nextPayDate)
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return payDates
  }

  /**
   * Get all pay events for all active schedules for a month
   */
  getAllPayEventsForMonth(month, year) {
    const allEvents = []
    
    for (const schedule of this.schedules.filter(s => s.is_active)) {
      const events = this.getPayDatesForMonth(schedule, month, year)
      allEvents.push(...events)
    }
    
    return allEvents.sort((a, b) => a.date - b.date)
  }

  getActiveSchedules() {
    return this.schedules.filter(s => s.is_active)
  }

  getScheduleById(id) {
    return this.schedules.find(s => s.id === id)
  }
}

export const paySchedule = new PaySchedule()