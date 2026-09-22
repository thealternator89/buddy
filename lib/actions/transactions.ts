'use server';

import { db } from '@/lib/db';
import { accounts, categories, payees, transactions, payeeRules } from '@/lib/db/schema';
import { getOrCreatePayee } from './payees';
import { getCategorySubtreeIds } from './categories';
import { resolvePayeeCategory, RuleOperator } from '@/lib/payee-rules';
import { and, asc, desc, eq, gte, inArray, like, lte, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore outside request context
  }
}

export interface TransactionWithDetails {
  id: string;
  accountId: string;
  accountName: string;
  payeeId: string | null;
  payeeName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  parentCategoryName: string | null;
  amountCents: number;
  date: string;
  notes: string | null;
  isCleared: boolean;
  transferId: string | null;
  transferAccountId?: string | null;
  transferAccountName?: string | null;
  createdAt: Date;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  payeeId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTransactionsResult {
  transactions: TransactionWithDetails[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    totalAmountCents: number;
  };
}

export async function getPaginatedTransactions(
  filters: TransactionFilters = {}
): Promise<PaginatedTransactionsResult> {
  const conditions: (SQL | undefined)[] = [];

  if (filters.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.categoryId) {
    const subtreeIds = await getCategorySubtreeIds(filters.categoryId);
    if (subtreeIds.length > 0) {
      conditions.push(inArray(transactions.categoryId, subtreeIds));
    }
  }
  if (filters.payeeId) {
    conditions.push(eq(transactions.payeeId, filters.payeeId));
  }
  if (filters.startDate) {
    conditions.push(gte(transactions.date, filters.startDate));
  }
  if (filters.endDate) {
    conditions.push(lte(transactions.date, filters.endDate));
  }

  const parentCategories = alias(categories, 'parent_categories');

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        like(transactions.notes, term),
        like(accounts.name, term),
        like(payees.name, term),
        like(categories.name, term),
        like(parentCategories.name, term)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 1. Get total count and aggregate net total for all matching items
  const countQuery = db
    .select({
      count: sql<number>`count(*)`,
      totalAmountCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(payees, eq(transactions.payeeId, payees.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id));

  const countResult = whereClause
    ? await countQuery.where(whereClause)
    : await countQuery;

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalAmountCents = Number(countResult[0]?.totalAmountCents ?? 0);

  const pageSize = filters.pageSize || filters.limit || 100;
  const rawPage = filters.page || 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, rawPage), totalPages);
  const offset = filters.offset !== undefined ? filters.offset : (page - 1) * pageSize;

  // 2. Base query with joins
  const dataQuery = db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      accountName: accounts.name,
      payeeId: transactions.payeeId,
      payeeName: payees.name,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      parentCategoryName: parentCategories.name,
      amountCents: transactions.amountCents,
      date: transactions.date,
      notes: transactions.notes,
      isCleared: transactions.isCleared,
      transferId: transactions.transferId,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(payees, eq(transactions.payeeId, payees.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(pageSize)
    .offset(offset);

  const results = whereClause
    ? await dataQuery.where(whereClause)
    : await dataQuery;

  // Identify transfer counterpart accounts
  const transferIds = results
    .map((t) => t.transferId)
    .filter((id): id is string => Boolean(id));

  const transferAccountMap = new Map<string, { accountId: string; accountName: string }>();
  if (transferIds.length > 0) {
    const pairedTxs = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        accountName: accounts.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(sql`${transactions.id} IN ${transferIds}`);

    for (const pt of pairedTxs) {
      transferAccountMap.set(pt.id, {
        accountId: pt.accountId,
        accountName: pt.accountName,
      });
    }
  }

  const mappedTransactions = results.map((tx) => {
    const counterpart = tx.transferId ? transferAccountMap.get(tx.transferId) : null;
    return {
      ...tx,
      transferAccountId: counterpart ? counterpart.accountId : null,
      transferAccountName: counterpart ? counterpart.accountName : null,
    };
  });

  return {
    transactions: mappedTransactions,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
    summary: {
      totalAmountCents,
    },
  };
}

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<TransactionWithDetails[]> {
  const result = await getPaginatedTransactions({
    ...filters,
    pageSize: filters.limit ?? 100,
  });
  return result.transactions;
}

export type CreateTransactionInput =
  | {
      isTransfer: false;
      accountId: string;
      payeeName: string;
      categoryId?: string | null;
      amountCents: number; // positive for income, negative for expense
      date: string;
      notes?: string;
      isCleared?: boolean;
    }
  | {
      isTransfer: true;
      sourceAccountId: string;
      destinationAccountId: string;
      amountCents: number; // positive amount transferred
      date: string;
      notes?: string;
      isCleared?: boolean;
    };

export async function createTransaction(input: CreateTransactionInput) {
  if (input.isTransfer) {
    if (input.sourceAccountId === input.destinationAccountId) {
      throw new Error('Source and destination accounts must be different for transfers');
    }

    const absAmount = Math.abs(input.amountCents);
    const sourceTxId = crypto.randomUUID();
    const destTxId = crypto.randomUUID();

    // Source Outflow
    db.insert(transactions)
      .values({
        id: sourceTxId,
        accountId: input.sourceAccountId,
        amountCents: -absAmount,
        date: input.date,
        notes: input.notes || null,
        isCleared: input.isCleared ?? true,
        transferId: destTxId,
      })
      .run();

    // Destination Inflow
    db.insert(transactions)
      .values({
        id: destTxId,
        accountId: input.destinationAccountId,
        amountCents: absAmount,
        date: input.date,
        notes: input.notes || null,
        isCleared: input.isCleared ?? true,
        transferId: sourceTxId,
      })
      .run();
  } else {
    // Normal transaction
    let payeeId: string | null = null;
    let finalCategoryId = input.categoryId || null;

    if (input.payeeName && input.payeeName.trim()) {
      const payee = await getOrCreatePayee(input.payeeName.trim(), input.categoryId || undefined);
      if (payee) {
        payeeId = payee.id;
        if (!finalCategoryId) {
          const rules = await db
            .select({
              id: payeeRules.id,
              payeeId: payeeRules.payeeId,
              categoryId: payeeRules.categoryId,
              operator: payeeRules.operator,
              amountCents: payeeRules.amountCents,
              sortOrder: payeeRules.sortOrder,
            })
            .from(payeeRules)
            .where(eq(payeeRules.payeeId, payee.id))
            .orderBy(asc(payeeRules.sortOrder), asc(payeeRules.amountCents));

          const match = resolvePayeeCategory(
            {
              id: payee.id,
              name: payee.name,
              defaultCategoryId: payee.defaultCategoryId,
              rules: rules.map((r) => ({
                ...r,
                operator: r.operator as RuleOperator,
              })),
            },
            input.amountCents
          );
          if (match) {
            finalCategoryId = match.categoryId;
          }
        }
      }
    }

    db.insert(transactions)
      .values({
        id: crypto.randomUUID(),
        accountId: input.accountId,
        payeeId,
        categoryId: finalCategoryId,
        amountCents: input.amountCents,
        date: input.date,
        notes: input.notes || null,
        isCleared: input.isCleared ?? true,
      })
      .run();
  }

  safeRevalidatePath('/');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  return { success: true };
}

export async function updateTransaction(
  id: string,
  input: {
    accountId?: string;
    payeeName?: string;
    categoryId?: string | null;
    amountCents?: number;
    date?: string;
    notes?: string | null;
    isCleared?: boolean;
    sourceAccountId?: string;
    destinationAccountId?: string;
  }
) {
  const current = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  if (current.length === 0) throw new Error('Transaction not found');
  const tx = current[0];

  // If this transaction is part of a transfer pair
  if (tx.transferId) {
    const absAmount = input.amountCents !== undefined ? Math.abs(input.amountCents) : null;
    const isOutflow = tx.amountCents < 0;
    const sourceTxId = isOutflow ? id : tx.transferId;
    const destTxId = isOutflow ? tx.transferId : id;

    const newSourceAccountId = input.sourceAccountId || (isOutflow ? input.accountId : undefined);
    const newDestAccountId = input.destinationAccountId || (!isOutflow ? input.accountId : undefined);

    if (newSourceAccountId && newDestAccountId && newSourceAccountId === newDestAccountId) {
      throw new Error('Source and destination accounts must be different for transfers');
    }

    const cleanedNotes = input.notes !== undefined ? (input.notes?.trim() || null) : undefined;

    // Update source leg
    db.update(transactions)
      .set({
        accountId: newSourceAccountId,
        amountCents: absAmount !== null ? -absAmount : undefined,
        date: input.date,
        notes: cleanedNotes,
        isCleared: input.isCleared,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, sourceTxId))
      .run();

    // Update destination leg
    db.update(transactions)
      .set({
        accountId: newDestAccountId,
        amountCents: absAmount !== null ? absAmount : undefined,
        date: input.date,
        notes: cleanedNotes,
        isCleared: input.isCleared,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, destTxId))
      .run();
  } else {
    let payeeId = tx.payeeId;
    if (input.payeeName !== undefined) {
      if (input.payeeName.trim()) {
        const payee = await getOrCreatePayee(input.payeeName.trim(), input.categoryId || undefined);
        payeeId = payee?.id || null;
      } else {
        payeeId = null;
      }
    }

    const cleanedNotes = input.notes !== undefined ? (input.notes?.trim() || null) : undefined;

    db.update(transactions)
      .set({
        accountId: input.accountId,
        payeeId,
        categoryId: input.categoryId !== undefined ? (input.categoryId || null) : undefined,
        amountCents: input.amountCents,
        date: input.date,
        notes: cleanedNotes,
        isCleared: input.isCleared,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .run();
  }

  safeRevalidatePath('/');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const current = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  if (current.length === 0) return { success: true };
  const tx = current[0];

  // If paired transfer, delete both
  if (tx.transferId) {
    db.delete(transactions)
      .where(or(eq(transactions.id, id), eq(transactions.id, tx.transferId)))
      .run();
  } else {
    db.delete(transactions).where(eq(transactions.id, id)).run();
  }

  safeRevalidatePath('/');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  return { success: true };
}

export async function toggleTransactionCleared(id: string) {
  const current = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);

  if (current.length === 0) return { success: false };

  db.update(transactions)
    .set({ isCleared: !current[0].isCleared, updatedAt: new Date() })
    .where(eq(transactions.id, id))
    .run();

  safeRevalidatePath('/transactions');
  return { success: true };
}
