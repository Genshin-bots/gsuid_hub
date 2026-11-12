import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const mockGetRecentPlugins = vi.fn();
const mockRecordRecentPlugin = vi.fn();

vi.mock('@/lib/api', () => ({
  getAuthToken: () => null,
  getCustomApiHost: () => '',
  pluginsApi: {
    getRecentPlugins: (...args: unknown[]) => mockGetRecentPlugins(...args),
    recordRecentPlugin: (...args: unknown[]) => mockRecordRecentPlugin(...args),
  },
}));

import {
  buildHubThemeMessage,
  collectHubThemeVarsFromComputed,
  fetchSharedPluginPrefs,
  getPluginAvatarGradient,
  getPluginInitials,
  getSharedRecentPluginsSnapshot,
  GSHUB_THEME_MESSAGE,
  isHubThemeMessage,
  isHubThemeRequest,
  LAST_EDITED_PLUGIN_KEY,
  matchPluginListId,
  orderPluginsByUsage,
  pickPluginPageText,
  pluginPageSkipKey,
  pluginsListPath,
  pushLocalRecentPlugin,
  readLastEditedPluginId,
  readLocalRecentPlugins,
  readPluginsListPluginId,
  RECENT_PLUGINS_KEY,
  recordSharedRecentPlugin,
  resolveInitialPluginId,
  resolveRecentPluginItems,
  setLastEditedPluginId,
  setSkipPluginPageConfirm,
  shouldSkipPluginPageConfirm,
  stepGridHighlightIndex,
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

describe('last edited plugin persistence & initial resolution', () => {
  const plugins = [
    { id: 'core_command', name: 'core_command' },
    { id: 'gscore_mail', name: 'gscore_mail' },
    { id: 'zzzerouid', name: 'ZZZeroUID' },
  ];

  afterEach(() => {
    localStorage.removeItem(LAST_EDITED_PLUGIN_KEY);
  });

  it('persists and reads last edited plugin id and ignores blank input', () => {
    expect(readLastEditedPluginId()).toBe('');
    setLastEditedPluginId('gscore_mail');
    expect(readLastEditedPluginId()).toBe('gscore_mail');
    setLastEditedPluginId('   ');
    expect(readLastEditedPluginId()).toBe('gscore_mail');
  });

  it('prioritizes URL ?plugin= over session, backend, and local lastEdited', () => {
    setLastEditedPluginId('gscore_mail');
    expect(
      resolveInitialPluginId(plugins, '?plugin=ZZZeroUID', 'core_command', 'gscore_mail'),
    ).toBe('zzzerouid');
  });

  it('keeps valid currentSelectedId before falling back to backend or local lastEdited', () => {
    setLastEditedPluginId('zzzerouid');
    expect(resolveInitialPluginId(plugins, '', 'gscore_mail', 'zzzerouid')).toBe('gscore_mail');
  });

  it('prefers backend lastEditedPlugin over stale local storage and falls back to local when empty', () => {
    setLastEditedPluginId('gscore_mail');
    expect(resolveInitialPluginId(plugins, '', '', 'ZZZeroUID')).toBe('zzzerouid');
    expect(resolveInitialPluginId(plugins, '', '', '')).toBe('gscore_mail');
  });

  it('falls back to first plugin when last edited plugin was uninstalled', () => {
    setLastEditedPluginId('removed_plugin');
    expect(resolveInitialPluginId(plugins, '', '', 'also_removed')).toBe('core_command');
    expect(resolveInitialPluginId([], '')).toBe('');
  });
});

describe('plugin grid selector MRU & navigation helpers', () => {
  const items = [
    { id: 'core', name: '核心功能', iconName: 'gsuid_core' },
    { id: 'mail', name: 'gscore_mail' },
    { id: 'zzz', name: 'ZZZeroUID' },
    { id: 'sr', name: 'StarRailUID' },
    { id: 'gs', name: 'GenshinUID' },
    { id: 'stock', name: 'SayuStock' },
  ];

  afterEach(() => {
    localStorage.removeItem(RECENT_PLUGINS_KEY);
    localStorage.removeItem(LAST_EDITED_PLUGIN_KEY);
    mockGetRecentPlugins.mockReset();
    mockRecordRecentPlugin.mockReset();
  });

  it('preserves caller order when usageNames is empty and ranks by usage otherwise', () => {
    expect(orderPluginsByUsage(items, []).map((p) => p.id)).toEqual([
      'core',
      'mail',
      'zzz',
      'sr',
      'gs',
      'stock',
    ]);
    expect(orderPluginsByUsage(items, ['ZZZeroUID', 'GenshinUID']).map((p) => p.id)).toEqual([
      'zzz',
      'gs',
      'core',
      'mail',
      'stock',
      'sr',
    ]);
  });

  it('maintains case-insensitive MRU order in local storage and resolves recent pills with usage fallback', () => {
    pushLocalRecentPlugin('StarRailUID');
    pushLocalRecentPlugin('gsuid_core');
    pushLocalRecentPlugin('starrailuid');
    expect(readLocalRecentPlugins()).toEqual(['starrailuid', 'gsuid_core']);

    const pills = resolveRecentPluginItems(items, readLocalRecentPlugins(), [
      'GenshinUID',
      'StarRailUID',
      'SayuStock',
      'ZZZeroUID',
    ]);
    expect(pills.map((p) => p.id)).toEqual(['sr', 'core', 'gs', 'stock', 'zzz']);
  });

  it('syncs shared recent and lastEdited state with backend API and retries after failure', async () => {
    pushLocalRecentPlugin('StaleLocalPlugin');
    mockGetRecentPlugins.mockRejectedValueOnce(new Error('network glitch'));
    await fetchSharedPluginPrefs(true);

    mockGetRecentPlugins.mockResolvedValueOnce({
      recent_plugins: ['GenshinUID', 'ZZZeroUID'],
      last_edited_plugin: 'SayuStock',
    });
    const loaded = await fetchSharedPluginPrefs();
    expect(loaded.recentPlugins).toEqual(['SayuStock', 'GenshinUID', 'ZZZeroUID']);
    expect(loaded.lastEditedPlugin).toBe('SayuStock');
    expect(readLastEditedPluginId()).toBe('SayuStock');

    mockRecordRecentPlugin.mockResolvedValueOnce({
      recent_plugins: ['SayuStock', 'GenshinUID', 'ZZZeroUID'],
      last_edited_plugin: 'SayuStock',
    });
    recordSharedRecentPlugin('SayuStock', true);
    expect(getSharedRecentPluginsSnapshot()[0]).toBe('SayuStock');
    expect(mockRecordRecentPlugin).toHaveBeenCalledWith('SayuStock', true);
  });

  it('steps 2D grid highlight across columns and clamps at grid boundaries', () => {
    expect(stepGridHighlightIndex(0, 7, 3, 'ArrowRight')).toBe(1);
    expect(stepGridHighlightIndex(0, 7, 3, 'ArrowLeft')).toBe(0);
    expect(stepGridHighlightIndex(1, 7, 3, 'ArrowDown')).toBe(4);
    expect(stepGridHighlightIndex(5, 7, 3, 'ArrowDown')).toBe(5);
    expect(stepGridHighlightIndex(6, 7, 3, 'ArrowUp')).toBe(3);
    expect(stepGridHighlightIndex(5, 7, 3, 'Home')).toBe(0);
    expect(stepGridHighlightIndex(1, 7, 3, 'End')).toBe(6);
  });

  it('derives readable avatar initials and deterministic gradients', () => {
    expect(getPluginInitials('gscore_mail')).toBe('GM');
    expect(getPluginInitials('SayuStock')).toBe('SS');
    expect(getPluginInitials('GenshinUID')).toBe('GE');
    expect(getPluginInitials('核心功能')).toBe('核心');
    expect(getPluginAvatarGradient('gscore_mail')).toBe(getPluginAvatarGradient('gscore_mail'));
  });
});
