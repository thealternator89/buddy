import { requireUser } from '@/lib/auth';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getAccountGroups } from '@/lib/actions/account-groups';
import { AccountsClientView } from '@/components/AccountsClientView';

export const metadata = {
  title: 'Accounts | Buddy',
};

export default async function AccountsPage() {
  await requireUser();

  const [accounts, groups] = await Promise.all([
    getAccountsWithBalances(),
    getAccountGroups(),
  ]);

  return <AccountsClientView accounts={accounts} groups={groups} />;
}
