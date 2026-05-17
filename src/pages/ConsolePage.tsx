import { useState, useRef, useEffect, useCallback, memo, forwardRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Terminal, Trash2, Download, Circle } from "lucide-react";
import { StructuredDataViewer } from "@/components/StructuredDataViewer";
import { remoteCommandApi } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  type: "input" | "output" | "error" | "warning" | "info" | "debug" | "trace";
  content: string;
  timestamp: Date;
}

let logCounter = 0;

function getLevelBadge(type: LogEntry["type"]) {
  const badges = {
    input: { label: "CMD", bg: "bg-blue-600", text: "text-white" },
    output: { label: "OUT", bg: "bg-slate-600", text: "text-white" },
    error: { label: "ERROR", bg: "bg-red-600", text: "text-white" },
    warning: { label: "WARN", bg: "bg-yellow-500", text: "text-black" },
    info: { label: "INFO", bg: "bg-emerald-600", text: "text-white" },
    debug: { label: "DEBUG", bg: "bg-purple-600", text: "text-white" },
    trace: { label: "TRACE", bg: "bg-gray-600", text: "text-white" },
  };
  return badges[type] || badges.info;
}

function getLogColor(type: LogEntry["type"]) {
  switch (type) {
    case "input":
      return "text-cyan-400";
    case "output":
      return "text-gray-200";
    case "error":
      return "text-red-400";
    case "warning":
      return "text-yellow-400";
    case "info":
      return "text-black dark:text-white";
    case "debug":
      return "text-purple-400";
    case "trace":
      return "text-gray-400";
    default:
      return "text-gray-200";
  }
}

interface LogRowProps {
  log: LogEntry;
  style?: React.CSSProperties;
  "data-index": number;
}

const LogRow = memo(
  forwardRef<HTMLDivElement, LogRowProps>(
    function LogRow({ log, style, "data-index": dataIndex }, ref) {
      const badge = getLevelBadge(log.type);
      return (
        <div
          ref={ref}
          data-index={dataIndex}
          style={style}
          className="flex items-start gap-2 py-1"
        >
          <span className="text-muted-foreground text-xs shrink-0">
            [{log.timestamp.toLocaleTimeString()}]
          </span>
          <span
            className={`${badge.bg} ${badge.text} text-xs px-1.5 py-0.5 rounded font-semibold shrink-0 h-fit`}
          >
            {badge.label}
          </span>
          <div className={cn("whitespace-pre-wrap break-all", getLogColor(log.type))}>
            <StructuredDataViewer data={log.content} />
          </div>
        </div>
      );
    }
  )
);

