/**
 * Pay Calculator Module
 * Handles salary calculations, tax withholdings, and deductions
 */

import { formatCurrency } from './utils.js';
import { eventManager } from './eventManager.js';
import { debug } from './debug.js';
import { isPrivacyMode } from './privacy.js';
import { showError, showSuccess } from './ui.js';

export const payCalculator = {
  initialized: false,
  isCalculating: false,

  // State management
  state: {
    expandedSections: {
      regularPay: true,
      federalTaxes: false,
      stateTaxes: false,
      earnings: false,
      deductions: false,
    },

    regularPay: {
      frequency: 'biweekly',
      scheduledHours: 80,
      annualSalary: 50000,
      hourlyRate: 24.04,
    },

    federalTax: {
      filingStatus: 'married-jointly',
      subjectToTax: true,
      qualifyingChildren: 0,
      otherDependents: 0,
      extraWithholding: 0,
    },

    stateTax: {
      state: 'tennessee',
    },

    earnings: [],
    deductions: [],

    takeHomePay: 0,
  },

  // Tax brackets and rates (2024)
  taxBrackets: {
    single: [
      { min: 0, max: 11000, rate: 0.1 },
      { min: 11000, max: 44725, rate: 0.12 },
      { min: 44725, max: 95375, rate: 0.22 },
      { min: 95375, max: 182050, rate: 0.24 },
      { min: 182050, max: 231250, rate: 0.32 },
      { min: 231250, max: 578125, rate: 0.35 },
      { min: 578125, max: Infinity, rate: 0.37 },
    ],
    'married-jointly': [
      { min: 0, max: 22000, rate: 0.1 },
      { min: 22000, max: 89450, rate: 0.12 },
      { min: 89450, max: 190750, rate: 0.22 },
      { min: 190750, max: 364200, rate: 0.24 },
      { min: 364200, max: 462500, rate: 0.32 },
      { min: 462500, max: 693750, rate: 0.35 },
      { min: 693750, max: Infinity, rate: 0.37 },
    ],
    'married-separately': [
      { min: 0, max: 11000, rate: 0.1 },
      { min: 11000, max: 44725, rate: 0.12 },
      { min: 44725, max: 95375, rate: 0.22 },
      { min: 95375, max: 182050, rate: 0.24 },
      { min: 182050, max: 231250, rate: 0.32 },
      { min: 231250, max: 346875, rate: 0.35 },
      { min: 346875, max: Infinity, rate: 0.37 },
    ],
    'head-of-household': [
      { min: 0, max: 15700, rate: 0.1 },
      { min: 15700, max: 59850, rate: 0.12 },
      { min: 59850, max: 95350, rate: 0.22 },
      { min: 95350, max: 182050, rate: 0.24 },
      { min: 182050, max: 231250, rate: 0.32 },
      { min: 231250, max: 578100, rate: 0.35 },
      { min: 578100, max: Infinity, rate: 0.37 },
    ],
  },

  // Standard deductions (2024)
  standardDeductions: {
    single: 13850,
    'married-jointly': 27700,
    'married-separately': 13850,
    'head-of-household': 20800,
  },

  // State tax rates
  stateTaxRates: {
    tennessee: 0,
    texas: 0,
    florida: 0,
    california: 0.0725, // Average, California has progressive rates
    newyork: 0.0685, // Average, NY has progressive rates
  },

  /**
   * Initialize the pay calculator
   */
  async init() {
    if (this.initialized) {
      return;
    }

    debug.log('Initializing pay calculator');

    try {
      // Set up event listeners
      this.setupEventListeners();

      // Load saved state if available
      this.loadSavedState();

      // Initialize UI
      this.updateHourlyRate();
      this.renderEarnings();
      this.renderDeductions();

      this.initialized = true;
      debug.log('Pay calculator initialized successfully');
    } catch (error) {
      debug.error('Failed to initialize pay calculator:', error);
      showError('Failed to initialize pay calculator');
    }
  },

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Collapsible sections
    document.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', e => this.toggleSection(e.currentTarget.dataset.section));
    });

    // Calculate buttons
    document
      .getElementById('calculate-pay-btn')
      ?.addEventListener('click', () => this.calculatePay());
    document
      .getElementById('calculate-pay-btn-bottom')
      ?.addEventListener('click', () => this.calculatePay());

    // Regular pay form
    const regularPayForm = document.getElementById('regular-pay-form');
    if (regularPayForm) {
      document.getElementById('pay-frequency')?.addEventListener('change', e => {
        this.state.regularPay.frequency = e.target.value;
        this.updateHourlyRate();
      });

      document.getElementById('scheduled-hours')?.addEventListener('input', e => {
        this.state.regularPay.scheduledHours = parseFloat(e.target.value) || 0;
        this.updateHourlyRate();
      });

      document.getElementById('annual-salary')?.addEventListener('input', e => {
        this.state.regularPay.annualSalary = parseFloat(e.target.value) || 0;
        this.updateHourlyRate();
      });
    }

    // Federal tax form
    const federalTaxForm = document.getElementById('federal-tax-form');
    if (federalTaxForm) {
      document.getElementById('filing-status')?.addEventListener('change', e => {
        this.state.federalTax.filingStatus = e.target.value;
      });

      document.querySelectorAll('input[name="subject-to-tax"]').forEach(radio => {
        radio.addEventListener('change', e => {
          this.state.federalTax.subjectToTax = e.target.value === 'yes';
        });
      });

      document.getElementById('qualifying-children')?.addEventListener('input', e => {
        this.state.federalTax.qualifyingChildren = parseInt(e.target.value) || 0;
      });

      document.getElementById('other-dependents')?.addEventListener('input', e => {
        this.state.federalTax.otherDependents = parseInt(e.target.value) || 0;
      });

      document.getElementById('extra-withholding')?.addEventListener('input', e => {
        this.state.federalTax.extraWithholding = parseFloat(e.target.value) || 0;
      });
    }

    // State tax form
    document.getElementById('state-selection')?.addEventListener('change', e => {
      this.state.stateTax.state = e.target.value;
      this.updateStateTaxMessage();
    });

    // Add earning/deduction buttons
    document.getElementById('add-earning-btn')?.addEventListener('click', () => this.addEarning());
    document
      .getElementById('add-deduction-btn')
      ?.addEventListener('click', () => this.addDeduction());
  },

  /**
   * Toggle section visibility
   */
  toggleSection(section) {
    const content = document.getElementById(`${section}-content`);
    const chevron = document.querySelector(`[data-section="${section}"] .chevron`);

    if (content) {
      const isExpanded = content.classList.contains('active');
      content.classList.toggle('active');
      this.state.expandedSections[section] = !isExpanded;

      if (chevron) {
        chevron.textContent = isExpanded ? '▶' : '▼';
      }
    }
  },

  /**
   * Update hourly rate calculation
   */
  updateHourlyRate() {
    const { annualSalary, scheduledHours, frequency } = this.state.regularPay;

    // Calculate hours per year based on frequency
    let hoursPerYear;
    switch (frequency) {
      case 'weekly':
        hoursPerYear = scheduledHours * 52;
        break;
      case 'biweekly':
        hoursPerYear = scheduledHours * 26;
        break;
      case 'semimonthly':
        hoursPerYear = scheduledHours * 24;
        break;
      case 'monthly':
        hoursPerYear = scheduledHours * 12;
        break;
      default:
        hoursPerYear = scheduledHours * 26; // Default to biweekly
    }

    const hourlyRate = hoursPerYear > 0 ? annualSalary / hoursPerYear : 0;
    this.state.regularPay.hourlyRate = hourlyRate;

    const rateElement = document.getElementById('hourly-rate');
    if (rateElement) {
      rateElement.textContent = hourlyRate.toFixed(2);
    }
  },

  /**
   * Update state tax message
   */
  updateStateTaxMessage() {
    const messageElement = document.getElementById('state-tax-message');
    if (!messageElement) {
      return;
    }

    const state = this.state.stateTax.state;
    const rate = this.stateTaxRates[state];

    if (rate === 0) {
      messageElement.textContent = 'No state tax withholding for this area';
    } else {
      messageElement.textContent = `State tax rate: ${(rate * 100).toFixed(2)}%`;
    }
  },

  /**
   * Add a new earning
   */
  addEarning() {
    const newId = Date.now();
    const earning = {
      id: newId,
      description: `Earning ${this.state.earnings.length + 1}`,
      amount: 0,
      exemptFromTaxes: [],
    };

    this.state.earnings.push(earning);
    this.renderEarnings();
  },

  /**
   * Remove an earning
   */
  removeEarning(id) {
    this.state.earnings = this.state.earnings.filter(e => e.id !== id);
    this.renderEarnings();
  },

  /**
   * Render earnings list
   */
  renderEarnings() {
    const container = document.getElementById('earnings-list');
    if (!container) {
      return;
    }

    container.innerHTML = this.state.earnings
      .map(
        earning => `
      <div class="dynamic-item card" data-earning-id="${earning.id}">
        <div class="item-header">
          <h4>Earning</h4>
          <button class="btn btn--ghost remove-item-btn" onclick="window.payCalculator.removeEarning(${earning.id})">
            <span class="icon">🗑️</span>
          </button>
        </div>
        <div class="item-content">
          <div class="form-group">
            <label class="form-label">Description *</label>
            <input type="text" class="form-control earning-description" 
                   value="${earning.description}" 
                   data-id="${earning.id}">
          </div>
          <div class="form-group">
            <label class="form-label">Amount *</label>
            <div class="input-group">
              <span class="input-group-addon">$</span>
              <input type="number" class="form-control earning-amount" 
                     value="${earning.amount}" 
                     step="0.01" min="0"
                     data-id="${earning.id}">
            </div>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    // Add event listeners to new inputs
    container.querySelectorAll('.earning-description').forEach(input => {
      input.addEventListener('input', e => {
        const earning = this.state.earnings.find(e => e.id === parseInt(input.dataset.id));
        if (earning) {
          earning.description = e.target.value;
        }
      });
    });

    container.querySelectorAll('.earning-amount').forEach(input => {
      input.addEventListener('input', e => {
        const earning = this.state.earnings.find(e => e.id === parseInt(input.dataset.id));
        if (earning) {
          earning.amount = parseFloat(e.target.value) || 0;
        }
      });
    });
  },

  /**
   * Add a new deduction
   */
  addDeduction() {
    const newId = Date.now();
    const deduction = {
      id: newId,
      description: `Deduction ${this.state.deductions.length + 1}`,
      type: 'flat',
      amount: 0,
    };

    this.state.deductions.push(deduction);
    this.renderDeductions();
  },

  /**
   * Remove a deduction
   */
  removeDeduction(id) {
    this.state.deductions = this.state.deductions.filter(d => d.id !== id);
    this.renderDeductions();
  },

  /**
   * Render deductions list
   */
  renderDeductions() {
    const container = document.getElementById('deductions-list');
    if (!container) {
      return;
    }

    container.innerHTML = this.state.deductions
      .map(
        deduction => `
      <div class="dynamic-item card" data-deduction-id="${deduction.id}">
        <div class="item-header">
          <h4>Deduction</h4>
          <button class="btn btn--ghost remove-item-btn" onclick="window.payCalculator.removeDeduction(${deduction.id})">
            <span class="icon">🗑️</span>
          </button>
        </div>
        <div class="item-content">
          <div class="form-group">
            <label class="form-label">Description *</label>
            <input type="text" class="form-control deduction-description" 
                   value="${deduction.description}" 
                   data-id="${deduction.id}">
          </div>
          <div class="form-group">
            <label class="form-label">Type *</label>
            <select class="form-control deduction-type" data-id="${deduction.id}">
              <option value="flat" ${deduction.type === 'flat' ? 'selected' : ''}>Flat Amount</option>
              <option value="percentage" ${deduction.type === 'percentage' ? 'selected' : ''}>Percentage</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Amount *</label>
            <div class="input-group">
              <span class="input-group-addon">${deduction.type === 'flat' ? '$' : '%'}</span>
              <input type="number" class="form-control deduction-amount" 
                     value="${deduction.amount}" 
                     step="0.01" min="0"
                     data-id="${deduction.id}">
            </div>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    // Add event listeners to new inputs
    container.querySelectorAll('.deduction-description').forEach(input => {
      input.addEventListener('input', e => {
        const deduction = this.state.deductions.find(d => d.id === parseInt(input.dataset.id));
        if (deduction) {
          deduction.description = e.target.value;
        }
      });
    });

    container.querySelectorAll('.deduction-type').forEach(select => {
      select.addEventListener('change', e => {
        const deduction = this.state.deductions.find(d => d.id === parseInt(select.dataset.id));
        if (deduction) {
          deduction.type = e.target.value;
          this.renderDeductions(); // Re-render to update the input addon
        }
      });
    });

    container.querySelectorAll('.deduction-amount').forEach(input => {
      input.addEventListener('input', e => {
        const deduction = this.state.deductions.find(d => d.id === parseInt(input.dataset.id));
        if (deduction) {
          deduction.amount = parseFloat(e.target.value) || 0;
        }
      });
    });
  },

  /**
   * Calculate federal tax
   */
  calculateFederalTax(annualIncome) {
    const { filingStatus, subjectToTax, qualifyingChildren, otherDependents } =
      this.state.federalTax;

    if (!subjectToTax) {
      return 0;
    }

    // Get standard deduction
    const standardDeduction = this.standardDeductions[filingStatus] || 13850;

    // Calculate child tax credit
    const childTaxCredit = qualifyingChildren * 2000;
    const otherDependentCredit = otherDependents * 500;

    // Calculate taxable income
    const taxableIncome = Math.max(0, annualIncome - standardDeduction);

    // Get tax brackets for filing status
    const brackets = this.taxBrackets[filingStatus] || this.taxBrackets.single;

    // Calculate tax
    let tax = 0;
    const previousMax = 0;

    for (const bracket of brackets) {
      if (taxableIncome <= bracket.min) {
        break;
      }

      const taxableInBracket = Math.min(taxableIncome - bracket.min, bracket.max - bracket.min);
      tax += taxableInBracket * bracket.rate;

      if (taxableIncome <= bracket.max) {
        break;
      }
    }

    // Apply tax credits
    tax = Math.max(0, tax - childTaxCredit - otherDependentCredit);

    return tax;
  },

  /**
   * Calculate state tax
   */
  calculateStateTax(annualIncome) {
    const rate = this.stateTaxRates[this.state.stateTax.state] || 0;
    return annualIncome * rate;
  },

  /**
   * Calculate Social Security tax
   */
  calculateSocialSecurityTax(annualIncome) {
    const ssRate = 0.062; // 6.2%
    const ssWageBase = 160200; // 2024 limit
    return Math.min(annualIncome, ssWageBase) * ssRate;
  },

  /**
   * Calculate Medicare tax
   */
  calculateMedicareTax(annualIncome) {
    const medicareRate = 0.0145; // 1.45%
    const additionalMedicareThreshold = 200000; // For single/HOH, $250k for MFJ
    const additionalMedicareRate = 0.009; // 0.9%

    let tax = annualIncome * medicareRate;

    if (annualIncome > additionalMedicareThreshold) {
      tax += (annualIncome - additionalMedicareThreshold) * additionalMedicareRate;
    }

    return tax;
  },

  /**
   * Calculate take-home pay
   */
  async calculatePay() {
    if (this.isCalculating) {
      return;
    }

    this.isCalculating = true;

    // Update button states
    const buttons = document.querySelectorAll('.calculate-pay-btn, .calculate-pay-btn-bottom');
    buttons.forEach(btn => {
      btn.disabled = true;
      btn.querySelector('span:last-child').textContent = 'Calculating...';
    });

    try {
      // Get base pay
      const { annualSalary, frequency } = this.state.regularPay;

      // Calculate pay periods per year
      let payPeriodsPerYear;
      switch (frequency) {
        case 'weekly':
          payPeriodsPerYear = 52;
          break;
        case 'biweekly':
          payPeriodsPerYear = 26;
          break;
        case 'semimonthly':
          payPeriodsPerYear = 24;
          break;
        case 'monthly':
          payPeriodsPerYear = 12;
          break;
        default:
          payPeriodsPerYear = 26;
      }

      const grossPayPerPeriod = annualSalary / payPeriodsPerYear;

      // Add earnings
      const additionalEarnings = this.state.earnings.reduce((sum, e) => sum + e.amount, 0);
      const totalGrossPerPeriod = grossPayPerPeriod + additionalEarnings;
      const annualGross = totalGrossPerPeriod * payPeriodsPerYear;

      // Calculate taxes (annual)
      const federalTax = this.calculateFederalTax(annualGross);
      const stateTax = this.calculateStateTax(annualGross);
      const socialSecurityTax = this.calculateSocialSecurityTax(annualGross);
      const medicareTax = this.calculateMedicareTax(annualGross);

      // Convert to per-period amounts
      const federalTaxPerPeriod = federalTax / payPeriodsPerYear;
      const stateTaxPerPeriod = stateTax / payPeriodsPerYear;
      const socialSecurityPerPeriod = socialSecurityTax / payPeriodsPerYear;
      const medicarePerPeriod = medicareTax / payPeriodsPerYear;

      // Add extra withholding
      const extraWithholding = this.state.federalTax.extraWithholding;

      // Calculate deductions
      let totalDeductions = 0;
      for (const deduction of this.state.deductions) {
        if (deduction.type === 'flat') {
          totalDeductions += deduction.amount;
        } else {
          totalDeductions += (totalGrossPerPeriod * deduction.amount) / 100;
        }
      }

      // Calculate take-home pay
      const totalTaxes =
        federalTaxPerPeriod +
        stateTaxPerPeriod +
        socialSecurityPerPeriod +
        medicarePerPeriod +
        extraWithholding;
      const takeHomePay = totalGrossPerPeriod - totalTaxes - totalDeductions;

      this.state.takeHomePay = takeHomePay;

      // Update display
      const displayElement = document.getElementById('take-home-pay');
      if (displayElement) {
        displayElement.textContent = isPrivacyMode() ? '•••••' : takeHomePay.toFixed(2);
      }

      // Log calculation details
      debug.log('Pay calculation:', {
        grossPerPeriod: totalGrossPerPeriod,
        federalTax: federalTaxPerPeriod,
        stateTax: stateTaxPerPeriod,
        socialSecurity: socialSecurityPerPeriod,
        medicare: medicarePerPeriod,
        deductions: totalDeductions,
        takeHome: takeHomePay,
      });
    } catch (error) {
      debug.error('Failed to calculate pay:', error);
      showError('Failed to calculate pay. Please check your inputs.');
    } finally {
      this.isCalculating = false;

      // Reset button states
      buttons.forEach(btn => {
        btn.disabled = false;
        btn.querySelector('span:last-child').textContent = 'Calculate';
      });
    }
  },

  /**
   * Load saved state from localStorage
   */
  loadSavedState() {
    try {
      const saved = localStorage.getItem('payCalculatorState');
      if (saved) {
        const parsedState = JSON.parse(saved);
        // Merge with default state to ensure all properties exist
        this.state = { ...this.state, ...parsedState };
      }
    } catch (error) {
      debug.error('Failed to load saved state:', error);
    }
  },

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      localStorage.setItem('payCalculatorState', JSON.stringify(this.state));
    } catch (error) {
      debug.error('Failed to save state:', error);
    }
  },

  /**
   * Clean up when leaving the tab
   */
  cleanup() {
    this.saveState();
  },
};

// Make available globally for onclick handlers
window.payCalculator = payCalculator;
