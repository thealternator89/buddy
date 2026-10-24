import { BudgetFrequency } from '@/lib/db/schema';
import { getLocalTodayIso } from './scheduled';

export type { BudgetFrequency };

export const BUDGET_FREQUENCY_OPTIONS: {
  value: BudgetFrequency;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    value: 'weekly',
    label: 'Weekly',
    shortLabel: 'Weekly',
    description: 'Monday – Sunday each week',
  },
  {
    value: 'monthly',
    label: 'Monthly',
    shortLabel: 'Monthly',
    description: '1st – last day of each month',
  },
  {
    value: 'yearly',
    label: 'Yearly',
    shortLabel: 'Yearly',
    description: 'Jan 1 – Dec 31 each year',
  },
];

export const BUDGET_FREQUENCY_LABELS: Record<BudgetFrequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

function parseIsoDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return { year: y, month: m, day: d };
}

function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface BudgetPeriodRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string; // e.g. "Oct 19 – Oct 25", "October 2026", "2026"
}

/**
 * Computes the current calendar period range (startDate, endDate, and human-friendly label)
 * for a given budget frequency based on `todayStr` (YYYY-MM-DD):
 * - 'weekly': Monday through Sunday of the current week
 * - 'monthly': 1st through last day of the current month
 * - 'yearly': Jan 1 through Dec 31 of the current year
 */
export function getBudgetPeriodRange(
  frequency: BudgetFrequency,
  todayStr: string = getLocalTodayIso()
): BudgetPeriodRange {
  const { year, month, day } = parseIsoDate(todayStr);

  if (frequency === 'weekly') {
    const currentUtc = new Date(Date.UTC(year, month - 1, day));
    const dow = currentUtc.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const mondayOffset = dow === 0 ? 6 : dow - 1;

    const mondayUtc = new Date(Date.UTC(year, month - 1, day - mondayOffset));
    const sundayUtc = new Date(Date.UTC(year, month - 1, day - mondayOffset + 6));

    const startDate = formatIsoDate(
      mondayUtc.getUTCFullYear(),
      mondayUtc.getUTCMonth() + 1,
      mondayUtc.getUTCDate()
    );
    const endDate = formatIsoDate(
      sundayUtc.getUTCFullYear(),
      sundayUtc.getUTCMonth() + 1,
      sundayUtc.getUTCDate()
    );

    const startLabel = mondayUtc.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    });
    const endLabel = sundayUtc.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    });

    return {
      startDate,
      endDate,
      label: `${startLabel} – ${endLabel}`,
    };
  }

  if (frequency === 'monthly') {
    const maxDay = getDaysInMonth(year, month);
    const startDate = formatIsoDate(year, month, 1);
    const endDate = formatIsoDate(year, month, maxDay);
    const monthObj = new Date(Date.UTC(year, month - 1, 1));
    const label = monthObj.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    });

    return {
      startDate,
      endDate,
      label,
    };
  }

  // yearly
  const startDate = formatIsoDate(year, 1, 1);
  const endDate = formatIsoDate(year, 12, 31);
  return {
    startDate,
    endDate,
    label: String(year),
  };
}

export interface BudgetPeriodProgress {
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;
  percentElapsed: number; // 0 to 100
  daysRemainingLabel: string;
}

/**
 * Computes period progress and days remaining for a budget period:
 * - totalDays: total number of calendar days in the period
 * - daysElapsed: 1-based count of days elapsed through today (e.g. Day 6 of 7)
 * - daysRemaining: calendar days remaining in the period inclusive of today (e.g. 2 days on Sat, 1 on Sun)
 * - percentElapsed: integer 0-100 indicating percentage of period elapsed
 * - daysRemainingLabel: human-friendly label (e.g. "5 days remaining", "1 day remaining")
 */
export function getBudgetPeriodProgress(
  period: BudgetPeriodRange,
  todayStr: string = getLocalTodayIso()
): BudgetPeriodProgress {
  const { year: sy, month: sm, day: sd } = parseIsoDate(period.startDate);
  const { year: ey, month: em, day: ed } = parseIsoDate(period.endDate);
  const { year: ty, month: tm, day: td } = parseIsoDate(todayStr);

  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  const todayUtc = Date.UTC(ty, tm - 1, td);

  const totalDays = Math.max(1, Math.round((endUtc - startUtc) / 86400000) + 1);

  if (todayUtc < startUtc) {
    return {
      totalDays,
      daysElapsed: 0,
      daysRemaining: totalDays,
      percentElapsed: 0,
      daysRemainingLabel: `${totalDays} days remaining`,
    };
  }

  if (todayUtc > endUtc) {
    return {
      totalDays,
      daysElapsed: totalDays,
      daysRemaining: 0,
      percentElapsed: 100,
      daysRemainingLabel: '0 days remaining',
    };
  }

  // today is within the budget period
  const diffToEnd = Math.round((endUtc - todayUtc) / 86400000);
  const daysRemaining = diffToEnd + 1; // inclusive of today
  const daysElapsed = Math.min(totalDays, Math.max(1, totalDays - daysRemaining + 1));
  const percentElapsed = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));

  const daysRemainingLabel =
    daysRemaining === 1 ? '1 day remaining' : `${daysRemaining} days remaining`;

  return {
    totalDays,
    daysElapsed,
    daysRemaining,
    percentElapsed,
    daysRemainingLabel,
  };
}

/**
 * Converts an ISO date string (YYYY-MM-DD) into a UTC Date at 00:00:00.000Z.
 */
export function isoDateToUtcStartOfDay(dateStr: string): Date {
  const { year, month, day } = parseIsoDate(dateStr);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Returns the ISO date string (YYYY-MM-DD) of the day immediately preceding `dateStr`.
 */
export function getPreviousIsoDate(dateStr: string): string {
  const { year, month, day } = parseIsoDate(dateStr);
  const prevUtc = new Date(Date.UTC(year, month - 1, day - 1));
  return formatIsoDate(
    prevUtc.getUTCFullYear(),
    prevUtc.getUTCMonth() + 1,
    prevUtc.getUTCDate()
  );
}

/**
 * Returns a UTC Date representing the end of the day immediately preceding `dateStr`
 * (i.e. previous day at 23:59:59.999Z).
 */
export function isoDateToUtcEndOfPreviousDay(dateStr: string): Date {
  const { year, month, day } = parseIsoDate(dateStr);
  return new Date(Date.UTC(year, month - 1, day - 1, 23, 59, 59, 999));
}

/**
 * Formats a Date object as a UTC ISO date string (YYYY-MM-DD).
 */
export function toUtcIsoDateString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatIsoDate(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate()
  );
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human-friendly short date (e.g. "Oct 1, 2026").
 */
export function formatShortIsoDate(dateStr: string): string {
  const { year, month, day } = parseIsoDate(dateStr);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
