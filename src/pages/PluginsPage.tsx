import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
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
import { pluginsApi, Plugin, ServiceConfig, SvItem, PluginConfigItem, PluginConfigGroup } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

// 权限等级映射
const PERMISSION_LEVELS = {
  0: 'Bot主人',
  1: '超级管理员',
  2: '群主',
  3: '群管理员',
  4: '频道主',
  5: '频道管理员',
  6: '普通成员',
  7: '权限较低',
  8: '黑名单'
};

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
      else if (rawType.includes('gstime')) type = 'time';
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
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPluginId, setSelectedPluginId] = useState<string>('');
  const [selectedConfigName, setSelectedConfigName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  // Fetch plugins from API
  const fetchPlugins = async () => {
    try {
      setIsLoading(true);
      const data = await pluginsApi.getPlugins();
      const converted = data.map(convertToPlugin);
      setPlugins(converted);
      // 如果有插件且没有选中的，默认选中第一个
      if (converted.length > 0 && !selectedPluginId) {
        const firstPlugin = converted[0];
        setSelectedPluginId(firstPlugin.id);
        if (firstPlugin.config_names && firstPlugin.config_names.length > 0) {
          setSelectedConfigName(firstPlugin.config_names[0]);
        }
        setOriginalConfig({
          config: JSON.parse(JSON.stringify(firstPlugin.config)),
          groups: JSON.parse(JSON.stringify(firstPlugin.config_groups || []))
        });
        
        const processedServiceConfig = firstPlugin.service_config ? {
          ...firstPlugin.service_config,
          prefix: filterEmptyPrefix(firstPlugin.service_config.prefix)
        } : null;
        
        setOriginalServiceConfig(JSON.parse(JSON.stringify(processedServiceConfig)));
        setOriginalSvList(JSON.parse(JSON.stringify(firstPlugin.sv_list || [])));
        setEditedServiceConfig({
          ...(processedServiceConfig || {}),
          enabled: firstPlugin.enabled ?? true
        });
        setEditedSvList(JSON.parse(JSON.stringify(firstPlugin.sv_list || [])));
        setOriginalEnabled(firstPlugin.enabled ?? true);
        setEditedEnabled(firstPlugin.enabled ?? true);
      }
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
      toast({
        title: '加载失败',
        description: '无法加载插件列表',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  // Update original state when selected plugin changes
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
  }, [selectedPluginId]);

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
      toast({ title: '保存成功', description: '插件参数配置已更新' });
    } catch (error) {
      toast({
        title: '保存失败',
        description: '无法更新插件参数配置',
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

      toast({ title: '保存成功', description: '插件服务配置已更新' });
    } catch (error) {
      toast({
        title: '保存失败',
        description: '无法更新插件服务配置',
        variant: 'destructive'
      });
    } finally {
      setIsSavingService(false);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">插件配置</h1>
            <p className="text-muted-foreground">管理已加载插件的参数和服务配置</p>
          </div>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <LayoutGrid className="w-4 h-4" />
              <span>插件选择</span>
            </div>
            <div className="flex-1 w-full">
              <Select
                value={selectedPluginId}
                onValueChange={setSelectedPluginId}
              >
                <SelectTrigger className="w-full sm:w-[300px] bg-background/50">
                  <SelectValue placeholder="选择插件..." />
                </SelectTrigger>
                <SelectContent>
                  {plugins.map((plugin) => (
                    <SelectItem key={plugin.id} value={plugin.id}>
                      <div className="flex items-center gap-2">
                        {plugin.icon ? (
                          <img src={plugin.icon} className="w-4 h-4 rounded-sm" alt="" />
                        ) : (
                          <Cog className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span>{plugin.name}</span>
                        {!plugin.enabled && (
                          <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1">已禁用</Badge>
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

      {isLoading ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">正在加载插件配置...</p>
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
                      <h3 className="text-xl font-bold">插件服务配置</h3>
                      <p className="text-muted-foreground text-sm mt-1">管理服务权限、黑白名单等核心参数</p>
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
                          <h4 className="text-lg font-semibold">Plugin服务配置</h4>
                          <p className="text-muted-foreground text-sm">管理整个插件的配置</p>
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
                    插件状态
                  </Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editedEnabled}
                      onCheckedChange={(checked) => setEditedEnabled(checked)}
                    />
                    <span className="text-sm text-muted-foreground">{editedEnabled ? '已启用' : '已禁用'}</span>
                  </div>
                </div>

                {/* 权限等级 (PM) */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    权限等级 (PM)
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
                        <SelectItem key={v} value={String(v)}>{PERMISSION_LEVELS[v as keyof typeof PERMISSION_LEVELS]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 优先级 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    优先级
                  </Label>
                  <Input
                    type="number"
                    className="bg-background h-10"
                    value={editedServiceConfig.priority || 0}
                    onChange={(e) => setEditedServiceConfig(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    placeholder="输入优先级数值"
                  />
                </div>

                {/* 响应区域 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    响应区域
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

                {/* 插件白名单 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    插件白名单
                  </Label>
                  <ConfigField
                    fieldKey="plugin_white_list"
                    field={{
                      type: 'tags',
                      label: '插件白名单',
                      value: editedServiceConfig.plugin_white_list || [],
                      placeholder: '输入插件白名单内容'
                    }}
                    onChange={(fieldKey, value) => setEditedServiceConfig(prev => ({ ...prev, [fieldKey]: value }))}
                    showLabel={false}
                  />
                </div>

                {/* 插件黑名单 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    插件黑名单
                  </Label>
                  <ConfigField
                    fieldKey="plugin_black_list"
                    field={{
                      type: 'tags',
                      label: '插件黑名单',
                      value: editedServiceConfig.plugin_black_list || [],
                      placeholder: '输入插件黑名单内容'
                    }}
                    onChange={(fieldKey, value) => setEditedServiceConfig(prev => ({ ...prev, [fieldKey]: value }))}
                    showLabel={false}
                  />
                </div>

                {/* 关闭默认前缀 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    关闭默认前缀
                  </Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      checked={editedServiceConfig.disable_force_prefix || false}
                      onCheckedChange={(checked) => setEditedServiceConfig(prev => ({ ...prev, disable_force_prefix: checked }))}
                    />
                    <span className="text-sm text-muted-foreground">禁用强制前缀</span>
                  </div>
                </div>

                {/* 允许空前缀 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    允许空前缀
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

                          {/* 权限等级 */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              权限等级
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
                                  <SelectItem key={v} value={String(v)}>{PERMISSION_LEVELS[v as keyof typeof PERMISSION_LEVELS]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* 优先级 */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <Zap className="w-4 h-4" />
                              优先级
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
                              placeholder="输入优先级"
                            />
                          </div>

                          {/* 响应区域 */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              <MessageSquare className="w-4 h-4" />
                              响应区域
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
                                <SelectItem value="ALL">全局</SelectItem>
                                <SelectItem value="DIRECT">私聊</SelectItem>
                                <SelectItem value="GROUP">群聊</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* 黑白名单 */}
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Filter className="w-4 h-4" />
                                白名单
                              </Label>
                              <ConfigField
                                fieldKey={`sv_${index}_white_list`}
                                field={{
                                  type: 'tags',
                                  label: '白名单',
                                  value: sv.white_list || [],
                                  placeholder: '输入白名单内容'
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
                                黑名单
                              </Label>
                              <ConfigField
                                fieldKey={`sv_${index}_black_list`}
                                field={{
                                  type: 'tags',
                                  label: '黑名单',
                                  value: sv.black_list || [],
                                  placeholder: '输入黑名单内容'
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
                      <h3 className="text-xl font-bold">插件参数配置</h3>
                      <p className="text-muted-foreground text-sm mt-1">管理插件的具体参数设置</p>
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
                          <p>该配置组暂无参数项</p>
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
