'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { formatCurrency } from '@/lib/utils/currency';
import { AccountModal } from './AccountModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { AccountIcon } from './AccountIcon';
import {
  PlusCircle,
  ArrowRight,
  Wallet,
  Pencil,
  Trash2,
} from 'lucide-react';

interface AccountsClientViewProps {
  accounts: AccountWithBalance[];
}

export function AccountsClientView({ accounts }: AccountsClientViewProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithBalance | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<AccountWithBalance | null>(null);

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
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Account</span>
        </button>
      </div>

      {/* Grid of Accounts or Empty State */}
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Wallet className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            No accounts yet
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Get started by adding your first bank account, credit card, or cash wallet.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Account</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs hover:shadow-md transition-shadow dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                      <AccountIcon icon={account.icon} type={account.type} />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{account.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                          {account.type}
                        </span>
                        {account.excludeFromNetWorth && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            Excluded from Net Worth
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingAccount(account)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                      title="Edit account"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit {account.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingAccount(account)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400 transition-colors"
                      title="Delete account"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete {account.name}</span>
                    </button>
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
                  {account.transactionCount}{' '}
                  {account.transactionCount === 1 ? 'transaction' : 'transactions'}
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
      )}

      {/* Add Account Modal */}
      {isAddModalOpen && (
        <AccountModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <AccountModal
          key={editingAccount.id}
          isOpen={Boolean(editingAccount)}
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onDelete={(acc) => {
            setEditingAccount(null);
            setDeletingAccount(acc);
          }}
        />
      )}

      {/* Delete Account Modal */}
      {deletingAccount && (
        <DeleteAccountModal
          isOpen={Boolean(deletingAccount)}
          account={deletingAccount}
          onClose={() => setDeletingAccount(null)}
        />
      )}
    </div>
  );
}
