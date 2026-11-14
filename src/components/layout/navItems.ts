import {
  BookOpen,
  Brain,
  Calendar,
  ClipboardList,
  Cog,
  Cpu,
  Database,
  FileText,
  GitBranch,
  HardDrive,
  History,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  type LucideIcon,
  PackageOpen,
  Palette,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  Store,
  Terminal,
  TrendingUp,
  User,
  Wallet,
  Wrench,
} from 'lucide-react';

export interface NavItem {
  // 稳定标识符，不随语言变化，用于追踪展开/选中状态
  id: string;
  title: string;
  url?: string;
  icon?: LucideIcon;
  children?: NavItem[];
  adminOnly?: boolean;
  /** 额外视为该导航项激活的路径前缀（非导航页的子页面，如 /persona-store） */
  activePaths?: string[];
}

export function isNavItemActive(item: NavItem, currentPath: string): boolean {
  const paths = [item.url, ...(item.activePaths ?? [])].filter(Boolean) as string[];
  return paths.some((p) => currentPath === p || currentPath.startsWith(`${p}/`));
}

export function isNavGroupActive(item: NavItem, currentPath: string): boolean {
  return Boolean(item.children?.some((child) => isNavItemActive(child, currentPath)));
}

function filterAdminNav(items: NavItem[], isAdmin: boolean): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (item.adminOnly && !isAdmin) {
      continue;
    }
    if (item.children && item.children.length > 0) {
      const children = filterAdminNav(item.children, isAdmin);
      if (children.length === 0) {
        continue;
      }
      out.push({ ...item, children });
      continue;
    }
    out.push(item);
  }
  return out;
}

export function filterNavItemsByExcludeIds(
  items: NavItem[],
  excludeIds: ReadonlySet<string>,
): NavItem[] {
  const out: NavItem[] = [];
  for (const item of items) {
    if (excludeIds.has(item.id)) {
      continue;
    }
    if (item.children && item.children.length > 0) {
      const children = filterNavItemsByExcludeIds(item.children, excludeIds);
      if (children.length === 0) {
        continue;
      }
      out.push({ ...item, children });
      continue;
    }
    out.push(item);
  }
  return out;
}

// AI 侧边栏（桌面双菜单模式的 AI 侧）与「AI 配置」子菜单共用的条目源
export function getAiNavItems(
  t: (key: string) => string,
  isAIEnabled: boolean,
  isAdmin: boolean,
): NavItem[] {
  // AI 配置的子菜单：未启用 AI 时只保留 基础配置 / AI历史调用
  const aiConfigChildren: NavItem[] = isAIEnabled
    ? [
        { id: 'ai-basicConfig', title: t('sidebar.basicConfig'), url: '/ai-config', icon: Cog },
        {
          id: 'ai-personaConfig',
          title: t('sidebar.personaConfig'),
          url: '/persona-config',
          icon: User,
          activePaths: ['/persona-store'],
        },
        { id: 'ai-budget', title: t('sidebar.aiBudget'), url: '/ai-budget', icon: Wallet },
        { id: 'ai-tools', title: t('sidebar.aiTools'), url: '/ai-tools', icon: Wrench },
        {
          id: 'ai-statistics',
          title: t('sidebar.aiStatistics'),
          url: '/ai-statistics',
          icon: TrendingUp,
        },
        {
          id: 'ai-knowledge',
          title: t('sidebar.aiKnowledge'),
          url: '/ai-knowledge',
          icon: BookOpen,
        },
        { id: 'ai-meme', title: t('sidebar.aiMeme'), url: '/ai-meme', icon: ImageIcon },
        { id: 'ai-memory', title: t('sidebar.aiMemory'), url: '/ai-memory', icon: Brain },
        { id: 'ai-history', title: t('sidebar.aiHistory'), url: '/ai-history', icon: ScrollText },
        { id: 'ai-kanban', title: t('sidebar.aiKanban'), url: '/ai-kanban', icon: ClipboardList },
        {
          id: 'ai-approvals',
          title: t('sidebar.aiApprovals'),
          url: '/ai-approvals',
          icon: ShieldCheck,
        },
        // 产出物 + 工具落盘合并为一个入口，页内用 TabButtonGroup 切换两块资源
        {
          id: 'ai-artifacts',
          title: t('sidebar.aiOutputs'),
          url: '/ai-artifacts',
          icon: PackageOpen,
        },
        // 运维排查：原 /ai-runtime 改名并挪到 AI 菜单最后
        {
          id: 'ai-debug',
          title: t('sidebar.aiDebug'),
          url: '/ai-debug',
          icon: Stethoscope,
          activePaths: ['/ai-runtime', '/ai-ops', '/group-profile'],
        },
      ]
    : [
        { id: 'ai-basicConfig', title: t('sidebar.basicConfig'), url: '/ai-config', icon: Cog },
        { id: 'ai-history', title: t('sidebar.aiHistory'), url: '/ai-history', icon: ScrollText },
      ];
  return filterAdminNav(aiConfigChildren, isAdmin);
}

