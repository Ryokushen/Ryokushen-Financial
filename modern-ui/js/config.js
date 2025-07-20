// Configuration for Modern UI

// Supabase Configuration
export const SUPABASE_URL = 'https://wnmrzagbonxybazwllyo.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubXJ6YWdib254eWJhendsbHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3NzQzMDAsImV4cCI6MjA1MDM1MDMwMH0.0bhqrUud9Lk4M3ElL2OFkPMZFwrsfvC4_5yDmLyLsYE'

// Application Configuration
export const APP_CONFIG = {
  name: 'Ryokushen Financial',
  version: '2.0.0',
  theme: 'dark', // 'dark' | 'light' | 'system'
  currency: 'USD',
  locale: 'en-US',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h', // '12h' | '24h'
}

// Feature Flags
export const FEATURES = {
  VOICE_COMMANDS: true,
  PRIVACY_MODE: true,
  BIOMETRIC_AUTH: true,
  SMART_RULES: true,
  INVESTMENTS: true,
  DEBT_TRACKING: true,
  RECURRING_BILLS: true,
  BUDGET_PLANNING: true,
  FINANCIAL_HEALTH: true,
  DATA_EXPORT: true,
  DARK_MODE: true,
  ANIMATIONS: true,
}

// Chart Configuration
export const CHART_CONFIG = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 750,
    easing: 'easeOutQuart',
  },
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        padding: 16,
        font: {
          size: 12,
          family: "'Inter', sans-serif",
        },
        color: 'rgba(255, 255, 255, 0.8)',
      },
    },
    tooltip: {
      backgroundColor: 'rgba(15, 22, 35, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      titleFont: {
        size: 14,
        weight: 600,
      },
      bodyFont: {
        size: 13,
      },
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.6)',
        font: {
          size: 11,
        },
      },
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: 'rgba(255, 255, 255, 0.6)',
        font: {
          size: 11,
        },
      },
    },
  },
}

// Color Palette
export const COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#06b6d4',
  
  // Category Colors
  cash: '#10b981',
  investments: '#3b82f6',
  debt: '#ef4444',
  monthly: '#8b5cf6',
  
  // Chart Colors
  chartColors: [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#14b8a6', // Teal
  ],
}

// Animation Durations
export const ANIMATION = {
  fast: 150,
  base: 300,
  slow: 500,
  pageTransition: 300,
  numberCount: 2500,
}

// Breakpoints
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
}

// API Endpoints (relative to Supabase URL)
export const API_ENDPOINTS = {
  auth: {
    signIn: '/auth/v1/token?grant_type=password',
    signUp: '/auth/v1/signup',
    signOut: '/auth/v1/logout',
    user: '/auth/v1/user',
  },
  tables: {
    transactions: 'transactions',
    cashAccounts: 'cash_accounts',
    investmentAccounts: 'investment_accounts',
    debtAccounts: 'debt_accounts',
    recurringBills: 'recurring_bills',
    savingsGoals: 'savings_goals',
    smartRules: 'smart_rules',
    categories: 'categories',
  },
}

// Local Storage Keys
export const STORAGE_KEYS = {
  theme: 'ryokushen_theme',
  privacyMode: 'ryokushen_privacy_mode',
  lastSync: 'ryokushen_last_sync',
  preferences: 'ryokushen_preferences',
  cache: 'ryokushen_cache',
}

// Validation Rules
export const VALIDATION = {
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
  },
  transaction: {
    maxAmount: 999999999.99,
    minAmount: 0.01,
    maxDescriptionLength: 255,
    maxNotesLength: 1000,
  },
  account: {
    maxNameLength: 100,
    maxDescriptionLength: 255,
  },
}

// Default Categories
export const DEFAULT_CATEGORIES = [
  'Income',
  'Housing',
  'Transportation',
  'Food',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Travel',
  'Insurance',
  'Savings',
  'Investment',
  'Debt Payment',
  'Other',
]

// Financial Health Thresholds
export const HEALTH_THRESHOLDS = {
  savingsRate: {
    excellent: 20,
    good: 15,
    fair: 10,
    poor: 5,
  },
  emergencyFund: {
    excellent: 6, // months
    good: 3,
    fair: 1,
    poor: 0,
  },
  debtToIncome: {
    excellent: 20,
    good: 35,
    fair: 50,
    poor: 75,
  },
}

// Export all configurations
export default {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  APP_CONFIG,
  FEATURES,
  CHART_CONFIG,
  COLORS,
  ANIMATION,
  BREAKPOINTS,
  API_ENDPOINTS,
  STORAGE_KEYS,
  VALIDATION,
  DEFAULT_CATEGORIES,
  HEALTH_THRESHOLDS,
}