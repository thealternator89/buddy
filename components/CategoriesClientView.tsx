'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  CategoryGroupWithStats,
  archiveCategory,
} from '@/lib/actions/categories';
import { CategoryModal } from './CategoryModal';
import {
  PlusCircle,
  Tag,
  Folder,
  ArrowRight,
  Pencil,
  Archive,
} from 'lucide-react';

interface CategoriesClientViewProps {
  groups: CategoryGroupWithStats[];
  showHeader?: boolean;
}

export function CategoriesClientView({
  groups,
  showHeader = true,
}: CategoriesClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<{
    id: string;
    name: string;
    groupId?: string;
    mode: 'category' | 'group';
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenNew = () => {
    setEditItem(null);
    setIsModalOpen(true);
  };

  const handleEditCategory = (cat: { id: string; name: string; groupId: string }) => {
    setEditItem({
      id: cat.id,
      name: cat.name,
      groupId: cat.groupId,
      mode: 'category',
    });
    setIsModalOpen(true);
  };

  const handleEditGroup = (group: { id: string; name: string }) => {
    setEditItem({
      id: group.id,
      name: group.name,
      mode: 'group',
    });
    setIsModalOpen(true);
  };

  const handleArchiveCategory = (catId: string, catName: string) => {
    if (confirm(`Are you sure you want to archive "${catName}"? It will no longer appear in category selectors.`)) {
      startTransition(async () => {
        await archiveCategory(catId);
      });
    }
  };

  const totalCategories = groups.reduce((acc, g) => acc + g.categories.length, 0);

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Categories
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Organize transactions into groups and manage categories.
            </p>
          </div>

          <button
            onClick={handleOpenNew}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Category / Group</span>
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Category Groups
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Folder className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {groups.length}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">groups</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Categories
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Tag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {totalCategories}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">active categories</span>
          </div>
        </div>
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
                <button
                  onClick={() => handleEditGroup(group)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  title="Edit Group Name"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {group.categories.length} {group.categories.length === 1 ? 'category' : 'categories'}
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

                    <div className="flex items-center gap-2 sm:gap-3">
                      <Link
                        href={`/transactions?category=${cat.id}`}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 px-2 py-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                      >
                        Transactions <ArrowRight className="h-3 w-3" />
                      </Link>

                      <div className="flex items-center gap-1 border-l border-zinc-100 pl-2 dark:border-zinc-800">
                        <button
                          onClick={() => handleEditCategory(cat)}
                          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          title="Edit Category"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchiveCategory(cat.id, cat.name)}
                          disabled={isPending}
                          className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
                          title="Archive Category"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
          key={editItem ? editItem.id : 'new'}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          categoryGroups={groups}
          editItem={editItem}
        />
      )}
    </div>
  );
}
