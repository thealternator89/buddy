'use client';

import { useState, useRef, useEffect } from 'react';
import { Payee } from '@/lib/db/schema';
import { Search, Plus, Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayeeComboboxProps {
  payees: Payee[];
  value: string;
  onChange: (payeeName: string, defaultCategoryId?: string | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PayeeCombobox({
  payees,
  value,
  onChange,
  placeholder = 'Select or create payee...',
  autoFocus,
}: PayeeComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedQuery = query.trim().toLowerCase();

  const filteredPayees = payees.filter((p) =>
    p.name.toLowerCase().includes(trimmedQuery)
  );

  const exactMatch = payees.find(
    (p) => p.name.toLowerCase() === trimmedQuery
  );

  const handleSelectPayee = (payee: Payee) => {
    setQuery(payee.name);
    onChange(payee.name, payee.defaultCategoryId);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    const name = query.trim();
    if (!name) return;
    onChange(name, null);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery('');
    onChange('', null);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            onChange(e.target.value, null);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-3 pr-16 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-100">
          {/* Create New Option */}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>
                Create Payee &quot;<strong>{query.trim()}</strong>&quot;
              </span>
            </button>
          )}

          {/* List of matching payees */}
          {filteredPayees.length === 0 && !query.trim() ? (
            <div className="px-3 py-2 text-xs text-zinc-400">No payees yet. Type to create one.</div>
          ) : filteredPayees.length === 0 && query.trim() && exactMatch ? null : filteredPayees.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-400">No other existing payees found.</div>
          ) : (
            filteredPayees.map((payee) => {
              const isSelected = value.toLowerCase() === payee.name.toLowerCase();
              return (
                <button
                  key={payee.id}
                  type="button"
                  onClick={() => handleSelectPayee(payee)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  )}
                >
                  <span className="truncate">{payee.name}</span>
                  {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
