'use client';

import { useState, useTransition } from 'react';
import { X, Trash2, Check } from 'lucide-react';
import { AccountGroupWithStats, createAccountGroup, updateAccountGroup } from '@/lib/actions/account-groups';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { IconPicker } from './IconPicker';
import { AccountIcon } from './AccountIcon';

interface AccountGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group?: AccountGroupWithStats | null;
  accounts?: AccountWithBalance[];
  onDelete?: (group: AccountGroupWithStats) => void;
}

export function AccountGroupModal({
  isOpen,
  onClose,
  group,
  accounts = [],
  onDelete,
}: AccountGroupModalProps) {
  const isEditing = Boolean(group);

  const [name, setName] = useState(group?.name || '');
  const [icon, setIcon] = useState<string | null>(group?.icon ?? null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => {
    if (group) {
      return accounts.filter((a) => a.groupId === group.id).map((a) => a.id);
    }
    return [];
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a group name.');
      return;
    }

    startTransition(async () => {
      try {
        if (isEditing && group) {
          await updateAccountGroup(group.id, {
            name: name.trim(),
            icon,
            accountIds: selectedAccountIds,
          });
        } else {
          await createAccountGroup({
            name: name.trim(),
            icon,
            accountIds: selectedAccountIds,
          });
        }
        onClose();
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : `Failed to ${isEditing ? 'update' : 'create'} account group.`
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
            {isEditing ? 'Edit Account Group' : 'Add New Account Group'}
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
          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Group Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Everyday Banking, Savings, Cards"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>

          {/* Group Icon Picker */}
          <IconPicker value={icon} onChange={setIcon} />

          {/* Accounts Checklist */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Include Accounts
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50/50 p-2 dark:border-zinc-800 dark:bg-zinc-800/30">
                {accounts.map((acc) => {
                  const isChecked = selectedAccountIds.includes(acc.id);
                  const isAssignedToOther =
                    acc.groupId && (!group || acc.groupId !== group.id);

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => toggleAccount(acc.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors text-xs ${
                        isChecked
                          ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700">
                          <AccountIcon icon={acc.icon} type={acc.type} className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{acc.name}</div>
                          {isAssignedToOther && (
                            <div className="text-[10px] text-zinc-400">
                              Currently in: {acc.groupName || 'Another group'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isChecked
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            className={`flex items-center pt-4 border-t border-zinc-100 dark:border-zinc-800 ${
              isEditing && onDelete ? 'justify-between' : 'justify-end'
            }`}
          >
            {isEditing && onDelete && group && (
              <button
                type="button"
                onClick={() => onDelete(group)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/50 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Group</span>
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
                  : 'Create Group'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
