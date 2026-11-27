import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Store,
  Search,
  Package,
  RefreshCw,
  Download,
  Trash2,
  DownloadCloud,
  GitBranch,
  FileText,
  ExternalLink,
  Grid3x3,
  Check,
  Sparkles,
  Wrench,
  Link2,
  FileUp,
  Loader2,
  Cable,
  Github,
  Star,
  Copy,
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  pluginStoreApi,
  type StorePlugin,
  type PluginStoreListResponse,
  type PluginStoreSort,
  gitMirrorApi,
  type GitPluginInfo,
  githubApi,
  type GitHubStatus,
  type GitHubDeviceStart,
  type GitHubStarInfo,
  getApiErrorMessage,
} from '@/lib/api';
import {
  isPluginAiContent,
  formatStarCount,
  parseGitHubRepo,
  resolvePluginStoreGroups,
  resolvePluginStoreView,
} from '@/lib/featureUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import GitMirrorDialog, { getMirrorBadge } from '@/components/GitMirrorDialog';
import { PluginIcon } from '@/components/ui/plugin-icon';
import {
  buildPluginReadmeUrls,
  getSourceBadgeInfo,
  isHttpUrl,
  resolveReadmeAssetUrl,
  SOURCE_BADGE_CLASSES,
} from '@/lib/pluginSource';
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapShrinkClass,
} from '@/components/ui/TabButtonGroup';
import { cn, copyTextToClipboard } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
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
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { pageGapClass, PinnedPage } from '@/components/layout/PinnedPage';

// 缓存相关常量
const PLUGIN_CACHE_KEY = 'pluginStore_cache_v2';
const GIT_MIRROR_CACHE_KEY = 'pluginStore_gitMirror_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

/** 插件商店每页条数（服务端分页） */
const PLUGIN_PAGE_SIZE = 32;

const MULTILINE_TOAST_CLASS = 'whitespace-pre-wrap break-words';
const toastError = (msg: string) => toast.error(msg, { className: MULTILINE_TOAST_CLASS });
const toastSuccess = (msg: string) => toast.success(msg, { className: MULTILINE_TOAST_CLASS });

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCachedData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
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

/** 清掉所有插件商店分页缓存。缓存键带页签/页码后缀，逐个 remove 覆盖不到。 */
function clearPluginCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(PLUGIN_CACHE_KEY)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // localStorage 不可用时静默忽略
  }
}

function createPluginOrderSeed(): string {
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('');
}

const TAG_GAP = 6; // 与 gap-1.5 一致，量宽失败时的兜底

/**
 * 别名标签只排一行。CSS 算不出「几个完整标签 + 一枚 +N」的组合，
 * 用隐藏 gauge 量每个标签的右边界；+N 按标签总数预留宽度，避免位数变化来回抖。
 */
function PluginAliasTags({ tags }: { tags: string[] }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const gaugeRef = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const gauge = gaugeRef.current;
    const total = tags.length;
    if (!box || !gauge || total === 0) {
      setVisibleCount(null);
      return;
    }
    const measure = () => {
      const available = box.clientWidth;
      if (available <= 0) return;
      const badges = Array.from(gauge.children) as HTMLElement[];
      if (badges.length <= total) return;
      const edges = badges.map((badge) => badge.offsetLeft + badge.offsetWidth);
      if (edges[total - 1] <= available) {
        setVisibleCount((prev) => (prev === total ? prev : total));
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(gauge).columnGap) || TAG_GAP;
      const overflowWidth = badges[total].offsetWidth;
      let fit = 0;
      while (fit < total && edges[fit] + gap + overflowWidth <= available) {
        fit += 1;
      }
      setVisibleCount((prev) => (prev === fit ? prev : fit));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(gauge);
    return () => observer.disconnect();
  }, [tags]);

  const shown = visibleCount === null ? tags.length : Math.min(visibleCount, tags.length);
  const hiddenLabels = tags.slice(shown);

  return (
    <span
      ref={boxRef}
      className="relative flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
    >
      {tags.slice(0, shown).map((tag, index) => (
        <Badge
          key={`${tag}-${index}`}
          variant="outline"
          className="theme-chip shrink-0 text-xs font-normal"
        >
          {tag}
        </Badge>
      ))}
      {hiddenLabels.length > 0 && (
        <Badge
          variant="outline"
          title={hiddenLabels.join(', ')}
          className="theme-chip shrink-0 border-transparent bg-foreground/10 text-xs font-normal text-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          +{hiddenLabels.length}
        </Badge>
      )}
      <span
        ref={gaugeRef}
        aria-hidden
        className="invisible pointer-events-none absolute left-0 top-0 flex w-max gap-1.5"
      >
        {tags.map((tag, index) => (
          <Badge
            key={`gauge-${tag}-${index}`}
            variant="outline"
            className="shrink-0 text-xs font-normal"
          >
            {tag}
          </Badge>
        ))}
        <Badge variant="outline" className="shrink-0 text-xs font-normal">
          +{tags.length}
        </Badge>
      </span>
    </span>
  );
}

function storeTabCount(text: string, alert = false) {
  return (
    <span className={cn('tab-segment-count', alert && 'tab-segment-count-alert')}>{text}</span>
  );
}

