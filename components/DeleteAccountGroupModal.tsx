'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AccountGroupWithStats, deleteAccountGroup } from '@/lib/actions/account-groups';

interface DeleteAccountGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: AccountGroupWithStats;
}

export function DeleteAccountGroupModal({
  isOpen,
  onClose,
  group,
}: DeleteAccountGroupModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAccountGroup(group.id);
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete account group.');
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
            Delete Account Group
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Are you sure you want to delete <strong className="font-semibold text-zinc-900 dark:text-zinc-200">{group.name}</strong>?
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
          <p className="font-medium text-zinc-900 dark:text-zinc-200">Accounts remain safe</p>
          <p className="mt-1">
            {group.accountCount > 0 ? (
              <>
                The <span className="font-semibold text-zinc-900 dark:text-zinc-200">{group.accountCount}</span> {group.accountCount === 1 ? 'account' : 'accounts'} in this group will not be deleted. They will simply become ungrouped.
              </>
            ) : (
              'No accounts are currently in this group.'
            )}
          </p>
        </div>

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
            {isPending ? 'Deleting...' : 'Delete Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
