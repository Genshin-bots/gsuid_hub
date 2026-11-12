import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import {
  getApiErrorMessage,
  httpTraceApi,
  traceApi,
  type HttpTraceDetail,
  type HttpTraceItem,
  type HttpTraceLog,
  type TraceItem,
  type TraceLog,
} from '@/lib/api';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LogEntry } from '@/components/ConsolePanel';
import { mapTraceLogLevel, parseTraceTimestamp } from '@/components/logs/traceUtils';

export const TRACE_PAGE_SIZE = 100;
export const HTTP_METHOD_ALL = '__all__';
export const HTTP_STATUS_ALL = '__all__';

function traceLogToLogEntry(log: TraceLog, index: number, dateStr: string): LogEntry {
  return {
    id: `${log.timestamp}-${index}`,
    type: mapTraceLogLevel(log.level),
    content: log.event,
    timestamp: parseTraceTimestamp(log.timestamp, dateStr),
  };
}

function httpLogToLogEntry(log: HttpTraceLog, index: number, dateStr: string): LogEntry {
  return {
    id: `${log.timestamp}-${index}`,
    type: mapTraceLogLevel(log.level),
    content: log.event,
    timestamp: parseTraceTimestamp(log.timestamp, dateStr),
    plugin: log.plugin,
  };
}

export function useTracesController(enabled = true) {
  const { t } = useLanguage();
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [traceLogs, setTraceLogs] = useState<LogEntry[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceDetail, setTraceDetail] = useState<{
    trace_id: string;
    command: string;
    status: 'running' | 'completed';
    duration_ms: number | null;
    log_count: number;
  } | null>(null);
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});
  const countsFetchedRef = useRef(false);

  const dateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

  const fetchDailyCounts = useCallback(async () => {
    try {
      const data = await traceApi.getDailyCounts(60);
      const record: Record<string, number> = {};
      for (const item of data) {
        record[item.date] = item.count;
      }
      setDailyCounts(record);
    } catch (error) {
      console.error('Failed to fetch daily counts:', error);
    }
  }, []);

  useEffect(() => {
    if (!enabled || countsFetchedRef.current) return;
    countsFetchedRef.current = true;
    void fetchDailyCounts();
  }, [enabled, fetchDailyCounts]);

  const fetchTraces = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const data = await traceApi.getTraces({ date: dateStr, page, per_page: TRACE_PAGE_SIZE });
      setTraces(data.rows);
      setTotalCount(data.count);
      if (data.page !== page) setPage(data.page);
    } catch (error) {
      console.error('Failed to fetch traces:', error);
      toast.error(getApiErrorMessage(error, t('common.loadFailed')));
      setTraces([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [dateStr, enabled, page, t]);

  useEffect(() => {
    if (!enabled) return;
    void fetchTraces();
  }, [enabled, fetchTraces]);

  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setPage(1);
    setExpandedTraceId(null);
  }, []);

  const sortedTraces = useMemo(() => {
    return [...traces].sort((a, b) => b.start_time - a.start_time);
  }, [traces]);

  const handleExpandTrace = useCallback(
    async (trace: TraceItem) => {
      if (expandedTraceId === trace.trace_id) {
        setExpandedTraceId(null);
        setTraceLogs([]);
        setTraceDetail(null);
        return;
      }

      setExpandedTraceId(trace.trace_id);
      setTraceLoading(true);
      setTraceDetail({
        trace_id: trace.trace_id,
        command: trace.command,
        status: trace.status,
        duration_ms: trace.duration_ms,
        log_count: trace.log_count,
      });

      try {
        const detail = await traceApi.getTraceDetail(trace.trace_id, { date: dateStr });
        const entries = detail.logs.map((log, idx) => traceLogToLogEntry(log, idx, dateStr));
        setTraceLogs(entries);
        setTraceDetail({
          trace_id: detail.trace_id,
          command: detail.command,
          status: detail.status,
          duration_ms: detail.duration_ms,
          log_count: detail.log_count,
        });
      } catch (error) {
        console.error('Failed to fetch trace detail:', error);
        toast.error(getApiErrorMessage(error, t('common.loadFailed')));
        setTraceLogs([]);
      } finally {
        setTraceLoading(false);
      }
    },
    [dateStr, expandedTraceId, t],
  );

  const handleDownloadTrace = useCallback(
    async (trace: TraceItem) => {
      try {
        const detail = await traceApi.getTraceDetail(trace.trace_id, { date: dateStr });
        const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trace-${trace.trace_id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to download trace:', error);
        toast.error(getApiErrorMessage(error, t('common.loadFailed')));
      }
    },
    [dateStr, t],
  );

  const goPage = useCallback((next: number) => {
    setExpandedTraceId(null);
    setPage(next);
  }, []);

  return {
    traces,
    sortedTraces,
    totalCount,
    page,
    isLoading,
    selectedDate,
    selectDate,
    dailyCounts,
    expandedTraceId,
    traceLogs,
    traceLoading,
    traceDetail,
    fetchTraces,
    handleExpandTrace,
    handleDownloadTrace,
    goPage,
  };
}

