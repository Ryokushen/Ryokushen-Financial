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

export default {
  validateEmail,
  validatePassword,
  validateAmount
}