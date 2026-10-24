'use client';

import { cn } from '@/lib/utils';

interface CircularProgressProps {
  percent: number;
  timePercent?: number; // % of the way through the budget period
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function CircularProgress({
  percent,
  timePercent,
  size = 68,
  strokeWidth = 6,
  className,
}: CircularProgressProps) {
  const safePercent = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  const displayPercent = Math.round(safePercent);
  const clampedFillPercent = Math.min(100, safePercent);

  const hasTwoRings = timePercent !== undefined;
  const safeTimePercent = hasTwoRings && Number.isFinite(timePercent) ? Math.max(0, timePercent) : 0;
  const clampedTimePercent = Math.min(100, safeTimePercent);

  const isOver = safePercent >= 100;
  const isWarning = safePercent >= 80 && safePercent < 100;

  const strokeColorClass = isOver
    ? 'text-rose-600 dark:text-rose-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  const textColorClass = isOver
    ? 'text-rose-600 dark:text-rose-400'
    : isWarning
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-zinc-900 dark:text-zinc-100';

  // Geometry calculations
  const center = size / 2;

  let outerRadius: number;
  let outerStroke: number;
  let innerRadius: number = 0;
  let innerStroke: number = 0;
  let outerCircumference: number;
  let outerOffset: number;
  let innerCircumference: number = 0;
  let innerOffset: number = 0;

  if (hasTwoRings) {
    outerStroke = Math.max(4, Math.round(strokeWidth * 0.85 * 10) / 10);
    innerStroke = Math.max(3.5, outerStroke - 1);
    const gap = 2.5;

    outerRadius = (size - outerStroke) / 2;
    innerRadius = Math.max(10, outerRadius - outerStroke / 2 - gap - innerStroke / 2);

    outerCircumference = 2 * Math.PI * outerRadius;
    outerOffset = outerCircumference - (clampedFillPercent / 100) * outerCircumference;

    innerCircumference = 2 * Math.PI * innerRadius;
    innerOffset = innerCircumference - (clampedTimePercent / 100) * innerCircumference;
  } else {
    outerStroke = strokeWidth;
    outerRadius = (size - strokeWidth) / 2;
    outerCircumference = 2 * Math.PI * outerRadius;
    outerOffset = outerCircumference - (clampedFillPercent / 100) * outerCircumference;
  }

  const tooltipText = hasTwoRings
    ? `Spent: ${displayPercent}% • Time: ${Math.round(safeTimePercent)}%`
    : `${displayPercent}%`;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center shrink-0', className)}
      style={{ width: size, height: size }}
      title={tooltipText}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 transform"
      >
        <title>{tooltipText}</title>

        {/* Outer Ring Background Track */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={outerStroke}
          className="text-zinc-100 dark:text-zinc-800"
        />

        {/* Outer Ring Progress Arc (Spending %) */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={outerStroke}
          strokeDasharray={outerCircumference}
          strokeDashoffset={outerOffset}
          strokeLinecap="round"
          className={cn('transition-all duration-300 ease-out', strokeColorClass)}
        />

        {/* Inner Ring (Time elapsed %) if enabled */}
        {hasTwoRings && (
          <>
            {/* Inner Ring Background Track */}
            <circle
              cx={center}
              cy={center}
              r={innerRadius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={innerStroke}
              className="text-zinc-100 dark:text-zinc-800"
            />
            {/* Inner Ring Progress Arc (Grey duration bar) */}
            <circle
              cx={center}
              cy={center}
              r={innerRadius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={innerStroke}
              strokeDasharray={innerCircumference}
              strokeDashoffset={innerOffset}
              strokeLinecap="round"
              className="text-zinc-400 dark:text-zinc-500 transition-all duration-300 ease-out"
            />
          </>
        )}
      </svg>

      {/* Center percentage label */}
      <div className="absolute inset-0 flex items-center justify-center px-1 pointer-events-none">
        <span
          className={cn(
            'font-bold tabular-nums leading-none tracking-tight',
            displayPercent >= 1000
              ? 'text-[10px]'
              : displayPercent >= 100
              ? 'text-xs'
              : 'text-xs sm:text-sm',
            textColorClass
          )}
        >
          {displayPercent}%
        </span>
      </div>
    </div>
  );
}
