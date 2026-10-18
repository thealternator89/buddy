'use client';

import { useState } from 'react';
import { TransactionTable } from './TransactionTable';
import { TransactionModal } from './TransactionModal';
import { CsvImportModal } from './CsvImportModal';
import { TransactionWithDetails } from '@/lib/actions/transactions';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';
import { PlusCircle, Upload } from 'lucide-react';

interface TransactionsClientViewProps {
  transactions: TransactionWithDetails[];
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary?: {
    totalAmountCents: number;
  };
  accounts: AccountWithBalance[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees: PayeeWithRules[];
  selectedAccountId?: string;
  selectedCategoryId?: string;
  selectedPayeeId?: string;
  initialSearch?: string;
}

export function TransactionsClientView({
  transactions,
  pagination,
  summary,
  accounts,
  categories,
  payees,
  selectedAccountId,
  selectedCategoryId,
  selectedPayeeId,
  initialSearch,
}: TransactionsClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <Upload className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      <TransactionTable
        initialTransactions={transactions}
        pagination={pagination}
        summary={summary}
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

      {isImportModalOpen && (
        <CsvImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          accounts={accounts}
          categories={categories}
          payees={payees}
        />
      )}
    </div>
  );
}
