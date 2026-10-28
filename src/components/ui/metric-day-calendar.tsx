/**
 * Shared calendar day cells with a secondary metric line (like /traces counts).
 * Uses explicit classNames to ensure table cells and buttons have proper dimensions,
 * completely preventing row overlap and content clipping.
 */

import { useState } from 'react';

import { format } from 'date-fns';

import { Calendar } from '@/components/ui/calendar';

import { cn } from '@/lib/utils';

import { formatCompactMetric } from '@/lib/featureUtils';

export type CalendarViewMode = 'both' | 'primary' | 'secondary';

export type MetricDayCalendarProps = {
  selected: Date;

  onSelect: (date: Date) => void;

  /** date (yyyy-MM-dd) → raw metric (count or tokens) */

  metrics: Record<string, number>;

  /** date (yyyy-MM-dd) → secondary metric (e.g. cost) */

  subMetrics?: Record<string, number>;

  /** When true, days with metric <= 0 are disabled (if any day has data). Future days always disabled. */

  disableEmpty?: boolean;

  className?: string;

  /** Format the metric under the day number. Default: formatCompactMetric */

  formatMetric?: (n: number) => string;

  /** Format the sub metric under the main metric. */

  formatSubMetric?: (n: number) => string;

  /** Labels for the view mode switcher */

  primaryLabel?: string;

  secondaryLabel?: string;

  allLabel?: string;

  viewModeLabel?: string;
};

export function MetricDayCalendar({
  selected,

  onSelect,

  metrics,

  subMetrics,

  disableEmpty = true,

  className,

  formatMetric = formatCompactMetric,

  formatSubMetric,

  primaryLabel = '用量',

  secondaryLabel = '费用',

  allLabel = '全部',

  viewModeLabel = '视图',
}: MetricDayCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('both');

  const hasAnyPositive = Object.values(metrics).some((v) => (v ?? 0) > 0);

  const endOfToday = new Date();

  endOfToday.setHours(23, 59, 59, 999);

  const disabled = (day: Date) => {
    if (day.getTime() > endOfToday.getTime()) return true;

    if (!disableEmpty || !hasAnyPositive) return false;

    const ds = format(day, 'yyyy-MM-dd');

    return (metrics[ds] ?? 0) <= 0;
  };

  const isSub = Boolean(subMetrics);

  const selectedDateStr = format(selected, 'yyyy-MM-dd');

  const selectedMetric = metrics[selectedDateStr] ?? 0;

  const selectedSubMetric = subMetrics ? subMetrics[selectedDateStr] : undefined;

  const showFooter = isSub && selectedMetric > 0;

  // 显式指定单元格宽高，彻底避免 Tailwind 默认 h-9 w-9 导致的跨行文字重叠

  const calendarClassNames = isSub
    ? {
        table: 'w-full border-collapse space-y-1',

        head_row: 'flex w-full',

        head_cell:
          'text-muted-foreground rounded-md w-14 font-normal text-xs text-center select-none',

        row: 'flex w-full mt-1.5',

        cell: 'h-16 w-14 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',

        day: 'h-16 w-14 p-0 font-normal aria-selected:opacity-100 rounded-lg overflow-hidden transition-all',
      }
    : {
        table: 'w-full border-collapse space-y-1',

        head_row: 'flex w-full',

        head_cell:
          'text-muted-foreground rounded-md w-11 font-normal text-[0.8rem] text-center select-none',

        row: 'flex w-full mt-1',

        cell: 'h-11 w-11 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',

        day: 'h-11 w-11 p-0 font-normal aria-selected:opacity-100 rounded-lg overflow-hidden transition-all',
      };

  return (
    <div className={cn('p-2 select-none', isSub ? 'min-w-[400px]' : 'min-w-[316px]', className)}>
      {isSub && (
        <div className="flex items-center justify-between pb-2.5 mb-1 px-1 border-b border-border/40">
          <span className="text-xs font-medium text-muted-foreground">{viewModeLabel}</span>
          <div className="inline-flex items-center rounded-lg bg-muted/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all',

                viewMode === 'both'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {allLabel}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('primary')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all',

                viewMode === 'primary'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('secondary')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all',

                viewMode === 'secondary'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
      )}

      <Calendar
        mode="single"
        selected={selected}
        onSelect={(date) => {
          if (date && !disabled(date)) onSelect(date);
        }}
        disabled={disabled}
        defaultMonth={selected}
        initialFocus
        className="pointer-events-auto p-0"
        classNames={calendarClassNames}
        components={{
          DayContent: ({
            date: dayDate,

            activeModifiers,
          }: {
            date: Date;

            activeModifiers: { selected?: boolean };
          }) => {
            const ds = format(dayDate, 'yyyy-MM-dd');

            const value = metrics[ds] ?? 0;

            const hasData = value > 0;

            const isSelected = !!activeModifiers?.selected;

            const subValue = subMetrics ? subMetrics[ds] : undefined;

            const hasSubData = subValue !== undefined && subValue > 0;

            if (!hasData) {
              return (
                <div className="flex items-center justify-center w-full h-full">
                  <span className="text-[0.85rem] text-muted-foreground/35 font-normal">
                    {dayDate.getDate()}
                  </span>
                </div>
              );
            }

            const showPrimary = viewMode === 'both' || viewMode === 'primary';

            const showSecondary = Boolean(
              isSub && formatSubMetric && (viewMode === 'both' || viewMode === 'secondary'),
            );

            return (
              <div
                className={cn(
                  'flex flex-col items-center w-full h-full leading-none select-none',

                  viewMode === 'both' ? 'justify-between py-1.5' : 'justify-center gap-1.5 py-1.5',
                )}
              >
                <span
                  className={cn(
                    'font-semibold transition-colors',

                    viewMode === 'both' ? 'text-[0.8rem]' : 'text-[0.88rem]',

                    isSelected ? 'text-primary-foreground font-bold' : 'text-foreground/90',
                  )}
                >
                  {dayDate.getDate()}
                </span>

                {showPrimary && (
                  <span
                    className={cn(
                      'tabular-nums font-medium truncate max-w-full px-0.5',

                      viewMode === 'both' ? 'text-[0.66rem]' : 'text-[0.74rem]',

                      isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground',
                    )}
                    title={String(value)}
                  >
                    {formatMetric(value)}
                  </span>
                )}

                {showSecondary && (
                  <span
                    className={cn(
                      'tabular-nums font-semibold truncate max-w-full px-1.5 py-0.5 rounded-md leading-none',

                      viewMode === 'both' ? 'text-[0.62rem]' : 'text-[0.72rem]',

                      isSelected
                        ? 'bg-white/20 text-white ring-1 ring-white/30'
                        : hasSubData
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20'
                          : 'text-muted-foreground/60',
                    )}
                    title={subValue !== undefined ? String(subValue) : undefined}
                  >
                    {formatSubMetric!(subValue ?? 0)}
                  </span>
                )}
              </div>
            );
          },
        }}
      />

      {showFooter && (
        <div className="mt-2.5 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs px-1 text-muted-foreground">
          <span className="font-medium text-foreground">{format(selected, 'yyyy-MM-dd')}</span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums font-medium">{formatMetric(selectedMetric)} Tokens</span>
            {selectedSubMetric !== undefined && formatSubMetric && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/20 px-1.5 py-0.5 rounded text-[0.7rem] tabular-nums">
                {formatSubMetric(selectedSubMetric)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
