'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Layers,
  ArrowLeftRight,
  CreditCard,
} from 'lucide-react';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { AccountGroupWithStats } from '@/lib/actions/account-groups';
import { TransactionWithDetails } from '@/lib/actions/transactions';
import { ScheduledTransactionWithDetails } from '@/lib/actions/scheduled-transactions';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';
import { formatCurrency } from '@/lib/utils/currency';
import { getLocalTodayIso, getScheduledDueStatus } from '@/lib/utils/scheduled';
import { APP_CONFIG } from '@/lib/constants';
import { AccountIcon } from '@/components/AccountIcon';
import { GroupIcon } from '@/components/GroupIcon';
import { RecentTransactionsList } from '@/components/RecentTransactionsList';
import { DueScheduledCarousel } from '@/components/DueScheduledCarousel';
import { AddTransactionButton } from '@/components/AddTransactionButton';
import { cn } from '@/lib/utils';

interface DashboardClientViewProps {
  accounts: AccountWithBalance[];
  recentTransactions: TransactionWithDetails[];
  scheduledTransactions: ScheduledTransactionWithDetails[];
  groups: AccountGroupWithStats[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees: PayeeWithRules[];
}

export function DashboardClientView({
  accounts,
  recentTransactions,
  scheduledTransactions,
  groups,
  categories,
  payees,
}: DashboardClientViewProps) {
  // Mobile tab state: 'activity' (default) vs 'accounts'
  const [activeMobileTab, setActiveMobileTab] = useState<'activity' | 'accounts'>('activity');

  // Count due scheduled transactions for a badge on mobile tab
  const dueCount = useMemo(() => {
    const todayStr = getLocalTodayIso();
    return scheduledTransactions.filter(
      (item) => getScheduledDueStatus(item.nextDueDate, todayStr).isDue
    ).length;
  }, [scheduledTransactions]);

  // Group accounts for overview display
  const knownGroupIds = new Set(groups.map((g) => g.id));
  const ungroupedAccounts = accounts.filter(
    (a) => !a.groupId || !knownGroupIds.has(a.groupId)
  );
  const activeGroups = groups
    .map((group) => {
      const groupAccounts = accounts.filter((a) => a.groupId === group.id);
      return {
        ...group,
        accounts: groupAccounts,
      };
    })
    .filter((g) => g.accounts.length > 0);

  const renderDashboardAccountItem = (acc: AccountWithBalance) => {
    const hasCreditLimit =
      acc.creditLimitCents !== null &&
      acc.creditLimitCents !== undefined &&
      acc.creditLimitCents > 0;
    const showAvailable = hasCreditLimit && acc.balanceDisplayMode === 'available';
    const availableBalanceCents = hasCreditLimit
      ? (acc.availableBalanceCents ?? acc.creditLimitCents! + acc.balanceCents)
      : acc.balanceCents;
    const displayAmount = showAvailable ? availableBalanceCents : acc.balanceCents;

    return (
      <Link
        key={acc.id}
        href={`/transactions?account=${acc.id}`}
        className="group flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-white shadow-xs hover:border-emerald-500/50 hover:shadow-md active:bg-zinc-50 transition-all dark:border-zinc-800 dark:bg-zinc-900 dark:active:bg-zinc-800"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <AccountIcon icon={acc.icon} type={acc.type} className="h-4 w-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="font-semibold text-sm text-zinc-900 group-hover:text-emerald-600 transition-colors truncate dark:text-zinc-100 dark:group-hover:text-emerald-400">
              {acc.name}
            </div>
            {(hasCreditLimit || acc.excludeFromNetWorth) && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                {hasCreditLimit && (
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    Limit: {formatCurrency(acc.creditLimitCents!)}
                  </span>
                )}
                {hasCreditLimit && acc.excludeFromNetWorth && <span>•</span>}
                {acc.excludeFromNetWorth && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">Excluded</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="text-right pl-2 shrink-0">
          <div
            className={`text-sm font-bold tabular-nums ${
              displayAmount < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-zinc-900 dark:text-zinc-100'
            }`}
          >
            {formatCurrency(displayAmount)}
          </div>
          {hasCreditLimit && (
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {showAvailable
                ? `Actual: ${formatCurrency(acc.balanceCents)}`
                : `Avail: ${formatCurrency(availableBalanceCents)}`}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Banner / Summary */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            Financial Overview
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 sm:mt-1">
            Tracking in{' '}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {APP_CONFIG.currency.code} ({APP_CONFIG.currency.symbol})
            </span>
          </p>
        </div>

        <div className="shrink-0">
          <AddTransactionButton
            accounts={accounts}
            categories={categories}
            payees={payees}
          />
        </div>
      </div>

      {/* Mobile Segmented Switcher (Visible only on mobile < lg) */}
      <div className="lg:hidden">
        <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveMobileTab('activity')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all relative',
              activeMobileTab === 'activity'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Recent Activity</span>
            {dueCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white leading-none">
                {dueCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMobileTab('accounts')}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
              activeMobileTab === 'accounts'
                ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>Accounts ({accounts.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Accounts Summary Column: Always visible on desktop; on mobile shown only when activeMobileTab === 'accounts' */}
        <div
          className={cn(
            'space-y-4',
            activeMobileTab !== 'accounts' && 'hidden lg:block'
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Your Accounts</h2>
            <Link
              href="/accounts"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
            >
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {accounts.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
              No accounts added yet.
            </div>
          ) : activeGroups.length > 0 ? (
            <div className="space-y-6">
              {activeGroups.map((group) => (
                <div key={group.id} className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 min-w-0">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      <GroupIcon icon={group.icon} className="h-3 w-3" />
                    </div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {group.name}
                    </span>
                    <span className="text-zinc-400 shrink-0">({group.accounts.length})</span>
                  </div>

                  <div className="space-y-3">
                    {group.accounts.map((acc) => renderDashboardAccountItem(acc))}
                  </div>
                </div>
              ))}

              {ungroupedAccounts.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 px-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 min-w-0">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      <Layers className="h-3 w-3" />
                    </div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      Ungrouped
                    </span>
                    <span className="text-zinc-400 shrink-0">({ungroupedAccounts.length})</span>
                  </div>

                  <div className="space-y-3">
                    {ungroupedAccounts.map((acc) => renderDashboardAccountItem(acc))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => renderDashboardAccountItem(acc))}
            </div>
          )}
        </div>

        {/* Due Scheduled & Recent Transactions Column: Always visible on desktop; on mobile shown only when activeMobileTab === 'activity' */}
        <div
          className={cn(
            'lg:col-span-2 space-y-6',
            activeMobileTab !== 'activity' && 'hidden lg:block'
          )}
        >
          <DueScheduledCarousel
            scheduledTransactions={scheduledTransactions}
            accounts={accounts}
            categories={categories}
            payees={payees}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Recent Transactions
              </h2>
              <Link
                href="/transactions"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
              >
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <RecentTransactionsList
              transactions={recentTransactions}
              accounts={accounts}
              categories={categories}
              payees={payees}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
