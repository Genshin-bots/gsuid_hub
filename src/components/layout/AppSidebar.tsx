import {
  Brain,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  Power,
  RotateCw,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAIStatus } from '@/contexts/AIStatusContext';
import { useBrand } from '@/contexts/BrandContext';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageFlag } from '@/components/ui/language-flag';
import { BrandSettingsDialog } from '@/components/brand/BrandSettingsDialog';
import { cn } from '@/lib/utils';
import { resolveApiAssetUrl } from '@/lib/api';
import type React from 'react';
import { useState, useEffect, useRef, memo, useMemo } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSystemControl } from '@/hooks/useSystemControl';
import { SidebarHoverIcon, sidebarNavItemGroupClass } from '@/components/layout/SidebarHoverIcon';
import {
  filterNavItemsByExcludeIds,
  getAiNavItems,
  getNavItems,
  isNavGroupActive,
  isNavItemActive,
  type NavItem,
} from '@/components/layout/navItems';
import { SystemControlDialogs } from '@/components/layout/SystemControlDialogs';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';

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
  iconClass,
}: NavItemProps) {
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;

  // 判断当前菜单项是否处于激活态（用于显示激活高亮）
  // - 有子菜单时：当前路径匹配任一子菜单的 URL（精确匹配或前缀匹配）
  // - 这样在收起状态下访问子页面时，父级 icon 也能正确高亮
  const isItemActive = useMemo(() => {
    if (!hasChildren || !item.children) return false;
    const currentPath = location.pathname;
    return item.children.some((child) => {
      const paths = [child.url, ...(child.activePaths ?? [])].filter(Boolean) as string[];
      return paths.some((p) => currentPath === p || currentPath.startsWith(`${p}/`));
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
                  'flex items-center rounded-lg transition-all cursor-pointer',
                  'justify-center w-10 h-10 p-0',
                  'hover:bg-primary/10',
                  // 父菜单处于激活态时（任一子菜单被激活），使用与子菜单激活态一致的明显样式
                  isItemActive && 'bg-primary/20 text-primary font-medium shadow-sm',
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
              {item.children?.map((child) => (
                <DropdownMenuItem key={child.id} asChild>
                  <NavLink
                    to={child.url || '#'}
                    activePaths={child.activePaths}
                    className={cn(
                      sidebarNavItemGroupClass,
                      'cursor-pointer flex items-center gap-2 py-2',
                    )}
                    activeClassName="bg-accent text-accent-foreground font-medium"
                  >
                    {child.icon && (
                      <SidebarHoverIcon
                        icon={child.icon}
                        className="w-4 h-4 shrink-0"
                        style={iconStyle}
                      />
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
      <Collapsible open={isExpanded} onOpenChange={onToggle} className="w-full">
        <SidebarMenuItem className="w-full">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              tooltip={item.title}
              className={cn(
                sidebarNavItemGroupClass,
                'flex items-center rounded-lg transition-all cursor-pointer',
                'gap-3 px-3 py-2.5 w-full',
                'hover:bg-primary/10',
              )}
            >
              {item.icon && (
                <SidebarHoverIcon icon={item.icon} className={iconClass} style={iconStyle} />
              )}
              <span className="flex-1 text-left">{item.title}</span>
              {isExpanded ? (
                <SidebarHoverIcon icon={ChevronDown} className={iconClass} style={iconStyle} />
              ) : (
                <SidebarHoverIcon icon={ChevronRight} className={iconClass} style={iconStyle} />
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="ml-2 mt-1 border-l-2 border-primary/20 pl-2">
              {item.children?.map((child) => (
                <SidebarMenuItem key={child.id} className="w-full">
                  <SidebarMenuButton asChild tooltip={child.title}>
                    <NavLink
                      to={child.url || '#'}
                      activePaths={child.activePaths}
                      className={cn(
                        sidebarNavItemGroupClass,
                        'flex items-center rounded-lg transition-all',
                        'gap-3 px-3 py-2',
                        'hover:bg-primary/10',
                      )}
                      activeClassName="bg-primary/20 text-primary font-medium shadow-sm"
                    >
                      {child.icon && (
                        <SidebarHoverIcon
                          icon={child.icon}
                          className="w-4 h-4 shrink-0"
                          style={iconStyle}
                        />
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
    <SidebarMenuItem className={cn(isCollapsed ? 'w-auto' : 'w-full')}>
      <SidebarMenuButton asChild tooltip={item.title}>
        <NavLink
          to={item.url || '#'}
          activePaths={item.activePaths}
          className={cn(
            sidebarNavItemGroupClass,
            'flex items-center rounded-lg transition-all',
            isCollapsed ? 'justify-center w-10 h-10 p-0' : 'gap-3 px-3 py-2.5',
            'hover:bg-primary/10',
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

// AI 配置菜单的稳定 id（正常侧用它把整组 AI 条目剔出去）
const AI_CONFIG_ID = 'aiConfig';
const NORMAL_EXCLUDED_IDS = new Set([AI_CONFIG_ID]);

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

  // 桌面侧边栏是「正常 / AI」双菜单：正常侧剔除 aiConfig 组，AI 侧直接平铺其子项
  const navItems = useMemo(
    () => filterNavItemsByExcludeIds(getNavItems(t, isAIEnabled, isAdmin), NORMAL_EXCLUDED_IDS),
    [t, isAIEnabled, isAdmin],
  );
  const aiItems = useMemo(() => getAiNavItems(t, isAIEnabled, isAdmin), [t, isAIEnabled, isAdmin]);
  // 移动端模式下侧边栏总是展开（抽屉打开后需要展示完整菜单，而不是仅 icon）
  // 桌面端才遵循用户的收起/展开偏好
  const isCollapsed = !isMobile && sidebarState === 'collapsed';
  const _isGlassmorphism = themeStyle === 'glassmorphism';

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

  // 菜单模式：跟随当前路由自动落到对应侧，也可手动切换浏览另一侧菜单
  const [navMode, setNavMode] = useState<'normal' | 'ai'>(() =>
    aiItems.some((item) => isNavItemActive(item, location.pathname)) ? 'ai' : 'normal',
  );

  useEffect(() => {
    const path = location.pathname;
    if (aiItems.some((item) => isNavItemActive(item, path))) {
      setNavMode('ai');
    } else if (
      navItems.some((item) => isNavItemActive(item, path) || isNavGroupActive(item, path))
    ) {
      setNavMode('normal');
    }
  }, [location.pathname, aiItems, navItems]);

  const switchNavMode = (mode: 'normal' | 'ai') => {
    setNavMode(mode);
    // 切到 AI 菜单时重新校验 AI 启用状态，保证子菜单完整（沿用原展开即校验的意图）
    if (mode === 'ai') refreshAIStatus();
  };

  const visibleItems = navMode === 'ai' ? aiItems : navItems;

  // 路由进入 /ai-config 页面后，从后端同步最新 AI 启用状态
  useEffect(() => {
    if (location.pathname === '/ai-config') {
      refreshAIStatus();
    }
  }, [location.pathname, refreshAIStatus]);
  const isInitialMount = useRef(true);

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 首次加载时根据当前路由自动展开对应的一级菜单
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const currentPath = location.pathname;
      navItems.forEach((item) => {
        if (item.children && isNavGroupActive(item, currentPath)) {
          setExpandedItems((prev) => ({ ...prev, [item.id]: true }));
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

  const iconClass = 'w-5 h-5 shrink-0';

  // 侧边栏布局：floating=悬浮卡片 / docked=贴边玻璃面板 / line=仅分割线
  const sidebarVariant = sidebarLayout === 'floating' ? 'floating' : 'sidebar';
  const sidebarChromeClass =
    sidebarLayout === 'floating'
      ? 'floating-sidebar'
      : sidebarLayout === 'line'
        ? 'line-sidebar'
        : 'glass-sidebar';

  // 移动端导航已由底部 Floating Tab Bar 与原位上弹菜单承接，不再渲染侧边栏抽屉
  if (isMobile) {
    return null;
  }

  return (
    <Sidebar variant={sidebarVariant} collapsible="icon" className={sidebarChromeClass}>
      <SidebarHeader className={cn(isCollapsed ? 'items-center px-0 py-3' : 'p-4')}>
        <div
          className={cn(
            'flex w-full items-center',
            isCollapsed ? 'justify-center' : 'justify-between gap-2',
          )}
        >
          <button
            type="button"
            // 收起时：点击 ICON = 展开侧边栏
            // 展开时：点击 ICON = 打开品牌配置
            onClick={isCollapsed ? toggleSidebar : () => setShowBrandDialog(true)}
            className={cn(
              'group/brand flex shrink-0 items-center rounded-lg text-left transition-colors hover:bg-primary/10',
              isCollapsed ? 'h-8 w-8 justify-center p-0' : 'min-w-0 gap-3 p-1 -ml-1',
            )}
            // 收起时 hover 提示改为"展开侧边栏"，与新职责一致
            title={isCollapsed ? t('sidebar.expandSidebar') : t('brand.editBrand')}
            aria-label={isCollapsed ? t('sidebar.expandSidebar') : t('brand.editBrand')}
          >
            {/* 收起时 ICON 缩小到 75%（40 → 30 px），留出 hover 热区 */}
            <div
              className={cn(
                'flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300 ease-out-soft',
                isCollapsed ? 'w-[30px] h-[30px]' : 'w-10 h-10',
              )}
            >
              <img
                src={brandIconUrl}
                alt={brandTitle}
                className={cn(
                  'object-contain transition-all duration-300 ease-out-soft',
                  isCollapsed ? 'w-[30px] h-[30px]' : 'w-10 h-10',
                )}
                key={brandIconUrl}
              />
            </div>
            {/* 标题/副标题：收起时折叠为宽度 0 + 透明，与 sidebar 宽度动画同步淡出 */}
            <div
              className={cn(
                'flex flex-col items-start min-w-0 overflow-hidden transition-all duration-300 ease-out-soft',
                isCollapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[200px] opacity-100',
              )}
            >
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span className="font-bold text-lg">{brandTitle}</span>
                <Badge
                  variant="secondary"
                  className="text-xs font-mono font-medium shrink-0 bg-muted/80 text-foreground border border-border/50"
                >
                  v{PACKAGE_VERSION}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {brandSubtitle}
              </span>
            </div>
          </button>
          {/* 折叠按钮：宽度/透明度同步过渡，避免突然消失 */}
          <button
            onClick={toggleSidebar}
            className={cn(
              sidebarNavItemGroupClass,
              'h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-all duration-300 ease-out-soft text-muted-foreground hover:text-foreground shrink-0 overflow-hidden',
              isCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-8 opacity-100',
            )}
            aria-label={t('sidebar.collapseSidebar')}
            tabIndex={isCollapsed ? -1 : 0}
          >
            <SidebarHoverIcon icon={PanelLeftClose} className="w-4 h-4" />
          </button>
        </div>
      </SidebarHeader>

      <Separator className="opacity-30 mx-2" />

      {/* 正常 / AI 菜单切换：固定在滚动区外，位置即「导航菜单」标签上方 */}
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-1 py-2">
          {[
            { value: 'normal' as const, icon: LayoutGrid, label: t('sidebar.navModeNormal') },
            { value: 'ai' as const, icon: Brain, label: t('sidebar.aiConfig') },
          ].map((mode) => (
            <SidebarMenuButton
              key={mode.value}
              tooltip={mode.label}
              onClick={() => switchNavMode(mode.value)}
              className={cn(
                sidebarNavItemGroupClass,
                'flex items-center rounded-lg transition-all cursor-pointer',
                'justify-center w-10 h-10 p-0',
                'hover:bg-primary/10',
                navMode === mode.value && 'bg-primary/20 text-primary font-medium shadow-sm',
              )}
            >
              <SidebarHoverIcon icon={mode.icon} className="w-5 h-5" style={iconStyle} />
            </SidebarMenuButton>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2">
          <TabButtonGroup
            value={navMode}
            onValueChange={(v) => switchNavMode(v as 'normal' | 'ai')}
            className="grid w-full grid-cols-2"
            options={[
              {
                value: 'normal',
                label: t('sidebar.navModeNormal'),
                icon: <LayoutGrid className="h-4 w-4" />,
              },
              {
                value: 'ai',
                label: t('sidebar.aiConfig'),
                icon: <Brain className="h-4 w-4" />,
              },
            ]}
          />
        </div>
      )}

      <SidebarContent className={cn(isCollapsed ? 'px-1' : 'p-2')}>
        <SidebarGroup className={cn(isCollapsed && 'p-0')}>
          <SidebarGroupContent>
            <SidebarMenu className={cn(isCollapsed && 'items-center')}>
              {visibleItems.map((item) => (
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

      <SidebarFooter className={cn(isCollapsed ? 'items-center px-0 py-3' : 'p-4')}>
        <Separator className="mb-4 opacity-30" />

        <div
          className={cn(
            'flex items-center mb-3 cursor-pointer hover:opacity-80 transition-opacity',
            isCollapsed ? 'w-full justify-center' : 'gap-3',
          )}
          onClick={() => navigate('/settings')}
          title={t('sidebar.settings')}
        >
          <Avatar className="w-9 h-9 ring-2 ring-primary/20">
            {user?.avatar ? (
              <img
                src={resolveApiAssetUrl(user.avatar)}
                alt={user.name}
                className="w-full h-full object-cover rounded-full"
              />
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
                'hover:text-primary hover:bg-primary/10 transition-colors',
                isCollapsed ? 'w-auto justify-center' : 'w-full justify-start gap-2',
              )}
            >
              {(() => {
                const currentLanguage = availableLanguages.find((lang) => lang.code === language);
                return currentLanguage ? <LanguageFlag code={currentLanguage.flagCode} /> : null;
              })()}
              {!isCollapsed && (
                <span>
                  {availableLanguages.find((lang) => lang.code === language)?.name ?? language}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableLanguages.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={cn('cursor-pointer gap-2', language === lang.code && 'bg-accent')}
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
              'hover:text-yellow-500 hover:bg-yellow-500/10 transition-colors',
              isCollapsed ? 'w-auto justify-center' : 'w-full justify-start gap-2',
            )}
          >
            {isPaused ? (
              <SidebarHoverIcon icon={RotateCw} className="w-4 h-4" />
            ) : (
              <SidebarHoverIcon icon={Power} className="w-4 h-4" />
            )}
            {!isCollapsed && (
              <span>{isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')}</span>
            )}
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
              'hover:text-orange-500 hover:bg-orange-500/10 transition-colors',
              isCollapsed ? 'w-auto justify-center' : 'w-full justify-start gap-2',
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
            'hover:text-destructive hover:bg-destructive/10 transition-colors',
            isCollapsed ? 'w-auto justify-center' : 'w-full justify-start gap-2',
          )}
        >
          <SidebarHoverIcon icon={LogOut} className="w-4 h-4" />
          {!isCollapsed && <span>{t('sidebar.logout')}</span>}
        </Button>
      </SidebarFooter>

      <SystemControlDialogs
        showRestartDialog={showRestartDialog}
        setShowRestartDialog={setShowRestartDialog}
        isRestarting={isRestarting}
        restartProgress={restartProgress}
        restartCompleted={restartCompleted}
        handleRestart={handleRestart}
        showPauseDialog={showPauseDialog}
        setShowPauseDialog={setShowPauseDialog}
        isPaused={isPaused}
        isPausing={isPausing}
        pauseProgress={pauseProgress}
        pauseCompleted={pauseCompleted}
        handlePause={handlePause}
        handleResume={handleResume}
      />

      {/* 品牌信息配置对话框 */}
      <BrandSettingsDialog open={showBrandDialog} onOpenChange={setShowBrandDialog} />
    </Sidebar>
  );
}
