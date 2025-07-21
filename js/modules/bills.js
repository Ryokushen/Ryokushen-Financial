// Bills Module - Modern Design

import { formatCurrency, maskCurrency } from './ui.js'

// Mock data for development
const mockBills = [
  {
    id: '1',
    name: 'Gym',
    amount: 35.00,
    frequency: 'Monthly',
    status: 'Inactive',
    nextDue: '2025-07-29',
    paymentMethod: 'Debit Checking',
    category: 'Health & Fitness'
  },
  {
    id: '2',
    name: 'ChatGPT Pro',
    amount: 19.99,
    frequency: 'Monthly',
    status: 'Active',
    nextDue: '2025-07-22',
    paymentMethod: 'Debit Checking',
    category: 'Software'
  },
  {
    id: '3',
    name: 'Google One',
    amount: 19.99,
    frequency: 'Monthly',
    status: 'Inactive',
    nextDue: '2025-12-29',
    paymentMethod: 'Debit Checking',
    category: 'Cloud Storage'
  },
  {
    id: '4',
    name: 'Kindroid Basic',
    amount: 39.99,
    frequency: 'Quarterly',
    status: 'Active',
    nextDue: '2025-09-27',
    paymentMethod: 'Debit Checking',
    category: 'AI Services'
  },
  {
    id: '5',
    name: 'Skylight',
    amount: 7.99,
    frequency: 'Monthly',
    status: 'Active',
    nextDue: '2025-08-07',
    paymentMethod: 'Debit Checking',
    category: 'Software'
  },
  {
    id: '6',
    name: 'YouTube Premium',
    amount: 18.99,
    frequency: 'Monthly',
    status: 'Active',
    nextDue: '2025-07-17',
    paymentMethod: 'Debit Checking',
    category: 'Entertainment'
  },
  {
    id: '7',
    name: 'Goodnotes 6',
    amount: 9.99,
    frequency: 'Annually',
    status: 'Active',
    nextDue: '2025-12-11',
    paymentMethod: 'Debit Checking',
    category: 'Productivity'
  },
  {
    id: '8',
    name: 'Kindroid Ultra Add On',
    amount: 24.99,
    frequency: 'Monthly',
    status: 'Active',
    nextDue: '2025-08-08',
    paymentMethod: 'Debit Checking',
    category: 'AI Services'
  },
  {
    id: '9',
    name: 'Shotsy',
    amount: 19.99,
    frequency: 'Annually',
    status: 'Active',
    nextDue: '2026-06-18',
    paymentMethod: 'Debit Checking',
    category: 'Software'
  },
  {
    id: '10',
    name: 'Apple iCloud+',
    amount: 0.99,
    frequency: 'Monthly',
    status: 'Active',
    nextDue: '2025-07-25',
    paymentMethod: 'Debit Checking',
    category: 'Cloud Storage'
  },
  {
    id: '11',
    name: 'Netflix',
    amount: 15.49,
    frequency: 'Monthly',
    status: 'Active',
    nextDue: '2025-08-01',
    paymentMethod: 'Credit Card',
    category: 'Entertainment'
  },
  {
    id: '12',
    name: 'Spotify',
    amount: 9.99,
    frequency: 'Monthly',
    status: 'Active',
    nextDue: '2025-07-28',
    paymentMethod: 'Debit Checking',
    category: 'Entertainment'
  },
  {
    id: '13',
    name: 'Adobe Creative Cloud',
    amount: 54.99,
    frequency: 'Monthly',
    status: 'Active',
    nextDue: '2025-08-15',
    paymentMethod: 'Credit Card',
    category: 'Software'
  }
]

// Calculate bills summary
function calculateBillsSummary(bills) {
  const summary = {
    monthlyTotal: 0,
    annualTotal: 0,
    activeBills: 0,
    nextPayment: null,
    nextPaymentName: ''
  }
  
  const today = new Date()
  let nextDueDate = null
  
  bills.forEach(bill => {
    if (bill.status === 'Active') {
      summary.activeBills++
      
      // Calculate monthly equivalent
      let monthlyAmount = bill.amount
      if (bill.frequency === 'Quarterly') {
        monthlyAmount = bill.amount / 3
      } else if (bill.frequency === 'Annually') {
        monthlyAmount = bill.amount / 12
      }
      
      summary.monthlyTotal += monthlyAmount
      
      // Check for next payment
      const dueDate = new Date(bill.nextDue)
      if (!nextDueDate || dueDate < nextDueDate) {
        nextDueDate = dueDate
        summary.nextPayment = bill.nextDue
        summary.nextPaymentName = bill.name
      }
    }
  })
  
  summary.annualTotal = summary.monthlyTotal * 12
  
  return summary
}

