'use client';

import { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Receipt,
} from 'lucide-react';
import { TransactionWithDetails } from '@/lib/actions/transactions';
import { formatCurrency } from '@/lib/utils/currency';
import { deduplicateTransfers, getTransferDetails } from '@/lib/utils/transaction';
import { groupTransactionsByDate } from '@/lib/utils/date';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';
import { TransactionDetailModal } from './TransactionDetailModal';

interface RecentTransactionsListProps {
  transactions: TransactionWithDetails[];
  accounts?: AccountWithBalance[];
  categories?: (CategoryNode | CategoryFlatItem)[];
  payees?: PayeeWithRules[];
}

export function RecentTransactionsList({
  transactions,
  accounts = [],
  categories = [],
  payees = [],
}: RecentTransactionsListProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(
    null
  );

  const displayedTransactions = useMemo(
    () => deduplicateTransfers(transactions),
    [transactions]
  );

  const groupedTransactions = useMemo(
    () => groupTransactionsByDate(displayedTransactions),
    [displayedTransactions]
  );

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        {displayedTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-3">
              <Receipt className="h-6 w-6" />
            </div>
            <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
              No transactions recorded yet
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs">
              When you record expenses, income, or transfers, they will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {groupedTransactions.map((group) => (
              <div key={group.dateKey} className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                {/* Date Group Header */}
                <div className="bg-zinc-50/75 dark:bg-zinc-800/40 px-3.5 py-1.5 sm:px-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
                  <span>{group.label}</span>
                  <span className="text-[10px] font-medium text-zinc-400">
                    {group.transactions.length}{' '}
                    {group.transactions.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                </div>

                {/* Transaction Rows within this date */}
                {group.transactions.map((tx) => {
                  const transferDetails = getTransferDetails(tx);
                  const isTransfer = transferDetails.isTransfer;
                  const isIncome = !isTransfer && tx.amountCents > 0;

                  return (
                    <div
                      key={tx.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedTransaction(tx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedTransaction(tx);
                        }
                      }}
                      className="group flex items-center justify-between gap-3 p-3.5 sm:p-4 cursor-pointer hover:bg-zinc-50/80 active:bg-zinc-100/90 dark:hover:bg-zinc-800/40 dark:active:bg-zinc-800/70 transition-colors focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800/60"
                    >
                      {/* Left: Directional Icon & Payee / Account / Category Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Transaction Icon */}
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
                            isTransfer
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                              : isIncome
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
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

                        {/* Title and Metadata */}
                        <div className="min-w-0 space-y-1">
                          {/* Primary: Payee or Transfer Flow */}
                          <div
                            className={`font-semibold text-sm truncate ${
                              isTransfer
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-zinc-900 dark:text-zinc-100'
                            }`}
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
                              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 truncate max-w-[140px] sm:max-w-[200px]">
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
                                <span className="truncate max-w-[130px] sm:max-w-[180px]">
                                  {tx.accountName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Status */}
                      <div className="text-right shrink-0 space-y-1 pl-2">
                        <div
                          className={`text-sm font-bold tabular-nums ${
                            isTransfer
                              ? 'text-zinc-700 dark:text-zinc-300'
                              : isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {isTransfer
                            ? formatCurrency(transferDetails.unsignedAmountCents)
                            : formatCurrency(tx.amountCents, { showSign: isIncome })}
                        </div>

                        {tx.isCleared ? (
                          <div
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                            title="Cleared transaction"
                          >
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            <span className="hidden sm:inline">Cleared</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            Pending
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <TransactionDetailModal
        isOpen={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
        accounts={accounts}
        categories={categories}
        payees={payees}
      />
    </>
  );
}
