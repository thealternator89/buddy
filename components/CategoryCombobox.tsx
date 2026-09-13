'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { CategoryGroupWithChildren, createCategory } from '@/lib/actions/categories';
import { Search, Plus, Check, ChevronDown, X, Folder, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryComboboxProps {
  categoryGroups: CategoryGroupWithChildren[];
  value: string; // selected categoryId
  onChange: (categoryId: string) => void;
  placeholder?: string;
}

export function CategoryCombobox({
  categoryGroups,
  value,
  onChange,
  placeholder = 'Select or create category...',
}: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creatingCategoryName, setCreatingCategoryName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep a local copy of groups so newly created categories appear instantly
  const [prevCategoryGroups, setPrevCategoryGroups] = useState(categoryGroups);
  const [groups, setGroups] = useState(categoryGroups);

  if (categoryGroups !== prevCategoryGroups) {
    setPrevCategoryGroups(categoryGroups);
    setGroups(categoryGroups);
  }

  // Find currently selected category
  const allCategories = groups.flatMap((g) =>
    g.categories.map((c) => ({ ...c, groupName: g.name }))
  );
  const selectedCategory = allCategories.find((c) => c.id === value);

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

  // Filter groups and categories
  const filteredGroups = groups
    .map((group) => {
      const matchingCats = group.categories.filter(
        (cat) =>
          cat.name.toLowerCase().includes(trimmedSearch) ||
          group.name.toLowerCase().includes(trimmedSearch)
      );
      return {
        ...group,
        categories: matchingCats,
      };
    })
    .filter((group) => group.categories.length > 0);

  const exactCategoryMatch = allCategories.find(
    (c) => c.name.toLowerCase() === trimmedSearch
  );

  const handleSelectCategory = (catId: string) => {
    onChange(catId);
    setIsOpen(false);
    setSearch('');
    setCreatingCategoryName(null);
  };

  const handleCreateInGroup = (groupId: string) => {
    if (!creatingCategoryName) return;
    const catName = creatingCategoryName.trim();

    startTransition(async () => {
      try {
        const res = await createCategory(groupId, catName);
        if (res.success && res.id) {
          // Optimistically update local group list
          setGroups((prev) =>
            prev.map((g) =>
              g.id === groupId
                ? {
                    ...g,
                    categories: [
                      ...g.categories,
                      {
                        id: res.id,
                        groupId,
                        name: catName,
                        sortOrder: g.categories.length + 1,
                        isArchived: false,
                        totalSpentCents: 0,
                        transactionCount: 0,
                      },
                    ],
                  }
                : g
            )
          );

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
              <span className="text-zinc-400 text-xs dark:text-zinc-500">
                {selectedCategory.groupName} /
              </span>
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
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
          {/* Sub-view: Group Selection when creating a new category */}
          {creatingCategoryName ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Select Group for &quot;{creatingCategoryName}&quot;
                </span>
                <button
                  type="button"
                  onClick={() => setCreatingCategoryName(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  Back
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCreateInGroup(g.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-emerald-50 hover:text-emerald-900 transition-colors dark:text-zinc-200 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 disabled:opacity-50"
                  >
                    <Folder className="h-4 w-4 text-zinc-400 shrink-0" />
                    <span className="truncate">{g.name}</span>
                    {isPending && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Search input header */}
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
              <div className="overflow-y-auto max-h-56 p-1 space-y-2">
                {/* Create Category button if search does not match existing */}
                {search.trim() && !exactCategoryMatch && (
                  <button
                    type="button"
                    onClick={() => setCreatingCategoryName(search.trim())}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
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

                {/* Grouped Categories */}
                {filteredGroups.length === 0 && search.trim() && exactCategoryMatch ? null : filteredGroups.length === 0 && search.trim() ? (
                  <div className="px-3 py-3 text-center text-xs text-zinc-400">
                    No matching categories found.
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.id} className="space-y-0.5">
                      <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        {group.name}
                      </div>

                      {group.categories.map((cat) => {
                        const isSelected = value === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleSelectCategory(cat.id)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs transition-colors',
                              isSelected
                                ? 'bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/60 dark:text-emerald-200'
                                : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            )}
                          >
                            <span className="truncate pl-2">{cat.name}</span>
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
