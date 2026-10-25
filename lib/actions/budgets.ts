'use server';

import { db } from '@/lib/db';
import {
  budgets,
  budgetGroups,
  budgetVersions,
  budgetVersionCategories,
  categories,
  transactions,
  BudgetFrequency,
} from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import {
  getBudgetPeriodRange,
  getBudgetPeriodProgress,
  BudgetPeriodRange,
  isoDateToUtcStartOfDay,
  isoDateToUtcEndOfPreviousDay,
  toUtcIsoDateString,
} from '@/lib/utils/budget';
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
  groupId: string | null;
  groupName: string | null;
  groupSortOrder: number | null;
  /** Position among budgets in the same container (ungrouped list or group). */
  sortOrder: number;
  /** Effective flag: true for the one budget in a group shown on the overview page. */
  isOverview: boolean;
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
  daysRemaining: number;
  totalDays: number;
  daysElapsed: number;
  periodPercentElapsed: number;
}

export type BudgetUpdateMode = 'current_cycle' | 'replace_all';

export interface BudgetMutationInput {
  name: string;
  frequency: BudgetFrequency;
  amountCents: number;
  categoryIds: string[];
  updateMode?: BudgetUpdateMode;
  /** Group name; empty/null removes the budget from any group, undefined leaves it unchanged. */
  groupName?: string | null;
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
      groupId: budgets.groupId,
      groupName: budgetGroups.name,
      groupSortOrder: budgetGroups.sortOrder,
      sortOrder: budgets.sortOrder,
      budgetIsOverview: budgets.isOverview,
      versionId: budgetVersions.id,
      versionNumber: budgetVersions.versionNumber,
      frequency: budgetVersions.frequency,
      amountCents: budgetVersions.amountCents,
      effectiveFrom: budgetVersions.effectiveFrom,
    })
    .from(budgetVersions)
    .innerJoin(budgets, eq(budgetVersions.budgetId, budgets.id))
    .leftJoin(budgetGroups, eq(budgets.groupId, budgetGroups.id))
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
              eq(transactions.excludeFromBudgets, false),
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
      const progress = getBudgetPeriodProgress(period, todayStr);

      return {
        budgetId: row.budgetId,
        versionId: row.versionId,
        versionNumber: row.versionNumber,
        name: row.name,
        groupId: row.groupId,
        groupName: row.groupName,
        groupSortOrder: row.groupSortOrder,
        sortOrder: row.sortOrder,
        isOverview: false, // resolved below once all budgets are known
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
        daysRemaining: progress.daysRemaining,
        totalDays: progress.totalDays,
        daysElapsed: progress.daysElapsed,
        periodPercentElapsed: progress.percentElapsed,
      };
    }
  );

  // Resolve the effective overview budget per group: the flagged budget, otherwise the
  // earliest-created member.
  const flaggedByBudgetId = new Map(activeRows.map((r) => [r.budgetId, r.budgetIsOverview]));
  const membersByGroup = new Map<string, BudgetWithStatus[]>();
  for (const r of results) {
    if (!r.groupId) continue;
    const list = membersByGroup.get(r.groupId) || [];
    list.push(r);
    membersByGroup.set(r.groupId, list);
  }
  for (const members of membersByGroup.values()) {
    const chosen =
      members.find((m) => flaggedByBudgetId.get(m.budgetId)) ||
      [...members].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    chosen.isOverview = true;
  }

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
    updateMode: input.updateMode === 'replace_all' ? 'replace_all' : ('current_cycle' as const),
  };
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Finds (case-insensitively) or creates the user's budget group with the given name.
 * Returns null for an empty name (i.e. ungrouped).
 */
async function resolveGroupId(
  tx: DbTransaction,
  userId: string,
  groupName: string | null | undefined
): Promise<string | null> {
  const name = (groupName ?? '').trim();
  if (!name) return null;

  const existing = await tx
    .select({ id: budgetGroups.id })
    .from(budgetGroups)
    .where(
      and(eq(budgetGroups.userId, userId), sql`lower(${budgetGroups.name}) = lower(${name})`)
    )
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const maxRows = await tx
    .select({ maxOrder: sql<number>`coalesce(max(${budgetGroups.sortOrder}), 0)` })
    .from(budgetGroups)
    .where(eq(budgetGroups.userId, userId));

  const id = crypto.randomUUID();
  await tx
    .insert(budgetGroups)
    .values({ id, userId, name, sortOrder: Number(maxRows[0]?.maxOrder ?? 0) + 1 });
  return id;
}

