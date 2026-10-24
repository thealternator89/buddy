'use server';

import { db } from '@/lib/db';
import {
  budgets,
  budgetVersions,
  budgetVersionCategories,
  categories,
  transactions,
  BudgetFrequency,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { getBudgetPeriodRange, BudgetPeriodRange } from '@/lib/utils/budget';
import { getLocalTodayIso } from '@/lib/utils/scheduled';

function safeRevalidateBudgetPaths() {
  try {
    revalidatePath('/');
    revalidatePath('/budgets');
  } catch {
    // Ignore outside request context
  }
}

export interface BudgetCategoryItem {
  id: string;
  name: string;
  fullPathName: string;
}

export interface BudgetWithStatus {
  budgetId: string;
  versionId: string;
  versionNumber: number;
  name: string;
  frequency: BudgetFrequency;
  amountCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number; // e.g. 75.4 (unclamped, can exceed 100)
  categories: BudgetCategoryItem[];
  categoryIds: string[];
  period: BudgetPeriodRange;
  effectiveFrom: Date;
  createdAt: Date;
}

export interface BudgetMutationInput {
  name: string;
  frequency: BudgetFrequency;
  amountCents: number;
  categoryIds: string[];
}

/**
 * Builds a map of category metadata (fullPathName) and descendant ID sets for a user's categories.
 */
function buildCategoryHierarchyMaps(
  allCategories: { id: string; name: string; parentId: string | null }[]
) {
  const byId = new Map<string, { id: string; name: string; parentId: string | null }>();
  const childrenMap = new Map<string, string[]>();

  for (const c of allCategories) {
    byId.set(c.id, c);
    if (c.parentId) {
      const list = childrenMap.get(c.parentId) || [];
      list.push(c.id);
      childrenMap.set(c.parentId, list);
    }
  }

  const fullPathMap = new Map<string, string>();
  for (const c of allCategories) {
    const parts: string[] = [c.name];
    let currParentId = c.parentId;
    const visited = new Set<string>([c.id]);
    while (currParentId && byId.has(currParentId) && !visited.has(currParentId)) {
      visited.add(currParentId);
      const parent = byId.get(currParentId)!;
      parts.unshift(parent.name);
      currParentId = parent.parentId;
    }
    fullPathMap.set(c.id, parts.join(' > '));
  }

  const subtreeMap = new Map<string, Set<string>>();
  for (const c of allCategories) {
    const set = new Set<string>([c.id]);
    const queue: string[] = [c.id];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const kids = childrenMap.get(curr) || [];
      for (const kid of kids) {
        if (!set.has(kid)) {
          set.add(kid);
          queue.push(kid);
        }
      }
    }
    subtreeMap.set(c.id, set);
  }

  return { byId, fullPathMap, subtreeMap };
}

/**
 * Fetches all currently active budgets for the authenticated user, computes their current period
 * spending (including subcategory rollups and net of refunds), and returns them sorted by
 * highest percentage of budget used first.
 */
