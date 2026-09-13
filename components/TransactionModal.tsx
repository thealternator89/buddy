'use client';

import { useState, useTransition } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryGroupWithChildren } from '@/lib/actions/categories';
import { Payee } from '@/lib/db/schema';
import { createTransaction } from '@/lib/actions/transactions';
import { APP_CONFIG } from '@/lib/constants';

import { CurrencyInput } from './CurrencyInput';
import { PayeeCombobox } from './PayeeCombobox';
import { CategoryCombobox } from './CategoryCombobox';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
  categoryGroups: CategoryGroupWithChildren[];
  payees: Payee[];
  defaultAccountId?: string;
}

type TxType = 'expense' | 'income' | 'transfer';

export function TransactionModal({
  isOpen,
  onClose,
  accounts,
  categoryGroups,
  payees,
  defaultAccountId,
}: TransactionModalProps) {
  const [type, setType] = useState<TxType>('expense');
  const [accountId, setAccountId] = useState(defaultAccountId || accounts[0]?.id || '');
  const [destAccountId, setDestAccountId] = useState(
    accounts.find((a) => a.id !== (defaultAccountId || accounts[0]?.id))?.id || ''
  );
  const [payeeName, setPayeeName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amountCents, setAmountCents] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [isCleared, setIsCleared] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amountCents <= 0) {
      setError('Please enter an amount greater than $0.00.');
      return;
    }

    if (type === 'transfer') {
      if (!accountId || !destAccountId) {
        setError('Please select both source and destination accounts.');
        return;
      }
      if (accountId === destAccountId) {
        setError('Source and destination accounts must be different.');
        return;
      }

      startTransition(async () => {
        try {
          await createTransaction({
            isTransfer: true,
            sourceAccountId: accountId,
            destinationAccountId: destAccountId,
            amountCents: amountCents,
            date,
            notes: notes.trim() || undefined,
            isCleared,
          });
          onClose();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to record transfer.');
        }
      });
    } else {
      if (!accountId) {
        setError('Please select an account.');
        return;
      }
      if (!payeeName.trim()) {
        setError('Please enter a payee name.');
        return;
      }

      const signedAmount = type === 'expense' ? -amountCents : amountCents;

      startTransition(async () => {
        try {
          await createTransaction({
            isTransfer: false,
            accountId,
            payeeName: payeeName.trim(),
            categoryId: categoryId || null,
            amountCents: signedAmount,
            date,
            notes: notes.trim() || undefined,
            isCleared,
          });
          onClose();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to record transaction.');
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Record Transaction
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Transaction Type Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 mt-4 rounded-xl bg-zinc-100 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
              type === 'expense'
                ? 'bg-white text-rose-600 shadow-xs dark:bg-zinc-900 dark:text-rose-400'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Expense</span>
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
              type === 'income'
                ? 'bg-white text-emerald-600 shadow-xs dark:bg-zinc-900 dark:text-emerald-400'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>Income</span>
          </button>
          <button
            type="button"
            onClick={() => setType('transfer')}
            className={`flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
              type === 'transfer'
                ? 'bg-white text-blue-600 shadow-xs dark:bg-zinc-900 dark:text-blue-400'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            <span>Transfer</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Amount ({APP_CONFIG.currency.code})
            </label>
            <div className="mt-1">
              <CurrencyInput
                valueCents={amountCents}
                onChangeCents={setAmountCents}
                autoFocus
              />
            </div>
          </div>

          {/* Transfer Account Selectors */}
          {type === 'transfer' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  From Account
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  To Account
                </label>
                <select
                  value={destAccountId}
                  onChange={(e) => setDestAccountId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              {/* Single Account Selector & Payee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Account
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {type === 'income' ? 'Payer / Source' : 'Payee'}
                  </label>
                  <div className="mt-1">
                    <PayeeCombobox
                      payees={payees}
                      value={payeeName}
                      onChange={(name, defaultCategoryId) => {
                        setPayeeName(name);
                        if (defaultCategoryId) {
                          setCategoryId(defaultCategoryId);
                        }
                      }}
                      placeholder={type === 'income' ? 'Search or add payer...' : 'Search or add payee...'}
                    />
                  </div>
                </div>
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Category
                </label>
                <div className="mt-1">
                  <CategoryCombobox
                    categoryGroups={categoryGroups}
                    value={categoryId}
                    onChange={setCategoryId}
                  />
                </div>
              </div>
            </>
          )}

          {/* Date & Cleared */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div className="pt-4 sm:pt-6 flex items-center gap-2">
              <input
                type="checkbox"
                id="cleared"
                checked={isCleared}
                onChange={(e) => setIsCleared(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
              />
              <label htmlFor="cleared" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none">
                Cleared transaction
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Fortnightly groceries, coffee with Alex"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {/* Submit buttons */}
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
              {isPending ? 'Saving...' : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
