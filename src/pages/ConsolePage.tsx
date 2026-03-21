import { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Trash2, Download, Circle } from "lucide-react";
import { StructuredDataViewer } from "@/components/StructuredDataViewer";
import { remoteCommandApi } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";

interface LogEntry {
  id: string;
  type: "input" | "output" | "error" | "warning" | "info" | "debug" | "trace";
  content: string;
  timestamp: Date;
}

let logCounter = 0;

export default function ConsolePage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Real-time log stream connection
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const eventSource = new EventSource(`/api/logs/stream`, {
      withCredentials: true
    });

    // Add authorization header via query parameter since EventSource doesn't support headers directly
    const authEventSource = new EventSource(`/api/logs/stream?token=${encodeURIComponent(token)}`, {
      withCredentials: true
    });

    authEventSource.onmessage = (event) => {
      try {
        const logData = JSON.parse(event.data);
        let logType: LogEntry["type"] = "info";
        
        switch (logData.level.toLowerCase()) {
          case "error":
            logType = "error";
            break;
          case "warning":
          case "warn":
            logType = "warning";
            break;
          case "info":
            logType = "info";
            break;
          case "debug":
            logType = "debug";
            break;
          case "trace":
            logType = "trace";
            break;
          default:
            logType = "info";
        }

        setLogs((prev) => {
          // Keep max 400 logs to avoid memory issues
          const newLogs = [...prev, {
            id: (++logCounter).toString(),
            type: logType,
            content: logData.message,
            timestamp: new Date(logData.timestamp),
          }];
          return newLogs.slice(-400);
        });
      } catch (e) {
        console.error("Failed to parse log message:", e);
      }
    };

    authEventSource.onerror = (error) => {
      console.error("Log stream error:", error);
      authEventSource.close();
      // Reconnect after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    };

    return () => {
      authEventSource.close();
    };
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      const command = input.trim();
      
      // Add command input first
      const newLogs: LogEntry[] = [
        {
          id: (++logCounter).toString(),
          type: "input",
          content: `$ ${command}`,
          timestamp: new Date(),
        },
      ];

      setLogs((prev) => [...prev, ...newLogs]);
      setCommandHistory((prev) => [command, ...prev].slice(0, 50));
      setHistoryIndex(-1);
      setInput("");

      // Handle clear command (clear locally)
      if (command.toLowerCase() === "clear") {
        setLogs([]);
        return;
      }

      // Call backend API to execute command
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
          setLogs((prev) => [...prev, ...outputLogs]);
        }
      } catch (error) {
        const errorLog: LogEntry = {
          id: (++logCounter).toString(),
          type: "error",
          content: error instanceof Error ? error.message : t('console.commandFailed') || "Command execution failed",
          timestamp: new Date(),
        };
        setLogs((prev) => [...prev, errorLog]);
      }
    },
    [input],
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

  const clearLogs = () => setLogs([]);

  const exportLogs = () => {
    const content = logs
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

  const getLevelBadge = (type: LogEntry["type"]) => {
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
  };

  const getLogColor = (type: LogEntry["type"]) => {
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
  };

  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Terminal className="w-8 h-8" />
            {t('console.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('console.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Circle className="w-2 h-2 fill-green-500 text-green-500 animate-pulse" />
              {t('console.connected')}
            </div>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="w-4 h-4 mr-2" />
              {t('console.exportLogs')}
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('console.clear')}
            </Button>
        </div>
      </div>

      <Card className="backdrop-blur-md bg-white/10 dark:bg-black/10 border border-white/20 dark:border-black/20 shadow-lg flex flex-col overflow-hidden h-[calc(100vh-130px)]">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-background/50 border-b border-border/30">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-muted-foreground ml-2 font-mono">admin@server:~</span>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 p-4 bg-transparent overflow-y-auto" ref={scrollRef}>
          <div className="font-mono text-sm space-y-2">
            {logs.map((log) => {
              const badge = getLevelBadge(log.type);
              return (
                <div key={log.id} className="flex items-start gap-2 whitespace-pre-wrap break-all">
                  <span className="text-muted-foreground text-xs shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
                  <span className={`${badge.bg} ${badge.text} text-xs px-1.5 py-0.5 rounded font-semibold shrink-0`}>
                    {badge.label}
                  </span>
                  <div className={getLogColor(log.type)}>
                    <StructuredDataViewer data={log.content} />
                  </div>
                </div>
              );
            })}
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
