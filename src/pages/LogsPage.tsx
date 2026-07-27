import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Search, RefreshCw, Download, ChevronDown, AlertCircle, AlertTriangle, Info, Bug, FileText, Calendar, Eye, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { logsApi, LogContextLog, LogContextResponse } from '@/lib/api';
import LogsConfigDialog from '@/components/logs/LogsConfigDialog';
import { toast } from 'sonner';
import { StructuredDataViewer } from '@/components/StructuredDataViewer';
import { useLanguage } from '@/contexts/LanguageContext';
import React, { memo } from 'react';
import { PinnedPage } from '@/components/layout/PinnedPage';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'all';
type DateMode = 'single' | 'range';

interface LogEntry {
  id?: number;
  log_id?: number;
  date?: string;
  level: string;
  source: string;
  message: string;
  timestamp: string;
  details?: { stack?: string };
}

const levelIcons = {
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
  debug: Bug,
};

const levelColors = {
  info: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  warn: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-500 border-red-500/30',
  debug: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// 日志条目组件 - 使用memo优化
const LogEntryItem = memo(function LogEntryItem({
  log,
  isExpanded,
  onToggle,
  onViewContext,
}: {
  log: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onViewContext: () => void;
}) {
  const Icon = levelIcons[log.level as keyof typeof levelIcons] || Info;
  const colorClass = levelColors[log.level as keyof typeof levelColors] || levelColors.info;
  
  return (
    <div
      className={cn(
        "p-3 rounded-lg border mx-4 mb-2 transition-all",
        colorClass,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {log.source || 'core'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {log.timestamp ? new Date(log.timestamp).toLocaleString('zh-CN') : ''}
            </span>
          </div>
          <div className="mt-1 text-sm break-all">
            <StructuredDataViewer data={log.message} />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onViewContext();
            }}
            title="查看上下文"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {log.details && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform",
                  isExpanded && 'rotate-180'
                )}
              />
            </Button>
          )}
        </div>
      </div>
      
      {log.details && isExpanded && (
        <div className="mt-3 pt-3 border-t border-current/20">
          <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono bg-background/50 p-2 rounded">
            {log.details.stack}
          </pre>
        </div>
      )}
    </div>
  );
});

