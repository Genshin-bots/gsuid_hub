import { Home, LayoutDashboard, Database, Settings, FileText, LogOut, Palette, Terminal, Calendar, Store, Cpu, HardDrive, PanelLeftClose, Cog, Power, RotateCw, User, Brain, ChevronDown, ChevronRight, Wrench, Sparkles, BookOpen, History, TrendingUp, Clock, Server, GitBranch, Image as ImageIcon, ScrollText, Layers, ClipboardList, Activity, Wallet, ShieldCheck, Bug, PackageOpen, Send, Users, MessageCircle, FileSearch, Puzzle } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAIStatus } from '@/contexts/AIStatusContext';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LanguageFlag } from '@/components/ui/language-flag';
import { BrandSettingsDialog } from '@/components/brand/BrandSettingsDialog';
import { cn } from '@/lib/utils';
import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSystemControl } from '@/hooks/useSystemControl';
import { SidebarHoverIcon, sidebarNavItemGroupClass } from '@/components/layout/SidebarHoverIcon';

// 导航项类型定义
interface NavItem {
  // 稳定标识符，不随语言变化，用于追踪展开/选中状态
  id: string;
  title: string;
  url?: string;
  icon?: React.ElementType;
  children?: NavItem[];
  adminOnly?: boolean;
}

// 静态导航配置 - 避免每次渲染重新创建
const NAV_ITEMS_KEYS = ['home', 'dashboard', 'database', 'adminCore', 'logsView', 'aiConfig', 'aiPersona', 'plugins', 'pluginStore', 'gitUpdate', 'consoleManagement'] as const;

// 图标映射 - 使用静态对象避免每次渲染重新创建
const ICON_MAP: Record<string, React.ElementType> = {
  Home,
  LayoutDashboard,
  Database,
  Cog,
  Cpu,
  HardDrive,
  Calendar,
  FileText,
  ImageIcon,
  Terminal,
  Brain,
  Settings,
  Store,
  Palette,
  User,
  Server,
  GitBranch,
  Wallet,
  MessageCircle,
  Puzzle,
};

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

