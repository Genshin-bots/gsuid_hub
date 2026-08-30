import { getAuthToken, getCustomApiHost } from '@/lib/api';
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

export function pluginsListPath(pluginId: string): string {
  const id = pluginId.trim();
  if (!id) return '/plugins';
  return `/plugins?${PLUGINS_LIST_QUERY}=${encodeURIComponent(id)}`;
}

export function readPluginsListPluginId(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(raw).get(PLUGINS_LIST_QUERY)?.trim() || '';
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
