import { describe, expect, it } from 'vitest';
import enSidebar from '@/i18n/locales/en-US/sidebar.json';
import jaSidebar from '@/i18n/locales/ja-JP/sidebar.json';
import zhSidebar from '@/i18n/locales/zh-CN/sidebar.json';
import { resolveMobileTabId } from './mobileTabBarUtils';
import {
  filterNavItemsByExcludeIds,
  getNavItems,
  isNavGroupActive,
  isNavItemActive,
  type NavItem,
} from './navItems';

describe('resolveMobileTabId', () => {
  it('maps primary mobile routes and subpaths to their dedicated tabs', () => {
    expect(resolveMobileTabId('/home')).toBe('home');
    expect(resolveMobileTabId('/dashboard')).toBe('dashboard');
    expect(resolveMobileTabId('/console')).toBe('console');
    expect(resolveMobileTabId('/plugins')).toBe('plugins');
    expect(resolveMobileTabId('/plugin-view/genshin/overview')).toBe('plugins');
  });

  it('falls back to menu for routes housed in the popup menu', () => {
    expect(resolveMobileTabId('/logs')).toBe('menu');
    expect(resolveMobileTabId('/traces')).toBe('menu');
    expect(resolveMobileTabId('/http-traces')).toBe('menu');
    expect(resolveMobileTabId('/framework-config')).toBe('menu');
    expect(resolveMobileTabId('/batch-push')).toBe('menu');
    expect(resolveMobileTabId('/backup')).toBe('menu');
    expect(resolveMobileTabId('/scheduler')).toBe('menu');
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

describe('getNavItems menu hierarchy and locale parity', () => {
  it('defines matching sidebar locale keys including opsMisc across all three languages', () => {
    const zhKeys = Object.keys(zhSidebar).sort();
    const enKeys = Object.keys(enSidebar).sort();
    const jaKeys = Object.keys(jaSidebar).sort();

    expect(enKeys).toEqual(zhKeys);
    expect(jaKeys).toEqual(zhKeys);
    expect(zhSidebar.opsMisc.trim().length).toBeGreaterThan(0);
    expect(enSidebar.opsMisc.trim().length).toBeGreaterThan(0);
    expect(jaSidebar.opsMisc.trim().length).toBeGreaterThan(0);
  });

  it('promotes console, historyLogs, and frameworkConfig to top-level and groups opsMisc children', () => {
    const adminItems = getNavItems((key) => key, true, true);
    const adminIds = adminItems.map((item) => item.id);
    expect(adminIds).toContain('console');
    expect(adminIds).toContain('historyLogs');
    expect(adminIds).toContain('frameworkConfig');
    expect(adminIds).toContain('opsMisc');
    expect(adminIds.indexOf('aiConfig')).toBe(adminIds.indexOf('gitUpdate') + 1);
    expect(adminIds.indexOf('opsMisc')).toBe(adminIds.indexOf('aiConfig') + 1);
    expect(adminIds).not.toContain('adminCore');
    expect(adminIds).not.toContain('logsView');

    const historyLogs = adminItems.find((item) => item.id === 'historyLogs');
    expect(historyLogs).toBeDefined();
    expect(historyLogs && isNavItemActive(historyLogs, '/traces')).toBe(true);
    expect(historyLogs && isNavItemActive(historyLogs, '/http-traces')).toBe(true);

    const opsMiscAdmin = adminItems.find((item) => item.id === 'opsMisc');
    expect(opsMiscAdmin?.children?.map((c) => c.id)).toEqual(['batchPush', 'backup', 'scheduler']);
    expect(opsMiscAdmin && isNavGroupActive(opsMiscAdmin, '/backup')).toBe(true);

    const userItems = getNavItems((key) => key, true, false);
    expect(userItems.map((item) => item.id)).toContain('console');
    expect(userItems.map((item) => item.id)).toContain('historyLogs');
    expect(userItems.map((item) => item.id)).not.toContain('frameworkConfig');

    const opsMiscUser = userItems.find((item) => item.id === 'opsMisc');
    expect(opsMiscUser?.children?.map((c) => c.id)).toEqual(['scheduler']);

    const mobileExclude = new Set(['home', 'dashboard', 'console', 'plugins']);
    const mobileMenuAdmin = filterNavItemsByExcludeIds(adminItems, mobileExclude);
    const mobileIds = mobileMenuAdmin.map((item) => item.id);
    expect(mobileIds).toEqual([
      'historyLogs',
      'database',
      'frameworkConfig',
      'sessionManagement',
      'pluginStore',
      'gitUpdate',
      'aiConfig',
      'opsMisc',
      'consoleManagement',
    ]);
    // 移动端单层菜单全部连续且为偶数个（管理员 6 个、非管理员 4 个），两列网格每行恰好两个
    const adminSingleCount = mobileMenuAdmin.filter((item) => !item.children?.length).length;
    expect(adminSingleCount % 2).toBe(0);

    const mobileMenuUser = filterNavItemsByExcludeIds(userItems, mobileExclude);
    const userSingleCount = mobileMenuUser.filter((item) => !item.children?.length).length;
    expect(userSingleCount % 2).toBe(0);
  });
});
