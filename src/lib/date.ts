/**
 * Date formatting helpers that treat date-only inputs as UTC calendar dates,
 * ensuring consistent display across all build environments regardless of process timezone.
 */

/**
 * Format a date as a short month string (e.g., "Jun 10, 2026") in UTC.
 * Used by BuildLogCard for compact display.
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format a date as a long month string (e.g., "June 10, 2026") in UTC.
 * Used by individual post pages for full display.
 */
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Get the ISO 8601 date string (YYYY-MM-DD) in UTC for use in <time datetime>.
 * This preserves the calendar date regardless of timezone.
 */
export function formatDateTimeISO(date: Date): string {
  // Use UTC components to avoid timezone shift
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
