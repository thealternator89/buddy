import { cookies } from 'next/headers';
import { TIMEZONE_COOKIE_NAME } from '@/lib/constants';

/**
 * Checks whether a string is a valid IANA time zone identifier.
 */
export function isValidTimeZone(timeZone: string | undefined | null): timeZone is string {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats the given Date (defaults to `new Date()`) as an ISO date string (`YYYY-MM-DD`)
 * in the specified IANA `timeZone`. Falls back to the runtime's local timezone if `timeZone`
 * is omitted or invalid.
 */
export function getTodayIsoInTimeZone(
  timeZone?: string | null,
  now: Date = new Date()
): string {
  if (isValidTimeZone(timeZone)) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now);

      const year = parts.find((p) => p.type === 'year')?.value;
      const month = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;

      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    } catch {
      // Fallback below
    }
  }

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Reads the browser's synced IANA time zone from the `buddy_tz` request cookie
 * (if present and valid).
 */
export async function getServerTimeZone(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(TIMEZONE_COOKIE_NAME)?.value;
    if (!raw) return undefined;
    const decoded = decodeURIComponent(raw);
    return isValidTimeZone(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Computes today's `YYYY-MM-DD` date string on the server using the browser's
 * synced time zone cookie (`buddy_tz`), falling back to the server's local date
 * if no cookie is available yet.
 */
export async function getServerTodayIso(): Promise<string> {
  const tz = await getServerTimeZone();
  return getTodayIsoInTimeZone(tz);
}
