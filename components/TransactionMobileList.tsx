'use client';

import { useMemo } from 'react';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Receipt,
} from 'lucide-react';
import { TransactionWithDetails } from '@/lib/actions/transactions';
import { formatCurrency } from '@/lib/utils/currency';
import { getTransferDetails } from '@/lib/utils/transaction';
import { groupTransactionsByDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils';

interface TransactionMobileListProps {
  transactions: TransactionWithDetails[];
  isSpecificAccount: boolean;
  isPending?: boolean;
  onSelectTransaction: (tx: TransactionWithDetails) => void;
  onToggleCleared: (id: string) => void;
}

export function TransactionMobileList({
  transactions,
  isSpecificAccount,
  isPending = false,
  onSelectTransaction,
  onToggleCleared,
}: TransactionMobileListProps) {
  const groupedTransactions = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions]
  );

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center text-zinc-400 dark:text-zinc-500">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-3">
          <Receipt className="h-6 w-6" />
        </div>
        <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
          No transactions found
        </div>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          No transactions matched the selected filters or search terms.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'divide-y divide-zinc-100 dark:divide-zinc-800/60 transition-opacity',
        isPending && 'opacity-60 pointer-events-none'
      )}
    >
      {groupedTransactions.map((group) => (
        <div key={group.dateKey} className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
          {/* Date Group Header */}
          <div className="bg-zinc-50/75 dark:bg-zinc-800/40 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
            <span>{group.label}</span>
            <span className="text-[10px] font-medium text-zinc-400">
              {group.transactions.length}{' '}
              {group.transactions.length === 1 ? 'transaction' : 'transactions'}
            </span>
          </div>

          {/* Transactions within this date */}
          {group.transactions.map((tx) => {
            const transferDetails = getTransferDetails(tx);
            const isTransfer = transferDetails.isTransfer;
            const isIncome = !isTransfer && tx.amountCents > 0;
            const isTransferInflow = isTransfer && tx.amountCents > 0;
            const firstLineNotes = tx.notes ? tx.notes.split('\n')[0].trim() : null;

            return (
              <div
                key={tx.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectTransaction(tx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                      e.preventDefault();
                      onSelectTransaction(tx);
                    }
                  }
                }}
                className="group flex items-start justify-between gap-3 p-3.5 cursor-pointer hover:bg-zinc-50/80 active:bg-zinc-100/90 dark:hover:bg-zinc-800/40 dark:active:bg-zinc-800/70 transition-colors focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800/60"
              >
                {/* Left: Direction Icon & Details */}
                <div className="flex items-start gap-3 min-w-0">
                  {/* Directional Icon */}
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform mt-0.5',
                      isTransfer
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                        : isIncome
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    )}
                  >
                    {isTransfer ? (
                      <ArrowLeftRight className="h-4 w-4" />
                    ) : isIncome ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>

                  {/* Title and Metadata */}
                  <div className="min-w-0 space-y-1">
                    {/* Payee / Transfer */}
                    <div
                      className={cn(
                        'font-semibold text-sm truncate',
                        isTransfer
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-zinc-900 dark:text-zinc-100'
                      )}
                    >
                      {isTransfer
                        ? `${transferDetails.sourceAccountName} → ${transferDetails.targetAccountName}`
                        : tx.payeeName || 'Unassigned Payee'}
                    </div>

                    {/* Secondary: Category Badge + Account */}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 min-w-0 flex-wrap">
                      {isTransfer ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          Transfer
                        </span>
                      ) : tx.categoryName ? (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 truncate max-w-[170px]">
                          {tx.parentCategoryName ? `${tx.parentCategoryName} › ` : ''}
                          {tx.categoryName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          Uncategorized
                        </span>
                      )}

                      {!isTransfer && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-600">•</span>
                          <span className="truncate max-w-[140px] text-zinc-600 dark:text-zinc-300">
                            {tx.accountName}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Notes preview if present (first line) */}
                    {firstLineNotes && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 italic line-clamp-1 pt-0.5">
                        {firstLineNotes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Amount & Cleared Toggle */}
                <div className="text-right shrink-0 space-y-1.5 pl-2">
                  <div
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      isTransfer && !isSpecificAccount
                        ? 'text-zinc-700 dark:text-zinc-300'
                        : isIncome || isTransferInflow
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isTransfer
                        ? 'text-zinc-700 dark:text-zinc-300'
                        : 'text-zinc-900 dark:text-zinc-100'
                    )}
                  >
                    {isTransfer && !isSpecificAccount
                      ? formatCurrency(transferDetails.unsignedAmountCents)
                      : formatCurrency(tx.amountCents, { showSign: isIncome || isTransferInflow })}
                  </div>

                  {/* Interactive Cleared Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCleared(tx.id);
                    }}
                    className="inline-flex items-center gap-1 py-0.5 px-1.5 -mr-1 rounded-md text-[11px] font-medium transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                    title={tx.isCleared ? 'Mark Uncleared' : 'Mark Cleared'}
                    aria-label={tx.isCleared ? 'Mark Uncleared' : 'Mark Cleared'}
                  >
                    {tx.isCleared ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-emerald-600 dark:text-emerald-400">Cleared</span>
                      </>
                    ) : (
                      <>
                        <Circle className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                        <span className="text-zinc-400 dark:text-zinc-500">Pending</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