export default function ConsolePage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';

  // 数据存在 ref 中，避免 React 遍历大数组
  const logsRef = useRef<LogEntry[]>([]);
  const [logVersion, setLogVersion] = useState(0);

  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const virtualizer = useVirtualizer({
    count: logsRef.current.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
    getItemKey: (index) => logsRef.current[index]?.id ?? index,
    measureElement:
      typeof window !== "undefined" && "ResizeObserver" in window
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  // Auto-scroll to bottom when enabled
  useEffect(() => {
    if (autoScroll) {
      virtualizer.scrollToIndex(logsRef.current.length - 1);
    }
  }, [logVersion, autoScroll, virtualizer]);

  // SSE stream for real-time logs
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const authEventSource = new EventSource(
      `/api/logs/stream?token=${encodeURIComponent(token)}`,
      { withCredentials: true }
    );

    authEventSource.onmessage = (event) => {
      try {
        const logData = JSON.parse(event.data);
        let logType: LogEntry["type"] = "info";
        switch (logData.level.toLowerCase()) {
          case "error": logType = "error"; break;
          case "warning":
          case "warn": logType = "warning"; break;
          case "info": logType = "info"; break;
          case "debug": logType = "debug"; break;
          case "trace": logType = "trace"; break;
        }

        logsRef.current.push({
          id: (++logCounter).toString(),
          type: logType,
          content: logData.message,
          timestamp: new Date(logData.timestamp),
        });
        // 限制最大条数
        if (logsRef.current.length > 2000) {
          logsRef.current = logsRef.current.slice(-2000);
        }
        setLogVersion((v) => v + 1);
      } catch (e) {
        console.error("Failed to parse log message:", e);
      }
    };

    authEventSource.onerror = (error) => {
      console.error("Log stream error:", error);
      authEventSource.close();
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    return () => {
      authEventSource.close();
    };
  }, []);

  const addLogs = useCallback((entries: LogEntry[]) => {
    logsRef.current.push(...entries);
    if (logsRef.current.length > 2000) {
      logsRef.current = logsRef.current.slice(-2000);
    }
    setLogVersion((v) => v + 1);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      const command = input.trim();

      addLogs([{
        id: (++logCounter).toString(),
        type: "input",
        content: `$ ${command}`,
        timestamp: new Date(),
      }]);

      setCommandHistory((prev) => [command, ...prev].slice(0, 50));
      setHistoryIndex(-1);
      setInput("");

      if (command.toLowerCase() === "clear") {
        logsRef.current = [];
        setLogVersion((v) => v + 1);
        return;
      }

      try {
        const response = await remoteCommandApi.execute(command);
        const outputLogs: LogEntry[] = [];
        if (response.output) {
          outputLogs.push({
            id: (++logCounter).toString(),
            type: "output",
            content: response.output,
            timestamp: new Date(),
          });
        }
        if (response.error) {
          outputLogs.push({
            id: (++logCounter).toString(),
            type: "error",
            content: response.error,
            timestamp: new Date(),
          });
        }
        if (outputLogs.length > 0) {
          addLogs(outputLogs);
        }
      } catch (error) {
        addLogs([{
          id: (++logCounter).toString(),
          type: "error",
          content: error instanceof Error ? error.message : (t('console.commandFailed') || "Command execution failed"),
          timestamp: new Date(),
        }]);
      }
    },
    [input, addLogs, t],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };

  const clearLogs = () => {
    logsRef.current = [];
    setLogVersion((v) => v + 1);
  };

  const exportLogs = () => {
    const content = logsRef.current
      .map((log) => `[${log.timestamp.toISOString()}] [${log.type.toUpperCase()}] ${log.content}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `console-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="space-y-6 flex-1 overflow-auto p-4 sm:p-6 h-full flex flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <Terminal className="w-8 h-8 shrink-0" />
            {t('console.title')}
          </h1>
          <p className="whitespace-nowrap text-muted-foreground mt-1">{t('console.description')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
            <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
            {t('console.connected')}
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm text-muted-foreground">{t('console.autoScroll')}</span>
            <Switch checked={autoScroll} onCheckedChange={setAutoScroll} />
          </div>
          <Button variant="outline" size="sm" onClick={exportLogs} className="whitespace-nowrap">
            <Download className="w-4 h-4 mr-2" />
            {t('console.exportLogs')}
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs} className="whitespace-nowrap">
            <Trash2 className="w-4 h-4 mr-2" />
            {t('console.clear')}
          </Button>
        </div>
      </div>

      <Card className={cn(
        "flex flex-col overflow-hidden h-[calc(100vh-130px)]",
        isGlass
          ? "backdrop-blur-md bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 shadow-lg"
          : "bg-card border border-border/50"
      )}>
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-background/50 border-b border-border/30">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-muted-foreground ml-2 font-mono">admin@server:~</span>
        </div>

        {/* Terminal Content - Virtual Scroll */}
        <div
          ref={parentRef}
          className="flex-1 p-4 bg-transparent overflow-y-auto font-mono text-sm relative"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
              }}
            >
              {virtualItems.map((virtualItem) => (
                <LogRow
                  key={virtualItem.key}
                  log={logsRef.current[virtualItem.index]}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4 bg-background/50 border-t border-border/30">
          <span className="text-primary font-mono">$</span>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('console.commandPlaceholder')}
            className="flex-1 bg-transparent border-none focus-visible:ring-0 font-mono text-foreground placeholder:text-muted-foreground/50"
            autoFocus
          />
        </form>
      </Card>
    </div>
  );
}
