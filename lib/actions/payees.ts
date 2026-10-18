'use server';

import { db } from '@/lib/db';
import { payees, categories, transactions, payeeRules } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { PayeeRuleItem, RuleOperator } from '@/lib/payee-rules';
import { and, asc, eq, sql } from 'drizzle-orm';
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

export interface PayeeWithStats {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  defaultCategoryName: string | null;
  parentCategoryName: string | null;
  priority: number;
  rules: PayeeRuleItem[];
  transactionCount: number;
  totalSpentCents: number;
  totalReceivedCents: number;
  netAmountCents: number;
  createdAt: Date;
}

export interface PayeeWithRules {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  priority: number;
  createdAt: Date;
  rules: PayeeRuleItem[];
}

export interface CreatePayeeRuleInput {
  categoryId: string;
  operator: RuleOperator;
  amountCents: number;
}

export async function getPayees(): Promise<PayeeWithRules[]> {
  const user = await requireUser();

  const allPayees = await db
    .select()
    .from(payees)
    .where(eq(payees.userId, user.id))
    .orderBy(asc(payees.priority), asc(payees.name));

  const allRules = await db
    .select({
      id: payeeRules.id,
      payeeId: payeeRules.payeeId,
      categoryId: payeeRules.categoryId,
      categoryName: categories.name,
      operator: payeeRules.operator,
      amountCents: payeeRules.amountCents,
      sortOrder: payeeRules.sortOrder,
    })
    .from(payeeRules)
    .leftJoin(
      categories,
      and(eq(payeeRules.categoryId, categories.id), eq(categories.userId, user.id))
    )
    .where(eq(payeeRules.userId, user.id))
    .orderBy(asc(payeeRules.sortOrder), asc(payeeRules.amountCents));

  const rulesMap = new Map<string, PayeeRuleItem[]>();
  for (const r of allRules) {
    const list = rulesMap.get(r.payeeId) || [];
    list.push({
      id: r.id,
      payeeId: r.payeeId,
      categoryId: r.categoryId,
      categoryName: r.categoryName || null,
      operator: r.operator as RuleOperator,
      amountCents: r.amountCents,
      sortOrder: r.sortOrder,
    });
    rulesMap.set(r.payeeId, list);
  }

  return allPayees.map((p) => ({
    ...p,
    priority: p.priority ?? 1,
    rules: rulesMap.get(p.id) || [],
  }));
}

export async function getPayeesWithStats(): Promise<PayeeWithStats[]> {
  const user = await requireUser();
  const parentCategories = alias(categories, 'parent_categories');
  const ruleParentCategories = alias(categories, 'rule_parent_categories');

  const allPayees = await db
    .select({
      id: payees.id,
      name: payees.name,
      defaultCategoryId: payees.defaultCategoryId,
      defaultCategoryName: categories.name,
      parentCategoryName: parentCategories.name,
      priority: payees.priority,
      createdAt: payees.createdAt,
    })
    .from(payees)
    .leftJoin(
      categories,
      and(eq(payees.defaultCategoryId, categories.id), eq(categories.userId, user.id))
    )
    .leftJoin(
      parentCategories,
      and(eq(categories.parentId, parentCategories.id), eq(parentCategories.userId, user.id))
    )
    .where(eq(payees.userId, user.id))
    .orderBy(asc(payees.priority), asc(payees.name));

  const allRules = await db
    .select({
      id: payeeRules.id,
      payeeId: payeeRules.payeeId,
      categoryId: payeeRules.categoryId,
      categoryName: categories.name,
      parentCategoryName: ruleParentCategories.name,
      operator: payeeRules.operator,
      amountCents: payeeRules.amountCents,
      sortOrder: payeeRules.sortOrder,
    })
    .from(payeeRules)
    .leftJoin(
      categories,
      and(eq(payeeRules.categoryId, categories.id), eq(categories.userId, user.id))
    )
    .leftJoin(
      ruleParentCategories,
      and(
        eq(categories.parentId, ruleParentCategories.id),
        eq(ruleParentCategories.userId, user.id)
      )
    )
    .where(eq(payeeRules.userId, user.id))
    .orderBy(asc(payeeRules.sortOrder), asc(payeeRules.amountCents));

  const rulesMap = new Map<string, PayeeRuleItem[]>();
  for (const r of allRules) {
    const list = rulesMap.get(r.payeeId) || [];
    list.push({
      id: r.id,
      payeeId: r.payeeId,
      categoryId: r.categoryId,
      categoryName: r.categoryName || null,
      parentCategoryName: r.parentCategoryName || null,
      operator: r.operator as RuleOperator,
      amountCents: r.amountCents,
      sortOrder: r.sortOrder,
    });
    rulesMap.set(r.payeeId, list);
  }

  const txStats = await db
    .select({
      payeeId: transactions.payeeId,
      totalSpent: sql<number>`coalesce(sum(case when ${transactions.amountCents} < 0 then abs(${transactions.amountCents}) else 0 end), 0)`,
      totalReceived: sql<number>`coalesce(sum(case when ${transactions.amountCents} > 0 then ${transactions.amountCents} else 0 end), 0)`,
      netAmount: sql<number>`coalesce(sum(${transactions.amountCents}), 0)`,
      count: sql<number>`count(${transactions.id})`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), sql`${transactions.payeeId} is not null`))
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
      parentCategoryName: p.parentCategoryName || null,
      priority: p.priority ?? 1,
      rules: rulesMap.get(p.id) || [],
      transactionCount: stats.count,
      totalSpentCents: stats.totalSpent,
      totalReceivedCents: stats.totalReceived,
      netAmountCents: stats.netAmount,
      createdAt: p.createdAt,
    };
  });
}

