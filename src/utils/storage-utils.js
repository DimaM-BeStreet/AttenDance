/**
 * Storage utility functions for localStorage
 */

const STORAGE_PREFIX = 'attendance_';

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
export function setItem(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(STORAGE_PREFIX + key, serialized);
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

/**
 * Get data from localStorage
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} Stored value or default
 */
export function getItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (item === null) return defaultValue;
    return JSON.parse(item);
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return defaultValue;
  }
}

/**
 * Remove item from localStorage
 * @param {string} key - Storage key
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
}

/**
 * Clear all app data from localStorage
 */
export function clearAll() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

/**
 * Check if localStorage is available
 * @returns {boolean} True if available
 */
export function isAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save user session data
 * @param {object} userData - User data to store
 */
export function saveUserSession(userData) {
  setItem('user_session', userData);
}

/**
 * Get user session data
 * @returns {object|null} User session data or null
 */
export function getUserSession() {
  return getItem('user_session');
}

/**
 * Clear user session
 */
export function clearUserSession() {
  removeItem('user_session');
}

/**
 * Save user preferences
 * @param {object} preferences - User preferences
 */
export function savePreferences(preferences) {
  setItem('preferences', preferences);
}

/**
 * Get user preferences
 * @returns {object} User preferences
 */
export function getPreferences() {
  return getItem('preferences', {
    theme: 'light',
    language: 'he',
    pageSize: 20
  });
}

/**
 * Save form draft
 * @param {string} formName - Form identifier
 * @param {object} formData - Form data
 */
export function saveDraft(formName, formData) {
  setItem(`draft_${formName}`, {
    data: formData,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get form draft
 * @param {string} formName - Form identifier
 * @returns {object|null} Draft data or null
 */
export function getDraft(formName) {
  const draft = getItem(`draft_${formName}`);
  if (!draft) return null;
  
  // Check if draft is older than 24 hours
  const draftTime = new Date(draft.timestamp);
  const now = new Date();
  const hoursDiff = (now - draftTime) / (1000 * 60 * 60);
  
  if (hoursDiff > 24) {
    removeDraft(formName);
    return null;
  }
  
  return draft.data;
}

/**
 * Remove form draft
 * @param {string} formName - Form identifier
 */
export function removeDraft(formName) {
  removeItem(`draft_${formName}`);
}

/**
 * Cache data with expiration
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} expirationMinutes - Expiration time in minutes
 */
export function cacheData(key, data, expirationMinutes = 60) {
  const cacheItem = {
    data,
    expiration: new Date().getTime() + (expirationMinutes * 60 * 1000)
  };
  setItem(`cache_${key}`, cacheItem);
}

/**
 * Get cached data
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/not found
 */
export function getCachedData(key) {
  const cacheItem = getItem(`cache_${key}`);
  if (!cacheItem) return null;
  
  // Check if expired
  if (new Date().getTime() > cacheItem.expiration) {
    removeItem(`cache_${key}`);
    return null;
  }
  
  return cacheItem.data;
}

/**
 * Clear all cached data
 */
export function clearCache() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX + 'cache_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}
