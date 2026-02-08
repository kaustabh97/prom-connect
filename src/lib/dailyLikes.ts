/** Daily like limit for men (women and non-binary have unlimited). */
export const DAILY_LIKE_LIMIT = 10;

/** IST timezone identifier. */
export const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Returns true if the user has a daily like limit (men only).
 * Women and non-binary have unlimited likes.
 */
export function hasDailyLikeLimit(gender: string | undefined | null): boolean {
  return gender === "Man";
}

/**
 * Returns start and end of today in IST as ISO date strings for comparison.
 * Uses Intl for accurate IST date boundaries.
 */
export function getTodayISTBounds(): { start: Date; end: Date } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const istDateStr = formatter.format(now); // "YYYY-MM-DD"
  const start = new Date(`${istDateStr}T00:00:00+05:30`);
  const end = new Date(`${istDateStr}T23:59:59.999+05:30`);
  return { start, end };
}

/**
 * Returns true if the given createdAt (ISO string) falls within today IST.
 */
export function isWithinTodayIST(createdAt: string | undefined | null): boolean {
  if (!createdAt) return false;
  const date = new Date(createdAt);
  const { start, end } = getTodayISTBounds();
  return date >= start && date <= end;
}