// Get frequency badge class
function getFrequencyClass(frequency) {
  const freqMap = {
    'Monthly': 'freq-monthly',
    'Quarterly': 'freq-quarterly',
    'Annually': 'freq-annually',
    'Weekly': 'freq-weekly',
    'Bi-Weekly': 'freq-biweekly'
  }
  return freqMap[frequency] || 'freq-monthly'
}

// Calculate days until due
function getDaysUntilDue(dueDate) {
  const today = new Date()
  const due = new Date(dueDate)
  const diffTime = due - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Format due date
function formatDueDate(dueDate) {
  const date = new Date(dueDate)
  const options = { month: 'short', day: 'numeric', year: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

// Generate calendar days
function generateCalendarDays(year, month, bills) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  
  const days = []
  
  // Add empty days for alignment
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push({ empty: true })
  }
  
  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = date.toISOString().split('T')[0]
    const dayBills = bills.filter(bill => {
      const billDate = new Date(bill.nextDue)
      return billDate.toDateString() === date.toDateString() && bill.status === 'Active'
    })
    
    days.push({
      day,
      date: dateStr,
      bills: dayBills,
      isToday: date.toDateString() === new Date().toDateString()
    })
  }
  
  return days
}

// Render bills page
export async function renderBills(appState) {
  const container = document.getElementById('page-content')
  if (!container) return
  
  const bills = mockBills
  const summary = calculateBillsSummary(bills)
  
  // Get current month for calendar
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
  
  container.innerHTML = `
    <div class="bills-page">
      <!-- Page Header -->
      <div class="page-header">
        <h1 class="page-title">Recurring Bills</h1>
        <button class="add-bill-btn" id="add-bill-btn">
          <span>+</span>
          <span>Add New Recurring Bill</span>
        </button>
      </div>
      
      <!-- Summary Cards -->
      <div class="summary-section">
        <div class="summary-card">
          <div class="summary-label">Monthly Total</div>
          <div class="summary-value negative">${maskCurrency(summary.monthlyTotal, appState.privacyMode)}</div>
          <div class="summary-subtext">Due this month</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Annual Total</div>
          <div class="summary-value negative">${maskCurrency(summary.annualTotal, appState.privacyMode)}</div>
          <div class="summary-subtext">Projected yearly cost</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Active Bills</div>
          <div class="summary-value neutral">${summary.activeBills}</div>
          <div class="summary-subtext">Currently active</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Next Payment</div>
          <div class="summary-value">${summary.nextPayment ? new Date(summary.nextPayment).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</div>
          <div class="summary-subtext${summary.nextPayment && getDaysUntilDue(summary.nextPayment) <= 3 ? ' due-soon' : ''}">${summary.nextPaymentName || 'No upcoming bills'}</div>
        </div>
      </div>
      
      <!-- View Controls -->
      <div class="view-controls">
        <div class="view-toggle">
          <button class="toggle-btn active" data-view="list">List View</button>
          <button class="toggle-btn" data-view="calendar">Calendar View</button>
        </div>
        <select class="filter-dropdown" id="bills-filter">
          <option value="all">All Bills</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive</option>
          <option value="due-week">Due This Week</option>
          <option value="due-month">Due This Month</option>
        </select>
      </div>
      
      <!-- Calendar View -->
      <div class="calendar-section" id="calendarView">
        <div class="calendar-header">
          <div class="calendar-nav">
            <button class="nav-btn" id="prev-month">‹</button>
            <h2 class="calendar-month" id="calendar-month-year">${monthNames[currentMonth]} ${currentYear}</h2>
            <button class="nav-btn" id="next-month">›</button>
          </div>
          <div class="calendar-actions">
            <button class="action-btn" id="today-btn">Today</button>
            <button class="action-btn primary">💰 Pay Schedule</button>
          </div>
        </div>
        
        <div class="calendar-grid" id="calendar-grid">
          <!-- Day headers -->
          <div class="calendar-day-header">Sun</div>
          <div class="calendar-day-header">Mon</div>
          <div class="calendar-day-header">Tue</div>
          <div class="calendar-day-header">Wed</div>
          <div class="calendar-day-header">Thu</div>
          <div class="calendar-day-header">Fri</div>
          <div class="calendar-day-header">Sat</div>
          
          <!-- Calendar days will be generated here -->
        </div>
      </div>
      
      <!-- List View -->
      <div class="bills-list-section" id="listView">
        <div class="bills-grid">
          ${bills.length > 0 ? bills.map(bill => `
            <div class="bill-card" data-bill-id="${bill.id}">
              <div class="bill-header">
                <div class="bill-info">
                  <h3>${bill.name}</h3>
                  <div class="bill-amount negative">${maskCurrency(bill.amount, appState.privacyMode)}</div>
                </div>
                <span class="status-badge status-${bill.status.toLowerCase()}">${bill.status}</span>
              </div>
              <div class="bill-details">
                <div class="detail-item">
                  <span class="detail-label">Next Due</span>
                  <span class="detail-value${getDaysUntilDue(bill.nextDue) <= 3 ? ' due-soon' : ''}${getDaysUntilDue(bill.nextDue) < 0 ? ' overdue' : ''}">${formatDueDate(bill.nextDue)}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Frequency</span>
                  <span class="detail-value">
                    <span class="status-badge ${getFrequencyClass(bill.frequency)}">${bill.frequency}</span>
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Payment Method</span>
                  <span class="detail-value">${bill.paymentMethod}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Category</span>
                  <span class="detail-value">${bill.category}</span>
                </div>
              </div>
              <div class="bill-actions">
                ${bill.status === 'Active' ? '<button class="bill-btn pay" data-bill-id="' + bill.id + '" data-bill-name="' + bill.name + '">Pay Bill</button>' : ''}
                <button class="bill-btn edit" data-bill-id="${bill.id}" data-bill-name="${bill.name}">Edit</button>
                <button class="bill-btn delete" data-bill-id="${bill.id}" data-bill-name="${bill.name}">Delete</button>
              </div>
            </div>
          `).join('') : `
            <div class="no-bills-message">
              <div class="no-bills-icon">📅</div>
              <div class="no-bills-text">No recurring bills yet</div>
              <div class="no-bills-subtext">Add your first recurring bill to start tracking</div>
            </div>
          `}
        </div>
      </div>
    </div>
  `
  
  // Set up event handlers
  setupBillsEventHandlers(appState)
  
  // Generate initial calendar
  updateCalendar(currentYear, currentMonth, bills)
}

