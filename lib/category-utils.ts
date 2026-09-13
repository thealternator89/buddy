export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: Date;

  // Hierarchy details
  children: CategoryNode[];
  depth: number; // 0 for root, 1 for child, 2 for grandchild, etc.
  path: string[]; // e.g. ['Groceries', 'Supermarket']
  fullPathName: string; // e.g. 'Groceries > Supermarket'

  // Telemetry
  directSpentCents: number; // Spent directly with this category id
  totalSpentCents: number; // direct + all descendant subcategories
  directTransactionCount: number;
  totalTransactionCount: number; // direct + all descendant subcategories
}

export interface CategoryFlatItem {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  path: string[];
  fullPathName: string;
  hasChildren: boolean;
  directSpentCents: number;
  totalSpentCents: number;
  directTransactionCount: number;
  totalTransactionCount: number;
}

/**
 * Recursively builds paths and calculates rollup totals up the tree.
 */
export function processCategoryNode(
  node: CategoryNode,
  parentPath: string[] = [],
  depth = 0
): void {
  node.depth = depth;
  node.path = [...parentPath, node.name];
  node.fullPathName = node.path.join(' > ');

  let subSpent = 0;
  let subCount = 0;

  for (const child of node.children) {
    processCategoryNode(child, node.path, depth + 1);
    subSpent += child.totalSpentCents;
    subCount += child.totalTransactionCount;
  }

  node.totalSpentCents = node.directSpentCents + subSpent;
  node.totalTransactionCount = node.directTransactionCount + subCount;
}

/**
 * Flattens a CategoryNode tree into a depth-first list.
 */
export function flattenCategoryTree(nodes: CategoryNode[]): CategoryFlatItem[] {
  const result: CategoryFlatItem[] = [];

  function traverse(node: CategoryNode) {
    result.push({
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      sortOrder: node.sortOrder,
      depth: node.depth,
      path: node.path,
      fullPathName: node.fullPathName,
      hasChildren: node.children.length > 0,
      directSpentCents: node.directSpentCents,
      totalSpentCents: node.totalSpentCents,
      directTransactionCount: node.directTransactionCount,
      totalTransactionCount: node.totalTransactionCount,
    });

    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return result;
}