export type TracesController = ReturnType<typeof useTracesController>;

export function useHttpTracesController(options: { enabled?: boolean; active?: boolean } = {}) {
  const { enabled = true, active = true } = options;
  const { t } = useLanguage();
  const [traces, setTraces] = useState<HttpTraceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [traceLogs, setTraceLogs] = useState<LogEntry[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceDetail, setTraceDetail] = useState<HttpTraceDetail | null>(null);
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [method, setMethod] = useState(HTTP_METHOD_ALL);
  const [pathPrefix, setPathPrefix] = useState('');
  const [statusClass, setStatusClass] = useState(HTTP_STATUS_ALL);
  const [userId, setUserId] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const countsFetchedRef = useRef(false);

  const dateStr = useMemo(() => format(selectedDate, 'yyyy-MM-dd'), [selectedDate]);

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
    if (!enabled || countsFetchedRef.current) return;
    countsFetchedRef.current = true;
    void fetchDailyCounts();
  }, [enabled, fetchDailyCounts]);

  const fetchList = useCallback(
    async (silent = false) => {
      if (!enabled) return;
      if (!silent) setIsLoading(true);
      try {
        const data = await httpTraceApi.getTraces({
          date: dateStr,
          page,
          per_page: TRACE_PAGE_SIZE,
          method: method === HTTP_METHOD_ALL ? undefined : method,
          path_prefix: pathPrefix.trim() || undefined,
          status_class: statusClass === HTTP_STATUS_ALL ? undefined : statusClass,
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
    [dateStr, enabled, page, method, pathPrefix, statusClass, userId, onlyErrors, t],
  );

  useEffect(() => {
    if (!enabled) return;
    void fetchList(false);
  }, [enabled, fetchList]);

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
    if (!enabled || !active || !autoRefresh) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchList(true);
      if (expandedTraceId && traceDetail?.status === 'running') {
        void fetchDetail(expandedTraceId);
      }
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [enabled, active, autoRefresh, fetchList, fetchDetail, expandedTraceId, traceDetail?.status]);

  const sortedTraces = useMemo(
    () => [...traces].sort((a, b) => b.start_time - a.start_time),
    [traces],
  );

  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setPage(1);
    setExpandedTraceId(null);
  }, []);

  const updateMethod = useCallback((next: string) => {
    setMethod(next);
    setPage(1);
  }, []);

  const updateStatusClass = useCallback((next: string) => {
    setStatusClass(next);
    setPage(1);
  }, []);

  const updatePathPrefix = useCallback((next: string) => {
    setPathPrefix(next);
    setPage(1);
  }, []);

  const updateOnlyErrors = useCallback((next: boolean) => {
    setOnlyErrors(next);
    setPage(1);
  }, []);

  const updateUserId = useCallback((next: string) => {
    setUserId(next);
    setPage(1);
  }, []);

  const handleExpandTrace = useCallback(
    async (trace: HttpTraceItem) => {
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
    },
    [expandedTraceId, fetchDetail],
  );

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

  const goPage = useCallback((next: number) => {
    setExpandedTraceId(null);
    setPage(next);
  }, []);

  return {
    traces,
    sortedTraces,
    totalCount,
    page,
    isLoading,
    selectedDate,
    selectDate,
    dailyCounts,
    autoRefresh,
    setAutoRefresh,
    method,
    updateMethod,
    pathPrefix,
    updatePathPrefix,
    statusClass,
    updateStatusClass,
    userId,
    updateUserId,
    onlyErrors,
    updateOnlyErrors,
    expandedTraceId,
    traceLogs,
    traceLoading,
    traceDetail,
    fetchList,
    handleExpandTrace,
    handleDownloadTrace,
    goPage,
  };
}

export type HttpTracesController = ReturnType<typeof useHttpTracesController>;
