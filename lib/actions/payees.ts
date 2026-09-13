'use server';

import { db } from '@/lib/db';
import { payees, categories, categoryGroups, transactions } from '@/lib/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export interface PayeeWithStats {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  defaultCategoryName: string | null;
  defaultCategoryGroupName: string | null;
  transactionCount: number;
  totalSpentCents: number;
  totalReceivedCents: number;
  netAmountCents: number;
  createdAt: Date;
}

export async function getPayees() {
  return db.select().from(payees).orderBy(asc(payees.name));
}

export async function getPayeesWithStats(): Promise<PayeeWithStats[]> {
  const allPayees = await db
    .select({
      id: payees.id,
      name: payees.name,
      defaultCategoryId: payees.defaultCategoryId,
      defaultCategoryName: categories.name,
      defaultCategoryGroupName: categoryGroups.name,
      createdAt: payees.createdAt,
    })
    .from(payees)
    .leftJoin(categories, eq(payees.defaultCategoryId, categories.id))
    .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .orderBy(asc(payees.name));

  const txStats = await db
    .select({
      payeeId: transactions.payeeId,
      totalSpent: sql<number>`coalesce(sum(case when ${transactions.amountCents} < 0 then abs(${transactions.amountCents}) else 0 end), 0)`,
      totalReceived: sql<number>`coalesce(sum(case when ${transactions.amountCents} > 0 then ${transactions.amountCents} else 0 end), 0)`,
      netAmount: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
      count: sql<number>`count(${transactions.id})`,
    })
    .from(transactions)
    .where(sql`${transactions.payeeId} is not null`)
    .groupBy(transactions.payeeId);

  const statsMap = new Map<
    string,
    { totalSpent: number; totalReceived: number; netAmount: number; count: number }
  >();
  for (const s of txStats) {
    if (s.payeeId) {
      statsMap.set(s.payeeId, {
        totalSpent: Number(s.totalSpent),
        totalReceived: Number(s.totalReceived),
        netAmount: Number(s.netAmount),
        count: Number(s.count),
      });
    }
  }

  return allPayees.map((p) => {
    const stats = statsMap.get(p.id) || {
      totalSpent: 0,
      totalReceived: 0,
      netAmount: 0,
      count: 0,
    };
    return {
      id: p.id,
      name: p.name,
      defaultCategoryId: p.defaultCategoryId,
      defaultCategoryName: p.defaultCategoryName || null,
      defaultCategoryGroupName: p.defaultCategoryGroupName || null,
      transactionCount: stats.count,
      totalSpentCents: stats.totalSpent,
      totalReceivedCents: stats.totalReceived,
      netAmountCents: stats.netAmount,
      createdAt: p.createdAt,
    };
  });
}

export async function createPayee(name: string, defaultCategoryId?: string | null) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Payee name cannot be empty.');
  }

  const existing = await db
    .select({ id: payees.id, name: payees.name })
    .from(payees)
    .where(sql`lower(${payees.name}) = lower(${trimmed})`)
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`A payee named "${existing[0].name}" already exists.`);
  }

  const id = crypto.randomUUID();
  db.insert(payees)
    .values({
      id,
      name: trimmed,
      defaultCategoryId: defaultCategoryId || null,
    })
    .run();

  revalidatePath('/manage');
  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/');
  return { success: true, id, name: trimmed };
}

export async function updatePayee(
  id: string,
  data: { name: string; defaultCategoryId?: string | null }
) {
  const trimmed = data.name.trim();
  if (!trimmed) {
    throw new Error('Payee name cannot be empty.');
  }

  const existing = await db
    .select({ id: payees.id, name: payees.name })
    .from(payees)
    .where(and(sql`lower(${payees.name}) = lower(${trimmed})`, sql`${payees.id} != ${id}`))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Another payee named "${existing[0].name}" already exists.`);
  }

  db.update(payees)
    .set({
      name: trimmed,
      defaultCategoryId: data.defaultCategoryId || null,
    })
    .where(eq(payees.id, id))
    .run();

  revalidatePath('/manage');
  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/');
  return { success: true };
}

export async function deletePayee(id: string) {
  db.delete(payees)
    .where(eq(payees.id, id))
    .run();

  revalidatePath('/manage');
  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/');
  return { success: true };
}

export async function getOrCreatePayee(name: string, defaultCategoryId?: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Search case-insensitively
  const existing = await db
    .select()
    .from(payees)
    .where(sql`lower(${payees.name}) = lower(${trimmed})`)
    .limit(1);

  if (existing.length > 0) {
    // Optionally update default category if provided and payee didn't have one
    if (defaultCategoryId && !existing[0].defaultCategoryId) {
      db.update(payees)
        .set({ defaultCategoryId })
        .where(eq(payees.id, existing[0].id))
        .run();
    }
    return existing[0];
  }

  const id = crypto.randomUUID();
  db.insert(payees)
    .values({
      id,
      name: trimmed,
      defaultCategoryId: defaultCategoryId || null,
    })
    .run();

  revalidatePath('/manage');
  revalidatePath('/categories');
  revalidatePath('/transactions');
  return { id, name: trimmed, defaultCategoryId: defaultCategoryId || null };
}

export async function updatePayeeDefaultCategory(id: string, defaultCategoryId: string | null) {
  db.update(payees)
    .set({ defaultCategoryId })
    .where(eq(payees.id, id))
    .run();

  revalidatePath('/manage');
  revalidatePath('/categories');
  revalidatePath('/transactions');
  return { success: true };
}
