'use client';

import { useSyncExternalStore } from 'react';
import { TIMEZONE_COOKIE_NAME } from '@/lib/constants';
import { getLocalTodayIso } from './scheduled';

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
 * Returns the browser's resolved IANA time zone identifier when running on the client.
 */
export function getBrowserTimeZone(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes the browser's current IANA time zone into the `buddy_tz` cookie.
 * Returns the detected time zone string if set.
 */
export function writeBrowserTimeZoneCookie(): string | undefined {
  const tz = getBrowserTimeZone();
  if (!tz || typeof document === 'undefined') return undefined;
  document.cookie = `${TIMEZONE_COOKIE_NAME}=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax`;
  return tz;
}

function subscribeToVisibilityAndFocus(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      onStoreChange();
    }
  };
  window.addEventListener('focus', onStoreChange);
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    window.removeEventListener('focus', onStoreChange);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

/**
 * React hook that returns today's `YYYY-MM-DD` string in the browser's timezone on the client,
 * while matching the server-rendered snapshot during initial hydration to prevent hydration mismatches.
 */
export function useBrowserTodayIso(serverTodayStr?: string): string {
  return useSyncExternalStore(
    subscribeToVisibilityAndFocus,
    () => getLocalTodayIso(),
    () => serverTodayStr ?? getLocalTodayIso()
  );
}
