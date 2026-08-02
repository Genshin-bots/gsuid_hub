import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, Search, Package, RefreshCw, Download, Trash2, DownloadCloud, GitBranch, FileText, ExternalLink, Grid3x3, Check, Sparkles, Wrench, Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { pluginStoreApi, StorePlugin, gitMirrorApi, GitPluginInfo, getApiErrorMessage } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import GitMirrorDialog, { getMirrorBadge } from '@/components/GitMirrorDialog';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { PinnedPage } from '@/components/layout/PinnedPage';

// 缓存相关常量
const PLUGIN_CACHE_KEY = 'pluginStore_cache';
const GIT_MIRROR_CACHE_KEY = 'pluginStore_gitMirror_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

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


// 根据 README 中图片 src 拼出 raw URL；处理 main / master 分支回退
const buildRawUrl = (
  owner: string,
  repo: string,
  path: string,
  branch: 'main' | 'master',
  mirror: string,
): string => {
  switch (mirror) {
    case 'cnb':
      return `https://cnb.cool/${owner}/${repo}/-/git/raw/${branch}/${path}`;
    case 'gitcode':
      return `https://raw.gitcode.com/${owner}/${repo}/raw/${branch}/${path}`;
    case 'ghproxy':
      return `https://ghproxy.com/https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    case 'github':
    default:
      return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/${branch}/${path}`;
  }
};

