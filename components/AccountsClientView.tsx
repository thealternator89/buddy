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
  const [selectedGroupIdForNewAccount, setSelectedGroupIdForNewAccount] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountWithBalance | null>(null);

  const handleOpenAddAccount = (groupId: string | null = null) => {
    setSelectedGroupIdForNewAccount(groupId);
    setIsAddAccountModalOpen(true);
  };

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
      groupSortOrder: targetGroupId ? localGroups.find((g) => g.id === targetGroupId)?.sortOrder ?? null : null,
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
      groupSortOrder: targetGroupId ? localGroups.find((g) => g.id === targetGroupId)?.sortOrder ?? null : null,
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

    const hasCreditLimit =
      account.creditLimitCents !== null &&
      account.creditLimitCents !== undefined &&
      account.creditLimitCents > 0;
    const showAvailable = hasCreditLimit && account.balanceDisplayMode === 'available';
    const availableBalanceCents = hasCreditLimit
      ? (account.availableBalanceCents ?? account.creditLimitCents! + account.balanceCents)
      : account.balanceCents;
    const primaryAmount = showAvailable ? availableBalanceCents : account.balanceCents;
    const primaryLabel = showAvailable ? 'Available' : 'Current';

    return (
      <div
        key={account.id}
        onDragOver={(e) => handleAccountDragOver(e, account.id)}
        onDragLeave={(e) => handleAccountDragLeave(e, account.id)}
        onDrop={(e) => handleAccountDrop(e, account.id, account.groupId || null)}
        className={cn(
          'group relative flex flex-col justify-between rounded-xl border bg-white p-3.5 sm:p-4 shadow-2xs transition-all dark:bg-zinc-900',
          isOver
            ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-[1.01]'
            : 'border-zinc-200 hover:border-zinc-300 hover:shadow-xs dark:border-zinc-800 dark:hover:border-zinc-700',
          isDragging && 'opacity-40 border-dashed border-zinc-400'
        )}
      >
        <div>
          {/* Header Row: Grip, Icon, Title & Meta, Actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Account Drag Handle */}
              <div
                draggable
                onDragStart={(e) => handleAccountDragStart(e, account.id)}
                onDragEnd={handleDragEnd}
                className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-zinc-300 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                title="Drag to reorder account"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <AccountIcon icon={account.icon} type={account.type} className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate" title={account.name}>
                  {account.name}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex-wrap">
                  <span className="capitalize">{account.type}</span>
                  <span>•</span>
                  <span>
                    {account.transactionCount} {account.transactionCount === 1 ? 'txn' : 'txns'}
                  </span>
                  {account.excludeFromNetWorth && (
                    <>
                      <span>•</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">Excluded</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-0.5">
              <button
                type="button"
                onClick={() => setEditingAccount(account)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                title="Edit account"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="sr-only">Edit {account.name}</span>
              </button>
            </div>
          </div>

          {/* Balance & Ledger Row */}
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span
                className={cn(
                  'text-lg sm:text-xl font-bold tracking-tight truncate',
                  primaryAmount < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-zinc-900 dark:text-zinc-100'
                )}
              >
                {formatCurrency(primaryAmount)}
              </span>
              {hasCreditLimit && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0">
                  {primaryLabel}
                </span>
              )}
            </div>

            <Link
              href={`/transactions?account=${account.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 shrink-0 group/link"
            >
              <span>View Ledger</span>
              <ArrowRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Credit details if applicable */}
        {hasCreditLimit && (
          <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1">
            {account.creditLimitCents! > 0 && (
              <div className="w-full bg-zinc-100 rounded-full h-1.5 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    account.balanceCents < 0
                      ? Math.abs(account.balanceCents) / account.creditLimitCents! > 0.8
                        ? 'bg-rose-500'
                        : Math.abs(account.balanceCents) / account.creditLimitCents! > 0.5
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                      : 'bg-emerald-500'
                  )}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        account.balanceCents < 0
                          ? Math.round(
                              (Math.abs(account.balanceCents) / account.creditLimitCents!) * 100
                            )
                          : 0
                      )
                    )}%`,
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="truncate">
                {showAvailable ? (
                  <>
                    Actual:{' '}
                    <strong
                      className={
                        account.balanceCents < 0
                          ? 'text-rose-600 dark:text-rose-400 font-medium'
                          : 'text-zinc-700 dark:text-zinc-300 font-medium'
                      }
                    >
                      {formatCurrency(account.balanceCents)}
                    </strong>
                  </>
                ) : (
                  <>
                    Avail:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {formatCurrency(availableBalanceCents)}
                    </strong>
                  </>
                )}
              </span>
              <span className="shrink-0 text-zinc-400">Limit: {formatCurrency(account.creditLimitCents!)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            Accounts
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            onClick={() => setIsAddGroupModalOpen(true)}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 transition-colors"
            title="Create new group"
          >
            <FolderPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <span className="sm:hidden">Group</span>
            <span className="hidden sm:inline">New Group</span>
          </button>
          <button
            onClick={() => handleOpenAddAccount(null)}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-emerald-600 px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors shrink-0"
            title="Create new account"
          >
            <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Account</span>
            <span className="hidden sm:inline">New Account</span>
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
              onClick={() => handleOpenAddAccount(null)}
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
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {group.name}
                      </h2>
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
                        : 'border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300'
                    )}
                  >
                    <p className="text-xs">
                      {isGroupDragOver && dragType === 'account'
                        ? 'Drop account here to add to this group'
                        : 'No accounts in this group yet. Drag an account here or edit an account to assign it.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
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
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      Ungrouped Accounts
                    </h2>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {ungroupedAccounts.map((account) => renderAccountCard(account))}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* Flat Grid View when no groups exist yet */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {localAccounts.map((account) => renderAccountCard(account))}
        </div>
      )}

      {/* Add Account Modal */}
      {isAddAccountModalOpen && (
        <AccountModal
          key={selectedGroupIdForNewAccount ?? 'new'}
          isOpen={isAddAccountModalOpen}
          groups={localGroups}
          defaultGroupId={selectedGroupIdForNewAccount}
          onClose={() => {
            setIsAddAccountModalOpen(false);
            setSelectedGroupIdForNewAccount(null);
          }}
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