export async function getActiveBudgetsWithStatus(
  todayStr: string = getLocalTodayIso()
): Promise<BudgetWithStatus[]> {
  const user = await requireUser();

  const activeRows = await db
    .select({
      budgetId: budgets.id,
      name: budgets.name,
      budgetCreatedAt: budgets.createdAt,
      versionId: budgetVersions.id,
      versionNumber: budgetVersions.versionNumber,
      frequency: budgetVersions.frequency,
      amountCents: budgetVersions.amountCents,
      effectiveFrom: budgetVersions.effectiveFrom,
    })
    .from(budgetVersions)
    .innerJoin(budgets, eq(budgetVersions.budgetId, budgets.id))
    .where(and(eq(budgetVersions.userId, user.id), eq(budgetVersions.isActive, true)));

  if (activeRows.length === 0) {
    return [];
  }

  const versionIds = activeRows.map((r) => r.versionId);

  const [versionCategories, allUserCategories] = await Promise.all([
    db
      .select({
        budgetVersionId: budgetVersionCategories.budgetVersionId,
        categoryId: budgetVersionCategories.categoryId,
      })
      .from(budgetVersionCategories)
      .where(inArray(budgetVersionCategories.budgetVersionId, versionIds)),
    db
      .select({
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
      })
      .from(categories)
      .where(eq(categories.userId, user.id))
      .orderBy(asc(categories.name)),
  ]);

  const { byId, fullPathMap, subtreeMap } = buildCategoryHierarchyMaps(allUserCategories);

  // Group direct categoryIds by versionId
  const versionCategoryIdsMap = new Map<string, string[]>();
  for (const vc of versionCategories) {
    const list = versionCategoryIdsMap.get(vc.budgetVersionId) || [];
    list.push(vc.categoryId);
    versionCategoryIdsMap.set(vc.budgetVersionId, list);
  }

  // Compute period ranges and expanded category sets for each active budget
  let minStartDate: string | null = null;
  let maxEndDate: string | null = null;
  const allTargetCategoryIds = new Set<string>();

  const preparedBudgets = activeRows.map((row) => {
    const period = getBudgetPeriodRange(row.frequency, todayStr);
    if (!minStartDate || period.startDate < minStartDate) {
      minStartDate = period.startDate;
    }
    if (!maxEndDate || period.endDate > maxEndDate) {
      maxEndDate = period.endDate;
    }

    const directCatIds = versionCategoryIdsMap.get(row.versionId) || [];
    const expandedCatIds = new Set<string>();
    const categoryItems: BudgetCategoryItem[] = [];

    for (const catId of directCatIds) {
      const cat = byId.get(catId);
      if (cat) {
        categoryItems.push({
          id: cat.id,
          name: cat.name,
          fullPathName: fullPathMap.get(cat.id) || cat.name,
        });
      }
      const subtree = subtreeMap.get(catId);
      if (subtree) {
        subtree.forEach((id) => {
          expandedCatIds.add(id);
          allTargetCategoryIds.add(id);
        });
      } else {
        expandedCatIds.add(catId);
        allTargetCategoryIds.add(catId);
      }
    }

    categoryItems.sort((a, b) => a.fullPathName.localeCompare(b.fullPathName));

    return {
      row,
      period,
      directCatIds,
      expandedCatIds,
      categoryItems,
    };
  });

  // Fetch matching transactions across the active date window
  const matchingTransactions =
    allTargetCategoryIds.size > 0 && minStartDate && maxEndDate
      ? await db
          .select({
            categoryId: transactions.categoryId,
            amountCents: transactions.amountCents,
            date: transactions.date,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, user.id),
              inArray(transactions.categoryId, Array.from(allTargetCategoryIds)),
              gte(transactions.date, minStartDate),
              lte(transactions.date, maxEndDate)
            )
          )
      : [];

  // Aggregate net spending per budget
  const results: BudgetWithStatus[] = preparedBudgets.map(
    ({ row, period, directCatIds, expandedCatIds, categoryItems }) => {
      let netSignedSum = 0; // sum of signed amountCents (outflows are negative, inflows/refunds are positive)
      for (const tx of matchingTransactions) {
        if (
          tx.categoryId &&
          tx.date >= period.startDate &&
          tx.date <= period.endDate &&
          expandedCatIds.has(tx.categoryId)
        ) {
          netSignedSum += tx.amountCents;
        }
      }

      // Net spending is -netSignedSum floored at 0
      const spentCents = Math.max(0, -netSignedSum);
      const remainingCents = row.amountCents - spentCents;
      const percentUsed = row.amountCents > 0 ? (spentCents / row.amountCents) * 100 : 0;

      return {
        budgetId: row.budgetId,
        versionId: row.versionId,
        versionNumber: row.versionNumber,
        name: row.name,
        frequency: row.frequency,
        amountCents: row.amountCents,
        spentCents,
        remainingCents,
        percentUsed,
        categories: categoryItems,
        categoryIds: directCatIds,
        period,
        effectiveFrom: row.effectiveFrom,
        createdAt: row.budgetCreatedAt,
      };
    }
  );

  // Sort by highest budget % used first
  results.sort((a, b) => {
    if (b.percentUsed !== a.percentUsed) {
      return b.percentUsed - a.percentUsed;
    }
    if (b.spentCents !== a.spentCents) {
      return b.spentCents - a.spentCents;
    }
    return a.name.localeCompare(b.name);
  });

  return results;
}

function validateBudgetInput(input: BudgetMutationInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Budget name is required.');
  }

  if (!['weekly', 'monthly', 'yearly'].includes(input.frequency)) {
    throw new Error('Invalid budget frequency.');
  }

  const amountCents = Math.round(Math.abs(input.amountCents));
  if (amountCents <= 0) {
    throw new Error('Budget amount must be greater than zero.');
  }

  const uniqueCategoryIds = Array.from(
    new Set(input.categoryIds.map((id) => id.trim()).filter(Boolean))
  );
  if (uniqueCategoryIds.length === 0) {
    throw new Error('Please select at least one category for this budget.');
  }

  return {
    name,
    frequency: input.frequency,
    amountCents,
    categoryIds: uniqueCategoryIds.sort(),
  };
}

/**
 * Creates a new budget along with its initial version (versionNumber = 1).
 */
