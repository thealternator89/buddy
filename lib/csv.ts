import Papa from 'papaparse';

export interface RawCsvRow {
  date?: string;
  description?: string;
  category?: string;
  payee?: string;
  notes?: string;
  account?: string;
  transferAccount?: string;
  amount?: string | number;
  [key: string]: unknown;
}

export interface ParsedCsvRow {
  rowIndex: number; // 1-based data row number (after header)
  date: string; // YYYY-MM-DD
  description: string | null;
  categoryName: string | null;
  payeeName: string | null;
  notes: string | null; // Description prepended to Notes with '\n\n' if present
  accountName: string;
  transferAccountName: string | null;
  isTransfer: boolean;
  amountCents: number; // Signed: positive for incoming to Account, negative for outgoing from Account
  rawAmount: string;
  error?: string;
}

export interface ParsedCategorySplit {
  category: string;
  amountCents: number;
  absAmountCents: number;
  rawAmount: string;
}

export interface CsvParseSummary {
  rows: ParsedCsvRow[];
  totalRows: number;
  validRows: ParsedCsvRow[];
  invalidRows: ParsedCsvRow[];
  transferCount: number;
  transactionCount: number;
  accounts: string[];
  categories: string[];
  payees: string[];
}

/**
 * Normalizes header names to standard keys.
 */
export function normalizeHeaderName(header: string): string {
  const clean = header.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (clean === 'date' || clean === 'txdate' || clean === 'transactiondate') return 'date';
  if (clean === 'description' || clean === 'desc') return 'description';
  if (clean === 'category') return 'category';
  if (clean === 'payee') return 'payee';
  if (clean === 'notes' || clean === 'note' || clean === 'memo') return 'notes';
  if (clean === 'account' || clean === 'sourceaccount') return 'account';
  if (
    clean === 'transferaccount' ||
    clean === 'transferto' ||
    clean === 'destinationaccount' ||
    clean === 'transfer'
  ) {
    return 'transferAccount';
  }
  if (clean === 'amount' || clean === 'total') return 'amount';
  return header.trim();
}

/**
 * Prepend description to notes (if present), separated by 2 LF ('\n\n').
 */
export function formatMergedNotes(
  description?: string | null,
  notes?: string | null
): string | null {
  const desc = description?.trim();
  const note = notes?.trim();

  if (desc && note) {
    return `${desc}\n\n${note}`;
  }
  if (desc) {
    return desc;
  }
  if (note) {
    return note;
  }
  return null;
}

/**
 * Parses user/export date string into standard 'YYYY-MM-DD'.
 */
export function parseCsvDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // YYYY/MM/DD or YYYY-MM-DD (optionally followed by time e.g. " 21:27:45" or "T...")
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or MM/DD/YYYY or D/M/YYYY (optionally followed by time)
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, p1, p2, year] = dmyMatch;
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);

    // If n1 > 12, it must be DD/MM/YYYY
    // If n2 > 12, it must be MM/DD/YYYY
    // Otherwise default to DD/MM/YYYY (en-NZ standard as configured in Buddy)
    let day = n1;
    let month = n2;
    if (n1 <= 12 && n2 > 12) {
      month = n1;
      day = n2;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Fallback to Date parser
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Parses monetary amount into integer cents.
 * Handles negative signs, accounting parentheses (100.00), and currency symbols.
 */
export function parseCsvAmount(raw: string | number | undefined | null): {
  cents: number;
  error?: string;
} {
  if (raw === undefined || raw === null) {
    return { cents: 0, error: 'Amount is required' };
  }
  if (typeof raw === 'number') {
    if (isNaN(raw)) return { cents: 0, error: 'Amount is not a valid number' };
    return { cents: Math.round(raw * 100) };
  }

  let str = String(raw).trim();
  if (!str) {
    return { cents: 0, error: 'Amount is empty' };
  }

  let isNegative = false;

  // Accounting parenthesis format: (123.45) or ($123.45)
  if (/^\(.*\)$/.test(str)) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  if (str.startsWith('-')) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.endsWith('-')) {
    isNegative = true;
    str = str.slice(0, -1).trim();
  }

  // Remove currency signs, commas, and spaces
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed)) {
    return { cents: 0, error: `Invalid amount format: "${raw}"` };
  }

  const cents = Math.round(parsed * 100);
  return { cents: isNegative ? -cents : cents };
}

/**
 * Parses multiple categories with amounts from a raw category string.
 * Example: "Entertainment (-$29.99), Entertainment Subscription (-$16.99)"
 * Returns an array of ParsedCategorySplit items.
 */
export function parseCategorySplits(raw: string): ParsedCategorySplit[] {
  if (!raw || !raw.trim()) return [];

  const splits: ParsedCategorySplit[] = [];
  // Matches "<CategoryName> (<Amount>)" followed by comma/semicolon or end of string.
  // The amount pattern requires at least one digit and allows currency symbols, signs, decimals, and commas.
  const regex = /(.*?)\s*\(([-+$€£¥A-Za-z\s]*\d[\d,.]*(?:\s*[A-Za-z]+)?)\)(?:\s*[,;]\s*|$)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const category = match[1].trim();
    const rawAmount = match[2].trim();

    // Guard against zero-length match loop
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }

    if (!category) continue;

    const amountResult = parseCsvAmount(rawAmount);
    if (!amountResult.error) {
      splits.push({
        category,
        amountCents: amountResult.cents,
        absAmountCents: Math.abs(amountResult.cents),
        rawAmount,
      });
    }
  }

  return splits;
}

