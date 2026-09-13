'use server';

import { db } from '@/lib/db';
import { accounts, categories, payees, transactions, payeeRules } from '@/lib/db/schema';
import { getOrCreatePayee } from './payees';
import { getCategorySubtreeIds } from './categories';
import { resolvePayeeCategory, RuleOperator } from '@/lib/payee-rules';
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
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
}

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<TransactionWithDetails[]> {
  const conditions = [];

  if (filters.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters.categoryId) {
    const subtreeIds = await getCategorySubtreeIds(filters.categoryId);
    conditions.push(inArray(transactions.categoryId, subtreeIds));
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

  // Base query with joins
  const query = db
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
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  let results =
    conditions.length > 0
      ? await query.where(and(...conditions)).limit(filters.limit || 500)
      : await query.limit(filters.limit || 500);

  // Search filter across payee, category, notes, and account
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    results = results.filter(
      (tx) =>
        tx.notes?.toLowerCase().includes(q) ||
        tx.payeeName?.toLowerCase().includes(q) ||
        tx.categoryName?.toLowerCase().includes(q) ||
        tx.accountName?.toLowerCase().includes(q)
    );
  }

  // Identify transfer counterpart accounts
  const transferIds = results
    .map((t) => t.transferId)
    .filter((id): id is string => Boolean(id));

  const transferAccountMap = new Map<string, string>();
  if (transferIds.length > 0) {
    const pairedTxs = await db
      .select({
        id: transactions.id,
        accountName: accounts.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(sql`${transactions.id} IN ${transferIds}`);

    for (const pt of pairedTxs) {
      transferAccountMap.set(pt.id, pt.accountName);
    }
  }

  return results.map((tx) => ({
    ...tx,
    transferAccountName: tx.transferId ? transferAccountMap.get(tx.transferId) || null : null,
  }));
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

    // Update current
    db.update(transactions)
      .set({
        amountCents:
          absAmount !== null ? (isOutflow ? -absAmount : absAmount) : undefined,
        date: input.date,
        notes: input.notes,
        isCleared: input.isCleared,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id))
      .run();

    // Update counterpart
    db.update(transactions)
      .set({
        amountCents:
          absAmount !== null ? (isOutflow ? absAmount : -absAmount) : undefined,
        date: input.date,
        notes: input.notes,
        isCleared: input.isCleared,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, tx.transferId))
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

    db.update(transactions)
      .set({
        accountId: input.accountId,
        payeeId,
        categoryId: input.categoryId,
        amountCents: input.amountCents,
        date: input.date,
        notes: input.notes,
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
