/**
 * Check if a given date falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a given date is a business day (not a weekend and not a holiday).
 * @param date - The date to check
 * @param holidays - Array of holiday date strings in YYYY-MM-DD format
 */
export function isBusinessDay(date: Date, holidays: string[] = []): boolean {
  if (isWeekend(date)) {
    return false;
  }
  const dateStr = formatDate(date);
  return !holidays.includes(dateStr);
}

/**
 * Count the number of business days between two dates (inclusive).
 * @param startDate - Start date string in YYYY-MM-DD format
 * @param endDate - End date string in YYYY-MM-DD format
 * @param holidays - Array of holiday date strings in YYYY-MM-DD format
 */
export function countBusinessDays(
  startDate: string,
  endDate: string,
  holidays: string[] = [],
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;

  const current = new Date(start);
  while (current <= end) {
    if (isBusinessDay(current, holidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Format a Date object as a YYYY-MM-DD string.
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
