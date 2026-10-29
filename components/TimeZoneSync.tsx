'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserTimeZone, writeBrowserTimeZoneCookie } from '@/lib/utils/timezone';

interface TimeZoneSyncProps {
  serverTimeZone?: string;
}

/**
 * Keeps the `buddy_tz` cookie synchronized with the browser's IANA time zone.
 * If the server rendered without the cookie or with a stale time zone, triggers
 * `router.refresh()` so server-rendered budgets and queries re-evaluate in the browser's TZ.
 */
export function TimeZoneSync({ serverTimeZone }: TimeZoneSyncProps) {
  const router = useRouter();

  useEffect(() => {
    const sync = (currentServerTz?: string) => {
      const browserTz = getBrowserTimeZone();
      if (!browserTz) return;
      writeBrowserTimeZoneCookie();
      if (currentServerTz !== browserTz) {
        router.refresh();
      }
    };

    sync(serverTimeZone);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const browserTz = getBrowserTimeZone();
        if (browserTz) {
          writeBrowserTimeZoneCookie();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [serverTimeZone, router]);

  return null;
}
