'use client';

import { useState } from 'react';
import { TransactionTable } from './TransactionTable';
import { TransactionModal } from './TransactionModal';
import { TransactionWithDetails } from '@/lib/actions/transactions';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { Payee } from '@/lib/db/schema';
import { PlusCircle } from 'lucide-react';

interface TransactionsClientViewProps {
  transactions: TransactionWithDetails[];
  accounts: AccountWithBalance[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees: Payee[];
  selectedAccountId?: string;
  selectedCategoryId?: string;
  selectedPayeeId?: string;
  initialSearch?: string;
}

export function TransactionsClientView({
  transactions,
  accounts,
  categories,
  payees,
  selectedAccountId,
  selectedCategoryId,
  selectedPayeeId,
  initialSearch,
}: TransactionsClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Transactions Ledger
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            View, search, filter, and track all your account transactions and transfers.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Transaction</span>
        </button>
      </div>

      <TransactionTable
        initialTransactions={transactions}
        accounts={accounts}
        categories={categories}
        payees={payees}
        selectedAccountId={selectedAccountId}
        selectedCategoryId={selectedCategoryId}
        selectedPayeeId={selectedPayeeId}
        initialSearch={initialSearch}
      />

      {isModalOpen && (
        <TransactionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          accounts={accounts}
          categories={categories}
          payees={payees}
          defaultAccountId={selectedAccountId}
        />
      )}
    </div>
  );
}
