'use server';

import { db, sqlite } from '@/lib/db';
import { payees, categories, transactions, payeeRules } from '@/lib/db/schema';
import { PayeeRuleItem, RuleOperator } from '@/lib/payee-rules';
import { and, asc, eq, sql } from 'drizzle-orm';
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

export interface PayeeWithStats {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  defaultCategoryName: string | null;
  parentCategoryName: string | null;
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
  createdAt: Date;
  rules: PayeeRuleItem[];
}

export interface CreatePayeeRuleInput {
  categoryId: string;
  operator: RuleOperator;
  amountCents: number;
}

export async function getPayees(): Promise<PayeeWithRules[]> {
  const allPayees = await db.select().from(payees).orderBy(asc(payees.name));

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
    .leftJoin(categories, eq(payeeRules.categoryId, categories.id))
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
    rules: rulesMap.get(p.id) || [],
  }));
}

export async function getPayeesWithStats(): Promise<PayeeWithStats[]> {
  const parentCategories = alias(categories, 'parent_categories');
  const ruleParentCategories = alias(categories, 'rule_parent_categories');

  const allPayees = await db
    .select({
      id: payees.id,
      name: payees.name,
      defaultCategoryId: payees.defaultCategoryId,
      defaultCategoryName: categories.name,
      parentCategoryName: parentCategories.name,
      createdAt: payees.createdAt,
    })
    .from(payees)
    .leftJoin(categories, eq(payees.defaultCategoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .orderBy(asc(payees.name));

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
    .leftJoin(categories, eq(payeeRules.categoryId, categories.id))
    .leftJoin(ruleParentCategories, eq(categories.parentId, ruleParentCategories.id))
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
      parentCategoryName: p.parentCategoryName || null,
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
  rules?: CreatePayeeRuleInput[]
) {
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
  sqlite.transaction(() => {
    db.insert(payees)
      .values({
        id,
        name: trimmed,
        defaultCategoryId: defaultCategoryId || null,
      })
      .run();

    if (rules && rules.length > 0) {
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        db.insert(payeeRules)
          .values({
            id: crypto.randomUUID(),
            payeeId: id,
            categoryId: r.categoryId,
            operator: r.operator,
            amountCents: r.amountCents,
            sortOrder: i,
          })
          .run();
      }
    }
  })();

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/');
  return { success: true, id, name: trimmed };
}

export async function updatePayee(
  id: string,
  data: {
    name: string;
    defaultCategoryId?: string | null;
    rules?: CreatePayeeRuleInput[];
  }
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

  sqlite.transaction(() => {
    db.update(payees)
      .set({
        name: trimmed,
        defaultCategoryId: data.defaultCategoryId || null,
      })
      .where(eq(payees.id, id))
      .run();

    if (data.rules !== undefined) {
      db.delete(payeeRules).where(eq(payeeRules.payeeId, id)).run();
      for (let i = 0; i < data.rules.length; i++) {
        const r = data.rules[i];
        db.insert(payeeRules)
          .values({
            id: crypto.randomUUID(),
            payeeId: id,
            categoryId: r.categoryId,
            operator: r.operator,
            amountCents: r.amountCents,
            sortOrder: i,
          })
          .run();
      }
    }
  })();

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/');
  return { success: true };
}

export async function deletePayee(id: string) {
  sqlite.transaction(() => {
    db.delete(payeeRules).where(eq(payeeRules.payeeId, id)).run();
    db.delete(payees).where(eq(payees.id, id)).run();
  })();

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  safeRevalidatePath('/accounts');
  safeRevalidatePath('/');
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

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  return { id, name: trimmed, defaultCategoryId: defaultCategoryId || null };
}

export async function updatePayeeDefaultCategory(id: string, defaultCategoryId: string | null) {
  db.update(payees)
    .set({ defaultCategoryId })
    .where(eq(payees.id, id))
    .run();

  safeRevalidatePath('/manage');
  safeRevalidatePath('/categories');
  safeRevalidatePath('/transactions');
  return { success: true };
}
