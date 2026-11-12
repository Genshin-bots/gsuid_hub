import {
  ChevronDown,
  ChevronRight,
  Home,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  Pause,
  Play,
  Puzzle,
  RotateCw,
  Terminal,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrandSettingsDialog } from '@/components/brand/BrandSettingsDialog';
import {
  filterNavItemsByExcludeIds,
  getNavItems,
  isNavGroupActive,
  isNavItemActive,
  type NavItem,
} from '@/components/layout/navItems';
import { hoverIconGroupClass, SidebarHoverIcon } from '@/components/layout/SidebarHoverIcon';
import { SystemControlDialogs } from '@/components/layout/SystemControlDialogs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LanguageFlag } from '@/components/ui/language-flag';
import { LiquidSegmentThumb } from '@/components/ui/LiquidSegmentThumb';
import { useAIStatus } from '@/contexts/AIStatusContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBrand } from '@/contexts/BrandContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSystemControl } from '@/hooks/useSystemControl';
import { resolveApiAssetUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type MobileTabId, resolveMobileTabId } from './mobileTabBarUtils';

interface MobileTabItem {
  id: MobileTabId;
  path: string | null;
  icon: LucideIcon;
  label: string;
}

type NavRun = { kind: 'singles'; items: NavItem[] } | { kind: 'group'; item: NavItem };

const MOBILE_TAB_EXCLUDED_NAV_IDS: ReadonlySet<string> = new Set([
  'home',
  'dashboard',
  'console',
  'plugins',
]);

function groupNavRuns(items: NavItem[]): NavRun[] {
  const runs: NavRun[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      runs.push({ kind: 'group', item });
      continue;
    }
    const prev = runs[runs.length - 1];
    if (prev && prev.kind === 'singles') {
      prev.items.push(item);
    } else {
      runs.push({ kind: 'singles', items: [item] });
    }
  }
  return runs;
}