/**
 * Resolves a raw category field from a CSV row into a single category name.
 * If multiple categories with amounts exist (e.g. "Entertainment (-$29.99), Entertainment Subscription (-$16.99)"),
 * selects the category with the highest absolute value.
 * Otherwise returns the trimmed category string or null if empty.
 */
export function parseCsvCategory(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const splits = parseCategorySplits(trimmed);
  if (splits.length > 0) {
    let best = splits[0];
    for (let i = 1; i < splits.length; i++) {
      if (splits[i].absAmountCents > best.absAmountCents) {
        best = splits[i];
      }
    }
    return best.category;
  }

  return trimmed;
}

/**
 * Parses CSV text content into structured, validated rows using PapaParse.
 */
export function parseCsv(csvContent: string): CsvParseSummary {
  const parsed = Papa.parse<RawCsvRow>(csvContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => normalizeHeaderName(header),
  });

  const parsedRows: ParsedCsvRow[] = [];
  const accountsSet = new Set<string>();
  const categoriesSet = new Set<string>();
  const payeesSet = new Set<string>();

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowIndex = i + 1;

    const rawDate = row.date ? String(row.date).trim() : '';
    const rawDescription = row.description ? String(row.description).trim() : '';
    const rawCategory = row.category ? String(row.category).trim() : '';
    const parsedCategory = parseCsvCategory(rawCategory);
    const rawPayee = row.payee ? String(row.payee).trim() : '';
    const rawNotes = row.notes ? String(row.notes).trim() : '';
    const rawAccount = row.account ? String(row.account).trim() : '';
    const rawTransferAccount = row.transferAccount ? String(row.transferAccount).trim() : '';
    const rawAmount = row.amount !== undefined && row.amount !== null ? String(row.amount).trim() : '';

    let error: string | undefined;

    // Validate Account
    if (!rawAccount) {
      error = 'Account is required';
    }

    // Parse Date
    const parsedDate = parseCsvDate(rawDate);
    if (!error && !parsedDate) {
      error = rawDate ? `Invalid date format: "${rawDate}"` : 'Date is required';
    }

    // Parse Amount
    const amountResult = parseCsvAmount(rawAmount);
    if (!error && amountResult.error) {
      error = amountResult.error;
    }

    const isTransfer = Boolean(rawTransferAccount);
    if (!error && isTransfer) {
      if (rawAccount.toLowerCase() === rawTransferAccount.toLowerCase()) {
        error = 'Source Account and Transfer Account cannot be the same';
      }
    }

    const mergedNotes = formatMergedNotes(rawDescription, rawNotes);

    // Amount is signed: positive for incoming to Account, negative for outgoing from Account
    const amountCents = amountResult.cents;

    if (rawAccount) accountsSet.add(rawAccount);
    if (rawTransferAccount) accountsSet.add(rawTransferAccount);
    if (parsedCategory) categoriesSet.add(parsedCategory);
    if (rawPayee) payeesSet.add(rawPayee);

    parsedRows.push({
      rowIndex,
      date: parsedDate || rawDate,
      description: rawDescription || null,
      categoryName: parsedCategory,
      payeeName: rawPayee || null,
      notes: mergedNotes,
      accountName: rawAccount,
      transferAccountName: rawTransferAccount || null,
      isTransfer,
      amountCents,
      rawAmount,
      error,
    });
  }

  const validRows = parsedRows.filter((r) => !r.error);
  const invalidRows = parsedRows.filter((r) => Boolean(r.error));

  // Count transfers by matching paired rows in the CSV
  const transferRows = validRows.filter((r) => r.isTransfer);
  const transactionCount = validRows.filter((r) => !r.isTransfer).length;

  const waitingPool: ParsedCsvRow[] = [];
  let transferPairsCount = 0;

  for (const row of transferRows) {
    const matchIdx = waitingPool.findIndex(
      (w) =>
        w.date === row.date &&
        w.accountName.toLowerCase() === row.transferAccountName?.toLowerCase() &&
        w.transferAccountName?.toLowerCase() === row.accountName.toLowerCase() &&
        w.amountCents === -row.amountCents
    );

    if (matchIdx !== -1) {
      waitingPool.splice(matchIdx, 1);
      transferPairsCount += 1;
    } else {
      waitingPool.push(row);
    }
  }

  // Total transfer events = matched pairs + any unpaired transfer rows
  const transferCount = transferPairsCount + waitingPool.length;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows,
    invalidRows,
    transferCount,
    transactionCount,
    accounts: Array.from(accountsSet),
    categories: Array.from(categoriesSet),
    payees: Array.from(payeesSet),
  };
}
