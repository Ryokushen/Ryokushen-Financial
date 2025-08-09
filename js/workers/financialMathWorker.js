// js/workers/financialMathWorker.js - Financial Math Functions for Web Workers
// This is a non-module version of financialMath.js for use in Web Workers

/**
 * Constants for financial calculations
 */
const DECIMAL_PLACES = 2;
const ROUNDING_FACTOR = Math.pow(10, DECIMAL_PLACES);

/**
 * Safe addition of monetary values
 */
function addMoney(...amounts) {
  return amounts.reduce((sum, amount) => {
    const value = parseFloat(amount) || 0;
    return Math.round((sum + value) * ROUNDING_FACTOR) / ROUNDING_FACTOR;
  }, 0);
}

/**
 * Safe subtraction of monetary values
 */
function subtractMoney(amount1, amount2) {
  const a = parseFloat(amount1) || 0;
  const b = parseFloat(amount2) || 0;
  return Math.round((a - b) * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

/**
 * Safe multiplication of monetary values
 */
function multiplyMoney(amount, multiplier) {
  const a = parseFloat(amount) || 0;
  const m = parseFloat(multiplier) || 0;
  return Math.round(a * m * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

/**
 * Safe division of monetary values
 */
function divideMoney(amount, divisor) {
  const a = parseFloat(amount) || 0;
  const d = parseFloat(divisor) || 1;
  if (d === 0) {
    return 0;
  }
  return Math.round((a / d) * ROUNDING_FACTOR) / ROUNDING_FACTOR;
}

/**
 * Calculate sum of an array of monetary values
 */
function sumMoney(amounts) {
  if (!Array.isArray(amounts)) {
    return 0;
  }
  return amounts.reduce((sum, amount) => addMoney(sum, amount), 0);
}

/**
 * Calculate average of monetary values
 */
function averageMoney(amounts) {
  if (!Array.isArray(amounts) || amounts.length === 0) {
    return 0;
  }
  const sum = sumMoney(amounts);
  return divideMoney(sum, amounts.length);
}

/**
 * Convert amount to monthly equivalent
 */
function convertToMonthlyPrecise(amount, frequency) {
  const monthlyAmount = parseFloat(amount) || 0;

  switch (frequency?.toLowerCase()) {
    case 'weekly':
      return multiplyMoney(monthlyAmount, 52 / 12);
    case 'bi-weekly':
      return multiplyMoney(monthlyAmount, 26 / 12);
    case 'semi-monthly':
      return multiplyMoney(monthlyAmount, 2);
    case 'monthly':
      return monthlyAmount;
    case 'quarterly':
      return divideMoney(monthlyAmount, 3);
    case 'semi-annually':
      return divideMoney(monthlyAmount, 6);
    case 'annually':
      return divideMoney(monthlyAmount, 12);
    default:
      return monthlyAmount;
  }
}

// Make functions available to the worker
self.financialMath = {
  addMoney,
  subtractMoney,
  multiplyMoney,
  divideMoney,
  sumMoney,
  averageMoney,
  convertToMonthlyPrecise,
};
