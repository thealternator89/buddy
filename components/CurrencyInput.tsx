'use client';

import React from 'react';
import { APP_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface CurrencyInputProps {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  required?: boolean;
}

export function CurrencyInput({
  valueCents,
  onChangeCents,
  onBlur,
  id,
  placeholder = '0.00',
  autoFocus,
  className,
  required,
}: CurrencyInputProps) {
  // Format cents to fixed 2 decimal places when > 0, otherwise empty string for placeholder
  const displayValue = valueCents > 0 ? (valueCents / 100).toFixed(2) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Strip all non-digit characters
    const digits = raw.replace(/\D/g, '');

    if (!digits) {
      onChangeCents(0);
      return;
    }

    // Limit to max 10 digits (up to $99,999,999.99)
    const safeDigits = digits.slice(0, 10);
    const parsedCents = parseInt(safeDigits, 10);
    onChangeCents(isNaN(parsedCents) ? 0 : parsedCents);
  };

  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-lg font-bold text-zinc-400 dark:text-zinc-500">
        {APP_CONFIG.currency.symbol}
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        required={required}
        value={displayValue}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-8 pr-4 text-xl font-bold text-zinc-900 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-100',
          className
        )}
      />
    </div>
  );
}
