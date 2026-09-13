'use server';

import { db } from '@/lib/db';
import { accountGroups, accounts, transactions } from '@/lib/db/schema';
import { eq, inArray, sql, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export interface AccountGroupWithStats {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  accountCount: number;
  totalBalanceCents: number;
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignored when called outside Next.js request context
  }
}

export async function getAccountGroups(): Promise<AccountGroupWithStats[]> {
  const groups = await db
    .select()
    .from(accountGroups)
    .orderBy(asc(accountGroups.sortOrder), asc(accountGroups.name));

  const activeAccounts = await db
    .select({
      id: accounts.id,
      groupId: accounts.groupId,
    })
    .from(accounts)
    .where(eq(accounts.isArchived, false));

  const balances = await db
    .select({
      accountId: transactions.accountId,
      totalCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
    })
    .from(transactions)
    .groupBy(transactions.accountId);

  const accountBalanceMap = new Map<string, number>();
  for (const b of balances) {
    accountBalanceMap.set(b.accountId, Number(b.totalCents));
  }

  const groupStatsMap = new Map<string, { count: number; total: number }>();
  for (const acc of activeAccounts) {
    if (acc.groupId) {
      const current = groupStatsMap.get(acc.groupId) || { count: 0, total: 0 };
      current.count += 1;
      current.total += accountBalanceMap.get(acc.id) || 0;
      groupStatsMap.set(acc.groupId, current);
    }
  }

  return groups.map((g) => {
    const stats = groupStatsMap.get(g.id) || { count: 0, total: 0 };
    return {
      id: g.id,
      name: g.name,
      icon: g.icon || null,
      sortOrder: g.sortOrder,
      accountCount: stats.count,
      totalBalanceCents: stats.total,
    };
  });
}

export async function createAccountGroup(data: {
  name: string;
  icon?: string | null;
  sortOrder?: number;
  accountIds?: string[];
}) {
  const groupId = crypto.randomUUID();
  const trimmed = data.name.trim();
  if (!trimmed) {
    throw new Error('Group name cannot be empty');
  }

  db.transaction((tx) => {
    tx.insert(accountGroups)
      .values({
        id: groupId,
        name: trimmed,
        icon: data.icon || null,
        sortOrder: data.sortOrder ?? 0,
      })
      .run();

    if (data.accountIds && data.accountIds.length > 0) {
      tx.update(accounts)
        .set({ groupId, updatedAt: new Date() })
        .where(inArray(accounts.id, data.accountIds))
        .run();
    }
  });

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/manage');
  return { success: true, id: groupId };
}

export async function updateAccountGroup(
  id: string,
  data: {
    name?: string;
    icon?: string | null;
    sortOrder?: number;
    accountIds?: string[];
  }
) {
  db.transaction((tx) => {
    const updatePayload: Partial<typeof accountGroups.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) throw new Error('Group name cannot be empty');
      updatePayload.name = trimmed;
    }
    if (data.icon !== undefined) updatePayload.icon = data.icon;
    if (data.sortOrder !== undefined) updatePayload.sortOrder = data.sortOrder;

    tx.update(accountGroups).set(updatePayload).where(eq(accountGroups.id, id)).run();

    if (data.accountIds !== undefined) {
      // Find accounts currently assigned to this group
      const currentAccounts = tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.groupId, id))
        .all();

      const toRemove = currentAccounts
        .filter((a) => !data.accountIds!.includes(a.id))
        .map((a) => a.id);

      if (toRemove.length > 0) {
        tx.update(accounts)
          .set({ groupId: null, updatedAt: new Date() })
          .where(inArray(accounts.id, toRemove))
          .run();
      }

      if (data.accountIds.length > 0) {
        tx.update(accounts)
          .set({ groupId: id, updatedAt: new Date() })
          .where(inArray(accounts.id, data.accountIds))
          .run();
      }
    }
  });

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/manage');
  return { success: true };
}

export async function deleteAccountGroup(id: string) {
  db.transaction((tx) => {
    // Unlink any accounts currently assigned to this group
    tx.update(accounts)
      .set({ groupId: null, updatedAt: new Date() })
      .where(eq(accounts.groupId, id))
      .run();

    // Delete the group record
    tx.delete(accountGroups).where(eq(accountGroups.id, id)).run();
  });

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/manage');
  return { success: true };
}

export async function reorderAccountGroups(orderedGroupIds: string[]) {
  db.transaction((tx) => {
    for (let i = 0; i < orderedGroupIds.length; i++) {
      tx.update(accountGroups)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(eq(accountGroups.id, orderedGroupIds[i]))
        .run();
    }
  });

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  return { success: true };
}
