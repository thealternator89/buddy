'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  CheckCircle2,
  Circle,
  Calendar,
  Wallet,
  Tag,
  FileText,
  Clock,
  Pencil,
  Trash2,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  TransactionWithDetails,
  updateTransaction,
  deleteTransaction,
} from '@/lib/actions/transactions';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';
import { resolvePayeeCategory, formatRuleCondition, RuleMatchResult } from '@/lib/payee-rules';
import { formatCurrency } from '@/lib/utils/currency';
import { APP_CONFIG } from '@/lib/constants';
import { CurrencyInput } from './CurrencyInput';
import { PayeeCombobox } from './PayeeCombobox';
import { CategoryCombobox } from './CategoryCombobox';
import { AccountCombobox } from './AccountCombobox';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionWithDetails | null;
  accounts?: AccountWithBalance[];
  categories?: (CategoryNode | CategoryFlatItem)[];
  payees?: PayeeWithRules[];
}

interface TransactionEditFormProps {
  transaction: TransactionWithDetails;
  accounts: AccountWithBalance[];
  categories: (CategoryNode | CategoryFlatItem)[];
  payees: PayeeWithRules[];
  onCancel: () => void;
  onSuccess: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function TransactionEditForm({
  transaction,
  accounts,
  categories,
  payees,
  onCancel,
  onSuccess,
  onDelete,
  isDeleting = false,
}: TransactionEditFormProps) {
  const isTransfer = Boolean(transaction.transferId);
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    isTransfer ? 'transfer' : transaction.amountCents > 0 ? 'income' : 'expense'
  );

  const [amountCents, setAmountCents] = useState<number>(Math.abs(transaction.amountCents));

  const [accountId, setAccountId] = useState<string>(() => {
    if (isTransfer && transaction.amountCents >= 0) {
      return (
        transaction.transferAccountId ||
        accounts.find((a) => a.id !== transaction.accountId)?.id ||
        ''
      );
    }
    return transaction.accountId;
  });

  const [destAccountId, setDestAccountId] = useState<string>(() => {
    if (isTransfer) {
      if (transaction.amountCents < 0) {
        return (
          transaction.transferAccountId ||
          accounts.find((a) => a.id !== transaction.accountId)?.id ||
          ''
        );
      }
      return transaction.accountId;
    }
    return '';
  });

  const [payeeName, setPayeeName] = useState(transaction.payeeName || '');
  const [selectedPayeeObj, setSelectedPayeeObj] = useState<PayeeWithRules | null>(() => {
    if (isTransfer || !transaction.payeeName) return null;
    return (
      payees.find(
        (p) => p.name.toLowerCase() === transaction.payeeName?.trim().toLowerCase()
      ) || null
    );
  });
  const [categoryId, setCategoryId] = useState(transaction.categoryId || '');
  const [categorySuggestion, setCategorySuggestion] = useState<RuleMatchResult | null>(null);
  const [date, setDate] = useState(transaction.date);
  const [notes, setNotes] = useState(transaction.notes || '');
  const [isCleared, setIsCleared] = useState(transaction.isCleared);
  const [error, setError] = useState<string | null>(null);

