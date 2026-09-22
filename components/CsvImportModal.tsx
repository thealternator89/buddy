'use client';

import { useState, useTransition, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeftRight,
  Loader2,
  FolderPlus,
  UserPlus,
  CreditCard,
} from 'lucide-react';
import { parseCsv, CsvParseSummary } from '@/lib/csv';
import { importCsvTransactions, CsvImportResult } from '@/lib/actions/csv-import';
import { formatCurrency } from '@/lib/utils/currency';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts?: AccountWithBalance[];
  categories?: (CategoryNode | CategoryFlatItem)[];
  payees?: PayeeWithRules[];
}

export function CsvImportModal({
  isOpen,
  onClose,
  accounts = [],
  categories = [],
  payees = [],
}: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rawContent, setRawContent] = useState<string>('');
  const [preview, setPreview] = useState<CsvParseSummary | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Existing names set (lowercased) for quick "new entity" detection in UI
  const existingAccountNames = new Set(accounts.map((a) => a.name.toLowerCase()));
  const existingCategoryNames = new Set(
    categories.map((c) => ('name' in c ? c.name.toLowerCase() : ''))
  );
  const existingPayeeNames = new Set(payees.map((p) => p.name.toLowerCase()));

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setParseError('Please upload a valid .csv file.');
      return;
    }

    try {
      setParseError(null);
      setFile(selectedFile);
      const text = await selectedFile.text();
      setRawContent(text);
      const parsed = parseCsv(text);
      if (parsed.totalRows === 0) {
        setParseError('The selected CSV file appears to be empty or missing data rows.');
        setPreview(null);
      } else {
        setPreview(parsed);
      }
    } catch {
      setParseError('Failed to read and parse CSV file.');
      setPreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleImport = () => {
    if (!rawContent) return;

    startTransition(async () => {
      try {
        const importRes = await importCsvTransactions(rawContent);
        setResult(importRes);
      } catch (err: unknown) {
        setParseError(err instanceof Error ? err.message : 'An error occurred during import.');
      }
    });
  };

  const handleReset = () => {
    setFile(null);
    setRawContent('');
    setPreview(null);
    setResult(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Determine which entities detected in the CSV are actually new
  const trulyNewAccounts = preview
    ? preview.accounts.filter((a) => !existingAccountNames.has(a.toLowerCase()))
    : [];
  const trulyNewCategories = preview
    ? preview.categories.filter((c) => !existingCategoryNames.has(c.toLowerCase()))
    : [];
  const trulyNewPayees = preview
    ? preview.payees.filter((p) => !existingPayeeNames.has(p.toLowerCase()))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Import CSV Transactions
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Upload bank exports or spreadsheets into Buddy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {parseError && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">Import Error</p>
                <p className="mt-0.5 text-xs">{parseError}</p>
              </div>
            </div>
          )}

          {/* SUCCESS SCREEN */}
          {result ? (
            <div className="py-6 text-center space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  Import Completed Successfully!
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Processed {result.totalRows} row{result.totalRows === 1 ? '' : 's'} from your file.
                </p>
              </div>

              {/* Stats Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Transactions</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                    {result.importedTransactions}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Transfers</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                    {result.importedTransfers}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">New Accounts</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                    {result.createdAccounts.length}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">New Categories/Payees</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
                    {result.createdCategories.length + result.createdPayees.length}
                  </p>
                </div>
              </div>

              {/* Newly Created Entities Details */}
              {(result.createdAccounts.length > 0 ||
                result.createdCategories.length > 0 ||
                result.createdPayees.length > 0) && (
                <div className="text-left space-y-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-800/50">
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                    Created with default settings:
                  </p>
                  {result.createdAccounts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400">Accounts:</span>
                      {result.createdAccounts.map((acc) => (
                        <span
                          key={acc}
                          className="inline-flex items-center rounded-md bg-zinc-200/80 px-2 py-0.5 font-medium text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
                        >
                          {acc}
                        </span>
                      ))}
                    </div>
                  )}
                  {result.createdCategories.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400">Categories:</span>
                      {result.createdCategories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center rounded-md bg-emerald-100/80 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                  {result.createdPayees.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-zinc-500 dark:text-zinc-400">Payees:</span>
                      {result.createdPayees.map((payee) => (
                        <span
                          key={payee}
                          className="inline-flex items-center rounded-md bg-blue-100/80 px-2 py-0.5 font-medium text-blue-800 dark:bg-blue-950/80 dark:text-blue-300"
                        >
                          {payee}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Errors if any */}
              {result.errors.length > 0 && (
                <div className="text-left rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs dark:border-amber-900/60 dark:bg-amber-950/40">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    Skipped {result.errors.length} row{result.errors.length === 1 ? '' : 's'} with issues:
                  </p>
                  <ul className="mt-2 list-disc pl-4 space-y-1 text-amber-800 dark:text-amber-300">
                    {result.errors.slice(0, 5).map((e, idx) => (
                      <li key={idx}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more issues.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : !preview ? (
            /* UPLOAD DROPZONE */
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/20'
                    : 'border-zinc-300 bg-zinc-50/50 hover:bg-zinc-100/60 dark:border-zinc-700 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70'
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
                  <FileText className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Click to select or drag and drop a CSV file
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                  Standard format with columns: Date, Description, Category, Payee, Notes, Account, Transfer Account, Amount
                </p>
                <button
                  type="button"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Browse Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Column specification reference card */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-400 space-y-2">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">Supported Columns & Rules:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="rounded-lg bg-white p-2 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Date</span>
                    <p className="text-zinc-500 mt-0.5">YYYY-MM-DD or DD/MM/YYYY</p>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Description</span>
                    <p className="text-zinc-500 mt-0.5">Prepended to Notes</p>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Account</span>
                    <p className="text-zinc-500 mt-0.5">Auto-created if new</p>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Transfer Account</span>
                    <p className="text-zinc-500 mt-0.5">Non-empty = transfer</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW SCREEN */
            <div className="space-y-5">
              {/* File details & mini stats */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {file?.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {preview.validRows.length} valid row{preview.validRows.length === 1 ? '' : 's'}
                      {preview.invalidRows.length > 0 && ` (${preview.invalidRows.length} with warnings)`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isPending}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Detected new entities warning/notice */}
              {(trulyNewAccounts.length > 0 ||
                trulyNewCategories.length > 0 ||
                trulyNewPayees.length > 0) && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/30 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Auto-creation Notice:</span>
                  </div>
                  <p className="text-emerald-800/90 dark:text-emerald-300/90">
                    The following items were not found in your database and will be created automatically with default settings:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {trulyNewAccounts.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 font-medium text-emerald-950 shadow-xs ring-1 ring-emerald-200 dark:bg-zinc-900 dark:text-emerald-200 dark:ring-emerald-800"
                      >
                        <CreditCard className="h-3 w-3" /> Account: {a}
                      </span>
                    ))}
                    {trulyNewCategories.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 font-medium text-emerald-950 shadow-xs ring-1 ring-emerald-200 dark:bg-zinc-900 dark:text-emerald-200 dark:ring-emerald-800"
                      >
                        <FolderPlus className="h-3 w-3" /> Category: {c}
                      </span>
                    ))}
                    {trulyNewPayees.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 font-medium text-emerald-950 shadow-xs ring-1 ring-emerald-200 dark:bg-zinc-900 dark:text-emerald-200 dark:ring-emerald-800"
                      >
                        <UserPlus className="h-3 w-3" /> Payee: {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rows with errors */}
              {preview.invalidRows.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span>{preview.invalidRows.length} Row(s) with Issues (will be skipped):</span>
                  </div>
                  <ul className="mt-2 list-disc pl-4 space-y-0.5">
                    {preview.invalidRows.slice(0, 3).map((r) => (
                      <li key={r.rowIndex}>
                        Row {r.rowIndex}: {r.error}
                      </li>
                    ))}
                    {preview.invalidRows.length > 3 && (
                      <li>...and {preview.invalidRows.length - 3} more.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Preview (Showing first {Math.min(preview.validRows.length, 6)} rows)
                  </p>
                  <span className="text-xs text-zinc-400">
                    {preview.transferCount} transfers · {preview.transactionCount} transactions
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Date</th>
                        <th className="px-3 py-2.5 font-medium">Type</th>
                        <th className="px-3 py-2.5 font-medium">Account(s)</th>
                        <th className="px-3 py-2.5 font-medium">Payee / Category</th>
                        <th className="px-3 py-2.5 font-medium">Notes</th>
                        <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {preview.validRows.slice(0, 6).map((row) => (
                        <tr
                          key={row.rowIndex}
                          className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30"
                        >
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">
                            {row.date}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {row.isTransfer ? (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  row.amountCents < 0
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}
                              >
                                <ArrowLeftRight className="h-2.5 w-2.5" />
                                {row.amountCents < 0 ? 'Transfer Out' : 'Transfer In'}
                              </span>
                            ) : row.amountCents >= 0 ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Inflow
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                Outflow
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.isTransfer ? (
                              <div className="flex items-center gap-1.5">
                                {row.amountCents < 0 ? (
                                  <>
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                      {row.accountName}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-zinc-400" />
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                      {row.transferAccountName}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                      {row.transferAccountName}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-zinc-400" />
                                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                      {row.accountName}
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                {row.accountName}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                {row.payeeName || '—'}
                              </span>
                              {row.categoryName && (
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  {row.categoryName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 max-w-[160px] truncate">
                            {row.notes ? (
                              <span title={row.notes} className="whitespace-pre-line">
                                {row.notes.replace(/\n\n/g, ' ⏵ ')}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td
                            className={`whitespace-nowrap px-3 py-2 text-right font-semibold font-mono ${
                              row.amountCents > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {formatCurrency(row.amountCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          {result ? (
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750 transition-colors"
              >
                Cancel
              </button>
              {preview && (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isPending || preview.validRows.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Import {preview.validRows.length} Records</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
