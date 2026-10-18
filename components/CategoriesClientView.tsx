'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { archiveCategory } from '@/lib/actions/categories';
import { CategoryNode, flattenCategoryTree, sortCategoryTree } from '@/lib/category-utils';
import { CategoryModal, EditCategoryData } from './CategoryModal';
import {
  PlusCircle,
  FolderTree,
  Tag,
  ArrowRight,
  Pencil,
  Archive,
  ChevronRight,
  ChevronDown,
  Folder,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoriesClientViewProps {
  categoryTree: CategoryNode[];
  showHeader?: boolean;
}

export function CategoriesClientView({
  categoryTree,
  showHeader = true,
}: CategoriesClientViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<EditCategoryData | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const sortedTree = useMemo(() => sortCategoryTree(categoryTree), [categoryTree]);
  const flatCategories = useMemo(() => flattenCategoryTree(sortedTree), [sortedTree]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleOpenNewRoot = () => {
    setEditItem(null);
    setDefaultParentId(null);
    setIsModalOpen(true);
  };

  const handleAddSubcategory = (parentId: string) => {
    setEditItem(null);
    setDefaultParentId(parentId);
    setIsModalOpen(true);
  };

  const handleEditCategory = (node: CategoryNode) => {
    setEditItem({
      id: node.id,
      name: node.name,
      parentId: node.parentId,
    });
    setDefaultParentId(null);
    setIsModalOpen(true);
  };

  const handleArchiveCategory = (node: CategoryNode) => {
    const hasChildren = node.children.length > 0;
    const msg = hasChildren
      ? `Are you sure you want to archive "${node.name}" and all ${node.children.length} of its subcategories? They will no longer appear in category selectors.`
      : `Are you sure you want to archive "${node.name}"? It will no longer appear in category selectors.`;

    if (confirm(msg)) {
      startTransition(async () => {
        await archiveCategory(node.id);
      });
    }
  };

  // Render a node and its recursive children
  const renderNode = (node: CategoryNode) => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsedIds.has(node.id);
    const isRoot = node.depth === 0;

    return (
      <div key={node.id} className="relative">
        <div
          className={cn(
            'group flex items-center justify-between py-3 px-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40',
            isRoot
              ? 'border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900'
              : 'border-t border-zinc-100/60 dark:border-zinc-800/40 bg-zinc-50/25 dark:bg-zinc-900/25'
          )}
          style={{ paddingLeft: `${node.depth * 24 + 16}px` }}
        >
          {/* Left section: expand toggle, icon, name & badges */}
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapse(node.id)}
                className="p-1 -ml-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 rounded transition-colors"
                title={isCollapsed ? 'Expand subcategories' : 'Collapse subcategories'}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-6 shrink-0" />
            )}

            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs',
                isRoot
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              )}
            >
              {isRoot ? (
                <Folder className="h-3.5 w-3.5" />
              ) : (
                <Tag className="h-3.5 w-3.5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'truncate text-sm',
                    isRoot
                      ? 'font-bold text-zinc-900 dark:text-zinc-100'
                      : hasChildren
                      ? 'font-semibold text-zinc-800 dark:text-zinc-200'
                      : 'font-medium text-zinc-700 dark:text-zinc-300'
                  )}
                >
                  {node.name}
                </span>

                {hasChildren && (
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {node.children.length} {node.children.length === 1 ? 'sub' : 'subs'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href={`/transactions?category=${node.id}`}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 transition-colors"
              title={`View transactions for ${node.name}`}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <button
              type="button"
              onClick={() => handleAddSubcategory(node.id)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-zinc-800 dark:hover:text-emerald-400 transition-colors"
              title={`Add subcategory under ${node.name}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleEditCategory(node)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
              title="Edit category"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleArchiveCategory(node)}
              disabled={isPending}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
              title="Archive category"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Children (if expanded) */}
        {hasChildren && !isCollapsed && (
          <div className="relative">
            {node.children.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Categories
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Organize transactions in a multi-level category tree with rolled-up spending insights.
            </p>
          </div>

          <button
            onClick={handleOpenNewRoot}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors self-start sm:self-auto"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Root Category</span>
          </button>
        </div>
      )}

      {/* Main Category Tree Explorer */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        {/* Table/Tree Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/75 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <FolderTree className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Category Hierarchy</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsedIds(new Set())}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Expand All
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <button
              type="button"
              onClick={() => setCollapsedIds(new Set(sortedTree.map((r) => r.id)))}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Collapse Roots
            </button>
          </div>
        </div>

        {/* Tree Content */}
        {sortedTree.length === 0 ? (
          <div className="py-12 text-center text-zinc-400">
            No categories defined yet. Click &quot;New Root Category&quot; to get started.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sortedTree.map((root) => renderNode(root))}
          </div>
        )}
      </div>

      {/* Modal for Creating / Editing Categories */}
      {isModalOpen && (
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditItem(null);
            setDefaultParentId(null);
          }}
          categories={flatCategories}
          editItem={editItem}
          defaultParentId={defaultParentId}
        />
      )}
    </div>
  );
}
