'use client';

import { useState, useTransition, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  PieChart,
  PlusCircle,
  Search,
  Pencil,
  Trash2,
  Repeat,
  Calendar,
  FolderOpen,
  Star,
  GripVertical,
} from 'lucide-react';
import {
  BudgetWithStatus,
  setOverviewBudget,
  reorderBudgets,
  reorderBudgetGroups,
} from '@/lib/actions/budgets';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { formatCurrency } from '@/lib/utils/currency';
import { BUDGET_FREQUENCY_LABELS, BudgetFrequency } from '@/lib/utils/budget';
import { CircularProgress } from './CircularProgress';
import { BudgetModal } from './BudgetModal';
import { DeleteBudgetModal } from './DeleteBudgetModal';

interface BudgetsClientViewProps {
  budgets: BudgetWithStatus[];
  categories: (CategoryNode | CategoryFlatItem)[];
}

export function BudgetsClientView({
  budgets: serverBudgets,
  categories,
}: BudgetsClientViewProps) {
  // Local copy for optimistic reordering; re-synced whenever fresh server data arrives.
  const [budgets, setBudgets] = useState(serverBudgets);
  const [prevServerBudgets, setPrevServerBudgets] = useState(serverBudgets);
  if (serverBudgets !== prevServerBudgets) {
    setPrevServerBudgets(serverBudgets);
    setBudgets(serverBudgets);
  }

  // Drag-and-drop state
  const [dragType, setDragType] = useState<'budget' | 'group' | null>(null);
  const [draggedBudgetId, setDraggedBudgetId] = useState<string | null>(null);
  const [dragOverBudgetId, setDragOverBudgetId] = useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | BudgetFrequency>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithStatus | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<BudgetWithStatus | null>(null);
  const [, startTransition] = useTransition();

  const filteredBudgets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return budgets.filter((b) => {
      if (frequencyFilter !== 'all' && b.frequency !== frequencyFilter) {
        return false;
      }
      if (!q) return true;
      const nameMatch =
        b.name.toLowerCase().includes(q) || (b.groupName?.toLowerCase().includes(q) ?? false);
      const catMatch = b.categories.some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.fullPathName.toLowerCase().includes(q)
      );
      return nameMatch || catMatch;
    });
  }, [budgets, search, frequencyFilter]);

  const overBudgetCount = useMemo(
    () => budgets.filter((b) => b.spentCents > b.amountCents).length,
    [budgets]
  );

  const onTrackCount = useMemo(
    () => budgets.filter((b) => b.spentCents <= b.amountCents).length,
    [budgets]
  );

  const { singleBudgets, groupSections } = useMemo(() => {
    const singles: BudgetWithStatus[] = [];
    const groups = new Map<string, { groupId: string; name: string; budgets: BudgetWithStatus[] }>();
    for (const b of filteredBudgets) {
      if (!b.groupId) {
        singles.push(b);
        continue;
      }
      const g = groups.get(b.groupId) || {
        groupId: b.groupId,
        name: b.groupName || 'Group',
        budgets: [],
      };
      g.budgets.push(b);
      groups.set(b.groupId, g);
    }
    // Custom order (stable sorts: ties keep the highest-% order from the server).
    singles.sort((x, y) => x.sortOrder - y.sortOrder);
    const sections = Array.from(groups.values());
    for (const g of sections) {
      g.budgets.sort((x, y) => x.sortOrder - y.sortOrder);
    }
    sections.sort(
      (x, y) => (x.budgets[0].groupSortOrder ?? 0) - (y.budgets[0].groupSortOrder ?? 0)
    );
    return { singleBudgets: singles, groupSections: sections };
  }, [filteredBudgets]);

  const groupNames = useMemo(
    () =>
      Array.from(
        new Set(budgets.map((b) => b.groupName).filter((n): n is string => Boolean(n)))
      ).sort((a, b) => a.localeCompare(b)),
    [budgets]
  );

  const handleSetOverview = (budget: BudgetWithStatus) => {
    startTransition(async () => {
      await setOverviewBudget(budget.budgetId);
    });
  };

  // Reordering a filtered view would only reflect part of the real order, so disable it then.
  const canReorder = search.trim() === '' && frequencyFilter === 'all';

  const resetDrag = () => {
    setDragType(null);
    setDraggedBudgetId(null);
    setDragOverBudgetId(null);
    setDraggedGroupId(null);
    setDragOverGroupId(null);
  };

  const handleBudgetDragStart = (e: React.DragEvent, budgetId: string) => {
    e.stopPropagation();
    setDragType('budget');
    setDraggedBudgetId(budgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'budget', id: budgetId }));
  };

  const handleBudgetDragOver = (e: React.DragEvent, target: BudgetWithStatus) => {
    if (dragType !== 'budget' || !draggedBudgetId) return;
    const dragged = budgets.find((b) => b.budgetId === draggedBudgetId);
    // Only allow reordering within the same container (ungrouped list or one group)
    if (!dragged || dragged.groupId !== target.groupId) return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedBudgetId !== target.budgetId) setDragOverBudgetId(target.budgetId);
  };

  const handleBudgetDrop = (e: React.DragEvent, target: BudgetWithStatus) => {
    e.preventDefault();
    e.stopPropagation();

    const dragged = budgets.find((b) => b.budgetId === draggedBudgetId);
    if (
      dragType === 'budget' &&
      dragged &&
      dragged.budgetId !== target.budgetId &&
      dragged.groupId === target.groupId
    ) {
      const container = target.groupId
        ? groupSections.find((g) => g.groupId === target.groupId)?.budgets ?? []
        : singleBudgets;
      const remaining = container.filter((b) => b.budgetId !== dragged.budgetId);
      const targetIdx = remaining.findIndex((b) => b.budgetId === target.budgetId);
      if (targetIdx !== -1) {
        remaining.splice(targetIdx, 0, dragged);
        const orderedIds = remaining.map((b) => b.budgetId);
        const newOrder = new Map(orderedIds.map((id, idx) => [id, idx + 1]));

        setBudgets((prev) =>
          prev.map((b) => (newOrder.has(b.budgetId) ? { ...b, sortOrder: newOrder.get(b.budgetId)! } : b))
        );
        startTransition(async () => {
          try {
            await reorderBudgets(orderedIds);
          } catch (err) {
            console.error('Failed to reorder budgets:', err);
            setBudgets(serverBudgets);
          }
        });
      }
    }
    resetDrag();
  };

  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    e.stopPropagation();
    setDragType('group');
    setDraggedGroupId(groupId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', id: groupId }));
  };

  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    if (dragType !== 'group') return;
    e.preventDefault();
    e.stopPropagation();
    if (draggedGroupId !== groupId) setDragOverGroupId(groupId);
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragType === 'group' && draggedGroupId && draggedGroupId !== targetGroupId) {
      const ids = groupSections.map((g) => g.groupId).filter((id) => id !== draggedGroupId);
      const targetIdx = ids.indexOf(targetGroupId);
      if (targetIdx !== -1) {
        ids.splice(targetIdx, 0, draggedGroupId);
        const newOrder = new Map(ids.map((id, idx) => [id, idx + 1]));

        setBudgets((prev) =>
          prev.map((b) =>
            b.groupId && newOrder.has(b.groupId)
              ? { ...b, groupSortOrder: newOrder.get(b.groupId)! }
              : b
          )
        );
        startTransition(async () => {
          try {
            await reorderBudgetGroups(ids);
          } catch (err) {
            console.error('Failed to reorder budget groups:', err);
            setBudgets(serverBudgets);
          }
        });
      }
    }
    resetDrag();
  };

  const renderCard = (budget: BudgetWithStatus) => {
            const isOver = budget.spentCents > budget.amountCents;

            return (
              <div
                key={budget.budgetId}
                onDragOver={(e) => handleBudgetDragOver(e, budget)}
                onDragLeave={() => {
                  if (dragOverBudgetId === budget.budgetId) setDragOverBudgetId(null);
                }}
                onDrop={(e) => handleBudgetDrop(e, budget)}
                className={cn(
                  'flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-900',
                  draggedBudgetId === budget.budgetId && 'opacity-40 border-dashed border-zinc-400',
                  dragOverBudgetId === budget.budgetId &&
                    dragType === 'budget' &&
                    'ring-2 ring-emerald-500/80'
                )}
              >
                <div>
                  {/* Card Top: Header + Actions */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {canReorder && (
                        <div
                          draggable
                          onDragStart={(e) => handleBudgetDragStart(e, budget.budgetId)}
                          onDragEnd={resetDrag}
                          className="shrink-0 cursor-grab rounded p-0.5 text-zinc-300 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600 dark:hover:text-zinc-400"
                          title="Drag to reorder"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                      )}
                      <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {budget.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {budget.groupId && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!budget.isOverview) handleSetOverview(budget);
                          }}
                          aria-pressed={budget.isOverview}
                          className={`rounded-lg p-1.5 transition-colors ${
                            budget.isOverview
                              ? 'cursor-default text-amber-500 dark:text-amber-400'
                              : 'text-zinc-400 hover:bg-amber-50 hover:text-amber-500 dark:hover:bg-amber-950/40'
                          }`}
                          title={
                            budget.isOverview
                              ? 'Shown on overview'
                              : 'Show this budget on the overview'
                          }
                        >
                          <Star
                            className="h-4 w-4"
                            fill={budget.isOverview ? 'currentColor' : 'none'}
                          />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBudget(budget);
                          setIsModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        title="Edit budget"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingBudget(budget)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors"
                        title="Remove budget"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Circle Progress & Amounts */}
                  <div className="mt-4 flex items-center gap-4 rounded-xl bg-zinc-50/80 p-3.5 dark:bg-zinc-800/50">
                    <CircularProgress
                      percent={budget.percentUsed}
                      timePercent={budget.periodPercentElapsed}
                      size={76}
                      strokeWidth={7}
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="truncate tabular-nums text-zinc-900 dark:text-zinc-100">
                        <span className="text-xl sm:text-2xl font-bold">
                          {formatCurrency(budget.spentCents)}
                        </span>{' '}
                        <span className="text-xs sm:text-sm font-normal text-zinc-400">
                          / {formatCurrency(budget.amountCents)}
                        </span>
                      </div>
                      <div
                        className={`text-xs font-semibold tabular-nums ${
                          isOver
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {isOver
                          ? `${formatCurrency(Math.abs(budget.remainingCents))} over budget`
                          : `${formatCurrency(budget.remainingCents)} remaining`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Days Remaining & Frequency Badge */}
                <div className="mt-3.5 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                    <span>
                      {budget.daysRemaining === 1
                        ? '1 day remaining'
                        : `${budget.daysRemaining} days remaining`}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <Repeat className="h-2.5 w-2.5" />
                    {BUDGET_FREQUENCY_LABELS[budget.frequency]}
                  </span>
                </div>
              </div>
            );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            Budgets
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingBudget(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-emerald-600 px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors shrink-0"
            title="Create budget"
          >
            <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Budget</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {budgets.length > 0 && (
        <div className="hidden sm:grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Active Budgets
            </div>
            <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {budgets.length}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              On Track
            </div>
            <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {onTrackCount}
            </div>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-2xs ${
              overBudgetCount > 0
                ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20'
                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Over Budget
            </div>
            <div
              className={`mt-1 text-2xl font-bold ${
                overBudgetCount > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {overBudgetCount}
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search budget or category..."
            className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 self-start sm:self-auto">
          {(
            [
              { key: 'all', label: `All (${budgets.length})` },
              {
                key: 'weekly',
                label: `Weekly (${budgets.filter((b) => b.frequency === 'weekly').length})`,
              },
              {
                key: 'monthly',
                label: `Monthly (${budgets.filter((b) => b.frequency === 'monthly').length})`,
              },
              {
                key: 'yearly',
                label: `Yearly (${budgets.filter((b) => b.frequency === 'yearly').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFrequencyFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                frequencyFilter === tab.key
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budgets Grid */}
      {filteredBudgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <PieChart className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            {budgets.length === 0 ? 'No budgets yet' : 'No matching budgets'}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            {budgets.length === 0
              ? 'Create a weekly, monthly, or yearly budget across one or more spending categories to track your progress.'
              : 'Try adjusting your search or frequency filter.'}
          </p>
          {budgets.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setEditingBudget(null);
                setIsModalOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Budget</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {singleBudgets.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {singleBudgets.map((budget) => renderCard(budget))}
            </div>
          )}
          {groupSections.map((group) => (
            <section
              key={group.groupId}
              onDragOver={(e) => handleGroupDragOver(e, group.groupId)}
              onDragLeave={() => {
                if (dragOverGroupId === group.groupId) setDragOverGroupId(null);
              }}
              onDrop={(e) => handleGroupDrop(e, group.groupId)}
              className={cn(
                'rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/40',
                draggedGroupId === group.groupId && 'opacity-40 border-dashed border-zinc-400',
                dragOverGroupId === group.groupId &&
                  dragType === 'group' &&
                  'ring-2 ring-emerald-500/80'
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                {canReorder && (
                  <div
                    draggable
                    onDragStart={(e) => handleGroupDragStart(e, group.groupId)}
                    onDragEnd={resetDrag}
                    className="shrink-0 cursor-grab rounded p-0.5 text-zinc-300 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-600 dark:hover:text-zinc-400"
                    title="Drag to reorder group"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                )}
                <FolderOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {group.name}
                </h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {group.budgets.length} {group.budgets.length === 1 ? 'budget' : 'budgets'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {group.budgets.map((budget) => renderCard(budget))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Delete Budget Confirmation */}
      {deletingBudget && (
        <DeleteBudgetModal
          isOpen
          budget={deletingBudget}
          onClose={() => setDeletingBudget(null)}
        />
      )}

      {/* Create / Edit Budget Modal */}
      {isModalOpen && (
        <BudgetModal
          key={editingBudget ? `${editingBudget.budgetId}-v${editingBudget.versionNumber}` : 'new'}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBudget(null);
          }}
          categories={categories}
          editingBudget={editingBudget}
          groupNames={groupNames}
        />
      )}
    </div>
  );
}
