import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getAuthToken: () => null,
  getCustomApiHost: () => '',
}));

import {
  buildHubThemeMessage,
  collectHubThemeVarsFromComputed,
  GSHUB_THEME_MESSAGE,
  isHubThemeMessage,
  isHubThemeRequest,
  matchPluginListId,
  pickPluginPageText,
  pluginPageSkipKey,
  pluginsListPath,
  readPluginsListPluginId,
  setSkipPluginPageConfirm,
  shouldSkipPluginPageConfirm,
} from './pluginPage';

const mem = new Map<string, string>();

beforeAll(() => {
  const store: Storage = {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (key: string) => (mem.has(key) ? mem.get(key)! : null),
    key: (index: number) => Array.from(mem.keys())[index] ?? null,
    removeItem: (key: string) => {
      mem.delete(key);
    },
    setItem: (key: string, value: string) => {
      mem.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
});

describe('plugin page confirm skip', () => {
  afterEach(() => {
    localStorage.removeItem(pluginPageSkipKey('zzzerouid', 'console'));
  });

  it('defaults to showing the confirm dialog', () => {
    expect(shouldSkipPluginPageConfirm('zzzerouid', 'console')).toBe(false);
  });

  it('persists skip per plugin + page', () => {
    setSkipPluginPageConfirm('zzzerouid', 'console', true);
    expect(shouldSkipPluginPageConfirm('zzzerouid', 'console')).toBe(true);
    expect(shouldSkipPluginPageConfirm('zzzerouid', 'other')).toBe(false);
    setSkipPluginPageConfirm('zzzerouid', 'console', false);
    expect(shouldSkipPluginPageConfirm('zzzerouid', 'console')).toBe(false);
  });
});

describe('pickPluginPageText', () => {
  const map = {
    'zh-CN': '抽卡与角色管理',
    'en-US': 'Gacha & Agents',
    'ja-JP': 'ガチャとエージェント',
  };

  it('picks the active locale', () => {
    expect(pickPluginPageText(map, 'en-US')).toBe('Gacha & Agents');
    expect(pickPluginPageText(map, 'zh-CN')).toBe('抽卡与角色管理');
  });

  it('falls back to zh-CN then first value', () => {
    expect(pickPluginPageText({ 'zh-CN': '中文' }, 'ja-JP', 'x')).toBe('中文');
    expect(pickPluginPageText(undefined, 'zh-CN', 'fallback')).toBe('fallback');
  });
});

describe('plugins list path', () => {
  it('round-trips the selected plugin id', () => {
    expect(pluginsListPath('zzzerouid')).toBe('/plugins?plugin=zzzerouid');
    expect(readPluginsListPluginId('?plugin=zzzerouid')).toBe('zzzerouid');
    expect(readPluginsListPluginId('')).toBe('');
  });

  it('matches list id by name or slug', () => {
    const plugins = [
      { id: 'gscore_mail', name: 'gscore_mail' },
      { id: 'zzzerouid', name: 'ZZZeroUID' },
    ];
    expect(matchPluginListId(plugins, 'ZZZeroUID')).toBe('zzzerouid');
    expect(matchPluginListId(plugins, 'zzzerouid')).toBe('zzzerouid');
    expect(matchPluginListId(plugins, 'missing')).toBe('');
  });
});

describe('hub theme bridge', () => {
  it('collects known CSS variables', () => {
    const vars = collectHubThemeVarsFromComputed({
      getPropertyValue: (name: string) => (name === '--background' ? ' 240 5% 10% ' : ''),
    });
    expect(vars['--background']).toBe('240 5% 10%');
    expect(vars['--foreground']).toBeUndefined();
  });

  it('builds and recognizes theme messages', () => {
    const msg = buildHubThemeMessage({
      mode: 'dark',
      style: 'glassmorphism',
      iconColor: 'colored',
      color: 'red',
      vars: { '--primary': '333 71% 50%' },
    });
    expect(msg.type).toBe(GSHUB_THEME_MESSAGE);
    expect(isHubThemeMessage(msg)).toBe(true);
    expect(isHubThemeMessage({ type: 'nope' })).toBe(false);
    expect(isHubThemeRequest({ type: 'gshub:theme-request' })).toBe(true);
    expect(isHubThemeRequest({ type: GSHUB_THEME_MESSAGE })).toBe(false);
  });
});
