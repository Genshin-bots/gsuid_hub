import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, Search, Package, RefreshCw, Download, Trash2, Star, User, DownloadCloud, GitBranch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { pluginStoreApi, StorePlugin, gitMirrorApi, GitPluginInfo } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import GitMirrorDialog, { getMirrorBadge } from '@/components/GitMirrorDialog';

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

export default function PluginStorePage() {
  const { toast } = useToast();
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

  // 判断插件是否为"停止维护"
  const isDeprecated = (plugin: StorePlugin) => {
    return plugin.type === 'danger' && plugin.content === t('pluginStore.deprecated');
  };

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
      toast({
        title: t('pluginStore.loadFailed'),
        description: t('pluginStore.loadPluginListFailed'),
        variant: 'destructive'
      });
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
      toast({ title: t('pluginStore.installSuccess'), description: t('pluginStore.installSuccess') });
      // 直接更新本地状态，避免触发后端重新加载
      setPlugins(prev => prev.map(p =>
        p.id === pluginId ? { ...p, installed: true, hasUpdate: false } : p
      ));
      // 清除缓存，确保下次进入页面数据一致
      localStorage.removeItem(PLUGIN_CACHE_KEY);
      localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
    } catch (error) {
      toast({
        title: t('pluginStore.installFailed'),
        description: t('pluginStore.installError'),
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle update plugin - 直接更新本地状态，不重新请求 API
  const handleUpdate = async (pluginId: string) => {
    try {
      setActionLoading(pluginId);
      await pluginStoreApi.updatePlugin(pluginId);
      toast({ title: t('pluginStore.updateSuccess'), description: t('pluginStore.updateSuccess') });
      // 直接更新本地状态，避免触发后端重新加载
      setPlugins(prev => prev.map(p =>
        p.id === pluginId ? { ...p, hasUpdate: false } : p
      ));
      // 清除缓存，确保下次进入页面数据一致
      localStorage.removeItem(PLUGIN_CACHE_KEY);
    } catch (error) {
      toast({
        title: t('pluginStore.updateFailed'),
        description: t('pluginStore.updateError'),
        variant: 'destructive'
      });
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
        toast({ title: t('pluginStore.uninstallSuccess'), description: t('pluginStore.uninstallSuccess') });
        // 直接更新本地状态，避免触发后端重新加载
        setPlugins(prev => prev.map(p =>
          p.id === pluginId ? { ...p, installed: false, hasUpdate: false } : p
        ));
        // 清除缓存，确保下次进入页面数据一致
        localStorage.removeItem(PLUGIN_CACHE_KEY);
        localStorage.removeItem(GIT_MIRROR_CACHE_KEY);
      } catch (error) {
        toast({
          title: t('pluginStore.uninstallFailed'),
          description: t('pluginStore.uninstallError'),
          variant: 'destructive'
        });
      } finally {
        setActionLoading(null);
      }
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

  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
            onClick={() => { fetchPlugins(true); fetchGitMirrorInfo(true); }}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('pluginStore.refresh')}
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('pluginStore.searchPlugin')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="all">{t('pluginStore.allPlugins')}</TabsTrigger>
          <TabsTrigger value="installed">{t('pluginStore.installed')}</TabsTrigger>
          <TabsTrigger value="updates">{t('pluginStore.updates')}</TabsTrigger>
          <TabsTrigger value="fun">{t('pluginStore.funPlugins')}</TabsTrigger>
          <TabsTrigger value="tool">{t('pluginStore.toolPlugins')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <Card key={i} className="glass-card overflow-hidden">
                  <div className="h-32 bg-muted/50">
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
                    className={`glass-card flex flex-col overflow-hidden ${deprecated ? 'opacity-60' : ''} ${plugin.installed ? 'ring-1 ring-green-500/30' : ''}`}
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
                        <Button
                          size="sm"
                          className="w-full gap-1 text-xs"
                          variant="destructive"
                          onClick={() => handleUninstall(plugin.id)}
                          disabled={actionLoading === plugin.id}
                        >
                          <Trash2 className="w-3 h-3" />
                          {t('pluginStore.uninstall')}
                        </Button>
                      ) : (
                        <div className="flex gap-1.5 w-full">
                          <Button
                            size="sm"
                            className="flex-1 gap-1 text-xs"
                            onClick={() => handleInstall(plugin.id)}
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
        </TabsContent>
      </Tabs>

      <GitMirrorDialog
        open={gitMirrorOpen}
        onOpenChange={setGitMirrorOpen}
      />
    </div>
  );
}
