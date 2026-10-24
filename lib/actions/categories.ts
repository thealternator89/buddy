'use server';

import { db } from '@/lib/db';
import { categories, transactions } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { and, asc, eq, sql, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import {
  CategoryNode,
  CategoryFlatItem,
  processCategoryNode,
  flattenCategoryTree,
  sortCategoryTree,
} from '@/lib/category-utils';

export type { CategoryNode, CategoryFlatItem };

/**
 * Fetches the entire non-archived category tree with rollups and metrics for the current user,
 * ordered alphabetically at the root level and within all nested branches.
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const user = await requireUser();

  const allCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, user.id), eq(categories.isArchived, false)))
    .orderBy(asc(categories.name));

  // Compute spending per category (expenses are negative amountCents)
  const txStats = await db
    .select({
      categoryId: transactions.categoryId,
      totalSpent: sql<number>`coalesce(sum(case when ${transactions.amountCents} < 0 then abs(${transactions.amountCents}) else 0 end), 0)`,
      count: sql<number>`count(${transactions.id})`,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), sql`${transactions.categoryId} is not null`))
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

  // Create node map
  const nodeMap = new Map<string, CategoryNode>();
  for (const c of allCategories) {
    const stats = statsMap.get(c.id) || { totalSpent: 0, count: 0 };
    nodeMap.set(c.id, {
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      isArchived: c.isArchived,
      createdAt: c.createdAt,
      children: [],
      depth: 0,
      path: [],
      fullPathName: c.name,
      directSpentCents: stats.totalSpent,
      totalSpentCents: stats.totalSpent,
      directTransactionCount: stats.count,
      totalTransactionCount: stats.count,
    });
  }

  // Assemble tree
  const rootNodes: CategoryNode[] = [];
  for (const c of allCategories) {
    const node = nodeMap.get(c.id)!;
    if (c.parentId && nodeMap.has(c.parentId)) {
      nodeMap.get(c.parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  // Sort root nodes and all nested branches alphabetically
  const sortedRoots = sortCategoryTree(rootNodes);

  // Compute rollups and breadcrumbs
  for (const root of sortedRoots) {
    processCategoryNode(root, [], 0);
  }

  return sortedRoots;
}

/**
 * Returns a pre-sorted flat category list for dropdowns, comboboxes, and search.
 */
export async function getFlatCategories(): Promise<CategoryFlatItem[]> {
  const tree = await getCategoryTree();
  return flattenCategoryTree(tree);
}

/**
 * Helper to retrieve all descendant category IDs (including the given ID itself).
 * Essential for subtree filtering in transactions.
 */
export async function getCategorySubtreeIds(categoryId: string): Promise<string[]> {
  const user = await requireUser();

  const allCategories = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.userId, user.id));

  const childrenMap = new Map<string, string[]>();
  for (const c of allCategories) {
    if (c.parentId) {
      const list = childrenMap.get(c.parentId) || [];
      list.push(c.id);
      childrenMap.set(c.parentId, list);
    }
  }

  const result: string[] = [categoryId];
  const queue: string[] = [categoryId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenMap.get(current) || [];
    for (const childId of children) {
      result.push(childId);
      queue.push(childId);
    }
  }

  return result;
}

/**
 * Helper for cycle detection when moving categories.
 */
async function wouldCreateCycle(categoryId: string, targetParentId: string): Promise<boolean> {
  if (categoryId === targetParentId) return true;
  const descendantIds = await getCategorySubtreeIds(categoryId);
  return descendantIds.includes(targetParentId);
}

/**
 * Create a new category at root or under an existing parent.
 */
export async function createCategory(name: string, parentId?: string | null) {
  const user = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Category name cannot be empty.');
  }

  const pid = parentId && parentId.trim() ? parentId.trim() : null;

  if (pid) {
    const parent = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, pid), eq(categories.userId, user.id)))
      .limit(1);
    if (parent.length === 0) {
      throw new Error('Parent category does not exist.');
    }
  }

  const id = crypto.randomUUID();

  await db.insert(categories).values({
    id,
    userId: user.id,
    name: trimmed,
    parentId: pid,
    isArchived: false,
  });

  revalidateAllCategoryPaths();
  return { success: true, id };
}

/**
 * Update an existing category name and/or parent.
 */
export async function updateCategory(
  id: string,
  data: { name?: string; parentId?: string | null }
) {
  const user = await requireUser();
  const updateData: { name?: string; parentId?: string | null } = {};

  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (!trimmed) {
      throw new Error('Category name cannot be empty.');
    }
    updateData.name = trimmed;
  }

  if (data.parentId !== undefined) {
    const newParentId = data.parentId && data.parentId.trim() ? data.parentId.trim() : null;

    if (newParentId) {
      const parentExists = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, newParentId), eq(categories.userId, user.id)))
        .limit(1);
      if (parentExists.length === 0) {
        throw new Error('Parent category does not exist.');
      }

      if (await wouldCreateCycle(id, newParentId)) {
        throw new Error('Cannot move a category under itself or one of its descendants.');
      }
    }
    updateData.parentId = newParentId;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true };
  }

  await db
    .update(categories)
    .set(updateData)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

  revalidateAllCategoryPaths();
  return { success: true };
}

/**
 * Archives a category and all of its descendant subcategories.
 */
export async function archiveCategory(id: string) {
  const user = await requireUser();
  const subtreeIds = await getCategorySubtreeIds(id);

  await db
    .update(categories)
    .set({ isArchived: true })
    .where(and(eq(categories.userId, user.id), inArray(categories.id, subtreeIds)));

  revalidateAllCategoryPaths();
  return { success: true };
}

/**
 * Delete category if safe (no transactions in subtree).
 */
export async function deleteCategory(id: string) {
  const user = await requireUser();
  const subtreeIds = await getCategorySubtreeIds(id);

  // Check if any category in subtree has transactions for this user
  const txCount = await db
    .select({ count: sql<number>`count(${transactions.id})` })
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), inArray(transactions.categoryId, subtreeIds)));

  const count = Number(txCount[0]?.count || 0);
  if (count > 0) {
    throw new Error(
      `Cannot delete this category because it (or its subcategories) has ${count} associated transaction(s). Archive it instead, or reassign the transactions first.`
    );
  }

  await db
    .delete(categories)
    .where(and(eq(categories.userId, user.id), inArray(categories.id, subtreeIds)));

  revalidateAllCategoryPaths();
  return { success: true };
}

function revalidateAllCategoryPaths() {
  try {
    revalidatePath('/manage');
    revalidatePath('/categories');
    revalidatePath('/budgets');
    revalidatePath('/transactions');
    revalidatePath('/accounts');
    revalidatePath('/');
  } catch {
    // Ignore outside request context
  }
}
