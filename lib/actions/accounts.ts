'use server';

import { db } from '@/lib/db';
import { accountGroups, accounts, transactions, BalanceDisplayMode } from '@/lib/db/schema';
import { AccountType } from '@/lib/constants';
import { eq, inArray, sql, asc, and, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export type { BalanceDisplayMode };

export interface AccountWithBalance {
  id: string;
  groupId?: string | null;
  groupName?: string | null;
  groupIcon?: string | null;
  name: string;
  type: AccountType;
  icon?: string | null;
  sortOrder: number;
  excludeFromNetWorth: boolean;
  isArchived: boolean;
  balanceCents: number;
  transactionCount: number;
  creditLimitCents?: number | null;
  balanceDisplayMode: BalanceDisplayMode;
  availableBalanceCents?: number | null;
}

export async function getAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const allAccounts = await db
    .select({
      id: accounts.id,
      groupId: accounts.groupId,
      groupName: accountGroups.name,
      groupIcon: accountGroups.icon,
      name: accounts.name,
      type: accounts.type,
      icon: accounts.icon,
      sortOrder: accounts.sortOrder,
      excludeFromNetWorth: accounts.excludeFromNetWorth,
      creditLimitCents: accounts.creditLimitCents,
      balanceDisplayMode: accounts.balanceDisplayMode,
      isArchived: accounts.isArchived,
    })
    .from(accounts)
    .leftJoin(accountGroups, eq(accounts.groupId, accountGroups.id))
    .where(eq(accounts.isArchived, false))
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt), asc(accounts.name));

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
    const creditLimitCents = acc.creditLimitCents ?? null;
    const availableBalanceCents =
      creditLimitCents !== null ? creditLimitCents + stats.total : null;

    return {
      id: acc.id,
      groupId: acc.groupId || null,
      groupName: acc.groupName || null,
      groupIcon: acc.groupIcon || null,
      name: acc.name,
      type: acc.type as AccountType,
      icon: acc.icon || null,
      sortOrder: acc.sortOrder,
      excludeFromNetWorth: Boolean(acc.excludeFromNetWorth),
      isArchived: acc.isArchived,
      balanceCents: stats.total,
      transactionCount: stats.count,
      creditLimitCents,
      balanceDisplayMode: (acc.balanceDisplayMode as BalanceDisplayMode) || 'actual',
      availableBalanceCents,
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
  groupId?: string | null;
  icon?: string | null;
  excludeFromNetWorth?: boolean;
  creditLimitCents?: number | null;
  balanceDisplayMode?: BalanceDisplayMode;
  startingBalanceCents?: number;
}) {
  const accountId = crypto.randomUUID();
  const targetGroupId = data.groupId || null;

  const whereCondition = targetGroupId
    ? and(eq(accounts.groupId, targetGroupId), eq(accounts.isArchived, false))
    : and(isNull(accounts.groupId), eq(accounts.isArchived, false));

  const maxOrderResult = db
    .select({ maxOrder: sql<number>`coalesce(max(${accounts.sortOrder}), 0)` })
    .from(accounts)
    .where(whereCondition)
    .get();

  const nextSortOrder = (maxOrderResult?.maxOrder ?? 0) + 1;

  db.insert(accounts)
    .values({
      id: accountId,
      groupId: targetGroupId,
      name: data.name.trim(),
      type: data.type,
      icon: data.icon || null,
      sortOrder: nextSortOrder,
      excludeFromNetWorth: Boolean(data.excludeFromNetWorth),
      creditLimitCents: data.creditLimitCents !== undefined ? data.creditLimitCents : null,
      balanceDisplayMode: data.balanceDisplayMode || 'actual',
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
    groupId?: string | null;
    icon?: string | null;
    excludeFromNetWorth?: boolean;
    creditLimitCents?: number | null;
    balanceDisplayMode?: BalanceDisplayMode;
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
  if (data.groupId !== undefined) {
    const current = db
      .select({ groupId: accounts.groupId })
      .from(accounts)
      .where(eq(accounts.id, id))
      .get();
    const newGroupId = data.groupId || null;
    if (current && (current.groupId || null) !== newGroupId) {
      const whereCondition = newGroupId
        ? and(eq(accounts.groupId, newGroupId), eq(accounts.isArchived, false))
        : and(isNull(accounts.groupId), eq(accounts.isArchived, false));
      const maxOrder = db
        .select({ maxOrder: sql<number>`coalesce(max(${accounts.sortOrder}), 0)` })
        .from(accounts)
        .where(whereCondition)
        .get();
      updatePayload.sortOrder = (maxOrder?.maxOrder ?? 0) + 1;
    }
    updatePayload.groupId = newGroupId;
  }
  if (data.icon !== undefined) updatePayload.icon = data.icon;
  if (data.excludeFromNetWorth !== undefined) {
    updatePayload.excludeFromNetWorth = data.excludeFromNetWorth;
  }
  if (data.creditLimitCents !== undefined) {
    updatePayload.creditLimitCents = data.creditLimitCents;
  }
  if (data.balanceDisplayMode !== undefined) {
    updatePayload.balanceDisplayMode = data.balanceDisplayMode;
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

export async function reorderAccounts(
  updates: { id: string; sortOrder: number; groupId?: string | null }[]
) {
  db.transaction((tx) => {
    for (const item of updates) {
      const payload: { sortOrder: number; updatedAt: Date; groupId?: string | null } = {
        sortOrder: item.sortOrder,
        updatedAt: new Date(),
      };
      if (item.groupId !== undefined) {
        payload.groupId = item.groupId;
      }
      tx.update(accounts).set(payload).where(eq(accounts.id, item.id)).run();
    }
  });

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  return { success: true };
}
