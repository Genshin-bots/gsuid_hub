import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Terminal, Trash2, Download, Circle, Check, Minus } from "lucide-react";
import {
  remoteCommandApi,
  logsApi,
  logsConfigApi,
  sanitizeVisibleLevels,
  DEFAULT_LOGS_CONFIG,
} from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { ConsolePanel, LogEntry, buildLogAnchor, computeLineCount } from "@/components/ConsolePanel";
import { PinnedPage } from '@/components/layout/PinnedPage';

let logCounter = 0;

/**
 * setLogVersion 节流间隔（毫秒）。
 * 限频的目的不是丢日志（ref 依然全部保留），
 * 而是避免 SSE 高频推送时每帧都触发 React 重渲染，
 * 导致虚拟化器反复重测、DOM 重建、鼠标 hover / 选区丢失。
 */
const LOG_VERSION_THROTTLE_MS = 100;

const LEVEL_ORDER = ["trace", "debug", "info", "success", "warning", "error", "critical"];

const VISIBLE_LEVELS_STORAGE_KEY = "console_visible_levels";

// 持久化读�?写入：使�?localStorage 实现跨刷新记�?
function loadVisibleLevelsFromStorage(): string[] | null {
  try {
    const raw = localStorage.getItem(VISIBLE_LEVELS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    return null;
  } catch {
    return null;
  }
}

function saveVisibleLevelsToStorage(levels: Set<string>) {
  try {
    localStorage.setItem(
      VISIBLE_LEVELS_STORAGE_KEY,
      JSON.stringify(Array.from(levels)),
    );
  } catch {
    /* ignore quota errors */
  }
}

function parseLogLevel(level: string): string {
  return level.toLowerCase();
}

/**
 * 从 SSE 载荷解析 plugin，并尽量把正文里残留的 `plugin=...` 清掉
 *（兼容尚未升级、仍把 plugin 塞进 message 的旧后端）。
 */
function resolvePluginAndContent(
  message: unknown,
  pluginField: unknown,
): { plugin?: string; content: string } {
  let content = typeof message === "string" ? message : String(message ?? "");
  let plugin =
    typeof pluginField === "string" && pluginField.trim()
      ? pluginField.trim()
      : undefined;

  // 旧后端：plugin 落在正文 extras 行，例如 "plugin=WutheringWavesUID, pathname=..."
  if (!plugin) {
    const m = content.match(/(?:^|[\n,]\s*)plugin=([^\n,]+)/i);
    if (m?.[1]) {
      plugin = m[1].trim();
    }
  }

  if (plugin) {
    // 去掉 plugin=xxx 键值（单独一段或夹在逗号列表里）
    content = content
      .replace(/(?:^|\n)\s*plugin=[^\n,]*(?:,\s*)?/gi, "\n")
      .replace(/,\s*plugin=[^\n,]*/gi, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+|\n+$/g, "");
  }

  return { plugin, content };
}

export default function ConsolePage() {
  const { t } = useLanguage();
  const { style, mode } = useTheme();
  const isGlass = style === 'glassmorphism';
  const isDark = mode === 'dark';

  // 数据存在 ref 中，避免 React 遍历大数�?
  const allLogsRef = useRef<LogEntry[]>([]);
  const [logVersion, setLogVersion] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  // 断点续传：onerror 里是 close() + 新建 EventSource，浏览器不会带 Last-Event-ID 头（只有
  // 它自己重连才带），必须显式回传，否则后端重放整个缓冲、而 allLogsRef 不清空 = 刷屏重复。
  const lastEventIdRef = useRef<string | null>(null);

  // 节流：避免高额 SSE 推送每帧都触发重渲染。
  // - logs 始终存在 allLogsRef 里，不会丢失
  // - 只有在间隔期满后，才通过 logVersion 通知 React 重新计算 filteredLogs
  const pendingVersionFlushRef = useRef<number | null>(null);
  const lastVersionFlushAtRef = useRef<number>(0);
  const scheduleLogVersionFlush = useCallback(() => {
    const now = Date.now();
    const sinceLast = now - lastVersionFlushAtRef.current;
    if (sinceLast >= LOG_VERSION_THROTTLE_MS) {
      lastVersionFlushAtRef.current = now;
      setLogVersion((v) => v + 1);
      return;
    }
    if (pendingVersionFlushRef.current != null) return;
    pendingVersionFlushRef.current = window.setTimeout(() => {
      pendingVersionFlushRef.current = null;
      lastVersionFlushAtRef.current = Date.now();
      setLogVersion((v) => v + 1);
    }, LOG_VERSION_THROTTLE_MS - sinceLast);
  }, []);
  // 卸载时清理节流定时器
  useEffect(() => {
    return () => {
      if (pendingVersionFlushRef.current != null) {
        clearTimeout(pendingVersionFlushRef.current);
        pendingVersionFlushRef.current = null;
      }
    };
  }, []);

  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(false);
  // ref 镜像：让 SSE handler / addLogs 等闭包内能读到最新值
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;

  const [availableLevels, setAvailableLevels] = useState<Array<{ label: string; value: string }>>([]);
  const [visibleLevels, setVisibleLevels] = useState<Set<string>>(
    () => new Set<string>(DEFAULT_LOGS_CONFIG.visible_levels),
  );
  // 标记是否已应用过持久化数据，避免在拿到后�?levels 后被默认值覆�?
  const initializedRef = useRef(false);

  const filteredLogs = useMemo(() => {
    if (!visibleLevels.size || visibleLevels.has('all')) {
      return allLogsRef.current;
    }
    return allLogsRef.current.filter((log) => visibleLevels.has(log.type));
  }, [logVersion, visibleLevels]);

  // 注意：
  // - filteredLogs 每次 useMemo 都是新数组引用，
  //   但 ConsolePanel 内部靠 anchor key 能复用 DOM，鼠标位置不会丢。
  // - ConsolePanel 会根据前后 anchor 集合差集判断是否发生了“真正过滤”，
  //   只有在过滤时才暂存顶部 anchor 并恢复，避免干扰 autoScroll 滚到底。

  const inputRef = useRef<HTMLInputElement>(null);

  // 获取可用日志级别
  useEffect(() => {
    const fallback = [
      { label: 'TRACE', value: 'trace' },
      { label: 'DEBUG', value: 'debug' },
      { label: 'INFO', value: 'info' },
      { label: 'SUCCESS', value: 'success' },
      { label: 'WARNING', value: 'warning' },
      { label: 'ERROR', value: 'error' },
      { label: 'CRITICAL', value: 'critical' },
    ];

    const applyLevels = (
      levels: Array<{ label: string; value: string }>,
      persisted: string[] | null,
    ) => {
      setAvailableLevels(levels);

      const validValues = new Set(levels.map((lv) => lv.value));
      const pick = (raw: string[] | null) =>
        sanitizeVisibleLevels(raw).filter((v) => validValues.has(v));

      // 1) GET /api/logs/config 是权威来源（允许空数组 = 用户主动全不选）
      if (persisted !== null) {
        setVisibleLevels(new Set(pick(persisted)));
        initializedRef.current = true;
        return;
      }

      // 2) 接口失败时回退 localStorage
      const fromStorage = pick(loadVisibleLevelsFromStorage());
      if (fromStorage.length > 0) {
        setVisibleLevels(new Set(fromStorage));
        initializedRef.current = true;
        return;
      }

      // 3) 与后端 DEFAULT_LOGS_CONFIG 对齐
      const defaults = new Set(
        DEFAULT_LOGS_CONFIG.visible_levels.filter((v) => validValues.has(v)),
      );
      if (defaults.size === 0 && levels.length > 0) {
        const first = levels.find((lv) => lv.value !== 'all')?.value;
        if (first) defaults.add(first);
      }
      setVisibleLevels(defaults);
      initializedRef.current = true;
    };

    Promise.all([
      logsApi.getLevels().catch(() => fallback),
      logsConfigApi
        .get()
        .then((cfg) => (Array.isArray(cfg?.visible_levels) ? cfg.visible_levels : []))
        .catch(() => null),
    ]).then(([levels, persisted]) => {
      applyLevels(Array.isArray(levels) ? levels : fallback, persisted);
    });
  }, []);

  // 持久化：写 localStorage 缓存，并防抖写入 GET/PUT /api/logs/config
  useEffect(() => {
    if (!initializedRef.current) return;
    saveVisibleLevelsToStorage(visibleLevels);
    const levels = Array.from(visibleLevels);
    const timer = window.setTimeout(() => {
      logsConfigApi.update({ visible_levels: levels }).catch(() => {
        /* 网络失败时仍保留 localStorage 缓存 */
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [visibleLevels]);

  // SSE stream for real-time logs - 始终接收所有级别，前端通过 filteredLogs 控制显示
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const resumeFrom = lastEventIdRef.current;
    const url =
      `/api/logs/stream?token=${encodeURIComponent(token)}&level=all` +
      (resumeFrom ? `&last_event_id=${encodeURIComponent(resumeFrom)}` : '');
    const authEventSource = new EventSource(url, { withCredentials: true });

    authEventSource.onmessage = (event) => {
      try {
        // 断点续传去重：重连后后端可能重放缓冲中已收过的日志，
        // 跳过 event id <= 已知最大 id 的条目，避免重复日志冲刷数组。
        // 若后端重启（log_seq 归零），新 id 会远小于旧 id（差值 > 缓冲上限 2000），
        // 此时重置跟踪并接受新序列。
        if (event.lastEventId) {
          const eventId = parseInt(event.lastEventId, 10);
          const lastId = lastEventIdRef.current ? parseInt(lastEventIdRef.current, 10) : -1;
          if (lastId >= 0 && eventId <= lastId) {
            if (lastId - eventId > 2000) {
              // 后端重启，log_seq 归零——接受新序列
              lastEventIdRef.current = event.lastEventId;
            } else {
              // 缓冲重放的重复日志，跳过
              return;
            }
          } else {
            lastEventIdRef.current = event.lastEventId;
          }
        }
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

        const ts = new Date(logData.timestamp);
        const { plugin, content } = resolvePluginAndContent(
          logData.message,
          logData.plugin,
        );
        allLogsRef.current.push({
          id: (++logCounter).toString(),
          type: logType,
          content,
          plugin,
          timestamp: ts,
          anchor: buildLogAnchor(ts, content),
          // 预算行数（按 \n 拆分），让虚拟化器初次布局就拿到正确行高
          lineCount: computeLineCount(content),
        });
        // 限制最大条数：
        // - autoScroll 开启时用户在底部，从头部裁剪不影响可视区域
        // - autoScroll 关闭时用户可能在看旧日志，从头部裁剪会导致视口内容逐行消失，
        //   因此使用更高的上限兜底内存，不做逐条头部裁剪
        const cap = autoScrollRef.current ? 2000 : 10000;
        if (allLogsRef.current.length > cap) {
          if (autoScrollRef.current) {
            allLogsRef.current = allLogsRef.current.slice(-cap);
          } else {
            // 非自动滚动模式下仅在超出高水位时从头部批量裁剪（避免每条都触发），
            // 一次性裁掉 2000 条，减少虚拟化器重布局频率
            allLogsRef.current = allLogsRef.current.slice(-(cap - 2000));
          }
        }
        // 节流后通知 React，不要每条都重渲染
        scheduleLogVersionFlush();
      } catch (e) {
        console.error("Failed to parse log message:", e);
      }
    };

    authEventSource.onerror = (error) => {
      console.error("Log stream error:", error);
      authEventSource.close();
      // 延迟后尝试重�?
      setTimeout(() => {
        setReconnectCount((c) => c + 1);
      }, 3000);
    };

    return () => {
      authEventSource.close();
    };
  }, [reconnectCount]);

  const addLogs = useCallback((entries: LogEntry[]) => {
    if (entries.length === 0) return;
    // 补齐 anchor 与 lineCount：
    // - anchor：用于过滤切换 / 新日志到达时精确定位
    // - lineCount：用于虚拟化器在初次布局时预估多行内容的行高，
    //   避免多行日志（异常堆栈 / 多行输出）与下一条日志重叠
    const stamped = entries.map((e) => {
      const lineCount =
        e.lineCount ?? (typeof e.content === 'string' ? computeLineCount(e.content) : 1);
      return e.anchor
        ? { ...e, lineCount }
        : { ...e, anchor: buildLogAnchor(e.timestamp, e.content), lineCount };
    });
    allLogsRef.current.push(...stamped);
    const cap = autoScrollRef.current ? 2000 : 10000;
    if (allLogsRef.current.length > cap) {
      if (autoScrollRef.current) {
        allLogsRef.current = allLogsRef.current.slice(-cap);
      } else {
        allLogsRef.current = allLogsRef.current.slice(-(cap - 2000));
      }
    }
    scheduleLogVersionFlush();
  }, [scheduleLogVersionFlush]);

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
        scheduleLogVersionFlush();
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
    // 清空后仍走节流通知 React，避免其他竞态写入被压制
    scheduleLogVersionFlush();
  };

  const exportLogs = () => {
    const content = allLogsRef.current
      .map((log) => {
        const pluginTag = log.plugin ? ` {${log.plugin}}` : "";
        return `[${log.timestamp.toISOString()}] [${log.type.toUpperCase()}]${pluginTag} ${log.content}`;
      })
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

  const enableAllLevels = () => {
    setVisibleLevels(
      new Set(
        availableLevels
          .filter((lv) => lv.value !== 'all')
          .map((lv) => lv.value),
      ),
    );
  };

  const disableAllLevels = () => {
    setVisibleLevels(new Set());
  };

  /**
   * 主题�?Badge 样式�?
   * - 不再硬编�?bg-purple-600 / bg-emerald-600 �?Tailwind 颜色
   * - 激活态：使用主题�?--primary 渐变 + 高对比前景色 + 阴影
   * - 非激活态：低饱和度背景 + 主题色边�?+ 主题色文字（�?color-mix 让色阶跟随明暗）
   * - 玻璃风格下叠�?backdrop-blur
   */
  const levelBadgeStyle = (value: string, active: boolean) => {
    const base =
      "group inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full " +
      "font-medium transition-all duration-200 border select-none " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

    // 激活态：实心主题�?+ 微阴�?
    if (active) {
      return cn(
        base,
        "shadow-sm hover:shadow-md hover:-translate-y-px",
        isGlass && "backdrop-blur-sm",
      );
    }

    // 非激活态：低饱和度背景 + 主题色细�?
    return cn(
      base,
      "hover:-translate-y-px",
      isGlass && "backdrop-blur-sm",
    );
  };

  // 渲染 badge：根据激活态应用不同主题变�?
  const renderLevelBadge = (
    lv: { label: string; value: string },
    active: boolean,
  ) => {
    // 通过 CSS 自定义属性把主题色直接注�?inline style，避免硬编码 Tailwind 颜色
    // 激活态：根据明暗主题直接使用固定前景色，避免依赖 --primary-foreground 变量
    // （该变量在不同主题下深浅不一，无法保证 --primary 背景上的可读性）。
    const activeStyle: React.CSSProperties = active
      ? {
          backgroundColor: 'hsl(var(--primary) / 0.95)',
          color: isDark ? '#ffffff' : '#000000',
          borderColor: 'hsl(var(--primary))',
          boxShadow: isGlass
            ? '0 4px 14px hsl(var(--primary) / 0.25)'
            : '0 1px 3px hsl(var(--primary) / 0.35)',
        }
      : {
          // 非激活：背景用极淡的主题色，边框/文字用主题色
          backgroundColor: isGlass
            ? 'hsl(var(--primary) / 0.08)'
            : isDark
              ? 'hsl(var(--primary) / 0.08)'
              : 'hsl(var(--primary) / 0.06)',
          color: isDark
            ? 'hsl(var(--primary) / 0.85)'
            : 'hsl(var(--primary) / 0.75)',
          borderColor: 'hsl(var(--primary) / 0.25)',
        };

    return (
      <button
        key={lv.value}
        type="button"
        onClick={() => toggleLevel(lv.value)}
        aria-pressed={active}
        className={levelBadgeStyle(lv.value, active)}
        style={activeStyle}
      >
        <span
          className={cn(
            "inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border transition-colors",
            // 激活态：圆点描边/背景继承父级文字色，确保深色主题下与白色文字一致
            active
              ? "bg-current/20 border-current/40"
              : "border-current/50 bg-current/10",
          )}
          aria-hidden="true"
        >
          {active ? <Check className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100 transition-opacity" />}
        </span>
        {lv.label}
      </button>
    );
  };

  // 可用级别（剔�?'all'�?
  const renderableLevels = useMemo(
    () =>
      availableLevels
        .filter((lv) => lv.value !== 'all')
        .sort((a, b) => {
          const idxA = LEVEL_ORDER.indexOf(a.value);
          const idxB = LEVEL_ORDER.indexOf(b.value);
          if (idxA === -1 && idxB === -1) return a.value.localeCompare(b.value);
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        }),
    [availableLevels],
  );

  const allActive =
    renderableLevels.length > 0 &&
    renderableLevels.every((lv) => visibleLevels.has(lv.value));

  return (
    <PinnedPage
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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
      }
      toolbar={
        /* 日志级别过滤 */
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 p-3 rounded-xl border",
            isGlass
              ? "bg-white/5 border-white/15 backdrop-blur-sm"
              : "bg-card/40 border-border/50",
          )}
          style={{
            // 注入一个很淡的主题色背景渐变，让整个过滤器与主题联动
            backgroundImage:
              'linear-gradient(90deg, hsl(var(--primary) / 0.04), transparent 60%)',
          }}
        >
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap mr-1">
            {t('console.levelFilter') || '日志级别'}:
          </span>
          {renderableLevels.map((lv) => renderLevelBadge(lv, visibleLevels.has(lv.value)))}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={allActive ? disableAllLevels : enableAllLevels}
              aria-label={allActive ? t('console.deselectAll') : t('console.selectAll')}
            >
              {allActive ? t('console.deselectAll') : t('console.selectAll')}
            </Button>
          </div>
        </div>
      }
    >
      <Card className={cn(
        // 非 glass-card 宿主，overflow-hidden 安全；用于裁终端头/输入条的直角底色
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
    </PinnedPage>
  );
}
