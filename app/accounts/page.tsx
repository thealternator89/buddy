import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { AccountsClientView } from '@/components/AccountsClientView';

export const metadata = {
  title: 'Accounts | Buddy',
};

export default async function AccountsPage() {
  const accounts = await getAccountsWithBalances();

  return <AccountsClientView accounts={accounts} />;
}