// 导航项配置
const getNavItems = (t: (key: string) => string, isAIEnabled: boolean, isAdmin: boolean): NavItem[] => {
  // AI 配置的子菜单：未启用 AI 时只保留 基础配置 / AI历史调用
  const aiConfigChildren: NavItem[] = isAIEnabled
    ? [
        { id: 'ai-basicConfig', title: t('sidebar.basicConfig'), url: '/ai-config', icon: Cog },
        { id: 'ai-personaConfig', title: t('sidebar.personaConfig'), url: '/persona-config', icon: User },
        { id: 'ai-budget', title: t('sidebar.aiBudget'), url: '/ai-budget', icon: Wallet },
        { id: 'ai-mcpConfig', title: t('sidebar.mcpConfig'), url: '/mcp-config', icon: Server },
        { id: 'ai-capabilityAgents', title: t('sidebar.aiCapabilityAgents'), url: '/ai-capability-agents', icon: Layers },
        { id: 'ai-tools', title: t('sidebar.aiTools'), url: '/ai-tools', icon: Wrench },
        { id: 'ai-skills', title: t('sidebar.aiSkills'), url: '/ai-skills', icon: Sparkles },
        { id: 'ai-statistics', title: t('sidebar.aiStatistics'), url: '/ai-statistics', icon: TrendingUp },
        { id: 'ai-scheduledTasks', title: t('sidebar.aiScheduledTasks'), url: '/ai-scheduled-tasks', icon: Clock },
        { id: 'ai-knowledge', title: t('sidebar.aiKnowledge'), url: '/ai-knowledge', icon: BookOpen },
        { id: 'ai-meme', title: t('sidebar.aiMeme'), url: '/ai-meme', icon: ImageIcon },
        { id: 'ai-memory', title: t('sidebar.aiMemory'), url: '/ai-memory', icon: Brain },
        { id: 'ai-history', title: t('sidebar.aiHistory'), url: '/ai-history', icon: ScrollText },
        { id: 'ai-kanban', title: t('sidebar.aiKanban'), url: '/ai-kanban', icon: ClipboardList },
        { id: 'ai-stateStore', title: t('sidebar.stateStore'), url: '/state-store', icon: HardDrive },
        { id: 'ai-groupProfile', title: t('sidebar.groupProfile'), url: '/group-profile', icon: Users },
        { id: 'ai-approvals', title: t('sidebar.aiApprovals'), url: '/ai-approvals', icon: ShieldCheck },
        { id: 'ai-debug', title: t('sidebar.aiDebug'), url: '/ai-debug', icon: Bug },
        { id: 'ai-ops', title: t('sidebar.aiOps'), url: '/ai-ops', icon: Activity },
        { id: 'ai-runtime', title: t('sidebar.aiRuntime'), url: '/ai-runtime', icon: Puzzle },
        { id: 'ai-artifacts', title: t('sidebar.aiArtifacts'), url: '/ai-artifacts', icon: PackageOpen },
        { id: 'ai-tool-outputs', title: t('sidebar.aiToolOutputs'), url: '/ai-tool-outputs', icon: FileSearch },
      ]
    : [
        { id: 'ai-basicConfig', title: t('sidebar.basicConfig'), url: '/ai-config', icon: Cog },
        { id: 'ai-history', title: t('sidebar.aiHistory'), url: '/ai-history', icon: ScrollText },
      ];

  const items: NavItem[] = [
    { id: 'home', title: t('sidebar.home'), url: '/home', icon: Home },
    { id: 'dashboard', title: t('sidebar.dashboard'), url: '/dashboard', icon: LayoutDashboard },
    { id: 'database', title: t('sidebar.database'), url: '/database', icon: Database, adminOnly: true },
    {
      id: 'adminCore',
      title: t('sidebar.adminCore'),
      icon: Cog,
      children: [
        { id: 'coreConfig', title: t('sidebar.coreConfig'), url: '/core-config', icon: Cog, adminOnly: true },
        { id: 'frameworkConfig', title: t('sidebar.frameworkConfig'), url: '/framework-config', icon: Cpu, adminOnly: true },
        { id: 'backup', title: t('sidebar.backup'), url: '/backup', icon: HardDrive, adminOnly: true },
        { id: 'scheduler', title: t('sidebar.scheduler'), url: '/scheduler', icon: Calendar }
      ]
    },
    {
      id: 'logsView',
      title: t('sidebar.logsView'),
      icon: FileText,
      children: [
        { id: 'console', title: t('sidebar.console'), url: '/console', icon: Terminal },
        { id: 'historyLogs', title: t('sidebar.historyLogs'), url: '/logs', icon: FileText },
        { id: 'traces', title: t('sidebar.traces'), url: '/traces', icon: Activity },
        { id: 'sessionManagement', title: t('sidebar.sessionManagement'), url: '/session-management', icon: History },
        { id: 'liveChat', title: t('sidebar.liveChat'), url: '/live-chat', icon: MessageCircle },
        { id: 'batchPush', title: t('sidebar.batchPush'), url: '/batch-push', icon: Send, adminOnly: true }
      ]
    },
    {
      id: 'aiConfig',
      title: t('sidebar.aiConfig'),
      icon: Brain,
      children: aiConfigChildren,
    },
    { id: 'plugins', title: t('sidebar.plugins'), url: '/plugins', icon: Settings, adminOnly: true },
    { id: 'pluginStore', title: t('sidebar.pluginStore'), url: '/plugin-store', icon: Store },
    { id: 'gitUpdate', title: t('sidebar.gitUpdate'), url: '/git-update', icon: GitBranch },
    {
      id: 'consoleManagement',
      title: t('sidebar.consoleManagement'),
      icon: Settings,
      children: [
        { id: 'themes', title: t('sidebar.themes'), url: '/themes', icon: Palette },
        { id: 'brandSettings', title: t('sidebar.brandSettings'), url: '/brand-settings', icon: ImageIcon },
        { id: 'accountSettings', title: t('sidebar.accountSettings'), url: '/settings', icon: User }
      ]
    }
  ];
  return filterAdminNav(items, isAdmin);
};

// 使用memo优化NavItem渲染
interface NavItemProps {
  item: NavItem;
  isCollapsed: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  iconStyle: React.CSSProperties;
  iconClass: string;
}

