'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  TransactionWithDetails,
  deleteTransaction,
  toggleTransactionCleared,
} from '@/lib/actions/transactions';
import { formatCurrency } from '@/lib/utils/currency';
import { deduplicateTransfers, getTransferDetails } from '@/lib/utils/transaction';
import { cn } from '@/lib/utils';
import {
  Search,
  ArrowLeftRight,
  CheckCircle2,
  Circle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { AccountWithBalance } from '@/lib/actions/accounts';
import {
  CategoryNode,
  CategoryFlatItem,
  flattenCategoryTree,
} from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';
import { TransactionDetailModal } from './TransactionDetailModal';
import { TableFilterDropdown, TableFilterOption } from './TableFilterDropdown';
import { AccountCombobox } from './AccountCombobox';
import { TransactionMobileList } from './TransactionMobileList';

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total];
  }
  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

interface TransactionTableProps {
  initialTransactions: TransactionWithDetails[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary?: {
    totalAmountCents: number;
  };
  accounts: AccountWithBalance[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees?: PayeeWithRules[];
  selectedAccountId?: string;
  selectedCategoryId?: string;
  selectedPayeeId?: string;
  initialSearch?: string;
}

export function TransactionTable({
  initialTransactions,
  pagination,
  summary,
  accounts,
  categories: inputCategories,
  payees = [],
  selectedAccountId,
  selectedCategoryId,
  selectedPayeeId,
  initialSearch,
}: TransactionTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch || '');
  const [filterAccount, setFilterAccount] = useState(selectedAccountId || '');
  const [filterCategory, setFilterCategory] = useState(selectedCategoryId || '');
  const [filterPayee, setFilterPayee] = useState(selectedPayeeId || '');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);

  // Synchronize local states when props change (e.g. navigation / URL update)
  useEffect(() => {
    setSearch(initialSearch || '');
  }, [initialSearch]);

  useEffect(() => {
    setFilterAccount(selectedAccountId || '');
  }, [selectedAccountId]);

  useEffect(() => {
    setFilterCategory(selectedCategoryId || '');
  }, [selectedCategoryId]);

  useEffect(() => {
    setFilterPayee(selectedPayeeId || '');
  }, [selectedPayeeId]);

  const updateQuery = (updates: {
    account?: string;
    category?: string;
    payee?: string;
    search?: string;
    page?: number;
  }) => {
    const currentParams = new URLSearchParams(searchParams.toString());

    const targetAccount = updates.account !== undefined ? updates.account : (currentParams.get('account') || '');
    const targetCategory = updates.category !== undefined ? updates.category : (currentParams.get('category') || '');
    const targetPayee = updates.payee !== undefined ? updates.payee : (currentParams.get('payee') || '');
    const targetSearch = updates.search !== undefined ? updates.search : (currentParams.get('search') || '');
    const targetPage = updates.page !== undefined ? updates.page : 1;

    const newParams = new URLSearchParams();
    if (targetAccount) newParams.set('account', targetAccount);
    if (targetCategory) newParams.set('category', targetCategory);
    if (targetPayee) newParams.set('payee', targetPayee);
    if (targetSearch.trim()) newParams.set('search', targetSearch.trim());
    if (targetPage > 1) newParams.set('page', targetPage.toString());

    const qs = newParams.toString();
    const url = qs ? `/transactions?${qs}` : '/transactions';

    startTransition(() => {
      router.push(url, { scroll: false });
    });
  };

