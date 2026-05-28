import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  Calendar,
  ChevronRight,
  ChevronDown,
  Clock,
  Hash,
  User,
  Users,
  ScrollText,
  Activity,
  Terminal,
  Search,
  Download,
  MessageCircle,
} from "lucide-react";
import { traceApi, TraceItem, TraceLog } from "@/lib/api";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { ConsolePanel, LogEntry } from "@/components/ConsolePanel";

function parseTraceTimestamp(ts: string, dateStr: string): Date {
  // ts: "05-28 10:01:30", dateStr: "2026-05-28"
  try {
    const [monthDay, time] = ts.split(" ");
    const year = dateStr.split("-")[0];
    const isoStr = `${year}-${monthDay}T${time}`;
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d;
  } catch { /* ignore */ }
  return new Date();
}

function traceLogToLogEntry(log: TraceLog, index: number, dateStr: string): LogEntry {
  let type: LogEntry["type"] = "info";
  switch (log.level.toLowerCase()) {
    case "trace": type = "trace"; break;
    case "debug": type = "debug"; break;
    case "info": type = "info"; break;
    case "success": type = "success"; break;
    case "warning":
    case "warn": type = "warning"; break;
    case "error": type = "error"; break;
    case "critical": type = "critical"; break;
  }
  return {
    id: `${log.timestamp}-${index}`,
    type,
    content: log.event,
    timestamp: parseTraceTimestamp(log.timestamp, dateStr),
  };
}

