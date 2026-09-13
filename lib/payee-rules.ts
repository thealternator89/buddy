import { formatCurrency } from './utils/currency';

export type RuleOperator = 'lte' | 'gte';

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

export interface PayeeWithRules {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  rules?: PayeeRuleItem[];
}

export interface RuleMatchResult {
  categoryId: string;
  source: 'rule' | 'default';
  matchedRule?: PayeeRuleItem;
}

/**
 * Resolves the appropriate category for a payee based on transaction amount.
 * - Checks amount-based rules using "closest threshold wins" logic (inclusive).
 * - Falls back to the payee's default category if no rule matches.
 * - Returns null if neither a rule nor a default category is assigned.
 */
export function resolvePayeeCategory(
  payee: PayeeWithRules | null | undefined,
  amountCents: number
): RuleMatchResult | null {
  if (!payee) return null;

  const absAmount = Math.abs(amountCents);
  const rules = payee.rules || [];

  if (rules.length > 0 && absAmount > 0) {
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
 * e.g., "≤ $5.00" or "≥ $50.00".
 */
export function formatRuleCondition(operator: RuleOperator, amountCents: number): string {
  const symbol = operator === 'lte' ? '≤' : '≥';
  return `${symbol} ${formatCurrency(amountCents)}`;
}
