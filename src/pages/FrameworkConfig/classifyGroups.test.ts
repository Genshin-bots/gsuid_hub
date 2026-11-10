import { describe, expect, it } from 'vitest';
import type { PluginConfigItem } from '@/lib/api';
import {
  buildGroupSavePayload,
  classifyConfigRole,
  computeDirtySummary,
  roleToDomain,
  searchFrameworkFields,
  shouldIncludeFrameworkItem,
} from './classifyGroups';
import { buildSystemCoreSavePayload, coreConfigToFrameworkGroup } from './coreConfigAdapter';
import { type RawFrameworkGroup, SYSTEM_CORE_GROUP_ID } from './types';

function field(
  partial: Omit<PluginConfigItem, 'default'> & { default?: unknown },
): PluginConfigItem {
  return {
    default: partial.default ?? partial.value,
    ...partial,
  };
}

function makeGroup(overrides: Partial<RawFrameworkGroup> & { id: string }): RawFrameworkGroup {
  const role =
    overrides.role ??
    classifyConfigRole({
      id: overrides.id,
      name: overrides.name ?? overrides.id,
      full_name: overrides.full_name ?? overrides.id,
    });
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    full_name: overrides.full_name ?? overrides.id,
    role,
    domain: overrides.domain ?? roleToDomain(role),
    config: overrides.config ?? {},
  };
}

describe('FrameworkConfig group classification & filtering', () => {
  it('excludes backup and GsCore AI config groups while keeping core & extension groups', () => {
    expect(shouldIncludeFrameworkItem({ id: '1', name: 'GsCore', full_name: 'GsCore' })).toBe(true);
    expect(
      shouldIncludeFrameworkItem({ id: '2', name: '备份配置', full_name: 'GsCore备份配置' }),
    ).toBe(false);
    expect(shouldIncludeFrameworkItem({ id: '3', name: 'backup', full_name: 'backup' })).toBe(
      false,
    );
    expect(
      shouldIncludeFrameworkItem({
        id: '4',
        name: 'GsCore AI 配置',
        full_name: 'GsCore AI 配置',
      }),
    ).toBe(false);
    expect(
      shouldIncludeFrameworkItem({
        id: '5',
        name: 'GsCore自定义网关',
        full_name: 'GsCore自定义网关',
      }),
    ).toBe(true);
  });

  it('maps all known backend config groups and routes unknown groups to identity/extension', () => {
    const cases = [
      { name: 'GsCore', full_name: 'GsCore', role: 'core', domain: 'runtime' },
      { name: '日志配置', full_name: 'GsCore日志配置', role: 'log', domain: 'runtime' },
      { name: '数据库配置', full_name: 'GsCore数据库配置', role: 'database', domain: 'database' },
      { name: '图片上传配置', full_name: 'GsCore图片上传', role: 'imageUpload', domain: 'media' },
      { name: '发送图片', full_name: '发送图片', role: 'imageSend', domain: 'media' },
      { name: '图片生成配置', full_name: 'GsCore图片生成', role: 'imageGen', domain: 'media' },
      { name: '杂项配置', full_name: '杂项配置', role: 'misc', domain: 'interaction' },
      {
        name: '消息缓存',
        full_name: 'GsCore消息缓存',
        role: 'messageCache',
        domain: 'interaction',
      },
      { name: '按钮和MD配置', full_name: '按钮和MD配置', role: 'buttonMd', domain: 'interaction' },
      { name: '状态配置', full_name: 'GsCore状态配置', role: 'state', domain: 'identity' },
      { name: '验证配置', full_name: '验证配置', role: 'verification', domain: 'identity' },
      {
        name: 'GsCore实验特性',
        full_name: 'GsCore实验特性',
        role: 'extension',
        domain: 'identity',
      },
    ] as const;

    for (const c of cases) {
      const role = classifyConfigRole({ id: c.name, name: c.name, full_name: c.full_name });
      expect(role).toBe(c.role);
      expect(roleToDomain(role)).toBe(c.domain);
    }
  });
});