// Update calendar display
function updateCalendar(year, month, bills) {
  const calendarGrid = document.getElementById('calendar-grid')
  if (!calendarGrid) return
  
  // Keep headers
  const headers = calendarGrid.querySelectorAll('.calendar-day-header')
  calendarGrid.innerHTML = ''
  headers.forEach(header => calendarGrid.appendChild(header))
  
  // Generate days
  const days = generateCalendarDays(year, month, bills)
  
  days.forEach(dayData => {
    if (dayData.empty) {
      const emptyDiv = document.createElement('div')
      calendarGrid.appendChild(emptyDiv)
    } else {
      const dayDiv = document.createElement('div')
      dayDiv.className = 'calendar-day'
      if (dayData.isToday) dayDiv.classList.add('today')
      
      let billsHtml = ''
      if (dayData.bills.length > 0) {
        billsHtml = `
          <div class="day-bills">
            ${dayData.bills.map(bill => 
              `<div class="bill-indicator">${bill.name} -$${bill.amount}</div>`
            ).join('')}
          </div>
        `
      }
      
      dayDiv.innerHTML = `
        <div class="day-number">${dayData.day}</div>
        ${billsHtml}
      `
      
      calendarGrid.appendChild(dayDiv)
    }
  })
}

// Set up event handlers
function setupBillsEventHandlers(appState) {
  // View toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.target.dataset.view
      toggleView(view)
    })
  })
  
  // Add bill button
  const addBillBtn = document.getElementById('add-bill-btn')
  if (addBillBtn) {
    addBillBtn.addEventListener('click', () => showAddBillModal(appState))
  }
  
  // Bill actions
  document.querySelectorAll('.bill-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const billId = e.target.dataset.billId
      const billName = e.target.dataset.billName
      
      if (e.target.classList.contains('pay')) {
        await handlePayBill(billId, billName, appState)
      } else if (e.target.classList.contains('edit')) {
        showEditBillModal(billId, billName, appState)
      } else if (e.target.classList.contains('delete')) {
        await handleDeleteBill(billId, billName, appState)
      }
    })
  })
  
  // Filter dropdown
  const filterDropdown = document.getElementById('bills-filter')
  if (filterDropdown) {
    filterDropdown.addEventListener('change', (e) => {
      filterBills(e.target.value, appState)
    })
  }
  
  // Calendar navigation
  let currentYear = new Date().getFullYear()
  let currentMonth = new Date().getMonth()
  
  document.getElementById('prev-month')?.addEventListener('click', () => {
    currentMonth--
    if (currentMonth < 0) {
      currentMonth = 11
      currentYear--
    }
    updateMonthDisplay(currentYear, currentMonth)
    updateCalendar(currentYear, currentMonth, mockBills)
  })
  
  document.getElementById('next-month')?.addEventListener('click', () => {
    currentMonth++
    if (currentMonth > 11) {
      currentMonth = 0
      currentYear++
    }
    updateMonthDisplay(currentYear, currentMonth)
    updateCalendar(currentYear, currentMonth, mockBills)
  })
  
  document.getElementById('today-btn')?.addEventListener('click', () => {
    const now = new Date()
    currentYear = now.getFullYear()
    currentMonth = now.getMonth()
    updateMonthDisplay(currentYear, currentMonth)
    updateCalendar(currentYear, currentMonth, mockBills)
  })
}

