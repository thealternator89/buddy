export type ScheduledFrequency =
  | 'once'
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export const FREQUENCY_OPTIONS: { value: ScheduledFrequency; label: string; shortLabel: string }[] = [
  { value: 'weekly', label: 'Weekly', shortLabel: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly (Every 2 weeks)', shortLabel: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly', shortLabel: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (Every 3 months)', shortLabel: 'Quarterly' },
  { value: 'yearly', label: 'Yearly', shortLabel: 'Yearly' },
  { value: 'once', label: 'One-off (Once)', shortLabel: 'Once' },
];

export const FREQUENCY_LABELS: Record<ScheduledFrequency, string> = {
  once: 'Once',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
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

function addMonthsClamped(
  year: number,
  month: number,
  day: number,
  monthsToAdd: number,
  anchorDay?: number
): string {
  const totalMonths = year * 12 + (month - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const desiredDay = anchorDay ?? day;
  const maxDay = getDaysInMonth(targetYear, targetMonth);
  const finalDay = Math.min(desiredDay, maxDay);
  return formatIsoDate(targetYear, targetMonth, finalDay);
}

/**
 * Calculates the next due date from `currentDueDate` according to `frequency`.
 * Returns `null` if frequency is `'once'` (no subsequent occurrence).
 */
export function calculateNextDueDate(
  currentDueDate: string,
  frequency: ScheduledFrequency,
  anchorStartDate?: string
): string | null {
  if (frequency === 'once') {
    return null;
  }

  const { year, month, day } = parseIsoDate(currentDueDate);
  const anchorDay = anchorStartDate ? parseIsoDate(anchorStartDate).day : day;

  if (frequency === 'weekly' || frequency === 'fortnightly') {
    const daysToAdd = frequency === 'weekly' ? 7 : 14;
    const utc = new Date(Date.UTC(year, month - 1, day + daysToAdd));
    return formatIsoDate(
      utc.getUTCFullYear(),
      utc.getUTCMonth() + 1,
      utc.getUTCDate()
    );
  }

  if (frequency === 'monthly') {
    return addMonthsClamped(year, month, day, 1, anchorDay);
  }

  if (frequency === 'quarterly') {
    return addMonthsClamped(year, month, day, 3, anchorDay);
  }

  if (frequency === 'yearly') {
    return addMonthsClamped(year, month, day, 12, anchorDay);
  }

  return null;
}

export function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type DueStatusType = 'overdue' | 'due_today' | 'upcoming';

export interface DueStatusInfo {
  status: DueStatusType;
  isDue: boolean; // true if overdue or due_today
  daysDiff: number; // negative if overdue, 0 if today, positive if upcoming
  label: string;
}

export function getScheduledDueStatus(
  nextDueDate: string,
  todayStr: string = getLocalTodayIso()
): DueStatusInfo {
  const due = parseIsoDate(nextDueDate);
  const today = parseIsoDate(todayStr);

  const dueMs = Date.UTC(due.year, due.month - 1, due.day);
  const todayMs = Date.UTC(today.year, today.month - 1, today.day);
  const daysDiff = Math.round((dueMs - todayMs) / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    const overdueDays = Math.abs(daysDiff);
    return {
      status: 'overdue',
      isDue: true,
      daysDiff,
      label: overdueDays === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueDays} days`,
    };
  }

  if (daysDiff === 0) {
    return {
      status: 'due_today',
      isDue: true,
      daysDiff: 0,
      label: 'Due today',
    };
  }

  return {
    status: 'upcoming',
    isDue: false,
    daysDiff,
    label: daysDiff === 1 ? 'Due tomorrow' : `In ${daysDiff} days`,
  };
}
