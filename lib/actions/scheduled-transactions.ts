'use server';

import { db } from '@/lib/db';
import {
  accounts,
  categories,
  payees,
  payeeRules,
  scheduledTransactions,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { getOrCreatePayee } from './payees';
import { createTransaction } from './transactions';
import { resolvePayeeCategory, RuleOperator } from '@/lib/payee-rules';
import {
  calculateNextDueDate,
  getLocalTodayIso,
  ScheduledFrequency,
} from '@/lib/utils/scheduled';
import { and, asc, eq, inArray } from 'drizzle-orm';
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

function revalidateScheduledPaths() {
  safeRevalidatePath('/');
  safeRevalidatePath('/scheduled');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
}

export interface ScheduledTransactionWithDetails {
  id: string;
  accountId: string;
  accountName: string;
  transferAccountId: string | null;
  transferAccountName: string | null;
  payeeId: string | null;
  payeeName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  parentCategoryName: string | null;
  amountCents: number;
  frequency: ScheduledFrequency;
  startDate: string;
  nextDueDate: string;
  notes: string | null;
  createdAt: Date;
}

export async function getScheduledTransactions(): Promise<ScheduledTransactionWithDetails[]> {
  const user = await requireUser();
  const transferAccounts = alias(accounts, 'transfer_accounts');
  const parentCategories = alias(categories, 'parent_categories');

  const results = await db
    .select({
      id: scheduledTransactions.id,
      accountId: scheduledTransactions.accountId,
      accountName: accounts.name,
      transferAccountId: scheduledTransactions.transferAccountId,
      transferAccountName: transferAccounts.name,
      payeeId: scheduledTransactions.payeeId,
      payeeName: payees.name,
      categoryId: scheduledTransactions.categoryId,
      categoryName: categories.name,
      parentCategoryName: parentCategories.name,
      amountCents: scheduledTransactions.amountCents,
      frequency: scheduledTransactions.frequency,
      startDate: scheduledTransactions.startDate,
      nextDueDate: scheduledTransactions.nextDueDate,
      notes: scheduledTransactions.notes,
      createdAt: scheduledTransactions.createdAt,
    })
    .from(scheduledTransactions)
    .innerJoin(
      accounts,
      and(eq(scheduledTransactions.accountId, accounts.id), eq(accounts.userId, user.id))
    )
    .leftJoin(
      transferAccounts,
      and(
        eq(scheduledTransactions.transferAccountId, transferAccounts.id),
        eq(transferAccounts.userId, user.id)
      )
    )
    .leftJoin(
      payees,
      and(eq(scheduledTransactions.payeeId, payees.id), eq(payees.userId, user.id))
    )
    .leftJoin(
      categories,
      and(eq(scheduledTransactions.categoryId, categories.id), eq(categories.userId, user.id))
    )
    .leftJoin(
      parentCategories,
      and(eq(categories.parentId, parentCategories.id), eq(parentCategories.userId, user.id))
    )
    .where(eq(scheduledTransactions.userId, user.id))
    .orderBy(asc(scheduledTransactions.nextDueDate), asc(scheduledTransactions.createdAt));

  return results.map((r) => ({
    ...r,
    frequency: r.frequency as ScheduledFrequency,
  }));
}

export type CreateScheduledTransactionInput =
  | {
      isTransfer: false;
      accountId: string;
      payeeName: string;
      categoryId?: string | null;
      amountCents: number; // positive for income, negative for expense
      frequency: ScheduledFrequency;
      startDate: string; // YYYY-MM-DD
      nextDueDate?: string; // defaults to startDate
      notes?: string;
    }
  | {
      isTransfer: true;
      sourceAccountId: string;
      destinationAccountId: string;
      amountCents: number; // positive amount transferred
      frequency: ScheduledFrequency;
      startDate: string; // YYYY-MM-DD
      nextDueDate?: string; // defaults to startDate
      notes?: string;
    };

export async function createScheduledTransaction(input: CreateScheduledTransactionInput) {
  const user = await requireUser();
  const nextDueDate = input.nextDueDate || input.startDate;

  if (input.isTransfer) {
    if (input.sourceAccountId === input.destinationAccountId) {
      throw new Error('Source and destination accounts must be different for transfers.');
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

    await db.insert(scheduledTransactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      accountId: input.sourceAccountId,
      transferAccountId: input.destinationAccountId,
      payeeId: null,
      categoryId: null,
      amountCents: -absAmount,
      frequency: input.frequency,
      startDate: input.startDate,
      nextDueDate,
      notes: input.notes?.trim() || null,
    });
  } else {
    const validAccount = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, user.id)))
      .limit(1);

    if (validAccount.length === 0) {
      throw new Error('Account not found.');
    }

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

    await db.insert(scheduledTransactions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      accountId: input.accountId,
      transferAccountId: null,
      payeeId,
      categoryId: finalCategoryId,
      amountCents: input.amountCents,
      frequency: input.frequency,
      startDate: input.startDate,
      nextDueDate,
      notes: input.notes?.trim() || null,
    });
  }

  revalidateScheduledPaths();
  return { success: true };
}