// Update month display
function updateMonthDisplay(year, month) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
  const monthYearEl = document.getElementById('calendar-month-year')
  if (monthYearEl) {
    monthYearEl.textContent = `${monthNames[month]} ${year}`
  }
}

// Toggle between views
function toggleView(view) {
  const listView = document.getElementById('listView')
  const calendarView = document.getElementById('calendarView')
  const toggleBtns = document.querySelectorAll('.toggle-btn')
  
  if (view === 'list') {
    listView.classList.remove('hidden')
    calendarView.classList.remove('active')
    toggleBtns[0].classList.add('active')
    toggleBtns[1].classList.remove('active')
  } else {
    listView.classList.add('hidden')
    calendarView.classList.add('active')
    toggleBtns[0].classList.remove('active')
    toggleBtns[1].classList.add('active')
  }
}

// Filter bills
function filterBills(filter, appState) {
  const billCards = document.querySelectorAll('.bill-card')
  const today = new Date()
  
  billCards.forEach(card => {
    const bill = mockBills.find(b => b.id === card.dataset.billId)
    if (!bill) return
    
    let show = false
    
    switch (filter) {
      case 'all':
        show = true
        break
      case 'active':
        show = bill.status === 'Active'
        break
      case 'inactive':
        show = bill.status === 'Inactive'
        break
      case 'due-week':
        const daysUntilDue = getDaysUntilDue(bill.nextDue)
        show = daysUntilDue >= 0 && daysUntilDue <= 7
        break
      case 'due-month':
        const dueDate = new Date(bill.nextDue)
        show = dueDate.getMonth() === today.getMonth() && dueDate.getFullYear() === today.getFullYear()
        break
    }
    
    card.style.display = show ? 'block' : 'none'
  })
}

