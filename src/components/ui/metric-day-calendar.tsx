/**
 * Shared calendar day cells with a secondary metric line (like /traces counts).
 * Injects CSS once so day buttons have room for the metric under the date number.
 */
import { useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { formatCompactMetric } from '@/lib/featureUtils';

const STYLE_ID = 'metric-date-calendar-overrides';

function ensureCalendarStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    .metric-date-calendar .rdp-day,
    .metric-date-calendar .rdp-day_button {
      overflow: visible !important;
      border-radius: 8px !important;
    }
    .metric-date-calendar .rdp-day,
    .metric-date-calendar .rdp-day_button,
    .metric-date-calendar .rdp-cell {
      width: 2.75rem !important;
      height: 2.75rem !important;
    }
    .metric-date-calendar .rdp-day_button {
      font-size: 0.875rem !important;
    }
  `;
  document.head.appendChild(el);
}

export type MetricDayCalendarProps = {
  selected: Date;
  onSelect: (date: Date) => void;
  /** date (yyyy-MM-dd) → raw metric (count or tokens) */
  metrics: Record<string, number>;
  /** When true, days with metric <= 0 are disabled (if any day has data). Future days always disabled. */
  disableEmpty?: boolean;
  className?: string;
  /** Format the metric under the day number. Default: formatCompactMetric */
  formatMetric?: (n: number) => string;
};

export function MetricDayCalendar({
  selected,
  onSelect,
  metrics,
  disableEmpty = true,
  className,
  formatMetric = formatCompactMetric,
}: MetricDayCalendarProps) {
  useEffect(() => {
    ensureCalendarStyles();
  }, []);

  const hasAnyPositive = Object.values(metrics).some((v) => (v ?? 0) > 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const disabled = (day: Date) => {
    if (day.getTime() > endOfToday.getTime()) return true;
    if (!disableEmpty || !hasAnyPositive) return false;
    const ds = format(day, 'yyyy-MM-dd');
    return (metrics[ds] ?? 0) <= 0;
  };

  return (
    <div className={cn('metric-date-calendar', className)}>
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(date) => {
          if (date && !disabled(date)) onSelect(date);
        }}
        disabled={disabled}
        defaultMonth={selected}
        initialFocus
        className="pointer-events-auto"
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
            return (
              <div className="flex flex-col items-center justify-center w-full h-full leading-none">
                <span
                  className={cn(
                    'text-[0.85rem]',
                    !hasData && 'text-muted-foreground opacity-50',
                  )}
                >
                  {dayDate.getDate()}
                </span>
                {hasData && (
                  <span
                    className={cn(
                      'text-[0.55rem] mt-0.5 max-w-full truncate px-0.5',
                      isSelected ? 'text-primary-foreground' : 'text-muted-foreground',
                    )}
                    title={String(value)}
                  >
                    {formatMetric(value)}
                  </span>
                )}
              </div>
            );
          },
        }}
      />
    </div>
  );
}
