// js/modules/financialMath.js

/**
 * Financial Math Utilities
 * Provides precise calculations for monetary values
 * All calculations are done in cents to avoid floating point errors
 */

/**
 * Convert a dollar amount to cents
 */
export function toCents(dollars) {
  return Math.round(dollars * 100);
}

/**
 * Convert cents to dollars
 */
export function toDollars(cents) {
  return cents / 100;
}

/**
 * Add multiple dollar amounts with precision
 */
export function addMoney(...amounts) {
  const totalCents = amounts.reduce((sum, amount) => {
    return sum + toCents(amount || 0);
  }, 0);
  return toDollars(totalCents);
}

/**
 * Subtract dollar amounts with precision
 */
export function subtractMoney(minuend, subtrahend) {
  return toDollars(toCents(minuend) - toCents(subtrahend));
}

/**
 * Multiply dollar amount by a factor with precision
 */
export function multiplyMoney(amount, factor) {
  return toDollars(Math.round(toCents(amount) * factor));
}

/**
 * Divide dollar amount by a divisor with precision
 */
export function divideMoney(amount, divisor) {
  if (divisor === 0) {
    return 0;
  }
  return toDollars(Math.round(toCents(amount) / divisor));
}

/**
 * Calculate percentage of a dollar amount
 */
export function percentageOf(amount, percentage) {
  return multiplyMoney(amount, percentage / 100);
}

/**
 * Round money to specified decimal places (default 2)
 */
export function roundMoney(amount, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor) / factor;
}

/**
 * Compare two monetary values for equality
 */
export function moneyEquals(amount1, amount2) {
  return toCents(amount1) === toCents(amount2);
}

/**
 * Compare if amount1 is greater than amount2
 */
export function moneyGreaterThan(amount1, amount2) {
  return toCents(amount1) > toCents(amount2);
}

/**
 * Compare if amount1 is less than amount2
 */
export function moneyLessThan(amount1, amount2) {
  return toCents(amount1) < toCents(amount2);
}

/**
 * Calculate compound interest
 */
export function compoundInterest(principal, annualRate, years, compoundingFrequency = 12) {
  const rate = annualRate / 100;
  const n = compoundingFrequency;
  const t = years;

  const amount = principal * Math.pow(1 + rate / n, n * t);
  return roundMoney(amount);
}

/**
 * Calculate monthly payment for a loan
 */
export function calculateMonthlyPayment(principal, annualRate, years) {
  if (annualRate === 0) {
    return divideMoney(principal, years * 12);
  }

  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;

  const payment =
    (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  return roundMoney(payment);
}

/**
 * Convert frequency-based amounts to monthly
 */
export function convertToMonthlyPrecise(amount, frequency) {
  const conversions = {
    weekly: 52 / 12, // 4.333...
    biweekly: 26 / 12, // 2.166...
    monthly: 1,
    quarterly: 1 / 3, // 0.333...
    'semi-annually': 1 / 6, // 0.166...
    annually: 1 / 12, // 0.0833...
  };

  const factor = conversions[frequency] || 1;
  return multiplyMoney(amount, factor);
}

/**
 * Calculate percentage change between two amounts
 */
export function percentageChange(oldAmount, newAmount) {
  if (oldAmount === 0) {
    return newAmount > 0 ? 100 : 0;
  }

  const change = ((newAmount - oldAmount) / Math.abs(oldAmount)) * 100;
  return roundMoney(change, 2);
}

/**
 * Sum an array of monetary values
 */
export function sumMoney(amounts) {
  return addMoney(...amounts);
}

/**
 * Calculate average of monetary values
 */
export function averageMoney(amounts) {
  if (amounts.length === 0) {
    return 0;
  }
  return divideMoney(sumMoney(amounts), amounts.length);
}

/**
 * Format money for display (does not round)
 */
export function formatMoneyValue(amount, decimals = 2) {
  return amount.toFixed(decimals);
}
