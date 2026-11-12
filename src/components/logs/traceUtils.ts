import { format } from 'date-fns';
import type { LogEntry } from '@/components/ConsolePanel';

export type LogsView = 'traces' | 'errors' | 'runtime' | 'http-traces';

export const LOGS_VIEW_ORDER: readonly LogsView[] = ['traces', 'errors', 'runtime', 'http-traces'];

export function parseLogsTab(value: string | null | undefined): LogsView {
  if (value === 'errors' || value === 'error-reports') return 'errors';
  if (value === 'runtime' || value === 'logs' || value === 'history') return 'runtime';
  if (value === 'http-traces' || value === 'httpTraces') return 'http-traces';
  return 'traces';
}

export function formatTraceStartTime(seconds: number): string {
  // New backend format: Unix timestamp in seconds
  if (seconds > 1_000_000_000) {
    return format(new Date(seconds * 1000), 'HH:mm:ss');
  }
  // Legacy format: elapsed/perf_counter seconds (keep old behavior for compatibility)
  const totalSeconds = Math.floor(seconds % 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function parseTraceTimestamp(ts: string, dateStr: string): Date {
  // ts: "05-28 10:01:30", dateStr: "2026-05-28"
  try {
    const [monthDay, time] = ts.split(' ');
    const year = dateStr.split('-')[0];
    const isoStr = `${year}-${monthDay}T${time}`;
    const d = new Date(isoStr);
    if (!Number.isNaN(d.getTime())) return d;
  } catch {
    /* ignore */
  }
  return new Date();
}

export function mapTraceLogLevel(level: string): LogEntry['type'] {
  switch (level.toLowerCase()) {
    case 'trace':
      return 'trace';
    case 'debug':
      return 'debug';
    case 'success':
      return 'success';
    case 'warning':
    case 'warn':
      return 'warning';
    case 'error':
      return 'error';
    case 'critical':
      return 'critical';
    default:
      return 'info';
  }
}