export async function updateScheduledTransaction(
  id: string,
  input: CreateScheduledTransactionInput
) {
  const user = await requireUser();

  const existing = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, user.id)))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Scheduled transaction not found.');
  }

  const nextDueDate = input.nextDueDate || input.startDate;

  if (input.isTransfer) {
    if (input.sourceAccountId === input.destinationAccountId) {
      throw new Error('Source and destination accounts must be different for transfers.');
    }

    const absAmount = Math.abs(input.amountCents);

    await db
      .update(scheduledTransactions)
      .set({
        accountId: input.sourceAccountId,
        transferAccountId: input.destinationAccountId,
        payeeId: null,
        categoryId: null,
        amountCents: -absAmount,
        frequency: input.frequency,
        startDate: input.startDate,
        nextDueDate,
        notes: input.notes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, user.id)));
  } else {
    let payeeId: string | null = null;
    const finalCategoryId = input.categoryId || null;

    if (input.payeeName && input.payeeName.trim()) {
      const payee = await getOrCreatePayee(input.payeeName.trim(), input.categoryId || undefined);
      payeeId = payee?.id || null;
    }

    await db
      .update(scheduledTransactions)
      .set({
        accountId: input.accountId,
        transferAccountId: null,
        payeeId,
        categoryId: finalCategoryId,
        amountCents: input.amountCents,
        frequency: input.frequency,
        startDate: input.startDate,
        nextDueDate,
        notes: input.notes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, user.id)));
  }

  revalidateScheduledPaths();
  return { success: true };
}

export async function deleteScheduledTransaction(id: string) {
  const user = await requireUser();

  await db
    .delete(scheduledTransactions)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, user.id)));

  revalidateScheduledPaths();
  return { success: true };
}

/**
 * Advances a scheduled transaction's nextDueDate by one frequency interval
 * based on its current `nextDueDate` (or deletes it if `frequency === 'once'`).
 */
export async function advanceScheduledTransaction(id: string) {
  const user = await requireUser();

  const existing = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, user.id)))
    .limit(1);

  if (existing.length === 0) {
    return { success: false };
  }

  const record = existing[0];
  const nextDate = calculateNextDueDate(
    record.nextDueDate,
    record.frequency as ScheduledFrequency,
    record.startDate
  );

  if (!nextDate) {
    // One-off scheduled transaction has completed its single occurrence
    await db
      .delete(scheduledTransactions)
      .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, user.id)));
  } else {
    await db
      .update(scheduledTransactions)
      .set({
        nextDueDate: nextDate,
        updatedAt: new Date(),
      })
      .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, user.id)));
  }

  revalidateScheduledPaths();
  return { success: true, nextDueDate: nextDate };
}

/**
 * One-click action to create the transaction dated on today's date (or `clientTodayDate`)
 * and advance the schedule based on its `nextDueDate`.
 */
export async function postScheduledTransactionNow(id: string, clientTodayDate?: string) {
  const user = await requireUser();

  const items = await db
    .select({
      id: scheduledTransactions.id,
      accountId: scheduledTransactions.accountId,
      transferAccountId: scheduledTransactions.transferAccountId,
      payeeName: payees.name,
      categoryId: scheduledTransactions.categoryId,
      amountCents: scheduledTransactions.amountCents,
      notes: scheduledTransactions.notes,
    })
    .from(scheduledTransactions)
    .leftJoin(
      payees,
      and(eq(scheduledTransactions.payeeId, payees.id), eq(payees.userId, user.id))
    )
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.userId, user.id)))
    .limit(1);

  if (items.length === 0) {
    throw new Error('Scheduled transaction not found.');
  }

  const sched = items[0];
  const txDate = clientTodayDate || getLocalTodayIso();

  if (sched.transferAccountId) {
    await createTransaction({
      isTransfer: true,
      sourceAccountId: sched.accountId,
      destinationAccountId: sched.transferAccountId,
      amountCents: Math.abs(sched.amountCents),
      date: txDate,
      notes: sched.notes || undefined,
      isCleared: true,
      scheduledTransactionId: sched.id,
    });
  } else {
    await createTransaction({
      isTransfer: false,
      accountId: sched.accountId,
      payeeName: sched.payeeName || 'Scheduled Transaction',
      categoryId: sched.categoryId,
      amountCents: sched.amountCents,
      date: txDate,
      notes: sched.notes || undefined,
      isCleared: true,
      scheduledTransactionId: sched.id,
    });
  }

  return { success: true };
}
