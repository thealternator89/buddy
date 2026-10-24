'use client';

import { cn } from '@/lib/utils';

interface CircularProgressProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CircularProgress({
  percent,
  size = 68,
  strokeWidth = 6,
  className,
}: CircularProgressProps) {
  const safePercent = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  const displayPercent = Math.round(safePercent);
  const clampedFillPercent = Math.min(100, safePercent);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedFillPercent / 100) * circumference;

  const isOver = safePercent >= 100;
  const isWarning = safePercent >= 80 && safePercent < 100;

  const strokeColorClass = isOver
    ? 'text-rose-500 dark:text-rose-400'
    : isWarning
    ? 'text-amber-500 dark:text-amber-400'
    : 'text-emerald-500 dark:text-emerald-400';

  const textColorClass = isOver
    ? 'text-rose-600 dark:text-rose-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-zinc-900 dark:text-zinc-100';

  return (
    <div
      className={cn('relative inline-flex items-center justify-center shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transform"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          className="stroke-zinc-100 dark:stroke-zinc-800"
        />
        {/* Foreground progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn('transition-all duration-300 ease-out', strokeColorClass)}
        />
      </svg>

      {/* Percentage label inside */}
      <div className="absolute inset-0 flex items-center justify-center px-1">
        <span
          className={cn(
            'font-bold tabular-nums leading-none tracking-tight',
            displayPercent >= 1000 ? 'text-[10px]' : displayPercent >= 100 ? 'text-xs' : 'text-xs sm:text-sm',
            textColorClass
          )}
        >
          {displayPercent}%
        </span>
      </div>
    </div>
  );
}
