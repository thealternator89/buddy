'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { Search, Check, ChevronDown, X, Wallet } from 'lucide-react';
import { AccountIcon } from './AccountIcon';
import { cn } from '@/lib/utils';

interface AccountComboboxProps {
  accounts: AccountWithBalance[];
  value: string;
  onChange: (accountId: string) => void;
  placeholder?: string;
  allLabel?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AccountCombobox({
  accounts,
  value,
  onChange,
  placeholder = 'Select account...',
  allLabel,
  searchPlaceholder = 'Search accounts...',
  className,
  disabled = false,
}: AccountComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isFilter = Boolean(allLabel);
  const isFiltered = Boolean(value);

  // Selected account
  const selectedAccount = accounts.find((a) => a.id === value);

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

  const trimmedSearch = search.trim().toLowerCase();

  // Search filter
  const filteredAccounts = useMemo(() => {
    if (!trimmedSearch) return accounts;
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(trimmedSearch) ||
        (a.groupName && a.groupName.toLowerCase().includes(trimmedSearch))
    );
  }, [accounts, trimmedSearch]);

  const handleSelect = (accountId: string) => {
    onChange(accountId);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div
      className={cn('relative', isFilter ? 'inline-block' : 'w-full', className)}
      ref={containerRef}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearch('');
          }
        }}
        className={
          isFilter
            ? cn(
                'inline-flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-xs sm:text-sm text-zinc-900 shadow-xs transition-colors',
                'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
                'dark:bg-zinc-900 dark:text-zinc-100',
                isFiltered
                  ? 'border-emerald-500/50 bg-emerald-50/40 text-emerald-950 font-medium dark:border-emerald-500/50 dark:bg-emerald-950/20 dark:text-emerald-200'
                  : 'border-zinc-200 hover:bg-zinc-50/75 dark:border-zinc-800 dark:hover:bg-zinc-800/60',
                disabled && 'opacity-50 pointer-events-none'
              )
            : 'flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white py-2 px-3 text-left text-sm text-zinc-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 disabled:opacity-50'
        }
        title={selectedAccount ? selectedAccount.name : (allLabel || placeholder)}
      >
        <span className="truncate text-left flex-1 min-w-0 pr-1">
          {selectedAccount ? (
            <span className="flex items-center gap-2 min-w-0">
              <AccountIcon
                icon={selectedAccount.icon}
                type={selectedAccount.type}
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className="font-medium truncate">{selectedAccount.name}</span>
            </span>
          ) : (
            <span
              className={cn(
                isFilter
                  ? 'text-zinc-700 dark:text-zinc-300'
                  : 'text-zinc-400 dark:text-zinc-500'
              )}
            >
              {allLabel || placeholder}
            </span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {isFilter && isFiltered && (
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
              isOpen && 'rotate-180',
              isFilter && isOpen && 'text-zinc-600 dark:text-zinc-200'
            )}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-1 max-h-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-100 flex flex-col',
            isFilter ? 'left-0 w-64 sm:w-72 max-w-[90vw]' : 'w-full'
          )}
        >
          {/* Search input */}
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

          {/* Scrollable list */}
          <div className="overflow-y-auto max-h-60 p-1 space-y-0.5">
            {/* "All Accounts" default option */}
            {allLabel && !trimmedSearch && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg py-1.5 px-3 text-left text-xs transition-colors',
                  !value
                    ? 'bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Wallet className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{allLabel}</span>
                </div>
                {!value && (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                )}
              </button>
            )}

            {filteredAccounts.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-zinc-400">
                No matching accounts found.
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const isSelected = value === acc.id;

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleSelect(acc.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg py-1.5 px-3 text-left text-xs transition-colors',
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/60 dark:text-emerald-200'
                        : 'text-zinc-900 font-medium hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AccountIcon
                        icon={acc.icon}
                        type={acc.type}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <span className="truncate">{acc.name}</span>
                      {acc.groupName && (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                          ({acc.groupName})
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
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
