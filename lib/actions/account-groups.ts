'use server';

import { db } from '@/lib/db';
import { accountGroups, accounts, transactions } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { eq, sql, asc, and, isNull } from 'drizzle-orm';
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
  const user = await requireUser();

  const groups = await db
    .select()
    .from(accountGroups)
    .where(eq(accountGroups.userId, user.id))
    .orderBy(asc(accountGroups.sortOrder), asc(accountGroups.createdAt), asc(accountGroups.name));

  const activeAccounts = await db
    .select({
      id: accounts.id,
      groupId: accounts.groupId,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.isArchived, false)));

  const balances = await db
    .select({
      accountId: transactions.accountId,
      totalCents: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.userId, user.id))
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
  const user = await requireUser();
  const groupId = crypto.randomUUID();
  const trimmed = data.name.trim();
  if (!trimmed) {
    throw new Error('Group name cannot be empty');
  }

  await db.transaction(async (tx) => {
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const maxOrderResult = await tx
        .select({ maxOrder: sql<number>`coalesce(max(${accountGroups.sortOrder}), 0)` })
        .from(accountGroups)
        .where(eq(accountGroups.userId, user.id));
      sortOrder = Number(maxOrderResult[0]?.maxOrder ?? 0) + 1;
    }

    await tx.insert(accountGroups).values({
      id: groupId,
      userId: user.id,
      name: trimmed,
      icon: data.icon || null,
      sortOrder,
    });

    if (data.accountIds && data.accountIds.length > 0) {
      for (let i = 0; i < data.accountIds.length; i++) {
        await tx
          .update(accounts)
          .set({ groupId, sortOrder: i + 1, updatedAt: new Date() })
          .where(and(eq(accounts.id, data.accountIds[i]), eq(accounts.userId, user.id)));
      }
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
  const user = await requireUser();

  await db.transaction(async (tx) => {
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

    await tx
      .update(accountGroups)
      .set(updatePayload)
      .where(and(eq(accountGroups.id, id), eq(accountGroups.userId, user.id)));

    if (data.accountIds !== undefined) {
      // Find accounts currently assigned to this group for this user
      const currentAccounts = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.groupId, id), eq(accounts.userId, user.id)));

      const toRemove = currentAccounts
        .filter((a) => !data.accountIds!.includes(a.id))
        .map((a) => a.id);

      if (toRemove.length > 0) {
        const maxUngroupedOrder = await tx
          .select({ maxOrder: sql<number>`coalesce(max(${accounts.sortOrder}), 0)` })
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, user.id),
              isNull(accounts.groupId),
              eq(accounts.isArchived, false)
            )
          );
        let nextUngroupedOrder = Number(maxUngroupedOrder[0]?.maxOrder ?? 0) + 1;
        for (const remId of toRemove) {
          await tx
            .update(accounts)
            .set({ groupId: null, sortOrder: nextUngroupedOrder++, updatedAt: new Date() })
            .where(and(eq(accounts.id, remId), eq(accounts.userId, user.id)));
        }
      }

      const currentIdsSet = new Set(currentAccounts.map((a) => a.id));
      const newlyAdded = data.accountIds.filter((accId) => !currentIdsSet.has(accId));

      if (newlyAdded.length > 0) {
        const maxOrderResult = await tx
          .select({ maxOrder: sql<number>`coalesce(max(${accounts.sortOrder}), 0)` })
          .from(accounts)
          .where(
            and(
              eq(accounts.userId, user.id),
              eq(accounts.groupId, id),
              eq(accounts.isArchived, false)
            )
          );
        let nextOrder = Number(maxOrderResult[0]?.maxOrder ?? 0) + 1;
        for (const accId of newlyAdded) {
          await tx
            .update(accounts)
            .set({ groupId: id, sortOrder: nextOrder++, updatedAt: new Date() })
            .where(and(eq(accounts.id, accId), eq(accounts.userId, user.id)));
        }
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
  const user = await requireUser();

  await db.transaction(async (tx) => {
    // Unlink any accounts currently assigned to this group and append to ungrouped
    const toUnlink = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.groupId, id), eq(accounts.userId, user.id)));

    if (toUnlink.length > 0) {
      const maxUngroupedOrder = await tx
        .select({ maxOrder: sql<number>`coalesce(max(${accounts.sortOrder}), 0)` })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, user.id),
            isNull(accounts.groupId),
            eq(accounts.isArchived, false)
          )
        );
      let nextUngroupedOrder = Number(maxUngroupedOrder[0]?.maxOrder ?? 0) + 1;
      for (const acc of toUnlink) {
        await tx
          .update(accounts)
          .set({ groupId: null, sortOrder: nextUngroupedOrder++, updatedAt: new Date() })
          .where(and(eq(accounts.id, acc.id), eq(accounts.userId, user.id)));
      }
    }

    // Delete the group record
    await tx
      .delete(accountGroups)
      .where(and(eq(accountGroups.id, id), eq(accountGroups.userId, user.id)));
  });

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/manage');
  return { success: true };
}

export async function reorderAccountGroups(orderedGroupIds: string[]) {
  const user = await requireUser();

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedGroupIds.length; i++) {
      await tx
        .update(accountGroups)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(
          and(eq(accountGroups.id, orderedGroupIds[i]), eq(accountGroups.userId, user.id))
        );
    }
  });

  safeRevalidatePath('/');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/transactions');
  return { success: true };
}
