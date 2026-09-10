'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { formatCurrency } from '@/lib/utils/currency';
import { AccountModal } from './AccountModal';
import { PlusCircle, CreditCard, ArrowRight, Wallet, PiggyBank, Banknote } from 'lucide-react';

interface AccountsClientViewProps {
  accounts: AccountWithBalance[];
}

export function AccountsClientView({ accounts }: AccountsClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'checking':
        return <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'savings':
        return <PiggyBank className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case 'credit':
        return <CreditCard className="h-5 w-5 text-rose-600 dark:text-rose-400" />;
      case 'cash':
        return <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Wallet className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Accounts
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your bank accounts, credit cards, and cash wallets.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Account</span>
        </button>
      </div>

      {/* Grid of Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs hover:shadow-md transition-shadow dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    {getAccountIcon(account.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{account.name}</h3>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                      {account.type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Current Balance
                </span>
                <div
                  className={`mt-1 text-2xl font-extrabold ${
                    account.balanceCents < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  {formatCurrency(account.balanceCents)}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">
                {account.transactionCount} {account.transactionCount === 1 ? 'transaction' : 'transactions'}
              </span>

              <Link
                href={`/transactions?account=${account.id}`}
                className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                View Ledger <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && <AccountModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
