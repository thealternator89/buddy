'use client';

import { icons, LucideIcon } from 'lucide-react';
import { resolveIconName } from '@/lib/icons';

export function getAccountIconColorClass(type?: string): string {
  switch (type) {
    case 'checking':
      return 'text-blue-600 dark:text-blue-400';
    case 'savings':
      return 'text-teal-600 dark:text-teal-400';
    case 'credit':
      return 'text-rose-600 dark:text-rose-400';
    case 'cash':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'investment':
      return 'text-purple-600 dark:text-purple-400';
    case 'loan':
      return 'text-orange-600 dark:text-orange-400';
    default:
      return 'text-zinc-600 dark:text-zinc-400';
  }
}

interface AccountIconProps {
  icon?: string | null;
  type?: string;
  className?: string;
}

export function AccountIcon({ icon, type, className }: AccountIconProps) {
  const iconName = resolveIconName(icon, type);
  const IconComponent: LucideIcon = (icons as Record<string, LucideIcon>)[iconName] || icons.Wallet;
  const colorClass = getAccountIconColorClass(type);
  const finalClass = className ? `${colorClass} ${className}` : `h-5 w-5 ${colorClass}`;

  return <IconComponent className={finalClass} />;
}
