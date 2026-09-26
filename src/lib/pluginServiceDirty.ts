import type { ServiceConfig, SvItem } from '@/lib/api';

function finiteNumber(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 只比较表单真正展示的字段。enabled 由单独的开关状态传入。 */
export function serviceConfigSnapshot(cfg: Partial<ServiceConfig> | null | undefined) {
  const prefix = Array.isArray(cfg?.prefix) ? cfg.prefix.filter((item) => item !== '') : [];
  return {
    pm: finiteNumber(cfg?.pm),
    priority: finiteNumber(cfg?.priority),
    area: cfg?.area || 'ALL',
    black_list: cfg?.black_list || [],
    white_list: cfg?.white_list || [],
    prefix,
    force_prefix: cfg?.force_prefix || [],
    disable_force_prefix: !!cfg?.disable_force_prefix,
    allow_empty_prefix: !!cfg?.allow_empty_prefix,
  };
}

export function isPluginServiceDirty(
  edited: Partial<ServiceConfig> | null | undefined,
  original: Partial<ServiceConfig> | null | undefined,
  editedEnabled: boolean,
  originalEnabled: boolean,
) {
  const fieldsChanged =
    JSON.stringify(serviceConfigSnapshot(edited)) !== JSON.stringify(serviceConfigSnapshot(original));
  return fieldsChanged || editedEnabled !== originalEnabled;
}

export function isSvListDirty(edited: SvItem[] | null | undefined, original: SvItem[] | null | undefined) {
  return JSON.stringify(edited ?? []) !== JSON.stringify(original ?? []);
}
