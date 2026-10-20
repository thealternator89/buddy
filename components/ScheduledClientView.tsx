'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  CalendarClock,
  PlusCircle,
  Search,
  Check,
  SlidersHorizontal,
  SkipForward,
  Pencil,
  Trash2,
  Repeat,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  ScheduledTransactionWithDetails,
  postScheduledTransactionNow,
  advanceScheduledTransaction,
  deleteScheduledTransaction,
} from '@/lib/actions/scheduled-transactions';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';
import { formatCurrency } from '@/lib/utils/currency';
import {
  FREQUENCY_LABELS,
  getLocalTodayIso,
  getScheduledDueStatus,
  DueStatusInfo,
} from '@/lib/utils/scheduled';
import { ScheduledTransactionModal } from './ScheduledTransactionModal';
import { TransactionModal } from './TransactionModal';

interface ScheduledClientViewProps {
  scheduledTransactions: ScheduledTransactionWithDetails[];
  accounts: AccountWithBalance[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees: PayeeWithRules[];
}

export function ScheduledClientView({
  scheduledTransactions,
  accounts,
  categories,
  payees,
}: ScheduledClientViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'upcoming'>('all');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState<ScheduledTransactionWithDetails | null>(null);
  const [configuringItem, setConfiguringItem] =
    useState<ScheduledTransactionWithDetails | null>(null);
  const [processingAction, setProcessingAction] = useState<{
    id: string;
    type: 'create' | 'skip' | 'delete';
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const todayStr = getLocalTodayIso();

  const enrichedItems = useMemo(() => {
    return scheduledTransactions.map((item) => ({
      item,
      dueInfo: getScheduledDueStatus(item.nextDueDate, todayStr),
    }));
  }, [scheduledTransactions, todayStr]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedItems.filter(({ item, dueInfo }) => {
      if (statusFilter === 'due' && !dueInfo.isDue) return false;
      if (statusFilter === 'upcoming' && dueInfo.isDue) return false;

      if (!q) return true;
      const payeeMatch = item.payeeName?.toLowerCase().includes(q);
      const accountMatch = item.accountName.toLowerCase().includes(q);
      const transferAccountMatch = item.transferAccountName?.toLowerCase().includes(q);
      const categoryMatch = item.categoryName?.toLowerCase().includes(q);
      const parentCategoryMatch = item.parentCategoryName?.toLowerCase().includes(q);
      const notesMatch = item.notes?.toLowerCase().includes(q);
      return Boolean(
        payeeMatch ||
          accountMatch ||
          transferAccountMatch ||
          categoryMatch ||
          parentCategoryMatch ||
          notesMatch
      );
    });
  }, [enrichedItems, search, statusFilter]);

  const dueCount = useMemo(
    () => enrichedItems.filter((e) => e.dueInfo.isDue).length,
    [enrichedItems]
  );

  const next30DaysOutflowCents = useMemo(() => {
    return enrichedItems
      .filter((e) => e.dueInfo.daysDiff <= 30 && !e.item.transferAccountId && e.item.amountCents < 0)
      .reduce((sum, e) => sum + Math.abs(e.item.amountCents), 0);
  }, [enrichedItems]);

  const dueFiltered = useMemo(
    () => filteredItems.filter((e) => e.dueInfo.isDue),
    [filteredItems]
  );
  const upcomingFiltered = useMemo(
    () => filteredItems.filter((e) => !e.dueInfo.isDue),
    [filteredItems]
  );

  const handleCreateNow = (item: ScheduledTransactionWithDetails) => {
    setProcessingAction({ id: item.id, type: 'create' });
    startTransition(async () => {
      try {
        await postScheduledTransactionNow(item.id, getLocalTodayIso());
      } finally {
        setProcessingAction(null);
      }
    });
  };

  const handleSkip = (item: ScheduledTransactionWithDetails) => {
    setProcessingAction({ id: item.id, type: 'skip' });
    startTransition(async () => {
      try {
        await advanceScheduledTransaction(item.id);
      } finally {
        setProcessingAction(null);
      }
    });
  };

  const handleDelete = (item: ScheduledTransactionWithDetails) => {
    setProcessingAction({ id: item.id, type: 'delete' });
    startTransition(async () => {
      try {
        await deleteScheduledTransaction(item.id);
      } finally {
        setProcessingAction(null);
      }
    });
  };

  const renderScheduledRow = ({
    item,
    dueInfo,
  }: {
    item: ScheduledTransactionWithDetails;
    dueInfo: DueStatusInfo;
  }) => {
    const isTransfer = Boolean(item.transferAccountId);
    const isIncome = !isTransfer && item.amountCents > 0;
    const isOverdue = dueInfo.status === 'overdue';
    const isDueToday = dueInfo.status === 'due_today';
    const isBusy = isPending && processingAction?.id === item.id;

    return (
      <div
        key={item.id}
        className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 transition-colors ${
          isOverdue
            ? 'bg-rose-50/40 hover:bg-rose-50/70 dark:bg-rose-950/15 dark:hover:bg-rose-950/25'
            : isDueToday
            ? 'bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-950/15 dark:hover:bg-amber-950/25'
            : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40'
        }`}
      >
        {/* Left: Icon & Details */}
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
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isOverdue
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                    : isDueToday
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}
              >
                {dueInfo.isDue ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3 text-zinc-400" />
                )}
                <span>{dueInfo.label}</span>
                <span className="opacity-75">• {item.nextDueDate}</span>
              </span>

              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Repeat className="h-3 w-3" />
                {FREQUENCY_LABELS[item.frequency]}
              </span>
            </div>

            <div
              className={`text-sm sm:text-base font-bold truncate ${
                isTransfer
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {isTransfer
                ? `Transfer: ${item.accountName} → ${item.transferAccountName || 'Account'}`
                : item.payeeName || 'Scheduled Transaction'}
            </div>

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
              <span>•</span>
              <span className="text-zinc-400">Started {item.startDate}</span>
              {item.notes && (
                <>
                  <span>•</span>
                  <span className="italic text-zinc-400 truncate max-w-[260px]">
                    {item.notes}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amount & Actions */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-100 dark:border-zinc-800/80 shrink-0">
          <div className="text-left lg:text-right mr-2">
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
            <div className="text-[11px] text-zinc-400">
              {FREQUENCY_LABELS[item.frequency]}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Primary 1-Click Create Button (Always available) */}
            <button
              type="button"
              onClick={() => handleCreateNow(item)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              title="Create transaction dated today and advance schedule"
            >
              {isBusy && processingAction?.type === 'create' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>Create</span>
            </button>

            {/* Configure & Create Button (Opens pre-filled TransactionModal) */}
            <button
              type="button"
              onClick={() => setConfiguringItem(item)}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title="Open pre-filled transaction modal to configure details before creating"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Configure</span>
            </button>

            {/* Skip Next Occurrence Button */}
            <button
              type="button"
              onClick={() => handleSkip(item)}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
              title="Skip this occurrence and advance to the next scheduled date"
            >
              {isBusy && processingAction?.type === 'skip' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SkipForward className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Skip</span>
            </button>

            {/* Edit Schedule Button */}
            <button
              type="button"
              onClick={() => {
                setEditingItem(item);
                setIsScheduleModalOpen(true);
              }}
              disabled={isBusy}
              className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              title="Edit schedule"
            >
              <Pencil className="h-4 w-4" />
            </button>

            {/* Delete Schedule Button */}
            <button
              type="button"
              onClick={() => handleDelete(item)}
              disabled={isBusy}
              className="rounded-lg p-2 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors"
              title="Delete schedule"
            >
              {isBusy && processingAction?.type === 'delete' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
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
            Scheduled
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsScheduleModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-emerald-600 px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors shrink-0"
            title="Create scheduled transaction"
          >
            <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Scheduled</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        <div
          className={`rounded-2xl border p-4 shadow-2xs ${
            dueCount > 0
              ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20'
              : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Due or Overdue Now
          </div>
          <div
            className={`mt-1 text-2xl font-bold ${
              dueCount > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-zinc-900 dark:text-zinc-100'
            }`}
          >
            {dueCount} {dueCount === 1 ? 'payment' : 'payments'}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Due Within 30 Days (Outflows)
          </div>
          <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatCurrency(next30DaysOutflowCents)}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Active Schedules
          </div>
          <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {scheduledTransactions.length}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payee, account, category, or notes..."
            className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 self-start sm:self-auto">
          {(
            [
              { key: 'all', label: `All (${enrichedItems.length})` },
              { key: 'due', label: `Due (${dueCount})` },
              {
                key: 'upcoming',
                label: `Upcoming (${enrichedItems.length - dueCount})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab.key
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled Items List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CalendarClock className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            {scheduledTransactions.length === 0
              ? 'No scheduled transactions yet'
              : 'No matching scheduled transactions'}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
            {scheduledTransactions.length === 0
              ? 'Add your regular bills, subscriptions, salary, or recurring transfers so you can record them with a single click when due.'
              : 'Try adjusting your search or status filter.'}
          </p>
          {scheduledTransactions.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsScheduleModalOpen(true);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create First Schedule</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {dueFiltered.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Due & Overdue ({dueFiltered.length})
                </h2>
              </div>
              <div className="overflow-hidden rounded-2xl border border-amber-200/90 bg-white divide-y divide-zinc-100 shadow-xs dark:border-amber-900/50 dark:bg-zinc-900 dark:divide-zinc-800">
                {dueFiltered.map((entry) => renderScheduledRow(entry))}
              </div>
            </div>
          )}

          {upcomingFiltered.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Upcoming ({upcomingFiltered.length})
                </h2>
              </div>
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:divide-zinc-800">
                {upcomingFiltered.map((entry) => renderScheduledRow(entry))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Scheduled Transaction Modal */}
      {isScheduleModalOpen && (
        <ScheduledTransactionModal
          key={editingItem ? editingItem.id : 'new'}
          isOpen={isScheduleModalOpen}
          onClose={() => {
            setIsScheduleModalOpen(false);
            setEditingItem(null);
          }}
          accounts={accounts}
          categories={categories}
          payees={payees}
          editingItem={editingItem}
        />
      )}

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
