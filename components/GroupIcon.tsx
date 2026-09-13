'use client';

import { icons, LucideIcon, Layers } from 'lucide-react';
import { resolveIconName } from '@/lib/icons';

interface GroupIconProps {
  icon?: string | null;
  className?: string;
}

export function GroupIcon({ icon, className = 'h-5 w-5' }: GroupIconProps) {
  const iconName = icon ? resolveIconName(icon) : 'Layers';
  const IconComponent: LucideIcon = (icons as Record<string, LucideIcon>)[iconName] || Layers;

  return <IconComponent className={className} />;
}
