import { pluginConfigItemToFieldDef } from '@/components/config';
import type { FrameworkConfigListItem, PluginConfigItem } from '@/lib/api';
import { convertPluginConfigValueForSave } from '@/lib/configSaveValue';
import {
  DOMAIN_ORDER,
  type DirtySummary,
  type DomainId,
  type FrameworkSearchHit,
  type KnownConfigRole,
  type RawFrameworkGroup,
} from './types';

function emptyDomainCounts(): Record<DomainId, number> {
  return {
    core: 0,
    runtime: 0,
    database: 0,
    media: 0,
    interaction: 0,
    identity: 0,
  };
}

/**
 * 仅保留框架自身配置：排除备份配置与 GsCore AI 系列配置（后者归属 `/ai-config` / `/persona-config`）。
 */
export function shouldIncludeFrameworkItem(item: FrameworkConfigListItem): boolean {
  const nameLower = (item.name || '').trim().toLowerCase();
  const fullLower = (item.full_name || '').trim().toLowerCase();

  if (
    nameLower === 'backup' ||
    nameLower === '备份配置' ||
    fullLower.includes('backup') ||
    fullLower.includes('备份配置')
  ) {
    return false;
  }

  if (nameLower.startsWith('gscore ai') || fullLower.startsWith('gscore ai')) {
    return false;
  }

  return true;
}

export function classifyConfigRole(
  item: Pick<FrameworkConfigListItem, 'id' | 'name' | 'full_name'>,
): KnownConfigRole {
  const name = (item.name || '').trim();
  const full = (item.full_name || '').trim();
  const combined = `${name} ${full}`.toLowerCase();

  if (name === 'GsCore' || full === 'GsCore' || name === '核心配置' || full === '核心配置') {
    return 'core';
  }
  if (combined.includes('日志') || combined.includes('log')) {
    return 'log';
  }
  if (combined.includes('数据库') || combined.includes('database')) {
    return 'database';
  }
  if (combined.includes('图片上传') || combined.includes('imageupload')) {
    return 'imageUpload';
  }
  if (name === '发送图片' || full.includes('发送图片') || combined.includes('imagesend')) {
    return 'imageSend';
  }
  if (combined.includes('图片生成') || combined.includes('imagegen')) {
    return 'imageGen';
  }
  if (combined.includes('杂项') || combined.includes('misc')) {
    return 'misc';
  }
  if (
    combined.includes('按钮') ||
    combined.includes('markdown') ||
    name === '按钮和MD配置' ||
    full.includes('按钮和MD')
  ) {
    return 'buttonMd';
  }
  if (
    combined.includes('消息缓存') ||
    combined.includes('message_cache') ||
    combined.includes('messagecache')
  ) {
    return 'messageCache';
  }
  if (combined.includes('状态') || combined.includes('state')) {
    return 'state';
  }
  if (combined.includes('验证') || combined.includes('verification')) {
    return 'verification';
  }

  return 'extension';
}

export function roleToDomain(role: KnownConfigRole): DomainId {
  switch (role) {
    case 'systemCore':
      return 'core';
    case 'core':
    case 'log':
      return 'runtime';
    case 'database':
      return 'database';
    case 'imageUpload':
    case 'imageSend':
    case 'imageGen':
      return 'media';
    case 'misc':
    case 'buttonMd':
    case 'messageCache':
      return 'interaction';
    case 'state':
    case 'verification':
    case 'extension':
      return 'identity';
  }
}

function stableSerialize(value: unknown): string {
  if (value === undefined) return '__undefined__';
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`).join(',')}}`;
}

export function isFieldValueEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  return stableSerialize(a) === stableSerialize(b);
}

export function isNonEditableField(item?: PluginConfigItem): boolean {
  if (!item) return true;
  const raw = (item.type || '').toLowerCase();
  return raw === 'gsdivider' || raw === 'gsbutton';
}

export function isFieldModified(
  currentGroup: RawFrameworkGroup | undefined,
  originalGroup: RawFrameworkGroup | undefined,
  fieldKey: string,
): boolean {
  if (!currentGroup || !originalGroup) return false;
  const currItem = currentGroup.config[fieldKey];
  const origItem = originalGroup.config[fieldKey];
  if (!currItem || !origItem || isNonEditableField(currItem)) return false;
  return !isFieldValueEqual(currItem.value, origItem.value);
}

