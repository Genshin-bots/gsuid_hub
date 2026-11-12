import { getAuthToken, getCustomApiHost, pluginsApi } from '@/lib/api';
import type { PluginPageMeta } from '@/lib/api';
import type { Language } from '@/contexts/LanguageContext';

const SKIP_PREFIX = 'gshub:skip-plugin-page-confirm:';

export function pluginPageSkipKey(pluginId: string, pageId: string): string {
  return `${SKIP_PREFIX}${pluginId}:${pageId}`;
}

export function shouldSkipPluginPageConfirm(pluginId: string, pageId: string): boolean {
  try {
    return localStorage.getItem(pluginPageSkipKey(pluginId, pageId)) === '1';
  } catch {
    return false;
  }
}

export function setSkipPluginPageConfirm(pluginId: string, pageId: string, skip: boolean): void {
  try {
    const key = pluginPageSkipKey(pluginId, pageId);
    if (skip) {
      localStorage.setItem(key, '1');
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // storage may be blocked
  }
}

export function pickPluginPageText(
  map: Record<string, string> | undefined,
  locale: Language,
  fallback = '',
): string {
  if (!map) return fallback;
  if (map[locale]) return map[locale];
  if (map['zh-CN']) return map['zh-CN'];
  const first = Object.values(map).find((v) => Boolean(v));
  return first || fallback;
}

export function buildPluginPageSrc(opts: {
  pluginId: string;
  pageId: string;
  locale: Language;
  theme: 'light' | 'dark';
  style: string;
}): string {
  const params = new URLSearchParams();
  params.set('locale', opts.locale);
  params.set('theme', opts.theme);
  params.set('style', opts.style);
  const token = getAuthToken();
  if (token) params.set('token', token);
  if (import.meta.env.VITE_DEMO) {
    const base = import.meta.env.BASE_URL || '/';
    return `${base}demo-plugin-page.html?${params.toString()}`;
  }
  const host = getCustomApiHost();
  const pluginId = encodeURIComponent(opts.pluginId);
  const pageId = encodeURIComponent(opts.pageId);
  return `${host}/plugin-pages/${pluginId}/${pageId}/?${params.toString()}`;
}

export function pluginViewPath(page: PluginPageMeta): string {
  return `/plugin-view/${encodeURIComponent(page.plugin_id)}/${encodeURIComponent(page.id)}`;
}

export const GSHUB_THEME_MESSAGE = 'gshub:theme';
export const GSHUB_THEME_REQUEST = 'gshub:theme-request';

export const HUB_THEME_VAR_NAMES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--destructive-foreground',
  '--border',
  '--input',
  '--ring',
  '--radius',
  '--shadow-strength',
  '--card-opacity',
  '--blur-intensity',
  '--sidebar-background',
  '--sidebar-foreground',
] as const;

export interface HubThemeMessage {
  type: typeof GSHUB_THEME_MESSAGE;
  mode: 'light' | 'dark';
  style: string;
  iconColor: string;
  color: string;
  vars: Record<string, string>;
}

export function collectHubThemeVarsFromComputed(computed: {
  getPropertyValue: (name: string) => string;
}): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of HUB_THEME_VAR_NAMES) {
    const value = computed.getPropertyValue(name).trim();
    if (value) vars[name] = value;
  }
  return vars;
}

export function collectHubThemeVars(root: HTMLElement): Record<string, string> {
  const vars = collectHubThemeVarsFromComputed(getComputedStyle(root));
  const inline = root.style;
  for (let i = 0; i < inline.length; i++) {
    const name = inline.item(i);
    if (!name?.startsWith('--')) continue;
    const value = inline.getPropertyValue(name).trim();
    if (value) vars[name] = value;
  }
  return vars;
}

