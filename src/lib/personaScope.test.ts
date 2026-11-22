import { describe, expect, it } from 'vitest';
import type { PersonaConfig } from '@/lib/api';
import {
  findChannelConflicts,
  hasChannelConflicts,
  isPersonaScopeEnabled,
  resolveChannelScopes,
} from './personaScope';

function makeConfig(overrides: Partial<PersonaConfig> = {}): PersonaConfig {
  return {
    ai_mode: ['提及应答'],
    scope: 'disabled',
    target_groups: [],
    ...overrides,
  };
}

describe('personaScope dual-channel helpers', () => {
  it('maps legacy scope values using Strategy A when channel fields are absent', () => {
    expect(resolveChannelScopes(makeConfig({ scope: 'global' }))).toEqual({
      group_scope: 'all',
      private_scope: 'all',
    });
    expect(resolveChannelScopes(makeConfig({ scope: 'global_group' }))).toEqual({
      group_scope: 'all',
      private_scope: 'off',
    });
    expect(resolveChannelScopes(makeConfig({ scope: 'global_private' }))).toEqual({
      group_scope: 'off',
      private_scope: 'all',
    });
    expect(resolveChannelScopes(makeConfig({ scope: 'specific' }))).toEqual({
      group_scope: 'specific',
      private_scope: 'off',
    });
    expect(resolveChannelScopes(makeConfig({ scope: 'disabled' }))).toEqual({
      group_scope: 'off',
      private_scope: 'off',
    });
  });

  it('prefers explicit dual-channel scopes including mixed global private + specific groups', () => {
    const cfg = makeConfig({
      scope: 'specific',
      group_scope: 'specific',
      private_scope: 'all',
      target_groups: ['group_1'],
    });
    expect(resolveChannelScopes(cfg)).toEqual({
      group_scope: 'specific',
      private_scope: 'all',
    });
    expect(isPersonaScopeEnabled(cfg)).toBe(true);
    expect(isPersonaScopeEnabled(makeConfig({ group_scope: 'off', private_scope: 'off' }))).toBe(
      false,
    );
  });

  it('checks conflicts independently per channel', () => {
    const configs: Record<string, PersonaConfig> = {
      alpha: makeConfig({ group_scope: 'all', private_scope: 'all' }),
      beta: makeConfig({ group_scope: 'specific', private_scope: 'off' }),
    };

    // 设置 beta 为全部私聊：只与 alpha 的 private 通道冲突，不触碰 alpha 的 group 通道
    const privateOnly = findChannelConflicts(configs, 'beta', { private_scope: 'all' });
    expect(privateOnly).toEqual({ group: [], private: ['alpha'] });
    expect(hasChannelConflicts(privateOnly)).toBe(true);

    // 另一人格只占群聊时，设置私聊全开不冲突
    const splitConfigs: Record<string, PersonaConfig> = {
      groupOnly: makeConfig({ group_scope: 'all', private_scope: 'off' }),
      dmAndPartGroup: makeConfig({ group_scope: 'specific', private_scope: 'off' }),
    };
    const noConflict = findChannelConflicts(splitConfigs, 'dmAndPartGroup', {
      group_scope: 'specific',
      private_scope: 'all',
    });
    expect(hasChannelConflicts(noConflict)).toBe(false);

    // 双通道均设为 all 时分别报告两通道冲突
    const both = findChannelConflicts(configs, 'beta', {
      group_scope: 'all',
      private_scope: 'all',
    });
    expect(both).toEqual({ group: ['alpha'], private: ['alpha'] });
  });
});
