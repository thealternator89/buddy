import { TransactionWithDetails } from '@/lib/actions/transactions';
import { getLocalTodayIso } from './scheduled';

export interface DateGroupedTransactions {
  dateKey: string;
  label: string;
  transactions: TransactionWithDetails[];
}

/**
 * Converts an ISO date string (YYYY-MM-DD) into a friendly display label:
 * - "Today"
 * - "Yesterday"
 * - "Wed, 21 Oct" (if current year)
 * - "21 Oct 2025" (if previous year)
 */
export function formatTransactionGroupDate(
  dateStr: string,
  todayStr: string = getLocalTodayIso()
): string {
  if (dateStr === todayStr) {
    return 'Today';
  }

  // Calculate yesterday's ISO date string
  const [ty, tm, td] = todayStr.split('-').map((n) => parseInt(n, 10));
  const todayDate = new Date(Date.UTC(ty, tm - 1, td));
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yStr = `${yesterdayDate.getUTCFullYear()}-${String(
    yesterdayDate.getUTCMonth() + 1
  ).padStart(2, '0')}-${String(yesterdayDate.getUTCDate()).padStart(2, '0')}`;

  if (dateStr === yStr) {
    return 'Yesterday';
  }

  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  const isCurrentYear = y === ty;

  return dateObj.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Groups an array of transactions chronologically by their `date` field.
 * Preserves the input array ordering within and across groups.
 */
export function groupTransactionsByDate(
  transactions: TransactionWithDetails[]
): DateGroupedTransactions[] {
  const groupsMap = new Map<string, TransactionWithDetails[]>();

  for (const tx of transactions) {
    const list = groupsMap.get(tx.date) || [];
    list.push(tx);
    groupsMap.set(tx.date, list);
  }

  const result: DateGroupedTransactions[] = [];
  const todayStr = getLocalTodayIso();

  groupsMap.forEach((txList, dateKey) => {
    result.push({
      dateKey,
      label: formatTransactionGroupDate(dateKey, todayStr),
      transactions: txList,
    });
  });

  return result;
}
