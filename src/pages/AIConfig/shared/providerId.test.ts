import { describe, expect, it } from 'vitest';
import type { LocalFrameworkConfig } from '../types';
import {
  getExcludedKeysForProvider,
  isMcpProviderId,
  resolveProviderFrameworkConfig,
} from './providerId';

function makeCfg(name: string, full_name = `GsCore AI ${name}`): LocalFrameworkConfig {
  return {
    id: full_name,
    name,
    full_name,
    config: {},
  };
}

describe('resolveProviderFrameworkConfig', () => {
  const configs: Record<string, LocalFrameworkConfig> = {
    'GsCore AI AI配置': makeCfg('AI配置'),
    'GsCore AI OpenAI嵌入模型配置': makeCfg('OpenAI嵌入模型配置'),
    'GsCore AI Tavily搜索配置': makeCfg('Tavily搜索配置'),
    'GsCore AI Exa搜索配置': makeCfg('Exa搜索配置'),
    'GsCore AI AnySearch搜索配置': makeCfg('AnySearch搜索配置'),
    'GsCore AI Firecrawl搜索配置': makeCfg('Firecrawl搜索配置'),
    'GsCore AI Keenable搜索抓取配置': makeCfg('Keenable搜索抓取配置'),
    'GsCore AI Jina搜索抓取配置': makeCfg('Jina搜索抓取配置'),
    'GsCore AI DeepSeek搜索抓取配置': makeCfg('DeepSeek搜索抓取配置'),
    'GsCore AI MiniMax搜索配置': makeCfg('MiniMax搜索配置'),
    'GsCore AI WebFetch抓取配置': makeCfg('WebFetch抓取配置'),
    'GsCore AI FutureEngine搜索配置': makeCfg('FutureEngine搜索配置'),
    'GsCore AI FutureReader抓取配置': makeCfg('FutureReader抓取配置'),
  };

  it('resolves existing, Keenable, and arbitrary future search/fetch providers dynamically', () => {
    expect(resolveProviderFrameworkConfig(configs, 'Keenable', 'search')?.name).toBe(
      'Keenable搜索抓取配置',
    );
    expect(resolveProviderFrameworkConfig(configs, 'Keenable', 'fetch')?.name).toBe(
      'Keenable搜索抓取配置',
    );
    expect(resolveProviderFrameworkConfig(configs, 'Tavily', 'search')?.name).toBe(
      'Tavily搜索配置',
    );
    expect(resolveProviderFrameworkConfig(configs, 'Jina', 'search')?.name).toBe(
      'Jina搜索抓取配置',
    );
    expect(resolveProviderFrameworkConfig(configs, 'DeepSeek', 'fetch')?.name).toBe(
      'DeepSeek搜索抓取配置',
    );
    expect(resolveProviderFrameworkConfig(configs, 'local', 'fetch')?.name).toBe(
      'WebFetch抓取配置',
    );
    expect(resolveProviderFrameworkConfig(configs, 'FutureEngine', 'search')?.name).toBe(
      'FutureEngine搜索配置',
    );
    expect(resolveProviderFrameworkConfig(configs, 'FutureReader', 'fetch')?.name).toBe(
      'FutureReader抓取配置',
    );
  });

  it('returns undefined for MCP and never matches global non-provider configs', () => {
    expect(isMcpProviderId('MCP')).toBe(true);
    expect(resolveProviderFrameworkConfig(configs, 'MCP', 'search')).toBeUndefined();
    expect(resolveProviderFrameworkConfig(configs, 'AI', 'search')).toBeUndefined();
    expect(resolveProviderFrameworkConfig(configs, 'OpenAI', 'search')).toBeUndefined();
    expect(resolveProviderFrameworkConfig(configs, 'UnknownProvider', 'search')).toBeUndefined();
  });

  it('returns excluded legacy keys only for exa', () => {
    expect(getExcludedKeysForProvider('Exa')).toEqual(['search_type']);
    expect(getExcludedKeysForProvider('Keenable')).toBeUndefined();
  });
});
