import type { SessionLogDetail, SessionLogSummary } from '@/lib/api';

export interface SessionTimeTooltipLabels {
  createdAt: string;
  updatedAt: string;
}

/** 列表卡片主展示时间：优先最后更新时间，旧日志缺失时回退创建时间 */
export function getSessionActivityTimeStr(
  log: Pick<SessionLogSummary, 'updated_at_str' | 'created_at_str'>,
): string {
  return log.updated_at_str || log.created_at_str || '';
}

/** "2026-07-09 09:44:51" → "07-09 09:44" */
export function formatSessionShortTime(
  log: Pick<SessionLogSummary, 'updated_at_str' | 'created_at_str'>,
): string {
  const timeStr = getSessionActivityTimeStr(log);
  return timeStr ? timeStr.slice(5, 16) : '';
}

/** 详情头部主时间戳（秒）：取链卡片与已加载最新分段的最新更新时间，缺失时回退创建时间 */
export function getSessionActivityTimestamp(
  card: Pick<SessionLogSummary, 'updated_at' | 'created_at'>,
  detail?: Pick<SessionLogDetail, 'updated_at' | 'created_at'> | null,
): number {
  const updated = Math.max(card.updated_at || 0, detail?.updated_at || 0);
  return updated || card.created_at || detail?.created_at || 0;
}

export function formatSessionTimestamp(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function buildSessionTimeTooltip(
  createdStr: string | null | undefined,
  updatedStr: string | null | undefined,
  labels: SessionTimeTooltipLabels,
): string {
  const created = createdStr || '';
  const updated = updatedStr || '';
  if (updated && created && updated !== created) {
    return `${labels.updatedAt}: ${updated}\n${labels.createdAt}: ${created}`;
  }
  if (updated) return `${labels.updatedAt}: ${updated}`;
  if (created) return `${labels.createdAt}: ${created}`;
  return '';
}
