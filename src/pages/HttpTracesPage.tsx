import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import {
  RefreshCw,
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
import type { HttpTraceItem } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ConsolePanel } from '@/components/ConsolePanel';
import { pageGapClass, PinnedPage } from '@/components/layout/PinnedPage';
import { TraceDateRefreshActions } from '@/components/logs/TraceDateRefreshActions';
import { formatTraceStartTime } from '@/components/logs/traceUtils';
import {
  HTTP_METHOD_ALL,
  HTTP_STATUS_ALL,
  TRACE_PAGE_SIZE,
  useHttpTracesController,
  type HttpTracesController,
} from '@/components/logs/useTraceControllers';

function statusCodeClass(code: number | null): string {
  if (code === null) return 'text-muted-foreground';
  if (code >= 500) return 'text-red-600 dark:text-red-400 font-semibold';
  if (code >= 400) return 'text-amber-600 dark:text-amber-400 font-semibold';
  if (code >= 200 && code < 300) return 'text-green-600 dark:text-green-400';
  return 'text-muted-foreground';
}

export function HttpTracesHeaderActions({
  controller,
  className,
}: {
  controller: HttpTracesController;
  className?: string;
}) {
  return (
    <TraceDateRefreshActions
      calendarClassName="http-traces-date-calendar"
      styleId="http-traces-calendar-overrides"
      selectedDate={controller.selectedDate}
      onSelectDate={controller.selectDate}
      dailyCounts={controller.dailyCounts}
      isLoading={controller.isLoading}
      onRefresh={() => void controller.fetchList(false)}
      className={className}
    />
  );
}

export function HttpTracesFilters({ controller }: { controller: HttpTracesController }) {
  const { t } = useLanguage();
  const {
    method,
    updateMethod,
    statusClass,
    updateStatusClass,
    pathPrefix,
    updatePathPrefix,
    onlyErrors,
    updateOnlyErrors,
    autoRefresh,
    setAutoRefresh,
    userId,
    updateUserId,
  } = controller;

  return (
    /* 窄屏 grid-cols-2 两列铺满（select/select → 路径整行 → 两个开关并排），
       桌面回到 flex-wrap 一行；自动刷新挪进筛选行，避免在标题行独占一行留半行空白 */
    <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
      <Select value={method} onValueChange={updateMethod}>
        <SelectTrigger className={cn(tabToolbarControlClass, 'w-full md:w-[8.5rem]')}>
          <SelectValue placeholder={t('httpTraces.filterMethod')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={HTTP_METHOD_ALL}>{t('httpTraces.filterAll')}</SelectItem>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusClass} onValueChange={updateStatusClass}>
        <SelectTrigger className={cn(tabToolbarControlClass, 'w-full md:w-[7.5rem]')}>
          <SelectValue placeholder={t('httpTraces.filterStatusClass')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={HTTP_STATUS_ALL}>{t('httpTraces.filterAll')}</SelectItem>
          <SelectItem value="2xx">{t('httpTraces.status2xx')}</SelectItem>
          <SelectItem value="3xx">{t('httpTraces.status3xx')}</SelectItem>
          <SelectItem value="4xx">{t('httpTraces.status4xx')}</SelectItem>
          <SelectItem value="5xx">{t('httpTraces.status5xx')}</SelectItem>
        </SelectContent>
      </Select>
      <Input
        className={cn(tabToolbarControlClass, 'col-span-2 w-full md:col-span-1 md:w-[14rem]')}
        placeholder={t('httpTraces.filterPath')}
        value={pathPrefix}
        onChange={(e) => updatePathPrefix(e.target.value)}
      />
      <div className={cn(tabToolbarControlClass, 'flex items-center gap-2 px-3')}>
        <Switch
          id="http-trace-only-errors"
          checked={onlyErrors}
          onCheckedChange={updateOnlyErrors}
        />
        <Label htmlFor="http-trace-only-errors" className="text-sm whitespace-nowrap">
          {t('httpTraces.onlyErrors')}
        </Label>
      </div>
      <div className={cn(tabToolbarControlClass, 'flex items-center gap-2 px-3')}>
        <Switch
          id="http-trace-auto-refresh"
          checked={autoRefresh}
          onCheckedChange={setAutoRefresh}
        />
        <Label htmlFor="http-trace-auto-refresh" className="text-sm whitespace-nowrap">
          {t('httpTraces.autoRefresh')}
        </Label>
      </div>
      <Input
        className={cn(tabToolbarControlClass, 'w-[10rem] hidden xl:flex')}
        placeholder={t('httpTraces.filterUser')}
        value={userId}
        onChange={(e) => updateUserId(e.target.value)}
      />
    </div>
  );
}

export function HttpTracesPanel({
  controller,
  showFilters = true,
}: {
  controller: HttpTracesController;
  showFilters?: boolean;
}) {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style !== 'solid';
  const {
    traces,
    sortedTraces,
    totalCount,
    page,
    expandedTraceId,
    traceLogs,
    traceLoading,
    traceDetail,
    handleExpandTrace,
    handleDownloadTrace,
    goPage,
  } = controller;

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

  const isSlow = (ms: number | null) => ms !== null && ms > 1000;
  const httpErrorCount = traces.filter(
    (row) => row.status_code !== null && row.status_code >= 400,
  ).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / TRACE_PAGE_SIZE) || 1);
  const gridClass = 'grid-cols-[92px_72px_minmax(0,1fr)_56px_90px_80px_70px_56px_56px_80px_44px]';

  return (
    <>
      {showFilters ? <HttpTracesFilters controller={controller} /> : null}

      <div className={cn('grid grid-cols-2 md:grid-cols-4', pageGapClass)}>
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
                      onClick={() => void handleExpandTrace(trace)}
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
                        {formatTraceStartTime(trace.start_time)}
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
                      onClick={() => void handleExpandTrace(trace)}
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {t('common.pageInfo')
                .replace('{current}', String(page))
                .replace('{total}', String(totalPages))}{' '}
              ({t('common.totalRecords').replace('{total}', totalCount.toLocaleString())})
            </div>
            <div className="flex items-center justify-center gap-2">
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
    </>
  );
}

export default function HttpTracesPage() {
  const { t } = useLanguage();
  const controller = useHttpTracesController({ enabled: true, active: true });

  return (
    <PinnedPage
      header={
        <div className="flex flex-col gap-3 md:gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 sm:overflow-x-auto">
            <h1 className="sm:whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Globe className="w-8 h-8 shrink-0" />
              {t('httpTraces.title')}
            </h1>
            <p className="sm:whitespace-nowrap text-muted-foreground mt-1">
              {t('httpTraces.description')}
            </p>
          </div>
          <HttpTracesHeaderActions controller={controller} />
        </div>
      }
      toolbar={<HttpTracesFilters controller={controller} />}
    >
      <HttpTracesPanel controller={controller} showFilters={false} />
    </PinnedPage>
  );
}