/** Next sortOrder for appending a budget to the end of a container (a group, or ungrouped). */
async function nextBudgetSortOrder(
  tx: DbTransaction,
  userId: string,
  groupId: string | null,
  excludeBudgetId?: string
) {
  const rows = await tx
    .select({ maxOrder: sql<number>`coalesce(max(${budgets.sortOrder}), 0)` })
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        groupId ? eq(budgets.groupId, groupId) : isNull(budgets.groupId),
        excludeBudgetId ? ne(budgets.id, excludeBudgetId) : undefined
      )
    );
  return Number(rows[0]?.maxOrder ?? 0) + 1;
}

async function countGroupMembers(
  tx: DbTransaction,
  userId: string,
  groupId: string,
  excludeBudgetId?: string
) {
  const rows = await tx
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.groupId, groupId),
        excludeBudgetId ? ne(budgets.id, excludeBudgetId) : undefined
      )
    );
  return rows.length;
}

async function deleteGroupIfEmpty(tx: DbTransaction, userId: string, groupId: string | null) {
  if (!groupId) return;
  if ((await countGroupMembers(tx, userId, groupId)) === 0) {
    await tx
      .delete(budgetGroups)
      .where(and(eq(budgetGroups.id, groupId), eq(budgetGroups.userId, userId)));
  }
}

/**
 * Moves a budget into a group (or out of all groups when `newGroupId` is null). A budget that
 * joins an empty group becomes its overview budget; the previous group is removed if emptied.
 */
async function moveBudgetToGroup(
  tx: DbTransaction,
  userId: string,
  budgetId: string,
  oldGroupId: string | null,
  newGroupId: string | null
) {
  const becomesOverview =
    newGroupId !== null && (await countGroupMembers(tx, userId, newGroupId, budgetId)) === 0;

  await tx
    .update(budgets)
    .set({
      groupId: newGroupId,
      isOverview: becomesOverview,
      sortOrder: await nextBudgetSortOrder(tx, userId, newGroupId, budgetId),
      updatedAt: new Date(),
    })
    .where(and(eq(budgets.id, budgetId), eq(budgets.userId, userId)));

  await deleteGroupIfEmpty(tx, userId, oldGroupId);
}

