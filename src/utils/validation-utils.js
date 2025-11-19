/**
 * Validate Israeli phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export function validateIsraeliPhone(phone) {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Israeli phone numbers: 
  // - Mobile: 05X-XXXXXXX (10 digits starting with 05)
  // - Landline: 0X-XXXXXXX (9-10 digits starting with 0)
  // - International format: +972-5X-XXXXXXX
  
  // Check for Israeli mobile number (05X-XXXXXXX)
  if (/^05[0-9]{8}$/.test(cleaned)) return true;
  
  // Check for landline (0[2-4,8,9]-XXXXXXX)
  if (/^0[2-4,8-9][0-9]{7}$/.test(cleaned)) return true;
  
  // Check for international format (+972...)
  if (/^972[5][0-9]{8}$/.test(cleaned)) return true;
  
  return false;
}

/**
 * Format Israeli phone number for display
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
export function formatIsraeliPhone(phone) {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  // Mobile: 05X-XXX-XXXX
  if (/^05[0-9]{8}$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Landline: 0X-XXX-XXXX
  if (/^0[2-4,8-9][0-9]{7}$/.test(cleaned)) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
  }
  
  return phone;
}

/**
 * Validate Israeli ID number (Teudat Zehut)
 * @param {string} id - ID number to validate
 * @returns {boolean} True if valid
 */
export function validateIsraeliID(id) {
  if (!id) return false;
  
  // Remove all non-digit characters
  const cleaned = id.replace(/\D/g, '');
  
  // Must be 9 digits (pad with zeros if shorter)
  const paddedId = cleaned.padStart(9, '0');
  if (paddedId.length !== 9 || !/^[0-9]+$/.test(paddedId)) return false;
  
  // Calculate checksum using Luhn algorithm
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(paddedId[i]);
    
    // Double every second digit
    if (i % 2 === 0) {
      digit *= 1;
    } else {
      digit *= 2;
      // If result is two digits, add them together
      if (digit > 9) digit = Math.floor(digit / 10) + (digit % 10);
    }
    
    sum += digit;
  }
  
  return sum % 10 === 0;
}

/**
 * Format Israeli ID number for display
 * @param {string} id - ID number
 * @returns {string} Formatted ID number
 */
export function formatIsraeliID(id) {
  if (!id) return '';
  const cleaned = id.replace(/\D/g, '');
  return cleaned.padStart(9, '0');
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Hebrew text (contains Hebrew characters)
 * @param {string} text - Text to validate
 * @returns {boolean} True if contains Hebrew
 */
export function containsHebrew(text) {
  if (!text) return false;
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
}

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @returns {boolean} True if not empty
 */
export function validateRequired(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Validate minimum length
 * @param {string} value - Value to validate
 * @param {number} minLength - Minimum length
 * @returns {boolean} True if valid
 */
export function validateMinLength(value, minLength) {
  if (!value) return false;
  return value.length >= minLength;
}

/**
 * Validate maximum length
 * @param {string} value - Value to validate
 * @param {number} maxLength - Maximum length
 * @returns {boolean} True if valid
 */
export function validateMaxLength(value, maxLength) {
  if (!value) return true; // Empty is valid
  return value.length <= maxLength;
}

/**
 * Validate time format (HH:MM)
 * @param {string} time - Time string
 * @returns {boolean} True if valid
 */
export function validateTime(time) {
  if (!time) return false;
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export function validateURL(url) {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string (remove HTML tags and special characters)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"]/g, '') // Remove special characters
    .trim();
}

/**
 * Validate form data
 * @param {object} data - Form data object
 * @param {object} rules - Validation rules object
 * @returns {{isValid: boolean, errors: object}} Validation result
 */
export function validateForm(data, rules) {
  const errors = {};
  let isValid = true;
  
  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];
    
    if (fieldRules.required && !validateRequired(value)) {
      errors[field] = 'שדה חובה';
      isValid = false;
      continue;
    }
    
    if (fieldRules.email && value && !validateEmail(value)) {
      errors[field] = 'כתובת אימייל לא תקינה';
      isValid = false;
      continue;
    }
    
    if (fieldRules.phone && value && !validateIsraeliPhone(value)) {
      errors[field] = 'מספר טלפון לא תקין';
      isValid = false;
      continue;
    }
    
    if (fieldRules.israeliId && value && !validateIsraeliID(value)) {
      errors[field] = 'תעודת זהות לא תקינה';
      isValid = false;
      continue;
    }
    
    if (fieldRules.minLength && value && !validateMinLength(value, fieldRules.minLength)) {
      errors[field] = `חייב להכיל לפחות ${fieldRules.minLength} תווים`;
      isValid = false;
      continue;
    }
    
    if (fieldRules.maxLength && value && !validateMaxLength(value, fieldRules.maxLength)) {
      errors[field] = `לא יכול להכיל יותר מ-${fieldRules.maxLength} תווים`;
      isValid = false;
      continue;
    }
    
    if (fieldRules.time && value && !validateTime(value)) {
      errors[field] = 'פורמט שעה לא תקין (HH:MM)';
      isValid = false;
      continue;
    }
  }
  
  return { isValid, errors };
}
