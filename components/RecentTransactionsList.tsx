'use client';

import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { TransactionWithDetails } from '@/lib/actions/transactions';
import { formatCurrency } from '@/lib/utils/currency';
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

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-zinc-400">No transactions recorded yet.</div>
          ) : (
            transactions.map((tx) => {
              const isTransfer = Boolean(tx.transferId);
              const isIncome = tx.amountCents > 0;

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
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-50/75 transition-colors dark:hover:bg-zinc-800/40 focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800/60"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
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
                        '+'
                      ) : (
                        '-'
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-zinc-900 truncate dark:text-zinc-100">
                        {isTransfer
                          ? `Transfer: ${tx.transferAccountName || 'Account'}`
                          : tx.payeeName || 'Unassigned Payee'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="truncate">{tx.accountName}</span>
                        {tx.categoryName && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                              {tx.parentCategoryName ? `${tx.parentCategoryName} › ` : ''}
                              {tx.categoryName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap pl-4">
                    <div
                      className={`text-sm font-bold ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isTransfer
                          ? 'text-zinc-700 dark:text-zinc-300'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {formatCurrency(tx.amountCents, { showSign: isIncome })}
                    </div>
                    {tx.isCleared && (
                      <div className="text-[10px] text-zinc-400">Cleared</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
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
