import type {
  PersonaJobStatus,
  PersonaJobStep,
  PersonaJobView,
  PersonaResetItemGroup,
  PersonaResetItemKey,
  PersonaResetItemPreview,
} from '@/lib/api';

export const PERSONA_JOB_POLL_INTERVAL_MS = 1000;

type ItemGroupRef = Pick<PersonaResetItemPreview, 'key' | 'group'>;

/** 重置勾选状态：B 组（global）首次勾选先挂起，二次确认后才真正勾上。 */
export interface ResetSelectionState {
  checked: PersonaResetItemKey[];
  globalConfirmed: boolean;
  pendingGlobal: PersonaResetItemKey | null;
}

function groupOf(items: readonly ItemGroupRef[], key: PersonaResetItemKey): PersonaResetItemGroup {
  return items.find((item) => item.key === key)?.group ?? 'persona';
}

export function initialResetSelection(
  items: readonly Pick<PersonaResetItemPreview, 'key' | 'group' | 'default_checked'>[],
): ResetSelectionState {
  const checked = items.filter((item) => item.default_checked).map((item) => item.key);
  // 后端若默认勾了全局项，视为已确认，避免一打开就弹确认框
  const globalConfirmed = items.some((item) => item.default_checked && item.group === 'global');
  return { checked, globalConfirmed, pendingGlobal: null };
}

export function toggleResetItem(
  state: ResetSelectionState,
  items: readonly ItemGroupRef[],
  key: PersonaResetItemKey,
  next: boolean,
): ResetSelectionState {
  const isGlobal = groupOf(items, key) === 'global';
  if (next) {
    if (state.checked.includes(key)) return state;
    if (isGlobal && !state.globalConfirmed) return { ...state, pendingGlobal: key };
    return { ...state, checked: [...state.checked, key] };
  }
  const checked = state.checked.filter((k) => k !== key);
  const anyGlobalLeft = checked.some((k) => groupOf(items, k) === 'global');
  return {
    checked,
    globalConfirmed: anyGlobalLeft ? state.globalConfirmed : false,
    pendingGlobal: state.pendingGlobal === key ? null : state.pendingGlobal,
  };
}

export function confirmPendingGlobal(state: ResetSelectionState): ResetSelectionState {
  if (!state.pendingGlobal) return state;
  const key = state.pendingGlobal;
  return {
    checked: state.checked.includes(key) ? state.checked : [...state.checked, key],
    globalConfirmed: true,
    pendingGlobal: null,
  };
}

export function cancelPendingGlobal(state: ResetSelectionState): ResetSelectionState {
  return state.pendingGlobal ? { ...state, pendingGlobal: null } : state;
}

export interface BackupEstimate {
  seconds: number;
  bytes: number;
  supportedCount: number;
  unsupported: PersonaResetItemKey[];
}

export function estimateBackup(
  items: readonly PersonaResetItemPreview[],
  checked: readonly PersonaResetItemKey[],
): BackupEstimate {
  const selected = items.filter((item) => checked.includes(item.key));
  const supported = selected.filter((item) => item.backup_supported);
  return {
    seconds: supported.reduce((sum, item) => sum + Math.max(0, item.backup_seconds), 0),
    bytes: supported.reduce((sum, item) => sum + Math.max(0, item.backup_bytes), 0),
    supportedCount: supported.length,
    unsupported: selected.filter((item) => !item.backup_supported).map((item) => item.key),
  };
}

export type DurationUnit = 'lessThanSecond' | 'seconds' | 'minutes' | 'hours';

export interface DurationParts {
  unit: DurationUnit;
  value: number;
}

/** 秒数一律向上取整，再按「秒 / 分钟 / 小时（一位小数）」挑最大单位。 */
export function humanizeSeconds(seconds: number): DurationParts {
  const total = Number.isFinite(seconds) ? Math.ceil(seconds) : 0;
  if (total <= 0) return { unit: 'lessThanSecond', value: 1 };
  if (total < 60) return { unit: 'seconds', value: total };
  if (total < 3600) return { unit: 'minutes', value: Math.ceil(total / 60) };
  return { unit: 'hours', value: Math.ceil(total / 360) / 10 };
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export function formatDuration(t: Translate, seconds: number): string {
  const parts = humanizeSeconds(seconds);
  return t(`personaReset.duration.${parts.unit}`, { value: parts.value });
}

/** 翻译 key 缺失时 `t` 原样返回 key，借此判断是否有对应文案。 */
function tryTranslate(t: Translate, key: string): string | null {
  const value = t(key);
  return value === key ? null : value;
}

export function resetItemLabel(t: Translate, key: string): string {
  return tryTranslate(t, `personaReset.items.${key}.name`) ?? key;
}

/** counts 的 key 可能是勾选项也可能是步骤 / 表名；都翻不到就原样显示。 */
export function countKeyLabel(t: Translate, key: string): string {
  return (
    tryTranslate(t, `personaReset.items.${key}.name`) ??
    tryTranslate(t, `personaReset.steps.${key}`) ??
    key
  );
}

export function formatBytes(bytes: number): string {
  const size = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** 单步完成比例；`null` 表示进行中但总量未知（显示不定进度）。 */
export function jobStepFraction(step: PersonaJobStep): number | null {
  switch (step.status) {
    case 'done':
      return 1;
    case 'pending':
    case 'skipped':
      return 0;
    case 'running':
    case 'failed':
      if (step.total > 0) return Math.min(1, Math.max(0, step.done / step.total));
      return step.status === 'running' ? null : 0;
  }
}

export function jobOverallPercent(job: Pick<PersonaJobView, 'status' | 'steps'>): number {
  if (job.status === 'done') return 100;
  const counted = job.steps.filter((step) => step.status !== 'skipped');
  if (counted.length === 0) return 0;
  const sum = counted.reduce((acc, step) => acc + (jobStepFraction(step) ?? 0), 0);
  return Math.min(100, Math.round((sum / counted.length) * 100));
}

export function isJobPolling(status: PersonaJobStatus): boolean {
  return status === 'running';
}
