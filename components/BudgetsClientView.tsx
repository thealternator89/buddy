'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  PieChart,
  PlusCircle,
  Search,
  Pencil,
  Trash2,
  Repeat,
  Loader2,
} from 'lucide-react';
import {
  BudgetWithStatus,
  deactivateBudget,
} from '@/lib/actions/budgets';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { formatCurrency } from '@/lib/utils/currency';
import { BUDGET_FREQUENCY_LABELS, BudgetFrequency } from '@/lib/utils/budget';
import { CircularProgress } from './CircularProgress';
import { BudgetModal } from './BudgetModal';

interface BudgetsClientViewProps {
  budgets: BudgetWithStatus[];
  categories: (CategoryNode | CategoryFlatItem)[];
}

export function BudgetsClientView({
  budgets,
  categories,
}: BudgetsClientViewProps) {
  const [search, setSearch] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | BudgetFrequency>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithStatus | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredBudgets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return budgets.filter((b) => {
      if (frequencyFilter !== 'all' && b.frequency !== frequencyFilter) {
        return false;
      }
      if (!q) return true;
      const nameMatch = b.name.toLowerCase().includes(q);
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

  const handleDeactivate = (budget: BudgetWithStatus) => {
    setDeletingId(budget.budgetId);
    startTransition(async () => {
      try {
        await deactivateBudget(budget.budgetId);
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            Budgets
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 sm:mt-1">
            Sorted by highest percentage of budget used first
          </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredBudgets.map((budget) => {
            const isOver = budget.spentCents > budget.amountCents;
            const isDeleting = isPending && deletingId === budget.budgetId;

            return (
              <div
                key={budget.budgetId}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div>
                  {/* Card Top: Header + Actions */}
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {budget.name}
                    </h3>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBudget(budget);
                          setIsModalOpen(true);
                        }}
                        disabled={isDeleting}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        title="Edit budget"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeactivate(budget)}
                        disabled={isDeleting}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors"
                        title="Remove budget"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Circle Progress & Amounts */}
                  <div className="mt-4 flex items-center gap-4 rounded-xl bg-zinc-50/80 p-3.5 dark:bg-zinc-800/50">
                    <CircularProgress
                      percent={budget.percentUsed}
                      size={72}
                      strokeWidth={7}
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Spent / Budget
                      </div>
                      <div className="text-sm sm:text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100 truncate">
                        {formatCurrency(budget.spentCents)}{' '}
                        <span className="font-normal text-zinc-400">/</span>{' '}
                        {formatCurrency(budget.amountCents)}
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

                {/* Bottom Right: Frequency Badge */}
                <div className="mt-3.5 flex justify-end">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <Repeat className="h-2.5 w-2.5" />
                    {BUDGET_FREQUENCY_LABELS[budget.frequency]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
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
        />
      )}
    </div>
  );
}
