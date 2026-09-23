import { AccountWithBalance } from '@/lib/actions/accounts';

/**
 * Compares two accounts to order them by:
 * 1. Grouped status: accounts with a group come before ungrouped accounts
 * 2. Group sort order: ascending order of group's sortOrder
 * 3. Group name: alphabetical tie-breaker for groups
 * 4. Account sort order: ascending order of account's sortOrder
 * 5. Account name: alphabetical tie-breaker for accounts
 */
export function compareAccountsByGroupAndOrder(
  a: AccountWithBalance,
  b: AccountWithBalance
): number {
  const aHasGroup = Boolean(a.groupId);
  const bHasGroup = Boolean(b.groupId);

  // 1. Grouped accounts before ungrouped accounts
  if (aHasGroup !== bHasGroup) {
    return aHasGroup ? -1 : 1;
  }

  // 2. Different groups: compare group sort order and group name
  if (a.groupId && b.groupId && a.groupId !== b.groupId) {
    const aGroupSort = a.groupSortOrder ?? 0;
    const bGroupSort = b.groupSortOrder ?? 0;
    if (aGroupSort !== bGroupSort) {
      return aGroupSort - bGroupSort;
    }
    const aGroupName = a.groupName || '';
    const bGroupName = b.groupName || '';
    const groupCompare = aGroupName.localeCompare(bGroupName, undefined, {
      sensitivity: 'base',
    });
    if (groupCompare !== 0) {
      return groupCompare;
    }
  }

  // 3. Same group or both ungrouped: compare account sort order
  const aSortOrder = a.sortOrder ?? 0;
  const bSortOrder = b.sortOrder ?? 0;
  if (aSortOrder !== bSortOrder) {
    return aSortOrder - bSortOrder;
  }

  // 4. Account name tie-breaker
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/**
 * Returns a new array of accounts sorted by group sort order and account sort order.
 */
export function sortAccountsByGroupAndOrder(
  accounts: AccountWithBalance[]
): AccountWithBalance[] {
  return [...accounts].sort(compareAccountsByGroupAndOrder);
}
