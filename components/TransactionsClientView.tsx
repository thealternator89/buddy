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
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
            Transactions
          </h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 transition-colors"
            title="Import CSV"
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-emerald-600 px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors shrink-0"
            title="Add transaction"
          >
            <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Transaction</span>
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