export function buildHubThemeMessage(opts: {
  mode: 'light' | 'dark';
  style: string;
  iconColor: string;
  color: string;
  vars: Record<string, string>;
}): HubThemeMessage {
  return {
    type: GSHUB_THEME_MESSAGE,
    mode: opts.mode,
    style: opts.style,
    iconColor: opts.iconColor,
    color: opts.color,
    vars: opts.vars,
  };
}

export function isHubThemeMessage(data: unknown): data is HubThemeMessage {
  if (typeof data !== 'object' || data === null) return false;
  if (!('type' in data) || data.type !== GSHUB_THEME_MESSAGE) return false;
  if (!('mode' in data) || (data.mode !== 'light' && data.mode !== 'dark')) return false;
  if (!('style' in data) || typeof data.style !== 'string') return false;
  if (!('vars' in data) || typeof data.vars !== 'object' || data.vars === null) return false;
  return true;
}

export function isHubThemeRequest(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  return 'type' in data && data.type === GSHUB_THEME_REQUEST;
}

export const PLUGINS_LIST_QUERY = 'plugin';
export const LAST_EDITED_PLUGIN_KEY = 'gshub:last-edited-plugin';
export const RECENT_PLUGINS_KEY = 'gshub:recent-plugins';
const MAX_LOCAL_RECENT_PLUGINS = 16;

export function pluginsListPath(pluginId: string): string {
  const id = pluginId.trim();
  if (!id) return '/plugins';
  return `/plugins?${PLUGINS_LIST_QUERY}=${encodeURIComponent(id)}`;
}

export function readPluginsListPluginId(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(raw).get(PLUGINS_LIST_QUERY)?.trim() || '';
}

