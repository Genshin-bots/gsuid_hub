import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Cpu, Play, RefreshCw, Clock, Globe, Package, Zap, GitBranch, AlertCircle } from 'lucide-react';
import { frameworkConfigApi, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { cn } from '@/lib/utils';

interface CoreConfig {
  StartVENV: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  is_use_custom_restart_command: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  restart_command: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  AutoUpdateCore: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  AutoUpdatePlugins: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  AutoRestartCore: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  AutoUpdateCoreTime: {
    value: [number, number];
    default: [number, number];
    title: string;
    desc: string;
  };
  AutoUpdatePluginsTime: {
    value: [number, number];
    default: [number, number];
    title: string;
    desc: string;
  };
  AutoRestartCoreTime: {
    value: [number, number];
    default: [number, number];
    title: string;
    desc: string;
  };
  AutoUpdateNotify: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  AutoInstallDep: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  AutoUpdateDep: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  AutoReloadPlugins: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  ProxyURL: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
}

interface LocalCoreConfig {
  id: string;
  name: string;
  full_name: string;
  config: CoreConfig;
}

const VENV_OPTIONS = ['pdm', 'poetry', 'python', 'uv', 'auto'];

export default function CoreSettings() {
  const { t } = useLanguage();
  const { setDirty } = useConfigDirty();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalCoreConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [coreConfigName, setCoreConfigName] = useState<string>('');

  const coreConfig = useMemo(() => {
    return configs.find(c =>
      c.name === '核心配置' ||
      c.full_name === 'GsCore' ||
      c.id === 'GsCore' ||
      c.full_name === coreConfigName
    );
  }, [configs, coreConfigName]);

  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore');
      const coreConfigList = data.filter(c => {
        const nameLower = c.name.toLowerCase();
        const fullNameLower = c.full_name.toLowerCase();
        return nameLower.includes('核心') ||
               fullNameLower.includes('core') ||
               nameLower === 'gscore';
      });

      if (coreConfigList.length > 0) {
        setConfigList(coreConfigList);
        setCoreConfigName(coreConfigList[0].full_name);
      }
    } catch (error) {
      console.error('Failed to fetch core config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('coreConfig.loadFailed') || 'Unable to load core configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConfigDetail = async (configName: string) => {
    try {
      setIsLoadingDetail(true);
      const data = await frameworkConfigApi.getFrameworkConfig(configName);

      const convertedConfig: LocalCoreConfig = {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        config: {
          StartVENV: {
            value: (data.config.StartVENV?.value || 'auto') as string,
            default: (data.config.StartVENV?.default || 'auto') as string,
            options: (data.config.StartVENV?.options || VENV_OPTIONS) as string[],
            title: data.config.StartVENV?.title || '设置启动环境工具',
            desc: data.config.StartVENV?.desc || '可选pdm, poetry, python, auto, uv'
          },
          is_use_custom_restart_command: {
            value: (data.config.is_use_custom_restart_command?.value ?? false) as boolean,
            default: (data.config.is_use_custom_restart_command?.default ?? false) as boolean,
            title: data.config.is_use_custom_restart_command?.title || '使用自定义重启命令',
            desc: data.config.is_use_custom_restart_command?.desc || '是否使用下面的自定义重启命令'
          },
          restart_command: {
            value: (data.config.restart_command?.value || 'poetry run python') as string,
            default: (data.config.restart_command?.default || 'poetry run python') as string,
            title: data.config.restart_command?.title || '自定义重启命令',
            desc: data.config.restart_command?.desc || '自定义使用gs重启时触发的控制台命令'
          },
          AutoUpdateCore: {
            value: (data.config.AutoUpdateCore?.value ?? true) as boolean,
            default: (data.config.AutoUpdateCore?.default ?? true) as boolean,
            title: data.config.AutoUpdateCore?.title || '自动更新Core',
            desc: data.config.AutoUpdateCore?.desc || '每晚凌晨三点四十自动更新core本体'
          },
          AutoUpdatePlugins: {
            value: (data.config.AutoUpdatePlugins?.value ?? false) as boolean,
            default: (data.config.AutoUpdatePlugins?.default ?? false) as boolean,
            title: data.config.AutoUpdatePlugins?.title || '自动更新Core内所有插件',
            desc: data.config.AutoUpdatePlugins?.desc || '每晚凌晨四点十分自动更新全部插件'
          },
          AutoRestartCore: {
            value: (data.config.AutoRestartCore?.value ?? false) as boolean,
            default: (data.config.AutoRestartCore?.default ?? false) as boolean,
            title: data.config.AutoRestartCore?.title || '自动重启Core',
            desc: data.config.AutoRestartCore?.desc || '每晚凌晨四点四十自动重启core'
          },
          AutoUpdateCoreTime: {
            value: (data.config.AutoUpdateCoreTime?.value || [3, 40]) as [number, number],
            default: (data.config.AutoUpdateCoreTime?.default || [3, 40]) as [number, number],
            title: data.config.AutoUpdateCoreTime?.title || '自动更新Core时间设置',
            desc: data.config.AutoUpdateCoreTime?.desc || '每晚自动更新Core时间设置(时, 分)'
          },
          AutoUpdatePluginsTime: {
            value: (data.config.AutoUpdatePluginsTime?.value || [4, 10]) as [number, number],
            default: (data.config.AutoUpdatePluginsTime?.default || [4, 10]) as [number, number],
            title: data.config.AutoUpdatePluginsTime?.title || '自动更新Core内所有插件时间设置',
            desc: data.config.AutoUpdatePluginsTime?.desc || '每晚自动更新Core内所有插件时间设置(时, 分)'
          },
          AutoRestartCoreTime: {
            value: (data.config.AutoRestartCoreTime?.value || [4, 40]) as [number, number],
            default: (data.config.AutoRestartCoreTime?.default || [4, 40]) as [number, number],
            title: data.config.AutoRestartCoreTime?.title || '自动重启Core时间设置',
            desc: data.config.AutoRestartCoreTime?.desc || '每晚自动重启Core时间设置(时, 分)'
          },
          AutoUpdateNotify: {
            value: (data.config.AutoUpdateNotify?.value ?? true) as boolean,
            default: (data.config.AutoUpdateNotify?.default ?? true) as boolean,
            title: data.config.AutoUpdateNotify?.title || '自动更新Core/插件时将内容通知主人',
            desc: data.config.AutoUpdateNotify?.desc || '自动更新Core/插件时将内容通知主人'
          },
          AutoInstallDep: {
            value: (data.config.AutoInstallDep?.value ?? false) as boolean,
            default: (data.config.AutoInstallDep?.default ?? false) as boolean,
            title: data.config.AutoInstallDep?.title || '自动安装依赖',
            desc: data.config.AutoInstallDep?.desc || '安装插件时将会自动安装依赖'
          },
          AutoUpdateDep: {
            value: (data.config.AutoUpdateDep?.value ?? false) as boolean,
            default: (data.config.AutoUpdateDep?.default ?? false) as boolean,
            title: data.config.AutoUpdateDep?.title || '自动更新依赖',
            desc: data.config.AutoUpdateDep?.desc || '启动Core时将会自动更新插件依赖'
          },
          AutoReloadPlugins: {
            value: (data.config.AutoReloadPlugins?.value ?? true) as boolean,
            default: (data.config.AutoReloadPlugins?.default ?? true) as boolean,
            title: data.config.AutoReloadPlugins?.title || '自动重载插件',
            desc: data.config.AutoReloadPlugins?.desc || 'Core内插件更新/安装时自动载入/重载'
          },
          ProxyURL: {
            value: (data.config.ProxyURL?.value || '') as string,
            default: (data.config.ProxyURL?.default || '') as string,
            title: data.config.ProxyURL?.title || '安装插件时使用git代理地址',
            desc: data.config.ProxyURL?.desc || 'git代理地址'
          }
        }
      };

      setConfigs([convertedConfig]);
      setOriginalConfig(JSON.parse(JSON.stringify(convertedConfig.config)));
    } catch (error) {
      console.error('Failed to fetch core config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('coreConfig.loadFailed') || 'Unable to load core configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchConfigList();
  }, []);

  useEffect(() => {
    if (coreConfigName) {
      fetchConfigDetail(coreConfigName);
    }
  }, [coreConfigName]);

  useEffect(() => {
    if (coreConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(coreConfig.config)));
      setDirty(false);
    }
  }, [coreConfig?.id, setDirty]);

  const handleChange = useCallback((fieldKey: string, value: string | number | boolean | [number, number]) => {
    if (!coreConfig) return;

    const originalValue = originalConfig[fieldKey as keyof CoreConfig]?.value;
    const hasChanged = JSON.stringify(value) !== JSON.stringify(originalValue);

    setConfigs(prev => prev.map(c => {
      if (c.id !== coreConfig.id) return c;
      return {
        ...c,
        config: {
          ...c.config,
          [fieldKey]: { ...c.config[fieldKey as keyof CoreConfig], value }
        }
      };
    }));
    setDirty(hasChanged);
  }, [coreConfig, originalConfig, setDirty]);

  const handleSaveConfig = async () => {
    const currentConfig = configs.find(c => c.id === coreConfig?.id);
    if (!currentConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};

      Object.entries(currentConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });

      await frameworkConfigApi.updateFrameworkConfig(currentConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(currentConfig.config)));
      setDirty(false);
      toast({ title: t('common.success'), description: t('coreConfig.configSaved') });
    } catch (error) {
      toast({
        title: t('common.saveFailed'),
        description: t('coreConfig.saveFailed') || 'Failed to update core configuration',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigDirty = useMemo(() => {
    if (!coreConfig) return false;
    return JSON.stringify(coreConfig.config) !== JSON.stringify(originalConfig);
  }, [coreConfig, originalConfig]);

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!coreConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{t('coreConfig.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = coreConfig.config;

  return (
    <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
      {/* Environment Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            {t('coreConfig.startVenv')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* VENV Selection */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {VENV_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => handleChange('StartVENV', option)}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all text-center",
                  config.StartVENV.value === option
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="font-medium">{option.toUpperCase()}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{config.StartVENV.desc}</p>

          {/* Custom Restart Command */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                config.is_use_custom_restart_command.value ? "bg-blue-500/20" : "bg-muted"
              )}>
                <RefreshCw className={cn(
                  "w-5 h-5",
                  config.is_use_custom_restart_command.value ? "text-blue-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{config.is_use_custom_restart_command.title}</p>
                <p className="text-sm text-muted-foreground">{config.is_use_custom_restart_command.desc}</p>
              </div>
            </div>
            <Switch
              checked={config.is_use_custom_restart_command.value}
              onCheckedChange={(checked) => handleChange('is_use_custom_restart_command', checked)}
            />
          </div>

          {config.is_use_custom_restart_command.value && (
            <div className="space-y-2">
              <Label htmlFor="restart_command">{config.restart_command.title}</Label>
              <Input
                id="restart_command"
                value={config.restart_command.value}
                onChange={(e) => handleChange('restart_command', e.target.value)}
                placeholder={config.restart_command.desc}
              />
              <p className="text-sm text-muted-foreground">{config.restart_command.desc}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto Update Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            {t('coreConfig.autoUpdate')}
          </CardTitle>
          <CardDescription>{t('coreConfig.autoUpdateDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Update Core */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                config.AutoUpdateCore.value ? "bg-green-500/20" : "bg-muted"
              )}>
                <Zap className={cn(
                  "w-5 h-5",
                  config.AutoUpdateCore.value ? "text-green-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{config.AutoUpdateCore.title}</p>
                <p className="text-sm text-muted-foreground">{config.AutoUpdateCore.desc}</p>
              </div>
            </div>
            <Switch
              checked={config.AutoUpdateCore.value}
              onCheckedChange={(checked) => handleChange('AutoUpdateCore', checked)}
            />
          </div>

          {config.AutoUpdateCore.value && (
            <div className="ml-4 pl-4 border-l-2 border-primary/30 space-y-2">
              <Label>{t('coreConfig.updateTime')}</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={config.AutoUpdateCoreTime.value[0]}
                    onChange={(e) => handleChange('AutoUpdateCoreTime', [parseInt(e.target.value) || 0, config.AutoUpdateCoreTime.value[1]])}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">{t('coreConfig.hour')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={config.AutoUpdateCoreTime.value[1]}
                    onChange={(e) => handleChange('AutoUpdateCoreTime', [config.AutoUpdateCoreTime.value[0], parseInt(e.target.value) || 0])}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">{t('coreConfig.minute')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Auto Update Plugins */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                config.AutoUpdatePlugins.value ? "bg-purple-500/20" : "bg-muted"
              )}>
                <Package className={cn(
                  "w-5 h-5",
                  config.AutoUpdatePlugins.value ? "text-purple-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{config.AutoUpdatePlugins.title}</p>
                <p className="text-sm text-muted-foreground">{config.AutoUpdatePlugins.desc}</p>
              </div>
            </div>
            <Switch
              checked={config.AutoUpdatePlugins.value}
              onCheckedChange={(checked) => handleChange('AutoUpdatePlugins', checked)}
            />
          </div>

          {config.AutoUpdatePlugins.value && (
            <div className="ml-4 pl-4 border-l-2 border-primary/30 space-y-2">
              <Label>{t('coreConfig.pluginsUpdateTime')}</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={config.AutoUpdatePluginsTime.value[0]}
                    onChange={(e) => handleChange('AutoUpdatePluginsTime', [parseInt(e.target.value) || 0, config.AutoUpdatePluginsTime.value[1]])}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">{t('coreConfig.hour')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={config.AutoUpdatePluginsTime.value[1]}
                    onChange={(e) => handleChange('AutoUpdatePluginsTime', [config.AutoUpdatePluginsTime.value[0], parseInt(e.target.value) || 0])}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">{t('coreConfig.minute')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Auto Restart Core */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                config.AutoRestartCore.value ? "bg-orange-500/20" : "bg-muted"
              )}>
                <Clock className={cn(
                  "w-5 h-5",
                  config.AutoRestartCore.value ? "text-orange-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{config.AutoRestartCore.title}</p>
                <p className="text-sm text-muted-foreground">{config.AutoRestartCore.desc}</p>
              </div>
            </div>
            <Switch
              checked={config.AutoRestartCore.value}
              onCheckedChange={(checked) => handleChange('AutoRestartCore', checked)}
            />
          </div>

          {config.AutoRestartCore.value && (
            <div className="ml-4 pl-4 border-l-2 border-primary/30 space-y-2">
              <Label>{t('coreConfig.restartTime')}</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={config.AutoRestartCoreTime.value[0]}
                    onChange={(e) => handleChange('AutoRestartCoreTime', [parseInt(e.target.value) || 0, config.AutoRestartCoreTime.value[1]])}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">{t('coreConfig.hour')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={config.AutoRestartCoreTime.value[1]}
                    onChange={(e) => handleChange('AutoRestartCoreTime', [config.AutoRestartCoreTime.value[0], parseInt(e.target.value) || 0])}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">{t('coreConfig.minute')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Auto Update Notify */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                config.AutoUpdateNotify.value ? "bg-blue-500/20" : "bg-muted"
              )}>
                <Zap className={cn(
                  "w-5 h-5",
                  config.AutoUpdateNotify.value ? "text-blue-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{config.AutoUpdateNotify.title}</p>
                <p className="text-sm text-muted-foreground">{config.AutoUpdateNotify.desc}</p>
              </div>
            </div>
            <Switch
              checked={config.AutoUpdateNotify.value}
              onCheckedChange={(checked) => handleChange('AutoUpdateNotify', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Plugin Dependency Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {t('coreConfig.dependency')}
          </CardTitle>
          <CardDescription>{t('coreConfig.dependencyDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto Install Dep */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                config.AutoInstallDep.value ? "bg-green-500/20" : "bg-muted"
              )}>
                <Package className={cn(
                  "w-5 h-5",
                  config.AutoInstallDep.value ? "text-green-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{config.AutoInstallDep.title}</p>
                <p className="text-sm text-muted-foreground">{config.AutoInstallDep.desc}</p>
              </div>
            </div>
            <Switch
              checked={config.AutoInstallDep.value}
              onCheckedChange={(checked) => handleChange('AutoInstallDep', checked)}
            />
          </div>

          {/* Auto Update Dep */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                config.AutoUpdateDep.value ? "bg-purple-500/20" : "bg-muted"
              )}>
                <RefreshCw className={cn(
                  "w-5 h-5",
                  config.AutoUpdateDep.value ? "text-purple-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{config.AutoUpdateDep.title}</p>
                <p className="text-sm text-muted-foreground">{config.AutoUpdateDep.desc}</p>
              </div>
            </div>
            <Switch
              checked={config.AutoUpdateDep.value}
              onCheckedChange={(checked) => handleChange('AutoUpdateDep', checked)}
            />
          </div>

          {/* Auto Reload Plugins */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                config.AutoReloadPlugins.value ? "bg-blue-500/20" : "bg-muted"
              )}>
                <Zap className={cn(
                  "w-5 h-5",
                  config.AutoReloadPlugins.value ? "text-blue-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{config.AutoReloadPlugins.title}</p>
                <p className="text-sm text-muted-foreground">{config.AutoReloadPlugins.desc}</p>
              </div>
            </div>
            <Switch
              checked={config.AutoReloadPlugins.value}
              onCheckedChange={(checked) => handleChange('AutoReloadPlugins', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Network Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('coreConfig.network')}
          </CardTitle>
          <CardDescription>{t('coreConfig.networkDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ProxyURL">{config.ProxyURL.title}</Label>
            <Input
              id="ProxyURL"
              value={config.ProxyURL.value}
              onChange={(e) => handleChange('ProxyURL', e.target.value)}
              placeholder={config.ProxyURL.desc}
            />
            <p className="text-sm text-muted-foreground">{config.ProxyURL.desc}</p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSaveConfig}
          disabled={!isConfigDirty || isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