  // Debounced search query update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (initialSearch || '')) {
        updateQuery({ search, page: 1 });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, initialSearch]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      updateQuery({ search, page: 1 });
    }
  };

  const handleAccountChange = (val: string) => {
    setFilterAccount(val);
    updateQuery({ account: val, page: 1 });
  };

  const handleCategoryChange = (val: string) => {
    setFilterCategory(val);
    updateQuery({ category: val, page: 1 });
  };

  const handlePayeeChange = (val: string) => {
    setFilterPayee(val);
    updateQuery({ payee: val, page: 1 });
  };

  const handleReset = () => {
    setFilterAccount('');
    setFilterCategory('');
    setFilterPayee('');
    setSearch('');
    startTransition(() => {
      router.push('/transactions', { scroll: false });
    });
  };

  const currentPage = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 100;
  const totalCount = pagination?.totalCount ?? initialTransactions.length;
  const totalPages = pagination?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages && p !== currentPage) {
      updateQuery({ page: p });
    }
  };

  const flatCategories = useMemo<CategoryFlatItem[]>(() => {
    if (inputCategories.length === 0) return [];
    if ('children' in inputCategories[0]) {
      return flattenCategoryTree(inputCategories as CategoryNode[]);
    }
    return inputCategories as CategoryFlatItem[];
  }, [inputCategories]);


  const categoryOptions: TableFilterOption[] = useMemo(
    () =>
      flatCategories.map((cat) => ({
        id: cat.id,
        label: cat.name,
        subtext: cat.path.length > 1 ? cat.path.slice(0, -1).join(' › ') : undefined,
        depth: cat.depth,
      })),
    [flatCategories]
  );

  const payeeOptions: TableFilterOption[] = useMemo(() => {
    return payees
      .filter((p) => (p.priority ?? 1) !== 3 || p.id === filterPayee)
      .sort((a, b) => {
        const prioA = a.priority ?? 1;
        const prioB = b.priority ?? 1;
        if (prioA !== prioB) return prioA - prioB;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      })
      .map((p) => ({
        id: p.id,
        label: p.name,
        isFavorite: (p.priority ?? 1) === 0,
        badge: (p.priority ?? 1) === 3 ? 'Archived' : undefined,
      }));
  }, [payees, filterPayee]);

  const isSpecificAccount = Boolean(filterAccount);

  const displayedTransactions = useMemo(() => {
    return isSpecificAccount
      ? initialTransactions
      : deduplicateTransfers(initialTransactions);
  }, [initialTransactions, isSpecificAccount]);

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);
  const pageNumbers = getPageNumbers(currentPage, totalPages);

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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-xl">
          {isPending ? (
            <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600 animate-spin" />
          ) : (
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search payees, categories, notes..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Account Filter */}
          <AccountCombobox
            accounts={accounts}
            value={filterAccount}
            onChange={handleAccountChange}
            allLabel="All Accounts"
            searchPlaceholder="Filter accounts..."
            className="flex-1 min-w-[130px] sm:flex-none sm:w-44"
          />

          {/* Category Filter */}
          <TableFilterDropdown
            allLabel="All Categories"
            value={filterCategory}
            options={categoryOptions}
            onChange={handleCategoryChange}
            searchPlaceholder="Filter categories..."
            className="flex-1 min-w-[140px] sm:flex-none sm:w-48"
          />

          {/* Payee Filter */}
          {payees.length > 0 && (
            <TableFilterDropdown
              allLabel="All Payees"
              value={filterPayee}
              options={payeeOptions}
              onChange={handlePayeeChange}
              searchPlaceholder="Filter payees..."
              className="flex-1 min-w-[130px] sm:flex-none sm:w-48"
            />
          )}

          {(filterAccount || filterCategory || filterPayee || search) && (
            <button
              onClick={handleReset}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline px-1 shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table & List Container */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        {/* Mobile List View (< 768px) */}
        <div className="block md:hidden">
          <TransactionMobileList
            transactions={displayedTransactions}
            isSpecificAccount={isSpecificAccount}
            isPending={isPending}
            onSelectTransaction={setSelectedTransaction}
            onToggleCleared={handleToggleCleared}
          />
        </div>

        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
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
            <tbody className={cn('divide-y divide-zinc-100 dark:divide-zinc-800/60 transition-opacity', isPending && 'opacity-60 pointer-events-none')}>
              {displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                    No transactions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx) => {
                  const transferDetails = getTransferDetails(tx);
                  const isTransfer = transferDetails.isTransfer;
                  const isIncome = !isTransfer && tx.amountCents > 0;
                  const isTransferInflow = isTransfer && tx.amountCents > 0;

                  return (
                    <tr
                      key={tx.id}
                      tabIndex={0}
                      onClick={() => setSelectedTransaction(tx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                            e.preventDefault();
                            setSelectedTransaction(tx);
                          }
                        }
                      }}
                      className="group cursor-pointer hover:bg-zinc-50/75 transition-colors dark:hover:bg-zinc-800/40 focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800/60"
                    >
                      {/* Cleared Toggle */}
                      <td className="py-3 pl-4 pr-2 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCleared(tx.id);
                          }}
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
                          {isTransfer && !isSpecificAccount
                            ? transferDetails.targetAccountName
                            : tx.accountName}
                        </span>
                      </td>

                      {/* Payee / Transfer */}
                      <td className="py-3 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isTransfer ? (
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                              <span>
                                {isSpecificAccount
                                  ? `Transfer: ${tx.transferAccountName || 'Account'}`
                                  : `Transfer: ${transferDetails.sourceAccountName}`}
                              </span>
                            </div>
                          ) : (
                            <span>
                              {tx.payeeName || <span className="text-zinc-400 italic">No Payee</span>}
                            </span>
                          )}
                          {tx.excludeFromBudgets && (
                            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              Budget Exempt
                            </span>
                          )}
                        </div>
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
                          isTransfer && !isSpecificAccount
                            ? 'text-zinc-700 dark:text-zinc-300'
                            : isIncome || isTransferInflow
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isTransfer
                            ? 'text-zinc-700 dark:text-zinc-300'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {isTransfer && !isSpecificAccount
                          ? formatCurrency(transferDetails.unsignedAmountCents)
                          : formatCurrency(tx.amountCents, { showSign: isIncome || isTransferInflow })}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tx.id, isTransfer);
                          }}
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

        {/* Footer Summary & Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <span>
              {totalCount === 0 ? (
                'No transactions'
              ) : (
                <>
                  Showing <strong className="text-zinc-800 dark:text-zinc-200">{startItem}</strong> to{' '}
                  <strong className="text-zinc-800 dark:text-zinc-200">{endItem}</strong> of{' '}
                  <strong className="text-zinc-800 dark:text-zinc-200">{totalCount}</strong> transactions
                </>
              )}
            </span>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <>
              {/* Mobile Compact Pagination (< 640px) */}
              <div className="flex sm:hidden items-center justify-between w-full py-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Desktop Numbered Pagination (>= 640px) */}
              <div className="hidden sm:flex items-center gap-1 self-center sm:self-auto">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isPending}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {pageNumbers.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-zinc-400 select-none">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePageChange(p)}
                      disabled={isPending}
                      className={cn(
                        'inline-flex items-center justify-center h-8 min-w-8 px-2.5 rounded-lg text-xs font-semibold transition-colors',
                        p === currentPage
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      )}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isPending}
                  className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {/* Totals */}
          <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-zinc-200/50 sm:border-t-0 pt-2 sm:pt-0 dark:border-zinc-800/50">
            <span>
              Page Net:{' '}
              <strong className="text-zinc-900 dark:text-zinc-100">
                {formatCurrency(initialTransactions.reduce((acc, t) => acc + t.amountCents, 0))}
              </strong>
            </span>
            {summary !== undefined && (
              <span>
                Total Net:{' '}
                <strong className="text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(summary.totalAmountCents)}
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <TransactionDetailModal
        isOpen={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
        accounts={accounts}
        categories={inputCategories}
        payees={payees}
      />
    </div>
  );
}