export async function createBudget(input: BudgetMutationInput) {
  const user = await requireUser();
  const validated = validateBudgetInput(input);

  // Verify categories belong to user
  const validCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, user.id), inArray(categories.id, validated.categoryIds)));

  if (validCategories.length !== validated.categoryIds.length) {
    throw new Error('One or more selected categories do not exist.');
  }

  const budgetId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(budgets).values({
      id: budgetId,
      userId: user.id,
      name: validated.name,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(budgetVersions).values({
      id: versionId,
      budgetId,
      userId: user.id,
      versionNumber: 1,
      frequency: validated.frequency,
      amountCents: validated.amountCents,
      isActive: true,
      effectiveFrom: now,
      effectiveTo: null,
      createdAt: now,
    });

    await tx.insert(budgetVersionCategories).values(
      validated.categoryIds.map((categoryId) => ({
        id: crypto.randomUUID(),
        budgetVersionId: versionId,
        categoryId,
      }))
    );
  });

  safeRevalidateBudgetPaths();
  return { success: true, budgetId, versionId };
}

/**
 * Updates an existing budget:
 * - Modifying `name` updates the `budgets` record in-place without creating a new version.
 * - Modifying `frequency`, `amountCents`, or `categoryIds` deactivates the current active
 *   `budget_versions` record (`isActive = false`, `effectiveTo = now`) and inserts a new active
 *   version (`versionNumber = prev + 1`, `effectiveFrom = now`).
 */
export async function updateBudget(budgetId: string, input: BudgetMutationInput) {
  const user = await requireUser();
  const validated = validateBudgetInput(input);

  const existingBudgetRows = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)))
    .limit(1);

  if (existingBudgetRows.length === 0) {
    throw new Error('Budget not found.');
  }
  const existingBudget = existingBudgetRows[0];

  const activeVersionRows = await db
    .select()
    .from(budgetVersions)
    .where(
      and(
        eq(budgetVersions.budgetId, budgetId),
        eq(budgetVersions.userId, user.id),
        eq(budgetVersions.isActive, true)
      )
    )
    .limit(1);

  if (activeVersionRows.length === 0) {
    throw new Error('Active budget version not found.');
  }
  const activeVersion = activeVersionRows[0];

  // Verify categories belong to user
  const validCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, user.id), inArray(categories.id, validated.categoryIds)));

  if (validCategories.length !== validated.categoryIds.length) {
    throw new Error('One or more selected categories do not exist.');
  }

  const currentVersionCats = await db
    .select({ categoryId: budgetVersionCategories.categoryId })
    .from(budgetVersionCategories)
    .where(eq(budgetVersionCategories.budgetVersionId, activeVersion.id));

  const currentCategoryIds = currentVersionCats.map((c) => c.categoryId).sort();

  const nameChanged = existingBudget.name !== validated.name;
  const categoriesChanged =
    currentCategoryIds.length !== validated.categoryIds.length ||
    currentCategoryIds.some((id, idx) => id !== validated.categoryIds[idx]);
  const versionFieldsChanged =
    activeVersion.frequency !== validated.frequency ||
    activeVersion.amountCents !== validated.amountCents ||
    categoriesChanged;

  if (!nameChanged && !versionFieldsChanged) {
    return { success: true, versionCreated: false };
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    if (nameChanged || versionFieldsChanged) {
      await tx
        .update(budgets)
        .set({
          name: validated.name,
          updatedAt: now,
        })
        .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)));
    }

    if (versionFieldsChanged) {
      // Deactivate current version
      await tx
        .update(budgetVersions)
        .set({
          isActive: false,
          effectiveTo: now,
        })
        .where(eq(budgetVersions.id, activeVersion.id));

      // Create new version
      const newVersionId = crypto.randomUUID();
      await tx.insert(budgetVersions).values({
        id: newVersionId,
        budgetId,
        userId: user.id,
        versionNumber: activeVersion.versionNumber + 1,
        frequency: validated.frequency,
        amountCents: validated.amountCents,
        isActive: true,
        effectiveFrom: now,
        effectiveTo: null,
        createdAt: now,
      });

      await tx.insert(budgetVersionCategories).values(
        validated.categoryIds.map((categoryId) => ({
          id: crypto.randomUUID(),
          budgetVersionId: newVersionId,
          categoryId,
        }))
      );
    }
  });

  safeRevalidateBudgetPaths();
  return { success: true, versionCreated: versionFieldsChanged };
}

/**
 * Deactivates the active version of a budget so it is no longer active while preserving
 * historical version records.
 */
export async function deactivateBudget(budgetId: string) {
  const user = await requireUser();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(budgetVersions)
      .set({
        isActive: false,
        effectiveTo: now,
      })
      .where(
        and(
          eq(budgetVersions.budgetId, budgetId),
          eq(budgetVersions.userId, user.id),
          eq(budgetVersions.isActive, true)
        )
      );

    await tx
      .update(budgets)
      .set({ updatedAt: now })
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)));
  });

  safeRevalidateBudgetPaths();
  return { success: true };
}
