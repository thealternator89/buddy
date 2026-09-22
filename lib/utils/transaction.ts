import { TransactionWithDetails } from '@/lib/actions/transactions';

/**
 * Deduplicates transfer pairs in an array of transactions.
 * When viewing transactions across all accounts, each inter-account transfer
 * has two database records (source outflow and destination inflow).
 * This function ensures each transfer pair is only rendered once.
 */
export function deduplicateTransfers(
  transactions: TransactionWithDetails[]
): TransactionWithDetails[] {
  const seenTransferIds = new Set<string>();
  const result: TransactionWithDetails[] = [];

  for (const tx of transactions) {
    if (tx.transferId) {
      if (seenTransferIds.has(tx.id)) {
        continue;
      }
      seenTransferIds.add(tx.transferId);
    }
    result.push(tx);
  }

  return result;
}

/**
 * Returns directional or collapsed account names and metadata for a transaction.
 */
export function getTransferDetails(tx: TransactionWithDetails) {
  const isTransfer = Boolean(tx.transferId);
  const isOutflow = tx.amountCents < 0;

  const sourceAccountName = isOutflow
    ? tx.accountName
    : tx.transferAccountName || 'Account';

  const targetAccountName = isOutflow
    ? tx.transferAccountName || 'Account'
    : tx.accountName;

  const unsignedAmountCents = Math.abs(tx.amountCents);

  return {
    isTransfer,
    isOutflow,
    sourceAccountName,
    targetAccountName,
    unsignedAmountCents,
  };
}