export function computeDirtySummary(
  configs: Record<string, RawFrameworkGroup>,
  originalConfigs: Record<string, RawFrameworkGroup>,
): DirtySummary {
  const domainChangedCounts = emptyDomainCounts();
  const changedFieldsByGroup: Record<string, string[]> = {};
  const changedGroupIds: string[] = [];
  let totalChangedFields = 0;

  // originalConfigs 为空说明首次并发请求尚未落盘，严禁判脏（P-7）
  if (Object.keys(originalConfigs).length === 0) {
    return {
      isDirty: false,
      totalChangedFields: 0,
      changedGroupIds: [],
      domainChangedCounts,
      changedFieldsByGroup,
    };
  }

  for (const [groupId, group] of Object.entries(configs)) {
    const orig = originalConfigs[groupId];
    if (!orig) continue;
    const modifiedKeys: string[] = [];
    for (const [fieldKey, item] of Object.entries(group.config)) {
      if (isNonEditableField(item)) continue;
      const origItem = orig.config[fieldKey];
      if (!origItem) continue;
      if (!isFieldValueEqual(item.value, origItem.value)) {
        modifiedKeys.push(fieldKey);
      }
    }
    if (modifiedKeys.length > 0) {
      changedGroupIds.push(groupId);
      changedFieldsByGroup[groupId] = modifiedKeys;
      domainChangedCounts[group.domain] += modifiedKeys.length;
      totalChangedFields += modifiedKeys.length;
    }
  }

  return {
    isDirty: totalChangedFields > 0,
    totalChangedFields,
    changedGroupIds,
    domainChangedCounts,
    changedFieldsByGroup,
  };
}

/**
 * 将单个配置组转换为后端保存 payload，自动完成 gsint/gsfloat/gslist/gsdict 类型收敛并跳过只读分割线/按钮。
 */
export function buildGroupSavePayload(
  group: RawFrameworkGroup,
  originalGroup?: RawFrameworkGroup,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [fieldKey, item] of Object.entries(group.config)) {
    const def = pluginConfigItemToFieldDef(fieldKey, item);
    const converted = convertPluginConfigValueForSave({
      type: def.type,
      rawType: item.type,
      value: item.value,
    });
    if (converted.skip) continue;

    let finalValue = converted.value;
    if (typeof finalValue === 'number' && Number.isNaN(finalValue)) {
      const origVal = originalGroup?.config[fieldKey]?.value;
      finalValue = typeof origVal === 'number' && !Number.isNaN(origVal) ? origVal : 0;
    }

    payload[fieldKey] = finalValue;
  }

  return payload;
}

export function searchFrameworkFields(
  groups: RawFrameworkGroup[],
  originalConfigs: Record<string, RawFrameworkGroup>,
  rawQuery: string,
  onlyChanged: boolean,
): FrameworkSearchHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query && !onlyChanged) return [];

  const hits: FrameworkSearchHit[] = [];
  const sortedGroups = [...groups].sort(
    (a, b) => DOMAIN_ORDER.indexOf(a.domain) - DOMAIN_ORDER.indexOf(b.domain),
  );

  for (const group of sortedGroups) {
    const orig = originalConfigs[group.id];
    for (const [fieldKey, item] of Object.entries(group.config)) {
      if (isNonEditableField(item)) continue;
      const modified = isFieldModified(group, orig, fieldKey);
      if (onlyChanged && !modified) continue;

      if (query) {
        const title = item.title == null ? '' : String(item.title);
        const desc = item.desc == null ? '' : String(item.desc);
        const valueStr =
          typeof item.value === 'string' || typeof item.value === 'number'
            ? String(item.value)
            : Array.isArray(item.value)
              ? item.value.join(' ')
              : '';
        const haystack = [fieldKey, title, desc, group.name, group.full_name, valueStr]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) continue;
      }

      hits.push({
        domain: group.domain,
        groupId: group.id,
        groupName: group.name,
        groupRole: group.role,
        fieldKey,
        item,
        isModified: modified,
      });
    }
  }

  return hits;
}
