import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Clock,
  Hash,
  Users,
  ScrollText,
  Activity,
  Terminal,
  Download,
  MessageCircle,
} from 'lucide-react';
import type { TraceItem } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ConsolePanel } from '@/components/ConsolePanel';
import { pageGapClass, PinnedPage } from '@/components/layout/PinnedPage';
import { TraceDateRefreshActions } from '@/components/logs/TraceDateRefreshActions';
import { formatTraceStartTime } from '@/components/logs/traceUtils';
import {
  TRACE_PAGE_SIZE,
  useTracesController,
  type TracesController,
} from '@/components/logs/useTraceControllers';

export function TracesHeaderActions({
  controller,
  className,
}: {
  controller: TracesController;
  className?: string;
}) {
  return (
    <TraceDateRefreshActions
      calendarClassName="traces-date-calendar"
      styleId="traces-calendar-overrides"
      selectedDate={controller.selectedDate}
      onSelectDate={controller.selectDate}
      dailyCounts={controller.dailyCounts}
      isLoading={controller.isLoading}
      onRefresh={() => void controller.fetchTraces()}
      className={className}
    />
  );
}

export function TracesPanel({ controller }: { controller: TracesController }) {
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

  const statusBadge = (status: TraceItem['status']) => {
    if (status === 'running') {
      return (
        <Badge
          variant="outline"
          className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900"
        >
          <Activity className="w-3 h-3 mr-1 animate-pulse" />
          {t('traces.running')}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-xs bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900"
      >
        {t('traces.completed')}
      </Badge>
    );
  };

  const isSlow = (ms: number | null) => ms !== null && ms > 7000;
  const totalPages = Math.max(1, Math.ceil(totalCount / TRACE_PAGE_SIZE) || 1);

  const sourceBadge = (trace: TraceItem) => {
    if (trace.group_id) {
      return (
        <Badge
          variant="outline"
          className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900"
        >
          <Users className="w-3 h-3 mr-1" />
          {t('traces.group') || '群聊'}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="text-xs bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-900"
      >
        <MessageCircle className="w-3 h-3 mr-1" />
        {t('traces.private') || '私聊'}
      </Badge>
    );
  };

  return (
    <>
      {/* Stats */}
      <div className={cn('grid grid-cols-2 md:grid-cols-4', pageGapClass)}>
        <Card className="glass-card border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center gap-3">
            <ScrollText className="w-7 h-7 text-primary shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-xs text-muted-foreground">{t('traces.totalTraces') || '总追踪'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="w-7 h-7 text-blue-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">
                {traces.filter((item) => item.status === 'running').length}
              </p>
              <p className="text-xs text-muted-foreground">{t('traces.running') || '执行中'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-green-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-7 h-7 text-green-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">
                {traces.filter((item) => item.status === 'completed').length}
              </p>
              <p className="text-xs text-muted-foreground">{t('traces.completed') || '已完成'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-purple-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Hash className="w-7 h-7 text-purple-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">
                {traces.reduce((sum, item) => sum + (item.log_count || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{t('traces.totalLogs') || '总日志数'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trace List */}
      <Card className="glass-card">
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            {t('traces.traceList') || '追踪列表'} ({totalCount})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {traces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('traces.noTraces') || '暂无追踪记录'}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {/* 表头 */}
              <div className="hidden md:grid grid-cols-[92px_1fr_70px_110px_160px_80px_70px_56px_56px_80px_44px] gap-3 px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border/30">
                <div className="font-medium">{t('traces.status') || '状态'}</div>
                <div className="font-medium">{t('traces.command') || '命令'}</div>
                <div className="font-medium">{t('traces.source') || '来源'}</div>
                <div className="font-medium hidden lg:flex">
                  {t('traces.triggerUser') || '触发者'}
                </div>
                <div className="font-medium hidden xl:flex">
                  {t('traces.triggerGroup') || '触发群'}
                </div>
                <div className="font-medium">{t('traces.triggerTime') || '触发时间'}</div>
                <div className="font-medium">{t('traces.duration') || '耗时'}</div>
                <div className="font-medium hidden lg:flex">{t('traces.logs') || '日志数'}</div>
                <div className="font-medium hidden xl:flex">{t('traces.error') || '错误'}</div>
                <div className="font-medium hidden lg:flex">{t('traces.traceId') || 'ID'}</div>
                <div />
              </div>
              {sortedTraces.map((trace) => {
                const isExpanded = expandedTraceId === trace.trace_id;
                return (
                  <div key={trace.trace_id} className="transition-colors">
                    {/* 桌面端列表行 */}
                    <button
                      type="button"
                      onClick={() => void handleExpandTrace(trace)}
                      className="hidden md:grid w-full text-left grid-cols-[92px_1fr_70px_110px_160px_80px_70px_56px_56px_80px_44px] items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                    >
                      {/* 状态 + 展开 */}
                      <div className="flex items-center gap-1">
                        {statusBadge(trace.status)}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>

                      {/* 命令 */}
                      <div className="truncate font-medium text-sm min-w-0">{trace.command}</div>

                      {/* 来源 */}
                      <div>{sourceBadge(trace)}</div>

                      {/* 触发者 */}
                      <div className="text-xs text-muted-foreground font-mono truncate hidden lg:block">
                        {trace.user_id}
                      </div>

                      {/* 触发群 */}
                      <div className="text-xs text-muted-foreground font-mono truncate hidden xl:block">
                        {trace.group_id || '—'}
                      </div>

                      {/* 触发时间 */}
                      <div className="text-xs text-muted-foreground">
                        {formatTraceStartTime(trace.start_time)}
                      </div>

                      {/* 耗时 */}
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

                      {/* 日志数 */}
                      <div className="text-xs text-muted-foreground hidden lg:block">
                        {trace.log_count}
                      </div>

                      {/* 错误数 */}
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

                      {/* trace_id */}
                      <div className="font-mono text-xs text-muted-foreground truncate hidden lg:block">
                        {trace.trace_id.slice(0, 8)}
                      </div>

                      {/* 下载 */}
                      <div className="flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadTrace(trace);
                          }}
                          title={t('traces.downloadTrace') || '下载追踪'}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </button>

                    {/* 移动端列表行 */}
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
                        <span className="truncate font-medium text-sm flex-1 min-w-0">
                          {trace.command}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-6">
                        {sourceBadge(trace)}
                        <span className="font-mono">{trace.user_id}</span>
                        {trace.group_id && <span className="font-mono">{trace.group_id}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTraceStartTime(trace.start_time)}
                        </span>
                        <span
                          className={cn(
                            isSlow(trace.duration_ms) &&
                              'text-red-600 dark:text-red-400 font-semibold',
                          )}
                        >
                          {trace.duration_ms !== null ? `${trace.duration_ms}ms` : '—'}
                        </span>
                        <span>
                          {trace.log_count} {t('traces.logs') || '日志'}
                        </span>
                        {trace.error_count ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900"
                          >
                            {trace.error_count} {t('traces.error') || '错误'}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 pl-6 mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDownloadTrace(trace);
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          {t('traces.downloadTrace') || '下载追踪'}
                        </Button>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div
                          className={cn(
                            'h-[28rem] overflow-hidden rounded-xl',
                            isGlass
                              ? 'backdrop-blur-md bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 shadow-lg'
                              : 'bg-card border border-border/50',
                          )}
                        >
                          {traceLoading && traceDetail?.trace_id === trace.trace_id ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                              {t('common.loading')}
                            </div>
                          ) : (
                            <ConsolePanel logs={traceLogs} autoScroll={false} className="h-full" />
                          )}
                        </div>
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

export default function TracesPage() {
  const { t } = useLanguage();
  const controller = useTracesController(true);

  return (
    <PinnedPage
      header={
        <div className="flex flex-col gap-3 md:gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 sm:overflow-x-auto">
            <h1 className="sm:whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Terminal className="w-8 h-8 shrink-0" />
              {t('traces.title') || '命令追踪'}
            </h1>
            <p className="sm:whitespace-nowrap text-muted-foreground mt-1">
              {t('traces.description') || '查看命令执行追踪日志'}
            </p>
          </div>
          <TracesHeaderActions controller={controller} />
        </div>
      }
    >
      <TracesPanel controller={controller} />
    </PinnedPage>
  );
}
