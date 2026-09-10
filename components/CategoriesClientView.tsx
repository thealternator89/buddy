'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CategoryGroupWithStats } from '@/lib/actions/categories';
import { formatCurrency } from '@/lib/utils/currency';
import { CategoryModal } from './CategoryModal';
import { PlusCircle, Tag, Folder, ArrowRight } from 'lucide-react';

interface CategoriesClientViewProps {
  groups: CategoryGroupWithStats[];
}

export function CategoriesClientView({ groups }: CategoriesClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Categories
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Organize transactions into groups and track historical spending.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Category / Group</span>
        </button>
      </div>

      {/* Group Cards */}
      <div className="space-y-6">
        {groups.map((group) => (
          <div
            key={group.id}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Group Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/75 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2.5">
                <Folder className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-zinc-900 text-sm sm:text-base dark:text-zinc-100">
                  {group.name}
                </h3>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Total Spent:{' '}
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(group.totalSpentCents)}
                </span>
              </div>
            </div>

            {/* Categories List */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {group.categories.length === 0 ? (
                <div className="p-4 text-xs text-zinc-400">No categories in this group yet.</div>
              ) : (
                group.categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50/75 transition-colors dark:hover:bg-zinc-800/40 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Tag className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-6">
                      <span className="text-xs text-zinc-400">
                        {cat.transactionCount} {cat.transactionCount === 1 ? 'txn' : 'txns'}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 min-w-[70px] text-right">
                        {formatCurrency(cat.totalSpentCents)}
                      </span>
                      <Link
                        href={`/transactions?category=${cat.id}`}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5"
                      >
                        Transactions <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          categoryGroups={groups}
        />
      )}
    </div>
  );
}
