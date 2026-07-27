import { useRef, memo, forwardRef, useEffect, useCallback, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { StructuredDataViewer } from "@/components/StructuredDataViewer";
import { cn } from "@/lib/utils";

export type LogEntryType =
  | "input"
  | "output"
  | "error"
  | "warning"
  | "info"
  | "success"
  | "debug"
  | "trace"
  | "critical";

export interface LogEntry {
  id: string;
  type: LogEntryType;
  content: string;
  timestamp: Date;
  /**
   * 日志来源插件（后端 SSE 字段 `plugin`，如 SayuCore / GenshinUID / canvas_backend）。
   * 渲染在等级 badge 之后，不同插件使用稳定哈希配色。
   */
  plugin?: string;
  /**
   * 锚点签名：基于"时间戳 + 内容前 N 个字符"派生，
   * 用于在过滤切换 / 新日志到达时精确定位同一条日志，
   * 保证虚拟化 key 与滚动位置在过滤前后稳定。
   * 可选：未提供时由 ConsolePage / ConsolePanel 在使用时补齐。
   */
  anchor?: string;
  /**
   * 视觉行数（按 \n 拆分得到）。
   * 由 ConsolePage 在写入日志时预算好行数并写入，
   * 虚拟化器据此在初次布局时就能给出正确的预估高度，
   * 避免多行内容（异常堆栈 / 多行命令输出 / 结构化文本）
   * 把行撑高后与下一条日志重叠。
   *
   * - 单行内容也可能因容器宽度自动换行，但 wrap 行数无法预判，
   *   这部分仍由 measureElement 在挂载后动态修正。
   */
  lineCount?: number;
}

// ---- 行高 / 换行估算常量（与 text-sm + py-1 的真实盒模型对齐）----
// 一次性纵向内边距（py-1 的上下 0.25rem = 8px），整行只计一次
const ROW_BASE = 8;
// text-sm 的单行行盒高度 ≈ 20px（行高 1.25 * 16px）
const LINE_HEIGHT = 20;
// 单字符宽度：按 CJK 偏宽估算（14px），保证估算行数 >= 真实行数，
// 宁可初次布局短暂留白也不要重叠，measureElement 会随后收紧到真实高度。
const AVG_CHAR_WIDTH = 14;
// 内容区之外的预留宽度：时间戳 + level badge + plugin badge + gap + 容器 p-4 内边距
const RESERVED_WIDTH = 320;

/** 与后端 _CORE_ORIGIN_LABEL 对齐的框架本体名 */
const CORE_PLUGIN_LABELS = new Set(["sayucore", "core", "gscore"]);

/**
 * 插件 badge 色板（与后端 _PLUGIN_FORE_PALETTE 思路一致：按名哈希稳定取色）。
 * 用 bg-* 实体色保证亮/暗主题下都清晰可读。
 */
const PLUGIN_BADGE_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "bg-cyan-600", text: "text-white" },
  { bg: "bg-blue-600", text: "text-white" },
  { bg: "bg-green-600", text: "text-white" },
  { bg: "bg-fuchsia-600", text: "text-white" },
  { bg: "bg-amber-500", text: "text-black" },
  { bg: "bg-sky-500", text: "text-white" },
  { bg: "bg-indigo-600", text: "text-white" },
  { bg: "bg-lime-600", text: "text-white" },
  { bg: "bg-pink-600", text: "text-white" },
  { bg: "bg-yellow-500", text: "text-black" },
  { bg: "bg-teal-600", text: "text-white" },
  { bg: "bg-violet-600", text: "text-white" },
];

const CORE_PLUGIN_BADGE = { bg: "bg-slate-500", text: "text-white" };

/** 简易字符串哈希（稳定、无依赖），用于插件名 → 色板下标 */
function hashPluginName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function getPluginBadge(plugin: string): { label: string; bg: string; text: string } {
  const label = plugin.trim() || "SayuCore";
  const key = label.toLowerCase().replace(/[\s-]+/g, "");
  if (CORE_PLUGIN_LABELS.has(key) || key === "sayucore") {
    return { label, ...CORE_PLUGIN_BADGE };
  }
  const idx = hashPluginName(label) % PLUGIN_BADGE_PALETTE.length;
  return { label, ...PLUGIN_BADGE_PALETTE[idx] };
}