export async function createPayee(
  name: string,
  defaultCategoryId?: string | null,
  rules?: CreatePayeeRuleInput[],
  priority: number = 1
) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Payee name cannot be empty.');
  }

  const existing = await db
    .select({ id: payees.id, name: payees.name })
    .from(payees)
    .where(
      and(eq(payees.userId, user.id), sql`lower(${payees.name}) = lower(${trimmed})`)
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`A payee named "${existing[0].name}" already exists.`);
  }

  const sanitizedPriority = Math.min(Math.max(Number(priority) ?? 1, 0), 3);
  const id = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(payees).values({
      id,
      userId: user.id,
      name: trimmed,
      defaultCategoryId: defaultCategoryId || null,
      priority: sanitizedPriority,
    });

    if (rules && rules.length > 0) {
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        await tx.insert(payeeRules).values({
          id: crypto.randomUUID(),
          userId: user.id,
          payeeId: id,
          categoryId: r.categoryId,
          operator: r.operator,
          amountCents: r.amountCents,
          sortOrder: i,
        });
      }
    }
  });

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/');
  return { success: true, id, name: trimmed, priority: sanitizedPriority };
}

export async function updatePayee(
  id: string,
  data: {
    name: string;
    defaultCategoryId?: string | null;
    rules?: CreatePayeeRuleInput[];
    priority?: number;
  }
) {
  const user = await requireUser();
  const trimmed = data.name.trim();
  if (!trimmed) {
    throw new Error('Payee name cannot be empty.');
  }

  const existing = await db
    .select({ id: payees.id, name: payees.name })
    .from(payees)
    .where(
      and(
        eq(payees.userId, user.id),
        sql`lower(${payees.name}) = lower(${trimmed})`,
        sql`${payees.id} != ${id}`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Another payee named "${existing[0].name}" already exists.`);
  }

  const updateFields: {
    name: string;
    defaultCategoryId: string | null;
    priority?: number;
  } = {
    name: trimmed,
    defaultCategoryId: data.defaultCategoryId || null,
  };

  if (data.priority !== undefined) {
    updateFields.priority = Math.min(Math.max(Number(data.priority) ?? 1, 0), 3);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payees)
      .set(updateFields)
      .where(and(eq(payees.id, id), eq(payees.userId, user.id)));

    if (data.rules !== undefined) {
      await tx
        .delete(payeeRules)
        .where(and(eq(payeeRules.payeeId, id), eq(payeeRules.userId, user.id)));

      for (let i = 0; i < data.rules.length; i++) {
        const r = data.rules[i];
        await tx.insert(payeeRules).values({
          id: crypto.randomUUID(),
          userId: user.id,
          payeeId: id,
          categoryId: r.categoryId,
          operator: r.operator,
          amountCents: r.amountCents,
          sortOrder: i,
        });
      }
    }
  });

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/');
  return { success: true };
}

export async function updatePayeePriority(id: string, priority: number) {
  const user = await requireUser();
  const sanitizedPriority = Math.min(Math.max(Number(priority) ?? 1, 0), 3);

  await db
    .update(payees)
    .set({ priority: sanitizedPriority })
    .where(and(eq(payees.id, id), eq(payees.userId, user.id)));

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/');
  return { success: true };
}

export async function deletePayee(id: string) {
  const user = await requireUser();

  await db.transaction(async (tx) => {
    await tx
      .delete(payeeRules)
      .where(and(eq(payeeRules.payeeId, id), eq(payeeRules.userId, user.id)));
    await tx
      .delete(payees)
      .where(and(eq(payees.id, id), eq(payees.userId, user.id)));
  });

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/');
  return { success: true };
}

export async function getOrCreatePayee(name: string, defaultCategoryId?: string) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Search case-insensitively for this user
  const existing = await db
    .select()
    .from(payees)
    .where(
      and(eq(payees.userId, user.id), sql`lower(${payees.name}) = lower(${trimmed})`)
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const id = crypto.randomUUID();
  await db.insert(payees).values({
    id,
    userId: user.id,
    name: trimmed,
    defaultCategoryId: defaultCategoryId || null,
    priority: 1,
  });

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  return { id, name: trimmed, defaultCategoryId: defaultCategoryId || null };
}

export async function updatePayeeDefaultCategory(id: string, defaultCategoryId: string | null) {
  const user = await requireUser();

  await db
    .update(payees)
    .set({ defaultCategoryId })
    .where(and(eq(payees.id, id), eq(payees.userId, user.id)));

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  return { success: true };
}