export default function PluginStorePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  // 已提交的搜索词：每次按键都打一次接口会打爆后端，防抖后再提交
  const [appliedSearch, setAppliedSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<PluginStoreSort>('default');
  const [pluginOrderSeed] = useState(createPluginOrderSeed);
  // 服务端返回的原始分页结果（页 + 计数），视图由 resolvePluginStoreView 推导
  const [storePayload, setStorePayload] = useState<PluginStoreListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  // `${pluginId}:${action}`：同卡多按钮（安装/更新/卸载）各自转圈、互不误转
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [gitMirrorOpen, setGitMirrorOpen] = useState(false);
  const [gitPluginsMap, setGitPluginsMap] = useState<Record<string, GitPluginInfo>>({});

  // README dialog state
  const [readmeDialogOpen, setReadmeDialogOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<StorePlugin | null>(null);
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [readmeLoading, setReadmeLoading] = useState(false);

  // Install by URL dialog state
  const [installByUrlOpen, setInstallByUrlOpen] = useState(false);
  const [installByUrlUrl, setInstallByUrlUrl] = useState('');
  const [installByUrlBranch, setInstallByUrlBranch] = useState('');
  const [installByUrlLoading, setInstallByUrlLoading] = useState(false);

  // 从文件安装：只保留单个待装 zip（对齐 AstrBot，再选一个即覆盖上一个）
  const [installByFileOpen, setInstallByFileOpen] = useState(false);
  const [installByFile, setInstallByFile] = useState<File | null>(null);
  const [installByFileLoading, setInstallByFileLoading] = useState(false);
  const installByFileInputRef = useRef<HTMLInputElement | null>(null);

  // GitHub 连接（Device Flow）+ 插件 star 状态
  const [githubStatus, setGithubStatus] = useState<GitHubStatus | null>(null);
  const [starsMap, setStarsMap] = useState<Record<string, GitHubStarInfo>>({});
  const [starLoadingRepo, setStarLoadingRepo] = useState<string | null>(null);
  const [githubConnectOpen, setGithubConnectOpen] = useState(false);
  const [githubDisconnectOpen, setGithubDisconnectOpen] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<GitHubDeviceStart | null>(null);
  const [deviceState, setDeviceState] = useState<'loading' | 'waiting' | 'expired' | 'denied'>(
    'loading',
  );
  // 连接成功后 bump 一下，让 star 数据在 reposKey 没变时也重拉
  const [starsVersion, setStarsVersion] = useState(0);
  // session 自增 + timer：关掉弹窗 / 重新发起后，旧的轮询回调直接作废
  const githubPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const githubPollSessionRef = useRef(0);

  const isDeprecated = (plugin: StorePlugin) =>
    plugin.type === 'danger' && plugin.content === t('pluginStore.deprecated');

  // 记录实际成功拉取 README 的完整 URL，供相对路径图片按同一仓库与分支解析（Fork/CNB/GitCode 均一致）
  const readmeSourceUrlRef = useRef<string>('');

  // 根据当前成功拉取的 README 地址构造 react-markdown components
  const markdownComponents: Components = useMemo(
    () => ({
      pre: ({ children }) => (
        <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono">
          {children}
        </pre>
      ),
      code: ({ className, children, ...props }) => {
        const isInline = !className;
        if (isInline) {
          return (
            <code
              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
      table: ({ children }) => (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full divide-y divide-border border border-border">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
      th: ({ children }) => (
        <th className="px-4 py-2 text-left text-sm font-semibold text-foreground">{children}</th>
      ),
      td: ({ children }) => <td className="px-4 py-2 text-sm text-foreground/90">{children}</td>,
      tr: ({ children }) => <tr className="even:bg-muted/30">{children}</tr>,
      img: ({ src, alt, ...props }) => {
        const srcStr = typeof src === 'string' ? src : '';
        const resolved = resolveReadmeAssetUrl(readmeSourceUrlRef.current, srcStr);
        return <img src={resolved} alt={alt || ''} {...props} />;
      },
    }),
    [],
  );

  /** 把接口返回的一页数据落到 state：标记娱乐/工具/适配器分类，保留原始分页结果供视图推导。 */
  const applyPluginPayload = (data: PluginStoreListResponse) => {
    // 远端 JSON 不受控：plugins 可能不是数组、条目可能缺字段、分组键随时可能新增，
    // 全部在这里归一化——下游渲染路径拿到的必须是合法结构，畸形数据绝不抛错。
    const groups = resolvePluginStoreGroups(data);
    const rawPlugins = Array.isArray(data?.plugins) ? data.plugins : [];
    const pluginsWithCategory = rawPlugins.map((plugin) => {
      const id = typeof plugin?.id === 'string' ? plugin.id : String(plugin?.id ?? '');
      return {
        ...plugin,
        id,
        description: typeof plugin?.description === 'string' ? plugin.description : '',
        tags: Array.isArray(plugin?.tags) ? plugin.tags : [],
        alias: Array.isArray(plugin?.alias) ? plugin.alias : [],
        isFun: groups.fun.includes(id),
        isTool: groups.tool.includes(id),
        isAdapter: groups.adapter.includes(id),
      };
    });
    setStorePayload({ ...data, plugins: pluginsWithCategory });
  };

  // Fetch plugin list（服务端按页签/搜索过滤与排序并分页，支持缓存）
  const fetchPlugins = async (forceRefresh = false) => {
    // 缓存键要带页签/页码/搜索词/排序，否则切条件会命中旧缓存
    const cacheKey = `${PLUGIN_CACHE_KEY}:${activeTab}:${page}:${appliedSearch}:${sortBy}`;
    // 尝试从缓存加载（要求种子和排序模式均匹配，避免旧后端无 sort 字段时误命中）
    if (!forceRefresh) {
      const cached = getCachedData<PluginStoreListResponse>(cacheKey);
      const sortMatched = sortBy === 'default' || cached?.sort === sortBy;
      if (cached?.order_seed === pluginOrderSeed && sortMatched) {
        applyPluginPayload(cached);
        setIsLoading(false);
        return;
      }
    }

    try {
      setIsLoading(true);
      const data = await pluginStoreApi.getPluginList({
        tab: activeTab,
        search: appliedSearch || undefined,
        sort: sortBy === 'default' ? undefined : sortBy,
        limit: PLUGIN_PAGE_SIZE,
        offset: (page - 1) * PLUGIN_PAGE_SIZE,
        order_seed: pluginOrderSeed,
      });
      applyPluginPayload(data);
      // 断网降级快照不写入 24h 缓存，避免网络恢复后仍停留在离线态
      if (!data.store_offline && (sortBy === 'default' || data.sort === sortBy)) {
        setCachedData(cacheKey, data);
      }
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
      toast.error(t('pluginStore.loadPluginListFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch git mirror info for installed plugins（支持缓存）
  const fetchGitMirrorInfo = async (forceRefresh = false) => {
    // 尝试从缓存加载
    if (!forceRefresh) {
      const cached = getCachedData<Record<string, GitPluginInfo>>(GIT_MIRROR_CACHE_KEY);
      if (cached) {
        setGitPluginsMap(cached);
        return;
      }
    }

    try {
      const data = await gitMirrorApi.getInfo(forceRefresh ? { fresh: true } : undefined);
      const map: Record<string, GitPluginInfo> = {};
      data.plugins.forEach((p) => {
        map[p.name.toLowerCase()] = p;
      });
      setGitPluginsMap(map);
      // 写入缓存
      setCachedData(GIT_MIRROR_CACHE_KEY, map);
    } catch (error) {
      // 静默失败，不影响主页面
      console.error('Failed to fetch git mirror info:', error);
    }
  };

  // 搜索防抖：每次按键都打一次接口会打爆后端，停手 400ms 才提交
  useEffect(() => {
    const id = setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // 切页签 / 翻页 / 改搜索 / 改排序 → 重新取当前页
  useEffect(() => {
    fetchPlugins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, appliedSearch, sortBy]);

  useEffect(() => {
    fetchGitMirrorInfo();
  }, []);

  /** GitHub 连接状态（所有登录用户可查；star 操作仅管理员）。 */
  const fetchGithubStatus = async () => {
    try {
      setGithubStatus(await githubApi.getStatus());
    } catch (error) {
      // 老后端没有 /api/github 接口：静默降级，页面仍显示匿名 star 数
      console.warn('Failed to fetch GitHub status:', error);
    }
  };

  useEffect(() => {
    fetchGithubStatus();
  }, []);

  const stopGithubPolling = () => {
    githubPollSessionRef.current += 1;
    if (githubPollTimerRef.current) {
      clearTimeout(githubPollTimerRef.current);
      githubPollTimerRef.current = null;
    }
  };

  const scheduleGithubPoll = (intervalSec: number) => {
    const session = githubPollSessionRef.current;
    githubPollTimerRef.current = setTimeout(async () => {
      if (session !== githubPollSessionRef.current) return;
      try {
        const res = await githubApi.pollDevice();
        if (session !== githubPollSessionRef.current) return;
        if (res.state === 'pending' || res.state === 'slow_down') {
          scheduleGithubPoll(res.interval ?? 5);
        } else if (res.state === 'connected') {
          setGithubConnectOpen(false);
          toast.success(t('pluginStore.github.connectSuccess'));
          fetchGithubStatus();
          setStarsVersion((v) => v + 1);
        } else {
          setDeviceState(res.state);
        }
      } catch (error) {
        if (session !== githubPollSessionRef.current) return;
        // 单次轮询失败不终止流程，按原节奏继续等
        console.warn('GitHub device poll failed:', error);
        scheduleGithubPoll(intervalSec);
      }
    }, Math.max(1, intervalSec) * 1000);
  };

  const startGithubConnect = async () => {
    stopGithubPolling();
    setDeviceInfo(null);
    setDeviceState('loading');
    try {
      const info = await githubApi.startDevice();
      setDeviceInfo(info);
      setDeviceState('waiting');
      scheduleGithubPoll(info.interval);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('pluginStore.github.connectFailed')));
      setGithubConnectOpen(false);
    }
  };

  // 打开弹窗才发起 device 授权；关掉即停轮询
  useEffect(() => {
    if (githubConnectOpen) startGithubConnect();
    else stopGithubPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [githubConnectOpen]);

  useEffect(() => () => stopGithubPolling(), []);

  const handleGithubDisconnect = async () => {
    try {
      const res = await githubApi.disconnect();
      toast.success(res.msg || t('pluginStore.github.disconnected'));
      fetchGithubStatus();
      setStarsVersion((v) => v + 1);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('pluginStore.github.disconnectFailed')));
    }
  };

  /** star 切换：乐观更新，失败回滚。star 请求失败不影响列表展示。 */
  const handleStarToggle = async (repo: string, starred: boolean) => {
    const key = repo.toLowerCase();
    const prev = starsMap[key];
    setStarLoadingRepo(key);
    setStarsMap((m) => ({
      ...m,
      [key]: {
        count: prev?.count != null ? prev.count + (starred ? 1 : -1) : null,
        starred,
      },
    }));
    try {
      if (starred) await githubApi.star(repo);
      else await githubApi.unstar(repo);
    } catch (error) {
      setStarsMap((m) => ({ ...m, [key]: prev ?? { count: null, starred: null } }));
      toast.error(getApiErrorMessage(error, t('pluginStore.github.starFailed')));
    } finally {
      setStarLoadingRepo(null);
    }
  };

  const handleStarClick = (plugin: StorePlugin) => {
    if (plugin.in_store === false || !plugin.link) return;
    const repo = parseGitHubRepo(plugin.link);
    if (!repo) return;
    if (!githubStatus?.connected) {
      setGithubConnectOpen(true);
      return;
    }
    const info = starsMap[repo.toLowerCase()];
    handleStarToggle(repo, info?.starred !== true);
  };

  /** 就地更新当前页某个插件的字段，避免重新请求整页。 */
  const patchPlugin = (pluginId: string, patch: Partial<StorePlugin>) => {
    setStorePayload((prev) =>
      prev
        ? {
            ...prev,
            plugins: prev.plugins.map((p) => (p.id === pluginId ? { ...p, ...patch } : p)),
          }
        : prev,
    );
  };

  const isPluginBusy = (pluginId: string) => actionLoading?.startsWith(`${pluginId}:`) ?? false;
  const isPluginAction = (pluginId: string, action: string) =>
    actionLoading === `${pluginId}:${action}`;

  // Handle install plugin - 直接更新本地状态，不重新请求 API
  const handleInstall = async (pluginId: string) => {
    try {
      setActionLoading(`${pluginId}:install`);
      await pluginStoreApi.installPlugin(pluginId);
      toast.success(t('pluginStore.installSuccess'));
      // 直接更新本地状态与已安装计数，避免触发整页重新加载
      setStorePayload((prev) => {
        if (!prev) return prev;
        const alreadyInstalled = prev.plugins.some((p) => p.id === pluginId && p.installed);
        return {
          ...prev,
          plugins: prev.plugins.map((p) =>
            p.id === pluginId ? { ...p, installed: true, hasUpdate: false } : p,
          ),
          counts:
            prev.counts && !alreadyInstalled
              ? { ...prev.counts, installed: (prev.counts.installed ?? 0) + 1 }
              : prev.counts,
        };
      });
      // 清除缓存并刷新 Git 镜像状态，使镜像徽标即时生效
      clearPluginCache();
      localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
      void fetchGitMirrorInfo(true);
    } catch (_error) {
      toast.error(t('pluginStore.installError'));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle update plugin - 直接更新本地状态，不重新请求 API
  const handleUpdate = async (pluginId: string) => {
    try {
      setActionLoading(`${pluginId}:update`);
      await pluginStoreApi.updatePlugin(pluginId);
      toast.success(t('pluginStore.updateSuccess'));
      // 直接更新本地状态，避免触发后端重新加载
      patchPlugin(pluginId, { hasUpdate: false });
      // 清除缓存，确保下次进入页面数据一致
      clearPluginCache();
    } catch (_error) {
      toast.error(t('pluginStore.updateError'));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle uninstall plugin - 直接更新本地状态，不重新请求 API
  const handleUninstall = async (pluginId: string) => {
    if (
      confirm(
        t('pluginStore.uninstallConfirm') +
          ' "' +
          visiblePlugins.find((p) => p.id === pluginId)?.name +
          '" ' +
          t('pluginStore.confirmUninstall'),
      )
    ) {
      try {
        setActionLoading(`${pluginId}:uninstall`);
        await pluginStoreApi.uninstallPlugin(pluginId);
        toast.success(t('pluginStore.uninstallSuccess'));
        const removedTarget = visiblePlugins.find((p) => p.id === pluginId);
        const shouldRemoveRow = removedTarget?.in_store === false || activeTab === 'installed';
        setStorePayload((prev) => {
          if (!prev) return prev;
          const nextPlugins = shouldRemoveRow
            ? prev.plugins.filter((p) => p.id !== pluginId)
            : prev.plugins.map((p) =>
                p.id === pluginId ? { ...p, installed: false, hasUpdate: false } : p,
              );
          const nextCounts = prev.counts
            ? {
                ...prev.counts,
                installed: Math.max(0, (prev.counts.installed ?? 0) - 1),
              }
            : prev.counts;
          return {
            ...prev,
            plugins: nextPlugins,
            count:
              shouldRemoveRow && typeof prev.count === 'number'
                ? Math.max(0, prev.count - 1)
                : prev.count,
            counts: nextCounts,
          };
        });
        // 清除缓存并同步清理内存中的 Git 镜像映射，确保下次打开页面与详情状态一致
        setGitPluginsMap((prev) => {
          const key = pluginId.toLowerCase();
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
        clearPluginCache();
        localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
      } catch (_error) {
        toast.error(t('pluginStore.uninstallError'));
      } finally {
        setActionLoading(null);
      }
    }
  };

  // Install plugin by git repo URL - 对应后端 POST /api/plugin-store/install-url
  // 安装成功/失败后由后端 msg 字段直接 toast 回显，清缓存并刷新列表
  const handleInstallByUrl = async () => {
    const url = installByUrlUrl.trim();
    const branch = installByUrlBranch.trim();

    // 前端校验：URL 非空 + 协议前缀合法（与后端限制保持一致）
    if (!url) {
      toast.error(t('pluginStore.urlRequired'));
      return;
    }
    if (!/^(https?:\/\/|ssh:\/\/|git@)/i.test(url)) {
      toast.error(t('pluginStore.urlProtocolInvalid'));
      return;
    }
    try {
      // 仅作格式校验，try 内避免与下面 installByUrl 抛错混淆
      const parsed = url.startsWith('git@') ? new URL(`https://${url}`) : new URL(url);
      void parsed;
    } catch {
      toast.error(t('pluginStore.urlInvalid'));
      return;
    }

    try {
      setInstallByUrlLoading(true);
      // 注意：installByUrl 后端响应是 `{status, msg}`（没有 data 字段），所以
      // API 层走的是 api.postRaw 拿到的完整信封。成功 / 失败都从 res.msg 读。
      const res = await pluginStoreApi.installByUrl(url, branch);
      if (res.status === 0) {
        // 后端返回的 msg 已经过友好处理（含 emoji），直接展示
        toast.success(res.msg || t('pluginStore.installSuccess'));
        // 关闭弹窗 + 清空表单
        setInstallByUrlOpen(false);
        setInstallByUrlUrl('');
        setInstallByUrlBranch('');
        // 清除缓存并刷新列表，使新插件立即出现在已安装列表
        clearPluginCache();
        localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
        fetchPlugins(true);
        fetchGitMirrorInfo(true);
      } else {
        // 非 0 状态：postRaw 不会抛错，需手动 toast 后端错误
        toast.error(getApiErrorMessage(res, t('pluginStore.installError')));
      }
    } catch (error) {
      // 既回显后端 msg（包含具体错误，如 FastAPI detail），又兜底本地化文案
      toast.error(getApiErrorMessage(error, t('pluginStore.installError')));
    } finally {
      setInstallByUrlLoading(false);
    }
  };

  // 从本地 zip 安装插件 - 对应后端 POST /api/plugin-store/install-upload
  // 成功文案在后端 data.msg；失败时 status=1，由 postFormData 抛出，走 catch
  const handleInstallByFile = async () => {
    if (!installByFile) {
      toastError(t('pluginStore.fileRequired'));
      return;
    }
    if (!installByFile.name.toLowerCase().endsWith('.zip')) {
      toastError(t('pluginStore.fileMustBeZip'));
      return;
    }
    try {
      setInstallByFileLoading(true);
      const formData = new FormData();
      formData.append('file', installByFile);
      const data = await pluginStoreApi.installByFile(formData);
      toastSuccess(data?.msg || t('pluginStore.installSuccess'));
      setInstallByFileOpen(false);
      setInstallByFile(null);
      localStorage.removeItem(PLUGIN_CACHE_KEY);
      localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
      fetchPlugins(true);
      fetchGitMirrorInfo(true);
    } catch (error) {
      toastError(getApiErrorMessage(error, t('pluginStore.installError')));
    } finally {
      setInstallByFileLoading(false);
    }
  };

  // 列表视图：服务端已按页签/搜索过滤并分页（旧后端走前端兜底）
  const storeView = useMemo(
    () =>
      resolvePluginStoreView(
        storePayload,
        { tab: activeTab, search: appliedSearch },
        page,
        PLUGIN_PAGE_SIZE,
        t('pluginStore.deprecated'),
      ),
    [storePayload, activeTab, appliedSearch, page, t],
  );

  const visiblePlugins = storeView.items;

  // 当前页插件对应的 GitHub 仓库（大小写不敏感去重；无 link 的本地插件绝不猜拼 github.com/<id>）
  const storeRepos = useMemo(() => {
    const map = new Map<string, string>();
    for (const plugin of visiblePlugins) {
      if (plugin.in_store === false || !plugin.link) continue;
      const repo = parseGitHubRepo(plugin.link);
      if (repo) map.set(repo.toLowerCase(), repo);
    }
    return Array.from(map.values());
  }, [visiblePlugins]);
  const storeReposKey = storeRepos.map((r) => r.toLowerCase()).join(',');

  // 当前页 star 数 / 已 star 状态；请求失败只记日志，不影响列表展示
  useEffect(() => {
    if (storeRepos.length === 0) {
      setStarsMap({});
      return;
    }
    let cancelled = false;
    githubApi
      .getStars(storeRepos)
      .then((data) => {
        if (cancelled) return;
        const map: Record<string, GitHubStarInfo> = {};
        for (const [repo, info] of Object.entries(data.stars)) {
          map[repo.toLowerCase()] = info;
        }
        setStarsMap(map);
      })
      .catch((error) => {
        console.warn('Failed to fetch GitHub stars:', error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeReposKey, starsVersion]);

  // 页签徽标数字：来自服务端的**总数**，不随翻页/搜索变化
  const storeStats = storeView.counts;
  const storeTotalPages = storeView.totalPages;

  // Handle card click to show README
  const handleCardClick = async (plugin: StorePlugin) => {
    setSelectedPlugin(plugin);
    setReadmeDialogOpen(true);
    setReadmeLoading(true);
    setReadmeContent('');
    readmeSourceUrlRef.current = '';

    try {
      const gitKey = (plugin.local_plugin_name || plugin.id).toLowerCase();
      const gitInfo = gitPluginsMap[gitKey] ?? gitPluginsMap[plugin.id.toLowerCase()] ?? null;
      const urls = buildPluginReadmeUrls(plugin, gitInfo);
      if (urls.length === 0) {
        setReadmeContent(
          plugin.in_store === false
            ? t('pluginStore.localPluginReadmeEmpty')
            : t('pluginStore.noReadme'),
        );
        return;
      }

      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            readmeSourceUrlRef.current = url;
            setReadmeContent(text);
            return;
          }
        } catch {
          // 当前镜像拉 README 失败时换下一个候选地址
        }
      }

      setReadmeContent(t('pluginStore.noReadme'));
    } catch (error) {
      console.error('Failed to fetch README:', error);
      setReadmeContent(t('pluginStore.readmeLoadFailed'));
    } finally {
      setReadmeLoading(false);
    }
  };

  const countText = (value: number) => (isLoading ? '—' : String(value));
  const tabOptions = [
    {
      value: 'all',
      label: t('pluginStore.allPlugins'),
      icon: <Grid3x3 className="w-4 h-4" />,
      badge: storeTabCount(countText(storeStats.all)),
    },
    {
      value: 'installed',
      label: t('pluginStore.installed'),
      icon: <Check className="w-4 h-4" />,
      // 可更新数/已安装数（如 1/10）；有可更新时上琥珀警示色
      badge: (
        <span
          className={cn(
            'tab-segment-count',
            !isLoading && storeStats.updates > 0 && 'tab-segment-count-alert',
          )}
          title={`${t('pluginStore.updates')} / ${t('pluginStore.installed')}`}
        >
          {isLoading ? '—' : `${storeStats.updates}/${storeStats.installed}`}
        </span>
      ),
    },
    {
      value: 'fun',
      label: t('pluginStore.funPlugins'),
      icon: <Sparkles className="w-4 h-4" />,
      badge: storeTabCount(countText(storeStats.fun)),
    },
    {
      value: 'tool',
      label: t('pluginStore.toolPlugins'),
      icon: <Wrench className="w-4 h-4" />,
      badge: storeTabCount(countText(storeStats.tool)),
    },
    {
      value: 'adapter',
      label: t('pluginStore.adapterPlugins'),
      icon: <Cable className="w-4 h-4" />,
      badge: storeTabCount(countText(storeStats.adapter)),
    },
  ];

  return (
    <PinnedPage
      header={
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Store className="w-8 h-8" />
            {t('pluginStore.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('pluginStore.description')}</p>
        </div>
      }
      toolbar={
        /* 分类 Tab、搜索与操作按钮同一行平齐。高度统一为 tabToolbarControlClass。
           永不折行：md 起单行不 wrap，放不下时分段/按钮文字压省略号（min-w-0 + truncate），
           仍超出由 .page-pinned-toolbar 横向滚动兜底。窄屏 2 列网格两行照旧 */
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 md:flex-nowrap">
          <div className={tabToolbarGroupWrapShrinkClass}>
            <TabButtonGroup
              options={tabOptions}
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v);
                setPage(1);
              }}
              className="w-full sm:w-auto flex-nowrap"
              collapseOnMobile
            />
          </div>
          <div className="relative order-first min-w-0 sm:order-none sm:ml-auto sm:flex-1 sm:max-w-64 lg:max-w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('pluginStore.searchPlugin')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(tabToolbarControlClass, 'w-full pl-10')}
            />
          </div>
          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v as PluginStoreSort);
              setPage(1);
            }}
          >
            <SelectTrigger
              className={cn(
                tabToolbarControlClass,
                'w-full min-w-0 gap-1.5 px-3 sm:w-auto sm:shrink-0 [&>span]:min-w-0 [&>span]:truncate',
              )}
            >
              <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{t('pluginStore.sortDefault')}</SelectItem>
              <SelectItem value="stars_desc">{t('pluginStore.sortStarsDesc')}</SelectItem>
              <SelectItem value="stars_asc">{t('pluginStore.sortStarsAsc')}</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  tabToolbarControlClass,
                  'w-full justify-start gap-2 px-3 sm:w-auto sm:min-w-0 sm:shrink-0 sm:justify-center sm:overflow-hidden',
                )}
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{t('pluginStore.moreActions')}</span>
                <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-70 sm:ml-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-max"
            >
              <DropdownMenuItem onClick={() => setGitMirrorOpen(true)}>
                <GitBranch className="mr-2 h-4 w-4 shrink-0" />
                <span>{t('gitMirror.title')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInstallByUrlOpen(true)}>
                <Link2 className="mr-2 h-4 w-4 shrink-0" />
                <span>{t('pluginStore.installFromUrl')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setInstallByFileOpen(true)}>
                <FileUp className="mr-2 h-4 w-4 shrink-0" />
                <span>{t('pluginStore.installFromFile')}</span>
              </DropdownMenuItem>
              {isAdmin && githubStatus && (
                <>
                  <DropdownMenuSeparator />
                  {githubStatus.connected ? (
                    <DropdownMenuItem
                      onClick={() => setGithubDisconnectOpen(true)}
                      title={t('pluginStore.github.disconnectHint')}
                    >
                      {githubStatus.avatar_url ? (
                        <img
                          src={githubStatus.avatar_url}
                          alt={githubStatus.login}
                          className="mr-2 h-4 w-4 shrink-0 rounded-full"
                        />
                      ) : (
                        <Github className="mr-2 h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">{githubStatus.login}</span>
                      <span className="ml-auto pl-4 text-xs text-muted-foreground">
                        {t('pluginStore.github.disconnect')}
                      </span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setGithubConnectOpen(true)}>
                      <Github className="mr-2 h-4 w-4 shrink-0" />
                      <span>{t('pluginStore.github.connect')}</span>
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      {storePayload?.store_offline && (
        <Alert variant="warning" className="mb-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('pluginStore.storeOfflineTitle')}</AlertTitle>
          <AlertDescription>{t('pluginStore.storeOfflineDesc')}</AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <div className={cn('grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', pageGapClass)}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="glass-card">
              <div className="h-32 bg-muted/50 overflow-hidden rounded-t-[inherit]">
                <Skeleton className="h-full w-full" />
              </div>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : visiblePlugins.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="!py-12 text-center text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">
              {searchQuery
                ? t('pluginStore.noMatchedPlugins')
                : activeTab === 'installed'
                  ? t('pluginStore.noInstalledPlugins')
                  : activeTab === 'fun'
                    ? t('pluginStore.noFunPlugins')
                    : activeTab === 'tool'
                      ? t('pluginStore.noToolPlugins')
                      : activeTab === 'adapter'
                        ? t('pluginStore.noAdapterPlugins')
                        : t('pluginStore.noPlugins')}
            </p>
            {searchQuery && <p className="text-sm">{t('pluginStore.adjustSearchKeywords')}</p>}
          </CardContent>
        </Card>
      ) : (
        <div className={cn('grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', pageGapClass)}>
          {visiblePlugins.map((plugin) => {
            const deprecated = isDeprecated(plugin);
            const isAi = isPluginAiContent(plugin);
            const isStorePlugin = plugin.in_store !== false;
            const externalLink = (plugin.link || '').trim();
            const safeExternalLink = isHttpUrl(externalLink) ? externalLink : '';
            const localSourceBadge = !isStorePlugin
              ? getSourceBadgeInfo(
                  plugin.local_source_kind || 'local',
                  plugin.local_upstream_host,
                  t,
                  plugin.local_upstream_url,
                )
              : null;
            const isStoreFork =
              isStorePlugin && plugin.installed && plugin.local_source_kind === 'fork';
            const isLoadFailed = plugin.load_status === 'failed';
            const isLoadDisabled = plugin.load_status === 'disabled';

            const coverVisual = plugin.cover ? (
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border shadow-md bg-background">
                <img src={plugin.cover} alt={plugin.id} className="w-full h-full object-cover" />
              </div>
            ) : !isStorePlugin ? (
              <PluginIcon
                pluginName={plugin.id}
                variant="avatar"
                className="w-14 h-14 border-2 border-border shadow-md"
              />
            ) : (
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-border shadow-md">
                <Package className="w-7 h-7 text-muted-foreground/50" />
              </div>
            );

            return (
              <Card
                key={plugin.id}
                className={`glass-card flex flex-col cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all ${deprecated ? 'opacity-60' : ''} ${plugin.installed ? 'ring-1 ring-green-500/30' : ''}`}
                onClick={() => handleCardClick(plugin)}
              >
                {/* 卡片内容区域 */}
                <div className="p-4 pb-2">
                  <div className="flex gap-3">
                    {/* Cover + Avatar 容器，self-start 防止被右侧内容撑高 */}
                    <div className="relative flex-shrink-0 self-start">
                      {/* Cover - 有外部链接时可点击跳转 */}
                      {safeExternalLink ? (
                        <a
                          href={safeExternalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {coverVisual}
                        </a>
                      ) : (
                        <div className="block">{coverVisual}</div>
                      )}

                      {/* Avatar 覆盖在 cover 右下角，与 cover 浅浅相交 */}
                      {plugin.avatar && (
                        <div className="absolute -bottom-px -right-px">
                          <div className="w-[22px] h-[22px] rounded-full border-2 border-background overflow-hidden bg-background shadow-sm">
                            <img
                              src={plugin.avatar}
                              alt={plugin.author}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 右侧：标题和描述 */}
                    <div className="flex-1 min-w-0">
                      {/* 标题行（名称 + Star）+ 右上角 badges */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <h3 className="font-semibold text-base truncate">{plugin.id}</h3>
                          {/* GitHub star：放在名称右侧；非商店插件或无 link 不显示 */}
                          {(() => {
                            if (!isStorePlugin || !externalLink) return null;
                            const repo = parseGitHubRepo(externalLink);
                            if (!repo) return null;
                            const key = repo.toLowerCase();
                            const info = starsMap[key];
                            const starred = info?.starred === true;
                            const busy = starLoadingRepo === key;
                            const noScope =
                              githubStatus?.connected === true && githubStatus.can_star === false;
                            const starTitle = !githubStatus?.connected
                              ? t('pluginStore.github.connectToStar')
                              : noScope
                                ? t('pluginStore.github.starNeedScope')
                                : starred
                                  ? t('pluginStore.github.unstar')
                                  : t('pluginStore.github.star');
                            const starBadgeClass = cn(
                              'theme-chip theme-chip-tint shrink-0 gap-1 px-1.5 py-0 text-xs font-medium leading-[18px] text-amber-500 border-amber-500/60 bg-amber-500/10',
                              starred && 'border-amber-500 bg-amber-500/20',
                              isAdmin && !noScope && 'hover:bg-amber-500/20',
                            );
                            const inner = (
                              <Badge variant="outline" className={starBadgeClass}>
                                {busy ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Star className={cn('w-3 h-3', starred && 'fill-current')} />
                                )}
                                {info?.count != null && <span>{formatStarCount(info.count)}</span>}
                              </Badge>
                            );
                            if (!isAdmin) {
                              return info?.count != null ? (
                                <span className="inline-flex shrink-0 items-center" title={repo}>
                                  {inner}
                                </span>
                              ) : null;
                            }
                            return (
                              <button
                                type="button"
                                disabled={busy || noScope}
                                title={starTitle}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStarClick(plugin);
                                }}
                                className={cn(
                                  'inline-flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  !noScope ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                                )}
                              >
                                {inner}
                              </button>
                            );
                          })()}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0">
                          {isLoadFailed && (
                            <Badge
                              variant="destructive"
                              className="text-xs font-normal"
                              title={plugin.last_error || undefined}
                            >
                              {t('pluginStore.loadStatusFailed')}
                            </Badge>
                          )}
                          {isLoadDisabled && (
                            <Badge
                              variant="outline"
                              className="theme-chip theme-chip-tint text-xs font-normal bg-muted/80 text-muted-foreground border-border"
                            >
                              {t('pluginStore.loadStatusDisabled')}
                            </Badge>
                          )}
                          {localSourceBadge && (
                            <Badge
                              variant="outline"
                              title={localSourceBadge.title}
                              className={cn(
                                'theme-chip theme-chip-tint text-xs font-normal',
                                SOURCE_BADGE_CLASSES[localSourceBadge.tone],
                              )}
                            >
                              {localSourceBadge.label}
                            </Badge>
                          )}
                          {isStoreFork && (
                            <Badge
                              variant="outline"
                              title={plugin.local_upstream_url || undefined}
                              className={cn(
                                'theme-chip theme-chip-tint text-xs font-normal',
                                SOURCE_BADGE_CLASSES.amber,
                              )}
                            >
                              {t('pluginStore.forkBadge')}
                            </Badge>
                          )}
                          {/* 镜像来源 badge（仅已安装 Git 插件） */}
                          {plugin.installed &&
                            (() => {
                              const gitKey = (plugin.local_plugin_name || plugin.id).toLowerCase();
                              const gitInfo =
                                gitPluginsMap[gitKey] ?? gitPluginsMap[plugin.id.toLowerCase()];
                              if (gitInfo?.is_git_repo && gitInfo.remote_url) {
                                const badge = getMirrorBadge(
                                  gitInfo.mirror,
                                  gitInfo.remote_url,
                                  t,
                                  gitInfo.upstream_host,
                                );
                                return (
                                  <Badge
                                    variant="outline"
                                    className={`theme-chip theme-chip-tint text-xs font-normal ${badge.className}`}
                                  >
                                    <span className="flex items-center gap-1">
                                      {badge.icon}
                                      {badge.label}
                                    </span>
                                  </Badge>
                                );
                              }
                              return null;
                            })()}
                          {plugin.isFun && (
                            <Badge
                              variant="outline"
                              className="theme-chip theme-chip-tint text-xs font-normal text-blue-500 border-blue-500"
                            >
                              {t('pluginStore.fun')}
                            </Badge>
                          )}
                          {plugin.isTool && (
                            <Badge
                              variant="outline"
                              className="theme-chip theme-chip-tint text-xs font-normal text-green-500 border-green-500"
                            >
                              {t('pluginStore.tool')}
                            </Badge>
                          )}
                          {plugin.isAdapter && (
                            <Badge
                              variant="outline"
                              className="theme-chip theme-chip-tint text-xs font-normal text-violet-500 border-violet-500"
                            >
                              {t('pluginStore.adapter')}
                            </Badge>
                          )}
                          {isAi && (
                            <Badge
                              variant="outline"
                              className="theme-chip theme-chip-tint text-xs font-normal text-cyan-500 border-cyan-500"
                            >
                              AI
                            </Badge>
                          )}
                          {deprecated && (
                            <Badge
                              variant="secondary"
                              className="text-xs font-normal bg-gray-500 text-white"
                            >
                              {t('pluginStore.deprecated')}
                            </Badge>
                          )}
                          {plugin.type === 'danger' && !deprecated && !isAi && !isLoadFailed && (
                            <Badge variant="destructive" className="text-xs font-normal">
                              {plugin.content}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* 作者信息 */}
                      {plugin.author && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          by {plugin.author}
                        </p>
                      )}

                      {/* 描述 - 单行截断，hover 显示完整内容 */}
                      <p
                        className="text-sm text-muted-foreground mt-1 truncate"
                        title={plugin.info || plugin.description}
                      >
                        {plugin.info || plugin.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tags 只排一行，放不下的收成 +N */}
                <div className="px-4 pb-2">
                  <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                    {plugin.hasUpdate && (
                      <Badge
                        variant="outline"
                        className="theme-chip theme-chip-tint shrink-0 text-xs font-normal text-amber-500 border-amber-500"
                      >
                        {t('pluginStore.canUpdate')}
                      </Badge>
                    )}
                    {plugin.alias && plugin.alias.length > 0 && (
                      <PluginAliasTags tags={plugin.alias} />
                    )}
                  </div>
                </div>

                {/* 按钮区域 */}
                {/* 覆盖 CardFooter 的 sm:p-6，与上方标签行 px-4 左右对齐 */}
                <CardFooter className="mt-auto p-4 pt-2 sm:p-4 sm:pt-2">
                  {deprecated ? (
                    <Button className="w-full gap-1 text-sm" disabled={true} variant="secondary">
                      <Package className="w-3 h-3" />
                      {t('pluginStore.stopMaintenance')}
                    </Button>
                  ) : plugin.installed ? (
                    <div className="flex gap-1.5 w-full">
                      {plugin.hasUpdate && plugin.is_git !== false && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs text-primary hover:text-primary [&_svg]:!text-current"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdate(plugin.id);
                          }}
                          disabled={isPluginBusy(plugin.id)}
                        >
                          {isPluginAction(plugin.id, 'update') ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Download className="w-3 h-3" />
                          )}
                          {t('pluginStore.update')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs text-destructive hover:text-destructive [&_svg]:!text-current"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUninstall(plugin.id);
                        }}
                        disabled={isPluginBusy(plugin.id)}
                      >
                        {isPluginAction(plugin.id, 'uninstall') ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        {t('pluginStore.uninstall')}
                      </Button>
                      {safeExternalLink && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs"
                          asChild
                        >
                          <a
                            href={safeExternalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DownloadCloud className="w-3 h-3" />
                            {t('pluginStore.details')}
                          </a>
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-1.5 w-full">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs text-primary hover:text-primary [&_svg]:!text-current"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstall(plugin.id);
                        }}
                        disabled={isPluginBusy(plugin.id)}
                      >
                        {isPluginAction(plugin.id, 'install') ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        {t('pluginStore.install')}
                      </Button>
                      {safeExternalLink && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-1 text-xs"
                          asChild
                        >
                          <a
                            href={safeExternalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DownloadCloud className="w-3 h-3" />
                            {t('pluginStore.details')}
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* 分页控件 */}
      {storeTotalPages > 1 && !isLoading && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">
            {t('pluginStore.pagination.label', { total: storeView.total })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('pluginStore.pagination.prev')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('pluginStore.pagination.page', { current: page, total: storeTotalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= storeTotalPages || isLoading}
            onClick={() => setPage((p) => Math.min(storeTotalPages, p + 1))}
          >
            {t('pluginStore.pagination.next')}
          </Button>
        </div>
      )}

      <GitMirrorDialog
        open={gitMirrorOpen}
        onOpenChange={setGitMirrorOpen}
        onChanged={() => {
          localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
          void fetchGitMirrorInfo(true);
        }}
      />

      {/* README Dialog */}
      <Dialog open={readmeDialogOpen} onOpenChange={setReadmeDialogOpen}>
        <DialogContent className="w-[90vw] max-w-5xl h-[85dvh] sm:h-[85vh] flex flex-col p-0 overflow-hidden">
          {/* Custom Header */}
          <div className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                {/* 用 DialogTitle 替代普通 h2：保留原有视觉样式，但能被屏幕阅读器
                    与 Radix Dialog 正确识别为对话框标题。 */}
                <DialogTitle className="text-lg font-semibold leading-none tracking-tight truncate">
                  {selectedPlugin?.id}
                </DialogTitle>
              </div>
              {isHttpUrl(selectedPlugin?.link) && (
                <a
                  href={selectedPlugin?.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>
                    {parseGitHubRepo(selectedPlugin?.link || '')
                      ? 'GitHub'
                      : t('pluginStore.openRepo')}
                  </span>
                </a>
              )}
            </div>
            {/* 用 DialogDescription 替代普通 p：保留原有视觉样式，但能被屏幕阅读器
                与 Radix Dialog 正确识别为对话框描述。 */}
            <DialogDescription className="text-sm text-muted-foreground mt-1 pr-8">
              {selectedPlugin?.description}
            </DialogDescription>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedPlugin?.in_store !== false &&
              selectedPlugin?.installed &&
              selectedPlugin?.local_source_kind === 'fork' &&
              selectedPlugin?.local_upstream_url && (
                <Alert variant="warning" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('pluginStore.forkBannerTitle')}</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center gap-2">
                    <span>
                      {t('pluginStore.forkBannerDesc', { url: selectedPlugin.local_upstream_url })}
                    </span>
                    {isHttpUrl(selectedPlugin.local_upstream_url) && (
                      <a
                        href={selectedPlugin.local_upstream_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t('pluginStore.openForkRepo')}
                      </a>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            {readmeLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div
                className="prose dark:prose-invert max-w-none
                prose-headings:font-bold prose-headings:text-foreground
                prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8 prose-h1:border-b prose-h1:pb-4
                prose-h2:text-2xl prose-h2:mb-4 prose-h2:mt-6
                prose-h3:text-xl prose-h3:mb-3 prose-h3:mt-5
                prose-h4:text-lg prose-h4:mb-2 prose-h4:mt-4
                prose-p:my-4 prose-p:leading-8 prose-p:text-foreground/90
                prose-a:text-blue-500 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                prose-strong:text-foreground prose-strong:font-bold
                prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-foreground
                prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
                prose-ul:my-4 prose-ol:my-4 prose-li:my-2
                prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-blockquote:my-4
                prose-img:rounded-lg prose-img:shadow-md prose-img:my-4
                prose-hr:border-border prose-hr:my-8
                prose-table:my-4"
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={markdownComponents}
                >
                  {readmeContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Install by URL Dialog */}
      <Dialog
        open={installByUrlOpen}
        onOpenChange={(open) => {
          // 关闭时由 DialogContent 自身的 DialogClose 处理；
          // 这里若在加载中不强制关闭，避免请求中按 ESC 留下脏表单
          if (!open && installByUrlLoading) return;
          setInstallByUrlOpen(open);
          if (!open) {
            setInstallByUrlUrl('');
            setInstallByUrlBranch('');
          }
        }}
      >
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              {t('pluginStore.installFromUrlTitle')}
            </DialogTitle>
            <DialogDescription>{t('pluginStore.installFromUrlDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 md:space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="install-url" className="flex items-center gap-1">
                {t('pluginStore.urlLabel')}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="install-url"
                value={installByUrlUrl}
                onChange={(e) => setInstallByUrlUrl(e.target.value)}
                placeholder={t('pluginStore.urlPlaceholder')}
                className="h-9 font-mono text-sm"
                disabled={installByUrlLoading}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">{t('pluginStore.urlProtocolHint')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="install-branch" className="flex items-center gap-2">
                {t('pluginStore.branchLabel')}
                <span className="text-xs text-muted-foreground font-normal">
                  {t('pluginStore.branchOptional')}
                </span>
              </Label>
              <Input
                id="install-branch"
                value={installByUrlBranch}
                onChange={(e) => setInstallByUrlBranch(e.target.value)}
                placeholder={t('pluginStore.branchPlaceholder')}
                className="h-9 font-mono text-sm"
                disabled={installByUrlLoading}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setInstallByUrlOpen(false)}
              disabled={installByUrlLoading}
              className="h-9"
            >
              {t('pluginStore.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={handleInstallByUrl}
              disabled={installByUrlLoading}
              className="h-9 text-primary hover:text-primary [&_svg]:!text-current"
            >
              {installByUrlLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('pluginStore.installing')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t('pluginStore.install')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install by File Dialog：单个 zip，安装中禁止换文件/关闭 */}
      <Dialog
        open={installByFileOpen}
        onOpenChange={(open) => {
          if (!open && installByFileLoading) return;
          setInstallByFileOpen(open);
          if (!open) {
            setInstallByFile(null);
            if (installByFileInputRef.current) {
              installByFileInputRef.current.value = '';
            }
          }
        }}
      >
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5" />
              {t('pluginStore.installFromFileTitle')}
            </DialogTitle>
            <DialogDescription>{t('pluginStore.installFromFileDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <input
              ref={installByFileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => setInstallByFile(e.target.files?.[0] ?? null)}
            />

            <div className="flex w-full justify-center">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-1/2 min-w-[12rem]"
                disabled={installByFileLoading}
                onClick={() => installByFileInputRef.current?.click()}
              >
                <FileUp className="mr-2 w-4 h-4" />
                {t('pluginStore.selectZipFile')}
              </Button>
            </div>

            {installByFile && (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-mono">{installByFile.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(installByFile.size / 1024).toFixed(1)}KB
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">{t('pluginStore.installFromFileHint')}</p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setInstallByFileOpen(false)}
              disabled={installByFileLoading}
              className="h-9"
            >
              {t('pluginStore.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={handleInstallByFile}
              disabled={installByFileLoading || !installByFile}
              className="h-9 text-primary hover:text-primary [&_svg]:!text-current"
            >
              {installByFileLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('pluginStore.installing')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t('pluginStore.install')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GitHub 连接 Dialog（Device Flow：大号验证码 + 打开 GitHub + 后端轮询） */}
      <Dialog open={githubConnectOpen} onOpenChange={setGithubConnectOpen}>
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="w-5 h-5" />
              {t('pluginStore.github.connectTitle')}
            </DialogTitle>
            <DialogDescription>{t('pluginStore.github.connectDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Alert variant="warning" className="p-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-6">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-xs font-bold text-amber-800 dark:text-amber-200">
                {t('pluginStore.github.securityTitle')}
              </AlertTitle>
              <AlertDescription className="mt-1 space-y-1 text-xs leading-snug text-foreground/90">
                <ul className="list-disc space-y-0.5 pl-4">
                  <li>
                    <strong className="font-semibold text-amber-700 dark:text-amber-300">
                      {t('pluginStore.github.securityWhoLabel')}
                    </strong>
                    <span>{t('pluginStore.github.securityWhoText')}</span>
                  </li>
                  <li>
                    <strong className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {t('pluginStore.github.securitySafeLabel')}
                    </strong>
                    <span>{t('pluginStore.github.securitySafeText')}</span>
                  </li>
                  <li>
                    <strong className="font-semibold text-red-600 dark:text-red-400">
                      {t('pluginStore.github.securityDangerLabel')}
                    </strong>
                    <span className="font-medium text-red-700 dark:text-red-300">
                      {t('pluginStore.github.securityDangerText')}
                    </span>
                  </li>
                </ul>
                <p className="font-medium text-muted-foreground">
                  {t('pluginStore.github.securityAnonTip')}
                </p>
              </AlertDescription>
            </Alert>

            {deviceState === 'loading' ? (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('pluginStore.github.loading')}
              </div>
            ) : deviceState === 'waiting' && deviceInfo ? (
              <>
                <div className="space-y-2">
                  <Label>{t('pluginStore.github.codeLabel')}</Label>
                  <div className="flex items-stretch gap-2">
                    <code className="flex h-14 flex-1 items-center justify-center rounded-md bg-muted px-4 font-mono text-2xl font-semibold tracking-widest">
                      {deviceInfo.user_code}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-14 w-14 shrink-0"
                      title={t('pluginStore.github.copy')}
                      onClick={async () => {
                        try {
                          await copyTextToClipboard(deviceInfo.user_code);
                          toast.success(t('pluginStore.github.copied'));
                        } catch {
                          toast.error(t('pluginStore.github.copyFailed'));
                        }
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-primary hover:text-primary [&_svg]:!text-current"
                  onClick={() =>
                    window.open(deviceInfo.verification_uri, '_blank', 'noopener,noreferrer')
                  }
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('pluginStore.github.openGithub')}
                </Button>
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('pluginStore.github.waiting')}
                </p>
              </>
            ) : (
              <div className="space-y-3 py-2 text-center">
                <p className="text-sm text-muted-foreground">
                  {deviceState === 'expired'
                    ? t('pluginStore.github.expired')
                    : t('pluginStore.github.denied')}
                </p>
                <Button variant="outline" className="gap-2" onClick={startGithubConnect}>
                  <RefreshCw className="w-4 h-4" />
                  {t('pluginStore.github.retry')}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 断开 GitHub 连接确认 */}
      <AlertDialog open={githubDisconnectOpen} onOpenChange={setGithubDisconnectOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pluginStore.github.disconnectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pluginStore.github.disconnectDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('pluginStore.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGithubDisconnect}
              className="bg-red-500 hover:bg-red-600"
            >
              {t('pluginStore.github.disconnect')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PinnedPage>
  );
}
