import { APP_CONFIG } from '../constants';

/**
 * Formats integer cents into a localized currency string.
 * Example: 2550 -> "$25.50" or "-$25.50"
 */
export function formatCurrency(
  cents: number,
  options?: {
    showSign?: boolean;
    compact?: boolean;
  }
): string {
  const dollars = cents / 100;
  const formatted = new Intl.NumberFormat(APP_CONFIG.currency.locale, {
    style: 'currency',
    currency: APP_CONFIG.currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: options?.showSign ? 'always' : 'auto',
  }).format(dollars);

  return formatted;
}

/**
 * Parses a user input string (e.g., "25.50" or "$25.50") into integer cents.
 */
export function parseToCents(amountStr: string | number): number {
  if (typeof amountStr === 'number') {
    return Math.round(amountStr * 100);
  }
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}
