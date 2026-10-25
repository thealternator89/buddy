'use client';

import Link from 'next/link';
import { ArrowRight, PieChart } from 'lucide-react';
import { BudgetWithStatus } from '@/lib/actions/budgets';
import { formatCurrency } from '@/lib/utils/currency';
import { BUDGET_FREQUENCY_LABELS } from '@/lib/utils/budget';
import { CircularProgress } from './CircularProgress';

interface BudgetOverviewSectionProps {
  budgets: BudgetWithStatus[];
  variant: 'desktop' | 'mobile';
}

const DESKTOP_MAX_VISIBLE = 5;
const MOBILE_MAX_VISIBLE = 4;

export function BudgetOverviewSection({
  budgets,
  variant,
}: BudgetOverviewSectionProps) {
  if (budgets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/70 px-4 py-3.5 flex items-center justify-between gap-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <PieChart className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
              Budgets
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              Track weekly, monthly, or yearly category spending limits
            </div>
          </div>
        </div>
        <Link
          href="/budgets"
          className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-900 transition-colors"
        >
          <span>Set Up</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const renderBudgetItem = (budget: BudgetWithStatus) => (
    <Link
      key={budget.budgetId}
      href="/budgets"
      className="group flex flex-col items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3.5 text-center shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all min-w-0 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Budget Name */}
      <div className="w-full min-w-0 mb-2">
        <div
          className="text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors truncate dark:text-zinc-100 dark:group-hover:text-emerald-400"
          title={budget.groupName ?? budget.name}
        >
          {budget.groupName ?? budget.name}
        </div>
        <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
          {BUDGET_FREQUENCY_LABELS[budget.frequency]}
        </div>
      </div>

      {/* Circle Progress Bar with Percentage Inside */}
      <div className="my-1">
        <CircularProgress
          percent={budget.percentUsed}
          size={64}
          strokeWidth={6}
        />
      </div>

      {/* Amounts Below: Spent / Total */}
      <div className="mt-2 w-full min-w-0">
        <div className="text-[11px] sm:text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300 truncate">
          {formatCurrency(budget.spentCents)}{' '}
          <span className="font-normal text-zinc-400">/</span>{' '}
          {formatCurrency(budget.amountCents)}
        </div>
      </div>
    </Link>
  );

  if (variant === 'desktop') {
    const hasOverflow = budgets.length > DESKTOP_MAX_VISIBLE;
    const visibleBudgets = hasOverflow
      ? budgets.slice(0, DESKTOP_MAX_VISIBLE)
      : budgets;
    const overflowCount = budgets.length - visibleBudgets.length;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Budgets
          </h2>
          <Link
            href="/budgets"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Single line of budget statuses on tablet/desktop with overflow link */}
        <div className="flex items-stretch gap-3.5 overflow-x-auto pb-1">
          {visibleBudgets.map((budget) => (
            <div
              key={budget.budgetId}
              className="flex-1 min-w-[140px] max-w-[220px]"
            >
              {renderBudgetItem(budget)}
            </div>
          ))}

          {hasOverflow && (
            <Link
              href="/budgets"
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 px-4 py-3.5 text-center hover:border-emerald-500/60 hover:bg-emerald-50/40 transition-all shrink-0 min-w-[120px] dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-950/20"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs dark:bg-emerald-950/80 dark:text-emerald-300">
                +{overflowCount}
              </div>
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                More {overflowCount === 1 ? 'Budget' : 'Budgets'}
              </div>
              <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Mobile variant: appears at the bottom after transactions/accounts overview
  const hasMobileOverflow = budgets.length > MOBILE_MAX_VISIBLE;
  const visibleMobileBudgets = hasMobileOverflow
    ? budgets.slice(0, MOBILE_MAX_VISIBLE)
    : budgets;
  const mobileOverflowCount = budgets.length - visibleMobileBudgets.length;

  return (
    <div className="space-y-3 pt-2 border-t border-zinc-200/80 dark:border-zinc-800/80">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          Budgets
        </h2>
        <Link
          href="/budgets"
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
        >
          {hasMobileOverflow ? `View All (${budgets.length})` : 'Manage'}{' '}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visibleMobileBudgets.map((budget) => renderBudgetItem(budget))}
      </div>

      {hasMobileOverflow && (
        <Link
          href="/budgets"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-2.5 text-xs font-semibold text-emerald-600 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-emerald-400"
        >
          <span>
            +{mobileOverflowCount} more {mobileOverflowCount === 1 ? 'budget' : 'budgets'}
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
