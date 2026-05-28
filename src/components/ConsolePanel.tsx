import { useRef, memo, forwardRef, useEffect } from "react";
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
}

function getLevelBadge(type: LogEntryType) {
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
            <StructuredDataViewer data={typeof log.content === 'string' ? log.content : JSON.stringify(log.content)} />
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

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28,
    overscan: 10,
    getItemKey: (index) => logs[index]?.id ?? index,
    measureElement:
      typeof window !== "undefined" && "ResizeObserver" in window
        ? (element) => element.getBoundingClientRect().height
        : undefined,
  });

  useEffect(() => {
    if (autoScroll) {
      virtualizer.scrollToIndex(logs.length - 1);
    }
  }, [logs.length, autoScroll, virtualizer, version]);

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
