import { getTransactions } from '@/lib/actions/transactions';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getCategoryGroupsWithCategories } from '@/lib/actions/categories';
import { getPayees } from '@/lib/actions/payees';
import { TransactionsClientView } from '@/components/TransactionsClientView';

export const metadata = {
  title: 'Transactions | Buddy',
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TransactionsPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const accountId = typeof resolvedParams.account === 'string' ? resolvedParams.account : undefined;
  const categoryId = typeof resolvedParams.category === 'string' ? resolvedParams.category : undefined;

  const [transactions, accounts, categoryGroups, payees] = await Promise.all([
    getTransactions({ accountId, categoryId }),
    getAccountsWithBalances(),
    getCategoryGroupsWithCategories(),
    getPayees(),
  ]);

  return (
    <TransactionsClientView
      transactions={transactions}
      accounts={accounts}
      categoryGroups={categoryGroups}
      payees={payees}
      selectedAccountId={accountId}
      selectedCategoryId={categoryId}
    />
  );
}
