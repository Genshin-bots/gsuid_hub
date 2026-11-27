import { describe, expect, it } from 'vitest';
import type { PluginConfigItem } from '@/lib/api';
import { pluginConfigItemToFieldDef } from './DynamicConfigPanel';

describe('pluginConfigItemToFieldDef', () => {
  it('preserves string array value for gsliststr with options (multiselect)', () => {
    const item: PluginConfigItem = {
      type: 'GsListStr',
      title: 'Rerank模型API密钥',
      desc: '指定远程 Rerank API 密钥，local 模式无需配置',
      value: ['sk-test-123'],
      default: ['sk-'],
      options: ['sk-'],
    };

    const def = pluginConfigItemToFieldDef('api_key', item);
    expect(def.type).toBe('multiselect');
    expect(def.value).toEqual(['sk-test-123']);
    expect(def.options).toEqual(['sk-']);
  });

  it('preserves string array value for gsliststr without options (tags)', () => {
    const item: PluginConfigItem = {
      type: 'GsListStr',
      title: 'Tavily API密钥',
      desc: '',
      value: ['tvly-abc'],
      default: [],
    };

    const def = pluginConfigItemToFieldDef('api_key', item);
    expect(def.type).toBe('tags');
    expect(def.value).toEqual(['tvly-abc']);
    expect(def.options).toBeUndefined();
  });

  it('returns empty array for non-array multiselect value', () => {
    const item: PluginConfigItem = {
      type: 'GsListStr',
      title: 'Rerank模型API密钥',
      desc: '',
      value: null,
      default: [],
      options: ['sk-'],
    };

    const def = pluginConfigItemToFieldDef('api_key', item);
    expect(def.type).toBe('multiselect');
    expect(def.value).toEqual([]);
  });

  it('preserves tuple values for gstimer and gstimerange', () => {
    const timeItem: PluginConfigItem = {
      type: 'GsTimeR',
      title: '定时时间',
      desc: '',
      value: [8, 30],
      default: [8, 30],
    };
    const rangeItem: PluginConfigItem = {
      type: 'GsTimeRange',
      title: '时间范围',
      desc: '',
      value: [
        [9, 0],
        [18, 30],
      ],
      default: [
        [9, 0],
        [18, 30],
      ],
    };

    expect(pluginConfigItemToFieldDef('run_at', timeItem).value).toEqual([8, 30]);
    expect(pluginConfigItemToFieldDef('active_range', rangeItem).value).toEqual([
      [9, 0],
      [18, 30],
    ]);
  });
});
