'use server';

import { db } from '@/lib/db';
import { accounts, categories, payees, transactions, payeeRules } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { parseCsv, parseCsvCategory, ParsedCsvRow } from '@/lib/csv';
import { resolvePayeeCategory, PayeeRuleItem, RuleOperator } from '@/lib/payee-rules';
import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore outside request context
  }
}

export interface CsvImportResult {
  success: boolean;
  totalRows: number;
  importedTransactions: number;
  importedTransfers: number;
  createdAccounts: string[];
  createdCategories: string[];
  createdPayees: string[];
  errors: { row: number; message: string }[];
  errorMessage?: string;
}

export async function importCsvTransactions(csvContent: string): Promise<CsvImportResult> {
  const user = await requireUser();
  const parseSummary = parseCsv(csvContent);

  if (parseSummary.totalRows === 0) {
    return {
      success: false,
      totalRows: 0,
      importedTransactions: 0,
      importedTransfers: 0,
      createdAccounts: [],
      createdCategories: [],
      createdPayees: [],
      errors: [],
      errorMessage: 'The uploaded CSV file is empty.',
    };
  }

  if (parseSummary.validRows.length === 0) {
    return {
      success: false,
      totalRows: parseSummary.totalRows,
      importedTransactions: 0,
      importedTransfers: 0,
      createdAccounts: [],
      createdCategories: [],
      createdPayees: [],
      errors: parseSummary.invalidRows.map((r) => ({
        row: r.rowIndex,
        message: r.error || 'Invalid row',
      })),
      errorMessage: 'No valid rows could be parsed from the CSV file.',
    };
  }

  // 1. Preload existing entities for this user for O(1) case-insensitive lookups
  const existingAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      sortOrder: accounts.sortOrder,
    })
    .from(accounts)
    .where(eq(accounts.userId, user.id));

  const existingCategories = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(eq(categories.userId, user.id));

  const existingPayees = await db
    .select({
      id: payees.id,
      name: payees.name,
      defaultCategoryId: payees.defaultCategoryId,
      priority: payees.priority,
    })
    .from(payees)
    .where(eq(payees.userId, user.id));

  const allRules = await db
    .select({
      id: payeeRules.id,
      payeeId: payeeRules.payeeId,
      categoryId: payeeRules.categoryId,
      operator: payeeRules.operator,
      amountCents: payeeRules.amountCents,
      sortOrder: payeeRules.sortOrder,
    })
    .from(payeeRules)
    .where(eq(payeeRules.userId, user.id))
    .orderBy(asc(payeeRules.sortOrder), asc(payeeRules.amountCents));

  // In-memory maps
  const accountMap = new Map<string, { id: string; name: string }>();
  let maxAccountOrder = 0;
  for (const acc of existingAccounts) {
    accountMap.set(acc.name.toLowerCase(), { id: acc.id, name: acc.name });
    if (acc.sortOrder > maxAccountOrder) maxAccountOrder = acc.sortOrder;
  }

  const categoryMap = new Map<string, { id: string; name: string }>();
  let maxCategoryOrder = 0;
  for (const cat of existingCategories) {
    categoryMap.set(cat.name.toLowerCase(), { id: cat.id, name: cat.name });
    if (!cat.parentId && cat.sortOrder > maxCategoryOrder) {
      maxCategoryOrder = cat.sortOrder;
    }
  }

  const payeeMap = new Map<
    string,
    { id: string; name: string; defaultCategoryId: string | null }
  >();
  for (const p of existingPayees) {
    payeeMap.set(p.name.toLowerCase(), {
      id: p.id,
      name: p.name,
      defaultCategoryId: p.defaultCategoryId,
    });
  }

  const payeeRulesMap = new Map<string, PayeeRuleItem[]>();
  for (const r of allRules) {
    const list = payeeRulesMap.get(r.payeeId) || [];
    list.push({
      id: r.id,
      payeeId: r.payeeId,
      categoryId: r.categoryId,
      operator: r.operator as RuleOperator,
      amountCents: r.amountCents,
      sortOrder: r.sortOrder,
    });
    payeeRulesMap.set(r.payeeId, list);
  }

  const createdAccounts = new Set<string>();
  const createdCategories = new Set<string>();
  const createdPayees = new Set<string>();
  const runtimeErrors: { row: number; message: string }[] = [];

  let importedTransactions = 0;
  let importedTransfers = 0;

  // Separate transfers and standard transactions
  const transferRows = parseSummary.validRows.filter((r) => r.isTransfer);
  const standardRows = parseSummary.validRows.filter((r) => !r.isTransfer);

  // Match paired transfer rows within the CSV
  interface MatchedTransferPair {
    outRow: ParsedCsvRow; // outflow leg (amountCents < 0)
    inRow: ParsedCsvRow; // inflow leg (amountCents > 0)
  }

  const matchedPairs: MatchedTransferPair[] = [];
  const waitingTransfers: ParsedCsvRow[] = [];

  for (const row of transferRows) {
    const matchIdx = waitingTransfers.findIndex(
      (w) =>
        w.date === row.date &&
        w.accountName.toLowerCase() === row.transferAccountName?.toLowerCase() &&
        w.transferAccountName?.toLowerCase() === row.accountName.toLowerCase() &&
        w.amountCents === -row.amountCents
    );

    if (matchIdx !== -1) {
      const partner = waitingTransfers.splice(matchIdx, 1)[0];
      if (row.amountCents < 0) {
        matchedPairs.push({ outRow: row, inRow: partner });
      } else {
        matchedPairs.push({ outRow: partner, inRow: row });
      }
    } else {
      waitingTransfers.push(row);
    }
  }

  // Execute import atomically inside a single PostgreSQL transaction
  await db.transaction(async (tx) => {
    // Helper: get or create account
    async function getOrCreateAccount(name: string): Promise<string> {
      const trimmed = name.trim();
      const key = trimmed.toLowerCase();
      const existing = accountMap.get(key);
      if (existing) return existing.id;

      const id = crypto.randomUUID();
      maxAccountOrder += 1;

      await tx.insert(accounts).values({
        id,
        userId: user.id,
        name: trimmed,
        type: 'checking',
        groupId: null,
        icon: 'wallet',
        sortOrder: maxAccountOrder,
        excludeFromNetWorth: false,
        isArchived: false,
      });

      accountMap.set(key, { id, name: trimmed });
      createdAccounts.add(trimmed);
      return id;
    }

    // Helper: get or create category
    async function getOrCreateCategory(name: string): Promise<string> {
      const trimmed = name.trim();
      const key = trimmed.toLowerCase();
      const existing = categoryMap.get(key);
      if (existing) return existing.id;

      const id = crypto.randomUUID();
      maxCategoryOrder += 1;

      await tx.insert(categories).values({
        id,
        userId: user.id,
        name: trimmed,
        parentId: null,
        sortOrder: maxCategoryOrder,
        isArchived: false,
      });

      categoryMap.set(key, { id, name: trimmed });
      createdCategories.add(trimmed);
      return id;
    }

    // Helper: get or create payee
    async function getOrCreatePayee(
      name: string,
      defaultCategoryId?: string | null
    ): Promise<string> {
      const trimmed = name.trim();
      const key = trimmed.toLowerCase();
      const existing = payeeMap.get(key);
      if (existing) {
        if (defaultCategoryId && !existing.defaultCategoryId) {
          await tx
            .update(payees)
            .set({ defaultCategoryId })
            .where(and(eq(payees.id, existing.id), eq(payees.userId, user.id)));
          existing.defaultCategoryId = defaultCategoryId;
        }
        return existing.id;
      }

      const id = crypto.randomUUID();
      await tx.insert(payees).values({
        id,
        userId: user.id,
        name: trimmed,
        defaultCategoryId: defaultCategoryId || null,
        priority: 1,
      });

      payeeMap.set(key, { id, name: trimmed, defaultCategoryId: defaultCategoryId || null });
      createdPayees.add(trimmed);
      return id;
    }

    // 1. Process matched transfer pairs
    for (const pair of matchedPairs) {
      try {
        const sourceAccountId = await getOrCreateAccount(pair.outRow.accountName);
        const destAccountId = await getOrCreateAccount(pair.inRow.accountName);

        if (sourceAccountId === destAccountId) {
          runtimeErrors.push({
            row: pair.outRow.rowIndex,
            message: 'Source and Transfer Account cannot resolve to the same account',
          });
          continue;
        }

        const sourceTxId = crypto.randomUUID();
        const destTxId = crypto.randomUUID();

        // Outflow from source account (amountCents is negative)
        await tx.insert(transactions).values({
          id: sourceTxId,
          userId: user.id,
          accountId: sourceAccountId,
          amountCents: pair.outRow.amountCents,
          date: pair.outRow.date,
          notes: pair.outRow.notes,
          isCleared: true,
          transferId: destTxId,
        });

        // Inflow to destination account (amountCents is positive)
        await tx.insert(transactions).values({
          id: destTxId,
          userId: user.id,
          accountId: destAccountId,
          amountCents: pair.inRow.amountCents,
          date: pair.inRow.date,
          notes: pair.inRow.notes || pair.outRow.notes,
          isCleared: true,
          transferId: sourceTxId,
        });

        importedTransfers += 1;
      } catch (err: unknown) {
        runtimeErrors.push({
          row: pair.outRow.rowIndex,
          message: err instanceof Error ? err.message : 'Unknown database error',
        });
      }
    }

    // 2. Process any unpaired transfer rows (complete the transfer on the transfer account)
    for (const row of waitingTransfers) {
      try {
        const accountId = await getOrCreateAccount(row.accountName);
        const counterpartAccountId = await getOrCreateAccount(row.transferAccountName!);

        if (accountId === counterpartAccountId) {
          runtimeErrors.push({
            row: row.rowIndex,
            message: 'Source and Transfer Account cannot resolve to the same account',
          });
          continue;
        }

        const thisTxId = crypto.randomUUID();
        const counterpartTxId = crypto.randomUUID();
        const counterpartAmountCents = -row.amountCents;

        await tx.insert(transactions).values({
          id: thisTxId,
          userId: user.id,
          accountId,
          amountCents: row.amountCents,
          date: row.date,
          notes: row.notes,
          isCleared: true,
          transferId: counterpartTxId,
        });

        await tx.insert(transactions).values({
          id: counterpartTxId,
          userId: user.id,
          accountId: counterpartAccountId,
          amountCents: counterpartAmountCents,
          date: row.date,
          notes: row.notes,
          isCleared: true,
          transferId: thisTxId,
        });

        importedTransfers += 1;
      } catch (err: unknown) {
        runtimeErrors.push({
          row: row.rowIndex,
          message: err instanceof Error ? err.message : 'Unknown database error',
        });
      }
    }

    // 3. Process standard transactions
    for (const row of standardRows) {
      try {
        const accountId = await getOrCreateAccount(row.accountName);

        let categoryId: string | null = null;
        if (row.categoryName) {
          const resolvedCategory = parseCsvCategory(row.categoryName) || row.categoryName;
          categoryId = await getOrCreateCategory(resolvedCategory);
        }

        let payeeId: string | null = null;
        if (row.payeeName) {
          payeeId = await getOrCreatePayee(row.payeeName, categoryId);

          // If no category was explicitly provided in the CSV, check payee rules / default category
          if (!categoryId) {
            const payeeData = payeeMap.get(row.payeeName.toLowerCase());
            const rules = payeeRulesMap.get(payeeId) || [];
            const match = resolvePayeeCategory(
              {
                id: payeeId,
                name: row.payeeName,
                defaultCategoryId: payeeData?.defaultCategoryId || null,
                rules,
              },
              row.amountCents
            );
            if (match) {
              categoryId = match.categoryId;
            }
          }
        }

        await tx.insert(transactions).values({
          id: crypto.randomUUID(),
          userId: user.id,
          accountId,
          payeeId,
          categoryId,
          amountCents: row.amountCents,
          date: row.date,
          notes: row.notes,
          isCleared: true,
        });

        importedTransactions += 1;
      } catch (err: unknown) {
        runtimeErrors.push({
          row: row.rowIndex,
          message: err instanceof Error ? err.message : 'Unknown database error',
        });
      }
    }
  });

  // Revalidate application cache paths
  safeRevalidatePath('/');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/manage');

  const allErrors = [
    ...parseSummary.invalidRows.map((r) => ({
      row: r.rowIndex,
      message: r.error || 'Invalid row',
    })),
    ...runtimeErrors,
  ];

  return {
    success: importedTransactions > 0 || importedTransfers > 0,
    totalRows: parseSummary.totalRows,
    importedTransactions,
    importedTransfers,
    createdAccounts: Array.from(createdAccounts),
    createdCategories: Array.from(createdCategories),
    createdPayees: Array.from(createdPayees),
    errors: allErrors,
  };
}