export function getNavItems(
  t: (key: string) => string,
  isAIEnabled: boolean,
  isAdmin: boolean,
): NavItem[] {
  const aiConfigChildren = getAiNavItems(t, isAIEnabled, isAdmin);

  const items: NavItem[] = [
    { id: 'home', title: t('sidebar.home'), url: '/home', icon: Home },
    { id: 'dashboard', title: t('sidebar.dashboard'), url: '/dashboard', icon: LayoutDashboard },
    { id: 'console', title: t('sidebar.console'), url: '/console', icon: Terminal },
    {
      id: 'historyLogs',
      title: t('sidebar.historyLogs'),
      url: '/logs',
      icon: FileText,
      activePaths: ['/traces', '/http-traces'],
    },
    {
      id: 'database',
      title: t('sidebar.database'),
      url: '/database',
      icon: Database,
      adminOnly: true,
    },
    // 核心配置已并入 /framework-config 的首个页签
    {
      id: 'frameworkConfig',
      title: t('sidebar.frameworkConfig'),
      url: '/framework-config',
      icon: Cpu,
      adminOnly: true,
    },
    {
      id: 'sessionManagement',
      title: t('sidebar.sessionManagement'),
      url: '/session-management',
      icon: History,
    },
    {
      id: 'plugins',
      title: t('sidebar.plugins'),
      url: '/plugins',
      icon: Settings,
      adminOnly: true,
    },
    { id: 'pluginStore', title: t('sidebar.pluginStore'), url: '/plugin-store', icon: Store },
    { id: 'gitUpdate', title: t('sidebar.gitUpdate'), url: '/git-update', icon: GitBranch },
    {
      id: 'aiConfig',
      title: t('sidebar.aiConfig'),
      icon: Brain,
      children: aiConfigChildren,
    },
    {
      id: 'opsMisc',
      title: t('sidebar.opsMisc'),
      icon: Wrench,
      children: [
        {
          id: 'batchPush',
          title: t('sidebar.batchPush'),
          url: '/batch-push',
          icon: Send,
          adminOnly: true,
        },
        {
          id: 'backup',
          title: t('sidebar.backup'),
          url: '/backup',
          icon: HardDrive,
          adminOnly: true,
        },
        { id: 'scheduler', title: t('sidebar.scheduler'), url: '/scheduler', icon: Calendar },
      ],
    },
    {
      id: 'consoleManagement',
      title: t('sidebar.consoleManagement'),
      icon: Settings,
      children: [
        { id: 'themes', title: t('sidebar.themes'), url: '/themes', icon: Palette },
        {
          id: 'brandSettings',
          title: t('sidebar.brandSettings'),
          url: '/brand-settings',
          icon: ImageIcon,
        },
        {
          id: 'accountSettings',
          title: t('sidebar.accountSettings'),
          url: '/settings',
          icon: User,
        },
      ],
    },
  ];
  return filterAdminNav(items, isAdmin);
}
