import { requireUser } from '@/lib/auth';
import { getActiveBudgetsWithStatus } from '@/lib/actions/budgets';
import { getFlatCategories } from '@/lib/actions/categories';
import { BudgetsClientView } from '@/components/BudgetsClientView';

export const metadata = {
  title: 'Budgets | Buddy',
  description: 'Create and track weekly, monthly, and yearly category budgets',
};

export default async function BudgetsPage() {
  await requireUser();

  const [budgets, categories] = await Promise.all([
    getActiveBudgetsWithStatus(),
    getFlatCategories(),
  ]);

  return <BudgetsClientView budgets={budgets} categories={categories} />;
}