/**
 * 根据内容计算视觉行数（按 \n 拆分）。
 * - 空内容按 1 行算，保证虚拟化器不会给出 0 高度
 * - 首尾多余的 \n 不计入行数：它们在 whitespace-pre-wrap 下会渲染成
 *   一个可见的空行并在日志之间制造异常空白，且预存的 lineCount 也会
 *   因此偏大、把行高估高。三处（预存、estimateSize、渲染）都基于
 *   同一份"去噪后"的内容，保持口径一致。
 */
export function computeLineCount(content: string): number {
  if (!content) return 1;
  const normalized = content.replace(/^[\r\n]+|[\r\n]+$/g, "");
  if (!normalized) return 1;
  return normalized.split("\n").length;
}

/**
 * 渲染前对日志内容做同样的首尾换行去噪。
 * 仅裁掉首尾的噪声换行，保留中间的结构（空行、缩进、异常堆栈的排版），
 * 不影响有意的内容布局。
 */
function normalizeLogContent(content: unknown): string {
  const text = typeof content === "string" ? content : String(content ?? "");
  return text.replace(/^[\r\n]+|[\r\n]+$/g, "");
}

/**
 * 从时间戳与内容派生稳定锚点签名。
 * - 时间戳精确到毫秒，足以定位唯一一行
 * - 拼接内容前 16 个可见字符，避免极少数时间戳冲突的情况
 */
export function buildLogAnchor(timestamp: Date, content: string): string {
  const ts = timestamp instanceof Date ? timestamp.getTime() : Number(timestamp);
  const head = (typeof content === "string" ? content : String(content ?? "")).slice(0, 16);
  return `${ts}::${head}`;
}

/**
 * 行布局用 CSS Grid 固定列宽 + baseline 对齐：
 * 时间 / 等级 / 插件 / 正文首行共用 text-xs + leading-5，文字基线一致，
 * 避免「badge 小字号 flex 居中 + 正文 text-sm」造成的上下错落。
 *
 * time | level | plugin | message
 */
const LOG_ROW_GRID_CLASS =
  "grid grid-cols-[4.75rem_4.25rem_7.5rem_minmax(0,1fr)] gap-x-1.5 items-baseline py-0.5";

/** 时间列：与正文同字号行高，参与 baseline */
const TIME_CELL_CLASS =
  "min-w-0 font-mono text-xs tabular-nums leading-5 text-muted-foreground";

/**
 * badge：不用固定 h-* / flex 居中（会脱离文字基线）。
 * 与正文同 text-xs leading-5，仅左右 padding，高度 = 行高，与首行齐平。
 */
const BADGE_CELL_CLASS =
  "box-border w-full min-w-0 font-mono text-xs leading-5 font-semibold " +
  "text-center px-1 rounded truncate whitespace-nowrap select-none";

/** 固定 HH:MM:SS，避免 toLocaleTimeString 在不同 locale 下长短不一 */
function formatLogTime(ts: Date): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getLevelBadge(type: LogEntryType) {
  // 短标签（最长 SUCCESS=7）适配 4.25rem 列；完整语义见 title
  const badges: Record<LogEntryType, { label: string; bg: string; text: string }> = {
    input: { label: "CMD", bg: "bg-blue-600", text: "text-white" },
    output: { label: "OUT", bg: "bg-slate-600", text: "text-white" },
    error: { label: "ERROR", bg: "bg-red-600", text: "text-white" },
    warning: { label: "WARN", bg: "bg-yellow-500", text: "text-black" },
    info: { label: "INFO", bg: "bg-emerald-600", text: "text-white" },
    success: { label: "SUCCESS", bg: "bg-green-600", text: "text-white" },
    debug: { label: "DEBUG", bg: "bg-purple-600", text: "text-white" },
    trace: { label: "TRACE", bg: "bg-gray-500", text: "text-white" },
    critical: { label: "CRIT", bg: "bg-rose-700", text: "text-white" },
  };
  return badges[type] || badges.info;
}

