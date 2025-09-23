/**
 * Date utility functions for consistent UTC-based date handling across the application
 * All dates are normalized to UTC midnight for consistent day-based operations across timezones
 */

/**
 * Normalizes a date to UTC midnight (00:00:00.000 UTC) for consistent day-based comparisons
 * @param date - Date to normalize, defaults to current date if not provided
 * @returns Normalized date at UTC midnight
 */
export function normalizeToDate(date?: Date | string): Date {
  const normalized = date ? new Date(date) : new Date();
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Adds days to a date and normalizes it to UTC midnight
 * @param date - Base date
 * @param days - Number of days to add (can be negative)
 * @returns New date with added days, normalized to UTC midnight
 */
export function addDaysToDate(date: Date | string, days: number): Date {
  const result = normalizeToDate(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Gets today's date normalized to UTC midnight
 * @returns Today's date at UTC midnight
 */
export function getToday(): Date {
  return normalizeToDate();
}

/**
 * Gets UTC today's date (useful for server-side operations)
 * @returns Today's date in UTC at midnight
 */
export function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Checks if a date is today (ignoring time)
 * @param date - Date to check
 * @returns True if the date is today
 */
export function isToday(date: Date | string): boolean {
  const today = getToday();
  const checkDate = normalizeToDate(date);
  return today.getTime() === checkDate.getTime();
}

/**
 * Checks if a date is in the past (before today, ignoring time)
 * @param date - Date to check
 * @returns True if the date is before today
 */
export function isPastDate(date: Date | string): boolean {
  const today = getToday();
  const checkDate = normalizeToDate(date);
  return checkDate < today;
}

/**
 * Checks if a date is in the future (after today, ignoring time)
 * @param date - Date to check
 * @returns True if the date is after today
 */
export function isFutureDate(date: Date | string): boolean {
  const today = getToday();
  const checkDate = normalizeToDate(date);
  return checkDate > today;
}

/**
 * Gets the difference in days between two dates (UTC-based)
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between dates (positive if date1 is after date2)
 */
export function getDaysDifference(date1: Date | string, date2: Date | string): number {
  const normalizedDate1 = normalizeToDate(date1);
  const normalizedDate2 = normalizeToDate(date2);
  const diffTime = normalizedDate1.getTime() - normalizedDate2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Creates a date range filter object for MongoDB queries (UTC-based)
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns MongoDB date filter object with UTC dates
 */
export function createDateRangeFilter(startDate?: Date | string, endDate?: Date | string) {
  const filter: any = {};

  if (startDate) {
    filter.$gte = normalizeToDate(startDate);
  }

  if (endDate) {
    // For end date, we want to include the entire day, so we add 1 day and use $lt
    filter.$lt = addDaysToDate(endDate, 1);
  }

  return filter;
}

/**
 * Converts a date to UTC start of day for consistent storage
 * @param date - Date to convert
 * @returns Date at UTC start of day
 */
export function toUTCStartOfDay(date: Date | string): Date {
  return normalizeToDate(date);
}

/**
 * Creates a date from year, month, day in UTC
 * @param year - Year
 * @param month - Month (0-11, January = 0)
 * @param day - Day of month (1-31)
 * @returns UTC date at midnight
 */
export function createUTCDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/**
 * Gets the start of month in UTC
 * @param date - Reference date
 * @returns First day of the month at UTC midnight
 */
export function getStartOfMonthUTC(date: Date | string): Date {
  const normalized = normalizeToDate(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), 1));
}

/**
 * Gets the end of month in UTC
 * @param date - Reference date
 * @returns Last day of the month at UTC midnight
 */
export function getEndOfMonthUTC(date: Date | string): Date {
  const normalized = normalizeToDate(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, 0));
}

/**
 * Adds months to a date in UTC
 * @param date - Base date
 * @param months - Number of months to add (can be negative)
 * @returns New date with added months, normalized to UTC midnight
 */
export function addMonthsUTC(date: Date | string, months: number): Date {
  const result = normalizeToDate(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}