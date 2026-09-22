'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { TransactionWithDetails } from '@/lib/actions/transactions';
import { formatCurrency } from '@/lib/utils/currency';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionWithDetails | null;
}

export function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
}: TransactionDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !transaction) return null;

  const isTransfer = Boolean(transaction.transferId);
  const isIncome = transaction.amountCents > 0;

  // Format date nicely
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

  // Format creation timestamp
  const formatTimestamp = (date: Date) => {
    try {
      const d = new Date(date);
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(d);
    } catch {
      return String(date);
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
                isTransfer
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                  : isIncome
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {isTransfer ? (
                <ArrowLeftRight className="h-4 w-4" />
              ) : isIncome ? (
                '+'
              ) : (
                '-'
              )}
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {isTransfer ? 'Transfer Details' : 'Transaction Details'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
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
            <div className="flex items-start justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Date</span>
              </div>
              <div className="text-right">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatDateFriendly(transaction.date)}
                </div>
                <div className="text-xs text-zinc-400 font-mono mt-0.5">{transaction.date}</div>
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
        </div>
      </div>
    </div>
  );
}
