'use client';

import { useState, useRef, useEffect } from 'react';
import { PayeeWithRules } from '@/lib/actions/payees';
import { Plus, Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayeeComboboxProps {
  payees: PayeeWithRules[];
  value: string;
  onChange: (payeeName: string, defaultCategoryId?: string | null, payee?: PayeeWithRules | null) => void;
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
  const [prevValue, setPrevValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setQuery(value);
  }

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

  // Exclude archived payees (priority 3) from selection lists
  const activePayees = payees.filter((p) => (p.priority ?? 1) !== 3);

  // Before entry (query is empty): display ONLY Priority 0 (highest) payees
  // After entry (query is not empty): display matching payees ordered by Priority (0 > 1 > 2)
  const isBeforeEntry = !trimmedQuery;

  let filteredPayees: PayeeWithRules[] = [];
  if (isBeforeEntry) {
    filteredPayees = activePayees
      .filter((p) => (p.priority ?? 1) === 0)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  } else {
    const matches = activePayees.filter((p) =>
      p.name.toLowerCase().includes(trimmedQuery)
    );

    // Sort order:
    // 1. Priority: 0 (Highest) -> 1 (Standard) -> 2 (Low, even if better match)
    // 2. Match quality within same priority: exact match -> startsWith -> contains
    // 3. Alphabetical
    filteredPayees = matches.sort((a, b) => {
      const prioA = a.priority ?? 1;
      const prioB = b.priority ?? 1;
      if (prioA !== prioB) {
        return prioA - prioB;
      }

      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      const exactA = nameA === trimmedQuery ? 0 : 1;
      const exactB = nameB === trimmedQuery ? 0 : 1;
      if (exactA !== exactB) return exactA - exactB;

      const startsA = nameA.startsWith(trimmedQuery) ? 0 : 1;
      const startsB = nameB.startsWith(trimmedQuery) ? 0 : 1;
      if (startsA !== startsB) return startsA - startsB;

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  const exactMatch = activePayees.find(
    (p) => p.name.toLowerCase() === trimmedQuery
  );

  const handleSelectPayee = (payee: PayeeWithRules) => {
    setQuery(payee.name);
    onChange(payee.name, payee.defaultCategoryId, payee);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    const name = query.trim();
    if (!name) return;
    onChange(name, null, null);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery('');
    onChange('', null, null);
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

          {/* Header before entry */}
          {isBeforeEntry && (
            <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-zinc-800/60 mb-0.5">
              <span>Priority Payees</span>
              <span className="text-[10px] font-normal lowercase tracking-normal text-zinc-400">
                Type to search all
              </span>
            </div>
          )}

          {/* List of payees */}
          {isBeforeEntry && filteredPayees.length === 0 ? (
            <div className="px-3 py-3 text-xs text-zinc-400 text-center">
              No highest priority payees.<br />
              <span className="text-[11px] text-zinc-400/80">Type to search, or set payees to Priority 0 in Manage to see them here.</span>
            </div>
          ) : !isBeforeEntry && filteredPayees.length === 0 && !exactMatch ? (
            <div className="px-3 py-2 text-xs text-zinc-400">No other existing payees found.</div>
          ) : !isBeforeEntry && filteredPayees.length === 0 && exactMatch ? null : (
            filteredPayees.map((payee) => {
              const isSelected = value.toLowerCase() === payee.name.toLowerCase();
              const pRank = payee.priority ?? 1;
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
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{payee.name}</span>
                    {pRank === 0 && (
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                        Highest
                      </span>
                    )}
                    {pRank === 2 && (
                      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                        Low
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
