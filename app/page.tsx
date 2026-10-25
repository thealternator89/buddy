import { requireUser } from '@/lib/auth';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getAccountGroups } from '@/lib/actions/account-groups';
import { getTransactions } from '@/lib/actions/transactions';
import { getScheduledTransactions } from '@/lib/actions/scheduled-transactions';
import { getFlatCategories } from '@/lib/actions/categories';
import { getPayees } from '@/lib/actions/payees';
import { getActiveBudgetsWithStatus } from '@/lib/actions/budgets';
import { getOverviewBudgets } from '@/lib/utils/budget';
import { DashboardClientView } from '@/components/DashboardClientView';

export const metadata = {
  title: 'Overview | Buddy',
};

export default async function DashboardPage() {
  await requireUser();

  const [
    accounts,
    recentTransactions,
    scheduledTransactions,
    groups,
    categories,
    payees,
    budgets,
  ] = await Promise.all([
    getAccountsWithBalances(),
    getTransactions({ limit: 8 }),
    getScheduledTransactions(),
    getAccountGroups(),
    getFlatCategories(),
    getPayees(),
    getActiveBudgetsWithStatus(),
  ]);

  return (
    <DashboardClientView
      accounts={accounts}
      recentTransactions={recentTransactions}
      scheduledTransactions={scheduledTransactions}
      groups={groups}
      categories={categories}
      payees={payees}
      budgets={getOverviewBudgets(budgets)}
    />
  );
}
