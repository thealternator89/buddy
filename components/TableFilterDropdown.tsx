'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TableFilterOption {
  id: string;
  label: string;
  subtext?: string;
  badge?: string;
  isFavorite?: boolean;
  depth?: number;
}

interface TableFilterDropdownProps {
  allLabel: string;
  value: string;
  options: TableFilterOption[];
  onChange: (id: string) => void;
  searchPlaceholder?: string;
  className?: string;
}

export function TableFilterDropdown({
  allLabel,
  value,
  options,
  onChange,
  searchPlaceholder = 'Filter...',
  className,
}: TableFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === value),
    [options, value]
  );

  const query = search.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchSubtext = opt.subtext?.toLowerCase().includes(query);
      return matchLabel || matchSubtext;
    });
  }, [options, query]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch('');
  };

  const isFiltered = Boolean(value);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button - styled identically to the search box */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-xs sm:text-sm text-zinc-900 shadow-xs transition-colors',
          'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
          'dark:bg-zinc-900 dark:text-zinc-100',
          isFiltered
            ? 'border-emerald-500/50 bg-emerald-50/40 text-emerald-950 font-medium dark:border-emerald-500/50 dark:bg-emerald-950/20 dark:text-emerald-200'
            : 'border-zinc-200 hover:bg-zinc-50/75 dark:border-zinc-800 dark:hover:bg-zinc-800/60',
          className
        )}
        title={selectedOption ? selectedOption.label : allLabel}
      >
        <span className="truncate text-left flex-1">
          {selectedOption ? (
            <span>
              {selectedOption.isFavorite && <span className="mr-1">⭐</span>}
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-zinc-700 dark:text-zinc-300">{allLabel}</span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {isFiltered && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect('');
              }}
              className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded transition-colors"
              title="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-zinc-400 transition-transform duration-150',
              isOpen && 'rotate-180 text-zinc-600 dark:text-zinc-200'
            )}
          />
        </div>
      </button>

      {/* Floating Filter Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 sm:w-72 max-w-[90vw] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Inner Search Box */}
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-7 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Option List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
            {/* "All" default option */}
            {!query && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                  !value
                    ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                )}
              >
                <span>{allLabel}</span>
                {!value && <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                No matching results found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                const indent = opt.depth ? opt.depth * 12 : 0;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                      isSelected
                        ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    )}
                    style={{ paddingLeft: `${indent + 10}px` }}
                  >
                    <div className="min-w-0 pr-2">
                      {opt.subtext && (
                        <div className="text-[10px] text-zinc-400 truncate">
                          {opt.subtext} ›
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 truncate">
                        {opt.depth !== undefined && opt.depth > 0 && (
                          <span className="text-zinc-400 shrink-0">↳</span>
                        )}
                        {opt.isFavorite && <span className="shrink-0">⭐</span>}
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="shrink-0 text-[10px] rounded bg-zinc-100 px-1 py-0.2 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-auto" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
