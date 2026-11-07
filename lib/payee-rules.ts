import { formatCurrency } from './utils/currency';

export type AmountRuleOperator = 'lte' | 'gte';
export type DirectionRuleOperator = 'income' | 'outgoing';
export type RuleOperator = AmountRuleOperator | DirectionRuleOperator;
export type PayeeRuleMode = 'none' | 'direction' | 'amount';
export type TransactionDirection = 'income' | 'outgoing';

export function isDirectionOperator(operator: string): operator is DirectionRuleOperator {
  return operator === 'income' || operator === 'outgoing';
}

export function isAmountOperator(operator: string): operator is AmountRuleOperator {
  return operator === 'lte' || operator === 'gte';
}

export function getPayeeRuleMode(rules?: PayeeRuleItem[]): PayeeRuleMode {
  if (!rules || rules.length === 0) return 'none';
  if (rules.some((r) => isDirectionOperator(r.operator))) return 'direction';
  return 'amount';
}

export interface PayeeRuleItem {
  id?: string;
  payeeId?: string;
  categoryId: string;
  categoryName?: string | null;
  parentCategoryName?: string | null;
  operator: RuleOperator;
  amountCents: number;
  sortOrder?: number;
}

export type PayeePriority = 0 | 1 | 2 | 3;

export const PAYEE_PRIORITY_META: Record<
  PayeePriority,
  {
    label: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  0: {
    label: 'Highest',
    description: 'Displayed before entry in selection lists',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200/60 dark:border-emerald-800/60',
  },
  1: {
    label: 'Standard',
    description: 'Current standard behaviour',
    badgeBg: 'bg-zinc-100 dark:bg-zinc-800',
    badgeText: 'text-zinc-600 dark:text-zinc-400',
    badgeBorder: 'border-zinc-200/60 dark:border-zinc-700/60',
  },
  2: {
    label: 'Low',
    description: 'Selectable, but appears at bottom of selection list',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200/60 dark:border-amber-800/60',
  },
  3: {
    label: 'Archived',
    description: 'Hidden from selection lists, visible in existing transactions',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60',
    badgeText: 'text-rose-700 dark:text-rose-400',
    badgeBorder: 'border-rose-200/60 dark:border-rose-800/60',
  },
};

export interface PayeeWithRules {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  priority?: number;
  createdAt?: Date;
  rules?: PayeeRuleItem[];
}

export interface RuleMatchResult {
  categoryId: string;
  source: 'rule' | 'default';
  matchedRule?: PayeeRuleItem;
}

/**
 * Resolves the appropriate category for a payee based on transaction direction or amount.
 * - Direction-based mode: Matches against transaction direction ('income' or 'outgoing').
 * - Amount-based mode: Checks amount-based rules using "closest threshold wins" logic (inclusive).
 * - Falls back to the payee's default category if no rule matches.
 * - Returns null if neither a rule nor a default category is assigned.
 */
export function resolvePayeeCategory(
  payee: PayeeWithRules | null | undefined,
  amountCents: number,
  explicitDirection?: TransactionDirection
): RuleMatchResult | null {
  if (!payee) return null;

  const rules = payee.rules || [];
  const mode = getPayeeRuleMode(rules);

  if (mode === 'direction') {
    const direction: TransactionDirection | undefined =
      explicitDirection ??
      (amountCents > 0 ? 'income' : amountCents < 0 ? 'outgoing' : undefined);

    if (direction) {
      const matched = rules.find((r) => r.operator === direction);
      if (matched) {
        return {
          categoryId: matched.categoryId,
          source: 'rule',
          matchedRule: matched,
        };
      }
    }
  } else if (mode === 'amount') {
    const absAmount = Math.abs(amountCents);
    if (absAmount > 0) {
      const matchingRules = rules.filter((r) => {
        if (r.operator === 'lte') {
          return absAmount <= r.amountCents;
        }
        if (r.operator === 'gte') {
          return absAmount >= r.amountCents;
        }
        return false;
      });

      if (matchingRules.length > 0) {
        // Sort matching rules by distance to threshold |absAmount - r.amountCents|
        // In case of tie, lower sortOrder (or earlier rule) wins
        matchingRules.sort((a, b) => {
          const distA = Math.abs(absAmount - a.amountCents);
          const distB = Math.abs(absAmount - b.amountCents);
          if (distA !== distB) {
            return distA - distB;
          }
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        });

        const winner = matchingRules[0];
        return {
          categoryId: winner.categoryId,
          source: 'rule',
          matchedRule: winner,
        };
      }
    }
  }

  // Fallback to default category
  if (payee.defaultCategoryId) {
    return {
      categoryId: payee.defaultCategoryId,
      source: 'default',
    };
  }

  return null;
}

/**
 * Formats a rule operator and amount into a human-readable condition string,
 * e.g., "≤ $5.00", "≥ $50.00", "Income", or "Outgoing".
 */
export function formatRuleCondition(operator: RuleOperator, amountCents: number = 0): string {
  if (operator === 'income') return 'Income';
  if (operator === 'outgoing') return 'Outgoing';
  const symbol = operator === 'lte' ? '≤' : '≥';
  return `${symbol} ${formatCurrency(amountCents)}`;
}
