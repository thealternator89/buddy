'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Check,
  SlidersHorizontal,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  ScheduledTransactionWithDetails,
  postScheduledTransactionNow,
} from '@/lib/actions/scheduled-transactions';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';
import { formatCurrency } from '@/lib/utils/currency';
import {
  FREQUENCY_LABELS,
  getLocalTodayIso,
  getScheduledDueStatus,
} from '@/lib/utils/scheduled';
import { useBrowserTodayIso } from '@/lib/utils/timezone';
import { TransactionModal } from './TransactionModal';

interface DueScheduledCarouselProps {
  scheduledTransactions: ScheduledTransactionWithDetails[];
  accounts: AccountWithBalance[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees: PayeeWithRules[];
}

export function DueScheduledCarousel({
  scheduledTransactions,
  accounts,
  categories,
  payees,
}: DueScheduledCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [configuringItem, setConfiguringItem] =
    useState<ScheduledTransactionWithDetails | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const todayStr = useBrowserTodayIso();

  const dueItems = useMemo(() => {
    return scheduledTransactions
      .map((item) => ({
        item,
        dueInfo: getScheduledDueStatus(item.nextDueDate, todayStr),
      }))
      .filter((entry) => entry.dueInfo.isDue);
  }, [scheduledTransactions, todayStr]);

  if (dueItems.length === 0) {
    return null;
  }

  const safeIndex = Math.min(currentIndex, Math.max(0, dueItems.length - 1));
  const currentEntry = dueItems[safeIndex];
  const { item, dueInfo } = currentEntry;

  const isTransfer = Boolean(item.transferAccountId);
  const isIncome = !isTransfer && item.amountCents > 0;
  const isOverdue = dueInfo.status === 'overdue';

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev <= 0 ? dueItems.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev >= dueItems.length - 1 ? 0 : prev + 1));
  };

  const handleCreateNow = (target: ScheduledTransactionWithDetails) => {
    setProcessingId(target.id);
    startTransition(async () => {
      try {
        await postScheduledTransactionNow(target.id, getLocalTodayIso());
      } finally {
        setProcessingId(null);
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400">
            <CalendarClock className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Scheduled Due
          </h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
            {dueItems.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {dueItems.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums mr-1">
                {safeIndex + 1} / {dueItems.length}
              </span>
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous due transaction"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next due transaction"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <Link
            href="/scheduled"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Manage
          </Link>
        </div>
      </div>

      {/* Active Carousel Card */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-xs transition-all ${
          isOverdue
            ? 'border-rose-200/90 bg-gradient-to-br from-rose-50/50 via-white to-white dark:border-rose-900/50 dark:from-rose-950/25 dark:via-zinc-900 dark:to-zinc-900'
            : 'border-amber-200/90 bg-gradient-to-br from-amber-50/50 via-white to-white dark:border-amber-900/50 dark:from-amber-950/25 dark:via-zinc-900 dark:to-zinc-900'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                isTransfer
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                  : isIncome
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {isTransfer ? (
                <ArrowLeftRight className="h-4 w-4" />
              ) : isIncome ? (
                <ArrowDownLeft className="h-4 w-4" />
              ) : (
                <ArrowUpRight className="h-4 w-4" />
              )}
            </div>

            <div className="space-y-1 min-w-0">
              {/* Badges Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isOverdue
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  }`}
                >
                  <AlertCircle className="h-3 w-3" />
                  {dueInfo.label} ({item.nextDueDate})
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <Repeat className="h-2.5 w-2.5" />
                  {FREQUENCY_LABELS[item.frequency]}
                </span>
              </div>

              {/* Title */}
              <div
                className={`text-base font-bold truncate ${
                  isTransfer
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {isTransfer
                  ? `Transfer: ${item.accountName} → ${item.transferAccountName || 'Account'}`
                  : item.payeeName || 'Scheduled Transaction'}
              </div>

              {/* Subtitle / Account & Category */}
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                <span>{item.accountName}</span>
                {item.categoryName && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      {item.parentCategoryName ? `${item.parentCategoryName} › ` : ''}
                      {item.categoryName}
                    </span>
                  </>
                )}
                {item.notes && (
                  <>
                    <span>•</span>
                    <span className="italic text-zinc-400 truncate max-w-[220px]">
                      {item.notes}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right side: Amount & Action Buttons */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-200/60 dark:border-zinc-800/60 shrink-0">
            <div
              className={`text-base font-bold ${
                isTransfer
                  ? 'text-zinc-800 dark:text-zinc-200'
                  : isIncome
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {isTransfer
                ? formatCurrency(Math.abs(item.amountCents))
                : formatCurrency(item.amountCents, { showSign: isIncome })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfiguringItem(item)}
                disabled={isPending && processingId === item.id}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                title="Open pre-filled modal to configure details before creating"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Configure</span>
              </button>

              <button
                type="button"
                onClick={() => handleCreateNow(item)}
                disabled={isPending && processingId === item.id}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                title="Create transaction dated today and advance to next scheduled occurrence"
              >
                {isPending && processingId === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>Create</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dot Indicators when multiple due items exist */}
        {dueItems.length > 1 && (
          <div className="mt-3.5 flex items-center justify-center gap-1.5">
            {dueItems.map((entry, idx) => (
              <button
                key={entry.item.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to due item ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === safeIndex
                    ? 'w-5 bg-emerald-600 dark:bg-emerald-400'
                    : 'w-1.5 bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-700 dark:hover:bg-zinc-600'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pre-filled Transaction Modal for "Configure" */}
      {configuringItem && (
        <TransactionModal
          key={configuringItem.id}
          isOpen={Boolean(configuringItem)}
          onClose={() => setConfiguringItem(null)}
          accounts={accounts}
          categories={categories}
          payees={payees}
          prefillScheduled={configuringItem}
        />
      )}
    </div>
  );
}
