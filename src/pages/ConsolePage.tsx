import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Terminal, Trash2, Download, Circle } from "lucide-react";
import { remoteCommandApi, logsApi } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { ConsolePanel, LogEntry } from "@/components/ConsolePanel";

let logCounter = 0;

const LEVEL_ORDER = ["trace", "debug", "info", "success", "warning", "error", "critical"];

function parseLogLevel(level: string): string {
  return level.toLowerCase();
}

export default function ConsolePage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';

  // 数据存在 ref 中，避免 React 遍历大数组
  const allLogsRef = useRef<LogEntry[]>([]);
  const [logVersion, setLogVersion] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);

  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(false);

  const [availableLevels, setAvailableLevels] = useState<Array<{ label: string; value: string }>>([]);
  const [visibleLevels, setVisibleLevels] = useState<Set<string>>(new Set([
    'debug', 'info', 'error'
  ]));

  const filteredLogs = useMemo(() => {
    if (!visibleLevels.size || visibleLevels.has('all')) {
      return allLogsRef.current;
    }
    return allLogsRef.current.filter((log) => visibleLevels.has(log.type));
  }, [logVersion, visibleLevels]);

  const inputRef = useRef<HTMLInputElement>(null);

  // 获取可用日志级别
  useEffect(() => {
    logsApi.getLevels().then((levels) => {
      setAvailableLevels(levels);
      const defaults = new Set<string>();
      levels.forEach((lv) => {
        if (['debug', 'info', 'error'].includes(lv.value)) {
          defaults.add(lv.value);
        }
      });
      setVisibleLevels(defaults);
    }).catch(() => {
      // fallback
      const fallback = [
        { label: 'TRACE', value: 'trace' },
        { label: 'DEBUG', value: 'debug' },
        { label: 'INFO', value: 'info' },
        { label: 'SUCCESS', value: 'success' },
        { label: 'WARNING', value: 'warning' },
        { label: 'ERROR', value: 'error' },
        { label: 'CRITICAL', value: 'critical' },
      ];
      setAvailableLevels(fallback);
      setVisibleLevels(new Set(['debug', 'info', 'error']));
    });
  }, []);

  // SSE stream for real-time logs - 始终接收所有级别，前端通过 filteredLogs 控制显示
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const url = `/api/logs/stream?token=${encodeURIComponent(token)}&level=all`;
    const authEventSource = new EventSource(url, { withCredentials: true });

    authEventSource.onmessage = (event) => {
      try {
        const logData = JSON.parse(event.data);
        const rawLevel = parseLogLevel(logData.level);

        let logType: LogEntry["type"] = "info";
        switch (rawLevel) {
          case "error": logType = "error"; break;
          case "warning":
          case "warn": logType = "warning"; break;
          case "info": logType = "info"; break;
          case "success": logType = "success"; break;
          case "debug": logType = "debug"; break;
          case "trace": logType = "trace"; break;
          case "critical": logType = "critical"; break;
        }

        allLogsRef.current.push({
          id: (++logCounter).toString(),
          type: logType,
          content: logData.message,
          timestamp: new Date(logData.timestamp),
        });
        // 限制最大条数
        if (allLogsRef.current.length > 2000) {
          allLogsRef.current = allLogsRef.current.slice(-2000);
        }
        setLogVersion((v) => v + 1);
      } catch (e) {
        console.error("Failed to parse log message:", e);
      }
    };

    authEventSource.onerror = (error) => {
      console.error("Log stream error:", error);
      authEventSource.close();
      // 延迟后尝试重连
      setTimeout(() => {
        setReconnectCount((c) => c + 1);
      }, 3000);
    };

    return () => {
      authEventSource.close();
    };
  }, [reconnectCount]);

  const addLogs = useCallback((entries: LogEntry[]) => {
    allLogsRef.current.push(...entries);
    if (allLogsRef.current.length > 2000) {
      allLogsRef.current = allLogsRef.current.slice(-2000);
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
        allLogsRef.current = [];
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
    allLogsRef.current = [];
    setLogVersion((v) => v + 1);
  };

  const exportLogs = () => {
    const content = allLogsRef.current
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

  const toggleLevel = (value: string) => {
    setVisibleLevels((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };

  const levelBadgeStyle = (value: string, active: boolean) => {
    const base = "text-xs px-2 py-1 rounded-md font-medium transition-colors border";
    const styles: Record<string, string> = {
      trace: active ? "bg-gray-500 text-white border-gray-500" : "bg-gray-100 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700",
      debug: active ? "bg-purple-600 text-white border-purple-600" : "bg-purple-50 text-purple-300 border-purple-100 dark:bg-purple-950 dark:text-purple-700 dark:border-purple-900",
      info: active ? "bg-emerald-600 text-white border-emerald-600" : "bg-emerald-50 text-emerald-300 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-700 dark:border-emerald-900",
      success: active ? "bg-green-600 text-white border-green-600" : "bg-green-50 text-green-300 border-green-100 dark:bg-green-950 dark:text-green-700 dark:border-green-900",
      warning: active ? "bg-yellow-500 text-black border-yellow-500" : "bg-yellow-50 text-yellow-300 border-yellow-100 dark:bg-yellow-950 dark:text-yellow-700 dark:border-yellow-900",
      error: active ? "bg-red-600 text-white border-red-600" : "bg-red-50 text-red-300 border-red-100 dark:bg-red-950 dark:text-red-700 dark:border-red-900",
      critical: active ? "bg-rose-700 text-white border-rose-700" : "bg-rose-50 text-rose-300 border-rose-100 dark:bg-rose-950 dark:text-rose-700 dark:border-rose-900",
    };
    return cn(base, styles[value] || styles.info);
  };

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

      {/* 日志级别过滤 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">{t('console.levelFilter') || '日志级别'}:</span>
        {availableLevels
          .filter((lv) => lv.value !== 'all')
          .sort((a, b) => {
            const idxA = LEVEL_ORDER.indexOf(a.value);
            const idxB = LEVEL_ORDER.indexOf(b.value);
            if (idxA === -1 && idxB === -1) return a.value.localeCompare(b.value);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          })
          .map((lv) => (
            <button
              key={lv.value}
              type="button"
              onClick={() => toggleLevel(lv.value)}
              className={levelBadgeStyle(lv.value, visibleLevels.has(lv.value))}
            >
              {lv.label}
            </button>
          ))}
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
        <ConsolePanel
          logs={filteredLogs}
          autoScroll={autoScroll}
          version={logVersion}
        />

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
