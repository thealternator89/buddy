import { getCategoryGroupsWithStats } from '@/lib/actions/categories';
import { CategoriesClientView } from '@/components/CategoriesClientView';

export const metadata = {
  title: 'Categories | Buddy',
};

export default async function CategoriesPage() {
  const groups = await getCategoryGroupsWithStats();

  return <CategoriesClientView groups={groups} />;
}
