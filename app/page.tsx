import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getAccountsWithBalances, AccountWithBalance } from '@/lib/actions/accounts';
import { getAccountGroups } from '@/lib/actions/account-groups';
import { getTransactions } from '@/lib/actions/transactions';
import { getScheduledTransactions } from '@/lib/actions/scheduled-transactions';
import { getFlatCategories } from '@/lib/actions/categories';
import { getPayees } from '@/lib/actions/payees';
import { formatCurrency } from '@/lib/utils/currency';
import { APP_CONFIG } from '@/lib/constants';
import { AccountIcon } from '@/components/AccountIcon';
import { GroupIcon } from '@/components/GroupIcon';
import { RecentTransactionsList } from '@/components/RecentTransactionsList';
import { DueScheduledCarousel } from '@/components/DueScheduledCarousel';
import {
  ArrowRight,
  Layers,
} from 'lucide-react';

export default async function DashboardPage() {
  await requireUser();

  const [accounts, recentTransactions, scheduledTransactions, groups, categories, payees] =
    await Promise.all([
      getAccountsWithBalances(),
      getTransactions({ limit: 8 }),
      getScheduledTransactions(),
      getAccountGroups(),
      getFlatCategories(),
      getPayees(),
    ]);

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
        className="group flex items-center justify-between p-3.5 rounded-xl border border-zinc-200 bg-white shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-900"
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
            className={`text-sm font-bold ${
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
    <div className="space-y-8">
      {/* Top Banner / Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Financial Overview
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Tracking in <span className="font-semibold text-zinc-700 dark:text-zinc-300">{APP_CONFIG.currency.code} ({APP_CONFIG.currency.symbol})</span>
          </p>
        </div>
      </div>

      {/* Main Grid: Accounts List & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Accounts Summary Column */}
        <div className="space-y-4">
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

        {/* Due Scheduled & Recent Transactions Column */}
        <div className="lg:col-span-2 space-y-6">
          <DueScheduledCarousel
            scheduledTransactions={scheduledTransactions}
            accounts={accounts}
            categories={categories}
            payees={payees}
          />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Recent Transactions</h2>
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
