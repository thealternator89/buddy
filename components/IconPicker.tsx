'use client';

import { useState, useMemo } from 'react';
import { Search, X, Check } from 'lucide-react';
import { AccountIcon } from './AccountIcon';
import {
  ICON_CATEGORIES,
  searchIcons,
  formatIconName,
  resolveIconName,
} from '@/lib/icons';

interface IconPickerProps {
  value: string | null;
  onChange: (iconName: string | null) => void;
  accountType?: string;
}

const PAGE_SIZE = 72;

export function IconPicker({ value, onChange, accountType }: IconPickerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('popular');
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

  // Compute matching icons
  const matchingIcons = useMemo(() => {
    return searchIcons(search, selectedCategory);
  }, [search, selectedCategory]);

  const visibleIcons = useMemo(() => {
    return matchingIcons.slice(0, displayLimit);
  }, [matchingIcons, displayLimit]);

  const effectiveIcon = resolveIconName(value, accountType);
  const isCustom = Boolean(value);

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setDisplayLimit(PAGE_SIZE);
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    setDisplayLimit(PAGE_SIZE);
  };

  return (
    <div className="space-y-3">
      {/* Header and Reset Option */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Account Icon
        </label>
        {isCustom && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline"
          >
            Reset to Auto
          </button>
        )}
      </div>

      {/* Selected Preview Box */}
      <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 bg-zinc-50/75 dark:border-zinc-800 dark:bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700">
            <AccountIcon icon={effectiveIcon} type={accountType} className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {formatIconName(effectiveIcon)}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {isCustom ? 'Custom selection' : 'Automatic (by account type)'}
            </div>
          </div>
        </div>

        {isCustom && (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            Custom
          </span>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search 1,800+ icons (e.g. dog, cat, car, vault)..."
          className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-8 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {search && (
          <button
            type="button"
            onClick={() => handleSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category Pills (horizontal scroll) - shown when search is empty */}
      {!search.trim() && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {ICON_CATEGORIES.map((cat) => {
            const isCatSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition-all ${
                  isCatSelected
                    ? 'bg-zinc-900 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Icons Grid */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-2 dark:border-zinc-800 dark:bg-zinc-800/30">
        {search.trim() && (
          <div className="px-1 pb-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <span>
              Found <strong>{matchingIcons.length}</strong> {matchingIcons.length === 1 ? 'icon' : 'icons'} for &ldquo;{search}&rdquo;
            </span>
          </div>
        )}

        {visibleIcons.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            No icons found matching &ldquo;{search}&rdquo;. Try another keyword like &ldquo;dog&rdquo;, &ldquo;home&rdquo;, or &ldquo;travel&rdquo;.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {visibleIcons.map((iconName) => {
                const isSelected =
                  value === iconName || (value === null && iconName === effectiveIcon);

                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => onChange(iconName)}
                    title={formatIconName(iconName)}
                    className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                      isSelected
                        ? 'bg-white shadow-xs ring-2 ring-emerald-500 dark:bg-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-700/60'
                    }`}
                  >
                    <AccountIcon
                      icon={iconName}
                      type={accountType}
                      className="h-4 w-4"
                    />
                    {isSelected && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {matchingIcons.length > displayLimit && (
              <div className="pt-2 text-center border-t border-zinc-200/50 dark:border-zinc-700/50 mt-2">
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  Show more (+{Math.min(PAGE_SIZE, matchingIcons.length - displayLimit)} of {matchingIcons.length - displayLimit} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
