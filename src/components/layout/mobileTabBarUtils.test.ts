import { describe, expect, it } from 'vitest';
import enSidebar from '@/i18n/locales/en-US/sidebar.json';
import jaSidebar from '@/i18n/locales/ja-JP/sidebar.json';
import zhSidebar from '@/i18n/locales/zh-CN/sidebar.json';
import { resolveMobileTabId } from './mobileTabBarUtils';
import { filterNavItemsByExcludeIds, type NavItem } from './navItems';

describe('resolveMobileTabId', () => {
  it('maps primary mobile routes and subpaths to their dedicated tabs', () => {
    expect(resolveMobileTabId('/home')).toBe('home');
    expect(resolveMobileTabId('/dashboard')).toBe('dashboard');
    expect(resolveMobileTabId('/console')).toBe('console');
    expect(resolveMobileTabId('/plugins')).toBe('plugins');
    expect(resolveMobileTabId('/plugin-view/genshin/overview')).toBe('plugins');
  });

  it('falls back to menu for routes housed in the popup menu', () => {
    expect(resolveMobileTabId('/session-management')).toBe('menu');
    expect(resolveMobileTabId('/themes')).toBe('menu');
    expect(resolveMobileTabId('/settings')).toBe('menu');
    expect(resolveMobileTabId('/ai-config')).toBe('menu');
    expect(resolveMobileTabId('/plugin-store')).toBe('menu');
  });

  it('highlights menu whenever the in-place popup menu is open', () => {
    expect(resolveMobileTabId('/home', true)).toBe('menu');
    expect(resolveMobileTabId('/plugins', true)).toBe('menu');
  });
});

describe('mobileNav locale keys', () => {
  it('defines matching non-empty mobileNav labels in all three locales', () => {
    const zhKeys = Object.keys(zhSidebar.mobileNav).sort();
    const enKeys = Object.keys(enSidebar.mobileNav).sort();
    const jaKeys = Object.keys(jaSidebar.mobileNav).sort();

    expect(enKeys).toEqual(zhKeys);
    expect(jaKeys).toEqual(zhKeys);

    for (const key of zhKeys as Array<keyof typeof zhSidebar.mobileNav>) {
      expect(zhSidebar.mobileNav[key].trim().length).toBeGreaterThan(0);
      expect(enSidebar.mobileNav[key].trim().length).toBeGreaterThan(0);
      expect(jaSidebar.mobileNav[key].trim().length).toBeGreaterThan(0);
    }
  });
});

describe('filterNavItemsByExcludeIds', () => {
  it('excludes bottom tab bar entries at both top level and inside submenus', () => {
    const excludeIds = new Set(['home', 'dashboard', 'console', 'plugins']);
    const sampleItems: NavItem[] = [
      { id: 'home', title: '主页', url: '/home' },
      { id: 'dashboard', title: '看板', url: '/dashboard' },
      { id: 'database', title: '数据库管理', url: '/database' },
      {
        id: 'logsView',
        title: '日志查看',
        children: [
          { id: 'console', title: '实时控制台', url: '/console' },
          { id: 'historyLogs', title: '历史日志', url: '/logs' },
        ],
      },
      { id: 'plugins', title: '插件配置', url: '/plugins' },
      {
        id: 'emptyAfterFilter',
        title: '空分组',
        children: [{ id: 'console', title: '实时控制台', url: '/console' }],
      },
    ];

    const filtered = filterNavItemsByExcludeIds(sampleItems, excludeIds);

    expect(filtered.map((item) => item.id)).toEqual(['database', 'logsView']);
    expect(filtered[1]?.children?.map((child) => child.id)).toEqual(['historyLogs']);
  });
});
