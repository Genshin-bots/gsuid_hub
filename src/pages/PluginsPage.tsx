import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Settings, Loader2, ChevronDown, Save, Server, Cog, LayoutGrid, Users, Shield, Filter, Zap, MessageSquare, Key } from 'lucide-react';
import { ConfigField, ConfigFieldDefinition, ConfigValue, ConfigFieldType } from '@/components/config';
import { pluginsApi, Plugin, ServiceConfig, SvItem, PluginConfigItem, PluginConfigGroup, PluginListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

// Convert API plugin to local plugin type
const convertToPlugin = (plugin: Plugin): any => {
  const processConfig = (configData: Record<string, any>) => {
    const converted: Record<string, ConfigFieldDefinition> = {};
    for (const [key, value] of Object.entries(configData || {})) {
      const configItem = value as PluginConfigItem;
      let type: ConfigFieldType = 'text';
      const rawType = configItem.type?.toLowerCase() || '';

      if (rawType.includes('bool')) type = 'boolean';
      else if (rawType.includes('int')) type = 'number';
      else if (rawType.includes('list') || rawType.includes('array')) type = configItem.options ? 'multiselect' : 'tags';
      else if (rawType.includes('gstimer')) type = 'time';
      else if (rawType.includes('time') || rawType.includes('date')) type = 'date';
      else if (rawType.includes('str') || rawType.includes('string')) type = configItem.options ? 'select' : 'text';
      else if (rawType.includes('dict') || rawType.includes('object')) {
        type = 'text';
        if (typeof configItem.value === 'object' && configItem.value !== null) {
          configItem.value = JSON.stringify(configItem.value, null, 2);
        }
      } else if (rawType.includes('image')) type = 'image';

      converted[key] = {
        value: configItem.value as ConfigValue,
        default: configItem.default,
        type,
        label: configItem.title || key,
        placeholder: configItem.desc || '请输入内容',
        options: configItem.options,
        description: configItem.desc || key,
        required: false,
        disabled: false,
        rawType: configItem.type,
      } as unknown as ConfigFieldDefinition;
    }
    return converted;
  };

  const config = processConfig(plugin.config || {});
  const config_groups = plugin.config_groups?.map(group => ({
    ...group,
    config: processConfig(group.config)
  }));

  return { ...plugin, config, config_groups } as unknown as Plugin;
};

export default function PluginsPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const [pluginList, setPluginList] = useState<PluginListItem[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPluginId, setSelectedPluginId] = useState<string>('');
  const [selectedConfigName, setSelectedConfigName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isSavingService, setIsSavingService] = useState(false);

  // Track original state for change detection
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [originalServiceConfig, setOriginalServiceConfig] = useState<ServiceConfig | null>(null);
  const [originalSvList, setOriginalSvList] = useState<SvItem[]>([]);

  // Edited state
  const [editedServiceConfig, setEditedServiceConfig] = useState<Partial<ServiceConfig>>({});
  const [editedSvList, setEditedSvList] = useState<SvItem[]>([]);
  const [originalEnabled, setOriginalEnabled] = useState<boolean>(true);
  const [editedEnabled, setEditedEnabled] = useState<boolean>(true);

  const selectedPlugin = plugins.find((p) => p.id === selectedPluginId);

  const isConfigDirty = useMemo(() => {
    if (!selectedPlugin || !originalConfig) return false;
    const configChanged = JSON.stringify(selectedPlugin.config) !== JSON.stringify(originalConfig.config);
    const groupsChanged = JSON.stringify(selectedPlugin.config_groups) !== JSON.stringify(originalConfig.groups);
    return configChanged || groupsChanged;
  }, [selectedPlugin, originalConfig]);

  const isServiceDirty = useMemo(() => {
    const serviceChanged = JSON.stringify(editedServiceConfig) !== JSON.stringify(originalServiceConfig);
    const svListChanged = JSON.stringify(editedSvList) !== JSON.stringify(originalSvList);
    const enabledChanged = editedEnabled !== originalEnabled;
    return serviceChanged || svListChanged || enabledChanged;
  }, [editedServiceConfig, originalServiceConfig, editedSvList, originalSvList, editedEnabled, originalEnabled]);

  // 过滤空字符串的辅助函数
  const filterEmptyPrefix = (prefix: string[] | undefined): string[] => {
    if (!Array.isArray(prefix)) return [];
    return prefix.filter(item => item !== '');
  };

  // Fetch plugin list (lightweight)
  const fetchPluginList = async () => {
    try {
      setIsLoading(true);
      const data = await pluginsApi.getPluginList();
      setPluginList(data);
      
      // If has plugins and none selected, select first
      if (data.length > 0 && !selectedPluginId) {
        setSelectedPluginId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch plugin list:', error);
      toast({
        title: t('plugins.loadFailed'),
        description: t('plugins.loadPluginListFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch plugin detail for a specific plugin
  const fetchPluginDetail = async (pluginName: string) => {
    try {
      setIsLoadingDetail(true);
      const data = await pluginsApi.getPlugin(pluginName);
      const converted = convertToPlugin(data);
      
      setPlugins(prev => {
        // Remove existing plugin with same id if exists, then add new one
        const filtered = prev.filter(p => p.id !== converted.id);
        return [...filtered, converted];
      });
      
      // If this is the selected plugin, set original config
      if (data.id === selectedPluginId) {
        setOriginalConfig({
          config: JSON.parse(JSON.stringify(converted.config)),
          groups: JSON.parse(JSON.stringify(converted.config_groups || []))
        });
        
        const processedServiceConfig = converted.service_config ? {
          ...converted.service_config,
          prefix: filterEmptyPrefix(converted.service_config.prefix)
        } : null;
        
        setOriginalServiceConfig(JSON.parse(JSON.stringify(processedServiceConfig)));
        setOriginalSvList(JSON.parse(JSON.stringify(converted.sv_list || [])));
        setEditedServiceConfig({
          ...(processedServiceConfig || {}),
          enabled: converted.enabled ?? true
        });
        setEditedSvList(JSON.parse(JSON.stringify(converted.sv_list || [])));
        setOriginalEnabled(converted.enabled ?? true);
        setEditedEnabled(converted.enabled ?? true);

        if (converted.config_names && converted.config_names.length > 0) {
          setSelectedConfigName(converted.config_names[0]);
        } else {
          setSelectedConfigName(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch plugin detail:', error);
      toast({
        title: t('plugins.loadFailed'),
        description: t('plugins.loadPluginDetailFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchPluginList();
  }, []);

  // Fetch detail when selected plugin changes
  useEffect(() => {
    if (selectedPluginId) {
      // Check if we already have the detail for this plugin
      const existingPlugin = plugins.find(p => p.id === selectedPluginId);
      if (!existingPlugin) {
        // Need to fetch detail for this plugin
        const pluginInfo = pluginList.find(p => p.id === selectedPluginId);
        if (pluginInfo) {
          fetchPluginDetail(pluginInfo.name);
        }
      }
    }
  }, [selectedPluginId, pluginList, plugins]);

  // Update original state when selected plugin detail changes
  useEffect(() => {
    if (selectedPlugin) {
      setOriginalConfig({
        config: JSON.parse(JSON.stringify(selectedPlugin.config)),
        groups: JSON.parse(JSON.stringify(selectedPlugin.config_groups || []))
      });
      
      const processedServiceConfig = selectedPlugin.service_config ? {
        ...selectedPlugin.service_config,
        prefix: filterEmptyPrefix(selectedPlugin.service_config.prefix)
      } : null;
      
      setOriginalServiceConfig(JSON.parse(JSON.stringify(processedServiceConfig)));
      setOriginalSvList(JSON.parse(JSON.stringify(selectedPlugin.sv_list || [])));
      setEditedServiceConfig({
        ...(processedServiceConfig || {}),
        enabled: selectedPlugin.enabled ?? true
      });
      setEditedSvList(JSON.parse(JSON.stringify(selectedPlugin.sv_list || [])));
      setOriginalEnabled(selectedPlugin.enabled ?? true);
      setEditedEnabled(selectedPlugin.enabled ?? true);

      if (selectedPlugin.config_names && selectedPlugin.config_names.length > 0) {
        if (!selectedConfigName || !selectedPlugin.config_names.includes(selectedConfigName)) {
          setSelectedConfigName(selectedPlugin.config_names[0]);
        }
      } else {
        setSelectedConfigName(null);
      }
    }
  }, [selectedPlugin?.id]);

  const updateConfigValue = useCallback((pluginId: string, fieldKey: string, value: ConfigValue, groupName: string | null) => {
    setPlugins((prev) =>
      prev.map((p) => {
        if (p.id !== pluginId) return p;

        const newPlugin = { ...p };
        if (groupName && newPlugin.config_groups) {
          newPlugin.config_groups = newPlugin.config_groups.map(g => {
            if (g.config_name === groupName) {
              return {
                ...g,
                config: {
                  ...g.config,
                  [fieldKey]: { ...g.config[fieldKey], value }
                }
              };
            }
            return g;
          });
        } else if (newPlugin.config) {
          newPlugin.config = {
            ...newPlugin.config,
            [fieldKey]: { ...newPlugin.config[fieldKey], value }
          };
        }
        return newPlugin;
      })
    );
  }, []);

  const handleSaveConfig = async () => {
    if (!selectedPlugin) return;
    setIsSavingConfig(true);
    try {
      let payload: any = {};
      if (selectedPlugin.config_groups && selectedPlugin.config_groups.length > 0) {
        payload = {
          config_groups: selectedPlugin.config_groups.map(g => ({
            config_name: g.config_name,
            config: Object.fromEntries(
              Object.entries(g.config).map(([k, v]) => [k, v.value])
            )
          }))
        };
      } else {
        payload = Object.fromEntries(
          Object.entries(selectedPlugin.config).map(([k, v]) => [k, v.value])
        );
      }
      await pluginsApi.updatePlugin(selectedPlugin.name, payload);

      setOriginalConfig({
        config: JSON.parse(JSON.stringify(selectedPlugin.config)),
        groups: JSON.parse(JSON.stringify(selectedPlugin.config_groups || []))
      });
      toast({ title: t('plugins.saveSuccess'), description: t('plugins.pluginConfigUpdated') });
    } catch (error) {
      toast({
        title: t('plugins.saveFailed'),
        description: t('plugins.updatePluginConfigFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveService = async () => {
    if (!selectedPlugin) return;
    setIsSavingService(true);
    try {
      // 保存服务配置（包含 enabled 状态），过滤掉prefix中的空字符串
      const servicePayload = {
        ...editedServiceConfig,
        enabled: editedEnabled,
        prefix: filterEmptyPrefix(editedServiceConfig.prefix)
      };
      await pluginsApi.updateServiceConfig(selectedPlugin.name, servicePayload as Record<string, unknown>);

      // 保存 SV 配置
      for (const sv of editedSvList) {
        await pluginsApi.updateSvConfig(selectedPlugin.name, sv.name, sv as unknown as Record<string, unknown>);
      }

      setOriginalServiceConfig(JSON.parse(JSON.stringify({
        ...editedServiceConfig,
        prefix: filterEmptyPrefix(editedServiceConfig.prefix)
      })));
      setOriginalSvList(JSON.parse(JSON.stringify(editedSvList)));
      setOriginalEnabled(editedEnabled);

      toast({ title: t('plugins.saveSuccess'), description: t('plugins.serviceConfigUpdated') });
    } catch (error) {
      toast({
        title: t('plugins.saveFailed'),
        description: t('plugins.updateServiceConfigFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsSavingService(false);
    }
  };

  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('plugins.title')}</h1>
            <p className="text-muted-foreground">{t('plugins.description')}</p>
          </div>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <LayoutGrid className="w-4 h-4" />
              <span>{t('plugins.pluginSelection')}</span>
            </div>
            <div className="flex-1 w-full">
              <Select
                value={selectedPluginId}
                onValueChange={setSelectedPluginId}
              >
                <SelectTrigger className="w-full sm:w-[300px] bg-background/50">
                  <SelectValue placeholder={t('plugins.selectPlugin')} />
                </SelectTrigger>
                <SelectContent>
                  {pluginList.map((plugin) => (
                    <SelectItem key={plugin.id} value={plugin.id}>
                      <div className="flex items-center gap-2">
                        {plugin.icon ? (
                          <img src={plugin.icon} className="w-4 h-4 rounded-sm" alt="" />
                        ) : (
                          <Cog className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span>{plugin.name}</span>
                        {!plugin.enabled && (
                          <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1">{t('plugins.pluginDisabled')}</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading || isLoadingDetail ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">{t('plugins.loadingPluginConfig')}</p>
          </CardContent>
        </Card>
      ) : selectedPlugin ? (
        <Card key={selectedPlugin.id} className="glass-card">
          <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                {selectedPlugin.icon ? (
                  <img src={selectedPlugin.icon} className="w-10 h-10 object-contain" alt="" />
                ) : (
                  <Settings className="w-6 h-6 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold">{selectedPlugin.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedPlugin.description}</p>
              </div>
            </div>
          </div>

          <CardContent className="pt-0 space-y-6">
            <Separator />

            {/* 服务配置区域 - 重新设计为与Core配置一致的风格 */}
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between mb-6 cursor-pointer hover:opacity-80 transition-opacity bg-background/50 rounded-xl p-4 border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Server className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{t('plugins.serviceConfig')}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{t('plugins.serviceConfigDesc')}</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {/* Plugin服务配置 - 独立可折叠 */}
                <Collapsible defaultOpen={true}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between mb-6 cursor-pointer hover:opacity-80 transition-opacity bg-muted/30 rounded-lg p-3 border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Server className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold">{t('plugins.pluginServiceConfig')}</h4>
                          <p className="text-muted-foreground text-sm">{t('plugins.pluginServiceConfigDesc')}</p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                {/* 插件状态 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    {t('plugins.pluginStatus')}
                  </Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editedEnabled}
                      onCheckedChange={(checked) => setEditedEnabled(checked)}
                    />
                    <span className="text-sm text-muted-foreground">{editedEnabled ? t('plugins.enabled') : t('plugins.disabled')}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {t('plugins.permissionLevel')}
                  </Label>
                  <Select
                    value={String(editedServiceConfig.pm || 0)}
                    onValueChange={(v) => setEditedServiceConfig(prev => ({ ...prev, pm: parseInt(v) }))}
                  >
                    <SelectTrigger className="bg-background h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(v => (
                        <SelectItem key={v} value={String(v)}>{t('plugins.permissionLevels.' + v)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* {t('plugins.priority')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    {t('plugins.priority')}
                  </Label>
                  <Input
                    type="number"
                    className="bg-background h-10"
                    value={editedServiceConfig.priority || 0}
                    onChange={(e) => setEditedServiceConfig(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    placeholder={t('plugins.enterPriority')}
                  />
                </div>

                {/* {t('plugins.responseArea')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {t('plugins.responseArea')}
                  </Label>
                  <Select
                    value={editedServiceConfig.area || 'ALL'}
                    onValueChange={(v) => setEditedServiceConfig(prev => ({ ...prev, area: v }))}
                  >
                    <SelectTrigger className="bg-background h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">全局</SelectItem>
                      <SelectItem value="DIRECT">仅限私聊</SelectItem>
                      <SelectItem value="GROUP">仅限群聊</SelectItem>
                      <SelectItem value="SV">SV服务</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* {t('plugins.pluginWhiteList')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {t('plugins.pluginWhiteList')}
                  </Label>
                  <ConfigField
                    fieldKey="white_list"
                    field={{
                      type: 'tags',
                      label: t('plugins.pluginWhiteList'),
                      value: editedServiceConfig.white_list || [],
                      placeholder: t('plugins.enterWhitelistContent')
                    }}
                    onChange={(fieldKey, value) => setEditedServiceConfig(prev => ({ ...prev, [fieldKey]: value }))}
                    showLabel={false}
                  />
                </div>

                {/* {t('plugins.pluginBlackList')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('plugins.pluginBlackList')}
                  </Label>
                  <ConfigField
                    fieldKey="black_list"
                    field={{
                      type: 'tags',
                      label: t('plugins.pluginBlackList'),
                      value: editedServiceConfig.black_list || [],
                      placeholder: t('plugins.enterBlacklistContent')
                    }}
                    onChange={(fieldKey, value) => setEditedServiceConfig(prev => ({ ...prev, [fieldKey]: value }))}
                    showLabel={false}
                  />
                </div>

                {/* {t('plugins.disablePrefix')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    {t('plugins.disablePrefix')}
                  </Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editedServiceConfig.disable_force_prefix || false}
                      onCheckedChange={(checked) => setEditedServiceConfig(prev => ({ ...prev, disable_force_prefix: checked }))}
                    />
                    <span className="text-sm text-muted-foreground">{t('plugins.disablePrefixDesc')}</span>
                  </div>
                </div>

                {/* {t('plugins.allowEmptyPrefix')} */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    {t('plugins.allowEmptyPrefix')}
                  </Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editedServiceConfig.allow_empty_prefix || false}
                      onCheckedChange={(checked) => setEditedServiceConfig(prev => ({ ...prev, allow_empty_prefix: checked }))}
                    />
                    <span className="text-sm text-muted-foreground">允许空命令前缀</span>
                  </div>
                </div>

                {/* prefix 可编辑 - 使用tags组件 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    prefix
                  </Label>
                  <ConfigField
                    fieldKey="prefix"
                    field={{
                      type: 'tags',
                      label: 'prefix',
                      value: editedServiceConfig.prefix || [],
                      placeholder: '输入前缀内容'
                    }}
                    onChange={(fieldKey, value) => setEditedServiceConfig(prev => ({ ...prev, [fieldKey]: value }))}
                    showLabel={false}
                  />
                </div>

                {/* force_prefix 只读显示 - 每个元素一个tag */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    force_prefix
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {Array.isArray(editedServiceConfig.force_prefix) && editedServiceConfig.force_prefix.length > 0 ? (
                      editedServiceConfig.force_prefix.map((prefix: string, index: number) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {prefix}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">无</span>
                    )}
                    <span className="text-xs text-muted-foreground">(只读)</span>
                  </div>
                  </div>
                </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* SV 服务列表配置 - 独立可折叠 */}
                {editedSvList && editedSvList.length > 0 && (
                  <Collapsible defaultOpen={false} className="mt-8">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between mb-6 cursor-pointer hover:opacity-80 transition-opacity bg-muted/30 rounded-lg p-3 border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Server className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold">SV 服务配置</h4>
                            <p className="text-muted-foreground text-sm">管理单个服务的详细配置</p>
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {editedSvList.map((sv, index) => (
                      <Card key={`${sv.name}-${index}`} className="glass-card border">
                        <CardContent className="p-6 space-y-4">
                          {/* SV名称 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4 text-primary" />
                              <span className="font-medium">{sv.name}</span>
                            </div>
                            <Switch
                              checked={sv.enabled}
                              onCheckedChange={(checked) => {
                                const newSvList = [...editedSvList];
                                newSvList[index] = { ...sv, enabled: checked };
                                setEditedSvList(newSvList);
                              }}
                            />
                          </div>

                          {/* {t('plugins.permissionLevel')} */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              {t('plugins.permissionLevel')}
                            </Label>
                            <Select
                              value={String(sv.pm || 0)}
                              onValueChange={(v) => {
                                const newSvList = [...editedSvList];
                                newSvList[index] = { ...sv, pm: parseInt(v) };
                                setEditedSvList(newSvList);
                              }}
                            >
                              <SelectTrigger className="bg-background h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(v => (
                                  <SelectItem key={v} value={String(v)}>{t('plugins.permissionLevels.' + v)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* {t('plugins.priority')} */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Zap className="w-4 h-4" />
                              {t('plugins.priority')}
                            </Label>
                            <Input
                              type="number"
                              className="bg-background h-9"
                              value={sv.priority || 0}
                              onChange={(e) => {
                                const newSvList = [...editedSvList];
                                newSvList[index] = { ...sv, priority: parseInt(e.target.value) || 0 };
                                setEditedSvList(newSvList);
                              }}
                              placeholder={t('plugins.enterPriority')}
                            />
                          </div>

                          {/* {t('plugins.responseArea')} */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" />
                              {t('plugins.responseArea')}
                            </Label>
                            <Select
                              value={sv.area || 'ALL'}
                              onValueChange={(v) => {
                                const newSvList = [...editedSvList];
                                newSvList[index] = { ...sv, area: v };
                                setEditedSvList(newSvList);
                              }}
                            >
                              <SelectTrigger className="bg-background h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">{t('plugins.global')}</SelectItem>
                                <SelectItem value="DIRECT">{t('plugins.directOnly')}</SelectItem>
                                <SelectItem value="GROUP">{t('plugins.groupOnly')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* {t('plugins.whiteList')} / {t('plugins.blackList')} */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                {t('plugins.whiteList')}
                              </Label>
                              <ConfigField
                                fieldKey={`sv_${index}_white_list`}
                                field={{
                                  type: 'tags',
                                  label: t('plugins.whiteList'),
                                  value: sv.white_list || [],
                                  placeholder: t('plugins.enterWhitelistContent')
                                }}
                                onChange={(fieldKey, value) => {
                                  const newSvList = [...editedSvList];
                                  newSvList[index] = { ...sv, white_list: value as unknown as string[] };
                                  setEditedSvList(newSvList);
                                }}
                                showLabel={false}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                {t('plugins.blackList')}
                              </Label>
                              <ConfigField
                                fieldKey={`sv_${index}_black_list`}
                                field={{
                                  type: 'tags',
                                  label: t('plugins.blackList'),
                                  value: sv.black_list || [],
                                  placeholder: t('plugins.enterBlacklistContent')
                                }}
                                onChange={(fieldKey, value) => {
                                  const newSvList = [...editedSvList];
                                  newSvList[index] = { ...sv, black_list: value as unknown as string[] };
                                  setEditedSvList(newSvList);
                                }}
                                showLabel={false}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* 服务配置保存按钮 - 放在最外层 */}
              <div className="flex items-center justify-end mt-8">
                <Button
                  size="lg"
                  className="gap-2 min-w-[160px] h-11"
                  disabled={!isServiceDirty || isSavingService}
                  onClick={handleSaveService}
                >
                  {isSavingService ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  确认修改
                </Button>
              </div>

              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* 参数配置区域 - 默认展开 */}
            <Collapsible defaultOpen={true}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between mb-6 cursor-pointer hover:opacity-80 transition-opacity bg-background/50 rounded-xl p-4 border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Settings className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{t('plugins.configParams')}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{t('plugins.configParamsDesc')}</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {selectedPlugin.config_names && selectedPlugin.config_names.length > 1 && (
                  <div className="mb-4">
                    <ToggleGroup
                      type="single"
                      value={selectedConfigName || ''}
                      onValueChange={(val) => val && setSelectedConfigName(val)}
                      className="justify-start flex-wrap"
                    >
                      {selectedPlugin.config_names.map((name: string) => (
                        <ToggleGroupItem
                          key={name}
                          value={name}
                          variant="outline"
                          className="px-3 h-8 text-xs"
                        >
                          {name}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                )}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {(() => {
                    const currentGroup = selectedPlugin.config_groups?.find(g => g.config_name === selectedConfigName);
                    const displayConfig = currentGroup ? currentGroup.config : selectedPlugin.config;

                    const entries = Object.entries(displayConfig);
                    if (entries.length === 0) {
                      return (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                          <p>{t('plugins.noConfigItems')}</p>
                        </div>
                      );
                    }

                    return entries.map(([key, field]) => (
                      <ConfigField
                        key={`${selectedConfigName}_${key}`}
                        fieldKey={key}
                        field={field as unknown as ConfigFieldDefinition}
                        onChange={(fieldKey, value) => updateConfigValue(selectedPlugin.id, fieldKey, value, selectedConfigName)}
                      />
                    ));
                  })()}
                </div>

                <div className="flex items-center justify-end mt-6">
                  <Button
                    size="lg"
                    className="gap-2 min-w-[160px] h-11"
                    disabled={!isConfigDirty || isSavingConfig}
                    onClick={handleSaveConfig}
                  >
                    {isSavingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    确认修改
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>请先选择要配置的插件</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
