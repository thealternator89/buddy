'use client';

import { useState, useTransition, useMemo } from 'react';
import { X, FolderTree } from 'lucide-react';
import { createCategory, updateCategory } from '@/lib/actions/categories';
import {
  CategoryNode,
  CategoryFlatItem,
  flattenCategoryTree,
} from '@/lib/category-utils';

export interface EditCategoryData {
  id: string;
  name: string;
  parentId?: string | null;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: (CategoryNode | CategoryFlatItem)[];
  editItem?: EditCategoryData | null;
  defaultParentId?: string | null;
}

export function CategoryModal({
  isOpen,
  onClose,
  categories: inputCategories,
  editItem,
  defaultParentId,
}: CategoryModalProps) {
  const isEditing = Boolean(editItem);

  const flatCategories = useMemo<CategoryFlatItem[]>(() => {
    if (inputCategories.length === 0) return [];
    if ('children' in inputCategories[0]) {
      return flattenCategoryTree(inputCategories as CategoryNode[]);
    }
    return inputCategories as CategoryFlatItem[];
  }, [inputCategories]);

  const [name, setName] = useState(editItem?.name || '');
  const [parentId, setParentId] = useState<string>(
    editItem ? (editItem.parentId || '') : (defaultParentId || '')
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // If editing, calculate invalid parent IDs (the item itself and all its descendants)
  const invalidParentIds = useMemo<Set<string>>(() => {
    if (!editItem) return new Set();
    const set = new Set<string>([editItem.id]);

    // Gather descendants
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of flatCategories) {
        if (c.parentId && set.has(c.parentId) && !set.has(c.id)) {
          set.add(c.id);
          changed = true;
        }
      }
    }
    return set;
  }, [editItem, flatCategories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a category name.');
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing && editItem) {
          await updateCategory(editItem.id, {
            name: name.trim(),
            parentId: parentId || null,
          });
        } else {
          await createCategory(name.trim(), parentId || null);
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save category.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isEditing ? 'Edit Category' : 'New Category'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isEditing
                  ? 'Update category name or move in the tree'
                  : 'Add a new category or subcategory to your hierarchy'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Category Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Supermarket, Convenience, Bar"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Parent Category (Optional)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 font-mono"
            >
              <option value="">None (Top-Level Category)</option>
              {flatCategories.map((c) => {
                const isInvalid = invalidParentIds.has(c.id);
                const indent = '  '.repeat(c.depth);
                const prefix = c.depth > 0 ? '↳ ' : '● ';
                return (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={isInvalid}
                  >
                    {indent}{prefix}{c.name} {isInvalid ? '(cannot select)' : ''}
                  </option>
                );
              })}
            </select>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              Choose a parent to make this a nested subcategory, or leave as &quot;None&quot; for a root category.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
