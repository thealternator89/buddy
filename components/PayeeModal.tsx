'use client';

import { useState, useTransition, useMemo } from 'react';
import { X, Building2, Plus, Trash2, Sliders, Sparkles } from 'lucide-react';
import {
  CategoryNode,
  CategoryFlatItem,
  flattenCategoryTree,
} from '@/lib/category-utils';
import { PayeeWithStats, createPayee, updatePayee, CreatePayeeRuleInput } from '@/lib/actions/payees';
import {
  RuleOperator,
  PayeeWithRules,
  PayeeRuleItem,
  resolvePayeeCategory,
  formatRuleCondition,
} from '@/lib/payee-rules';
import { cn } from '@/lib/utils';

interface PayeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: (CategoryNode | CategoryFlatItem)[];
  payee?: PayeeWithStats | null;
}

interface RuleDraft {
  id?: string;
  operator: RuleOperator;
  amountStr: string;
  categoryId: string;
}

export function PayeeModal({ isOpen, onClose, categories: inputCategories, payee }: PayeeModalProps) {
  const isEditing = Boolean(payee);
  const [name, setName] = useState(payee?.name || '');
  const [defaultCategoryId, setDefaultCategoryId] = useState(payee?.defaultCategoryId || '');
  const [priority, setPriority] = useState<number>(payee?.priority ?? 1);
  const [rules, setRules] = useState<RuleDraft[]>(() => {
    if (!payee?.rules) return [];
    return payee.rules.map((r) => ({
      id: r.id,
      operator: r.operator,
      amountStr: (r.amountCents / 100).toFixed(2),
      categoryId: r.categoryId,
    }));
  });
  const [testAmountStr, setTestAmountStr] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const flatCategories = useMemo<CategoryFlatItem[]>(() => {
    if (inputCategories.length === 0) return [];
    if ('children' in inputCategories[0]) {
      return flattenCategoryTree(inputCategories as CategoryNode[]);
    }
    return inputCategories as CategoryFlatItem[];
  }, [inputCategories]);

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        operator: 'lte',
        amountStr: '',
        categoryId: defaultCategoryId || (flatCategories[0]?.id ?? ''),
      },
    ]);
  };

  const handleUpdateRule = (index: number, field: keyof RuleDraft, value: string) => {
    setRules((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  // Live test simulation for user verification
  const testSimulation = useMemo(() => {
    const parsed = parseFloat(testAmountStr);
    if (isNaN(parsed) || parsed <= 0) return null;

    const validRules: PayeeRuleItem[] = rules
      .filter((r) => r.categoryId && !isNaN(parseFloat(r.amountStr)) && parseFloat(r.amountStr) > 0)
      .map((r, i) => ({
        categoryId: r.categoryId,
        operator: r.operator,
        amountCents: Math.round(parseFloat(r.amountStr) * 100),
        sortOrder: i,
      }));

    const tempPayee: PayeeWithRules = {
      id: payee?.id || 'preview',
      name: name || 'Payee',
      defaultCategoryId: defaultCategoryId || null,
      rules: validRules,
    };

    const testCents = Math.round(parsed * 100);
    const result = resolvePayeeCategory(tempPayee, testCents);
    if (!result) return { categoryName: 'None (Unassigned)', source: 'none' as const };

    const cat = flatCategories.find((c) => c.id === result.categoryId);
    return {
      categoryName: cat?.name || 'Unknown Category',
      source: result.source,
      matchedRule: result.matchedRule,
    };
  }, [testAmountStr, rules, name, defaultCategoryId, flatCategories, payee?.id]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a payee name.');
      return;
    }

    // Validate rules
    const payloadRules: CreatePayeeRuleInput[] = [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const parsed = parseFloat(r.amountStr);
      if (isNaN(parsed) || parsed <= 0) {
        setError(`Rule #${i + 1} requires a valid positive amount (e.g. 5.00).`);
        return;
      }
      if (!r.categoryId) {
        setError(`Rule #${i + 1} requires a category to be selected.`);
        return;
      }
      payloadRules.push({
        categoryId: r.categoryId,
        operator: r.operator,
        amountCents: Math.round(parsed * 100),
      });
    }

    startTransition(async () => {
      try {
        if (isEditing && payee) {
          await updatePayee(payee.id, {
            name: name.trim(),
            defaultCategoryId: defaultCategoryId || null,
            rules: payloadRules,
            priority,
          });
        } else {
          await createPayee(name.trim(), defaultCategoryId || null, payloadRules, priority);
        }
        onClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save payee.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 p-6 pb-4 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isEditing ? 'Edit Payee' : 'New Payee'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {isEditing
                  ? 'Configure payee details, default category, and amount rules.'
                  : 'Add a merchant or organization and custom category rules.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Payee Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Woolworths, Netflix, Electricity Corp"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Default Category (Fallback)
            </label>
            <select
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 font-mono"
            >
              <option value="">None (Unassigned)</option>
              {flatCategories.map((cat) => {
                const indent = '  '.repeat(cat.depth);
                const prefix = cat.depth > 0 ? '↳ ' : '● ';
                return (
                  <option key={cat.id} value={cat.id}>
                    {indent}{prefix}{cat.name}
                  </option>
                );
              })}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Used when no amount-based rule matches or when no rules are configured.
            </p>
          </div>

          {/* Payee Priority Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Priority
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                {
                  val: 0,
                  badge: '0 • Highest',
                  desc: 'Quick-pick before entry',
                  activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500 ring-2 ring-emerald-500/20',
                },
                {
                  val: 1,
                  badge: '1 • Standard',
                  desc: 'Standard search behavior',
                  activeClass: 'border-zinc-500 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-400 ring-2 ring-zinc-500/20',
                },
                {
                  val: 2,
                  badge: '2 • Low',
                  desc: 'Bottom of search list',
                  activeClass: 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-500 ring-2 ring-amber-500/20',
                },
                {
                  val: 3,
                  badge: '3 • Archived',
                  desc: 'Hidden from selection',
                  activeClass: 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-500 ring-2 ring-rose-500/20',
                },
              ].map((opt) => {
                const isSelected = priority === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setPriority(opt.val)}
                    className={cn(
                      'flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                      isSelected
                        ? opt.activeClass
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200'
                    )}
                  >
                    <span className="font-semibold text-xs">{opt.badge}</span>
                    <span className="text-[10px] mt-0.5 opacity-80 leading-tight">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {priority === 0 && '0 is highest: Displayed before entry in the payee selection box, and ranked first in search results.'}
              {priority === 1 && '1 is standard: Current standard behavior. Search to find payee.'}
              {priority === 2 && '2 is low: Selectable, but appears at the bottom of the payee list even if it is a better match for current input.'}
              {priority === 3 && '3 is archived: Never appears in selection lists, but remains visible in existing transactions.'}
            </p>
          </div>

          {/* Amount-Based Rules Section */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  <Sliders className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Amount-Based Category Rules</span>
                </label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Closest rule wins (inclusive). For example, if you set ≤ $3 and ≤ $5, amounts under $3 match $3, and $4–$5 match $5.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRule}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Rule</span>
              </button>
            </div>

            {rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-4 text-center text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/20">
                No amount rules defined. All payments will use the default category.
              </div>
            ) : (
              <div className="space-y-2">
                {/* Column header on desktop */}
                <div className="hidden sm:flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  <span className="w-28 shrink-0">Condition</span>
                  <span className="w-28 shrink-0">Amount</span>
                  <span className="w-4 shrink-0 text-center"></span>
                  <span className="flex-1 min-w-0">Target Category</span>
                  <span className="w-7 shrink-0"></span>
                </div>

                {rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2"
                  >
                    {/* Left: Operator + Amount + Mobile Delete */}
                    <div className="flex items-center gap-2">
                      {/* Operator */}
                      <select
                        value={rule.operator}
                        onChange={(e) => handleUpdateRule(idx, 'operator', e.target.value as RuleOperator)}
                        className="w-28 shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 font-medium focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="lte">≤ At most</option>
                        <option value="gte">≥ At least</option>
                      </select>

                      {/* Amount Input Group */}
                      <div className="flex items-center w-24 sm:w-28 shrink-0 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 overflow-hidden">
                        <span className="pl-2.5 pr-0.5 text-xs font-bold text-zinc-400 select-none">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="0.00"
                          value={rule.amountStr}
                          onChange={(e) => handleUpdateRule(idx, 'amountStr', e.target.value)}
                          className="w-full bg-transparent py-1.5 pr-2 pl-0.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Delete button (visible on mobile) */}
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(idx)}
                        className="sm:hidden ml-auto p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                        title="Delete rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="hidden sm:block text-zinc-400 shrink-0 text-xs">➔</div>

                    {/* Category Select: takes all remaining space */}
                    <div className="flex-1 min-w-0 w-full">
                      <select
                        value={rule.categoryId}
                        onChange={(e) => handleUpdateRule(idx, 'categoryId', e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 font-mono focus:border-emerald-500 focus:outline-none truncate"
                        required
                      >
                        <option value="">Select target category...</option>
                        {flatCategories.map((cat) => {
                          const indent = '  '.repeat(cat.depth);
                          const prefix = cat.depth > 0 ? '↳ ' : '● ';
                          return (
                            <option key={cat.id} value={cat.id}>
                              {indent}{prefix}{cat.name}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Delete button (desktop) */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(idx)}
                      className="hidden sm:block p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Live Test Simulator Widget */}
            {rules.length > 0 && (
              <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Live Rule Tester:
                  </span>
                  <div className="flex items-center w-24 shrink-0 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 overflow-hidden">
                    <span className="pl-2 pr-0.5 text-xs font-bold text-zinc-400 select-none">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="4.50"
                      value={testAmountStr}
                      onChange={(e) => setTestAmountStr(e.target.value)}
                      className="w-full bg-transparent py-1 pr-1.5 pl-0.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <span>Result:</span>
                  {testSimulation ? (
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      {testSimulation.categoryName}
                      {testSimulation.source === 'rule' && testSimulation.matchedRule && (
                        <span className="text-[10px] font-normal text-emerald-600/80 dark:text-emerald-400/80">
                          ({formatRuleCondition(testSimulation.matchedRule.operator, testSimulation.matchedRule.amountCents)})
                        </span>
                      )}
                      {testSimulation.source === 'default' && (
                        <span className="text-[10px] font-normal text-zinc-500">
                          (Fallback default)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic">Enter amount to test</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Payee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