/**
 * Creates a new budget along with its initial version (versionNumber = 1),
 * effective from the start of the current budget cycle.
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
  const period = getBudgetPeriodRange(validated.frequency);
  const effectiveFrom = isoDateToUtcStartOfDay(period.startDate);

  await db.transaction(async (tx) => {
    const groupId = await resolveGroupId(tx, user.id, input.groupName);
    const isOverview =
      groupId !== null && (await countGroupMembers(tx, user.id, groupId)) === 0;
    const sortOrder = await nextBudgetSortOrder(tx, user.id, groupId);

    await tx.insert(budgets).values({
      id: budgetId,
      userId: user.id,
      name: validated.name,
      groupId,
      isOverview,
      sortOrder,
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
      effectiveFrom,
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
 * Updates an existing budget according to `updateMode`:
 * - `'replace_all'`: Removes all existing versions for the budget and sets the updated state
 *   as the sole configuration (`versionNumber = 1`), effective from the start of the current cycle.
 * - `'current_cycle'` (default): Takes effect from the start of the current cycle of the updated config.
 *   - Deactivates the existing budget version as at the end of the previous period (`effectiveTo` =
 *     the day immediately before the new period starts, even if that ends a partial period when
 *     changing frequencies e.g. weekly -> monthly).
 *   - Starts the new version from the start of the current period (`effectiveFrom` = start of new period).
 *   - If the existing active budget version already started at (or after) the start of the current
 *     period, it is replaced in-place rather than creating a new version.
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

  const allVersionRows = await db
    .select()
    .from(budgetVersions)
    .where(and(eq(budgetVersions.budgetId, budgetId), eq(budgetVersions.userId, user.id)))
    .orderBy(desc(budgetVersions.versionNumber));

  const activeVersion = allVersionRows.find((v) => v.isActive);
  if (!activeVersion) {
    throw new Error('Active budget version not found.');
  }

  // Verify categories belong to user
  const validCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, user.id), inArray(categories.id, validated.categoryIds)));

  if (validCategories.length !== validated.categoryIds.length) {
    throw new Error('One or more selected categories do not exist.');
  }

  // Group changes are independent of versioning, so apply them first.
  if (input.groupName !== undefined) {
    await db.transaction(async (tx) => {
      const newGroupId = await resolveGroupId(tx, user.id, input.groupName);
      if (newGroupId !== existingBudget.groupId) {
        await moveBudgetToGroup(tx, user.id, budgetId, existingBudget.groupId, newGroupId);
      }
    });
    safeRevalidateBudgetPaths();
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

  const now = new Date();
  const newPeriod = getBudgetPeriodRange(validated.frequency);
  const cycleStartUtc = isoDateToUtcStartOfDay(newPeriod.startDate);
  const prevPeriodEndUtc = isoDateToUtcEndOfPreviousDay(newPeriod.startDate);

  if (validated.updateMode === 'replace_all') {
    const hasMultipleOrHigherVersion =
      allVersionRows.length > 1 || activeVersion.versionNumber !== 1;

    if (!nameChanged && !versionFieldsChanged && !hasMultipleOrHigherVersion) {
      return { success: true, versionCreated: false };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(budgets)
        .set({
          name: validated.name,
          updatedAt: now,
        })
        .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)));

      // Delete all existing versions for this budget (cascades to budgetVersionCategories)
      await tx
        .delete(budgetVersions)
        .where(and(eq(budgetVersions.budgetId, budgetId), eq(budgetVersions.userId, user.id)));

      // Insert single replacement version (v1)
      const newVersionId = crypto.randomUUID();
      await tx.insert(budgetVersions).values({
        id: newVersionId,
        budgetId,
        userId: user.id,
        versionNumber: 1,
        frequency: validated.frequency,
        amountCents: validated.amountCents,
        isActive: true,
        effectiveFrom: cycleStartUtc,
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
    });

    safeRevalidateBudgetPaths();
    return { success: true, versionCreated: false, replacedAll: true };
  }

  // Mode: 'current_cycle'
  if (!nameChanged && !versionFieldsChanged) {
    return { success: true, versionCreated: false };
  }

  // Check whether any existing versions started before the current cycle's start date
  const versionsBeforeCurrentCycle = allVersionRows.filter(
    (v) => toUtcIsoDateString(v.effectiveFrom) < newPeriod.startDate
  );
  const versionsOnOrAfterCurrentCycle = allVersionRows.filter(
    (v) => toUtcIsoDateString(v.effectiveFrom) >= newPeriod.startDate
  );

  // If the active version already started on or after the start of the current period,
  // we replace it in-place rather than deactivating it and creating a duplicate version for the same period.
  const activeStartedInCurrentCycle =
    toUtcIsoDateString(activeVersion.effectiveFrom) >= newPeriod.startDate;

  let versionCreated = false;

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
      if (activeStartedInCurrentCycle) {
        // Delete any other deactivated versions that also started on/after the current cycle start
        const extraSameCycleIds = versionsOnOrAfterCurrentCycle
          .filter((v) => v.id !== activeVersion.id)
          .map((v) => v.id);

        if (extraSameCycleIds.length > 0) {
          await tx
            .delete(budgetVersions)
            .where(inArray(budgetVersions.id, extraSameCycleIds));
        }

        // Ensure the most recent version prior to this cycle ends right at prevPeriodEndUtc
        const latestPriorVersion = versionsBeforeCurrentCycle[0];
        if (latestPriorVersion) {
          await tx
            .update(budgetVersions)
            .set({
              isActive: false,
              effectiveTo: prevPeriodEndUtc,
            })
            .where(eq(budgetVersions.id, latestPriorVersion.id));
        }

        const targetVersionNumber = latestPriorVersion
          ? latestPriorVersion.versionNumber + 1
          : 1;

        // Replace the active version in-place
        await tx
          .update(budgetVersions)
          .set({
            versionNumber: targetVersionNumber,
            frequency: validated.frequency,
            amountCents: validated.amountCents,
            isActive: true,
            effectiveFrom: cycleStartUtc,
            effectiveTo: null,
          })
          .where(eq(budgetVersions.id, activeVersion.id));

        await tx
          .delete(budgetVersionCategories)
          .where(eq(budgetVersionCategories.budgetVersionId, activeVersion.id));

        await tx.insert(budgetVersionCategories).values(
          validated.categoryIds.map((categoryId) => ({
            id: crypto.randomUUID(),
            budgetVersionId: activeVersion.id,
            categoryId,
          }))
        );
      } else {
        // Active version started before the current cycle:
        // Deactivate the existing active version as at the end of the previous cycle
        await tx
          .update(budgetVersions)
          .set({
            isActive: false,
            effectiveTo: prevPeriodEndUtc,
          })
          .where(eq(budgetVersions.id, activeVersion.id));

        // Create new version starting from the current cycle
        const newVersionId = crypto.randomUUID();
        await tx.insert(budgetVersions).values({
          id: newVersionId,
          budgetId,
          userId: user.id,
          versionNumber: activeVersion.versionNumber + 1,
          frequency: validated.frequency,
          amountCents: validated.amountCents,
          isActive: true,
          effectiveFrom: cycleStartUtc,
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

        versionCreated = true;
      }
    }
  });

  safeRevalidateBudgetPaths();
  return { success: true, versionCreated };
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

    const existing = await tx
      .select({ groupId: budgets.groupId })
      .from(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)))
      .limit(1);

    await tx
      .update(budgets)
      .set({ updatedAt: now, groupId: null, isOverview: false })
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)));

    // Leaving the group; remove it if empty (remaining members fall back to the default overview budget).
    await deleteGroupIfEmpty(tx, user.id, existing[0]?.groupId ?? null);
  });

  safeRevalidateBudgetPaths();
  return { success: true };
}

/**
 * Marks a grouped budget as the one shown on the overview page for its group.
 */
