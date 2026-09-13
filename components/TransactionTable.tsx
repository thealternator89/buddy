'use client';

import { useState, useTransition, useMemo } from 'react';
import {
  TransactionWithDetails,
  deleteTransaction,
  toggleTransactionCleared,
} from '@/lib/actions/transactions';
import { formatCurrency } from '@/lib/utils/currency';
import {
  Search,
  ArrowLeftRight,
  CheckCircle2,
  Circle,
  Trash2,
} from 'lucide-react';
import { AccountWithBalance } from '@/lib/actions/accounts';
import {
  CategoryNode,
  CategoryFlatItem,
  flattenCategoryTree,
} from '@/lib/category-utils';
import { Payee } from '@/lib/db/schema';

interface TransactionTableProps {
  initialTransactions: TransactionWithDetails[];
  accounts: AccountWithBalance[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees?: Payee[];
  selectedAccountId?: string;
  selectedCategoryId?: string;
  selectedPayeeId?: string;
  initialSearch?: string;
}

export function TransactionTable({
  initialTransactions,
  accounts,
  categories: inputCategories,
  payees = [],
  selectedAccountId,
  selectedCategoryId,
  selectedPayeeId,
  initialSearch,
}: TransactionTableProps) {
  const [search, setSearch] = useState(initialSearch || '');
  const [filterAccount, setFilterAccount] = useState(selectedAccountId || '');
  const [filterCategory, setFilterCategory] = useState(selectedCategoryId || '');
  const [filterPayee, setFilterPayee] = useState(selectedPayeeId || '');
  const [, startTransition] = useTransition();

  const flatCategories = useMemo<CategoryFlatItem[]>(() => {
    if (inputCategories.length === 0) return [];
    if ('children' in inputCategories[0]) {
      return flattenCategoryTree(inputCategories as CategoryNode[]);
    }
    return inputCategories as CategoryFlatItem[];
  }, [inputCategories]);

  // Subtree map for in-memory category filtering with rollups
  const categorySubtreeMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of flatCategories) {
      map.set(c.id, new Set([c.id]));
    }
    for (const c of flatCategories) {
      let p = c.parentId;
      while (p) {
        map.get(p)?.add(c.id);
        const parentItem = flatCategories.find((item) => item.id === p);
        p = parentItem ? parentItem.parentId : null;
      }
    }
    return map;
  }, [flatCategories]);

  // Filter transactions in-memory for instant response
  const filtered = initialTransactions.filter((tx) => {
    if (filterAccount && tx.accountId !== filterAccount) return false;
    if (filterCategory) {
      const allowed = categorySubtreeMap.get(filterCategory);
      if (!allowed || !tx.categoryId || !allowed.has(tx.categoryId)) return false;
    }
    if (filterPayee && tx.payeeId !== filterPayee) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchPayee = tx.payeeName?.toLowerCase().includes(q);
      const matchCat = tx.categoryName?.toLowerCase().includes(q);
      const matchParentCat = tx.parentCategoryName?.toLowerCase().includes(q);
      const matchAcc = tx.accountName.toLowerCase().includes(q);
      const matchNotes = tx.notes?.toLowerCase().includes(q);
      const matchTransfer = tx.transferAccountName?.toLowerCase().includes(q);
      if (!matchPayee && !matchCat && !matchParentCat && !matchAcc && !matchNotes && !matchTransfer) return false;
    }
    return true;
  });

  const handleToggleCleared = (id: string) => {
    startTransition(async () => {
      await toggleTransactionCleared(id);
    });
  };

  const handleDelete = (id: string, isTransfer: boolean) => {
    const confirmMsg = isTransfer
      ? 'This is a transfer between two accounts. Deleting it will remove both sides of the transfer. Continue?'
      : 'Are you sure you want to delete this transaction?';

    if (confirm(confirmMsg)) {
      startTransition(async () => {
        await deleteTransaction(id);
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payees, categories, notes..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {/* Account Filter */}
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm text-zinc-800 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="">All Accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm text-zinc-800 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 font-mono"
          >
            <option value="">All Categories</option>
            {flatCategories.map((cat) => {
              const indent = '  '.repeat(cat.depth);
              const prefix = cat.depth > 0 ? '↳ ' : '● ';
              return (
                <option key={cat.id} value={cat.id}>
                  {indent}{prefix}{cat.name}
                </option>
              );
            })}
          </select>

          {/* Payee Filter */}
          {payees.length > 0 && (
            <select
              value={filterPayee}
              onChange={(e) => setFilterPayee(e.target.value)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm text-zinc-800 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="">All Payees</option>
              {payees.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {(filterAccount || filterCategory || filterPayee || search) && (
            <button
              onClick={() => {
                setFilterAccount('');
                setFilterCategory('');
                setFilterPayee('');
                setSearch('');
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline px-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="border-b border-zinc-100 bg-zinc-50/75 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="py-3.5 pl-4 pr-2 w-8 text-center" title="Cleared status">
                  ✓
                </th>
                <th className="py-3.5 px-3">Date</th>
                <th className="py-3.5 px-3">Account</th>
                <th className="py-3.5 px-3">Payee / Transfer</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3">Notes</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 pr-4 pl-2 text-right w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    No transactions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const isTransfer = Boolean(tx.transferId);
                  const isIncome = tx.amountCents > 0;

                  return (
                    <tr
                      key={tx.id}
                      className="group hover:bg-zinc-50/75 transition-colors dark:hover:bg-zinc-800/40"
                    >
                      {/* Cleared Toggle */}
                      <td className="py-3 pl-4 pr-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleCleared(tx.id)}
                          className="text-zinc-300 hover:text-emerald-600 dark:text-zinc-600 dark:hover:text-emerald-400 transition-colors"
                          title={tx.isCleared ? 'Mark Uncleared' : 'Mark Cleared'}
                        >
                          {tx.isCleared ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 whitespace-nowrap font-medium text-zinc-700 dark:text-zinc-300">
                        {tx.date}
                      </td>

                      {/* Account */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {tx.accountName}
                        </span>
                      </td>

                      {/* Payee / Transfer */}
                      <td className="py-3 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {isTransfer ? (
                          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>Transfer: {tx.transferAccountName || 'Account'}</span>
                          </div>
                        ) : (
                          tx.payeeName || <span className="text-zinc-400 italic">No Payee</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isTransfer ? (
                          <span className="text-xs text-zinc-400 italic">—</span>
                        ) : tx.categoryName ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            {tx.parentCategoryName && (
                              <span className="text-emerald-600/75 dark:text-emerald-400/75 text-[11px]">
                                {tx.parentCategoryName} ›
                              </span>
                            )}
                            <span>{tx.categoryName}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Uncategorized
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-3 text-xs text-zinc-500 max-w-[200px] truncate dark:text-zinc-400">
                        {tx.notes || '—'}
                      </td>

                      {/* Amount */}
                      <td
                        className={`py-3 px-4 text-right whitespace-nowrap font-semibold ${
                          isIncome
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isTransfer
                            ? 'text-zinc-700 dark:text-zinc-300'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {formatCurrency(tx.amountCents, { showSign: isIncome })}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(tx.id, isTransfer)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-600 transition-opacity"
                          title="Delete transaction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
          <span>
            Showing {filtered.length} of {initialTransactions.length} transactions
          </span>
          <div className="flex items-center gap-4">
            <span>
              Net Total:{' '}
              <strong className="text-zinc-900 dark:text-zinc-100">
                {formatCurrency(filtered.reduce((acc, t) => acc + t.amountCents, 0))}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