// 上下文日志条目组件
const ContextLogItem = memo(function ContextLogItem({
  log,
  isTarget,
}: {
  log: LogContextLog;
  isTarget?: boolean;
}) {
  const Icon = levelIcons[log.level as keyof typeof levelIcons] || Info;
  const colorClass = levelColors[log.level as keyof typeof levelColors] || levelColors.info;
  
  return (
    <div
      className={cn(
        "p-2.5 rounded-lg border-2 transition-all text-sm",
        colorClass,
        isTarget && 'border-primary shadow-[0_0_0_2px_hsl(var(--primary))]'
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs py-0">
              {log.source || 'core'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {log.timestamp ? new Date(log.timestamp).toLocaleString('zh-CN') : ''}
            </span>
            {isTarget && (
              <Badge variant="default" className="text-xs py-0">目标</Badge>
            )}
          </div>
          <div className="mt-0.5 text-sm break-all">
            <StructuredDataViewer data={log.message} />
          </div>
        </div>
      </div>
    </div>
  );
});

export default function LogsPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [logsConfigOpen, setLogsConfigOpen] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>('single');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [infoCount, setInfoCount] = useState(0);
  const [warnCount, setWarnCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [debugCount, setDebugCount] = useState(0);
  
  // 增量更新相关状态
  const [lastLogId, setLastLogId] = useState<number | null>(null);
  const [hasNewLogs, setHasNewLogs] = useState(false);
  
  // 上下文查看相关状态
  const [contextOpen, setContextOpen] = useState(false);
  const [contextData, setContextData] = useState<LogContextResponse | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const contextScrollRef = useRef<HTMLDivElement>(null);
  
  // 获取当前日期字符串（根据模式）
  const getDateParams = useCallback(() => {
    if (dateMode === 'range' && startDate && endDate) {
      return {
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      };
    }
    const dateStr = selectedDate.toISOString().split('T')[0];
    return { date: dateStr };
  }, [dateMode, selectedDate, startDate, endDate]);

  // Fetch logs and stats from API
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    const dateParams = getDateParams();
    try {
      // Fetch stats first
      const statsData = await logsApi.getStats({
        ...dateParams,
        level: levelFilter === 'all' ? undefined : levelFilter,
        search: searchTerm || undefined,
        per_page: perPage,
      });
      setTotalCount(statsData.total);
      setTotalPages(statsData.total_pages);
      if (statsData.info_count !== undefined) setInfoCount(statsData.info_count);
      if (statsData.warn_count !== undefined) setWarnCount(statsData.warn_count);
      if (statsData.error_count !== undefined) setErrorCount(statsData.error_count);
      if (statsData.debug_count !== undefined) setDebugCount(statsData.debug_count);
      
      // Then fetch logs
      const data = await logsApi.getLogs({
        ...dateParams,
        level: levelFilter === 'all' ? undefined : levelFilter,
        search: searchTerm || undefined,
        page: currentPage,
        per_page: perPage,
      });
      
      // 后端 timestamp 只返回 "MM-DD HH:mm:ss"，需要补全年份才能正确解析
      // 优先使用后端返回的 date 字段中的年份，否则从请求参数中提取
      setLogs(data.rows.map(row => {
        const year = row.date ? row.date.split('-')[0] : (dateParams.date ? dateParams.date.split('-')[0] : new Date().getFullYear().toString());
        return {
          ...row,
          timestamp: row.timestamp && !row.timestamp.includes(year) ? `${year}-${row.timestamp}` : row.timestamp,
        };
      }));
      
      // 记录最后一条日志的ID用于增量更新
      if (data.rows.length > 0 && data.rows[0].id) {
        setLastLogId(data.rows[0].id);
      }
      setHasNewLogs(false);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      const errorMessage = error instanceof Error ? error.message : t('common.loadFailed');
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [getDateParams, levelFilter, currentPage, perPage, searchTerm, t]);
  
  // 增量获取新日志 - 只获取比lastLogId更新的日志
  const fetchIncrementalLogs = useCallback(async () => {
    // 只在第一页且没有搜索条件且单日期模式时进行增量更新
    if (currentPage !== 1 || searchTerm || dateMode !== 'single') return;
    
    const dateParams = getDateParams();
    try {
      // 获取最新统计
      const statsData = await logsApi.getStats({
        ...dateParams,
        level: levelFilter === 'all' ? undefined : levelFilter,
        per_page: perPage,
      });
      
      // 检查是否有新日志
      if (statsData.total > totalCount) {
        setHasNewLogs(true);
        setTotalCount(statsData.total);
        if (statsData.info_count !== undefined) setInfoCount(statsData.info_count);
        if (statsData.warn_count !== undefined) setWarnCount(statsData.warn_count);
        if (statsData.error_count !== undefined) setErrorCount(statsData.error_count);
        if (statsData.debug_count !== undefined) setDebugCount(statsData.debug_count);
      }
    } catch (error) {
      console.error('Failed to fetch incremental logs:', error);
    }
  }, [getDateParams, levelFilter, perPage, currentPage, searchTerm, dateMode, totalCount]);

  // Fetch logs when filters change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 60 seconds - 使用增量更新代替全量刷新
  useEffect(() => {
    const interval = setInterval(() => {
      fetchIncrementalLogs();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchIncrementalLogs]);

  // Fetch available dates on mount
  useEffect(() => {
    const fetchAvailableDates = async () => {
      try {
        const dates = await logsApi.getAvailableDates();
        setAvailableDates(dates);
        
        if (dates.length > 0) {
          const selectedDateStr = selectedDate.toISOString().split('T')[0];
          if (!dates.includes(selectedDateStr)) {
            const mostRecentDate = new Date(dates[0]);
            setSelectedDate(mostRecentDate);
          }
        }
      } catch (error) {
        console.error('Failed to fetch available dates:', error);
      }
    };
    
    fetchAvailableDates();
  }, []);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1); // 搜索时重置到第一页
      fetchLogs();
    }, 300); // 300ms防抖
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleRefresh = () => {
    fetchLogs();
    toast.success(t('logs.refreshSuccess') || 'Logs updated');
  };

  const handleExport = () => {
    const logText = logs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(t('logs.exportSuccess').replace('{count}', String(logs.length)));
  };

  const toggleExpand = (id: number) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 查看日志上下文
  const handleViewContext = async (log: LogEntry) => {
    if (!log.log_id || !log.date) {
      toast.error(t('logs.contextNotAvailable') || 'Context not available for this log');
      return;
    }
    
    setContextOpen(true);
    setContextLoading(true);
    setContextData(null);
    
    try {
      const data = await logsApi.getContext({
        log_id: log.log_id!,
        date: log.date!,
        before: 10,
        after: 10,
      });
      setContextData(data);
    } catch (error) {
      console.error('Failed to fetch log context:', error);
      toast.error(t('logs.contextLoadFailed') || 'Failed to load log context');
      setContextOpen(false);
    } finally {
      setContextLoading(false);
    }
  };

  // 加载更多上下文（前/后）
  const handleLoadMoreContext = async (direction: 'before' | 'after') => {
    if (!contextData) return;
    
    try {
      if (direction === 'before' && contextData.has_more_before) {
        const firstLogId = contextData.before_logs[0]?.log_id;
        if (firstLogId === undefined) return;
        const data = await logsApi.getContext({
          log_id: firstLogId,
          date: contextData.target.date,
          before: 10,
          after: 0,
        });
        setContextData(prev => prev ? {
          ...prev,
          before_logs: [...data.before_logs, ...prev.before_logs],
          has_more_before: data.has_more_before,
          before_count: prev.before_count + data.before_count,
        } : null);
      } else if (direction === 'after' && contextData.has_more_after) {
        const lastLogId = contextData.after_logs[contextData.after_logs.length - 1]?.log_id;
        if (lastLogId === undefined) return;
        const data = await logsApi.getContext({
          log_id: lastLogId,
          date: contextData.target.date,
          before: 0,
          after: 10,
        });
        setContextData(prev => prev ? {
          ...prev,
          after_logs: [...prev.after_logs, ...data.after_logs],
          has_more_after: data.has_more_after,
          after_count: prev.after_count + data.after_count,
        } : null);
      }
    } catch (error) {
      console.error('Failed to load more context:', error);
      toast.error(t('logs.contextLoadFailed') || 'Failed to load more context');
    }
  };

  // 切换日期模式时重置分页
  const handleDateModeChange = (mode: DateMode) => {
    setDateMode(mode);
    setCurrentPage(1);
    if (mode === 'range' && !startDate) {
      setStartDate(selectedDate);
    }
  };

  return (
    <PinnedPage
      className="gap-4"
      bodyClassName="space-y-4"
      header={
        /* Header */
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <FileText className="w-8 h-8 shrink-0" />
              {t('logs.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">{t('logs.description')}</p>
          </div>

          <div className="flex flex-wrap justify-end gap-2 self-end sm:self-auto">
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading} className="whitespace-nowrap">
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              {t('logs.refresh')}
            </Button>
            <Button variant="outline" onClick={handleExport} className="whitespace-nowrap">
              <Download className="w-4 h-4 mr-2" />
              {t('logs.export')}
            </Button>
            <Button variant="outline" onClick={() => setLogsConfigOpen(true)} className="whitespace-nowrap">
              <FileText className="w-4 h-4 mr-2" />
              {t('logsConfig.toolbar')}
            </Button>
          </div>
        </div>
      }
    >
      <LogsConfigDialog open={logsConfigOpen} onOpenChange={setLogsConfigOpen} />
      {/* Stats - 固定高度 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
        <Card className="glass-card border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="w-7 h-7 text-blue-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">{totalCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t('logs.totalLogs')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="w-7 h-7 text-blue-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">{infoCount}</p>
              <p className="text-xs text-muted-foreground">{t('logs.info')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-l-4 border-l-yellow-500">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-yellow-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">{warnCount}</p>
              <p className="text-xs text-muted-foreground">{t('logs.warn')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-l-4 border-l-red-500">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-7 h-7 text-red-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">{errorCount}</p>
              <p className="text-xs text-muted-foreground">{t('logs.errorLog')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-l-4 border-l-gray-500">
          <CardContent className="p-4 flex items-center gap-3">
            <Bug className="w-7 h-7 text-gray-500 shrink-0" strokeWidth={1.5} />
            <div>
              <p className="text-2xl font-bold">{debugCount}</p>
              <p className="text-xs text-muted-foreground">{t('logs.debug')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters - 固定高度 */}
      <Card className="glass-card shrink-0">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Date Mode Toggle */}
            <Tabs value={dateMode} onValueChange={(v) => handleDateModeChange(v as DateMode)}>
              <TabsList>
                <TabsTrigger value="single">{t('logs.singleDate') || '单日期'}</TabsTrigger>
                <TabsTrigger value="range">{t('logs.dateRange') || '日期范围'}</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Date Picker(s) */}
            {dateMode === 'single' ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "yyyy-MM-dd") : t('logs.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                        setCurrentPage(1);
                      }
                    }}
                    defaultMonth={selectedDate}
                    initialFocus
                    className="pointer-events-auto"
                    disabled={(date) => {
                      const dateStr = date.toISOString().split('T')[0];
                      return availableDates.length > 0 && !availableDates.includes(dateStr);
                    }}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[150px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "yyyy-MM-dd") : t('logs.startDate') || '开始日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date) {
                          setStartDate(date);
                          setCurrentPage(1);
                        }
                      }}
                      defaultMonth={startDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">~</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[150px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "yyyy-MM-dd") : t('logs.endDate') || '结束日期'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        if (date) {
                          setEndDate(date);
                          setCurrentPage(1);
                        }
                      }}
                      defaultMonth={endDate || startDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('logs.searchLogs')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Tabs value={levelFilter} onValueChange={(v) => setLevelFilter(v as LogLevel)}>
              <TabsList>
                <TabsTrigger value="all">{t('logs.all')}</TabsTrigger>
                <TabsTrigger value="error" className="text-red-500">{t('logs.errorLog')}</TabsTrigger>
                <TabsTrigger value="warn" className="text-yellow-500">{t('logs.warn')}</TabsTrigger>
                <TabsTrigger value="info" className="text-blue-500">{t('logs.info')}</TabsTrigger>
                <TabsTrigger value="debug" className="text-gray-500">{t('logs.debug')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* New Logs Notification */}
      {hasNewLogs && (
        <div className="shrink-0">
          <div
            className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-primary/20 transition-colors"
            onClick={handleRefresh}
          >
            <span className="text-sm text-primary font-medium">
              {t('logs.newLogsAvailable') || '有新日志可用，点击刷新查看'}
            </span>
            <RefreshCw className="w-4 h-4 text-primary" />
          </div>
        </div>
      )}

      {/* Log List */}
      <Card className="glass-card">
        <CardHeader className="py-3">
          <CardTitle className="text-base">{t('logs.logList').replace('{count}', String(logs.length))}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('logs.noMatchingLogs')}
            </div>
          ) : (
            logs.map((log) => (
              <LogEntryItem
                key={log.id ?? log.log_id ?? Math.random()}
                log={log}
                isExpanded={expandedLogs.has(log.id ?? 0)}
                onToggle={() => log.details && toggleExpand(log.id ?? 0)}
                onViewContext={() => handleViewContext(log)}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Pagination - 固定高度 */}
      <Card className="glass-card shrink-0">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {t('common.pageInfo').replace('{current}', currentPage.toString()).replace('{total}', totalPages.toString())} ({t('common.totalRecords').replace('{total}', totalCount.toLocaleString())})
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                {t('common.firstPage')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
              >
                {t('common.lastPage')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Context Dialog */}
      <Dialog open={contextOpen} onOpenChange={setContextOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {t('logs.contextTitle') || '日志上下文'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('logs.contextAriaDesc')}
            </DialogDescription>
          </DialogHeader>
          
          {contextLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">{t('common.loading')}</span>
            </div>
          ) : contextData ? (
            <div ref={contextScrollRef} className="flex-1 overflow-auto space-y-2 px-2 py-1">
              {/* Load More Before */}
              {contextData.has_more_before && (
                <div className="flex justify-center py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLoadMoreContext('before')}
                    className="text-xs text-muted-foreground"
                  >
                    <ChevronUp className="w-3 h-3 mr-1" />
                    {t('logs.loadMoreBefore') || '加载更早的日志'}
                  </Button>
                </div>
              )}
              
              {/* Before Logs */}
              {contextData.before_logs.map((log) => (
                <ContextLogItem key={`before-${log.log_id}`} log={log} />
              ))}
              
              {/* Target Log */}
              <ContextLogItem log={contextData.target} isTarget />
              
              {/* After Logs */}
              {contextData.after_logs.map((log) => (
                <ContextLogItem key={`after-${log.log_id}`} log={log} />
              ))}
              
              {/* Load More After */}
              {contextData.has_more_after && (
                <div className="flex justify-center py-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLoadMoreContext('after')}
                    className="text-xs text-muted-foreground"
                  >
                    <ChevronDown className="w-3 h-3 mr-1" />
                    {t('logs.loadMoreAfter') || '加载更晚的日志'}
                  </Button>
                </div>
              )}
              
              {/* Context Info */}
              <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                {(t('logs.contextInfo') || '当天共 {total} 条日志，当前显示前 {before} 条 + 后 {after} 条')
                  .replace('{total}', String(contextData.total_in_date))
                  .replace('{before}', String(contextData.before_count))
                  .replace('{after}', String(contextData.after_count))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
