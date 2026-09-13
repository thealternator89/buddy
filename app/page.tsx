import Link from 'next/link';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getAccountGroups } from '@/lib/actions/account-groups';
import { getTransactions } from '@/lib/actions/transactions';
import { formatCurrency } from '@/lib/utils/currency';
import { APP_CONFIG } from '@/lib/constants';
import { AccountIcon } from '@/components/AccountIcon';
import { GroupIcon } from '@/components/GroupIcon';
import {
  TrendingUp,
  CreditCard,
  PiggyBank,
  Wallet,
  ArrowRight,
  ArrowLeftRight,
  Layers,
} from 'lucide-react';

export default async function DashboardPage() {
  const [accounts, recentTransactions, groups] = await Promise.all([
    getAccountsWithBalances(),
    getTransactions({ limit: 8 }),
    getAccountGroups(),
  ]);

  // Aggregate metrics (excluding accounts flagged with excludeFromNetWorth)
  const includedAccounts = accounts.filter((a) => !a.excludeFromNetWorth);
  const netWorthCents = includedAccounts.reduce((sum, acc) => sum + acc.balanceCents, 0);
  const liquidCashCents = includedAccounts
    .filter((a) => a.type === 'checking' || a.type === 'cash')
    .reduce((sum, acc) => sum + acc.balanceCents, 0);
  const savingsCents = includedAccounts
    .filter((a) => a.type === 'savings' || a.type === 'other')
    .reduce((sum, acc) => sum + acc.balanceCents, 0);
  const creditDebtCents = includedAccounts
    .filter((a) => a.type === 'credit')
    .reduce((sum, acc) => sum + acc.balanceCents, 0);

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

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Net Worth
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {formatCurrency(netWorthCents)}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Across {includedAccounts.length} {includedAccounts.length === 1 ? 'account' : 'accounts'}
            {accounts.length > includedAccounts.length && (
              <span> ({accounts.length - includedAccounts.length} excluded)</span>
            )}
          </p>
        </div>

        {/* Liquid Cash */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Liquid Cash
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {formatCurrency(liquidCashCents)}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Checking & Cash on hand</p>
        </div>

        {/* Savings */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Savings
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {formatCurrency(savingsCents)}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Long-term & Emergency</p>
        </div>

        {/* Credit Card Balance */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Credit Card Balance
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {formatCurrency(creditDebtCents)}
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Outstanding liabilities</p>
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
            <div className="space-y-5">
              {activeGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 min-w-0">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                      <GroupIcon icon={group.icon} className="h-3 w-3" />
                    </div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {group.name}
                    </span>
                    <span className="text-zinc-400 shrink-0">({group.accounts.length})</span>
                  </div>

                  <div className="space-y-2.5">
                    {group.accounts.map((acc) => (
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
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="capitalize">{acc.type}</span>
                              <span>•</span>
                              <span>{acc.transactionCount} txns</span>
                              {acc.excludeFromNetWorth && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">Excluded</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`text-sm font-bold pl-2 shrink-0 ${
                            acc.balanceCents < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {formatCurrency(acc.balanceCents)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {ungroupedAccounts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 min-w-0">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      <Layers className="h-3 w-3" />
                    </div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      Ungrouped
                    </span>
                    <span className="text-zinc-400 shrink-0">({ungroupedAccounts.length})</span>
                  </div>

                  <div className="space-y-2.5">
                    {ungroupedAccounts.map((acc) => (
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
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                              <span className="capitalize">{acc.type}</span>
                              <span>•</span>
                              <span>{acc.transactionCount} txns</span>
                              {acc.excludeFromNetWorth && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">Excluded</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`text-sm font-bold pl-2 shrink-0 ${
                            acc.balanceCents < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {formatCurrency(acc.balanceCents)}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((acc) => (
                <Link
                  key={acc.id}
                  href={`/transactions?account=${acc.id}`}
                  className="group flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-white shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                      <AccountIcon icon={acc.icon} type={acc.type} className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-semibold text-sm text-zinc-900 group-hover:text-emerald-600 transition-colors truncate dark:text-zinc-100 dark:group-hover:text-emerald-400">
                        {acc.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="capitalize">{acc.type}</span>
                        <span>•</span>
                        <span>{acc.transactionCount} txns</span>
                        {acc.excludeFromNetWorth && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Excluded</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold pl-2 shrink-0 ${
                      acc.balanceCents < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    {formatCurrency(acc.balanceCents)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Recent Transactions</h2>
            <Link
              href="/transactions"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {recentTransactions.length === 0 ? (
                <div className="p-8 text-center text-zinc-400">No transactions recorded yet.</div>
              ) : (
                recentTransactions.map((tx) => {
                  const isTransfer = Boolean(tx.transferId);
                  const isIncome = tx.amountCents > 0;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 hover:bg-zinc-50/75 transition-colors dark:hover:bg-zinc-800/40"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                            isTransfer
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                              : isIncome
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {isTransfer ? (
                            <ArrowLeftRight className="h-4 w-4" />
                          ) : isIncome ? (
                            '+'
                          ) : (
                            '-'
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-zinc-900 truncate dark:text-zinc-100">
                            {isTransfer
                              ? `Transfer: ${tx.transferAccountName || 'Account'}`
                              : tx.payeeName || 'Unassigned Payee'}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>{tx.date}</span>
                            <span>•</span>
                            <span className="truncate">{tx.accountName}</span>
                            {tx.categoryName && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                  {tx.parentCategoryName ? `${tx.parentCategoryName} › ` : ''}
                                  {tx.categoryName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap pl-4">
                        <div
                          className={`text-sm font-bold ${
                            isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isTransfer
                              ? 'text-zinc-700 dark:text-zinc-300'
                              : 'text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          {formatCurrency(tx.amountCents, { showSign: isIncome })}
                        </div>
                        {tx.isCleared && (
                          <div className="text-[10px] text-zinc-400">Cleared</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
