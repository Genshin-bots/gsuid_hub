import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Clock,
  ScrollText,
  Activity,
  Download,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import {
  httpTraceApi,
  type HttpTraceItem,
  type HttpTraceLog,
  type HttpTraceDetail,
  getApiErrorMessage,
} from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ConsolePanel, type LogEntry } from '@/components/ConsolePanel';
import { PinnedPage } from '@/components/layout/PinnedPage';

const METHOD_ALL = '__all__';
const STATUS_ALL = '__all__';
const PAGE_SIZE = 100;

function formatStartTime(seconds: number): string {
  if (seconds > 1_000_000_000) {
    return format(new Date(seconds * 1000), 'HH:mm:ss');
  }
  const totalSeconds = Math.floor(seconds % 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseTraceTimestamp(ts: string, dateStr: string): Date {
  try {
    const [monthDay, time] = ts.split(' ');
    const year = dateStr.split('-')[0];
    const isoStr = `${year}-${monthDay}T${time}`;
    const d = new Date(isoStr);
    if (!Number.isNaN(d.getTime())) return d;
  } catch {
    /* ignore */
  }
  return new Date();
}

function httpLogToLogEntry(log: HttpTraceLog, index: number, dateStr: string): LogEntry {
  let type: LogEntry['type'] = 'info';
  switch (log.level.toLowerCase()) {
    case 'trace':
      type = 'trace';
      break;
    case 'debug':
      type = 'debug';
      break;
    case 'info':
      type = 'info';
      break;
    case 'success':
      type = 'success';
      break;
    case 'warning':
    case 'warn':
      type = 'warning';
      break;
    case 'error':
      type = 'error';
      break;
    case 'critical':
      type = 'critical';
      break;
  }
  return {
    id: `${log.timestamp}-${index}`,
    type,
    content: log.event,
    timestamp: parseTraceTimestamp(log.timestamp, dateStr),
    plugin: log.plugin,
  };
}

function statusCodeClass(code: number | null): string {
  if (code === null) return 'text-muted-foreground';
  if (code >= 500) return 'text-red-600 dark:text-red-400 font-semibold';
  if (code >= 400) return 'text-amber-600 dark:text-amber-400 font-semibold';
  if (code >= 200 && code < 300) return 'text-green-600 dark:text-green-400';
  return 'text-muted-foreground';
}

export default function HttpTracesPage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const [traces, setTraces] = useState<HttpTraceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [traceLogs, setTraceLogs] = useState<LogEntry[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceDetail, setTraceDetail] = useState<HttpTraceDetail | null>(null);
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [method, setMethod] = useState(METHOD_ALL);
  const [pathPrefix, setPathPrefix] = useState('');
  const [statusClass, setStatusClass] = useState(STATUS_ALL);
  const [userId, setUserId] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'http-traces-calendar-overrides';
    if (document.getElementById(styleId)) return;
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      .http-traces-date-calendar .rdp-day,
      .http-traces-date-calendar .rdp-day_button {
        overflow: visible !important;
        border-radius: 8px !important;
      }
      .http-traces-date-calendar .rdp-day,
      .http-traces-date-calendar .rdp-day_button,
      .http-traces-date-calendar .rdp-cell {
        width: 2.75rem !important;
        height: 2.75rem !important;
      }
      .http-traces-date-calendar .rdp-day_button {
        font-size: 0.875rem !important;
      }
    `;
    document.head.appendChild(el);
  }, []);

  const dateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const disabledMatchers = useMemo(() => {
    const dates = Object.keys(dailyCounts).sort();
    if (dates.length === 0) return undefined;
    const minDate = new Date(`${dates[0]}T00:00:00`);
    const maxDate = new Date(`${dates[dates.length - 1]}T00:00:00`);
    return [{ before: minDate }, { after: maxDate }];
  }, [dailyCounts]);

  const fetchDailyCounts = useCallback(async () => {
    try {
      const data = await httpTraceApi.getDailyCounts(60);
      const record: Record<string, number> = {};
      for (const item of data) {
        record[item.date] = item.count;
      }
      setDailyCounts(record);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.loadFailed')));
    }
  }, [t]);

  useEffect(() => {
    fetchDailyCounts();
  }, [fetchDailyCounts]);

  useEffect(() => {
    setPage(1);
  }, [dateStr, method, pathPrefix, statusClass, userId, onlyErrors]);

  const fetchList = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const data = await httpTraceApi.getTraces({
          date: dateStr,
          page,
          per_page: PAGE_SIZE,
          method: method === METHOD_ALL ? undefined : method,
          path_prefix: pathPrefix.trim() || undefined,
          status_class: statusClass === STATUS_ALL ? undefined : statusClass,
          user_id: userId.trim() || undefined,
          errors_only: onlyErrors || undefined,
        });
        setTraces(data.rows);
        setTotalCount(data.count);
        if (data.page !== page) setPage(data.page);
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('common.loadFailed')));
        setTraces([]);
        setTotalCount(0);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [dateStr, page, method, pathPrefix, statusClass, userId, onlyErrors, t],
  );

  useEffect(() => {
    fetchList(false);
  }, [fetchList]);

  const fetchDetail = useCallback(
    async (traceId: string) => {
      setTraceLoading(true);
      try {
        const detail = await httpTraceApi.getTraceDetail(traceId, { date: dateStr });
        setTraceDetail(detail);
        setTraceLogs(detail.logs.map((log, idx) => httpLogToLogEntry(log, idx, dateStr)));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('common.loadFailed')));
        setTraceLogs([]);
        setTraceDetail(null);
      } finally {
        setTraceLoading(false);
      }
    },
    [dateStr, t],
  );

  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      fetchList(true);
      if (expandedTraceId && traceDetail?.status === 'running') {
        void fetchDetail(expandedTraceId);
      }
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchList, fetchDetail, expandedTraceId, traceDetail?.status]);

  const sortedTraces = useMemo(
    () => [...traces].sort((a, b) => b.start_time - a.start_time),
    [traces],
  );

  const handleExpandTrace = async (trace: HttpTraceItem) => {
    if (expandedTraceId === trace.trace_id) {
      setExpandedTraceId(null);
      setTraceLogs([]);
      setTraceDetail(null);
      return;
    }
    setExpandedTraceId(trace.trace_id);
    setTraceDetail(null);
    setTraceLogs([]);
    await fetchDetail(trace.trace_id);
  };

  const statusBadge = (status: HttpTraceItem['status']) => {
    if (status === 'running') {
      return (
        <Badge
          variant="outline"
          className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900"
        >
          <Activity className="w-3 h-3 mr-1 animate-pulse" />
          {t('httpTraces.running')}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-xs bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900"
      >
        {t('httpTraces.completed')}
      </Badge>
    );
  };

  const handleDownloadTrace = useCallback(
    async (trace: HttpTraceItem) => {
      try {
        const detail = await httpTraceApi.getTraceDetail(trace.trace_id, { date: dateStr });
        const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `http-trace-${trace.trace_id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('common.loadFailed')));
      }
    },
    [dateStr, t],
  );

  const isSlow = (ms: number | null) => ms !== null && ms > 1000;
  const httpErrorCount = traces.filter(
    (row) => row.status_code !== null && row.status_code >= 400,
  ).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1);
  const gridClass = 'grid-cols-[92px_72px_minmax(0,1fr)_56px_90px_80px_70px_56px_56px_80px_44px]';
  const goPage = (next: number) => {
    setExpandedTraceId(null);
    setPage(next);
  };

  return (
    <PinnedPage
      className="gap-4"
      bodyClassName="space-y-4"
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Globe className="w-8 h-8 shrink-0" />
              {t('httpTraces.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">
              {t('httpTraces.description')}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 self-end sm:self-auto items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('justify-start text-left font-normal')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'yyyy-MM-dd')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
                <div className="http-traces-date-calendar">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) setSelectedDate(date);
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
              onClick={() => fetchList(false)}
              disabled={isLoading}
              className="whitespace-nowrap"
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
              {t('logs.refresh')}
            </Button>
            <div className="flex items-center gap-2 h-9 px-2">
              <Switch
                id="http-trace-auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="http-trace-auto-refresh" className="text-sm whitespace-nowrap">
                {t('httpTraces.autoRefresh')}
              </Label>
            </div>
          </div>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-9 w-[8.5rem]">
              <SelectValue placeholder={t('httpTraces.filterMethod')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={METHOD_ALL}>{t('httpTraces.filterAll')}</SelectItem>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-9 w-[14rem]"
            placeholder={t('httpTraces.filterPath')}
            value={pathPrefix}
            onChange={(e) => setPathPrefix(e.target.value)}
          />
          <Select value={statusClass} onValueChange={setStatusClass}>
            <SelectTrigger className="h-9 w-[7.5rem]">
              <SelectValue placeholder={t('httpTraces.filterStatusClass')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={STATUS_ALL}>{t('httpTraces.filterAll')}</SelectItem>
              <SelectItem value="2xx">{t('httpTraces.status2xx')}</SelectItem>
              <SelectItem value="3xx">{t('httpTraces.status3xx')}</SelectItem>
              <SelectItem value="4xx">{t('httpTraces.status4xx')}</SelectItem>
              <SelectItem value="5xx">{t('httpTraces.status5xx')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 h-9 px-1">
            <Switch
              id="http-trace-only-errors"
              checked={onlyErrors}
              onCheckedChange={setOnlyErrors}
            />
            <Label htmlFor="http-trace-only-errors" className="text-sm whitespace-nowrap">
              {t('httpTraces.onlyErrors')}
            </Label>
          </div>
          <Input
            className="h-9 w-[10rem] hidden xl:flex"
            placeholder={t('httpTraces.filterUser')}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center gap-3">
            <ScrollText className="w-7 h-7 text-primary shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-xs text-muted-foreground">{t('httpTraces.totalTraces')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-7 h-7 text-blue-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">
                {traces.filter((row) => row.status === 'running').length}
              </p>
              <p className="text-xs text-muted-foreground">{t('httpTraces.running')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-7 h-7 text-green-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">
                {traces.filter((row) => row.status === 'completed').length}
              </p>
              <p className="text-xs text-muted-foreground">{t('httpTraces.completed')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-red-500">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-red-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">{httpErrorCount}</p>
              <p className="text-xs text-muted-foreground">{t('httpTraces.httpErrors')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            {t('httpTraces.traceList')} ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {traces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('httpTraces.noTraces')}</div>
          ) : (
            <div className="divide-y divide-border/30">
              <div
                className={cn(
                  'hidden md:grid gap-3 px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border/30',
                  gridClass,
                )}
              >
                <div className="font-medium">{t('httpTraces.status')}</div>
                <div className="font-medium">{t('httpTraces.method')}</div>
                <div className="font-medium">{t('httpTraces.path')}</div>
                <div className="font-medium">{t('httpTraces.statusCode')}</div>
                <div className="font-medium">{t('httpTraces.user')}</div>
                <div className="font-medium">{t('httpTraces.triggerTime')}</div>
                <div className="font-medium">{t('httpTraces.duration')}</div>
                <div className="font-medium hidden lg:flex">{t('httpTraces.logs')}</div>
                <div className="font-medium hidden xl:flex">{t('httpTraces.error')}</div>
                <div className="font-medium hidden lg:flex">{t('httpTraces.traceId')}</div>
                <div />
              </div>
              {sortedTraces.map((trace) => {
                const isExpanded = expandedTraceId === trace.trace_id;
                const pathTitle = trace.query_redacted
                  ? `${trace.path}?${trace.query_redacted}`
                  : trace.path;
                return (
                  <div key={trace.trace_id} className="transition-colors">
                    <button
                      type="button"
                      onClick={() => handleExpandTrace(trace)}
                      className={cn(
                        'hidden md:grid w-full text-left items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
                        gridClass,
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {statusBadge(trace.status)}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div>
                        <Badge variant="outline" className="text-xs font-mono">
                          {trace.method}
                        </Badge>
                      </div>
                      <div className="truncate font-mono text-sm min-w-0" title={pathTitle}>
                        {trace.path}
                      </div>
                      <div className={cn('text-xs font-mono', statusCodeClass(trace.status_code))}>
                        {trace.status_code ?? '—'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {trace.user_name || trace.user_id || t('httpTraces.emptyUser')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatStartTime(trace.start_time)}
                      </div>
                      <div
                        className={cn(
                          'text-xs',
                          isSlow(trace.duration_ms)
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : 'text-muted-foreground',
                        )}
                      >
                        {trace.duration_ms !== null ? `${trace.duration_ms}ms` : '—'}
                      </div>
                      <div className="text-xs text-muted-foreground hidden lg:block">
                        {trace.log_count}
                      </div>
                      <div className="hidden xl:block">
                        {trace.error_count ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900"
                          >
                            {trace.error_count}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground truncate hidden lg:block">
                        {trace.trace_id.slice(0, 8)}
                      </div>
                      <div className="flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadTrace(trace);
                          }}
                          title={t('httpTraces.downloadTrace')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExpandTrace(trace)}
                      className="md:hidden w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {statusBadge(trace.status)}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <Badge variant="outline" className="text-xs font-mono">
                          {trace.method}
                        </Badge>
                        <span
                          className="truncate font-mono text-sm flex-1 min-w-0"
                          title={pathTitle}
                        >
                          {trace.path}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-6">
                        <span className={cn('font-mono', statusCodeClass(trace.status_code))}>
                          {trace.status_code ?? '—'}
                        </span>
                        <span
                          className={cn(
                            isSlow(trace.duration_ms) &&
                              'text-red-600 dark:text-red-400 font-semibold',
                          )}
                        >
                          {trace.duration_ms !== null ? `${trace.duration_ms}ms` : '—'}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3">
                        <div
                          className={cn(
                            'rounded-xl p-3 space-y-3',
                            isGlass
                              ? 'backdrop-blur-md bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20'
                              : 'bg-muted/30 border border-border/50',
                          )}
                        >
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">
                              {t('httpTraces.input')}
                            </div>
                            <div className="font-mono text-sm mt-1 break-all">
                              {trace.method} {trace.path}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground mt-1 break-all">
                              {t('httpTraces.query')}:{' '}
                              {trace.query_redacted || t('httpTraces.emptyQuery')}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground mt-1">
                              {t('httpTraces.clientIp')}:{' '}
                              {traceDetail?.client_ip ?? trace.client_ip}
                              {(traceDetail?.client_request_id || null) && (
                                <span className="ml-3">
                                  {t('httpTraces.clientRequestId')}:{' '}
                                  {traceDetail?.client_request_id}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground">
                              {t('httpTraces.output')}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground mt-1">
                              {trace.status_code ?? '—'}
                              {trace.duration_ms !== null ? ` · ${trace.duration_ms}ms` : ''}
                              {traceDetail?.response_content_type
                                ? ` · ${traceDetail.response_content_type}`
                                : ''}
                            </div>
                            {traceLoading && expandedTraceId === trace.trace_id ? (
                              <div className="py-4 text-muted-foreground text-xs flex items-center">
                                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                {t('common.loading')}
                              </div>
                            ) : (
                              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background/60 p-2 text-xs font-mono whitespace-pre-wrap break-all">
                                {traceDetail?.response_preview || t('httpTraces.emptyOutput')}
                              </pre>
                            )}
                          </div>
                        </div>
                        {traceLoading &&
                        expandedTraceId === trace.trace_id ? null : traceLogs.length > 0 ? (
                          <div
                            className={cn(
                              'h-[28rem] overflow-hidden rounded-xl',
                              isGlass
                                ? 'backdrop-blur-md bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 shadow-lg'
                                : 'bg-card border border-border/50',
                            )}
                          >
                            <ConsolePanel logs={traceLogs} autoScroll={false} className="h-full" />
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground px-1">
                            {t('httpTraces.noInternalLogs')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="glass-card shrink-0">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t('common.pageInfo')
                .replace('{current}', String(page))
                .replace('{total}', String(totalPages))}{' '}
              ({t('common.totalRecords').replace('{total}', totalCount.toLocaleString())})
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => goPage(1)} disabled={page === 1}>
                {t('common.firstPage')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goPage(totalPages)}
                disabled={page >= totalPages}
              >
                {t('common.lastPage')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PinnedPage>
  );
}
