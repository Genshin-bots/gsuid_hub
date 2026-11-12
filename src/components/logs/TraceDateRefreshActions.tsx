import { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { headerActionRowClass } from '@/components/layout/PinnedPage';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface TraceDateRefreshActionsProps {
  calendarClassName: string;
  styleId: string;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  dailyCounts: Record<string, number>;
  isLoading: boolean;
  onRefresh: () => void;
  className?: string;
}

export function TraceDateRefreshActions({
  calendarClassName,
  styleId,
  selectedDate,
  onSelectDate,
  dailyCounts,
  isLoading,
  onRefresh,
  className,
}: TraceDateRefreshActionsProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(styleId)) return;
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      .${calendarClassName} .rdp-day,
      .${calendarClassName} .rdp-day_button {
        overflow: visible !important;
        border-radius: 8px !important;
      }
      .${calendarClassName} .rdp-day,
      .${calendarClassName} .rdp-day_button,
      .${calendarClassName} .rdp-cell {
        width: 2.75rem !important;
        height: 2.75rem !important;
      }
      .${calendarClassName} .rdp-day_button {
        font-size: 0.875rem !important;
      }
    `;
    document.head.appendChild(el);
  }, [calendarClassName, styleId]);

  const disabledMatchers = useMemo(() => {
    const dates = Object.keys(dailyCounts).sort();
    if (dates.length === 0) return undefined;
    const minDate = new Date(`${dates[0]}T00:00:00`);
    const maxDate = new Date(`${dates[dates.length - 1]}T00:00:00`);
    return [{ before: minDate }, { after: maxDate }];
  }, [dailyCounts]);

  return (
    <div className={cn(headerActionRowClass, className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              tabToolbarControlClass,
              'justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground',
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, 'yyyy-MM-dd') : t('logs.selectDate')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
          <div className={calendarClassName}>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) onSelectDate(date);
              }}
              disabled={disabledMatchers}
              defaultMonth={selectedDate}
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
                  const count = dailyCounts[ds];
                  const hasData = count !== undefined && count > 0;
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
                            'text-[0.55rem] mt-0.5',
                            isSelected ? 'text-primary-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </div>
                  );
                },
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={isLoading}
        className={cn(tabToolbarControlClass, 'whitespace-nowrap')}
      >
        <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
        {t('logs.refresh')}
      </Button>
    </div>
  );
}
