'use server';

import { db } from '@/lib/db';
import { categories, transactions } from '@/lib/db/schema';
import { asc, eq, sql, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import {
  CategoryNode,
  CategoryFlatItem,
  processCategoryNode,
  flattenCategoryTree,
} from '@/lib/category-utils';

export type { CategoryNode, CategoryFlatItem };

/**
 * Fetches the entire non-archived category tree with rollups and metrics.
 */
export async function getCategoryTree(): Promise<CategoryNode[]> {
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

  // Create node map
  const nodeMap = new Map<string, CategoryNode>();
  for (const c of allCategories) {
    const stats = statsMap.get(c.id) || { totalSpent: 0, count: 0 };
    nodeMap.set(c.id, {
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      sortOrder: c.sortOrder,
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

  // Compute rollups and breadcrumbs
  for (const root of rootNodes) {
    processCategoryNode(root, [], 0);
  }

  return rootNodes;
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
  const allCategories = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories);

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
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Category name cannot be empty.');
  }

  const pid = parentId && parentId.trim() ? parentId.trim() : null;

  if (pid) {
    const parent = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, pid))
      .limit(1);
    if (parent.length === 0) {
      throw new Error('Parent category does not exist.');
    }
  }

  const existingSiblings = await db
    .select({ id: categories.id })
    .from(categories)
    .where(pid ? eq(categories.parentId, pid) : sql`${categories.parentId} IS NULL`);

  const id = crypto.randomUUID();
  const nextOrder = existingSiblings.length + 1;

  db.insert(categories)
    .values({
      id,
      name: trimmed,
      parentId: pid,
      sortOrder: nextOrder,
      isArchived: false,
    })
    .run();

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
      if (await wouldCreateCycle(id, newParentId)) {
        throw new Error('Cannot move a category under itself or one of its descendants.');
      }
    }
    updateData.parentId = newParentId;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: true };
  }

  db.update(categories)
    .set(updateData)
    .where(eq(categories.id, id))
    .run();

  revalidateAllCategoryPaths();
  return { success: true };
}

/**
 * Archives a category and all of its descendant subcategories.
 */
export async function archiveCategory(id: string) {
  const subtreeIds = await getCategorySubtreeIds(id);

  db.update(categories)
    .set({ isArchived: true })
    .where(inArray(categories.id, subtreeIds))
    .run();

  revalidateAllCategoryPaths();
  return { success: true };
}

/**
 * Delete category if safe (no transactions in subtree).
 */
export async function deleteCategory(id: string) {
  const subtreeIds = await getCategorySubtreeIds(id);

  // Check if any category in subtree has transactions
  const txCount = await db
    .select({ count: sql<number>`count(${transactions.id})` })
    .from(transactions)
    .where(inArray(transactions.categoryId, subtreeIds));

  const count = Number(txCount[0]?.count || 0);
  if (count > 0) {
    throw new Error(
      `Cannot delete this category because it (or its subcategories) has ${count} associated transaction(s). Archive it instead, or reassign the transactions first.`
    );
  }

  db.delete(categories)
    .where(inArray(categories.id, subtreeIds))
    .run();

  revalidateAllCategoryPaths();
  return { success: true };
}

function revalidateAllCategoryPaths() {
  revalidatePath('/manage');
  revalidatePath('/categories');
  revalidatePath('/transactions');
  revalidatePath('/accounts');
  revalidatePath('/');
}
