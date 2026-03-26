import { LayoutDashboard, Database, Settings, FileText, LogOut, Palette, Terminal, Calendar, Store, Cpu, HardDrive, PanelLeftClose, PanelLeft, Cog, Power, RotateCw, Globe, User, Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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

// 导航项类型定义
interface NavItem {
  title: string;
  url?: string;
  icon?: React.ElementType;
  children?: NavItem[];
}

// 静态导航配置 - 避免每次渲染重新创建
const NAV_ITEMS_KEYS = ['dashboard', 'database', 'adminCore', 'logsView', 'aiConfig', 'plugins', 'pluginStore', 'consoleManagement'] as const;

// 图标映射 - 使用静态对象避免每次渲染重新创建
const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Database,
  Cog,
  Cpu,
  HardDrive,
  Calendar,
  FileText,
  Terminal,
  Brain,
  Settings,
  Store,
  Palette,
  User,
};

// 导航项配置
const getNavItems = (t: (key: string) => string): NavItem[] => [
  { title: t('sidebar.dashboard'), url: '/dashboard', icon: LayoutDashboard },
  { title: t('sidebar.database'), url: '/database', icon: Database },
  {
    title: t('sidebar.adminCore'),
    icon: Cog,
    children: [
      { title: t('sidebar.coreConfig'), url: '/core-config', icon: Cog },
      { title: t('sidebar.frameworkConfig'), url: '/framework-config', icon: Cpu },
      { title: t('sidebar.backup'), url: '/backup', icon: HardDrive },
      { title: t('sidebar.scheduler'), url: '/scheduler', icon: Calendar }
    ]
  },
  {
    title: t('sidebar.logsView'),
    icon: FileText,
    children: [
      { title: t('sidebar.console'), url: '/console', icon: Terminal },
      { title: t('sidebar.historyLogs'), url: '/logs', icon: FileText }
    ]
  },
  { title: t('sidebar.aiConfig'), url: '/ai-config', icon: Brain },
  { title: t('sidebar.plugins'), url: '/plugins', icon: Settings },
  { title: t('sidebar.pluginStore'), url: '/plugin-store', icon: Store },
  {
    title: t('sidebar.consoleManagement'),
    icon: Settings,
    children: [
      { title: t('sidebar.themes'), url: '/themes', icon: Palette },
      { title: t('sidebar.accountSettings'), url: '/settings', icon: User }
    ]
  }
];

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
  const hasChildren = item.children && item.children.length > 0;

  if (hasChildren) {
    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={onToggle}
        className={cn(isCollapsed ? "w-auto" : "w-full")}
      >
        <SidebarMenuItem className="w-full">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton 
              tooltip={item.title} 
              className={cn(
                "flex items-center rounded-lg transition-all cursor-pointer",
                isCollapsed ? "justify-center w-10 h-10 p-0" : "gap-3 px-3 py-2.5 w-full",
                "hover:bg-primary/10"
              )}
            >
              {item.icon && React.createElement(item.icon, { className: iconClass, style: iconStyle })}
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.title}</span>
                  {isExpanded 
                    ? React.createElement(ChevronDown, { className: iconClass, style: iconStyle }) 
                    : React.createElement(ChevronRight, { className: iconClass, style: iconStyle })}
                </>
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>
          {!isCollapsed && (
            <CollapsibleContent>
              <SidebarMenu className="ml-2 mt-1 border-l-2 border-primary/20 pl-2">
                {item.children?.map(child => (
                  <SidebarMenuItem key={child.title} className="w-full">
                    <SidebarMenuButton asChild tooltip={child.title}>
                      <NavLink 
                        to={child.url || '#'} 
                        className={cn(
                          "flex items-center rounded-lg transition-all",
                          "gap-3 px-3 py-2",
                          "hover:bg-primary/10"
                        )} 
                        activeClassName="bg-primary/20 text-primary font-medium shadow-sm"
                      >
                        {child.icon && <child.icon className="w-4 h-4 shrink-0" style={iconStyle} />}
                        <span>{child.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          )}
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
            "flex items-center rounded-lg transition-all",
            isCollapsed ? "justify-center w-10 h-10 p-0" : "gap-3 px-3 py-2.5",
            "hover:bg-primary/10"
          )} 
          activeClassName="bg-primary/20 text-primary font-medium shadow-sm"
        >
          {item.icon && <item.icon className="w-5 h-5 shrink-0" style={iconStyle} />}
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
  const { state: sidebarState, toggleSidebar } = useSidebar();
  const { style: themeStyle, iconColor } = useTheme();
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  
  const navItems = useMemo(() => getNavItems(t), [t]);
  const isCollapsed = sidebarState === 'collapsed';
  const isGlassmorphism = themeStyle === 'glassmorphism';

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

  // 展开/收起状态管理
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const isInitialMount = useRef(true);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  // 首次加载时根据当前路由自动展开对应的一级菜单
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const currentPath = location.pathname;
      navItems.forEach(item => {
        if (item.children) {
          const hasActiveChild = item.children.some(child =>
            currentPath === child.url || currentPath.startsWith(child.url + '/')
          );
          if (hasActiveChild) {
            setExpandedItems(prev => ({ ...prev, [item.title]: true }));
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

  return (
    <Sidebar 
      variant="sidebar" 
      collapsible="icon" 
      className={cn("border-0", isGlassmorphism ? "floating-sidebar" : "bg-sidebar shadow-lg")}
    >
      <SidebarHeader className={cn("p-4", isCollapsed && "flex flex-col items-center")}>
        <div className={cn("flex items-center w-full", isCollapsed ? "justify-center" : "justify-between")}>
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
              <img src="/app/ICON.png" alt="GsCore" className="w-8 h-8 object-contain" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-lg">{t('sidebar.gsCore')}</span>
                  <span className="font-light text-sm text-muted-foreground">v{import.meta.env.PACKAGE_VERSION || '0.0.4'}</span>
                </div>
                <span className="text-xs text-muted-foreground">​{t('sidebar.早柚核心')}</span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button 
              onClick={toggleSidebar} 
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground" 
              aria-label={t('sidebar.collapseSidebar')}
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
        {isCollapsed && (
          <button 
            onClick={toggleSidebar} 
            className="mt-2 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground" 
            aria-label={t('sidebar.expandSidebar')}
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
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
                  key={item.title}
                  item={item}
                  isCollapsed={isCollapsed}
                  isExpanded={expandedItems[item.title] ?? false}
                  onToggle={() => toggleExpanded(item.title)}
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
                "text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors", 
                isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2"
              )}
            >
              <Globe className="w-4 h-4" />
              {!isCollapsed && <span>{language === 'zh-CN' ? '中文' : 'English'}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableLanguages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={cn("cursor-pointer", language === lang.code && "bg-accent")}
              >
                {lang.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="ghost" 
          size={isCollapsed ? 'icon' : 'default'} 
          onClick={() => setShowPauseDialog(true)} 
          title={isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')} 
          className={cn(
            "text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10 transition-colors", 
            isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2"
          )}
        >
          {isPaused ? <RotateCw className="w-4 h-4" /> : <Power className="w-4 h-4" />}
          {!isCollapsed && <span>{isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')}</span>}
        </Button>

        <Button 
          variant="ghost" 
          size={isCollapsed ? 'icon' : 'default'} 
          onClick={() => setShowRestartDialog(true)} 
          title={t('sidebar.restartGsCore')} 
          className={cn(
            "text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-colors", 
            isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2"
          )}
        >
          <Power className="w-4 h-4" />
          {!isCollapsed && <span>{t('sidebar.restartGsCore')}</span>}
        </Button>

        <Button 
          variant="ghost" 
          size={isCollapsed ? 'icon' : 'default'} 
          onClick={logout} 
          className={cn(
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors", 
            isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2"
          )}
        >
          <LogOut className="w-4 h-4" />
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
    </Sidebar>
  );
}