describe('Dirty summary & save payload conversion', () => {
  it('never reports dirty while originalConfigs is still empty (P-7 race protection)', () => {
    const g = makeGroup({
      id: 'core',
      name: 'GsCore',
      config: { StartVENV: field({ type: 'GsStr', title: '运行环境', desc: '', value: 'uv' }) },
    });
    const summary = computeDirtySummary({ core: g }, {});
    expect(summary.isDirty).toBe(false);
    expect(summary.totalChangedFields).toBe(0);
  });

  it('tracks per-domain and per-group changed fields while ignoring dividers/buttons', () => {
    const orig = makeGroup({
      id: 'core',
      name: 'GsCore',
      config: {
        StartVENV: field({ type: 'GsStr', title: '运行环境', desc: '', value: 'auto' }),
        AutoUpdateCoreTime: field({ type: 'GsList', title: '更新时间', desc: '', value: [3, 40] }),
        sep: field({ type: 'GsDivider', title: '分割', desc: '', value: '' }),
      },
    });
    const curr = makeGroup({
      id: 'core',
      name: 'GsCore',
      config: {
        StartVENV: field({ type: 'GsStr', title: '运行环境', desc: '', value: 'uv' }),
        AutoUpdateCoreTime: field({ type: 'GsList', title: '更新时间', desc: '', value: [4, 0] }),
        sep: field({ type: 'GsDivider', title: '分割', desc: '', value: 'changed' }),
      },
    });

    const summary = computeDirtySummary({ core: curr }, { core: orig });
    expect(summary.isDirty).toBe(true);
    expect(summary.totalChangedFields).toBe(2);
    expect(summary.domainChangedCounts.runtime).toBe(2);
    expect(summary.changedFieldsByGroup.core).toEqual(['StartVENV', 'AutoUpdateCoreTime']);
  });

  it('coerces gsint/gsfloat/gslist/gsdict and falls back safely on empty numeric string', () => {
    const orig = makeGroup({
      id: 'db',
      name: '数据库配置',
      config: {
        db_pool_size: field({ type: 'GsInt', title: '连接池', desc: '', value: 5 }),
      },
    });
    const curr = makeGroup({
      id: 'db',
      name: '数据库配置',
      config: {
        db_pool_size: field({ type: 'GsInt', title: '连接池', desc: '', value: '' }),
        ButtonRow: field({
          type: 'GsInt',
          title: '每行按钮',
          desc: '',
          value: '3',
          options: ['1', '3'],
        }),
        AutoTime: field({ type: 'GsList', title: '时间', desc: '', value: ['3', '30'] }),
        ExtraDict: field({ type: 'GsDict', title: '字典', desc: '', value: '{"timeout":10}' }),
        Header: field({ type: 'GsDivider', title: '分隔', desc: '', value: null }),
      },
    });

    expect(buildGroupSavePayload(curr, orig)).toEqual({
      db_pool_size: 5,
      ButtonRow: 3,
      AutoTime: [3, 30],
      ExtraDict: { timeout: 10 },
    });
  });

  it('searches across field keys, titles, descriptions, and supports onlyChanged filter', () => {
    const orig = makeGroup({
      id: 'db',
      name: '数据库配置',
      config: {
        db_type: field({
          type: 'GsStr',
          title: '数据库类型',
          desc: '选择存储引擎',
          value: 'SQLite',
        }),
        sqlite_cache_size: field({
          type: 'GsInt',
          title: 'SQLite 缓存大小',
          desc: '页缓存负数为 KiB',
          value: -64000,
        }),
      },
    });
    const curr = makeGroup({
      id: 'db',
      name: '数据库配置',
      config: {
        ...orig.config,
        db_type: { ...orig.config.db_type, value: 'PostgreSQL' },
      },
    });

    const keywordHits = searchFrameworkFields([curr], { db: orig }, 'kib', false);
    expect(keywordHits).toHaveLength(1);
    expect(keywordHits[0].fieldKey).toBe('sqlite_cache_size');
    expect(keywordHits[0].isModified).toBe(false);

    const modifiedHits = searchFrameworkFields([curr], { db: orig }, '', true);
    expect(modifiedHits).toHaveLength(1);
    expect(modifiedHits[0].fieldKey).toBe('db_type');
    expect(modifiedHits[0].isModified).toBe(true);
  });
});

describe('System Core (/api/core/config) adapter', () => {
  it('flattens nested log fields, marks secret tokens, and re-nests payload on save', () => {
    const rawCore = {
      HOST: '0.0.0.0',
      PORT: '8765',
      ENABLE_HTTP: true,
      WS_TOKEN: 'secret-token',
      web_max_sessions: 3,
      masters: ['10001'],
      log: {
        level: 'INFO',
        output: ['stdout', 'file'],
        module: true,
      },
    };
    const meta = {
      LANGUAGE: {
        type: 'strictselect',
        options: ['zh-cn', 'en'],
      },
    };

    const origGroup = coreConfigToFrameworkGroup(rawCore, meta, (k) => k);
    expect(origGroup.id).toBe(SYSTEM_CORE_GROUP_ID);
    expect(origGroup.domain).toBe('core');
    expect(roleToDomain(origGroup.role)).toBe('core');
    expect(origGroup.config.WS_TOKEN.secret).toBe(true);
    expect(origGroup.config.log_level.value).toBe('INFO');
    expect(origGroup.config.log_output.value).toEqual(['stdout', 'file']);
    expect(origGroup.config.log_module.value).toBe(true);

    const editedGroup: RawFrameworkGroup = {
      ...origGroup,
      config: {
        ...origGroup.config,
        PORT: { ...origGroup.config.PORT, value: '9000' },
        web_max_sessions: { ...origGroup.config.web_max_sessions, value: '' },
        log_level: { ...origGroup.config.log_level, value: 'DEBUG' },
      },
    };

    const dirty = computeDirtySummary(
      { [SYSTEM_CORE_GROUP_ID]: editedGroup },
      { [SYSTEM_CORE_GROUP_ID]: origGroup },
    );
    expect(dirty.domainChangedCounts.core).toBe(3);

    const savedPayload = buildSystemCoreSavePayload(editedGroup, origGroup);
    expect(savedPayload).toEqual({
      HOST: '0.0.0.0',
      PORT: '9000',
      ENABLE_HTTP: true,
      WS_TOKEN: 'secret-token',
      web_max_sessions: 3,
      masters: ['10001'],
      log: {
        level: 'DEBUG',
        output: ['stdout', 'file'],
        module: true,
      },
    });
  });
});
