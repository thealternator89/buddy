'use client';

import { useState, useTransition } from 'react';
import { X, Trash2 } from 'lucide-react';
import { AccountType, APP_CONFIG } from '@/lib/constants';
import { AccountWithBalance, createAccount, updateAccount } from '@/lib/actions/accounts';
import { formatCurrency } from '@/lib/utils/currency';
import { CurrencyInput } from './CurrencyInput';
import { IconPicker } from './IconPicker';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account?: AccountWithBalance | null;
  groups?: { id: string; name: string; icon?: string | null }[];
  defaultGroupId?: string | null;
  onDelete?: (account: AccountWithBalance) => void;
}

export function AccountModal({
  isOpen,
  onClose,
  account,
  groups = [],
  defaultGroupId,
  onDelete,
}: AccountModalProps) {
  const isEditing = Boolean(account);

  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState<AccountType>(account?.type || 'checking');
  const [groupId, setGroupId] = useState<string | null>(
    account ? (account.groupId ?? null) : (defaultGroupId ?? null)
  );
  const [icon, setIcon] = useState<string | null>(account?.icon ?? null);
  const [excludeFromNetWorth, setExcludeFromNetWorth] = useState(
    Boolean(account?.excludeFromNetWorth)
  );
  const [startingBalanceCents, setStartingBalanceCents] = useState<number>(0);
  const [isDebt, setIsDebt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleTypeChange = (newType: AccountType) => {
    setType(newType);
    if (!isEditing && newType === 'credit') {
      setIsDebt(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide an account name.');
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing && account) {
          await updateAccount(account.id, {
            name: name.trim(),
            type,
            groupId,
            icon,
            excludeFromNetWorth,
          });
        } else {
          const finalCents = isDebt ? -startingBalanceCents : startingBalanceCents;
          await createAccount({
            name: name.trim(),
            type,
            groupId,
            icon,
            excludeFromNetWorth,
            startingBalanceCents: finalCents,
          });
        }
        onClose();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : `Failed to ${isEditing ? 'update' : 'create'} account.`
        );
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {isEditing ? 'Edit Account' : 'Add New Account'}
          </h2>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-50"
            title="Close"
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
          {/* Account Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Account Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Everyday Checking, Rainy Day Fund"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Account Type
            </label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as AccountType)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {APP_CONFIG.accountTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Account Group */}
          {groups.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Account Group
              </label>
              <select
                value={groupId || ''}
                onChange={(e) => setGroupId(e.target.value ? e.target.value : null)}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value="">None (Ungrouped)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Account Icon Picker */}
          <IconPicker value={icon} onChange={setIcon} accountType={type} />

          {/* Exclude from Net Worth Toggle */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/40">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludeFromNetWorth}
                onChange={(e) => setExcludeFromNetWorth(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
              />
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Exclude from Net Worth
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Transactions and balance will still be tracked in ledger, but excluded from total net worth and dashboard totals.
                </p>
              </div>
            </label>
          </div>

          {/* Balance Preview or Starting Balance */}
          {isEditing && account ? (
            <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-200/80 dark:bg-zinc-800/50 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">Current Balance</span>
                <span
                  className={`font-bold text-sm ${
                    account.balanceCents < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  {formatCurrency(account.balanceCents)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-600 dark:text-zinc-300">Total Transactions</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  {account.transactionCount} {account.transactionCount === 1 ? 'transaction' : 'transactions'}
                </span>
              </div>
              <p className="pt-1 text-[11px] text-zinc-400 dark:text-zinc-500 border-t border-zinc-200/50 dark:border-zinc-700/50">
                To adjust the balance, manage transactions directly in the account ledger.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Starting Balance ({APP_CONFIG.currency.code})
                </label>

                {/* Balance sign toggle */}
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsDebt(false)}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      !isDebt
                        ? 'bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-950 dark:text-emerald-300'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                    }`}
                  >
                    Positive (Asset)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDebt(true)}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      isDebt
                        ? 'bg-rose-100 text-rose-800 font-bold dark:bg-rose-950 dark:text-rose-300'
                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400'
                    }`}
                  >
                    Negative (Owed)
                  </button>
                </div>
              </div>

              <div className="mt-1">
                <CurrencyInput
                  valueCents={startingBalanceCents}
                  onChangeCents={setStartingBalanceCents}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Enter cents directly (e.g. 1-2-5-0 = $12.50).
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div
            className={`flex items-center pt-4 border-t border-zinc-100 dark:border-zinc-800 ${
              isEditing && onDelete ? 'justify-between' : 'justify-end'
            }`}
          >
            {isEditing && onDelete && account && (
              <button
                type="button"
                onClick={() => onDelete(account)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/50 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Account</span>
              </button>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isPending
                  ? isEditing
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditing
                  ? 'Save Changes'
                  : 'Create Account'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
