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
