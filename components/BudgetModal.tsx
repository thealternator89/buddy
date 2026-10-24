'use client';

import { useState, useTransition } from 'react';
import { X, PieChart, History, RefreshCw } from 'lucide-react';
import {
  BudgetWithStatus,
  BudgetUpdateMode,
  createBudget,
  updateBudget,
} from '@/lib/actions/budgets';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import {
  BUDGET_FREQUENCY_OPTIONS,
  BudgetFrequency,
  getBudgetPeriodRange,
  getPreviousIsoDate,
  formatShortIsoDate,
  toUtcIsoDateString,
} from '@/lib/utils/budget';
import { CategoryMultiSelect } from './CategoryMultiSelect';
import { CurrencyInput } from './CurrencyInput';
import { cn } from '@/lib/utils';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: (CategoryNode | CategoryFlatItem)[];
  editingBudget?: BudgetWithStatus | null;
}

export function BudgetModal({
  isOpen,
  onClose,
  categories,
  editingBudget,
}: BudgetModalProps) {
  const isEditing = Boolean(editingBudget);

  const [name, setName] = useState(editingBudget?.name || '');
  const [categoryIds, setCategoryIds] = useState<string[]>(
    editingBudget?.categoryIds || []
  );
  const [frequency, setFrequency] = useState<BudgetFrequency>(
    editingBudget?.frequency || 'monthly'
  );
  const [amountCents, setAmountCents] = useState<number>(
    editingBudget?.amountCents || 0
  );
  const [updateMode, setUpdateMode] = useState<BudgetUpdateMode>('current_cycle');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const targetPeriod = getBudgetPeriodRange(frequency);
  const currentCycleStartLabel = formatShortIsoDate(targetPeriod.startDate);
  const previousCycleEndLabel = formatShortIsoDate(
    getPreviousIsoDate(targetPeriod.startDate)
  );
  const existingStartedInCurrentCycle = editingBudget
    ? toUtcIsoDateString(editingBudget.effectiveFrom) >= targetPeriod.startDate
    : false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a budget name.');
      return;
    }

    if (categoryIds.length === 0) {
      setError('Please select at least one category.');
      return;
    }

    if (amountCents <= 0) {
      setError('Please enter a budget amount greater than zero.');
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing && editingBudget) {
          await updateBudget(editingBudget.budgetId, {
            name: name.trim(),
            frequency,
            amountCents,
            categoryIds,
            updateMode,
          });
        } else {
          await createBudget({
            name: name.trim(),
            frequency,
            amountCents,
            categoryIds,
          });
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save budget.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <PieChart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isEditing ? 'Edit Budget' : 'Create Budget'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isEditing
                  ? 'Update budget details or create a new version'
                  : 'Track spending across one or more categories'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Budget Name */}
          <div>
            <label
              htmlFor="budget-name"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Budget Name
            </label>
            <input
              id="budget-name"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries & Dining, Essentials, Travel"
              className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* Categories Multi-Select */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Categories Included
            </label>
            <CategoryMultiSelect
              categories={categories}
              value={categoryIds}
              onChange={setCategoryIds}
              placeholder="Select one or more categories..."
            />
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Selecting a parent category automatically includes all of its subcategories.
            </p>
          </div>

          {/* Frequency Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Frequency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BUDGET_FREQUENCY_OPTIONS.map((opt) => {
                const isSelected = frequency === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFrequency(opt.value)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition-all',
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    )}
                  >
                    <span className="text-xs sm:text-sm font-bold">{opt.label}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 hidden sm:inline">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Budget Amount */}
          <div>
            <label
              htmlFor="budget-amount"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5"
            >
              Budget Amount
            </label>
            <CurrencyInput
              id="budget-amount"
              valueCents={amountCents}
              onChangeCents={setAmountCents}
              placeholder="0.00"
              required
            />
          </div>

          {/* Versioning Options when editing */}
          {isEditing && editingBudget && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                How should this change apply? (Currently v{editingBudget.versionNumber})
              </label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setUpdateMode('current_cycle')}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                    updateMode === 'current_cycle'
                      ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/60'
                      : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80 dark:hover:bg-zinc-800'
                  )}
                >
                  <History
                    className={cn(
                      'h-4 w-4 shrink-0 mt-0.5',
                      updateMode === 'current_cycle'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'text-xs sm:text-sm font-bold',
                        updateMode === 'current_cycle'
                          ? 'text-emerald-950 dark:text-emerald-100'
                          : 'text-zinc-900 dark:text-zinc-100'
                      )}
                    >
                      Take effect from the current budget cycle
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {existingStartedInCurrentCycle
                        ? `This version already started in the current cycle (${currentCycleStartLabel}), so it will be updated in-place.`
                        : `Ends the previous version on ${previousCycleEndLabel} and starts this updated configuration from ${currentCycleStartLabel}.`}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUpdateMode('replace_all')}
                  className={cn(
                    'w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                    updateMode === 'replace_all'
                      ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/60'
                      : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80 dark:hover:bg-zinc-800'
                  )}
                >
                  <RefreshCw
                    className={cn(
                      'h-4 w-4 shrink-0 mt-0.5',
                      updateMode === 'replace_all'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'text-xs sm:text-sm font-bold',
                        updateMode === 'replace_all'
                          ? 'text-emerald-950 dark:text-emerald-100'
                          : 'text-zinc-900 dark:text-zinc-100'
                      )}
                    >
                      Replace the budget entirely
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Removes all existing versions and sets this configuration as the single active version (v1).
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isPending
                ? 'Saving...'
                : isEditing
                ? 'Save Changes'
                : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