  const applyPayeeCategory = (targetPayee: PayeeWithRules | null, amount: number) => {
    if (!targetPayee) {
      setCategorySuggestion(null);
      return;
    }
    const match = resolvePayeeCategory(targetPayee, amount);
    if (match) {
      setCategoryId(match.categoryId);
      setCategorySuggestion(match);
    } else {
      setCategorySuggestion(null);
    }
  };


  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amountCents <= 0) {
      setError('Please enter an amount greater than $0.00.');
      return;
    }

    if (isTransfer) {
      if (!accountId || !destAccountId) {
        setError('Please select both source and destination accounts.');
        return;
      }
      if (accountId === destAccountId) {
        setError('Source and destination accounts must be different.');
        return;
      }

      startTransition(async () => {
        try {
          await updateTransaction(transaction.id, {
            sourceAccountId: accountId,
            destinationAccountId: destAccountId,
            amountCents,
            date,
            notes: notes.trim() || null,
            isCleared,
          });
          onSuccess();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to update transfer.');
        }
      });
    } else {
      if (!accountId) {
        setError('Please select an account.');
        return;
      }
      if (!payeeName.trim()) {
        setError('Please enter a payee name.');
        return;
      }

      const signedAmount = type === 'expense' ? -amountCents : amountCents;

      startTransition(async () => {
        try {
          await updateTransaction(transaction.id, {
            accountId,
            payeeName: payeeName.trim(),
            categoryId: categoryId || null,
            amountCents: signedAmount,
            date,
            notes: notes.trim() || null,
            isCleared,
          });
          onSuccess();
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to update transaction.');
        }
      });
    }
  };

  return (
    <div className="mt-4">
      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Type toggle for normal transactions */}
        {!isTransfer && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-white text-rose-600 shadow-xs dark:bg-zinc-900 dark:text-rose-400'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Expense</span>
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-white text-emerald-600 shadow-xs dark:bg-zinc-900 dark:text-emerald-400'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <ArrowDownLeft className="h-4 w-4" />
              <span>Income</span>
            </button>
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Amount ({APP_CONFIG.currency.code})
          </label>
          <div className="mt-1">
            <CurrencyInput
              valueCents={amountCents}
              onChangeCents={setAmountCents}
            />
          </div>
        </div>

        {/* Transfer Account Selectors */}
        {isTransfer ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                From Account
              </label>
              <div className="mt-1">
                <AccountCombobox
                  accounts={accounts}
                  value={accountId}
                  onChange={(val) => {
                    setAccountId(val);
                    if (destAccountId === val) {
                      const nextDest = accounts.find((a) => a.id !== val)?.id || '';
                      setDestAccountId(nextDest);
                    }
                  }}
                  placeholder="Select source account..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                To Account
              </label>
              <div className="mt-1">
                <AccountCombobox
                  accounts={accounts.filter((a) => a.id !== accountId)}
                  value={destAccountId}
                  onChange={setDestAccountId}
                  placeholder="Select destination account..."
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Account & Payee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Account
                </label>
                <div className="mt-1">
                  <AccountCombobox
                    accounts={accounts}
                    value={accountId}
                    onChange={setAccountId}
                    placeholder="Select account..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {type === 'income' ? 'Payer / Source' : 'Payee'}
                </label>
                <div className="mt-1">
                  <PayeeCombobox
                    payees={payees}
                    value={payeeName}
                    onChange={(name, defaultCatId, payeeObj) => {
                      setPayeeName(name);
                      const resolvedPayee =
                        payeeObj ||
                        payees.find((p) => p.name.toLowerCase() === name.trim().toLowerCase()) ||
                        null;
                      setSelectedPayeeObj(resolvedPayee);
                      if (resolvedPayee) {
                        applyPayeeCategory(resolvedPayee, amountCents);
                      } else if (defaultCatId) {
                        setCategoryId(defaultCatId);
                        setCategorySuggestion({ categoryId: defaultCatId, source: 'default' });
                      } else {
                        setCategorySuggestion(null);
                      }
                    }}
                    placeholder={type === 'income' ? 'Search or add payer...' : 'Search or add payee...'}
                  />
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Category
              </label>
              <div className="mt-1">
                <CategoryCombobox
                  categories={categories}
                  value={categoryId}
                  onChange={(newCatId) => {
                    setCategoryId(newCatId);
                    setCategorySuggestion(null);
                  }}
                />
              </div>
              {categorySuggestion && categorySuggestion.categoryId === categoryId && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs animate-in fade-in duration-150">
                  {categorySuggestion.source === 'rule' && categorySuggestion.matchedRule ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>
                        Auto-assigned by rule (
                        {formatRuleCondition(
                          categorySuggestion.matchedRule.operator,
                          categorySuggestion.matchedRule.amountCents
                        )}
                        )
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Payee default category</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Date & Cleared */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div className="pt-4 sm:pt-6 flex items-center gap-2">
            <input
              type="checkbox"
              id="modal-edit-cleared"
              checked={isCleared}
              onChange={(e) => setIsCleared(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <label
              htmlFor="modal-edit-cleared"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none cursor-pointer"
            >
              Cleared transaction
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Fortnightly groceries, coffee with Alex"
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {/* Submit / Cancel / Delete buttons */}
        <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting || isPending}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || isDeleting}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
  accounts = [],
  categories = [],
  payees = [],
}: TransactionDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevTxId, setPrevTxId] = useState(transaction?.id);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (prevOpen !== isOpen || prevTxId !== transaction?.id) {
    setPrevOpen(isOpen);
    setPrevTxId(transaction?.id);
    if (!isOpen || prevTxId !== transaction?.id) {
      setIsEditing(false);
      setDeleteError(null);
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isEditing, onClose]);

  if (!isOpen || !transaction) return null;

  const isTransfer = Boolean(transaction.transferId);
  const isIncome = transaction.amountCents > 0;

  const handleDelete = () => {
    const confirmMsg = isTransfer
      ? 'This is a transfer between two accounts. Deleting it will remove both sides of the transfer. Continue?'
      : 'Are you sure you want to delete this transaction?';

    if (window.confirm(confirmMsg)) {
      startDeleteTransition(async () => {
        try {
          await deleteTransaction(transaction.id);
          onClose();
        } catch (err: unknown) {
          setDeleteError(err instanceof Error ? err.message : 'Failed to delete transaction.');
        }
      });
    }
  };

  // Format date nicely for view mode
  const formatDateFriendly = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Format creation timestamp for view mode
  const formatTimestamp = (dInput: Date) => {
    try {
      const d = new Date(dInput);
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return String(dInput);
    }
  };

  // Calculate transfer directions if applicable
  const sourceAccountName = isTransfer
    ? transaction.amountCents < 0
      ? transaction.accountName
      : transaction.transferAccountName || 'Unknown Account'
    : transaction.accountName;

  const destinationAccountName = isTransfer
    ? transaction.amountCents > 0
      ? transaction.accountName
      : transaction.transferAccountName || 'Unknown Account'
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                isEditing
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                  : isTransfer
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                  : isIncome
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {isEditing ? (
                <Pencil className="h-4 w-4" />
              ) : isTransfer ? (
                <ArrowLeftRight className="h-4 w-4" />
              ) : isIncome ? (
                '+'
              ) : (
                '-'
              )}
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {isEditing
                ? isTransfer
                  ? 'Edit Transfer'
                  : 'Edit Transaction'
                : isTransfer
                ? 'Transfer Details'
                : 'Transaction Details'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Delete Error Message */}
        {deleteError && (
          <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {deleteError}
          </div>
        )}

        {/* View Mode vs Edit Mode */}
        {isEditing ? (
          <TransactionEditForm
            key={transaction.id}
            transaction={transaction}
            accounts={accounts}
            categories={categories}
            payees={payees}
            onCancel={() => setIsEditing(false)}
            onSuccess={() => {
              setIsEditing(false);
              onClose();
            }}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        ) : (
          /* View Content */
          <div className="mt-5 space-y-5">
            {/* Amount and Status Hero */}
            <div className="rounded-xl border border-zinc-100 bg-zinc-50/75 p-5 text-center dark:border-zinc-800/80 dark:bg-zinc-800/40">
              <div
                className={`text-3xl font-extrabold tracking-tight ${
                  isIncome
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isTransfer
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {formatCurrency(transaction.amountCents, { showSign: isIncome })}
              </div>

              <div className="mt-2.5 flex items-center justify-center gap-2">
                {/* Type Badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isTransfer
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : isIncome
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {isTransfer ? 'Transfer' : isIncome ? 'Income' : 'Expense'}
                </span>

                {/* Cleared Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    transaction.isCleared
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {transaction.isCleared ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Cleared</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-3.5 w-3.5" />
                      <span>Uncleared</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Core Details Grid */}
            <div className="space-y-1 text-sm">
              {/* Date */}
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Date</span>
                </div>
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatDateFriendly(transaction.date)}
                </div>
              </div>

              {/* Account(s) */}
              {isTransfer ? (
                <div className="space-y-2 py-3 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <Wallet className="h-4 w-4 shrink-0" />
                      <span>From Account</span>
                    </div>
                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                      {sourceAccountName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <Wallet className="h-4 w-4 shrink-0" />
                      <span>To Account</span>
                    </div>
                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                      {destinationAccountName}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <Wallet className="h-4 w-4 shrink-0" />
                    <span>Account</span>
                  </div>
                  <Link
                    href={`/transactions?account=${transaction.accountId}`}
                    onClick={onClose}
                    className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    title="View all transactions for this account"
                  >
                    {transaction.accountName}
                  </Link>
                </div>
              )}

              {/* Payee / Payer (if not transfer) */}
              {!isTransfer && (
                <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    <Tag className="h-4 w-4 shrink-0" />
                    <span>{isIncome ? 'Payer / Source' : 'Payee'}</span>
                  </div>
                  <div>
                    {transaction.payeeName ? (
                      transaction.payeeId ? (
                        <Link
                          href={`/transactions?payee=${transaction.payeeId}`}
                          onClick={onClose}
                          className="font-semibold text-zinc-900 hover:text-emerald-600 dark:text-zinc-100 dark:hover:text-emerald-400 transition-colors"
                          title="Filter transactions by payee"
                        >
                          {transaction.payeeName}
                        </Link>
                      ) : (
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {transaction.payeeName}
                        </span>
                      )
                    ) : (
                      <span className="text-zinc-400 italic">Unassigned Payee</span>
                    )}
                  </div>
                </div>
              )}

              {/* Category */}
              <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <Tag className="h-4 w-4 shrink-0" />
                  <span>Category</span>
                </div>
                <div>
                  {isTransfer ? (
                    <span className="text-xs text-zinc-400 italic">Not applicable (Transfer)</span>
                  ) : transaction.categoryName ? (
                    transaction.categoryId ? (
                      <Link
                        href={`/transactions?category=${transaction.categoryId}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors"
                        title="Filter transactions by category"
                      >
                        {transaction.parentCategoryName && (
                          <span className="text-emerald-600/75 dark:text-emerald-400/75">
                            {transaction.parentCategoryName} ›
                          </span>
                        )}
                        <span>{transaction.categoryName}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {transaction.parentCategoryName && (
                          <span className="text-emerald-600/75 dark:text-emerald-400/75">
                            {transaction.parentCategoryName} ›
                          </span>
                        )}
                        <span>{transaction.categoryName}</span>
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      Uncategorized
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="py-2 space-y-1.5">
                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>Notes</span>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50/75 p-3 text-xs text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-800/30 dark:text-zinc-300">
                  {transaction.notes && transaction.notes.trim() ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{transaction.notes}</p>
                  ) : (
                    <span className="text-zinc-400 italic">No notes provided for this transaction.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Recorded Timestamp */}
            {transaction.createdAt && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 pt-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Recorded on {formatTimestamp(transaction.createdAt)}</span>
              </div>
            )}

            {/* Footer action buttons in view mode */}
            <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit {isTransfer ? 'Transfer' : 'Transaction'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
