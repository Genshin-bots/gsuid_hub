import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import GitMirrorDialog, { getMirrorBadge } from '@/components/GitMirrorDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  GitBranch,
  RefreshCw,
  RotateCcw,
  Download,
  GitCommit,
  User,
  Calendar,
  ArrowDownToLine,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Package,
  MessageSquare,
  Link,
  Globe,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  gitUpdateApi,
  gitMirrorApi,
  GitPluginStatus,
  GitCommitInfo,
  GitCommitListResponse,
  GitPluginInfo,
  getPluginIconUrl,
} from '@/lib/api';

const PAGE_SIZE = 20;

// 带 fallback 的插件图标组件
function PluginIcon({ pluginName, className = 'w-[18px] h-[18px]' }: { pluginName: string; className?: string }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return <Package className={`${className} text-muted-foreground/50`} />;
  }
  return (
    <img
      src={getPluginIconUrl(pluginName)}
      className={`${className} rounded-sm object-contain`}
      alt=""
      onError={() => setImgError(true)}
    />
  );
}

// 缓存相关常量
const GIT_STATUS_CACHE_KEY = 'gitUpdate_status_cache';
const GIT_COMMITS_CACHE_PREFIX = 'gitUpdate_commits_';
const GIT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCachedData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > GIT_CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage 满或其他错误，静默忽略
  }
}

