import type { ChannelScope, PersonaConfig, PersonaScope } from '@/lib/api';

export type PersonaChannel = 'group' | 'private';

export interface ResolvedChannelScopes {
  group_scope: ChannelScope;
  private_scope: ChannelScope;
}

export interface ChannelConflicts {
  group: string[];
  private: string[];
}

function normalizeChannelScope(raw: unknown): ChannelScope {
  if (raw === 'off' || raw === 'specific' || raw === 'all') return raw;
  return 'off';
}

/** 兼容旧单字段 scope（方案 A：specific 仅映群聊，私聊为 off）。 */
export function legacyScopeToChannels(scope?: PersonaScope): ResolvedChannelScopes {
  switch (scope) {
    case 'global':
      return { group_scope: 'all', private_scope: 'all' };
    case 'global_group':
      return { group_scope: 'all', private_scope: 'off' };
    case 'global_private':
      return { group_scope: 'off', private_scope: 'all' };
    case 'specific':
      return { group_scope: 'specific', private_scope: 'off' };
    default:
      return { group_scope: 'off', private_scope: 'off' };
  }
}

export function resolveChannelScopes(
  config?: Pick<PersonaConfig, 'scope' | 'group_scope' | 'private_scope'>,
): ResolvedChannelScopes {
  if (!config) return { group_scope: 'off', private_scope: 'off' };
  if (config.group_scope !== undefined || config.private_scope !== undefined) {
    return {
      group_scope: normalizeChannelScope(config.group_scope),
      private_scope: normalizeChannelScope(config.private_scope),
    };
  }
  return legacyScopeToChannels(config.scope);
}

export function isPersonaScopeEnabled(
  config?: Pick<PersonaConfig, 'scope' | 'group_scope' | 'private_scope'>,
): boolean {
  const { group_scope, private_scope } = resolveChannelScopes(config);
  return group_scope !== 'off' || private_scope !== 'off';
}

/** 按通道独立检查全局冲突：群聊 all 与私聊 all 互不互斥。 */
export function findChannelConflicts(
  configs: Record<string, PersonaConfig>,
  personaName: string,
  next: Partial<ResolvedChannelScopes>,
): ChannelConflicts {
  const group: string[] = [];
  const priv: string[] = [];
  if (next.group_scope !== 'all' && next.private_scope !== 'all') {
    return { group, private: priv };
  }
  for (const [otherName, cfg] of Object.entries(configs)) {
    if (otherName === personaName) continue;
    const other = resolveChannelScopes(cfg);
    if (next.group_scope === 'all' && other.group_scope === 'all') {
      group.push(otherName);
    }
    if (next.private_scope === 'all' && other.private_scope === 'all') {
      priv.push(otherName);
    }
  }
  return { group, private: priv };
}

export function hasChannelConflicts(conflicts: ChannelConflicts): boolean {
  return conflicts.group.length > 0 || conflicts.private.length > 0;
}
