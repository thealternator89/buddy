import { requireUser } from '@/lib/auth';
import { getScheduledTransactions } from '@/lib/actions/scheduled-transactions';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getFlatCategories } from '@/lib/actions/categories';
import { getPayees } from '@/lib/actions/payees';
import { ScheduledClientView } from '@/components/ScheduledClientView';

export const metadata = {
  title: 'Scheduled | Buddy',
  description: 'Manage recurring and scheduled transactions',
};

export default async function ScheduledPage() {
  await requireUser();

  const [scheduledTransactions, accounts, categories, payees] = await Promise.all([
    getScheduledTransactions(),
    getAccountsWithBalances(),
    getFlatCategories(),
    getPayees(),
  ]);

  return (
    <ScheduledClientView
      scheduledTransactions={scheduledTransactions}
      accounts={accounts}
      categories={categories}
      payees={payees}
    />
  );
}