function clearCommitsCache(pluginName?: string) {
  if (pluginName) {
    localStorage.removeItem(GIT_COMMITS_CACHE_PREFIX + pluginName);
  } else {
    // 清除所有 commits 缓存
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(GIT_COMMITS_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}

// Memoized commit card for mobile
const CommitCard = memo(function CommitCard({
  commit,
  isCurrent,
  isFuture,
  isCheckingOut,
  onCheckout,
  t,
}: {
  commit: GitCommitInfo;
  isCurrent: boolean;
  isFuture: boolean;
  isCheckingOut: boolean;
  onCheckout: (commit: GitCommitInfo) => void;
  t: (key: string) => string;
}) {
  return (
    <Card className={`glass-card ${isCurrent ? 'border-primary/50 bg-primary/5' : ''}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Badge
              variant={isCurrent ? 'default' : 'outline'}
              className="font-mono text-xs whitespace-nowrap shrink-0"
            >
              {commit.short_hash}
            </Badge>
            {isCurrent && (
              <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                {t('gitUpdate.currentVersion')}
              </Badge>
            )}
          </div>
          {!isCurrent && (
            <Button
              variant={isFuture ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCheckout(commit)}
              disabled={isCheckingOut}
              className="gap-1 text-xs h-7 whitespace-nowrap shrink-0"
            >
              {isFuture ? <ArrowDownToLine className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
              {isFuture ? t('gitUpdate.updateToVersion') : t('gitUpdate.checkoutToVersion')}
            </Button>
          )}
        </div>
        <p className="text-sm font-medium break-all">{commit.message}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {commit.author}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {commit.date}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

// Memoized commit row for desktop
const CommitRow = memo(function CommitRow({
  commit,
  isCurrent,
  isFuture,
  isCheckingOut,
  onCheckout,
  t,
}: {
  commit: GitCommitInfo;
  isCurrent: boolean;
  isFuture: boolean;
  isCheckingOut: boolean;
  onCheckout: (commit: GitCommitInfo) => void;
  t: (key: string) => string;
}) {
  return (
    <tr className={`border-b border-border/50 ${isCurrent ? 'bg-primary/5' : ''}`}>
      <td className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={isCurrent ? 'default' : 'outline'}
            className="font-mono text-xs whitespace-nowrap"
          >
            {commit.short_hash}
          </Badge>
          {isCurrent && (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {t('gitUpdate.currentVersion')}
            </Badge>
          )}
        </div>
      </td>
      <td className="p-3 max-w-[400px] truncate">{commit.message}</td>
      <td className="p-3 text-muted-foreground whitespace-nowrap">{commit.author}</td>
      <td className="p-3 text-muted-foreground text-sm whitespace-nowrap">{commit.date}</td>
      <td className="p-3 text-right">
        {!isCurrent && (
          <Button
            variant={isFuture ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCheckout(commit)}
            disabled={isCheckingOut}
            className="gap-1 whitespace-nowrap"
          >
            {isFuture ? <ArrowDownToLine className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
            {isFuture ? t('gitUpdate.updateToVersion') : t('gitUpdate.checkoutToVersion')}
          </Button>
        )}
      </td>
    </tr>
  );
});

export default function GitUpdatePage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const isMobile = useIsMobile();

  // State
  const [plugins, setPlugins] = useState<GitPluginStatus[]>([]);
  const [gitPluginsMap, setGitPluginsMap] = useState<Record<string, GitPluginInfo>>({});
  const [selectedPlugin, setSelectedPlugin] = useState<string>('');
  const [commitsData, setCommitsData] = useState<GitCommitListResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingCommits, setIsLoadingCommits] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isForceUpdating, setIsForceUpdating] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Use ref to track selected plugin without causing re-renders in callbacks
  const selectedPluginRef = useRef(selectedPlugin);
  selectedPluginRef.current = selectedPlugin;

  // Dialog state
  const [checkoutDialog, setCheckoutDialog] = useState<{
    open: boolean;
    commit: GitCommitInfo | null;
  }>({ open: false, commit: null });
  const [forceUpdateDialog, setForceUpdateDialog] = useState(false);
  const [gitMirrorOpen, setGitMirrorOpen] = useState(false);

  // Fetch all plugin statuses + icons (runs once on mount, with cache)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // 尝试从缓存加载
      const cached = getCachedData<GitPluginStatus[]>(GIT_STATUS_CACHE_KEY);
      if (cached) {
        if (cancelled) return;
        const gitPlugins = cached.filter(p => p.is_git_repo);
        setPlugins(gitPlugins);
        if (gitPlugins.length > 0) {
          const core = gitPlugins.find(p => p.name.toLowerCase() === 'gsuid_core');
          setSelectedPlugin(core ? core.name : gitPlugins[0].name);
        }
        setIsLoadingStatus(false);
        return;
      }

      try {
        setIsLoadingStatus(true);
        const statusData = await gitUpdateApi.getStatus();

        if (cancelled) return;

        const gitPlugins = statusData.filter(p => p.is_git_repo);
        setPlugins(gitPlugins);
        // 写入缓存
        setCachedData(GIT_STATUS_CACHE_KEY, statusData);

        // Set default selection
        if (gitPlugins.length > 0) {
          const core = gitPlugins.find(p => p.name.toLowerCase() === 'gsuid_core');
          setSelectedPlugin(core ? core.name : gitPlugins[0].name);
        }
      } catch (error) {
        console.error('Failed to fetch git status:', error);
        if (!cancelled) {
          toast({
            title: t('common.error'),
            description: t('gitUpdate.loadStatusFailed'),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setIsLoadingStatus(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []); // Only run once on mount

  // Fetch git mirror info for remote_url and mirror badge
  useEffect(() => {
    let cancelled = false;
    async function loadMirrorInfo() {
      try {
        const data = await gitMirrorApi.getInfo();
        if (cancelled) return;
        const map: Record<string, GitPluginInfo> = {};
        data.plugins.forEach(p => {
          map[p.name.toLowerCase()] = p;
        });
        setGitPluginsMap(map);
      } catch (error) {
        console.error('Failed to fetch git mirror info:', error);
      }
    }
    loadMirrorInfo();
    return () => { cancelled = true; };
  }, []);

  // Fetch commits when plugin changes (with cache)
  useEffect(() => {
    if (!selectedPlugin) return;
    let cancelled = false;

    async function loadCommits() {
      // 尝试从缓存加载
      const cacheKey = GIT_COMMITS_CACHE_PREFIX + selectedPlugin;
      const cached = getCachedData<GitCommitListResponse>(cacheKey);
      if (cached) {
        if (cancelled) return;
        setCommitsData(cached);
        setDisplayCount(PAGE_SIZE);
        setIsLoadingCommits(false);
        return;
      }

      try {
        setIsLoadingCommits(true);
        setDisplayCount(PAGE_SIZE);
        const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
        if (!cancelled) {
          setCommitsData(data);
          // 写入缓存
          setCachedData(cacheKey, data);
        }
      } catch (error) {
        console.error('Failed to fetch commits:', error);
        if (!cancelled) {
          toast({
            title: t('common.error'),
            description: t('gitUpdate.loadCommitsFailed'),
            variant: 'destructive',
          });
          setCommitsData(null);
        }
      } finally {
        if (!cancelled) setIsLoadingCommits(false);
      }
    }

    loadCommits();
    return () => { cancelled = true; };
  }, [selectedPlugin]); // Only depends on selectedPlugin

  // Handle refresh (force refresh, bypass cache)
  const handleRefresh = useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const statusData = await gitUpdateApi.getStatus();
      const gitPlugins = statusData.filter(p => p.is_git_repo);
      setPlugins(gitPlugins);
      // 更新缓存
      setCachedData(GIT_STATUS_CACHE_KEY, statusData);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsLoadingStatus(false);
    }
    // Also refresh commits for current plugin
    if (selectedPluginRef.current) {
      try {
        setIsLoadingCommits(true);
        setDisplayCount(PAGE_SIZE);
        const data = await gitUpdateApi.getRemoteCommits(selectedPluginRef.current);
        setCommitsData(data);
        // 更新缓存
        setCachedData(GIT_COMMITS_CACHE_PREFIX + selectedPluginRef.current, data);
      } catch (error) {
        console.error('Failed to refresh commits:', error);
      } finally {
        setIsLoadingCommits(false);
      }
    }
  }, [t, toast]);

  // Handle checkout
  const handleCheckout = async () => {
    if (!checkoutDialog.commit || !selectedPlugin) return;
    try {
      setIsCheckingOut(true);
      await gitUpdateApi.checkout(selectedPlugin, checkoutDialog.commit.short_hash);
      toast({
        title: t('common.success'),
        description: t('gitUpdate.checkoutSuccess', { hash: checkoutDialog.commit.short_hash }),
      });
      // 清除缓存并刷新 commits
      clearCommitsCache(selectedPlugin);
      localStorage.removeItem(GIT_STATUS_CACHE_KEY);
      const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
      setCommitsData(data);
      setCachedData(GIT_COMMITS_CACHE_PREFIX + selectedPlugin, data);
    } catch (error) {
      console.error('Checkout failed:', error);
      toast({
        title: t('common.error'),
        description: t('gitUpdate.checkoutFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
      setCheckoutDialog({ open: false, commit: null });
    }
  };

  // Handle force update
  const handleForceUpdate = async () => {
    if (!selectedPlugin) return;
    try {
      setIsForceUpdating(true);
      const result = await gitUpdateApi.forceUpdate(selectedPlugin);
      toast({
        title: t('common.success'),
        description: t('gitUpdate.forceUpdateSuccess', {
          hash: result.current_commit?.short_hash || '',
        }),
      });
      // 清除缓存并刷新
      clearCommitsCache(selectedPlugin);
      localStorage.removeItem(GIT_STATUS_CACHE_KEY);
      const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
      setCommitsData(data);
      setCachedData(GIT_COMMITS_CACHE_PREFIX + selectedPlugin, data);
    } catch (error) {
      console.error('Force update failed:', error);
      toast({
        title: t('common.error'),
        description: t('gitUpdate.forceUpdateFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsForceUpdating(false);
      setForceUpdateDialog(false);
    }
  };

  // Get current plugin status
  const currentPlugin = plugins.find(p => p.name === selectedPlugin);
  const currentMirrorInfo = gitPluginsMap[selectedPlugin?.toLowerCase()] || null;

  // Format plugin display name
  const getPluginDisplayName = (name: string) => {
    return name.toLowerCase() === 'gsuid_core' ? t('gitUpdate.core') : name;
  };

  // Paginated commits
  const allCommits = commitsData?.commits || [];
  const displayedCommits = allCommits.slice(0, displayCount);
  const hasMore = displayCount < allCommits.length;

  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + PAGE_SIZE, allCommits.length));
  }, [allCommits.length]);

  const handleCheckoutClick = useCallback((commit: GitCommitInfo) => {
    setCheckoutDialog({ open: true, commit });
  }, []);

  // Handle update all plugins
  const handleUpdateAll = async () => {
    try {
      setIsForceUpdating(true);
      await gitUpdateApi.updateAll();
      toast({
        title: t('common.success'),
        description: t('gitUpdate.updateAllSuccess'),
      });
      // 清除所有缓存并刷新
      clearCommitsCache();
      await handleRefresh();
    } catch (error) {
      console.error('Failed to update all plugins:', error);
      toast({
        title: t('common.error'),
        description: t('gitUpdate.updateAllFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsForceUpdating(false);
      setForceUpdateDialog(false);
    }
  };

  return (
    <div className="space-y-4 flex-1 overflow-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <GitBranch className="w-7 h-7 sm:w-8 sm:h-8" />
            {t('gitUpdate.title')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {t('gitUpdate.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setGitMirrorOpen(true)}
            className="gap-2 self-start sm:self-auto"
          >
            <GitBranch className="w-4 h-4" />
            {t('gitMirror.title')}
          </Button>
          <Button
            variant="default"
            onClick={handleUpdateAll}
            disabled={isLoadingStatus || isForceUpdating}
            className="gap-2 self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            {t('gitUpdate.updateAll')}
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoadingStatus || isLoadingCommits}
            className="gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${(isLoadingStatus || isLoadingCommits) ? 'animate-spin' : ''}`} />
            {t('gitUpdate.refresh')}
          </Button>
        </div>
      </div>

      {/* Plugin Selector - TabButtonGroup style */}
      {isLoadingStatus ? (
        <div className="flex flex-nowrap gap-1 p-1 bg-muted/50 rounded-lg border border-border/40 overflow-x-auto">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-9 w-24 rounded-md shrink-0" />
          ))}
        </div>
      ) : (
        <TabButtonGroup
          options={plugins.map(plugin => ({
            value: plugin.name,
            label: getPluginDisplayName(plugin.name),
            icon: <PluginIcon pluginName={plugin.name} />,
          }))}
          value={selectedPlugin}
          onValueChange={setSelectedPlugin}
          glassClassName={isGlass ? 'glass-card' : 'border border-border/50'}
        />
      )}

      {/* Current Status */}
      {currentPlugin && currentPlugin.current_commit && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              {t('gitUpdate.currentStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">{t('gitUpdate.branch')}:</span>
                <Badge variant="secondary" className="whitespace-nowrap">{currentPlugin.branch}</Badge>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <GitCommit className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">{t('gitUpdate.commit')}:</span>
                <Badge variant="outline" className="font-mono whitespace-nowrap">
                  {currentPlugin.current_commit.short_hash}
                </Badge>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">{t('gitUpdate.author')}:</span>
                <span className="text-sm truncate">{currentPlugin.current_commit.author}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">{t('gitUpdate.date')}:</span>
                <span className="text-sm whitespace-nowrap">{currentPlugin.current_commit.date}</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex items-start gap-2 min-w-0 col-span-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-sm">{currentPlugin.current_commit.message}</span>
              </div>
              {currentMirrorInfo?.remote_url && (
                <div className="flex items-center gap-2 min-w-0">
                  <Link className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Badge
                    variant="outline"
                    className="text-xs font-mono whitespace-nowrap"
                    title={currentMirrorInfo.remote_url}
                  >
                    {currentMirrorInfo.remote_url.replace(/^https?:\/\//, '').split('/').slice(-2).join('/')}
                  </Badge>
                </div>
              )}
              {currentMirrorInfo?.remote_url && (
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                  {(() => {
                    const badge = getMirrorBadge(currentMirrorInfo.mirror || 'unknown', currentMirrorInfo.remote_url, t);
                    return (
                      <Badge variant="outline" className={`text-xs whitespace-nowrap ${badge.className}`}>
                        {badge.icon}
                        <span className="ml-1">{badge.label}</span>
                      </Badge>
                    );
                  })()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commit List */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            {t('gitUpdate.remoteCommits')}
          </CardTitle>
          <CardDescription>
            {t('gitUpdate.detachedHeadWarning')}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6 sm:pb-6">
          {isLoadingCommits ? (
            <div className="space-y-3 p-4 sm:p-0">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : !commitsData || allCommits.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground p-4">
              <GitCommit className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('gitUpdate.noCommits')}</p>
            </div>
          ) : isMobile ? (
            /* Mobile: Card layout */
            <div className="space-y-3 p-4">
              {(() => {
                const currentIdx = allCommits.findIndex(c => c.hash === commitsData.current_hash);
                return displayedCommits.map((commit, index) => (
                  <CommitCard
                    key={commit.hash}
                    commit={commit}
                    isCurrent={commit.hash === commitsData.current_hash}
                    isFuture={currentIdx === -1 || index < currentIdx}
                    isCheckingOut={isCheckingOut}
                    onCheckout={handleCheckoutClick}
                    t={t}
                  />
                ));
              })()}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    className="gap-2"
                  >
                    <ChevronDown className="w-4 h-4" />
                    {t('gitUpdate.loadMore')} ({displayCount}/{allCommits.length})
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Desktop: Table layout */
            <div>
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b border-border/50">
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground w-28 whitespace-nowrap">{t('gitUpdate.commit')}</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('gitUpdate.message')}</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground w-28 whitespace-nowrap">{t('gitUpdate.author')}</th>
                    <th className="h-10 px-3 text-left font-medium text-muted-foreground w-44 whitespace-nowrap">{t('gitUpdate.date')}</th>
                    <th className="h-10 px-3 text-right font-medium text-muted-foreground w-32 whitespace-nowrap">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const currentIdx = allCommits.findIndex(c => c.hash === commitsData.current_hash);
                    return displayedCommits.map((commit, index) => (
                      <CommitRow
                        key={commit.hash}
                        commit={commit}
                        isCurrent={commit.hash === commitsData.current_hash}
                        isFuture={currentIdx === -1 || index < currentIdx}
                        isCheckingOut={isCheckingOut}
                        onCheckout={handleCheckoutClick}
                        t={t}
                      />
                    ));
                  })()}
                  {hasMore && (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
                        <Button
                          variant="outline"
                          onClick={handleLoadMore}
                          className="gap-2"
                        >
                          <ChevronDown className="w-4 h-4" />
                          {t('gitUpdate.loadMore')} ({displayCount}/{allCommits.length})
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Force Update Button */}
      <div className="flex justify-center sm:justify-end">
        <Button
          variant="destructive"
          onClick={() => setForceUpdateDialog(true)}
          disabled={isForceUpdating || !selectedPlugin || isLoadingStatus}
          className="gap-2 w-full sm:w-auto"
        >
          <Download className={`w-4 h-4 ${isForceUpdating ? 'animate-spin' : ''}`} />
          {t('gitUpdate.forceUpdate')}
        </Button>
      </div>

      {/* Checkout Confirmation Dialog */}
      <AlertDialog
        open={checkoutDialog.open}
        onOpenChange={(open) => {
          if (!open) setCheckoutDialog({ open: false, commit: null });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              {t('gitUpdate.checkoutConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('gitUpdate.checkoutConfirmDesc', {
                plugin: getPluginDisplayName(selectedPlugin),
                hash: checkoutDialog.commit?.short_hash || '',
                message: checkoutDialog.commit?.message || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCheckingOut}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isCheckingOut ? t('gitUpdate.loading') : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Force Update Confirmation Dialog */}
      <AlertDialog open={forceUpdateDialog} onOpenChange={setForceUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t('gitUpdate.forceUpdateConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('gitUpdate.forceUpdateConfirmDesc', {
                plugin: getPluginDisplayName(selectedPlugin),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isForceUpdating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceUpdate}
              disabled={isForceUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isForceUpdating ? t('gitUpdate.loading') : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GitMirrorDialog
        open={gitMirrorOpen}
        onOpenChange={setGitMirrorOpen}
      />
    </div>
  );
}