function getLogColor(type: LogEntryType) {
  switch (type) {
    case "input":
      return "text-cyan-600 dark:text-cyan-400";
    case "output":
      return "text-slate-700 dark:text-gray-200";
    case "error":
      return "text-red-600 dark:text-red-400";
    case "warning":
      return "text-amber-600 dark:text-yellow-400";
    case "info":
      return "text-emerald-700 dark:text-white";
    case "success":
      return "text-green-600 dark:text-green-400";
    case "debug":
      return "text-purple-600 dark:text-purple-400";
    case "trace":
      return "text-gray-500 dark:text-gray-400";
    case "critical":
      return "text-rose-700 dark:text-rose-500";
    default:
      return "text-slate-700 dark:text-gray-200";
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
      // 列宽由 LOG_ROW_GRID_CLASS 固定，不再使用 padBadgeLabel
      const badge = getLevelBadge(log.type);
      const pluginBadge = log.plugin ? getPluginBadge(log.plugin) : null;
      return (
        <div
          ref={ref}
          data-index={dataIndex}
          style={style}
          className={LOG_ROW_GRID_CLASS}
        >
          <span className={TIME_CELL_CLASS}>
            [{formatLogTime(log.timestamp)}]
          </span>
          <span
            className={cn(BADGE_CELL_CLASS, badge.bg, badge.text)}
            title={badge.label}
          >
            {badge.label}
          </span>
          {pluginBadge ? (
            <span
              className={cn(BADGE_CELL_CLASS, pluginBadge.bg, pluginBadge.text)}
              title={pluginBadge.label}
            >
              {pluginBadge.label}
            </span>
          ) : (
            // 占位保持列宽；用同 leading 的空白字符参与 baseline，避免列塌陷错位
            <span aria-hidden className="font-mono text-xs leading-5">
              {"\u00a0"}
            </span>
          )}
          {/* 与左侧同 text-xs leading-5，首行基线对齐；多行仍向下延展 */}
          <div
            className={cn(
              "min-w-0 whitespace-pre-wrap break-all font-mono text-xs leading-5",
              getLogColor(log.type),
            )}
          >
            <StructuredDataViewer data={normalizeLogContent(log.content)} />
          </div>
        </div>
      );
    }
  )
);

interface ConsolePanelProps {
  logs: LogEntry[];
  className?: string;
  autoScroll?: boolean;
  version?: number;
}

