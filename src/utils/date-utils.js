import moment from 'moment';
import 'moment/locale/he';

// Set Hebrew locale as default
moment.locale('he');

/**
 * Format date in Hebrew
 * @param {Date|string|number} date - Date to format
 * @param {string} format - Moment.js format string
 * @returns {string} Formatted date string in Hebrew
 */
export function formatDate(date, format = 'DD/MM/YYYY') {
  return moment(date).format(format);
}

/**
 * Format date with time in Hebrew
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date) {
  return moment(date).format('DD/MM/YYYY HH:mm');
}

/**
 * Get Hebrew day name
 * @param {number} dayIndex - Day index (0-6, Sunday-Saturday)
 * @returns {string} Hebrew day name
 */
export function getHebrewDayName(dayIndex) {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return days[dayIndex] || '';
}

/**
 * Get short Hebrew day name
 * @param {number} dayIndex - Day index (0-6, Sunday-Saturday)
 * @returns {string} Short Hebrew day name
 */
export function getShortHebrewDayName(dayIndex) {
  const days = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  return days[dayIndex] || '';
}

/**
 * Get Hebrew month name
 * @param {number} monthIndex - Month index (0-11)
 * @returns {string} Hebrew month name
 */
export function getHebrewMonthName(monthIndex) {
  const months = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  return months[monthIndex] || '';
}

/**
 * Format time (HH:MM)
 * @param {string} time - Time string in HH:MM format
 * @returns {string} Formatted time
 */
export function formatTime(time) {
  return time;
}

/**
 * Get relative time in Hebrew (e.g., "לפני 5 דקות")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Relative time string in Hebrew
 */
export function getRelativeTime(date) {
  return moment(date).fromNow();
}

/**
 * Check if date is today
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is today
 */
export function isToday(date) {
  return moment(date).isSame(moment(), 'day');
}

/**
 * Check if date is in the past
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPast(date) {
  return moment(date).isBefore(moment());
}

/**
 * Check if date is in the future
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export function isFuture(date) {
  return moment(date).isAfter(moment());
}

/**
 * Get start of day
 * @param {Date|string|number} date - Date
 * @returns {Date} Start of day
 */
export function getStartOfDay(date) {
  return moment(date).startOf('day').toDate();
}

/**
 * Get end of day
 * @param {Date|string|number} date - Date
 * @returns {Date} End of day
 */
export function getEndOfDay(date) {
  return moment(date).endOf('day').toDate();
}

/**
 * Add days to date
 * @param {Date|string|number} date - Date
 * @param {number} days - Number of days to add
 * @returns {Date} New date
 */
export function addDays(date, days) {
  return moment(date).add(days, 'days').toDate();
}

/**
 * Get date range for a week
 * @param {Date|string|number} date - Date in the week
 * @returns {{start: Date, end: Date}} Week start and end dates
 */
export function getWeekRange(date) {
  const start = moment(date).startOf('week').toDate();
  const end = moment(date).endOf('week').toDate();
  return { start, end };
}

/**
 * Get date range for a month
 * @param {Date|string|number} date - Date in the month
 * @returns {{start: Date, end: Date}} Month start and end dates
 */
export function getMonthRange(date) {
  const start = moment(date).startOf('month').toDate();
  const end = moment(date).endOf('month').toDate();
  return { start, end };
}

/**
 * Parse date string to Date object
 * @param {string} dateString - Date string
 * @param {string} format - Format of the date string
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(dateString, format = 'DD/MM/YYYY') {
  const parsed = moment(dateString, format, true);
  return parsed.isValid() ? parsed.toDate() : null;
}

/**
 * Get current timestamp
 * @returns {Date} Current date
 */
export function now() {
  return new Date();
}

/**
 * Convert Firebase Timestamp to Date
 * @param {object} timestamp - Firebase Timestamp object
 * @returns {Date} Date object
 */
export function fromFirebaseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
}