export default function PluginStorePage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [plugins, setPlugins] = useState<StorePlugin[]>([]);
  const [funPlugins, setFunPlugins] = useState<string[]>([]);
  const [toolPlugins, setToolPlugins] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // 判断插件是否为"停止维护"
  const isDeprecated = (plugin: StorePlugin) => {
    return plugin.type === 'danger' && plugin.content === t('pluginStore.deprecated');
  };

  // 使用 ref 避免重建 components 对象时造成不必要的重渲染，
  // 同时让 img 组件可以访问当前打开的插件与镜像信息
  const selectedPluginRef = useRef<StorePlugin | null>(null);
  const gitPluginsMapRef = useRef<Record<string, GitPluginInfo>>({});
  selectedPluginRef.current = selectedPlugin;
  gitPluginsMapRef.current = gitPluginsMap;

  // 根据当前打开的插件与镜像信息构造 react-markdown components
  // 其中 img 会将 README 内的相对路径（如 ./ICON.png）转换为对应镜像的 raw URL
  const markdownComponents: Components = useMemo(() => ({
    pre: ({ children }) => (
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono">
        {children}
      </pre>
    ),
    code: ({ className, children, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground" {...props}>
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
    thead: ({ children }) => (
      <thead className="bg-muted/50">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-sm font-semibold text-foreground">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-sm text-foreground/90">{children}</td>
    ),
    tr: ({ children }) => (
      <tr className="even:bg-muted/30">{children}</tr>
    ),
    img: ({ src, alt, ...props }) => {
      const srcStr = typeof src === 'string' ? src : '';
      const plugin = selectedPluginRef.current;
      const gitInfo = plugin ? gitPluginsMapRef.current[plugin.id.toLowerCase()] : undefined;
      const remoteUrl = gitInfo?.remote_url || plugin?.link || (plugin ? `https://github.com/${plugin.id}` : '');

      let resolved = srcStr;
      // 仅处理相对路径（不带协议 / 非 data URI）
      if (srcStr && !/^(https?:)?\/\//i.test(srcStr) && !srcStr.startsWith('data:')) {
        const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
        if (match) {
          const [, owner, repo] = match;
          const mirror = gitInfo?.mirror || 'github';
          const path = srcStr.replace(/^\.?\//, '');
          // 默认走 main 分支；若加载失败会回退到 master
          resolved = buildRawUrl(owner, repo, path, 'main', mirror);
          // 通过 dataset 携带 master 回退信息
          return (
            <img
              src={resolved}
              alt={alt || ''}
              data-fallback-master={buildRawUrl(owner, repo, path, 'master', mirror)}
              data-asset-resolved="1"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.dataset.fallbackTried !== '1') {
                  target.dataset.fallbackTried = '1';
                  target.src = target.dataset.fallbackMaster || target.src;
                }
              }}
              {...props}
            />
          );
        }
      }

      return <img src={resolved} alt={alt || ''} {...props} />;
    },
  }), []);

  // Fetch plugin list（支持缓存）
  const fetchPlugins = async (forceRefresh = false) => {
    // 尝试从缓存加载
    if (!forceRefresh) {
      const cached = getCachedData<{ plugins: StorePlugin[]; fun_plugins: string[]; tool_plugins: string[] }>(PLUGIN_CACHE_KEY);
      if (cached) {
        const pluginsWithCategory = cached.plugins.map(plugin => ({
          ...plugin,
          isFun: cached.fun_plugins?.includes(plugin.id) || false,
          isTool: cached.tool_plugins?.includes(plugin.id) || false,
        }));
        setPlugins(pluginsWithCategory);
        setFunPlugins(cached.fun_plugins || []);
        setToolPlugins(cached.tool_plugins || []);
        setIsLoading(false);
        return;
      }
    }

    try {
      setIsLoading(true);
      const data = await pluginStoreApi.getPluginList();
      // 处理返回数据，标记娱乐插件和工具插件
      const pluginsWithCategory = data.plugins.map(plugin => ({
        ...plugin,
        isFun: data.fun_plugins?.includes(plugin.id) || false,
        isTool: data.tool_plugins?.includes(plugin.id) || false,
      }));
      setPlugins(pluginsWithCategory);
      setFunPlugins(data.fun_plugins || []);
      setToolPlugins(data.tool_plugins || []);
      // 写入缓存
      setCachedData(PLUGIN_CACHE_KEY, data);
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
      const data = await gitMirrorApi.getInfo();
      const map: Record<string, GitPluginInfo> = {};
      data.plugins.forEach(p => {
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

  useEffect(() => {
    fetchPlugins();
    fetchGitMirrorInfo();
  }, []);

  // Handle install plugin - 直接更新本地状态，不重新请求 API
  const handleInstall = async (pluginId: string) => {
    try {
      setActionLoading(pluginId);
      await pluginStoreApi.installPlugin(pluginId);
      toast.success(t('pluginStore.installSuccess'));
      // 直接更新本地状态，避免触发后端重新加载
      setPlugins(prev => prev.map(p =>
        p.id === pluginId ? { ...p, installed: true, hasUpdate: false } : p
      ));
      // 清除缓存，确保下次进入页面数据一致
      localStorage.removeItem(PLUGIN_CACHE_KEY);
      localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
    } catch (error) {
      toast.error(t('pluginStore.installError'));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle update plugin - 直接更新本地状态，不重新请求 API
  const handleUpdate = async (pluginId: string) => {
    try {
      setActionLoading(pluginId);
      await pluginStoreApi.updatePlugin(pluginId);
      toast.success(t('pluginStore.updateSuccess'));
      // 直接更新本地状态，避免触发后端重新加载
      setPlugins(prev => prev.map(p =>
        p.id === pluginId ? { ...p, hasUpdate: false } : p
      ));
      // 清除缓存，确保下次进入页面数据一致
      localStorage.removeItem(PLUGIN_CACHE_KEY);
    } catch (error) {
      toast.error(t('pluginStore.updateError'));
    } finally {
      setActionLoading(null);
    }
  };

  // Handle uninstall plugin - 直接更新本地状态，不重新请求 API
  const handleUninstall = async (pluginId: string) => {
    if (confirm(t('pluginStore.uninstallConfirm') + ' "' + plugins.find(p => p.id === pluginId)?.name + '" ' + t('pluginStore.confirmUninstall'))) {
      try {
        setActionLoading(pluginId);
        await pluginStoreApi.uninstallPlugin(pluginId);
        toast.success(t('pluginStore.uninstallSuccess'));
        // 直接更新本地状态，避免触发后端重新加载
        setPlugins(prev => prev.map(p =>
          p.id === pluginId ? { ...p, installed: false, hasUpdate: false } : p
        ));
        // 清除缓存，确保下次进入页面数据一致
        localStorage.removeItem(PLUGIN_CACHE_KEY);
        localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
      } catch (error) {
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
      const parsed = url.startsWith('git@')
        ? new URL(`https://${url}`)
        : new URL(url);
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
        localStorage.removeItem(PLUGIN_CACHE_KEY);
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

  // Filter plugins based on tab and search
  const filteredPlugins = useMemo(() => {
    let filtered = [...plugins];

    // Filter by tab
    if (activeTab === 'installed') {
      filtered = filtered.filter(p => p.installed);
    } else if (activeTab === 'updates') {
      filtered = filtered.filter(p => p.hasUpdate);
    } else if (activeTab === 'fun') {
      filtered = filtered.filter(p => p.isFun);
    } else if (activeTab === 'tool') {
      filtered = filtered.filter(p => p.isTool);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p => p.id.toLowerCase().includes(query) ||
             p.description.toLowerCase().includes(query) ||
             p.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort: deprecated plugins at the bottom
    filtered.sort((a, b) => {
      const aDeprecated = isDeprecated(a);
      const bDeprecated = isDeprecated(b);
      if (aDeprecated && !bDeprecated) return 1;
      if (!aDeprecated && bDeprecated) return -1;
      return 0;
    });

    return filtered;
  }, [plugins, activeTab, searchQuery]);

  // Build README URLs based on mirror type
  const buildReadmeUrls = (plugin: StorePlugin): string[] => {
    const gitInfo = gitPluginsMap[plugin.id.toLowerCase()];
    const mirror = gitInfo?.mirror || 'github';
    const remoteUrl = gitInfo?.remote_url || plugin.link || `https://github.com/${plugin.id}`;
    
    // Extract owner and repo from remote URL
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) {
      // Fallback if URL parsing fails
      return [`${remoteUrl}/raw/main/README.md`, `${remoteUrl}/raw/master/README.md`];
    }
    const [, owner, repo] = match;
    
    const urls: string[] = [];
    
    switch (mirror) {
      case 'cnb':
        // cnb.cool format: https://cnb.cool/gscore-mirror/StarRailUID/-/git/raw/master/README.md
        urls.push(`https://cnb.cool/${owner}/${repo}/-/git/raw/master/README.md`);
        urls.push(`https://cnb.cool/${owner}/${repo}/-/git/raw/main/README.md`);
        break;
      case 'gitcode':
        // gitcode.com format: https://raw.gitcode.com/gscore-mirror/StarRailUID/raw/master/README.md
        urls.push(`https://raw.gitcode.com/${owner}/${repo}/raw/master/README.md`);
        urls.push(`https://raw.gitcode.com/${owner}/${repo}/raw/main/README.md`);
        break;
      case 'ghproxy':
        // ghproxy.com format
        urls.push(`https://ghproxy.com/https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`);
        urls.push(`https://ghproxy.com/https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`);
        break;
      case 'github':
      default:
        // Direct raw.githubusercontent.com format
        urls.push(`https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/master/README.md`);
        urls.push(`https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/README.md`);
        break;
    }
    
    return urls;
  };

  // Handle card click to show README
  const handleCardClick = async (plugin: StorePlugin) => {
    setSelectedPlugin(plugin);
    setReadmeDialogOpen(true);
    setReadmeLoading(true);
    setReadmeContent('');

    try {
      const urls = buildReadmeUrls(plugin);
      
      for (const url of urls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const text = await response.text();
            setReadmeContent(text);
            return;
          }
        } catch {
          // Try next URL
          continue;
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

  // Tab options for TabButtonGroup
  const tabOptions = [
    { value: 'all', label: t('pluginStore.allPlugins'), icon: <Grid3x3 className="w-4 h-4" /> },
    { value: 'installed', label: t('pluginStore.installed'), icon: <Check className="w-4 h-4" /> },
    { value: 'updates', label: t('pluginStore.updates'), icon: <RefreshCw className="w-4 h-4" /> },
    { value: 'fun', label: t('pluginStore.funPlugins'), icon: <Sparkles className="w-4 h-4" /> },
    { value: 'tool', label: t('pluginStore.toolPlugins'), icon: <Wrench className="w-4 h-4" /> },
  ];

  return (
    <PinnedPage
      header={
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Store className="w-8 h-8" />
              {t('pluginStore.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('pluginStore.description')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setGitMirrorOpen(true)}
              className="gap-2"
            >
              <GitBranch className="w-4 h-4" />
              {t('gitMirror.title')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setInstallByUrlOpen(true)}
              className="gap-2"
            >
              <Link2 className="w-4 h-4" />
              {t('pluginStore.installFromUrl')}
            </Button>
            <Button
              variant="outline"
              onClick={() => { fetchPlugins(true); fetchGitMirrorInfo(true); }}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('pluginStore.refresh')}
            </Button>
          </div>
        </div>
      }
      toolbar={
        /* 搜索 + 分类切换：两者原本是 space-y-6 的兄弟，用 space-y-6 保持同样行距 */
        <div className="space-y-6">
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('pluginStore.searchPlugin')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <TabButtonGroup
            options={tabOptions}
            value={activeTab}
            onValueChange={setActiveTab}
          />
        </div>
      }
    >
      <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
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
          ) : filteredPlugins.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="mb-2">
                  {searchQuery ? t('pluginStore.noMatchedPlugins') :
                   activeTab === 'installed' ? t('pluginStore.noInstalledPlugins') :
                   activeTab === 'updates' ? t('pluginStore.allPluginsUpdated') :
                   activeTab === 'fun' ? t('pluginStore.noFunPlugins') :
                   activeTab === 'tool' ? t('pluginStore.noToolPlugins') :
                   t('pluginStore.noPlugins')}
                </p>
                {searchQuery && (
                  <p className="text-sm">{t('pluginStore.adjustSearchKeywords')}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPlugins.map((plugin) => {
                const deprecated = isDeprecated(plugin);
                const pluginLink = plugin.link || `https://github.com/${plugin.id}`;
                
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
                          {/* Cover - 可点击跳转github */}
                          <a
                            href={pluginLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {plugin.cover ? (
                              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border shadow-md bg-background">
                                <img
                                  src={plugin.cover}
                                  alt={plugin.id}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-border shadow-md">
                                <Package className="w-7 h-7 text-muted-foreground/50" />
                              </div>
                            )}
                          </a>
                          
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
                          {/* 标题行 + 右上角 badges */}
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-base truncate">{plugin.id}</h3>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* 镜像来源 badge（仅已安装插件） */}
                              {plugin.installed && (() => {
                                const gitInfo = gitPluginsMap[plugin.id.toLowerCase()];
                                if (gitInfo && gitInfo.is_git_repo && gitInfo.remote_url) {
                                  const badge = getMirrorBadge(gitInfo.mirror, gitInfo.remote_url, t);
                                  return (
                                    <Badge variant="outline" className={`text-xs ${badge.className}`}>
                                      <span className="flex items-center gap-1">{badge.icon}{badge.label}</span>
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                              {plugin.isFun && (
                                <Badge variant="outline" className="text-xs text-blue-500 border-blue-500">{t('pluginStore.fun')}</Badge>
                              )}
                              {plugin.isTool && (
                                <Badge variant="outline" className="text-xs text-green-500 border-green-500">{t('pluginStore.tool')}</Badge>
                              )}
                              {deprecated && (
                                <Badge variant="secondary" className="text-xs bg-gray-500 text-white">
                                  {t('pluginStore.deprecated')}
                                </Badge>
                              )}
                              {plugin.type === 'danger' && !deprecated && (
                                <Badge variant="destructive" className="text-xs">{plugin.content}</Badge>
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
                          <p className="text-sm text-muted-foreground mt-1 truncate" title={plugin.info || plugin.description}>
                            {plugin.info || plugin.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tags 横向排布 */}
                    <div className="px-4 pb-2">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {plugin.hasUpdate && (
                          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
                            {t('pluginStore.canUpdate')}
                          </Badge>
                        )}
                        {plugin.alias?.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    
                    {/* 按钮区域 */}
                    <CardFooter className="pt-2 mt-auto">
                      {deprecated ? (
                        <Button
                          className="w-full gap-1 text-sm"
                          disabled={true}
                          variant="secondary"
                        >
                          <Package className="w-3 h-3" />
                          {t('pluginStore.stopMaintenance')}
                        </Button>
                      ) : plugin.installed ? (
                        <div className="flex gap-1.5 w-full">
                          <Button
                            size="sm"
                            className="flex-1 gap-1 text-xs"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUninstall(plugin.id);
                            }}
                            disabled={actionLoading === plugin.id}
                          >
                            {actionLoading === plugin.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            {t('pluginStore.uninstall')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1 text-xs"
                            asChild
                          >
                            <a
                              href={pluginLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DownloadCloud className="w-3 h-3" />
                              {t('pluginStore.details')}
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5 w-full">
                          <Button
                            size="sm"
                            className="flex-1 gap-1 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInstall(plugin.id);
                            }}
                            disabled={actionLoading === plugin.id}
                          >
                            {actionLoading === plugin.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            {t('pluginStore.install')}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1 text-xs"
                            asChild
                          >
                            <a
                              href={pluginLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DownloadCloud className="w-3 h-3" />
                              {t('pluginStore.details')}
                            </a>
                          </Button>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

      <GitMirrorDialog
        open={gitMirrorOpen}
        onOpenChange={setGitMirrorOpen}
      />

      {/* README Dialog */}
      <Dialog open={readmeDialogOpen} onOpenChange={setReadmeDialogOpen}>
        <DialogContent className="w-[90vw] max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
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
              {selectedPlugin && (
                <a
                  href={selectedPlugin.link || `https://github.com/${selectedPlugin.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>GitHub</span>
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
            {readmeLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none
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
                prose-table:my-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
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
            <DialogDescription>
              {t('pluginStore.installFromUrlDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
              <p className="text-xs text-muted-foreground">
                {t('pluginStore.urlProtocolHint')}
              </p>
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
              onClick={handleInstallByUrl}
              disabled={installByUrlLoading}
              className="h-9"
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
    </PinnedPage>
  );
}
