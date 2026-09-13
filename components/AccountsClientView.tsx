'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AccountWithBalance, reorderAccounts } from '@/lib/actions/accounts';
import { AccountGroupWithStats, reorderAccountGroups } from '@/lib/actions/account-groups';
import { formatCurrency } from '@/lib/utils/currency';
import { AccountModal } from './AccountModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { AccountGroupModal } from './AccountGroupModal';
import { DeleteAccountGroupModal } from './DeleteAccountGroupModal';
import { AccountIcon } from './AccountIcon';
import { GroupIcon } from './GroupIcon';
import {
  PlusCircle,
  ArrowRight,
  Wallet,
  Pencil,
  Trash2,
  FolderPlus,
  Layers,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountsClientViewProps {
  accounts: AccountWithBalance[];
  groups?: AccountGroupWithStats[];
}

export function AccountsClientView({ accounts, groups = [] }: AccountsClientViewProps) {
  // Local state for optimistic reordering
  const [prevAccounts, setPrevAccounts] = useState(accounts);
  const [localAccounts, setLocalAccounts] = useState<AccountWithBalance[]>(accounts);
  if (prevAccounts !== accounts) {
    setPrevAccounts(accounts);
    setLocalAccounts(accounts);
  }

  const [prevGroups, setPrevGroups] = useState(groups);
  const [localGroups, setLocalGroups] = useState<AccountGroupWithStats[]>(groups);
  if (prevGroups !== groups) {
    setPrevGroups(groups);
    setLocalGroups(groups);
  }

  const [, startTransition] = useTransition();

  // Account Modals State
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountWithBalance | null>(null);

  // Group Modals State
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccountGroupWithStats | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<AccountGroupWithStats | null>(null);

  // Drag-and-Drop State
  const [dragType, setDragType] = useState<'group' | 'account' | null>(null);
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);
  const [dragOverAccountId, setDragOverAccountId] = useState<string | null>(null);

  // Map groups and ungrouped accounts from local state
  const knownGroupIds = new Set(localGroups.map((g) => g.id));
  const ungroupedAccounts = localAccounts.filter(
    (a) => !a.groupId || !knownGroupIds.has(a.groupId)
  );

  // --- Group Drag Handlers ---
  const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
    e.stopPropagation();
    setDragType('group');
    setDraggedGroupId(groupId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', id: groupId }));
  };

  const handleGroupDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragType === 'group' && draggedGroupId !== groupId) {
      setDragOverGroupId(groupId);
    } else if (dragType === 'account') {
      setDragOverGroupId(groupId);
    }
  };

  const handleGroupDragLeave = (e: React.DragEvent, groupId: string) => {
    e.stopPropagation();
    if (dragOverGroupId === groupId) {
      setDragOverGroupId(null);
    }
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragType === 'group' && draggedGroupId && draggedGroupId !== targetGroupId) {
      const fromIdx = localGroups.findIndex((g) => g.id === draggedGroupId);
      const toIdx = localGroups.findIndex((g) => g.id === targetGroupId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const reordered = [...localGroups];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);

        setLocalGroups(reordered);
        startTransition(async () => {
          try {
            await reorderAccountGroups(reordered.map((g) => g.id));
          } catch (err) {
            console.error('Failed to reorder groups:', err);
            setLocalGroups(groups);
          }
        });
      }
    } else if (dragType === 'account' && draggedAccountId) {
      // Account dropped onto group area (append to this group)
      handleDropAccountIntoGroup(draggedAccountId, targetGroupId);
    }

    setDragType(null);
    setDraggedGroupId(null);
    setDragOverGroupId(null);
    setDraggedAccountId(null);
    setDragOverAccountId(null);
  };

  // --- Account Drag Handlers ---
  const handleAccountDragStart = (e: React.DragEvent, accountId: string) => {
    e.stopPropagation();
    setDragType('account');
    setDraggedAccountId(accountId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'account', id: accountId }));
  };

  const handleAccountDragOver = (e: React.DragEvent, accountId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragType === 'account' && draggedAccountId !== accountId) {
      setDragOverAccountId(accountId);
    }
  };

  const handleAccountDragLeave = (e: React.DragEvent, accountId: string) => {
    e.stopPropagation();
    if (dragOverAccountId === accountId) {
      setDragOverAccountId(null);
    }
  };

  const handleAccountDrop = (
    e: React.DragEvent,
    targetAccountId: string,
    targetGroupId: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (dragType !== 'account' || !draggedAccountId || draggedAccountId === targetAccountId) {
      setDragType(null);
      setDraggedAccountId(null);
      setDragOverAccountId(null);
      setDragOverGroupId(null);
      return;
    }

    const dragged = localAccounts.find((a) => a.id === draggedAccountId);
    if (!dragged) return;

    const remaining = localAccounts.filter((a) => a.id !== draggedAccountId);
    const targetIdx = remaining.findIndex((a) => a.id === targetAccountId);
    if (targetIdx === -1) return;

    const updatedDragged: AccountWithBalance = {
      ...dragged,
      groupId: targetGroupId,
      groupName: targetGroupId ? localGroups.find((g) => g.id === targetGroupId)?.name || null : null,
      groupIcon: targetGroupId ? localGroups.find((g) => g.id === targetGroupId)?.icon || null : null,
    };

    const newAccounts = [...remaining];
    newAccounts.splice(targetIdx, 0, updatedDragged);

    // Compute new sortOrder per group partition
    const accountsByGroup = new Map<string | null, AccountWithBalance[]>();
    for (const acc of newAccounts) {
      const gId = acc.groupId || null;
      const list = accountsByGroup.get(gId) || [];
      list.push(acc);
      accountsByGroup.set(gId, list);
    }

    const updates: { id: string; sortOrder: number; groupId?: string | null }[] = [];
    accountsByGroup.forEach((accList, gId) => {
      accList.forEach((acc, idx) => {
        acc.sortOrder = idx + 1;
        updates.push({ id: acc.id, sortOrder: idx + 1, groupId: gId });
      });
    });

    setLocalAccounts(newAccounts);
    setDragType(null);
    setDraggedAccountId(null);
    setDragOverAccountId(null);
    setDragOverGroupId(null);

    startTransition(async () => {
      try {
        await reorderAccounts(updates);
      } catch (err) {
        console.error('Failed to reorder accounts:', err);
        setLocalAccounts(accounts);
      }
    });
  };

  const handleDropAccountIntoGroup = (accountId: string, targetGroupId: string | null) => {
    const dragged = localAccounts.find((a) => a.id === accountId);
    if (!dragged) return;

    // If it's already in target group, no need to append
    if ((dragged.groupId || null) === targetGroupId) return;

    const remaining = localAccounts.filter((a) => a.id !== accountId);
    const updatedDragged: AccountWithBalance = {
      ...dragged,
      groupId: targetGroupId,
      groupName: targetGroupId ? localGroups.find((g) => g.id === targetGroupId)?.name || null : null,
      groupIcon: targetGroupId ? localGroups.find((g) => g.id === targetGroupId)?.icon || null : null,
    };

    const newAccounts = [...remaining, updatedDragged];

    const accountsByGroup = new Map<string | null, AccountWithBalance[]>();
    for (const acc of newAccounts) {
      const gId = acc.groupId || null;
      const list = accountsByGroup.get(gId) || [];
      list.push(acc);
      accountsByGroup.set(gId, list);
    }

    const updates: { id: string; sortOrder: number; groupId?: string | null }[] = [];
    accountsByGroup.forEach((accList, gId) => {
      accList.forEach((acc, idx) => {
        acc.sortOrder = idx + 1;
        updates.push({ id: acc.id, sortOrder: idx + 1, groupId: gId });
      });
    });

    setLocalAccounts(newAccounts);

    startTransition(async () => {
      try {
        await reorderAccounts(updates);
      } catch (err) {
        console.error('Failed to move account to group:', err);
        setLocalAccounts(accounts);
      }
    });
  };

  const handleDragEnd = () => {
    setDragType(null);
    setDraggedGroupId(null);
    setDragOverGroupId(null);
    setDraggedAccountId(null);
    setDragOverAccountId(null);
  };

  const renderAccountCard = (account: AccountWithBalance) => {
    const isOver = dragOverAccountId === account.id && dragType === 'account';
    const isDragging = draggedAccountId === account.id;

    return (
      <div
        key={account.id}
        onDragOver={(e) => handleAccountDragOver(e, account.id)}
        onDragLeave={(e) => handleAccountDragLeave(e, account.id)}
        onDrop={(e) => handleAccountDrop(e, account.id, account.groupId || null)}
        className={cn(
          'relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all dark:bg-zinc-900',
          isOver
            ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.01]'
            : 'border-zinc-200 hover:shadow-md dark:border-zinc-800',
          isDragging && 'opacity-40 border-dashed border-zinc-400'
        )}
      >
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Account Drag Handle */}
              <div
                draggable
                onDragStart={(e) => handleAccountDragStart(e, account.id)}
                onDragEnd={handleDragEnd}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-zinc-300 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Drag to reorder account"
              >
                <GripVertical className="h-4 w-4" />
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                <AccountIcon icon={account.icon} type={account.type} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{account.name}</h3>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                    {account.type}
                  </span>
                  {account.excludeFromNetWorth && (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      Excluded from Net Worth
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                type="button"
                onClick={() => setEditingAccount(account)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                title="Edit account"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit {account.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setDeletingAccount(account)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors"
                title="Delete account"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete {account.name}</span>
              </button>
            </div>
          </div>

          <div className="mt-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Current Balance
            </span>
            <div
              className={`mt-1 text-2xl font-extrabold ${
                account.balanceCents < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {formatCurrency(account.balanceCents)}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            {account.transactionCount}{' '}
            {account.transactionCount === 1 ? 'transaction' : 'transactions'}
          </span>

          <Link
            href={`/transactions?account=${account.id}`}
            className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            View Ledger <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Accounts
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your bank accounts, credit cards, and cash wallets. Drag and drop to reorder groups or accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsAddGroupModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 transition-colors"
          >
            <FolderPlus className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span>New Group</span>
          </button>
          <button
            onClick={() => setIsAddAccountModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* Empty State when no accounts exist */}
      {localAccounts.length === 0 && localGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Wallet className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            No accounts yet
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Get started by adding your first bank account, credit card, or cash wallet.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsAddGroupModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              <FolderPlus className="h-4 w-4 text-zinc-500" />
              <span>Create Group</span>
            </button>
            <button
              onClick={() => setIsAddAccountModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Account</span>
            </button>
          </div>
        </div>
      ) : localGroups.length > 0 ? (
        /* Grouped View with Drag & Drop */
        <div className="space-y-8">
          {localGroups.map((group) => {
            const groupAccounts = localAccounts.filter((a) => a.groupId === group.id);
            const isGroupDragOver = dragOverGroupId === group.id;
            const isGroupDragging = draggedGroupId === group.id;

            return (
              <section
                key={group.id}
                onDragOver={(e) => handleGroupDragOver(e, group.id)}
                onDragLeave={(e) => handleGroupDragLeave(e, group.id)}
                onDrop={(e) => handleGroupDrop(e, group.id)}
                className={cn(
                  'space-y-4 rounded-2xl p-3 -m-3 transition-all duration-150',
                  isGroupDragOver && dragType === 'group' && 'ring-2 ring-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20',
                  isGroupDragOver && dragType === 'account' && 'ring-2 ring-emerald-500/80 bg-emerald-50/15 dark:bg-emerald-950/15',
                  isGroupDragging && 'opacity-40'
                )}
              >
                {/* Group Header */}
                <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Group Drag Handle */}
                    <div
                      draggable
                      onDragStart={(e) => handleGroupDragStart(e, group.id)}
                      onDragEnd={handleDragEnd}
                      className="cursor-grab active:cursor-grabbing p-1.5 -ml-1 text-zinc-300 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      title="Drag to reorder group"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      <GroupIcon icon={group.icon} className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                          {group.name}
                        </h2>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {groupAccounts.length} {groupAccounts.length === 1 ? 'account' : 'accounts'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingGroup(group)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                      title="Edit group"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit group {group.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingGroup(group)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors"
                      title="Delete group"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete group {group.name}</span>
                    </button>
                  </div>
                </div>

                {/* Group Accounts Grid or Empty Placeholder */}
                {groupAccounts.length === 0 ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverGroupId(group.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragType === 'account' && draggedAccountId) {
                        handleDropAccountIntoGroup(draggedAccountId, group.id);
                        handleDragEnd();
                      }
                    }}
                    className={cn(
                      'rounded-xl border border-dashed p-6 text-center transition-colors',
                      isGroupDragOver && dragType === 'account'
                        ? 'border-emerald-500 bg-emerald-50/30 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : 'border-zinc-200 bg-zinc-50/50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400'
                    )}
                  >
                    <p className="text-xs">
                      {isGroupDragOver && dragType === 'account'
                        ? 'Drop account here to add to this group'
                        : 'No accounts in this group yet. Drag an account here or edit an account to assign it.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {groupAccounts.map((account) => renderAccountCard(account))}
                  </div>
                )}
              </section>
            );
          })}

          {/* Ungrouped Accounts Section */}
          {ungroupedAccounts.length > 0 && (
            <section
              onDragOver={(e) => {
                e.preventDefault();
                if (dragType === 'account') {
                  setDragOverGroupId('ungrouped');
                }
              }}
              onDragLeave={() => {
                if (dragOverGroupId === 'ungrouped') {
                  setDragOverGroupId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragType === 'account' && draggedAccountId) {
                  handleDropAccountIntoGroup(draggedAccountId, null);
                  handleDragEnd();
                }
              }}
              className={cn(
                'space-y-4 rounded-2xl p-3 -m-3 transition-all duration-150',
                dragOverGroupId === 'ungrouped' && dragType === 'account' && 'ring-2 ring-emerald-500/80 bg-emerald-50/15 dark:bg-emerald-950/15'
              )}
            >
              <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3 dark:border-zinc-800/80">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      Ungrouped Accounts
                    </h2>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {ungroupedAccounts.length} {ungroupedAccounts.length === 1 ? 'account' : 'accounts'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ungroupedAccounts.map((account) => renderAccountCard(account))}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* Flat Grid View when no groups exist yet */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {localAccounts.map((account) => renderAccountCard(account))}
        </div>
      )}

      {/* Add Account Modal */}
      {isAddAccountModalOpen && (
        <AccountModal
          isOpen={isAddAccountModalOpen}
          groups={localGroups}
          onClose={() => setIsAddAccountModalOpen(false)}
        />
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <AccountModal
          key={editingAccount.id}
          isOpen={Boolean(editingAccount)}
          account={editingAccount}
          groups={localGroups}
          onClose={() => setEditingAccount(null)}
          onDelete={(acc) => {
            setEditingAccount(null);
            setDeletingAccount(acc);
          }}
        />
      )}

      {/* Delete Account Modal */}
      {deletingAccount && (
        <DeleteAccountModal
          isOpen={Boolean(deletingAccount)}
          account={deletingAccount}
          onClose={() => setDeletingAccount(null)}
        />
      )}

      {/* Add Account Group Modal */}
      {isAddGroupModalOpen && (
        <AccountGroupModal
          isOpen={isAddGroupModalOpen}
          accounts={localAccounts}
          onClose={() => setIsAddGroupModalOpen(false)}
        />
      )}

      {/* Edit Account Group Modal */}
      {editingGroup && (
        <AccountGroupModal
          key={editingGroup.id}
          isOpen={Boolean(editingGroup)}
          group={editingGroup}
          accounts={localAccounts}
          onClose={() => setEditingGroup(null)}
          onDelete={(grp) => {
            setEditingGroup(null);
            setDeletingGroup(grp);
          }}
        />
      )}

      {/* Delete Account Group Modal */}
      {deletingGroup && (
        <DeleteAccountGroupModal
          isOpen={Boolean(deletingGroup)}
          group={deletingGroup}
          onClose={() => setDeletingGroup(null)}
        />
      )}
    </div>
  );
}
