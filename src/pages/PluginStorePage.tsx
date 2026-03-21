import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Store, Search, Package, RefreshCw, Download, Trash2, Star, User, DownloadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { pluginStoreApi, StorePlugin } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

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

  // 判断插件是否为"停止维护"
  const isDeprecated = (plugin: StorePlugin) => {
    return plugin.type === 'danger' && plugin.content === t('pluginStore.deprecated');
  };

  // Fetch plugin list
  const fetchPlugins = async () => {
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

  useEffect(() => {
    fetchPlugins();
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
            onClick={fetchPlugins}
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
                    className={`glass-card flex flex-col overflow-hidden ${deprecated ? 'opacity-60' : ''}`}
                  >
                    {/* 新的卡片布局：cover在左上角，avatar在cover右下角 */}
                    <div className="p-4 pb-2">
                      <div className="flex gap-3 relative">
                        {/* Cover - 可点击跳转github */}
                        <a
                          href={pluginLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 block"
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
                        
                        {/* Avatar 覆盖在 cover 右下角 */}
                        {plugin.avatar && (
                          <div className="absolute -bottom-1 -right-1">
                            <div className="w-5 h-5 rounded-full border-2 border-background overflow-hidden bg-background shadow-sm">
                              <img
                                src={plugin.avatar}
                                alt={plugin.author}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* 右侧：标题和描述 */}
                        <div className="flex-1 min-w-0">
                          {/* 标题区域 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base truncate">{plugin.id}</h3>
                            {deprecated && (
                              <Badge variant="secondary" className="text-xs bg-gray-500 text-white flex-shrink-0">
                                {t('pluginStore.deprecated')}
                              </Badge>
                            )}
                            {plugin.type === 'danger' && !deprecated && (
                              <Badge variant="destructive" className="text-xs flex-shrink-0">{plugin.content}</Badge>
                            )}
                          </div>
                          
                          {/* 作者信息 */}
                          {plugin.author && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              by {plugin.author}
                            </p>
                          )}
                          
                          {/* 描述 */}
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {plugin.info || plugin.description}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tags 横向排布 */}
                    <div className="px-4 pb-2">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {plugin.installed && (
                          <Badge variant="secondary" className="text-xs bg-green-600/20 text-green-600 border-green-600/30">
                            {t('pluginStore.installedBadge')}
                          </Badge>
                        )}
                        {plugin.hasUpdate && (
                          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
                            {t('pluginStore.canUpdate')}
                          </Badge>
                        )}
                        {plugin.isFun && (
                          <Badge variant="outline" className="text-xs text-blue-500 border-blue-500">{t('pluginStore.fun')}</Badge>
                        )}
                        {plugin.isTool && (
                          <Badge variant="outline" className="text-xs text-green-500 border-green-500">{t('pluginStore.tool')}</Badge>
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
                            onClick={() => handleUpdate(plugin.id)}
                            disabled={actionLoading === plugin.id || !plugin.hasUpdate}
                            variant={plugin.hasUpdate ? "default" : "secondary"}
                          >
                            {actionLoading === plugin.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            {plugin.hasUpdate ? t('pluginStore.update') : t('pluginStore.latest')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1 gap-1 text-xs"
                            onClick={() => handleUninstall(plugin.id)}
                            disabled={actionLoading === plugin.id}
                          >
                            <Trash2 className="w-3 h-3" />
                            {t('pluginStore.uninstall')}
                          </Button>
                        </div>
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
    </div>
  );
}