export const ConsolePanel = function ConsolePanel({
  logs,
  className,
  autoScroll = false,
  version,
}: ConsolePanelProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const hasUserInteractedRef = useRef(false);

  // 缓存"上次 logs 的引用"，避免依赖 logs.length 触发额外 effect
  const lastLogsRef = useRef<LogEntry[] | null>(null);
  // 记录“logs 变化前需要恢复滚动位置的 id”（用 log.id，不用 anchor —— 唯一性）
  const pendingScrollIdRef = useRef<string | null>(null);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    // 行高预估：基于显式换行行数（lineCount）给一个“下限”，
    // 真实高度由 measureElement 在挂载后动态测量并接管。
    // 不再做基于字符宽度的自动 wrap 行数估算 —— 那种启发式在
    // ASCII / CJK / JSON 混排下既脆弱又会与测量值抢话。
    estimateSize: (index) => {
      const log = logs[index];
      if (!log) return ROW_BASE + LINE_HEIGHT;
      const lines = Math.max(1, log.lineCount ?? 1);
      return ROW_BASE + LINE_HEIGHT * lines;
    },
    overscan: 10,
    // key 必须保证唯一：anchor 派生自"毫秒时间戳 + 前 16 字符"，
    // 在高频重复日志（同毫秒同前缀）下会大量冲突，导致 React / Virtualizer
    // 行为不可预测 —— 同一条 DOM 节点被多个 item 共享，结果是 N 条
    // 日志全部绘制在同一 Y 位置 + 互相压住，看起来就是"重叠 + 大段空白"。
    // log.id 由调用方通过全局计数器（logCounter）生成，保证唯一，
    // 跨过滤/跨追加也都稳定，因此用它作 key。
    getItemKey: (index) => {
      const log = logs[index];
      if (!log || !log.id) return `__missing_${index}`;
      return log.id;
    },
    measureElement:
      typeof window !== "undefined" && "ResizeObserver" in window
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  // 检测用户是否手动滚动离开了底部
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const threshold = 50; // 像素容差
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    isUserScrolledUpRef.current = !isAtBottom;
  }, []);

  // 只在用户真正主动交互时标记为"已交互"
  const handleUserInteraction = useCallback(() => {
    hasUserInteractedRef.current = true;
  }, []);

  // 挂载滚动和交互事件监听
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('wheel', handleUserInteraction, { passive: true });
    el.addEventListener('touchstart', handleUserInteraction, { passive: true });
    el.addEventListener('keydown', handleUserInteraction, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('wheel', handleUserInteraction);
      el.removeEventListener('touchstart', handleUserInteraction);
      el.removeEventListener('keydown', handleUserInteraction);
    };
  }, [handleScroll, handleUserInteraction]);

  /**
   * 核心：
   * 1) 第一次进入 / logs 引用首次变化时记录"顶部 anchor"
   * 2) 当 logs 引用变化（过滤 / 新增）时，根据 anchor 找出该行在新数组中的索引，
   *    用 virtualizer.scrollToIndex 保持可视位置不变。
   * 3) 只有在 autoScroll 开启且用户未上滑时，才追加新日志后滚到底部。
   */
  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el || logs.length === 0) {
      lastLogsRef.current = logs;
      return;
    }

    const prevLogs = lastLogsRef.current;
    const isFirstMount = prevLogs === null || (prevLogs.length === 0 && logs.length > 0);

    // 1) 首次挂载：滚到底部（让用户看到最新日志）
    if (isFirstMount) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end', behavior: 'auto' });
      isUserScrolledUpRef.current = false;
      lastLogsRef.current = logs;
      return;
    }

    // 2) 过滤判断：拿前后两个数组中"所有行 id 集合"做差集。
    //    - 如果只是追加（prev id ⊂ new id），不触发滚动恢复，避免干扰 autoScroll
    //    - 如果 id 集合发生了真正的增减（部分旧日志被过滤掉），才保存顶部 id
    if (prevLogs && prevLogs.length > 0) {
      const prevIds = new Set(prevLogs.map((l) => l.id));
      const newIds = new Set(logs.map((l) => l.id));

      let removedSome = false;
      for (const id of prevIds) {
        if (!newIds.has(id)) {
          removedSome = true;
          break;
        }
      }

      if (removedSome) {
        const visibleItems = virtualizer.getVirtualItems();
        const topId =
          visibleItems.length > 0
            ? prevLogs[visibleItems[0].index]?.id ?? null
            : null;
        if (topId) {
          pendingScrollIdRef.current = topId;
        }
      }
    }

    lastLogsRef.current = logs;
  }, [logs, virtualizer]);

  // 在 logs 变化且 virtualizer 重新测量后，恢复顶部 id 对应的滚动位置
  useLayoutEffect(() => {
    const id = pendingScrollIdRef.current;
    if (!id) return;
    pendingScrollIdRef.current = null;

    const idx = logs.findIndex((l) => l.id === id);
    if (idx >= 0) {
      // 使用 'start' 对齐，把那一行钉在容器顶部，鼠标位置不会偏移
      virtualizer.scrollToIndex(idx, { align: 'start', behavior: 'auto' });
    }
  }, [logs, virtualizer]);

  // 自动滚动到底部：仅在 autoScroll 开启 且 用户未上滑 且 logs 增长时执行
  // 依赖 version 让父组件能精确控制何时尝试滚到底部
  useEffect(() => {
    if (logs.length === 0) return;
    if (!autoScroll) return;
    if (isUserScrolledUpRef.current) return;
    virtualizer.scrollToIndex(logs.length - 1, { align: 'end', behavior: 'auto' });
  }, [logs.length, autoScroll, version, virtualizer]);

  // 当用户开启 autoScroll 时，重置用户上滑状态，立即滚到底部
  useEffect(() => {
    if (autoScroll && logs.length > 0) {
      isUserScrolledUpRef.current = false;
      // 让下一次 layoutEffect 有机会滚到底部
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(logs.length - 1, { align: 'end', behavior: 'auto' });
      });
    }
  }, [autoScroll, virtualizer, logs.length]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn(
        "flex-1 p-4 bg-transparent overflow-y-auto font-mono text-sm relative",
        className
      )}
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
              log={logs[virtualItem.index]}
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
  );
};