const MemoizedNavItem = memo(function MemoizedNavItem({
  item,
  isCollapsed,
  isExpanded,
  onToggle,
  iconStyle,
  iconClass
}: NavItemProps) {
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;

  // 判断当前菜单项是否处于激活态（用于显示激活高亮）
  // - 有子菜单时：当前路径匹配任一子菜单的 URL（精确匹配或前缀匹配）
  // - 这样在收起状态下访问子页面时，父级 icon 也能正确高亮
  const isItemActive = useMemo(() => {
    if (!hasChildren || !item.children) return false;
    const currentPath = location.pathname;
    return item.children.some(child => {
      if (!child.url) return false;
      return currentPath === child.url || currentPath.startsWith(child.url + '/');
    });
  }, [location.pathname, item.children, hasChildren]);

  if (hasChildren) {
    // 收起状态下：点击 icon 弹出二级菜单浮层
    // 浮层直接展示父级标题与子菜单项，子菜单项是真正的可点击 NavLink
    // 这样既保持了侧边栏的紧凑，又能让用户在不展开侧边栏的情况下访问二级菜单
    if (isCollapsed) {
      return (
        <SidebarMenuItem className="w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                tooltip={item.title}
                className={cn(
                  sidebarNavItemGroupClass,
                  "flex items-center rounded-lg transition-all cursor-pointer",
                  "justify-center w-10 h-10 p-0",
                  "hover:bg-primary/10",
                  // 父菜单处于激活态时（任一子菜单被激活），使用与子菜单激活态一致的明显样式
                  isItemActive && "bg-primary/20 text-primary font-medium shadow-sm"
                )}
              >
                {item.icon && (
                  <SidebarHoverIcon icon={item.icon} className={iconClass} style={iconStyle} />
                )}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              sideOffset={8}
              className="min-w-[200px]"
            >
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b border-border/50 mb-1">
                {item.title}
              </div>
              {item.children?.map(child => (
                <DropdownMenuItem key={child.id} asChild>
                  <NavLink
                    to={child.url || '#'}
                    className={cn(sidebarNavItemGroupClass, "cursor-pointer flex items-center gap-2 py-2")}
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    {child.icon && (
                      <SidebarHoverIcon icon={child.icon} className="w-4 h-4 shrink-0" style={iconStyle} />
                    )}
                    <span>{child.title}</span>
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    // 展开状态：使用 Collapsible 正常显示子菜单
    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={onToggle}
        className="w-full"
      >
        <SidebarMenuItem className="w-full">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={item.title}
              className={cn(
                sidebarNavItemGroupClass,
                "flex items-center rounded-lg transition-all cursor-pointer",
                "gap-3 px-3 py-2.5 w-full",
                "hover:bg-primary/10"
              )}
            >
              {item.icon && (
                <SidebarHoverIcon icon={item.icon} className={iconClass} style={iconStyle} />
              )}
              <span className="flex-1 text-left">{item.title}</span>
              {isExpanded
                ? <SidebarHoverIcon icon={ChevronDown} className={iconClass} style={iconStyle} />
                : <SidebarHoverIcon icon={ChevronRight} className={iconClass} style={iconStyle} />}
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="ml-2 mt-1 border-l-2 border-primary/20 pl-2">
              {item.children?.map(child => (
                <SidebarMenuItem key={child.id} className="w-full">
                  <SidebarMenuButton asChild tooltip={child.title}>
                    <NavLink
                      to={child.url || '#'}
                      className={cn(
                        sidebarNavItemGroupClass,
                        "flex items-center rounded-lg transition-all",
                        "gap-3 px-3 py-2",
                        "hover:bg-primary/10"
                      )}
                      activeClassName="bg-primary/20 text-primary font-medium shadow-sm"
                    >
                      {child.icon && (
                        <SidebarHoverIcon icon={child.icon} className="w-4 h-4 shrink-0" style={iconStyle} />
                      )}
                      <span>{child.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem className={cn(isCollapsed ? "w-auto" : "w-full")}>
      <SidebarMenuButton asChild tooltip={item.title}>
        <NavLink
          to={item.url || '#'}
          className={cn(
            sidebarNavItemGroupClass,
            "flex items-center rounded-lg transition-all",
            isCollapsed ? "justify-center w-10 h-10 p-0" : "gap-3 px-3 py-2.5",
            "hover:bg-primary/10"
          )}
          activeClassName="bg-primary/20 text-primary font-medium shadow-sm"
        >
          {item.icon && (
            <SidebarHoverIcon icon={item.icon} className="w-5 h-5 shrink-0" style={iconStyle} />
          )}
          {!isCollapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
});

// 主组件
export function AppSidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { state: sidebarState, toggleSidebar, isMobile } = useSidebar();
  const { style: themeStyle, iconColor, sidebarLayout } = useTheme();
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const { isAIEnabled, refresh: refreshAIStatus } = useAIStatus();
  const { title: brandTitle, subtitle: brandSubtitle, iconUrl: brandIconUrl } = useBrand();

  const navItems = useMemo(() => getNavItems(t, isAIEnabled, isAdmin), [t, isAIEnabled, isAdmin]);
  // 移动端模式下侧边栏总是展开（抽屉打开后需要展示完整菜单，而不是仅 icon）
  // 桌面端才遵循用户的收起/展开偏好
  const isCollapsed = !isMobile && sidebarState === 'collapsed';
  const isGlassmorphism = themeStyle === 'glassmorphism';

  // 品牌设置对话框开关
  const [showBrandDialog, setShowBrandDialog] = useState(false);

  // 使用系统控制hook
  const {
    showRestartDialog,
    setShowRestartDialog,
    isRestarting,
    restartProgress,
    restartCompleted,
    handleRestart,
    showPauseDialog,
    setShowPauseDialog,
    isPaused,
    isPausing,
    pauseProgress,
    pauseCompleted,
    handlePause,
    handleResume,
  } = useSystemControl();

  // 展开/收起状态管理 - 使用稳定的 id 作为 key，避免切换语言后状态丢失
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const location = useLocation();

  // 路由进入 /ai-config 页面后，从后端同步最新 AI 启用状态
  useEffect(() => {
    if (location.pathname === '/ai-config') {
      refreshAIStatus();
    }
  }, [location.pathname, refreshAIStatus]);
  const isInitialMount = useRef(true);

  // AI 配置菜单的稳定 id
  const AI_CONFIG_ID = 'aiConfig';

  const toggleExpanded = (id: string) => {
    const willExpand = !expandedItems[id];
    setExpandedItems(prev => ({
      ...prev,
      [id]: willExpand
    }));
    // 展开 AI 配置菜单时，重新从后端校验 AI 是否启动，
    // 以保证未点击 /ai-config 时也能显示完整的 AI 子菜单
    if (willExpand && id === AI_CONFIG_ID) {
      refreshAIStatus();
    }
  };

  // 首次加载时根据当前路由自动展开对应的一级菜单
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const currentPath = location.pathname;
      navItems.forEach(item => {
        if (item.children) {
          const hasActiveChild = item.children.some(child =>
            currentPath === child.url || currentPath.startsWith((child.url || '') + '/')
          );
          if (hasActiveChild) {
            setExpandedItems(prev => ({ ...prev, [item.id]: true }));
          }
        }
      });
    }
  }, [location.pathname, navItems]);

  // 图标样式 - 使用useMemo避免每次渲染重新计算
  const iconStyle = useMemo((): React.CSSProperties => {
    if (iconColor === 'white') {
      return { color: 'white', stroke: 'white' };
    } else if (iconColor === 'black') {
      return { color: 'black', stroke: 'black' };
    }
    return { color: 'hsl(var(--primary))', stroke: 'hsl(var(--primary))' };
  }, [iconColor]);

  const iconClass = "w-5 h-5 shrink-0";

  // 侧边栏布局：floating=悬浮卡片 / docked=贴边玻璃面板 / line=仅分割线
  const sidebarVariant = sidebarLayout === 'floating' ? 'floating' : 'sidebar';
  const sidebarChromeClass =
    sidebarLayout === 'floating'
      ? 'floating-sidebar'
      : sidebarLayout === 'line'
        ? 'line-sidebar'
        : 'glass-sidebar';

  return (
    <Sidebar
      variant={sidebarVariant}
      collapsible="icon"
      className={sidebarChromeClass}
    >
      <SidebarHeader className={cn("p-4", isCollapsed && "flex flex-col items-center")}>
        <div className={cn("flex items-center w-full", isCollapsed ? "justify-center" : "justify-between gap-2")}>
          <button
            type="button"
            // 收起时：点击 ICON = 展开侧边栏
            // 展开时：点击 ICON = 打开品牌配置
            onClick={isCollapsed ? toggleSidebar : () => setShowBrandDialog(true)}
            className={cn(
              "flex items-center group/brand rounded-lg p-1 -ml-1 transition-colors hover:bg-primary/10 shrink-0 min-w-0 text-left",
              isCollapsed ? "justify-center" : "gap-3"
            )}
            // 收起时 hover 提示改为"展开侧边栏"，与新职责一致
            title={isCollapsed ? t('sidebar.expandSidebar') : t('brand.editBrand')}
            aria-label={isCollapsed ? t('sidebar.expandSidebar') : t('brand.editBrand')}
          >
            {/* 收起时 ICON 缩小到 75%（40 → 30 px），留出 hover 热区 */}
            <div
              className={cn(
                "flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300 ease-out-soft",
                isCollapsed ? "w-[30px] h-[30px]" : "w-10 h-10"
              )}
            >
              <img
                src={brandIconUrl}
                alt={brandTitle}
                className={cn(
                  "object-contain transition-all duration-300 ease-out-soft",
                  isCollapsed ? "w-[30px] h-[30px]" : "w-10 h-10"
                )}
                key={brandIconUrl}
              />
            </div>
            {/* 标题/副标题：收起时折叠为宽度 0 + 透明，与 sidebar 宽度动画同步淡出 */}
            <div
              className={cn(
                "flex flex-col items-start min-w-0 overflow-hidden transition-all duration-300 ease-out-soft",
                isCollapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[200px] opacity-100"
              )}
            >
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span className="font-bold text-lg">{brandTitle}</span>
                {/* rounded-md 挂 --radius，随主题杂项「圆角强度」变化；覆盖 Badge 默认的 rounded-full */}
                <Badge variant="default" className="rounded-md text-xs font-medium shrink-0">v{import.meta.env.PACKAGE_VERSION || '0.1.2'}</Badge>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{brandSubtitle}</span>
            </div>
          </button>
          {/* 折叠按钮：宽度/透明度同步过渡，避免突然消失 */}
          <button
            onClick={toggleSidebar}
            className={cn(
              sidebarNavItemGroupClass,
              "h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-all duration-300 ease-out-soft text-muted-foreground hover:text-foreground shrink-0 overflow-hidden",
              isCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-8 opacity-100"
            )}
            aria-label={t('sidebar.collapseSidebar')}
            tabIndex={isCollapsed ? -1 : 0}
          >
            <SidebarHoverIcon icon={PanelLeftClose} className="w-4 h-4" />
          </button>
        </div>
      </SidebarHeader>

      <Separator className="opacity-30 mx-2" />

      <SidebarContent className={cn(isCollapsed ? "px-1" : "p-2")}>
        <SidebarGroup className={cn(isCollapsed && "p-0")}>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-muted-foreground/70">
              {t('sidebar.navMenu')}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className={cn(isCollapsed && "items-center")}>
              {navItems.map(item => (
                <MemoizedNavItem
                  key={item.id}
                  item={item}
                  isCollapsed={isCollapsed}
                  isExpanded={expandedItems[item.id] ?? false}
                  onToggle={() => toggleExpanded(item.id)}
                  iconStyle={iconStyle}
                  iconClass={iconClass}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("p-4", isCollapsed && "flex flex-col items-center")}>
        <Separator className="mb-4 opacity-30" />

        <div
          className={cn("flex items-center mb-3 cursor-pointer hover:opacity-80 transition-opacity", isCollapsed ? "justify-center" : "gap-3")}
          onClick={() => navigate('/settings')}
          title={t('sidebar.settings')}
        >
          <Avatar className="w-9 h-9 ring-2 ring-primary/20">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                {user?.name?.charAt(0) || 'U'}
              </AvatarFallback>
            )}
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{user?.name}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={isCollapsed ? 'icon' : 'default'}
              className={cn(
                "hover:text-primary hover:bg-primary/10 transition-colors",
                isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2"
              )}
            >
              {(() => {
                const currentLanguage = availableLanguages.find((lang) => lang.code === language);
                return currentLanguage ? <LanguageFlag code={currentLanguage.flagCode} /> : null;
              })()}
              {!isCollapsed && <span>{availableLanguages.find((lang) => lang.code === language)?.name ?? language}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableLanguages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={cn("cursor-pointer gap-2", language === lang.code && "bg-accent")}
              >
                <LanguageFlag code={lang.flagCode} />
                <span>{lang.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {isAdmin && (
        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'default'}
          onClick={() => setShowPauseDialog(true)}
          title={isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')}
          className={cn(
            sidebarNavItemGroupClass,
            "hover:text-yellow-500 hover:bg-yellow-500/10 transition-colors",
            isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2"
          )}
        >
          {isPaused
            ? <SidebarHoverIcon icon={RotateCw} className="w-4 h-4" />
            : <SidebarHoverIcon icon={Power} className="w-4 h-4" />}
          {!isCollapsed && <span>{isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')}</span>}
        </Button>
        )}

        {isAdmin && (
        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'default'}
          onClick={() => setShowRestartDialog(true)}
          title={t('sidebar.restartGsCore')}
          className={cn(
            sidebarNavItemGroupClass,
            "hover:text-orange-500 hover:bg-orange-500/10 transition-colors",
            isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2"
          )}
        >
          <SidebarHoverIcon icon={Power} className="w-4 h-4" />
          {!isCollapsed && <span>{t('sidebar.restartGsCore')}</span>}
        </Button>
        )}

        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'default'}
          onClick={logout}
          className={cn(
            sidebarNavItemGroupClass,
            "hover:text-destructive hover:bg-destructive/10 transition-colors",
            isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2"
          )}
        >
          <SidebarHoverIcon icon={LogOut} className="w-4 h-4" />
          {!isCollapsed && <span>{t('sidebar.logout')}</span>}
        </Button>
      </SidebarFooter>

      {/* 重启对话框 */}
      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent>
          <DialogHeader>
            {restartCompleted ? (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin text-green-500" />
                  {t('sidebar.restartSuccess')}
                </DialogTitle>
                <DialogDescription>
                  {t('sidebar.restartSuccessDesc')}
                </DialogDescription>
              </>
            ) : isRestarting ? (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin" />
                  {t('sidebar.restartSystem')}
                </DialogTitle>
                <DialogDescription>
                  {t('sidebar.restartingDesc')}
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle>{t('sidebar.confirmRestartTitle')}</DialogTitle>
                <DialogDescription className="text-red-500 italic">
                  {t('sidebar.confirmRestartDesc')}
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {isRestarting && (
            <div className="py-4">
              <Progress value={restartProgress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {Math.round(restartProgress)}%
              </p>
            </div>
          )}

          <DialogFooter>
            {restartCompleted ? (
              <Button variant="default" onClick={() => setShowRestartDialog(false)}>
                {t('common.confirm')}
              </Button>
            ) : isRestarting ? null : (
              <>
                <Button variant="outline" onClick={() => setShowRestartDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="destructive" onClick={handleRestart}>
                  {t('sidebar.restartSystem')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 暂停/恢复对话框 */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            {pauseCompleted ? (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin text-green-500" />
                  {isPaused ? t('sidebar.pauseSuccess') : t('sidebar.resumeSuccess')}
                </DialogTitle>
                <DialogDescription>
                  {isPaused ? t('sidebar.pauseSuccessDesc') : t('sidebar.resumeSuccessDesc')}
                </DialogDescription>
              </>
            ) : isPausing ? (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin" />
                  {isPaused ? t('sidebar.resumingSystem') : t('sidebar.pausingSystem')}
                </DialogTitle>
                <DialogDescription>
                  {isPaused ? t('sidebar.resumingDesc') : t('sidebar.pausingDesc')}
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle>{isPaused ? t('sidebar.confirmResumeTitle') : t('sidebar.confirmPauseTitle')}</DialogTitle>
                <DialogDescription className="text-red-500 italic">
                  {isPaused ? t('sidebar.confirmResumeDesc') : t('sidebar.confirmPauseDesc')}
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {isPausing && (
            <div className="py-4">
              <Progress value={pauseProgress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {Math.round(pauseProgress)}%
              </p>
            </div>
          )}

          <DialogFooter>
            {pauseCompleted ? (
              <Button variant="default" onClick={() => setShowPauseDialog(false)}>
                {t('common.confirm')}
              </Button>
            ) : isPausing ? null : (
              <>
                <Button variant="outline" onClick={() => setShowPauseDialog(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="destructive" onClick={isPaused ? handleResume : handlePause}>
                  {isPaused ? t('sidebar.resumeSystem') : t('sidebar.pauseSystem')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 品牌信息配置对话框 */}
      <BrandSettingsDialog open={showBrandDialog} onOpenChange={setShowBrandDialog} />
    </Sidebar>
  );
}