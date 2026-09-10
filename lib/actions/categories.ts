'use server';

import { db } from '@/lib/db';
import { categories, categoryGroups, transactions } from '@/lib/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export interface CategoryWithStats {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  isArchived: boolean;
  totalSpentCents: number;
  transactionCount: number;
}

export interface CategoryGroupWithStats {
  id: string;
  name: string;
  sortOrder: number;
  categories: CategoryWithStats[];
  totalSpentCents: number;
}

export type CategoryGroupWithChildren = CategoryGroupWithStats;

export async function getCategoryGroupsWithCategories(): Promise<CategoryGroupWithChildren[]> {
  return getCategoryGroupsWithStats();
}

export async function getCategoryGroupsWithStats(): Promise<CategoryGroupWithStats[]> {
  const groups = await db.select().from(categoryGroups).orderBy(asc(categoryGroups.sortOrder));
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.isArchived, false))
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  // Compute spending per category (expenses are negative amountCents)
  const txStats = await db
    .select({
      categoryId: transactions.categoryId,
      totalSpent: sql<number>`coalesce(sum(case when ${transactions.amountCents} < 0 then abs(${transactions.amountCents}) else 0 end), 0)`,
      count: sql<number>`count(${transactions.id})`,
    })
    .from(transactions)
    .where(sql`${transactions.categoryId} is not null`)
    .groupBy(transactions.categoryId);

  const statsMap = new Map<string, { totalSpent: number; count: number }>();
  for (const s of txStats) {
    if (s.categoryId) {
      statsMap.set(s.categoryId, {
        totalSpent: Number(s.totalSpent),
        count: Number(s.count),
      });
    }
  }

  return groups.map((g) => {
    const catsInGroup = allCategories
      .filter((c) => c.groupId === g.id)
      .map((c) => {
        const stats = statsMap.get(c.id) || { totalSpent: 0, count: 0 };
        return {
          id: c.id,
          groupId: c.groupId,
          name: c.name,
          sortOrder: c.sortOrder,
          isArchived: c.isArchived,
          totalSpentCents: stats.totalSpent,
          transactionCount: stats.count,
        };
      });

    const groupTotal = catsInGroup.reduce((acc, c) => acc + c.totalSpentCents, 0);

    return {
      id: g.id,
      name: g.name,
      sortOrder: g.sortOrder,
      categories: catsInGroup,
      totalSpentCents: groupTotal,
    };
  });
}

export async function createCategoryGroup(name: string) {
  const id = crypto.randomUUID();
  const existingGroups = await db.select().from(categoryGroups);
  const nextOrder = existingGroups.length + 1;

  db.insert(categoryGroups)
    .values({
      id,
      name: name.trim(),
      sortOrder: nextOrder,
    })
    .run();

  revalidatePath('/categories');
  revalidatePath('/transactions');
  return { success: true, id };
}

export async function createCategory(groupId: string, name: string) {
  const id = crypto.randomUUID();
  const existingInGroup = await db
    .select()
    .from(categories)
    .where(eq(categories.groupId, groupId));
  const nextOrder = existingInGroup.length + 1;

  db.insert(categories)
    .values({
      id,
      groupId,
      name: name.trim(),
      sortOrder: nextOrder,
      isArchived: false,
    })
    .run();

  revalidatePath('/categories');
  revalidatePath('/transactions');
  return { success: true, id };
}

export async function archiveCategory(id: string) {
  db.update(categories)
    .set({ isArchived: true })
    .where(eq(categories.id, id))
    .run();

  revalidatePath('/categories');
  revalidatePath('/transactions');
  return { success: true };
}
