'use server';

import { db } from '@/lib/db';
import { accounts, transactions } from '@/lib/db/schema';
import { AccountType } from '@/lib/constants';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountType;
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
      isArchived: acc.isArchived,
      balanceCents: stats.total,
      transactionCount: stats.count,
    };
  });
}

export async function createAccount(data: {
  name: string;
  type: AccountType;
  startingBalanceCents?: number;
}) {
  const accountId = crypto.randomUUID();

  db.insert(accounts)
    .values({
      id: accountId,
      name: data.name.trim(),
      type: data.type,
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

  revalidatePath('/');
  revalidatePath('/accounts');
  revalidatePath('/transactions');
  return { success: true, id: accountId };
}

export async function updateAccount(
  id: string,
  data: {
    name?: string;
    type?: AccountType;
  }
) {
  const updatePayload: Partial<typeof accounts.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name) updatePayload.name = data.name.trim();
  if (data.type) updatePayload.type = data.type;

  db.update(accounts).set(updatePayload).where(eq(accounts.id, id)).run();

  revalidatePath('/');
  revalidatePath('/accounts');
  revalidatePath('/transactions');
  return { success: true };
}

export async function archiveAccount(id: string) {
  db.update(accounts)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(accounts.id, id))
    .run();

  revalidatePath('/');
  revalidatePath('/accounts');
  return { success: true };
}
