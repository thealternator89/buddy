'use client';

import { useState, useRef, useEffect, useTransition, useMemo } from 'react';
import { createCategory } from '@/lib/actions/categories';
import {
  CategoryNode,
  CategoryFlatItem,
  flattenCategoryTree,
} from '@/lib/category-utils';
import { Search, Plus, Check, ChevronDown, X, Folder, Tag, CornerDownRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryComboboxProps {
  categories: (CategoryNode | CategoryFlatItem)[];
  value: string; // selected categoryId
  onChange: (categoryId: string) => void;
  placeholder?: string;
}

export function CategoryCombobox({
  categories: inputCategories,
  value,
  onChange,
  placeholder = 'Select category...',
}: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creatingCategoryName, setCreatingCategoryName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize input into flat items with paths and depth
  const flatCategories = useMemo<CategoryFlatItem[]>(() => {
    if (inputCategories.length === 0) return [];
    // Check if input is CategoryNode[]
    if ('children' in inputCategories[0]) {
      return flattenCategoryTree(inputCategories as CategoryNode[]);
    }
    return inputCategories as CategoryFlatItem[];
  }, [inputCategories]);

  // Local state for optimistic additions
  const [localCategories, setLocalCategories] = useState(flatCategories);
  const [prevFlat, setPrevFlat] = useState(flatCategories);
  if (flatCategories !== prevFlat) {
    setPrevFlat(flatCategories);
    setLocalCategories(flatCategories);
  }

  // Currently selected category
  const selectedCategory = localCategories.find((c) => c.id === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setCreatingCategoryName(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedSearch = search.trim().toLowerCase();

  // Search filter
  const filteredCategories = useMemo(() => {
    if (!trimmedSearch) return localCategories;
    return localCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(trimmedSearch) ||
        c.fullPathName.toLowerCase().includes(trimmedSearch)
    );
  }, [localCategories, trimmedSearch]);

  const exactMatch = localCategories.find(
    (c) => c.name.toLowerCase() === trimmedSearch
  );

  const handleSelectCategory = (catId: string) => {
    onChange(catId);
    setIsOpen(false);
    setSearch('');
    setCreatingCategoryName(null);
  };

  const handleCreateCategory = (parentId: string | null) => {
    if (!creatingCategoryName) return;
    const catName = creatingCategoryName.trim();

    startTransition(async () => {
      try {
        const res = await createCategory(catName, parentId);
        if (res.success && res.id) {
          const parent = parentId ? localCategories.find((c) => c.id === parentId) : null;
          const newDepth = parent ? parent.depth + 1 : 0;
          const newPath = parent ? [...parent.path, catName] : [catName];

          const newItem: CategoryFlatItem = {
            id: res.id,
            name: catName,
            parentId,
            depth: newDepth,
            path: newPath,
            fullPathName: newPath.join(' > '),
            hasChildren: false,
            directSpentCents: 0,
            totalSpentCents: 0,
            directTransactionCount: 0,
            totalTransactionCount: 0,
          };

          setLocalCategories((prev) => [...prev, newItem]);
          onChange(res.id);
          setIsOpen(false);
          setSearch('');
          setCreatingCategoryName(null);
        }
      } catch (err) {
        console.error('Failed to create category:', err);
      }
    });
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setCreatingCategoryName(null);
        }}
        className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white py-2 px-3 text-left text-sm text-zinc-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <span className="truncate">
          {selectedCategory ? (
            <span className="flex items-center gap-1.5">
              {selectedCategory.depth > 0 && (
                <span className="text-zinc-400 text-xs dark:text-zinc-500">
                  {selectedCategory.path.slice(0, -1).join(' / ')} /
                </span>
              )}
              <span className="font-medium">{selectedCategory.name}</span>
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              title="Clear category (Uncategorized)"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
          {/* Sub-view: Parent Selection when creating a new category */}
          {creatingCategoryName ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <div>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    Where should &quot;{creatingCategoryName}&quot; live?
                  </span>
                  <p className="text-[11px] text-zinc-400">Choose a parent category or make it top-level</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatingCategoryName(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  Back
                </button>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1">
                {/* Top-level Option */}
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleCreateCategory(null)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50 disabled:opacity-50"
                >
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  <span>None (Make Top-level Category)</span>
                  {isPending && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                </button>

                {/* Existing Categories as Parent */}
                {localCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCreateCategory(c.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
                    style={{ paddingLeft: `${c.depth * 14 + 12}px` }}
                  >
                    {c.depth > 0 ? (
                      <CornerDownRight className="h-3 w-3 text-zinc-400 shrink-0" />
                    ) : (
                      <Folder className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    )}
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Search input */}
              <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search or add category..."
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Scrollable list */}
              <div className="overflow-y-auto max-h-60 p-1 space-y-0.5">
                {/* Create Category option */}
                {search.trim() && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => setCreatingCategoryName(search.trim())}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Create category &quot;<strong>{search.trim()}</strong>&quot;...
                    </span>
                  </button>
                )}

                {/* Uncategorized option */}
                {!search.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelectCategory('')}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
                      value === '' && 'bg-zinc-100 font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                    )}
                  >
                    <span>Uncategorized</span>
                    {value === '' && <Check className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-300" />}
                  </button>
                )}

                {/* Category Items */}
                {filteredCategories.length === 0 && search.trim() && exactMatch ? null : filteredCategories.length === 0 && search.trim() ? (
                  <div className="px-3 py-3 text-center text-xs text-zinc-400">
                    No matching categories found.
                  </div>
                ) : (
                  filteredCategories.map((cat) => {
                    const isSelected = value === cat.id;
                    const isRoot = cat.depth === 0;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg py-1.5 pr-3 text-left text-xs transition-colors',
                          isSelected
                            ? 'bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/60 dark:text-emerald-200'
                            : isRoot
                            ? 'text-zinc-900 font-medium hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'
                            : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                        )}
                        style={{ paddingLeft: `${cat.depth * 14 + 10}px` }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {cat.depth > 0 ? (
                            <CornerDownRight className="h-3 w-3 text-zinc-400 shrink-0" />
                          ) : (
                            <Tag className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          )}
                          <span className="truncate">{cat.name}</span>
                          {/* If in search mode, display full path breadcrumb */}
                          {trimmedSearch && cat.depth > 0 && (
                            <span className="text-[10px] text-zinc-400 truncate">
                              ({cat.fullPathName})
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
