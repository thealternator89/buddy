'use client';

import { useState, useTransition } from 'react';
import { X, Building2 } from 'lucide-react';
import { CategoryGroupWithChildren } from '@/lib/actions/categories';
import { PayeeWithStats, createPayee, updatePayee } from '@/lib/actions/payees';

interface PayeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryGroups: CategoryGroupWithChildren[];
  payee?: PayeeWithStats | null;
}

export function PayeeModal({ isOpen, onClose, categoryGroups, payee }: PayeeModalProps) {
  const isEditing = Boolean(payee);
  const [name, setName] = useState(payee?.name || '');
  const [defaultCategoryId, setDefaultCategoryId] = useState(payee?.defaultCategoryId || '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a payee name.');
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing && payee) {
          await updatePayee(payee.id, {
            name: name.trim(),
            defaultCategoryId: defaultCategoryId || null,
          });
        } else {
          await createPayee(name.trim(), defaultCategoryId || null);
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save payee.');
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
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isEditing ? 'Edit Payee' : 'New Payee'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isEditing ? 'Update payee details and default category.' : 'Add a merchant or organization.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Payee Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Woolworths, Netflix, Electricity Corp"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Default Category (Optional)
            </label>
            <select
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="">None (Unassigned)</option>
              {categoryGroups.map((group) => (
                <optgroup key={group.id} label={group.name}>
                  {group.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Transactions recorded for this payee will automatically suggest this category.
            </p>
          </div>

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
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Payee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
