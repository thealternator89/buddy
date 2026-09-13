import { getCategoryGroupsWithStats } from '@/lib/actions/categories';
import { getPayeesWithStats } from '@/lib/actions/payees';
import { ManageClientView } from '@/components/ManageClientView';

export const metadata = {
  title: 'Manage | Buddy',
  description: 'Manage categories and payees for your transactions',
};

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ManagePage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const initialTab = resolvedParams.tab === 'payees' ? 'payees' : 'categories';

  const [categoryGroups, payees] = await Promise.all([
    getCategoryGroupsWithStats(),
    getPayeesWithStats(),
  ]);

  return (
    <ManageClientView
      categoryGroups={categoryGroups}
      payees={payees}
      initialTab={initialTab}
    />
  );
}
