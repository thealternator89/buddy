'use client';

import { useState } from 'react';
import { CategoryGroupWithStats } from '@/lib/actions/categories';
import { PayeeWithStats } from '@/lib/actions/payees';
import { CategoriesClientView } from './CategoriesClientView';
import { PayeesTab } from './PayeesTab';
import { CategoryModal } from './CategoryModal';
import { PayeeModal } from './PayeeModal';
import { DeletePayeeModal } from './DeletePayeeModal';
import {
  FolderTree,
  Building2,
  PlusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManageClientViewProps {
  categoryGroups: CategoryGroupWithStats[];
  payees: PayeeWithStats[];
  initialTab?: 'categories' | 'payees';
}

export function ManageClientView({
  categoryGroups,
  payees,
  initialTab = 'categories',
}: ManageClientViewProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'payees'>(initialTab);

  // Modals
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPayeeModalOpen, setIsPayeeModalOpen] = useState(false);
  const [editingPayee, setEditingPayee] = useState<PayeeWithStats | null>(null);
  const [deletingPayee, setDeletingPayee] = useState<PayeeWithStats | null>(null);

  const totalCategories = categoryGroups.reduce((acc, g) => acc + g.categories.length, 0);

  const handleTabChange = (tab: 'categories' | 'payees') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState(null, '', url.toString());
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Manage
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Organize your categories, spending groups, and payees in one central place.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {activeTab === 'categories' ? (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Category / Group</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingPayee(null);
                setIsPayeeModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>New Payee</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented Control Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2 -mb-px">
          <button
            onClick={() => handleTabChange('categories')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'categories'
                ? 'border-emerald-600 text-emerald-600 font-semibold dark:border-emerald-500 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:border-zinc-700'
            )}
          >
            <FolderTree className="h-4 w-4" />
            <span>Categories & Groups</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                activeTab === 'categories'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              )}
            >
              {totalCategories}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('payees')}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === 'payees'
                ? 'border-emerald-600 text-emerald-600 font-semibold dark:border-emerald-500 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:border-zinc-700'
            )}
          >
            <Building2 className="h-4 w-4" />
            <span>Payees</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                activeTab === 'payees'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              )}
            >
              {payees.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'categories' ? (
        <CategoriesClientView groups={categoryGroups} showHeader={false} />
      ) : (
        <PayeesTab
          payees={payees}
          categoryGroups={categoryGroups}
          onNewPayee={() => {
            setEditingPayee(null);
            setIsPayeeModalOpen(true);
          }}
          onEditPayee={(payee) => {
            setEditingPayee(payee);
            setIsPayeeModalOpen(true);
          }}
          onDeletePayee={(payee) => {
            setDeletingPayee(payee);
          }}
        />
      )}

      {/* Global Modals */}
      {isCategoryModalOpen && (
        <CategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          categoryGroups={categoryGroups}
        />
      )}

      {isPayeeModalOpen && (
        <PayeeModal
          key={editingPayee ? editingPayee.id : 'new'}
          isOpen={isPayeeModalOpen}
          onClose={() => {
            setIsPayeeModalOpen(false);
            setEditingPayee(null);
          }}
          categoryGroups={categoryGroups}
          payee={editingPayee}
        />
      )}

      {deletingPayee && (
        <DeletePayeeModal
          isOpen={Boolean(deletingPayee)}
          onClose={() => setDeletingPayee(null)}
          payee={deletingPayee}
        />
      )}
    </div>
  );
}
