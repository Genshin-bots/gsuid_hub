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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  MessageSquare,
  Link,
  Globe,
  Loader2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  gitUpdateApi,
  gitMirrorApi,
  pluginsApi,
  GitPluginStatus,
  GitCommitInfo,
  GitCommitListResponse,
  GitPluginInfo,
} from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { PluginIcon } from '@/components/ui/plugin-icon';

const PAGE_SIZE = 20;

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

const KNOWN_GITHUB_MIRROR_OWNERS = new Set(['gscore-mirror', 'gsuid-mirror']);

function cleanRepoName(repo: string) {
  return repo.replace(/\.git$/i, '').replace(/\/$/, '');
}

function getGithubRepoPath(remoteUrl?: string, pluginName?: string): string | null {
  const fallbackRepo = pluginName ? `Genshin-bots/${cleanRepoName(pluginName)}` : null;
  if (!remoteUrl) return fallbackRepo;

  const normalizedUrl = remoteUrl
    .trim()
    .replace(/^https?:\/\/ghproxy\.com\//i, '')
    .replace(/^https?:\/\/gh-proxy\.com\//i, '');

  const githubSshMatch = normalizedUrl.match(/ssh:\/\/git@(?:ssh\.)?github\.com(?::\d+)?\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:[/?#]|$)/i);
  if (githubSshMatch) {
    return `${githubSshMatch[1]}/${cleanRepoName(githubSshMatch[2])}`;
  }

  const githubMatch = normalizedUrl.match(/github\.com[:/]([^/\s:]+)\/([^/\s]+?)(?:\.git)?(?:[/?#]|$)/i);
  if (githubMatch) {
    return `${githubMatch[1]}/${cleanRepoName(githubMatch[2])}`;
  }

  const mirrorMatch = normalizedUrl.match(/(?:gitcode\.com|cnb\.cool)\/([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:[/?#]|$)/i);
  if (mirrorMatch) {
    const owner = mirrorMatch[1];
    const repo = cleanRepoName(mirrorMatch[2]);
    return KNOWN_GITHUB_MIRROR_OWNERS.has(owner.toLowerCase()) ? `Genshin-bots/${repo}` : `${owner}/${repo}`;
  }

  return fallbackRepo;
}

function CommitMessageWithIssueLinks({
  message,
  githubRepoPath,
  className,
}: {
  message: string;
  githubRepoPath?: string | null;
  className?: string;
}) {
  if (!githubRepoPath) {
    return <span className={className}>{message}</span>;
  }

  const parts = message.split(/(#\d+)/g);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const issueMatch = part.match(/^#(\d+)$/);
        if (!issueMatch) return <span key={`${part}-${index}`}>{part}</span>;
        return (
          <a
            key={`${part}-${index}`}
            href={`https://github.com/${githubRepoPath}/issues/${issueMatch[1]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-4 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {part}
          </a>
        );
      })}
    </span>
  );
}

// Memoized commit card for mobile
const CommitCard = memo(function CommitCard({
  commit,
  isCurrent,
  isFuture,
  isCheckingOut,
  onCheckout,
  t,
  isLocalCurrent,
  isRemoteLatest,
  githubRepoPath,
}: {
  commit: GitCommitInfo;
  isCurrent: boolean;
  isFuture: boolean;
  isCheckingOut: boolean;
  onCheckout: (commit: GitCommitInfo) => void;
  t: (key: string) => string;
  isLocalCurrent?: boolean;
  isRemoteLatest?: boolean;
  githubRepoPath?: string | null;
}) {
  return (
    <Card className={`glass-card ${isLocalCurrent ? 'border-primary/50 bg-primary/5' : ''}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Badge
              variant="outline"
              className="font-mono text-xs whitespace-nowrap shrink-0"
            >
              {commit.short_hash}
            </Badge>
            {isLocalCurrent && (
              <Badge variant="default" className="text-xs whitespace-nowrap shrink-0">
                {t('gitUpdate.currentVersion')}
              </Badge>
            )}
            {isRemoteLatest && !isLocalCurrent && (
              <Badge variant="default" className="text-xs whitespace-nowrap shrink-0">
                {t('gitUpdate.localVersion')}
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
        <p className="text-sm font-medium break-words leading-relaxed">
          <CommitMessageWithIssueLinks message={commit.message} githubRepoPath={githubRepoPath} />
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[120px]">{commit.author}</span>
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 shrink-0" />
            <span className="whitespace-nowrap">{commit.date}</span>
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
  isLocalCurrent,
  isRemoteLatest,
  githubRepoPath,
}: {
  commit: GitCommitInfo;
  isCurrent: boolean;
  isFuture: boolean;
  isCheckingOut: boolean;
  onCheckout: (commit: GitCommitInfo) => void;
  t: (key: string) => string;
  isLocalCurrent?: boolean;
  isRemoteLatest?: boolean;
  githubRepoPath?: string | null;
}) {
  return (
    <tr className={`border-b border-border/50 ${isLocalCurrent ? 'bg-primary/5' : ''}`}>
      <td className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="font-mono text-xs whitespace-nowrap"
          >
            {commit.short_hash}
          </Badge>
          {isLocalCurrent && (
            <Badge variant="default" className="text-xs whitespace-nowrap">
              {t('gitUpdate.currentVersion')}
            </Badge>
          )}
          {isRemoteLatest && !isLocalCurrent && (
            <Badge variant="default" className="text-xs whitespace-nowrap">
              {t('gitUpdate.localVersion')}
            </Badge>
          )}
        </div>
      </td>
      <td className="p-3 max-w-[400px] truncate">
        <CommitMessageWithIssueLinks message={commit.message} githubRepoPath={githubRepoPath} />
      </td>
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
  // 插件列表（来自 /api/plugins/list，包含实际运行版本）
  const [pluginList, setPluginList] = useState<{ id: string; commit?: string }[]>([]);

  // 重载当前插件状态
  const [isReloadingPlugin, setIsReloadingPlugin] = useState(false);
  const [reloadDialogOpen, setReloadDialogOpen] = useState(false);

  // 更新全部插件相关状态
  const [updateAllDialogOpen, setUpdateAllDialogOpen] = useState(false);
  const [updateAllPanelOpen, setUpdateAllPanelOpen] = useState(false);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  type PluginUpdateStatus = 'pending' | 'updating' | 'success' | 'failed';
  interface PluginUpdateItem {
    name: string;
    status: PluginUpdateStatus;
    message?: string;
  }
  const [pluginUpdateList, setPluginUpdateList] = useState<PluginUpdateItem[]>([]);

  // Use ref to track selected plugin without causing re-renders in callbacks
  const selectedPluginRef = useRef(selectedPlugin);
  selectedPluginRef.current = selectedPlugin;

  // Dialog state
  const [checkoutDialog, setCheckoutDialog] = useState<{
    open: boolean;
    commit: GitCommitInfo | null;
  }>({ open: false, commit: null });
  const [forceUpdateDialog, setForceUpdateDialog] = useState(false);
  const [updateDialog, setUpdateDialog] = useState(false);
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
          toast.error(t('gitUpdate.loadStatusFailed'));
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

  // Fetch plugin list to get actual running commit (from /api/plugins/list)
  useEffect(() => {
    let cancelled = false;
    async function loadPluginList() {
      try {
        const data = await pluginsApi.getPluginList();
        if (cancelled) return;
        setPluginList(data);
      } catch (error) {
        console.error('Failed to fetch plugin list:', error);
      }
    }
    loadPluginList();
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
          toast.error(t('gitUpdate.loadCommitsFailed'));
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
      toast.success(t('gitUpdate.checkoutSuccess', { hash: checkoutDialog.commit.short_hash }));
      // 清除缓存并刷新 commits
      clearCommitsCache(selectedPlugin);
      localStorage.removeItem(GIT_STATUS_CACHE_KEY);
      const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
      setCommitsData(data);
      setCachedData(GIT_COMMITS_CACHE_PREFIX + selectedPlugin, data);
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error(t('gitUpdate.checkoutFailed'));
    } finally {
      setIsCheckingOut(false);
      setCheckoutDialog({ open: false, commit: null });
    }
  };

  // Handle normal update
  const handleUpdate = async () => {
    if (!selectedPlugin) return;
    setUpdateDialog(false);
    try {
      setIsForceUpdating(true);
      // api.post 已解包：返回 GitForceUpdateResponse，不是 {status,msg,data}
      const result = await gitUpdateApi.update(selectedPlugin);
      if (result?.success) {
        toast.success(
          t('gitUpdate.updateSuccess', {
            hash: result.current_commit?.short_hash || '',
          }),
        );
      } else {
        toast.error(result?.message || t('gitUpdate.updateFailed'));
      }
      // 清除缓存并刷新
      clearCommitsCache(selectedPlugin);
      localStorage.removeItem(GIT_STATUS_CACHE_KEY);
      const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
      setCommitsData(data);
      setCachedData(GIT_COMMITS_CACHE_PREFIX + selectedPlugin, data);
      // 刷新插件列表以获取最新的运行版本
      const pluginListData = await pluginsApi.getPluginList();
      setPluginList(pluginListData);
    } catch (error) {
      console.error('Update failed:', error);
      toast.error(t('gitUpdate.updateFailed'));
    } finally {
      setIsForceUpdating(false);
    }
  };

  // Handle force update
  const handleForceUpdate = async () => {
    if (!selectedPlugin) return;
    try {
      setIsForceUpdating(true);
      // api.post 已解包：返回 GitForceUpdateResponse，不是 {status,msg,data}
      const result = await gitUpdateApi.forceUpdate(selectedPlugin);
      if (result?.success) {
        toast.success(
          t('gitUpdate.forceUpdateSuccess', {
            hash: result.current_commit?.short_hash || '',
          }),
        );
      } else {
        toast.error(result?.message || t('gitUpdate.forceUpdateFailed'));
      }
      // 清除缓存并刷新
      clearCommitsCache(selectedPlugin);
      localStorage.removeItem(GIT_STATUS_CACHE_KEY);
      const data = await gitUpdateApi.getRemoteCommits(selectedPlugin);
      setCommitsData(data);
      setCachedData(GIT_COMMITS_CACHE_PREFIX + selectedPlugin, data);
      // 刷新插件列表以获取最新的运行版本
      const pluginListData = await pluginsApi.getPluginList();
      setPluginList(pluginListData);
    } catch (error) {
      console.error('Force update failed:', error);
      toast.error(t('gitUpdate.forceUpdateFailed'));
    } finally {
      setIsForceUpdating(false);
      setForceUpdateDialog(false);
    }
  };

  // Get current plugin status
  const currentPlugin = plugins.find(p => p.name === selectedPlugin);
  const currentMirrorInfo = gitPluginsMap[selectedPlugin?.toLowerCase()] || null;
  const githubRepoPath = getGithubRepoPath(currentMirrorInfo?.remote_url, selectedPlugin);

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

  const checkoutDialogIsFuture = (() => {
    if (!checkoutDialog.commit || !commitsData) return false;
    const currentIdx = allCommits.findIndex(c => c.hash === commitsData.current_hash);
    const targetIdx = allCommits.findIndex(c => c.hash === checkoutDialog.commit?.hash);
    return currentIdx === -1 || (targetIdx !== -1 && targetIdx < currentIdx);
  })();

  // Handle update all plugins - 打开确认对话框
  const handleUpdateAllClick = () => {
    setUpdateAllDialogOpen(true);
  };

  // 更新全部插件 - 开始执行
  const handleUpdateAllConfirm = async () => {
    setUpdateAllDialogOpen(false);
    // 延迟打开面板，等待 AlertDialog 关闭动画完成
    setTimeout(async () => {
      setUpdateAllPanelOpen(true);
      setIsUpdatingAll(true);
      
      // 初始化所有插件状态为 pending
      const initialList: PluginUpdateItem[] = plugins.filter(p => p.is_git_repo).map(p => ({ name: p.name, status: 'pending' }));
      setPluginUpdateList(initialList);

      // 并行更新所有插件
      const updatePromises = plugins.filter(p => p.is_git_repo).map(async (plugin) => {
        // 更新状态为 updating
        setPluginUpdateList(prev => prev.map(p =>
          p.name === plugin.name ? { ...p, status: 'updating' } : p
        ));
        
        try {
          // api.post 已解包：返回 GitForceUpdateResponse
          const result = await gitUpdateApi.update(plugin.name);
          if (result?.success) {
            setPluginUpdateList(prev => prev.map(p =>
              p.name === plugin.name
                ? { ...p, status: 'success', message: result.message }
                : p
            ));
          } else {
            setPluginUpdateList(prev => prev.map(p =>
              p.name === plugin.name
                ? { ...p, status: 'failed', message: result?.message || t('gitUpdate.updateFailed') }
                : p
            ));
          }
        } catch (error) {
          setPluginUpdateList(prev => prev.map(p =>
            p.name === plugin.name
              ? {
                  ...p,
                  status: 'failed',
                  message: error instanceof Error ? error.message : String(error),
                }
              : p
          ));
        }
      });

      await Promise.all(updatePromises);
      setIsUpdatingAll(false);
      // 清除缓存并刷新
      clearCommitsCache();
      handleRefresh();
    }, 0);
  };

  // 重载当前插件 - 打开确认对话框
  const handleReloadPlugin = () => {
    if (!selectedPlugin) return;
    setReloadDialogOpen(true);
  };

  // 重载当前插件 - 确认执行（reloadPlugin 走 postRaw，看顶层 status/msg）
  const handleReloadPluginConfirm = async () => {
    if (!selectedPlugin) return;
    setReloadDialogOpen(false);
    setIsReloadingPlugin(true);
    try {
      const result = await pluginsApi.reloadPlugin(selectedPlugin);
      if (result?.status === 0) {
        toast.success(result.msg || t('plugins.reloadPluginSuccess', { name: selectedPlugin }));
      } else {
        toast.error(
          result?.msg || t('plugins.reloadPluginFailed', { name: selectedPlugin, error: '' }),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsReloadingPlugin(false);
    }
  };

  return (
    <PinnedPage
      className="gap-4"
      bodyClassName="space-y-4"
      header={
        /* Header */
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
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
              onClick={handleUpdateAllClick}
              disabled={isLoadingStatus || isForceUpdating}
              className="gap-2 self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              {t('gitUpdate.updateAll')}
            </Button>
            {selectedPlugin && selectedPlugin.toLowerCase() !== 'gsuid_core' && !selectedPlugin.startsWith('_') && (
              <Button
                variant="outline"
                onClick={handleReloadPlugin}
                disabled={!selectedPlugin || isReloadingPlugin}
                className="gap-2 self-start sm:self-auto"
              >
                <RotateCcw className={`w-4 h-4 ${isReloadingPlugin ? 'animate-spin' : ''}`} />
                {t('plugins.reloadPlugin')}
              </Button>
            )}
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
      }
      toolbar={
        /* Plugin Selector - TabButtonGroup style */
        isLoadingStatus ? (
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
          />
        )
      }
    >
      {/* Current Status */}
      {currentPlugin && currentPlugin.current_commit && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              {t('gitUpdate.currentStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{t('gitUpdate.branch')}:</span>
                <span className="truncate">{currentPlugin.branch}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <GitCommit className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{t('gitUpdate.commit')}:</span>
                <span className="truncate font-mono text-sm">{currentPlugin.current_commit.short_hash}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{t('gitUpdate.author')}:</span>
                <span className="text-sm truncate">{currentPlugin.current_commit.author}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">{t('gitUpdate.date')}:</span>
                <span className="text-sm truncate">{currentPlugin.current_commit.date}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm break-words leading-relaxed truncate">{currentPlugin.current_commit.message}</span>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commit List */}
      <Card className="glass-card">
        <div className="px-4 sm:px-6 pt-10 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 mb-1">
                <ArrowDownToLine className="w-5 h-5 text-primary" />
                {t('gitUpdate.remoteCommits')}
              </CardTitle>
              <CardDescription>
                {t('gitUpdate.detachedHeadWarning')}
              </CardDescription>
            </div>
            <div className="flex flex-row gap-2 shrink-0 justify-end items-end">
              <Button
                variant="default"
                size="sm"
                onClick={() => setUpdateDialog(true)}
                disabled={isForceUpdating || !selectedPlugin || isLoadingStatus}
                className="gap-1 h-8"
              >
                <Download className={`w-3 h-3 ${isForceUpdating ? 'animate-spin' : ''}`} />
                {t('gitUpdate.update')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setForceUpdateDialog(true)}
                disabled={isForceUpdating || !selectedPlugin || isLoadingStatus}
                className="gap-1 h-8"
              >
                <Download className={`w-3 h-3 ${isForceUpdating ? 'animate-spin' : ''}`} />
                {t('gitUpdate.forceUpdate')}
              </Button>
            </div>
          </div>
        </div>
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
                const runningPlugin = pluginList.find(p => p.id.toLowerCase() === selectedPlugin.toLowerCase());
                const runningCommit = runningPlugin?.commit;
                return displayedCommits.map((commit, index) => (
                  <CommitCard
                    key={commit.hash}
                    commit={commit}
                    isCurrent={commit.hash === commitsData.current_hash}
                    isFuture={currentIdx === -1 || index < currentIdx}
                    isCheckingOut={isCheckingOut}
                    onCheckout={handleCheckoutClick}
                    t={t}
                    isLocalCurrent={runningCommit ? commit.short_hash === runningCommit : false}
                    isRemoteLatest={commit.hash === commitsData.current_hash}
                    githubRepoPath={githubRepoPath}
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
            <div className="overflow-x-auto">
              <table className="w-full caption-bottom text-sm min-w-[640px]">
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
                    const runningPlugin = pluginList.find(p => p.id.toLowerCase() === selectedPlugin.toLowerCase());
                    const runningCommit = runningPlugin?.commit;
                    return displayedCommits.map((commit, index) => (
                      <CommitRow
                        key={commit.hash}
                        commit={commit}
                        isCurrent={commit.hash === commitsData.current_hash}
                        isFuture={currentIdx === -1 || index < currentIdx}
                        isCheckingOut={isCheckingOut}
                        onCheckout={handleCheckoutClick}
                        t={t}
                        isLocalCurrent={runningCommit ? commit.short_hash === runningCommit : false}
                        isRemoteLatest={commit.hash === commitsData.current_hash}
                        githubRepoPath={githubRepoPath}
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
              {t(checkoutDialogIsFuture ? 'gitUpdate.updateConfirmTitle' : 'gitUpdate.checkoutConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <div>
                {checkoutDialogIsFuture
                  ? t('gitUpdate.updateConfirmDesc', { plugin: getPluginDisplayName(selectedPlugin), hash: checkoutDialog.commit?.short_hash || '', message: checkoutDialog.commit?.message || '' })
                  : t('gitUpdate.checkoutConfirmMessage', { plugin: getPluginDisplayName(selectedPlugin), hash: checkoutDialog.commit?.short_hash || '' })}
              </div>
              <div className="text-muted-foreground">
                {t('gitUpdate.checkoutConfirmCommitInfo', { hash: checkoutDialog.commit?.short_hash || '', message: checkoutDialog.commit?.message || '' })}
              </div>
              <div className="text-yellow-600 dark:text-yellow-500 font-medium">{t('gitUpdate.checkoutConfirmWarning')}</div>
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

      {/* Update Confirmation Dialog */}
      <AlertDialog open={updateDialog} onOpenChange={setUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              {t('gitUpdate.updateConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <div>确认将 <strong>{getPluginDisplayName(selectedPlugin)}</strong> 更新到 commit <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">{commitsData?.current_hash || ''}</code>？</div>
              <div className="text-muted-foreground">
                commit <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">{commitsData?.current_hash || ''}</code>：<span className="font-medium">{commitsData?.commits[0]?.message || ''}</span>
              </div>
              <div className="text-yellow-600 dark:text-yellow-500 font-medium">⚠️ 注意：更新将执行 <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">git pull</code>，如有本地代码修改将移除，此操作不可逆。</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isForceUpdating}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpdate}
              disabled={isForceUpdating}
            >
              {isForceUpdating ? t('gitUpdate.loading') : t('common.confirm')}
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

      {/* 更新全部插件确认对话框 */}
      <AlertDialog open={updateAllDialogOpen} onOpenChange={setUpdateAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gitUpdate.updateAll')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('plugins.updateAllPluginsConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateAllConfirm}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 更新全部插件状态面板 - 弹窗 */}
      <Dialog open={updateAllPanelOpen} onOpenChange={setUpdateAllPanelOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              {t('gitUpdate.updateAll')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('gitUpdate.updateAllAriaDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg overflow-auto flex-1">
            <Table className="min-w-[400px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('gitUpdate.selectPlugin')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.error')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pluginUpdateList.map((plugin) => (
                  <TableRow key={plugin.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <PluginIcon pluginName={plugin.name} className="w-5 h-5" />
                        <span>{plugin.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {plugin.status === 'pending' && (
                        <Badge variant="secondary">{t('plugins.updatePending')}</Badge>
                      )}
                      {plugin.status === 'updating' && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm px-2.5 py-0.5 rounded-full border border-transparent bg-primary/10 text-primary">
                          <Loader2 className="w-3 h-3 animate-spin [&>*]:!text-primary" />
                          {t('plugins.updating')}
                        </span>
                      )}
                      {plugin.status === 'success' && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm px-2.5 py-0.5 rounded-full border border-green-500/20 bg-green-500/10 text-green-600">
                          <CheckCircle2 className="w-3 h-3 [&>*]:!text-green-600 [&>path]:!stroke-green-600" />
                          {t('plugins.updateSuccess')}
                        </span>
                      )}
                      {plugin.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm px-2.5 py-0.5 rounded-full border border-transparent bg-destructive text-white">
                          <XCircle className="w-3 h-3 [&>*]:!text-white [&>circle]:!stroke-white [&>path]:!stroke-white" />
                          {t('plugins.updateFailed')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {plugin.message || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateAllPanelOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重载当前插件确认对话框 */}
      <AlertDialog open={reloadDialogOpen} onOpenChange={setReloadDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('plugins.reloadPlugin')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('plugins.reloadPluginConfirm', { name: selectedPlugin || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReloadPluginConfirm}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GitMirrorDialog
        open={gitMirrorOpen}
        onOpenChange={setGitMirrorOpen}
      />
    </PinnedPage>
  );
}
