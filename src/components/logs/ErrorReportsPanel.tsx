/**
 * 日志页「错误报告」面板。列表按内容指纹合并；详情用 fingerprint（也兼容文件名）。
 * 搜索 / 日期走后端过滤后再分页，不对当前页二次 filter。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getApiErrorMessage,
  logsApi,
  type ErrorReportDetail,
  type ErrorReportListItem,
} from '@/lib/api';
import { cn } from '@/lib/utils';

type DateMode = 'all' | 'single' | 'range';

interface SubmittedQuery {
  search: string;
  dateMode: DateMode;
  date: string;
  startDate: string;
  endDate: string;
  page: number;
}

const PER_PAGE = 50;

const KNOWN_REPORT_KEYS = new Set([
  'event',
  '_log_level',
  '_report_timestamp',
  'pathname',
  'lineno',
  'exception',
]);

function toIsoDay(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function formatReportTime(ts: string): string {
  if (!ts) return '';
  const match = /^(\d{4}-\d{2}-\d{2})[ _](\d{2})[:-](\d{2})[:-](\d{2})/.exec(ts);
  if (match) return `${match[1]} ${match[2]}:${match[3]}:${match[4]}`;
  return ts;
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function dateParamsOf(q: SubmittedQuery): {
  date?: string;
  start_date?: string;
  end_date?: string;
} {
  if (q.dateMode === 'single' && q.date) return { date: q.date };
  if (q.dateMode === 'range' && q.startDate && q.endDate) {
    return { start_date: q.startDate, end_date: q.endDate };
  }
  return {};
}

export default function ErrorReportsPanel() {
  const { t } = useLanguage();
  const [searchInput, setSearchInput] = useState('');
  const [dateMode, setDateMode] = useState<DateMode>('all');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [query, setQuery] = useState<SubmittedQuery>({
    search: '',
    dateMode: 'all',
    date: '',
    startDate: '',
    endDate: '',
    page: 1,
  });
  const [rows, setRows] = useState<ErrorReportListItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ErrorReportDetail | null>(null);

  const totalPages = Math.max(1, Math.ceil(count / PER_PAGE));

  const disableDay = useCallback(
    (day: Date) => {
      if (availableDates.length === 0) return false;
      return !availableDates.includes(toIsoDay(day));
    },
    [availableDates],
  );

  useEffect(() => {
    let alive = true;
    logsApi
      .getErrorReportDates()
      .then((dates) => {
        if (alive) setAvailableDates(Array.isArray(dates) ? dates : []);
      })
      .catch((err) => {
        console.warn('[ErrorReportsPanel] available-dates', getApiErrorMessage(err, ''));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((prev) => {
        const search = searchInput.trim();
        if (prev.search === search) return prev;
        return { ...prev, search, page: 1 };
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const applyDateQuery = useCallback((mode: DateMode, single?: Date, start?: Date, end?: Date) => {
    setQuery((prev) => ({
      ...prev,
      dateMode: mode,
      date: mode === 'single' && single ? toIsoDay(single) : '',
      startDate: mode === 'range' && start ? toIsoDay(start) : '',
      endDate: mode === 'range' && end ? toIsoDay(end) : '',
      page: 1,
    }));
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await logsApi.getErrorReports({
        page: query.page,
        per_page: PER_PAGE,
        search: query.search || undefined,
        ...dateParamsOf(query),
      });
      setRows(data.rows ?? []);
      setCount(data.count ?? 0);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('logs.errorReportLoadFailed')));
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const extraFields = useMemo(() => {
    const report = detail?.report;
    if (!report) return [];
    return Object.entries(report).filter(([key]) => !KNOWN_REPORT_KEYS.has(key));
  }, [detail]);

  const openDetail = async (item: ErrorReportListItem) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await logsApi.getErrorReport(item.id || item.filename, dateParamsOf(query));
      setDetail(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('logs.errorReportLoadFailed')));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const copyReport = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(detail.report, null, 2));
      toast.success(t('logs.errorReportCopied'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('logs.errorReportLoadFailed')));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card shrink-0">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Tabs
              value={dateMode}
              onValueChange={(v) => {
                const mode = v as DateMode;
                setDateMode(mode);
                applyDateQuery(mode, selectedDate, startDate, endDate);
              }}
            >
              <TabsList>
                <TabsTrigger value="all">{t('logs.allDates')}</TabsTrigger>
                <TabsTrigger value="single">{t('logs.singleDate')}</TabsTrigger>
                <TabsTrigger value="range">{t('logs.dateRange')}</TabsTrigger>
              </TabsList>
            </Tabs>

            {dateMode === 'single' ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'h-9 w-[180px] justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground',
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? toIsoDay(selectedDate) : t('logs.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (!date) return;
                      setSelectedDate(date);
                      applyDateQuery('single', date, startDate, endDate);
                    }}
                    defaultMonth={selectedDate}
                    initialFocus
                    className="pointer-events-auto"
                    disabled={disableDay}
                  />
                </PopoverContent>
              </Popover>
            ) : null}

            {dateMode === 'range' ? (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'h-9 w-[150px] justify-start text-left font-normal',
                        !startDate && 'text-muted-foreground',
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {startDate ? toIsoDay(startDate) : t('logs.startDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (!date) return;
                        setStartDate(date);
                        applyDateQuery('range', selectedDate, date, endDate);
                      }}
                      defaultMonth={startDate}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={disableDay}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">~</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'h-9 w-[150px] justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground',
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {endDate ? toIsoDay(endDate) : t('logs.endDate')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (!date) return;
                        setEndDate(date);
                        applyDateQuery('range', selectedDate, startDate, date);
                      }}
                      defaultMonth={endDate || startDate}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={disableDay}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : null}

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-10"
                placeholder={t('logs.searchErrorReports')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              className="h-9 shrink-0"
              onClick={() => void fetchList()}
              disabled={loading}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              {t('logs.refresh')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            {t('logs.errorReportsList', { count })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {loading ? t('common.loading') : t('logs.noErrorReports')}
            </div>
          ) : (
            rows.map((item) => (
              <button
                key={item.id || item.filename}
                type="button"
                className="flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left last:border-b-0 hover:bg-foreground/[0.04]"
                onClick={() => void openDetail(item)}
              >
                <AlertCircle
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    item.level === 'critical' ? 'text-red-600' : 'text-red-500',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'max-w-full whitespace-normal',
                        item.level === 'critical'
                          ? 'border-red-600/40 text-red-600'
                          : 'border-red-500/30 text-red-500',
                      )}
                    >
                      {item.level || 'error'}
                    </Badge>
                    {item.count > 1 ? (
                      <Badge variant="secondary" className="max-w-full whitespace-normal">
                        {t('logs.errorReportCount', { count: item.count })}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {formatReportTime(item.timestamp)}
                    </span>
                    {item.size ? (
                      <span className="text-xs text-muted-foreground">{formatBytes(item.size)}</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm break-all">{item.event}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground break-all">
                    {item.pathname}
                    {item.lineno != null ? `:${item.lineno}` : ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="glass-card shrink-0">
        <CardContent className="p-3">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {t('common.pageInfo', { current: query.page, total: totalPages })}{' '}
              ({t('common.totalRecords', { total: count })})
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuery((q) => ({ ...q, page: 1 }))}
                disabled={query.page === 1}
              >
                {t('common.firstPage')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuery((q) => ({ ...q, page: Math.max(1, q.page - 1) }))}
                disabled={query.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setQuery((q) => ({ ...q, page: Math.min(totalPages, q.page + 1) }))
                }
                disabled={query.page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuery((q) => ({ ...q, page: totalPages }))}
                disabled={query.page >= totalPages}
              >
                {t('common.lastPage')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="glass-card flex max-h-[85vh] max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle>{t('logs.errorReportDetail')}</DialogTitle>
            <DialogDescription className="sr-only">{t('logs.errorReportAriaDesc')}</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              {t('common.loading')}
            </div>
          ) : detail ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-auto">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="max-w-full whitespace-normal">
                  {String(detail.report._log_level ?? 'error')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {t('logs.errorReportTimesLabel')}: {detail.count}
                </span>
                <Button variant="outline" className="ml-auto h-9 shrink-0" onClick={() => void copyReport()}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t('common.copy')}
                </Button>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">{t('logs.errorReportEvent')}: </span>
                  <span className="break-all">{String(detail.report.event ?? '')}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">{t('logs.errorReportLocation')}: </span>
                  <span className="break-all">
                    {String(detail.report.pathname ?? '')}
                    {detail.report.lineno != null ? `:${String(detail.report.lineno)}` : ''}
                  </span>
                </p>
              </div>
              {typeof detail.report.exception === 'string' && detail.report.exception ? (
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">{t('logs.errorReportException')}</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-background/50 p-3 font-mono text-xs">
                    {detail.report.exception}
                  </pre>
                </div>
              ) : null}
              {extraFields.length > 0 ? (
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">{t('logs.errorReportExtra')}</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-background/50 p-3 font-mono text-xs">
                    {JSON.stringify(Object.fromEntries(extraFields), null, 2)}
                  </pre>
                </div>
              ) : null}
              <div>
                <p className="mb-1 text-sm text-muted-foreground">{t('logs.errorReportOccurrences')}</p>
                <ul className="space-y-1 text-sm">
                  {detail.occurrences.map((occ) => (
                    <li key={occ.filename} className="break-all font-mono text-xs">
                      {formatReportTime(occ.timestamp)} · {occ.filename}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
