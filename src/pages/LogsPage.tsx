import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Search, RefreshCw, Download, ChevronDown, AlertCircle, AlertTriangle, Info, Bug, Loader2, FileText, Calendar } from 'lucide-react';
import { logsApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { StructuredDataViewer } from '@/components/StructuredDataViewer';
import { useLanguage } from '@/contexts/LanguageContext';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'all';

interface LogEntry {
  id?: number;
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

export default function LogsPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [infoCount, setInfoCount] = useState(0);
  const [warnCount, setWarnCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [debugCount, setDebugCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch logs and stats from API
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    const dateStr = selectedDate.toISOString().split('T')[0];
    try {
      // Fetch stats first
      const statsData = await logsApi.getStats({
        date: dateStr,
        level: levelFilter === 'all' ? undefined : levelFilter,
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
        date: dateStr,
        level: levelFilter === 'all' ? undefined : levelFilter,
        page: currentPage,
        per_page: perPage,
      });
      setLogs(data.rows);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      const errorMessage = error instanceof Error ? error.message : t('common.loadFailed');
      toast({
        title: t('common.loadFailed'),
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, levelFilter, currentPage, perPage]);

  // Fetch logs when filters change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Fetch available dates on mount
  useEffect(() => {
    const fetchAvailableDates = async () => {
      try {
        const dates = await logsApi.getAvailableDates();
        setAvailableDates(dates);
        
        // If selected date is not available, select the most recent available date
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

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    return logs.filter((log) =>
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);


  const handleRefresh = () => {
    fetchLogs();
    toast({ title: t('common.success'), description: t('logs.refreshSuccess') || 'Logs updated' });
  };

  const handleExport = () => {
    const logText = filteredLogs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: t('common.success'), description: `Exported ${filteredLogs.length} logs` });
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

 const currentErrorCount = logs.filter((l) => l.level === 'error').length;
 const currentWarnCount = logs.filter((l) => l.level === 'warn').length;
 const currentDebugCount = logs.filter((l) => l.level === 'debug').length;

 return (
   <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="w-8 h-8" />
            {t('logs.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('logs.description')}</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('logs.refresh')}
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            {t('logs.export')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t('logs.totalLogs')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{infoCount}</p>
              <p className="text-xs text-muted-foreground">{t('logs.info')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{warnCount}</p>
              <p className="text-xs text-muted-foreground">{t('logs.warn')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{errorCount}</p>
              <p className="text-xs text-muted-foreground">{t('logs.errorLog')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
              <Bug className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{debugCount}</p>
              <p className="text-xs text-muted-foreground">{t('logs.debug')}</p>
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Date Picker */}
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
                      setCurrentPage(1); // Reset to first page when date changes
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
            
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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

      {/* Log List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>日志列表 ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]" ref={scrollRef}>
            <div className="space-y-1 p-4">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t('logs.noMatchingLogs')}
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const Icon = levelIcons[log.level] || Info;
                  const isExpanded = expandedLogs.has(log.id ?? 0);
                  
                  return (
                    <Collapsible
                      key={log.id}
                      open={isExpanded}
                      onOpenChange={() => log.details && toggleExpand(log.id)}
                    >
                      <div
                        className={`p-3 rounded-lg border ${levelColors[log.level]} ${
                          log.details ? 'cursor-pointer hover:opacity-80' : ''
                        }`}
                      >
                        <CollapsibleTrigger asChild>
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
                            {log.details && (
                              <ChevronDown
                                className={`w-4 h-4 shrink-0 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        
                        {log.details && (
                          <CollapsibleContent>
                            <div className="mt-3 pt-3 border-t border-current/20">
                              <pre className="text-xs overflow-x-auto whitespace-pre-wrap font-mono bg-background/50 p-2 rounded">
                                {log.details.stack}
                              </pre>
                            </div>
                          </CollapsibleContent>
                        )}
                      </div>
                    </Collapsible>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pagination */}
      <Card className="glass-card">
        <CardContent className="p-4">
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
                {t('common.previousPage')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                {t('common.nextPage')}
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
    </div>
  );
}