// Show add bill modal
async function showAddBillModal(appState) {
  const { modalManager } = await import('../app.js')
  
  const modalContent = `
    <h2>Add Recurring Bill</h2>
    <form id="add-bill-form">
      <div class="form-group">
        <label for="bill-name">Bill Name</label>
        <input type="text" id="bill-name" name="name" required placeholder="e.g., Netflix">
      </div>
      <div class="form-group">
        <label for="bill-amount">Amount</label>
        <input type="number" id="bill-amount" name="amount" step="0.01" required placeholder="0.00">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="bill-frequency">Frequency</label>
          <select id="bill-frequency" name="frequency" required>
            <option value="">Select frequency...</option>
            <option value="Weekly">Weekly</option>
            <option value="Bi-Weekly">Bi-Weekly</option>
            <option value="Monthly">Monthly</option>
            <option value="Quarterly">Quarterly</option>
            <option value="Annually">Annually</option>
          </select>
        </div>
        <div class="form-group">
          <label for="bill-next-due">Next Due Date</label>
          <input type="date" id="bill-next-due" name="nextDue" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="bill-category">Category</label>
          <select id="bill-category" name="category" required>
            <option value="">Select category...</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Software">Software</option>
            <option value="Cloud Storage">Cloud Storage</option>
            <option value="AI Services">AI Services</option>
            <option value="Health & Fitness">Health & Fitness</option>
            <option value="Productivity">Productivity</option>
            <option value="Utilities">Utilities</option>
            <option value="Insurance">Insurance</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="bill-payment-method">Payment Method</label>
          <select id="bill-payment-method" name="paymentMethod" required>
            <option value="">Select method...</option>
            <option value="Debit Checking">Debit Checking</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cash">Cash</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn-primary">Add Bill</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  // Handle form submission
  document.getElementById('add-bill-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    // TODO: Save to database
    console.log('Adding bill:', Object.fromEntries(formData))
    
    modalManager.close()
    modalManager.showNotification('Recurring bill added successfully', 'success')
    
    // Refresh the page
    await renderBills(appState)
  })
}

// Show edit bill modal
async function showEditBillModal(billId, billName, appState) {
  const { modalManager } = await import('../app.js')
  
  // TODO: Load actual bill data
  const bill = mockBills.find(b => b.id === billId)
  
  const modalContent = `
    <h2>Edit Recurring Bill</h2>
    <form id="edit-bill-form">
      <div class="form-group">
        <label for="bill-name">Bill Name</label>
        <input type="text" id="bill-name" name="name" value="${bill.name}" required>
      </div>
      <div class="form-group">
        <label for="bill-amount">Amount</label>
        <input type="number" id="bill-amount" name="amount" step="0.01" value="${bill.amount}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="bill-frequency">Frequency</label>
          <select id="bill-frequency" name="frequency" required>
            <option value="Weekly" ${bill.frequency === 'Weekly' ? 'selected' : ''}>Weekly</option>
            <option value="Bi-Weekly" ${bill.frequency === 'Bi-Weekly' ? 'selected' : ''}>Bi-Weekly</option>
            <option value="Monthly" ${bill.frequency === 'Monthly' ? 'selected' : ''}>Monthly</option>
            <option value="Quarterly" ${bill.frequency === 'Quarterly' ? 'selected' : ''}>Quarterly</option>
            <option value="Annually" ${bill.frequency === 'Annually' ? 'selected' : ''}>Annually</option>
          </select>
        </div>
        <div class="form-group">
          <label for="bill-next-due">Next Due Date</label>
          <input type="date" id="bill-next-due" name="nextDue" value="${bill.nextDue}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="bill-category">Category</label>
          <select id="bill-category" name="category" required>
            <option value="Entertainment" ${bill.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
            <option value="Software" ${bill.category === 'Software' ? 'selected' : ''}>Software</option>
            <option value="Cloud Storage" ${bill.category === 'Cloud Storage' ? 'selected' : ''}>Cloud Storage</option>
            <option value="AI Services" ${bill.category === 'AI Services' ? 'selected' : ''}>AI Services</option>
            <option value="Health & Fitness" ${bill.category === 'Health & Fitness' ? 'selected' : ''}>Health & Fitness</option>
            <option value="Productivity" ${bill.category === 'Productivity' ? 'selected' : ''}>Productivity</option>
            <option value="Utilities" ${bill.category === 'Utilities' ? 'selected' : ''}>Utilities</option>
            <option value="Insurance" ${bill.category === 'Insurance' ? 'selected' : ''}>Insurance</option>
            <option value="Other" ${bill.category === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label for="bill-status">Status</label>
          <select id="bill-status" name="status" required>
            <option value="Active" ${bill.status === 'Active' ? 'selected' : ''}>Active</option>
            <option value="Inactive" ${bill.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" onclick="window.modalManager.close()">Cancel</button>
        <button type="submit" class="btn-primary">Save Changes</button>
      </div>
    </form>
  `
  
  modalManager.show(modalContent)
  
  // Handle form submission
  document.getElementById('edit-bill-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    
    // TODO: Update in database
    modalManager.close()
    modalManager.showNotification('Bill updated successfully', 'success')
    
    // Refresh the page
    await renderBills(appState)
  })
}

// Handle pay bill
async function handlePayBill(billId, billName, appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Mark Bill as Paid?',
    message: `Are you sure you want to mark "${billName}" as paid? This will create a transaction and update the next due date.`,
    confirmText: 'Mark as Paid',
    confirmClass: 'btn-success',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    // TODO: Create transaction and update bill
    console.log('Marking bill as paid:', billId)
    
    modalManager.showNotification('Bill marked as paid successfully', 'success')
    
    // Refresh the page
    await renderBills(appState)
  }
}

// Handle delete bill
async function handleDeleteBill(billId, billName, appState) {
  const { modalManager } = await import('../app.js')
  
  const confirmed = await modalManager.confirm({
    title: 'Delete Recurring Bill?',
    message: `Are you sure you want to delete "${billName}"? This action cannot be undone.`,
    confirmText: 'Delete Bill',
    confirmClass: 'btn-danger',
    cancelText: 'Cancel'
  })
  
  if (confirmed) {
    // TODO: Delete from database
    console.log('Deleting bill:', billId)
    
    modalManager.showNotification('Bill deleted successfully', 'success')
    
    // Refresh the page
    await renderBills(appState)
  }
}

// Export functions
export default {
  renderBills
}