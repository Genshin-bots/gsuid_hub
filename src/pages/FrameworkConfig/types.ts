import type { ConfigValue } from '@/components/config';
import type { CoreConfigOptionMeta, FrameworkConfigListItem, PluginConfigItem } from '@/lib/api';

export type DomainId = 'core' | 'runtime' | 'database' | 'media' | 'interaction' | 'identity';

export const DOMAIN_ORDER: readonly DomainId[] = [
  'core',
  'runtime',
  'database',
  'media',
  'interaction',
  'identity',
] as const;

export const SYSTEM_CORE_GROUP_ID = '__system_core__';

export type KnownConfigRole =
  | 'systemCore'
  | 'core'
  | 'log'
  | 'database'
  | 'imageUpload'
  | 'imageSend'
  | 'imageGen'
  | 'misc'
  | 'buttonMd'
  | 'messageCache'
  | 'state'
  | 'verification'
  | 'extension';

export interface RawFrameworkGroup extends FrameworkConfigListItem {
  role: KnownConfigRole;
  domain: DomainId;
  config: Record<string, PluginConfigItem>;
}

export interface DirtySummary {
  isDirty: boolean;
  totalChangedFields: number;
  changedGroupIds: string[];
  domainChangedCounts: Record<DomainId, number>;
  changedFieldsByGroup: Record<string, string[]>;
}

export interface FrameworkSearchHit {
  domain: DomainId;
  groupId: string;
  groupName: string;
  groupRole: KnownConfigRole;
  fieldKey: string;
  item: PluginConfigItem;
  isModified: boolean;
}

export interface FrameworkSectionSharedProps {
  groups: RawFrameworkGroup[];
  originalConfigs: Record<string, RawFrameworkGroup>;
  changedFieldsByGroup: Record<string, string[]>;
  coreOptionsMeta?: Record<string, CoreConfigOptionMeta>;
  onUpdateField: (groupId: string, fieldKey: string, value: ConfigValue | unknown) => void;
  onBatchUpdateFields: (groupId: string, patch: Record<string, unknown>) => void;
  onResetField: (groupId: string, fieldKey: string) => void;
  onResetGroup: (groupId: string) => void;
}
