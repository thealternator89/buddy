'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { TransactionModal } from './TransactionModal';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';

interface AddTransactionButtonProps {
  accounts: AccountWithBalance[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees: PayeeWithRules[];
}

export function AddTransactionButton({
  accounts,
  categories,
  payees,
}: AddTransactionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
      >
        <PlusCircle className="h-4 w-4" />
        <span>Add Transaction</span>
      </button>

      {isOpen && (
        <TransactionModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          accounts={accounts}
          categories={categories}
          payees={payees}
        />
      )}
    </>
  );
}
