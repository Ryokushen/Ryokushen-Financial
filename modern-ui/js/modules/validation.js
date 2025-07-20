// Validation Module - Placeholder
console.log('Validation module loaded from modern-ui');

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassword(password) {
  return password && password.length >= 8;
}

export function validateAmount(amount) {
  return !isNaN(amount) && amount > 0;
}

// Generic field validation
export function validateField(fieldName, value, rules = {}) {
  const errors = [];
  
  // Required validation
  if (rules.required && !value) {
    errors.push(`${fieldName} is required`);
  }
  
  // Email validation
  if (rules.type === 'email' && value && !validateEmail(value)) {
    errors.push('Invalid email address');
  }
  
  // Min length validation
  if (rules.minLength && value && value.length < rules.minLength) {
    errors.push(`Must be at least ${rules.minLength} characters`);
  }
  
  // Max length validation
  if (rules.maxLength && value && value.length > rules.maxLength) {
    errors.push(`Must be no more than ${rules.maxLength} characters`);
  }
  
  // Number validation
  if (rules.type === 'number' && value) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      errors.push('Must be a valid number');
    } else {
      if (rules.min !== undefined && num < rules.min) {
        errors.push(`Must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && num > rules.max) {
        errors.push(`Must be no more than ${rules.max}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  validateEmail,
  validatePassword,
  validateAmount,
  validateField
}