export default function TracesPage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [traceLogs, setTraceLogs] = useState<LogEntry[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceDetail, setTraceDetail] = useState<{
    trace_id: string;
    command: string;
    status: "running" | "completed";
    duration_ms: number | null;
    log_count: number;
  } | null>(null);

  const dateStr = useMemo(
    () => selectedDate.toISOString().split("T")[0],
    [selectedDate]
  );

  const fetchTraces = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await traceApi.getTraces({ date: dateStr, limit: 500 });
      setTraces(data);
    } catch (error) {
      console.error("Failed to fetch traces:", error);
      toast.error(t("common.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [dateStr, t]);

  useEffect(() => {
    fetchTraces();
  }, [fetchTraces]);

  const handleExpandTrace = async (trace: TraceItem) => {
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
      console.error("Failed to fetch trace detail:", error);
      toast.error(t("common.loadFailed"));
      setTraceLogs([]);
    } finally {
      setTraceLoading(false);
    }
  };

  const statusBadge = (status: TraceItem["status"]) => {
    if (status === "running") {
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900">
          <Activity className="w-3 h-3 mr-1 animate-pulse" />
          {t("traces.running")}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900">
        {t("traces.completed")}
      </Badge>
    );
  };

  const handleDownloadTrace = useCallback(async (trace: TraceItem) => {
    try {
      const detail = await traceApi.getTraceDetail(trace.trace_id, { date: dateStr });
      const blob = new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace-${trace.trace_id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download trace:", error);
      toast.error(t("common.loadFailed"));
    }
  }, [dateStr, t]);

  const isSlow = (ms: number | null) => ms !== null && ms > 7000;

  const sourceLabel = (trace: TraceItem) => {
    if (trace.group_id) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{t("traces.group") || "群聊"}</span>
          <span className="font-mono text-[10px] opacity-70">{trace.user_id}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <MessageCircle className="w-3 h-3" />
        <span>{t("traces.private") || "私聊"}</span>
        <span className="font-mono text-[10px] opacity-70">{trace.user_id}</span>
      </span>
    );
  };

  return (
    <div className="space-y-4 flex-1 overflow-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <Terminal className="w-8 h-8 shrink-0" />
            {t("traces.title") || "命令追踪"}
          </h1>
          <p className="whitespace-nowrap text-muted-foreground mt-1">
            {t("traces.description") || "查看命令执行追踪日志"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 self-end sm:self-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "yyyy-MM-dd") : t("logs.selectDate")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={8}>
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) setSelectedDate(date);
                }}
                defaultMonth={selectedDate}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={fetchTraces} disabled={isLoading} className="whitespace-nowrap">
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            {t("logs.refresh")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{traces.length}</p>
              <p className="text-xs text-muted-foreground">{t("traces.totalTraces") || "总追踪"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {traces.filter((t) => t.status === "running").length}
              </p>
              <p className="text-xs text-muted-foreground">{t("traces.running") || "执行中"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {traces.filter((t) => t.status === "completed").length}
              </p>
              <p className="text-xs text-muted-foreground">{t("traces.completed") || "已完成"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Hash className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {traces.reduce((sum, t) => sum + (t.log_count || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{t("traces.totalLogs") || "总日志数"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trace List */}
      <Card className="glass-card">
        <CardHeader className="py-3">
          <CardTitle className="text-base">
            {t("traces.traceList") || "追踪列表"} ({traces.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {traces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("traces.noTraces") || "暂无追踪记录"}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {/* 表头 */}
              <div className="hidden md:grid grid-cols-[92px_1fr_120px_90px_90px_80px_100px_44px] gap-3 px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border/30">
                <div className="font-medium">{t("traces.status") || "状态"}</div>
                <div className="font-medium">{t("traces.command") || "命令"}</div>
                <div className="font-medium">{t("traces.source") || "来源"}</div>
                <div className="font-medium">{t("traces.duration") || "耗时"}</div>
                <div className="font-medium">{t("traces.logs") || "日志数"}</div>
                <div className="font-medium">{t("traces.error") || "错误"}</div>
                <div className="font-medium">{t("traces.traceId") || "ID"}</div>
                <div />
              </div>
              {traces.map((trace) => {
                const isExpanded = expandedTraceId === trace.trace_id;
                return (
                  <div key={trace.trace_id} className="transition-colors">
                    {/* 桌面端列表行 */}
                    <button
                      type="button"
                      onClick={() => handleExpandTrace(trace)}
                      className="hidden md:grid w-full text-left grid-cols-[92px_1fr_120px_90px_90px_80px_100px_44px] items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
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
                      <div className="truncate font-medium text-sm min-w-0">
                        {trace.command}
                      </div>

                      {/* 来源 */}
                      <div className="truncate">
                        {sourceLabel(trace)}
                      </div>

                      {/* 耗时 */}
                      <div className={cn(
                        "text-xs",
                        isSlow(trace.duration_ms)
                          ? "text-red-600 dark:text-red-400 font-semibold"
                          : "text-muted-foreground"
                      )}>
                        {trace.duration_ms !== null ? `${trace.duration_ms}ms` : "—"}
                      </div>

                      {/* 日志数 */}
                      <div className="text-xs text-muted-foreground">
                        {trace.log_count}
                      </div>

                      {/* 错误数 */}
                      <div>
                        {trace.error_count ? (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900">
                            {trace.error_count}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* trace_id */}
                      <div className="font-mono text-xs text-muted-foreground truncate">
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
                            handleDownloadTrace(trace);
                          }}
                          title={t("traces.downloadTrace") || "下载追踪"}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </button>

                    {/* 移动端列表行 */}
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
                        <span className="truncate font-medium text-sm flex-1 min-w-0">
                          {trace.command}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-6">
                        <span className="inline-flex items-center gap-1">
                          {trace.group_id ? <Users className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                          {trace.group_id ? (t("traces.group") || "群聊") : (t("traces.private") || "私聊")} {trace.user_id}
                        </span>
                        <span className={cn(isSlow(trace.duration_ms) && "text-red-600 dark:text-red-400 font-semibold")}>
                          {trace.duration_ms !== null ? `${trace.duration_ms}ms` : "—"}
                        </span>
                        <span>{trace.log_count} {t("traces.logs") || "日志"}</span>
                        {trace.error_count ? (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900">
                            {trace.error_count} {t("traces.error") || "错误"}
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
                            handleDownloadTrace(trace);
                          }}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          {t("traces.downloadTrace") || "下载追踪"}
                        </Button>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className={cn(
                          "h-[28rem] overflow-hidden rounded-xl",
                          isGlass
                            ? "backdrop-blur-md bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 shadow-lg"
                            : "bg-card border border-border/50"
                        )}>
                          {traceLoading && traceDetail?.trace_id === trace.trace_id ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                              {t("common.loading")}
                            </div>
                          ) : (
                            <ConsolePanel
                              logs={traceLogs}
                              autoScroll={false}
                              className="h-full"
                            />
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
    </div>
  );
}
