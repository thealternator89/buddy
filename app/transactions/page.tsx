import { getPaginatedTransactions } from '@/lib/actions/transactions';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getFlatCategories } from '@/lib/actions/categories';
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
  const payeeId = typeof resolvedParams.payee === 'string' ? resolvedParams.payee : undefined;
  const search = typeof resolvedParams.search === 'string' ? resolvedParams.search : undefined;
  const pageParam = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page, 10) : 1;
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const pageSize = 100;

  const [paginatedData, accounts, categories, payees] = await Promise.all([
    getPaginatedTransactions({ accountId, categoryId, payeeId, search, page, pageSize }),
    getAccountsWithBalances(),
    getFlatCategories(),
    getPayees(),
  ]);

  return (
    <TransactionsClientView
      transactions={paginatedData.transactions}
      pagination={paginatedData.pagination}
      summary={paginatedData.summary}
      accounts={accounts}
      categories={categories}
      payees={payees}
      selectedAccountId={accountId}
      selectedCategoryId={categoryId}
      selectedPayeeId={payeeId}
      initialSearch={search}
    />
  );
}
