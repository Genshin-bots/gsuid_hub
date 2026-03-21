import { LayoutDashboard, Database, Settings, FileText, LogOut, Palette, Terminal, Calendar, Store, Cpu, HardDrive, PanelLeftClose, PanelLeft, Cog, Power, RotateCw, Globe, User, Brain } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
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
import { getAuthToken, getCustomApiHost, systemApi } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 导航项配置 - 辅助函数获取翻译后的标题
const getNavItems = (t: (key: string) => string) => [{
  title: t('sidebar.dashboard'),
  url: '/dashboard',
  icon: LayoutDashboard
}, {
  title: t('sidebar.database'),
  url: '/database',
  icon: Database
}, {
  title: t('sidebar.console'),
  url: '/console',
  icon: Terminal
}, {
  title: t('sidebar.scheduler'),
  url: '/scheduler',
  icon: Calendar
}, {
  title: t('sidebar.coreConfig'),
  url: '/core-config',
  icon: Cog
}, {
  title: t('sidebar.backup'),
  url: '/backup',
  icon: HardDrive
}, {
  title: t('sidebar.frameworkConfig'),
  url: '/framework-config',
  icon: Cpu
}, {
  title: t('sidebar.aiConfig'),
  url: '/ai-config',
  icon: Brain
}, {
  title: t('sidebar.plugins'),
  url: '/plugins',
  icon: Settings
}, {
  title: t('sidebar.pluginStore'),
  url: '/plugin-store',
  icon: Store
}, {
  title: t('sidebar.logs'),
  url: '/logs',
  icon: FileText
}, {
  title: t('sidebar.themes'),
  url: '/themes',
  icon: Palette
}];
export function AppSidebar() {
  const navigate = useNavigate();
  const {
    user,
    logout
  } = useAuth();
  const {
    state,
    toggleSidebar,
    isMobile
  } = useSidebar();
  const {
    style,
    iconColor
  } = useTheme();
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const navItems = getNavItems(t);
  const isCollapsed = state === 'collapsed';
  const isGlassmorphism = style === 'glassmorphism';

  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [restartProgress, setRestartProgress] = useState(0);
  const [restartCompleted, setRestartCompleted] = useState(false);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Pause/Resume state
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseProgress, setPauseProgress] = useState(0);
  const [pauseCompleted, setPauseCompleted] = useState(false);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (restartTimerRef.current) {
        clearInterval(restartTimerRef.current);
      }
    };
  }, []);

  const handleRestart = async () => {
    setIsRestarting(true);
    setRestartProgress(0);
    setRestartCompleted(false);

    // Start fake progress bar (70s to 99%)
    const startTime = Date.now();
    const duration = 70000; // 70 seconds (1 minute 10 seconds)
    const targetProgress = 99;
    let backendResponded = false;

    restartTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * targetProgress, targetProgress);
      setRestartProgress(progress);

      // Try to ping backend to check if it's back (no auth needed, just check if server is up)
      if (!backendResponded && progress > 10) {
        try {
          const apiHost = getCustomApiHost();
          // Use health check endpoint which doesn't require auth
          const url = apiHost ? `${apiHost}/api/system/health` : '/api/system/health';

          const response = await fetch(url, { method: 'GET' }).catch(() => null);

          if (response && response.ok) {
            backendResponded = true;
            setRestartProgress(100);
            setRestartCompleted(true);
            if (restartTimerRef.current) {
              clearInterval(restartTimerRef.current);
            }
          }
        } catch {
          // Backend not responding yet
        }
      }

      if (progress >= targetProgress && !backendResponded) {
        if (restartTimerRef.current) {
          clearInterval(restartTimerRef.current);
        }
      }
    }, 500);

    try {
      // Send restart request
      await systemApi.restartCore();
    } catch (error) {
      console.log('Restart command sent, backend may be restarting...');
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      // Reset state when dialog closes
      setShowRestartDialog(false);
      setIsRestarting(false);
      setRestartProgress(0);
      setRestartCompleted(false);
      if (restartTimerRef.current) {
        clearInterval(restartTimerRef.current);
      }
    } else {
      setShowRestartDialog(true);
    }
  };

  // Pause/Resume handlers
  const handlePause = async () => {
    setIsPausing(true);
    setPauseProgress(0);
    setPauseCompleted(false);

    const startTime = Date.now();
    const duration = 10000; // 10 seconds for pause operation
    const targetProgress = 99;
    let backendStopped = false;

    pauseTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * targetProgress, targetProgress);
      setPauseProgress(progress);

      // Check if backend has stopped responding
      if (!backendStopped && progress > 30) {
        try {
          const apiHost = getCustomApiHost();
          const url = apiHost ? `${apiHost}/api/system/health` : '/api/system/health';

          const response = await fetch(url, { method: 'GET' }).catch(() => null);

          if (!response || !response.ok) {
            // Backend has stopped
            backendStopped = true;
            setIsPaused(true);
            setPauseProgress(100);
            setPauseCompleted(true);
            if (pauseTimerRef.current) {
              clearInterval(pauseTimerRef.current);
            }
          }
        } catch {
          // Backend not responding
        }
      }

      if (progress >= targetProgress && !backendStopped) {
        if (pauseTimerRef.current) {
          clearInterval(pauseTimerRef.current);
        }
      }
    }, 500);

    try {
      await systemApi.stopCore();
    } catch (error) {
      console.log('Stop command sent, backend may be stopping...');
    }
  };

  const handleResume = async () => {
    setIsPausing(true);
    setPauseProgress(0);
    setPauseCompleted(false);

    const startTime = Date.now();
    const duration = 10000; // 10 seconds for resume operation
    const targetProgress = 99;
    let backendResponded = false;

    pauseTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * targetProgress, targetProgress);
      setPauseProgress(progress);

      // Check if backend is back online
      if (!backendResponded && progress > 30) {
        try {
          const apiHost = getCustomApiHost();
          const url = apiHost ? `${apiHost}/api/system/health` : '/api/system/health';

          const response = await fetch(url, { method: 'GET' }).catch(() => null);

          if (response && response.ok) {
            backendResponded = true;
            setIsPaused(false);
            setPauseProgress(100);
            setPauseCompleted(true);
            if (pauseTimerRef.current) {
              clearInterval(pauseTimerRef.current);
            }
          }
        } catch {
          // Backend not responding yet
        }
      }

      if (progress >= targetProgress && !backendResponded) {
        if (pauseTimerRef.current) {
          clearInterval(pauseTimerRef.current);
        }
      }
    }, 500);

    try {
      await systemApi.resumeCore();
    } catch (error) {
      console.log('Resume command sent, backend may be resuming...');
    }
  };

  const handlePauseDialogClose = (open: boolean) => {
    if (!open) {
      setShowPauseDialog(false);
      setIsPausing(false);
      setPauseProgress(0);
      setPauseCompleted(false);
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current);
      }
    } else {
      setShowPauseDialog(true);
    }
  };

  // Cleanup pause timer on unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current);
      }
    };
  }, []);

  // Get icon class based on iconColor setting
  const getIconClass = (customClass = "") => {
    const baseClass = customClass || "w-5 h-5";
    if (iconColor === 'white') {
      return cn(baseClass, "text-white drop-shadow");
    } else if (iconColor === 'black') {
      return cn(baseClass, "text-black");
    }
    // colored - use default (text-primary)
    return cn(baseClass, "text-primary");
  };

  return <Sidebar variant="sidebar" collapsible="icon" className={cn("border-0", isGlassmorphism ? "floating-sidebar" : "bg-sidebar shadow-lg")}>
    <SidebarHeader className={cn("p-4", isCollapsed && "flex flex-col items-center")}>
      <div className={cn("flex items-center w-full", isCollapsed ? "justify-center" : "justify-between")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 shadow-inner overflow-hidden">
            <img src="/app/ICON.png" alt="GsCore" className="w-8 h-8 object-contain" />
          </div>
          {!isCollapsed && <div className="flex flex-col">
            <span className="font-bold text-lg">{t('sidebar.gsCore')}</span>
            <span className="text-xs text-muted-foreground">​{t('sidebar.早柚核心')}</span>
          </div>}
        </div>
        {!isCollapsed && <button onClick={toggleSidebar} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground" aria-label={t('sidebar.collapseSidebar')}>
          <PanelLeftClose className="w-4 h-4" />
        </button>}
      </div>
      {isCollapsed && <button onClick={toggleSidebar} className="mt-2 h-8 w-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-foreground" aria-label={t('sidebar.expandSidebar')}>
        <PanelLeft className="w-4 h-4" />
      </button>}
    </SidebarHeader>

    <Separator className="opacity-30 mx-2" />

    <SidebarContent className={cn(isCollapsed ? "px-1" : "p-2")}>
      <SidebarGroup className={cn(isCollapsed && "p-0")}>
        {!isCollapsed && <SidebarGroupLabel className="text-muted-foreground/70">
          {t('sidebar.navMenu')}
        </SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu className={cn(isCollapsed && "items-center")}>
            {navItems.map(item => <SidebarMenuItem key={item.title} className={cn(isCollapsed ? "w-auto" : "w-full")}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <NavLink to={item.url} className={cn("flex items-center rounded-lg transition-all", isCollapsed ? "justify-center w-10 h-10 p-0" : "gap-3 px-3 py-2.5", "hover:bg-primary/10")} activeClassName="bg-primary/20 text-primary font-medium shadow-sm">
                  <item.icon className={getIconClass("w-5 h-5 shrink-0")} />
                  {!isCollapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>)}
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
        {!isCollapsed && <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-medium truncate">{user?.name}</span>
          <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
        </div>}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size={isCollapsed ? 'icon' : 'default'} className={cn("text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors", isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2")}>
            <Globe className="w-4 h-4" />
            {!isCollapsed && <span>{language === 'zh-CN' ? '中文' : 'English'}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {availableLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={cn(
                "cursor-pointer",
                language === lang.code && "bg-accent"
              )}
            >
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size={isCollapsed ? 'icon' : 'default'} onClick={() => setShowPauseDialog(true)} title={isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')} className={cn("text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10 transition-colors", isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2")}>
        {isPaused ? <RotateCw className="w-4 h-4" /> : <Power className="w-4 h-4" />}
        {!isCollapsed && <span>{isPaused ? t('sidebar.resumeGsCore') : t('sidebar.pauseGsCore')}</span>}
      </Button>

      <Button variant="ghost" size={isCollapsed ? 'icon' : 'default'} onClick={() => setShowRestartDialog(true)} title={t('sidebar.restartGsCore')} className={cn("text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-colors", isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2")}>
        <Power className="w-4 h-4" />
        {!isCollapsed && <span>{t('sidebar.restartGsCore')}</span>}
      </Button>

      <Button variant="ghost" size={isCollapsed ? 'icon' : 'default'} onClick={logout} className={cn("text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors", isCollapsed ? "w-auto justify-center" : "w-full justify-start gap-2")}>
        <LogOut className="w-4 h-4" />
        {!isCollapsed && <span>{t('sidebar.logout')}</span>}
      </Button>
    </SidebarFooter>

    <Dialog open={showRestartDialog} onOpenChange={handleDialogClose}>
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
            <Button variant="default" onClick={() => handleDialogClose(false)}>
              {t('common.confirm')}
            </Button>
          ) : isRestarting ? null : (
            <>
              <Button variant="outline" onClick={() => handleDialogClose(false)}>
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

    <Dialog open={showPauseDialog} onOpenChange={handlePauseDialogClose}>
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
            <Button variant="default" onClick={() => handlePauseDialogClose(false)}>
              {t('common.confirm')}
            </Button>
          ) : isPausing ? null : (
            <>
              <Button variant="outline" onClick={() => handlePauseDialogClose(false)}>
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
  </Sidebar>;
}