export function MobileTabBar() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { mode } = useTheme();
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const { isAIEnabled, refresh: refreshAIStatus } = useAIStatus();
  const { title: brandTitle, iconUrl: brandIconUrl } = useBrand();

  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);

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

  const navItems = useMemo(
    () =>
      filterNavItemsByExcludeIds(getNavItems(t, isAIEnabled, isAdmin), MOBILE_TAB_EXCLUDED_NAV_IDS),
    [t, isAIEnabled, isAdmin],
  );
  const navRuns = useMemo(() => groupNavRuns(navItems), [navItems]);

  // 路由切换或脱离移动端视口时收起原位菜单
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, isMobile]);

  // 弹出菜单时自动展开当前路径所属的分组，并支持 Esc 退出
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const activeGroups: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.children && isNavGroupActive(item, location.pathname)) {
        activeGroups[item.id] = true;
      }
    }
    if (Object.keys(activeGroups).length > 0) {
      setExpandedGroups((prev) => ({ ...prev, ...activeGroups }));
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, navItems, location.pathname]);

  if (!isMobile) {
    return null;
  }

  const activeTab = resolveMobileTabId(location.pathname, menuOpen);
  const currentLanguage = availableLanguages.find((lang) => lang.code === language);

  const tabs: MobileTabItem[] = [
    {
      id: 'home',
      path: '/home',
      icon: Home,
      label: t('sidebar.mobileNav.home'),
    },
    {
      id: 'dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      label: t('sidebar.mobileNav.dashboard'),
    },
    {
      id: 'console',
      path: '/console',
      icon: Terminal,
      label: t('sidebar.mobileNav.console'),
    },
    {
      id: 'plugins',
      path: '/plugins',
      icon: Puzzle,
      label: t('sidebar.mobileNav.plugins'),
    },
    {
      id: 'menu',
      path: null,
      icon: Menu,
      label: t('sidebar.mobileNav.menu'),
    },
  ];

  const handleNavigate = (url?: string) => {
    if (!url) {
      return;
    }
    setMenuOpen(false);
    navigate(url);
  };

  const toggleGroup = (id: string) => {
    const willExpand = !expandedGroups[id];
    setExpandedGroups((prev) => ({ ...prev, [id]: willExpand }));
    if (willExpand && id === 'aiConfig') {
      refreshAIStatus();
    }
  };

  return (
    <>
      {/* 遮罩严格区分亮暗主题，不额外叠加 backdrop-blur，以免削弱菜单卡片本身的玻璃滤镜 */}
      <button
        type="button"
        aria-label={t('common.close')}
        aria-hidden={!menuOpen}
        tabIndex={menuOpen ? 0 : -1}
        data-state={menuOpen ? 'open' : 'closed'}
        onClick={() => setMenuOpen(false)}
        className={cn(
          'mobile-floating-menu-backdrop md:hidden',
          mode === 'dark' ? 'bg-black/45' : 'bg-white/35',
        )}
      />

      {/* 原位上弹菜单：常驻挂载以支持开合双向弹簧动画，关闭态由 visibility: hidden 阻断交互 */}
      <section
        aria-label={t('sidebar.navMenu')}
        aria-hidden={!menuOpen}
        data-state={menuOpen ? 'open' : 'closed'}
        className="mobile-floating-menu-dock md:hidden"
      >
        <div className="glass-card relative flex max-h-[min(64dvh,calc(100dvh-var(--mobile-tabbar-height,3.5rem)-var(--mobile-tabbar-bottom,0.75rem)-2rem))] flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
            {/* 顶部：品牌信息 + 当前用户，左右与下方网格边界 px-3 严格对齐 */}
            <div className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowBrandDialog(true);
                }}
                title={t('brand.editBrand')}
                className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2.5 text-left transition-colors hover:bg-foreground/[0.06]"
              >
                <img
                  src={brandIconUrl}
                  alt={brandTitle}
                  className="h-6 w-6 shrink-0 object-contain"
                />
                <span className="min-w-0 truncate text-sm font-semibold">{brandTitle}</span>
                <Badge
                  variant="secondary"
                  className="shrink-0 border border-border/50 bg-muted/70 px-1.5 py-0 font-mono text-[10px] font-medium text-foreground"
                >
                  v{PACKAGE_VERSION}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => handleNavigate('/settings')}
                title={t('sidebar.settings')}
                className="flex h-9 min-w-0 max-w-[44%] shrink-0 items-center gap-2 rounded-md px-2.5 transition-colors hover:bg-foreground/[0.06]"
              >
                <Avatar className="h-6 w-6 shrink-0 ring-1 ring-primary/25">
                  {user?.avatar ? (
                    <img
                      src={resolveApiAssetUrl(user.avatar)}
                      alt={user.name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <AvatarFallback className="bg-primary/20 text-[10px] font-medium text-primary">
                      {user?.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="min-w-0 truncate text-xs font-medium">{user?.name}</span>
              </button>
            </div>

            {/* 中部：已排除底栏已有入口，单项与折叠分组标题统一 h-9 + px-2.5 */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-2.5">
              {navRuns.map((run) => {
                if (run.kind === 'singles') {
                  return (
                    <div key={run.items[0].id} className="grid grid-cols-2 gap-2">
                      {run.items.map((item) => {
                        const active = isNavItemActive(item, location.pathname);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleNavigate(item.url)}
                            title={item.title}
                            className={cn(
                              hoverIconGroupClass,
                              'flex h-9 min-w-0 items-center gap-2 rounded-md border px-2.5 text-left text-xs transition-colors [&:last-child:nth-child(odd)]:col-span-2',
                              active
                                ? 'border-primary/35 bg-primary/15 font-medium text-primary'
                                : 'border-border/25 bg-foreground/[0.03] text-foreground hover:bg-foreground/[0.07]',
                            )}
                          >
                            {item.icon && (
                              <SidebarHoverIcon icon={item.icon} className="h-4 w-4 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1 truncate">{item.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                const groupItem = run.item;
                const isExpanded = expandedGroups[groupItem.id] ?? false;
                const groupActive = isNavGroupActive(groupItem, location.pathname);

                return (
                  <div
                    key={groupItem.id}
                    className="rounded-md border border-border/25 bg-foreground/[0.03]"
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleGroup(groupItem.id)}
                      className={cn(
                        hoverIconGroupClass,
                        'flex h-9 w-full min-w-0 items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium transition-colors',
                        groupActive ? 'text-primary' : 'text-foreground hover:bg-foreground/[0.05]',
                      )}
                    >
                      {groupItem.icon && (
                        <SidebarHoverIcon icon={groupItem.icon} className="h-4 w-4 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate" title={groupItem.title}>
                        {groupItem.title}
                      </span>
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200 ease-out-soft',
                          isExpanded && 'rotate-90',
                        )}
                      />
                    </button>

                    {groupItem.children && (
                      <div
                        aria-hidden={!isExpanded}
                        className={cn(
                          'grid transition-[grid-template-rows,opacity] duration-200 ease-out-soft',
                          isExpanded
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'pointer-events-none grid-rows-[0fr] opacity-0',
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="grid grid-cols-2 gap-1.5 border-t border-border/20 p-2">
                            {groupItem.children.map((child) => {
                              const childActive = isNavItemActive(child, location.pathname);
                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  tabIndex={isExpanded ? 0 : -1}
                                  onClick={() => handleNavigate(child.url)}
                                  title={child.title}
                                  className={cn(
                                    hoverIconGroupClass,
                                    'flex h-8 min-w-0 items-center gap-2 rounded-sm border px-2 text-left text-xs transition-colors [&:last-child:nth-child(odd)]:col-span-2',
                                    childActive
                                      ? 'border-primary/35 bg-primary/15 font-medium text-primary'
                                      : 'border-border/20 bg-foreground/[0.03] text-foreground/90 hover:bg-foreground/[0.07]',
                                  )}
                                >
                                  {child.icon && (
                                    <SidebarHoverIcon
                                      icon={child.icon}
                                      className="h-3.5 w-3.5 shrink-0"
                                    />
                                  )}
                                  <span className="min-w-0 flex-1 truncate">{child.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 底部工具条：左对齐语言选择器，右对齐系统操作与退出，统一 h-9 与 px-3 边距 */}
            <div className="flex items-center justify-between gap-2 border-t border-border/30 px-3 py-2.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-border/25 bg-foreground/[0.03] px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.07]"
                    title={currentLanguage?.name ?? language}
                  >
                    {currentLanguage && <LanguageFlag code={currentLanguage.flagCode} />}
                    <span className="min-w-0 truncate">{currentLanguage?.name ?? language}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="z-50">
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

              <div className="flex shrink-0 items-center gap-1.5">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowPauseDialog(true);
                    }}
                    title={isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')}
                    aria-label={isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')}
                    className={cn(
                      hoverIconGroupClass,
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/25 bg-foreground/[0.03] text-yellow-500 transition-colors hover:bg-yellow-500/10',
                    )}
                  >
                    <SidebarHoverIcon icon={isPaused ? Play : Pause} className="h-4 w-4 shrink-0" />
                  </button>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowRestartDialog(true);
                    }}
                    title={t('sidebar.restartGsCore')}
                    aria-label={t('sidebar.restartGsCore')}
                    className={cn(
                      hoverIconGroupClass,
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/25 bg-foreground/[0.03] text-orange-500 transition-colors hover:bg-orange-500/10',
                    )}
                  >
                    <SidebarHoverIcon icon={RotateCw} className="h-4 w-4 shrink-0" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  title={t('sidebar.logout')}
                  className={cn(
                    hoverIconGroupClass,
                    'flex h-9 min-w-0 shrink-0 items-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15',
                  )}
                >
                  <SidebarHoverIcon icon={LogOut} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t('sidebar.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 底部 Floating Tab Bar */}
      <nav aria-label={t('sidebar.navMenu')} className="mobile-floating-tabbar-dock md:hidden">
        <div
          ref={navRef}
          className="tab-segment-row mobile-floating-tabbar glass-card-flat relative grid w-full grid-cols-5 items-stretch gap-1 p-1"
        >
          <LiquidSegmentThumb containerRef={navRef} activeSelector="[data-active='true']" />
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-active={isActive ? 'true' : undefined}
                aria-current={tab.path && isActive ? 'page' : undefined}
                aria-expanded={tab.id === 'menu' ? menuOpen : undefined}
                onClick={() => {
                  if (tab.path) {
                    setMenuOpen(false);
                    navigate(tab.path);
                    return;
                  }
                  setMenuOpen((prev) => !prev);
                }}
                className={cn(
                  hoverIconGroupClass,
                  'relative z-10 flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors select-none outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <SidebarHoverIcon icon={tab.icon} className="h-[18px] w-[18px] shrink-0" />
                <span
                  className="min-w-0 max-w-full truncate text-[11px] font-medium leading-tight"
                  title={tab.label}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

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

      <BrandSettingsDialog open={showBrandDialog} onOpenChange={setShowBrandDialog} />
    </>
  );
}
