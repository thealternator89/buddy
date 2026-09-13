'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { PayeeWithStats } from '@/lib/actions/payees';
import {
  CategoryNode,
  CategoryFlatItem,
  flattenCategoryTree,
} from '@/lib/category-utils';
import {
  Building2,
  Search,
  PlusCircle,
  Pencil,
  Trash2,
  ArrowRight,
  Tag,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface PayeesTabProps {
  payees: PayeeWithStats[];
  categories: (CategoryNode | CategoryFlatItem)[];
  onNewPayee: () => void;
  onEditPayee: (payee: PayeeWithStats) => void;
  onDeletePayee: (payee: PayeeWithStats) => void;
}

export function PayeesTab({
  payees,
  categories: inputCategories,
  onNewPayee,
  onEditPayee,
  onDeletePayee,
}: PayeesTabProps) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc'>('name-asc');

  const flatCategories = useMemo<CategoryFlatItem[]>(() => {
    if (inputCategories.length === 0) return [];
    if ('children' in inputCategories[0]) {
      return flattenCategoryTree(inputCategories as CategoryNode[]);
    }
    return inputCategories as CategoryFlatItem[];
  }, [inputCategories]);

  // Compute stats
  const totalPayees = payees.length;
  const categorizedCount = payees.filter((p) => Boolean(p.defaultCategoryId)).length;
  const uncategorizedCount = totalPayees - categorizedCount;

  // Filter & sort payees
  const filteredPayees = useMemo(() => {
    let result = [...payees];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.defaultCategoryName?.toLowerCase().includes(q) ||
          p.parentCategoryName?.toLowerCase().includes(q)
      );
    }

    if (filterCategory === 'categorized') {
      result = result.filter((p) => Boolean(p.defaultCategoryId));
    } else if (filterCategory === 'uncategorized') {
      result = result.filter((p) => !p.defaultCategoryId);
    } else if (filterCategory !== 'all') {
      result = result.filter((p) => p.defaultCategoryId === filterCategory);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
      }
      return 0;
    });

    return result;
  }, [payees, search, filterCategory, sortBy]);

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Payees
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {totalPayees}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">registered</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Default Categories
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {categorizedCount}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              ({totalPayees > 0 ? Math.round((categorizedCount / totalPayees) * 100) : 0}%)
            </span>
          </div>
          {uncategorizedCount > 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {uncategorizedCount} {uncategorizedCount === 1 ? 'payee needs' : 'payees need'} a default category
            </p>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payees by name or category..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-4 text-sm text-zinc-800 placeholder-zinc-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder-zinc-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm text-zinc-800 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 font-mono"
          >
            <option value="all">All Categories</option>
            <option value="categorized">Categorized Only</option>
            <option value="uncategorized">No Default Category</option>
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

          {/* Sort Filter */}
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'name-asc' | 'name-desc')
            }
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs sm:text-sm text-zinc-800 shadow-xs focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>

          {(search || filterCategory !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setFilterCategory('all');
              }}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline px-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Payees List */}
      {filteredPayees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {search || filterCategory !== 'all' ? 'No matching payees found' : 'No payees yet'}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {search || filterCategory !== 'all'
              ? 'Try changing your search keywords or filter options.'
              : 'Add your first payee to streamline tracking and categorize future transactions automatically.'}
          </p>
          <div className="mt-6">
            {search || filterCategory !== 'all' ? (
              <button
                onClick={() => {
                  setSearch('');
                  setFilterCategory('all');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Clear filters
              </button>
            ) : (
              <button
                onClick={onNewPayee}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add Payee</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {filteredPayees.map((payee) => {
              const hasDefaultCat = Boolean(payee.defaultCategoryId && payee.defaultCategoryName);
              return (
                <div
                  key={payee.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 hover:bg-zinc-50/75 transition-colors dark:hover:bg-zinc-800/40 gap-3"
                >
                  {/* Left: Payee Name and Default Category */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 font-bold text-sm">
                      {payee.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-base truncate">
                          {payee.name}
                        </span>
                        {hasDefaultCat ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <Tag className="h-3 w-3" />
                            <span>
                              {payee.parentCategoryName
                                ? `${payee.parentCategoryName} › `
                                : ''}
                              {payee.defaultCategoryName}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            <AlertCircle className="h-3 w-3 text-zinc-400" />
                            <span>No default category</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pl-13 sm:pl-0">
                    <Link
                      href={`/transactions?payee=${payee.id}`}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 px-2 py-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      title="View transactions for this payee"
                    >
                      Transactions <ArrowRight className="h-3 w-3" />
                    </Link>

                    <div className="flex items-center gap-1 border-l border-zinc-100 pl-2 dark:border-zinc-800">
                      <button
                        onClick={() => onEditPayee(payee)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        title="Edit Payee"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDeletePayee(payee)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                        title="Delete Payee"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
