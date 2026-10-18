'use server';

import { db } from '@/lib/db';
import { accounts, categories, payees, transactions, payeeRules } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { getOrCreatePayee } from './payees';
import { getCategorySubtreeIds } from './categories';
import { resolvePayeeCategory, RuleOperator } from '@/lib/payee-rules';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
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
  const user = await requireUser();
  const conditions: (SQL | undefined)[] = [eq(transactions.userId, user.id)];

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
        ilike(transactions.notes, term),
        ilike(accounts.name, term),
        ilike(payees.name, term),
        ilike(categories.name, term),
        ilike(parentCategories.name, term)
      )
    );
  }

  const whereClause = and(...conditions);

  // 1. Get total count and aggregate net total for all matching items
  const countResult = await db
    .select({
      count: sql<number>`count(*)`,
      totalAmountCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
    })
    .from(transactions)
    .innerJoin(
      accounts,
      and(eq(transactions.accountId, accounts.id), eq(accounts.userId, user.id))
    )
    .leftJoin(payees, and(eq(transactions.payeeId, payees.id), eq(payees.userId, user.id)))
    .leftJoin(
      categories,
      and(eq(transactions.categoryId, categories.id), eq(categories.userId, user.id))
    )
    .leftJoin(
      parentCategories,
      and(eq(categories.parentId, parentCategories.id), eq(parentCategories.userId, user.id))
    )
    .where(whereClause);

  const totalCount = Number(countResult[0]?.count ?? 0);
  const totalAmountCents = Number(countResult[0]?.totalAmountCents ?? 0);

  const pageSize = filters.pageSize || filters.limit || 100;
  const rawPage = filters.page || 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, rawPage), totalPages);
  const offset = filters.offset !== undefined ? filters.offset : (page - 1) * pageSize;

  // 2. Base query with joins
  const results = await db
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
    .innerJoin(
      accounts,
      and(eq(transactions.accountId, accounts.id), eq(accounts.userId, user.id))
    )
    .leftJoin(payees, and(eq(transactions.payeeId, payees.id), eq(payees.userId, user.id)))
    .leftJoin(
      categories,
      and(eq(transactions.categoryId, categories.id), eq(categories.userId, user.id))
    )
    .leftJoin(
      parentCategories,
      and(eq(categories.parentId, parentCategories.id), eq(parentCategories.userId, user.id))
    )
    .where(whereClause)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(pageSize)
    .offset(offset);

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
      .innerJoin(
        accounts,
        and(eq(transactions.accountId, accounts.id), eq(accounts.userId, user.id))
      )
      .where(and(eq(transactions.userId, user.id), inArray(transactions.id, transferIds)));

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
  const user = await requireUser();

  if (input.isTransfer) {
    if (input.sourceAccountId === input.destinationAccountId) {
      throw new Error('Source and destination accounts must be different for transfers');
    }

    const userAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, user.id),
          inArray(accounts.id, [input.sourceAccountId, input.destinationAccountId])
        )
      );

    if (userAccounts.length !== 2) {
      throw new Error('Invalid source or destination account.');
    }

    const absAmount = Math.abs(input.amountCents);
    const sourceTxId = crypto.randomUUID();
    const destTxId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      // Source Outflow
      await tx.insert(transactions).values({
        id: sourceTxId,
        userId: user.id,
        accountId: input.sourceAccountId,
        amountCents: -absAmount,
        date: input.date,
        notes: input.notes || null,
        isCleared: input.isCleared ?? true,
        transferId: destTxId,
      });

      // Destination Inflow
      await tx.insert(transactions).values({
        id: destTxId,
        userId: user.id,
        accountId: input.destinationAccountId,
        amountCents: absAmount,
        date: input.date,
        notes: input.notes || null,
        isCleared: input.isCleared ?? true,
        transferId: sourceTxId,
      });
    });
  } else {
    // Verify account belongs to user
    const validAccount = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, user.id)))
      .limit(1);

    if (validAccount.length === 0) {
      throw new Error('Account not found.');
    }

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
            .where(and(eq(payeeRules.payeeId, payee.id), eq(payeeRules.userId, user.id)))
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

    await db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      accountId: input.accountId,
      payeeId,
      categoryId: finalCategoryId,
      amountCents: input.amountCents,
      date: input.date,
      notes: input.notes || null,
      isCleared: input.isCleared ?? true,
    });
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
  const user = await requireUser();

  const current = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .limit(1);

  if (current.length === 0) throw new Error('Transaction not found');
  const txRecord = current[0];

  // If this transaction is part of a transfer pair
  if (txRecord.transferId) {
    const absAmount = input.amountCents !== undefined ? Math.abs(input.amountCents) : null;
    const isOutflow = txRecord.amountCents < 0;
    const sourceTxId = isOutflow ? id : txRecord.transferId;
    const destTxId = isOutflow ? txRecord.transferId : id;

    const newSourceAccountId = input.sourceAccountId || (isOutflow ? input.accountId : undefined);
    const newDestAccountId =
      input.destinationAccountId || (!isOutflow ? input.accountId : undefined);

    if (newSourceAccountId && newDestAccountId && newSourceAccountId === newDestAccountId) {
      throw new Error('Source and destination accounts must be different for transfers');
    }

    const cleanedNotes = input.notes !== undefined ? (input.notes?.trim() || null) : undefined;

    await db.transaction(async (tx) => {
      // Update source leg
      await tx
        .update(transactions)
        .set({
          accountId: newSourceAccountId,
          amountCents: absAmount !== null ? -absAmount : undefined,
          date: input.date,
          notes: cleanedNotes,
          isCleared: input.isCleared,
          updatedAt: new Date(),
        })
        .where(and(eq(transactions.id, sourceTxId), eq(transactions.userId, user.id)));

      // Update destination leg
      await tx
        .update(transactions)
        .set({
          accountId: newDestAccountId,
          amountCents: absAmount !== null ? absAmount : undefined,
          date: input.date,
          notes: cleanedNotes,
          isCleared: input.isCleared,
          updatedAt: new Date(),
        })
        .where(and(eq(transactions.id, destTxId), eq(transactions.userId, user.id)));
    });
  } else {
    let payeeId = txRecord.payeeId;
    if (input.payeeName !== undefined) {
      if (input.payeeName.trim()) {
        const payee = await getOrCreatePayee(input.payeeName.trim());
        payeeId = payee?.id || null;
      } else {
        payeeId = null;
      }
    }

    const cleanedNotes = input.notes !== undefined ? (input.notes?.trim() || null) : undefined;

    await db
      .update(transactions)
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
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
  }

  safeRevalidatePath('/');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const user = await requireUser();

  const current = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .limit(1);

  if (current.length === 0) return { success: true };
  const txRecord = current[0];

  // If paired transfer, delete both
  if (txRecord.transferId) {
    await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          or(eq(transactions.id, id), eq(transactions.id, txRecord.transferId))
        )
      );
  } else {
    await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
  }

  safeRevalidatePath('/');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  return { success: true };
}

export async function toggleTransactionCleared(id: string) {
  const user = await requireUser();

  const current = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
    .limit(1);

  if (current.length === 0) return { success: false };

  await db
    .update(transactions)
    .set({ isCleared: !current[0].isCleared, updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));

  safeRevalidatePath('/transactions');
  return { success: true };
}
