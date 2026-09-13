'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AccountWithBalance, deleteAccount } from '@/lib/actions/accounts';
import { formatCurrency } from '@/lib/utils/currency';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountWithBalance;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  account,
}: DeleteAccountModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccount(account.id);
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete account.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 disabled:opacity-50"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Delete Account
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete <strong className="font-semibold text-zinc-900 dark:text-zinc-200">{account.name}</strong>?
          </p>
        </div>

        {account.transactionCount > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            <p className="font-semibold">Warning: Destructive Action</p>
            <p className="mt-1">
              This account has <span className="font-bold">{account.transactionCount}</span> {account.transactionCount === 1 ? 'transaction' : 'transactions'} with a balance of <span className="font-bold">{formatCurrency(account.balanceCents)}</span>.
            </p>
            <p className="mt-1">
              Deleting this account will permanently remove it and all associated transactions. Any inter-account transfers will be unlinked.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            This account currently has no transactions and will be permanently removed.
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
