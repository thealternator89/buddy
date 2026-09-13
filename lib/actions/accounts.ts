'use server';

import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { AccountType } from '@/lib/constants';
import { eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountType;
  icon?: string | null;
  excludeFromNetWorth: boolean;
  isArchived: boolean;
  balanceCents: number;
  transactionCount: number;
}

export async function getAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const allAccounts = await db.select().from(accounts).where(eq(accounts.isArchived, false));

  // Compute balance per account from transactions
  const balances = await db
    .select({
      accountId: transactions.accountId,
      totalCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
      count: sql<number>`count(${transactions.id})`,
    })
    .from(transactions)
    .groupBy(transactions.accountId);

  const balanceMap = new Map<string, { total: number; count: number }>();
  for (const b of balances) {
    balanceMap.set(b.accountId, {
      total: Number(b.totalCents),
      count: Number(b.count),
    });
  }

  return allAccounts.map((acc) => {
    const stats = balanceMap.get(acc.id) || { total: 0, count: 0 };
    return {
      id: acc.id,
      name: acc.name,
      type: acc.type as AccountType,
      icon: acc.icon || null,
      excludeFromNetWorth: Boolean(acc.excludeFromNetWorth),
      isArchived: acc.isArchived,
      balanceCents: stats.total,
      transactionCount: stats.count,
    };
  });
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignored when called outside Next.js request context (e.g. scripts or test runs)
  }
}

export async function createAccount(data: {
  name: string;
  type: AccountType;
  icon?: string | null;
  excludeFromNetWorth?: boolean;
  startingBalanceCents?: number;
}) {
  const accountId = crypto.randomUUID();

  db.insert(accounts)
    .values({
      id: accountId,
      name: data.name.trim(),
      type: data.type,
      icon: data.icon || null,
      excludeFromNetWorth: Boolean(data.excludeFromNetWorth),
      isArchived: false,
    })
    .run();

  // If a starting balance is provided, create the initial transaction
  if (data.startingBalanceCents && data.startingBalanceCents !== 0) {
    const today = new Date().toISOString().slice(0, 10);
    db.insert(transactions)
      .values({
        id: crypto.randomUUID(),
        accountId,
        amountCents: data.startingBalanceCents,
        date: today,
        notes: 'Starting Balance',
        isCleared: true,
      })
      .run();
  }

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  return { success: true, id: accountId };
}

export async function updateAccount(
  id: string,
  data: {
    name?: string;
    type?: AccountType;
    icon?: string | null;
    excludeFromNetWorth?: boolean;
  }
) {
  const updatePayload: Partial<typeof accounts.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) {
      throw new Error('Account name cannot be empty');
    }
    updatePayload.name = trimmed;
  }
  if (data.type) updatePayload.type = data.type;
  if (data.icon !== undefined) updatePayload.icon = data.icon;
  if (data.excludeFromNetWorth !== undefined) {
    updatePayload.excludeFromNetWorth = data.excludeFromNetWorth;
  }

  db.update(accounts).set(updatePayload).where(eq(accounts.id, id)).run();

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  return { success: true };
}

export async function archiveAccount(id: string) {
  db.update(accounts)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(accounts.id, id))
    .run();

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  return { success: true };
}

export async function deleteAccount(id: string) {
  // Find all transactions belonging to this account
  const accountTxs = await db
    .select({ id: transactions.id, transferId: transactions.transferId })
    .from(transactions)
    .where(eq(transactions.accountId, id));

  const accountTxIds = accountTxs.map((t) => t.id);
  const transferCounterpartIds = accountTxs
    .map((t) => t.transferId)
    .filter((tid): tid is string => Boolean(tid));

  db.transaction((tx) => {
    // Unlink transfers in other accounts where transferId pointed to this account's transactions
    if (accountTxIds.length > 0) {
      tx.update(transactions)
        .set({ transferId: null, updatedAt: new Date() })
        .where(inArray(transactions.transferId, accountTxIds))
        .run();
    }

    // Unlink any transactions where this account's transferId pointed to them
    if (transferCounterpartIds.length > 0) {
      tx.update(transactions)
        .set({ transferId: null, updatedAt: new Date() })
        .where(inArray(transactions.id, transferCounterpartIds))
        .run();
    }

    // Delete transactions for this account
    tx.delete(transactions).where(eq(transactions.accountId, id)).run();

    // Delete the account
    tx.delete(accounts).where(eq(accounts.id, id)).run();
  });

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  return { success: true };
}