export function readLastEditedPluginId(): string {
  try {
    return localStorage.getItem(LAST_EDITED_PLUGIN_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setLastEditedPluginId(pluginId: string): void {
  const id = pluginId.trim();
  if (!id) return;
  try {
    localStorage.setItem(LAST_EDITED_PLUGIN_KEY, id);
  } catch {
    // storage may be blocked
  }
}

export function readLocalRecentPlugins(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_PLUGINS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(trimmed);
      if (out.length >= MAX_LOCAL_RECENT_PLUGINS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function writeLocalRecentPlugins(names: ReadonlyArray<string>): void {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
    if (out.length >= MAX_LOCAL_RECENT_PLUGINS) break;
  }
  try {
    localStorage.setItem(RECENT_PLUGINS_KEY, JSON.stringify(out));
  } catch {
    // storage may be blocked
  }
}

export function pushLocalRecentPlugin(pluginName: string): string[] {
  const trimmed = pluginName.trim();
  const current = readLocalRecentPlugins();
  if (!trimmed) return current;
  const lower = trimmed.toLowerCase();
  const next = [trimmed, ...current.filter((item) => item.toLowerCase() !== lower)].slice(
    0,
    MAX_LOCAL_RECENT_PLUGINS,
  );
  writeLocalRecentPlugins(next);
  return next;
}

export interface SharedPluginPrefsState {
  recentPlugins: string[];
  lastEditedPlugin: string;
}

let sharedRecentCache: string[] | null = null;
let sharedLastEditedCache = '';
let sharedPrefsFetched = false;
let sharedPrefsInflight: Promise<SharedPluginPrefsState> | null = null;
let recentPrefsWarned = false;
const sharedPrefsListeners = new Set<() => void>();

function notifySharedPrefsListeners(): void {
  for (const listener of sharedPrefsListeners) {
    listener();
  }
}

function sameStringArray(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function dedupePluginNames(names: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
    if (out.length >= MAX_LOCAL_RECENT_PLUGINS) break;
  }
  return out;
}

export function subscribeSharedPluginPrefs(listener: () => void): () => void {
  sharedPrefsListeners.add(listener);
  return () => {
    sharedPrefsListeners.delete(listener);
  };
}

export function getSharedRecentPluginsSnapshot(): string[] {
  if (sharedRecentCache === null) {
    sharedRecentCache = readLocalRecentPlugins();
  }
  return sharedRecentCache;
}

export const MAX_RECENT_PLUGIN_PILLS = 5;

function mergeBackendRecentPlugins(
  recentPlugins: ReadonlyArray<string>,
  lastEditedPlugin: string,
): string[] {
  const cleanRecent = dedupePluginNames(recentPlugins);
  const lastTrimmed = lastEditedPlugin.trim();
  if (!lastTrimmed) return cleanRecent;
  const lastLower = lastTrimmed.toLowerCase();
  if (cleanRecent.some((name) => name.toLowerCase() === lastLower)) {
    return cleanRecent;
  }
  return dedupePluginNames([lastTrimmed, ...cleanRecent]);
}

export function fetchSharedPluginPrefs(force = false): Promise<SharedPluginPrefsState> {
  if (!force && sharedPrefsFetched && sharedRecentCache !== null) {
    return Promise.resolve({
      recentPlugins: sharedRecentCache,
      lastEditedPlugin: sharedLastEditedCache || readLastEditedPluginId(),
    });
  }
  if (!force && sharedPrefsInflight) {
    return sharedPrefsInflight;
  }

  const task = pluginsApi
    .getRecentPlugins()
    .then((dto) => {
      const backendRecent = Array.isArray(dto?.recent_plugins) ? dto.recent_plugins : [];
      const backendLast =
        typeof dto?.last_edited_plugin === 'string' ? dto.last_edited_plugin.trim() : '';
      const hasBackendData = backendRecent.length > 0 || backendLast.length > 0;
      const mergedRecent = hasBackendData
        ? mergeBackendRecentPlugins(backendRecent, backendLast)
        : readLocalRecentPlugins();
      const effectiveLast = backendLast || readLastEditedPluginId();

      writeLocalRecentPlugins(mergedRecent);
      if (backendLast) {
        setLastEditedPluginId(backendLast);
      }

      const prevRecent = sharedRecentCache ?? [];
      sharedRecentCache = mergedRecent;
      sharedLastEditedCache = effectiveLast;
      sharedPrefsFetched = true;

      if (!sameStringArray(prevRecent, mergedRecent)) {
        notifySharedPrefsListeners();
      }
      return {
        recentPlugins: mergedRecent,
        lastEditedPlugin: effectiveLast,
      };
    })
    .catch((error) => {
      if (!recentPrefsWarned) {
        recentPrefsWarned = true;
        console.warn('plugin recent prefs unavailable', error);
      }
      const fallbackRecent = readLocalRecentPlugins();
      const fallbackLast = readLastEditedPluginId();
      sharedRecentCache = fallbackRecent;
      sharedLastEditedCache = fallbackLast;
      return {
        recentPlugins: fallbackRecent,
        lastEditedPlugin: fallbackLast,
      };
    })
    .finally(() => {
      if (sharedPrefsInflight === task) {
        sharedPrefsInflight = null;
      }
    });

  sharedPrefsInflight = task;
  return task;
}

export function recordSharedRecentPlugin(pluginName: string, edited = false): void {
  const trimmed = pluginName.trim();
  if (!trimmed) return;

  const nextLocal = pushLocalRecentPlugin(trimmed);
  sharedRecentCache = nextLocal;
  if (edited) {
    sharedLastEditedCache = trimmed;
    setLastEditedPluginId(trimmed);
  }
  notifySharedPrefsListeners();

  pluginsApi
    .recordRecentPlugin(trimmed, edited)
    .then((dto) => {
      const serverLast =
        typeof dto?.last_edited_plugin === 'string' ? dto.last_edited_plugin.trim() : '';
      const serverRecent = Array.isArray(dto?.recent_plugins)
        ? mergeBackendRecentPlugins(dto.recent_plugins, serverLast)
        : nextLocal;

      writeLocalRecentPlugins(serverRecent);
      if (serverLast) {
        sharedLastEditedCache = serverLast;
        setLastEditedPluginId(serverLast);
      }
      sharedPrefsFetched = true;

      if (!sharedRecentCache || !sameStringArray(sharedRecentCache, serverRecent)) {
        sharedRecentCache = serverRecent;
        notifySharedPrefsListeners();
      }
    })
    .catch((error) => {
      if (!recentPrefsWarned) {
        recentPrefsWarned = true;
        console.warn('plugin recent prefs save unavailable', error);
      }
    });
}

export function matchPluginListId(
  plugins: ReadonlyArray<{ id: string; name: string }>,
  wanted: string,
): string {
  const key = wanted.trim();
  if (!key) return '';
  const lower = key.toLowerCase();
  const hit = plugins.find(
    (p) =>
      p.id === key ||
      p.name === key ||
      p.id.toLowerCase() === lower ||
      p.name.toLowerCase() === lower,
  );
  return hit ? hit.id : '';
}

/**
 * 解析进入 `/plugins` 时默认选中的插件 ID：
 * 优先级：URL `?plugin=` > 当前会话已选 > 后端记录的最后编辑插件 > 本地缓存的最后编辑插件 > 列表首项。
 */
export function resolveInitialPluginId(
  plugins: ReadonlyArray<{ id: string; name: string }>,
  search: string,
  currentSelectedId = '',
  backendLastEdited = '',
): string {
  if (plugins.length === 0) return '';
  const candidates = [
    readPluginsListPluginId(search),
    currentSelectedId,
    backendLastEdited,
    readLastEditedPluginId(),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const matched = matchPluginListId(plugins, candidate);
    if (matched) return matched;
  }
  return plugins[0].id;
}

export interface OrderablePluginItem {
  id: string;
  name: string;
}

function pluginUsageRank(
  plugin: OrderablePluginItem,
  rank: Map<string, number>,
): number | undefined {
  const byName = rank.get(plugin.name.toLowerCase());
  if (byName !== undefined) return byName;
  return rank.get(plugin.id.toLowerCase());
}

/**
 * 按触发次数排序插件；若未传 `usageNames`（如 `/database`、`/git-update` 核心置顶），保留调用方原始顺序。
 */
export function orderPluginsByUsage<T extends OrderablePluginItem>(
  plugins: ReadonlyArray<T>,
  usageNames?: ReadonlyArray<string>,
): T[] {
  if (!usageNames || usageNames.length === 0) return [...plugins];
  const rank = new Map(usageNames.map((name, index) => [name.toLowerCase(), index]));
  return [...plugins].sort((a, b) => {
    const ra = pluginUsageRank(a, rank);
    const rb = pluginUsageRank(b, rank);
    if (ra !== undefined && rb !== undefined && ra !== rb) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 组装选择器顶部的「最近使用」胶囊列表（默认最多 5 项）：
 * 优先按后端 MRU 顺序匹配当前可选列表，不足时用触发热度榜单补齐。
 */
export function resolveRecentPluginItems<T extends OrderablePluginItem & { iconName?: string }>(
  plugins: ReadonlyArray<T>,
  recentNames: ReadonlyArray<string>,
  usageNames: ReadonlyArray<string> = [],
  maxRecent = MAX_RECENT_PLUGIN_PILLS,
): T[] {
  if (plugins.length === 0 || maxRecent <= 0) return [];
  const picked: T[] = [];
  const seenIds = new Set<string>();

  const tryPushByKey = (rawKey: string) => {
    const key = rawKey.trim();
    if (!key || picked.length >= maxRecent) return;
    const lower = key.toLowerCase();
    const hit = plugins.find(
      (p) =>
        p.id === key ||
        p.name === key ||
        p.iconName === key ||
        p.id.toLowerCase() === lower ||
        p.name.toLowerCase() === lower ||
        (p.iconName ? p.iconName.toLowerCase() === lower : false),
    );
    if (hit && !seenIds.has(hit.id)) {
      seenIds.add(hit.id);
      picked.push(hit);
    }
  };

  for (const name of recentNames) {
    tryPushByKey(name);
    if (picked.length >= maxRecent) return picked;
  }

  for (const name of usageNames) {
    tryPushByKey(name);
    if (picked.length >= maxRecent) return picked;
  }

  return picked;
}

/**
 * 多列网格键盘焦点移动（支持 ↑ ↓ ← → Home End）。
 */
export function stepGridHighlightIndex(
  currentIndex: number,
  total: number,
  cols: number,
  key: string,
): number {
  if (total <= 0) return -1;
  const safeCols = Math.max(1, cols);
  const clamped = Math.min(total - 1, Math.max(0, currentIndex < 0 ? 0 : currentIndex));

  switch (key) {
    case 'ArrowRight':
      return Math.min(total - 1, clamped + 1);
    case 'ArrowLeft':
      return Math.max(0, clamped - 1);
    case 'ArrowDown':
      return clamped + safeCols < total ? clamped + safeCols : clamped;
    case 'ArrowUp':
      return clamped - safeCols >= 0 ? clamped - safeCols : clamped;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return clamped;
  }
}

const AVATAR_MESH_PALETTES = [
  'radial-gradient(circle at 22% 20%, #818cf8 0%, transparent 62%), radial-gradient(circle at 82% 82%, #fb923c 0%, transparent 62%), linear-gradient(135deg, #6366f1 0%, #ea580c 100%)',
  'radial-gradient(circle at 20% 25%, #34d399 0%, transparent 60%), radial-gradient(circle at 82% 75%, #f472b6 0%, transparent 62%), linear-gradient(135deg, #10b981 0%, #ec4899 100%)',
  'radial-gradient(circle at 25% 20%, #bef264 0%, transparent 60%), radial-gradient(circle at 80% 80%, #fb923c 0%, transparent 62%), linear-gradient(135deg, #eab308 0%, #f97316 100%)',
  'radial-gradient(circle at 20% 20%, #38bdf8 0%, transparent 60%), radial-gradient(circle at 80% 80%, #a78bfa 0%, transparent 62%), linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
  'radial-gradient(circle at 25% 22%, #fb7185 0%, transparent 60%), radial-gradient(circle at 78% 80%, #fbbf24 0%, transparent 62%), linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)',
  'radial-gradient(circle at 22% 24%, #2dd4bf 0%, transparent 60%), radial-gradient(circle at 80% 78%, #60a5fa 0%, transparent 62%), linear-gradient(135deg, #14b8a6 0%, #3b82f6 100%)',
] as const;

function hashPluginName(name: string): number {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 提取高辨识度的 1~2 字符插件缩写（如 `gscore_mail` → `GM`、`SayuStock` → `SS`、`核心功能` → `核心`） */
export function getPluginInitials(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) return '?';

  const cjk = trimmed.match(/[\u4e00-\u9fff]/g);
  if (cjk && cjk.length > 0) {
    return cjk.slice(0, 2).join('');
  }

  const coreCleaned = trimmed.replace(/uid$/i, '') || trimmed;
  const segments = coreCleaned.split(/[_\-\s.]+/).filter(Boolean);
  if (segments.length >= 2) {
    return `${segments[0][0]}${segments[1][0]}`.toUpperCase();
  }

  const single = segments[0] || coreCleaned;
  const uppers = single.match(/[A-Z]/g);
  if (uppers && uppers.length >= 2) {
    return `${uppers[0]}${uppers[1]}`;
  }

  const alnum = single.replace(/[^A-Za-z0-9]/g, '');
  return (alnum.slice(0, 2) || trimmed.slice(0, 2)).toUpperCase();
}

export function getPluginAvatarGradient(pluginName: string): string {
  const idx = hashPluginName(pluginName.toLowerCase()) % AVATAR_MESH_PALETTES.length;
  return AVATAR_MESH_PALETTES[idx];
}