export async function setOverviewBudget(budgetId: string) {
  const user = await requireUser();

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ groupId: budgets.groupId })
      .from(budgets)
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)))
      .limit(1);

    if (rows.length === 0) {
      throw new Error('Budget not found.');
    }
    const groupId = rows[0].groupId;
    if (!groupId) {
      throw new Error('Budget is not in a group.');
    }

    await tx
      .update(budgets)
      .set({ isOverview: false })
      .where(and(eq(budgets.groupId, groupId), eq(budgets.userId, user.id)));

    await tx
      .update(budgets)
      .set({ isOverview: true, updatedAt: new Date() })
      .where(and(eq(budgets.id, budgetId), eq(budgets.userId, user.id)));
  });

  safeRevalidateBudgetPaths();
  return { success: true };
}

/**
 * Persists a custom ordering of budgets within one container (ungrouped list or a group).
 * `orderedBudgetIds` is the full container in its new order.
 */
export async function reorderBudgets(orderedBudgetIds: string[]) {
  const user = await requireUser();

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedBudgetIds.length; i++) {
      await tx
        .update(budgets)
        .set({ sortOrder: i + 1 })
        .where(and(eq(budgets.id, orderedBudgetIds[i]), eq(budgets.userId, user.id)));
    }
  });

  safeRevalidateBudgetPaths();
  return { success: true };
}

/**
 * Persists a custom ordering of budget groups.
 */
export async function reorderBudgetGroups(orderedGroupIds: string[]) {
  const user = await requireUser();

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedGroupIds.length; i++) {
      await tx
        .update(budgetGroups)
        .set({ sortOrder: i + 1 })
        .where(and(eq(budgetGroups.id, orderedGroupIds[i]), eq(budgetGroups.userId, user.id)));
    }
  });

  safeRevalidateBudgetPaths();
  return { success: true };
}
