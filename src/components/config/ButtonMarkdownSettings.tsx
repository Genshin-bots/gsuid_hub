import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Settings, Layout, FileText, List, Columns, ToggleLeft, ToggleRight, SplitSquareHorizontal, Cog } from 'lucide-react';
import { frameworkConfigApi, FrameworkConfigListItem, PluginConfigItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { cn } from '@/lib/utils';
import { ConfigField, ConfigFieldDefinition, ConfigFieldType, ConfigValue } from '@/components/config';

// 平台配置接口 - 适配后端返回的 gsliststr 类型
interface PlatformConfig {
  value: string[];
  default: string[];
  options: string[];
  title: string;
  desc: string;
  type?: string; // 后端返回的类型，如 gsliststr
}

// 基础配置项接口
interface BaseConfigItem {
  value: unknown;
  default: unknown;
  title: string;
  desc: string;
  type?: string;
}

interface ButtonMarkdownConfig {
  SendMDPlatform: PlatformConfig;
  ButtonRow: BaseConfigItem & { value: number; default: number };
  SendButtonsPlatform: PlatformConfig;
  SendTemplatePlatform: PlatformConfig;
  TryTemplateForQQ: BaseConfigItem & { value: boolean; default: boolean };
  ForceSendMD: BaseConfigItem & { value: boolean; default: boolean };
  UseCRLFReplaceLFForMD: BaseConfigItem & { value: boolean; default: boolean };
  SplitMDAndButtons: BaseConfigItem & { value: boolean; default: boolean };
}

interface LocalButtonMarkdownConfig {
  id: string;
  name: string;
  full_name: string;
  config: ButtonMarkdownConfig;
  rawConfig?: Record<string, PluginConfigItem>; // 存储后端返回的原始完整配置
}

// 预期配置项的 key 列表，用于识别预料之外的配置项
const EXPECTED_CONFIG_KEYS = [
  'SendMDPlatform',
  'ButtonRow',
  'SendButtonsPlatform',
  'SendTemplatePlatform',
  'TryTemplateForQQ',
  'ForceSendMD',
  'UseCRLFReplaceLFForMD',
  'SplitMDAndButtons',
];

// 平台选项的默认列表和标签映射
const PLATFORM_OPTIONS = ['villa', 'kaiheila', 'dodo', 'discord', 'telegram', 'qqgroup', 'qqguild', 'web'];

const PLATFORM_LABELS: Record<string, string> = {
  villa: '米游社大别野',
  kaiheila: '开黑啦',
  dodo: 'DoDo',
  discord: 'Discord',
  telegram: 'Telegram',
  qqgroup: 'QQ群',
  qqguild: 'QQ频道',
  web: 'Web',
};

const PLATFORM_COLORS: Record<string, string> = {
  villa: 'bg-yellow-500',
  kaiheila: 'bg-green-500',
  dodo: 'bg-purple-500',
  discord: 'bg-indigo-500',
  telegram: 'bg-sky-500',
  qqgroup: 'bg-blue-500',
  qqguild: 'bg-blue-600',
  web: 'bg-gray-500',
};

// 根据 options 生成平台列表
const getPlatformsFromOptions = (options: string[]) => {
  return options.map(key => ({
    key,
    label: PLATFORM_LABELS[key] || key,
    color: PLATFORM_COLORS[key] || 'bg-gray-500',
  }));
};

export default function ButtonMarkdownSettings() {
  const { t } = useLanguage();
  const { setDirty } = useConfigDirty();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalButtonMarkdownConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [originalRawConfig, setOriginalRawConfig] = useState<Record<string, PluginConfigItem> | undefined>(undefined);
  const [buttonMdConfigName, setButtonMdConfigName] = useState<string>('');

  const buttonMdConfig = useMemo(() => {
    return configs.find(c =>
      c.name === '按钮和MD配置' ||
      c.full_name === '按钮和MD配置' ||
      c.full_name === buttonMdConfigName
    );
  }, [configs, buttonMdConfigName]);

  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore');
      const buttonMdConfigList = data.filter(c => {
        const nameLower = c.name.toLowerCase();
        const fullNameLower = c.full_name.toLowerCase();
        return nameLower.includes('按钮') ||
               nameLower.includes('markdown') ||
               nameLower.includes('md') ||
               fullNameLower.includes('按钮') ||
               fullNameLower.includes('markdown');
      });

      if (buttonMdConfigList.length > 0) {
        setConfigList(buttonMdConfigList);
        setButtonMdConfigName(buttonMdConfigList[0].full_name);
      }
    } catch (error) {
      console.error('Failed to fetch button markdown config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('buttonMdConfig.loadFailed') || 'Unable to load button markdown configuration',
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

      const convertedConfig: LocalButtonMarkdownConfig = {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        rawConfig: data.config as Record<string, PluginConfigItem>, // 保存原始完整配置
        config: {
          SendMDPlatform: {
            value: (data.config.SendMDPlatform?.value || []) as string[],
            default: (data.config.SendMDPlatform?.default || []) as string[],
            options: (data.config.SendMDPlatform?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.SendMDPlatform?.title || '默认发送MD的平台列表',
            desc: data.config.SendMDPlatform?.desc || '发送MD的平台列表'
          },
          ButtonRow: {
            value: (data.config.ButtonRow?.value || 2) as number,
            default: (data.config.ButtonRow?.default || 2) as number,
            title: data.config.ButtonRow?.title || '按钮默认一行几个',
            desc: data.config.ButtonRow?.desc || '除了插件作者特殊设定的按钮排序'
          },
          SendButtonsPlatform: {
            value: (data.config.SendButtonsPlatform?.value || ['villa', 'kaiheila', 'dodo', 'discord', 'telegram', 'web']) as string[],
            default: (data.config.SendButtonsPlatform?.default || ['villa', 'kaiheila', 'dodo', 'discord', 'telegram', 'web']) as string[],
            options: (data.config.SendButtonsPlatform?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.SendButtonsPlatform?.title || '默认发送按钮的平台列表',
            desc: data.config.SendButtonsPlatform?.desc || '发送按钮的平台列表'
          },
          SendTemplatePlatform: {
            value: (data.config.SendTemplatePlatform?.value || ['qqgroup', 'qqguild']) as string[],
            default: (data.config.SendTemplatePlatform?.default || ['qqgroup', 'qqguild']) as string[],
            options: (data.config.SendTemplatePlatform?.options || ['qqgroup', 'qqguild', 'web']) as string[],
            title: data.config.SendTemplatePlatform?.title || '默认发送模板按钮/MD的平台列表',
            desc: data.config.SendTemplatePlatform?.desc || '发送按钮的平台列表'
          },
          TryTemplateForQQ: {
            value: (data.config.TryTemplateForQQ?.value ?? true) as boolean,
            default: (data.config.TryTemplateForQQ?.default ?? true) as boolean,
            title: data.config.TryTemplateForQQ?.title || '启用后尝试读取模板文件并发送',
            desc: data.config.TryTemplateForQQ?.desc || '发送MD和按钮模板'
          },
          ForceSendMD: {
            value: (data.config.ForceSendMD?.value ?? false) as boolean,
            default: (data.config.ForceSendMD?.default ?? false) as boolean,
            title: data.config.ForceSendMD?.title || '强制使用MD发送图文',
            desc: data.config.ForceSendMD?.desc || '强制使用MD发送图文'
          },
          UseCRLFReplaceLFForMD: {
            value: (data.config.UseCRLFReplaceLFForMD?.value ?? true) as boolean,
            default: (data.config.UseCRLFReplaceLFForMD?.default ?? true) as boolean,
            title: data.config.UseCRLFReplaceLFForMD?.title || '发送MD时使用CR替换LF',
            desc: data.config.UseCRLFReplaceLFForMD?.desc || '发送MD时使用CR替换LF'
          },
          SplitMDAndButtons: {
            value: (data.config.SplitMDAndButtons?.value ?? false) as boolean,
            default: (data.config.SplitMDAndButtons?.default ?? false) as boolean,
            title: data.config.SplitMDAndButtons?.title || '发送MD消息时将按钮分开发送',
            desc: data.config.SplitMDAndButtons?.desc || '发送MD消息时将按钮分开发送'
          }
        }
      };

      setConfigs([convertedConfig]);
      setOriginalConfig(JSON.parse(JSON.stringify(convertedConfig.config)));
      setOriginalRawConfig(JSON.parse(JSON.stringify(data.config)));
    } catch (error) {
      console.error('Failed to fetch button markdown config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('buttonMdConfig.loadFailed') || 'Unable to load button markdown configuration',
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
    if (buttonMdConfigName) {
      fetchConfigDetail(buttonMdConfigName);
    }
  }, [buttonMdConfigName]);

  useEffect(() => {
    if (buttonMdConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(buttonMdConfig.config)));
      setOriginalRawConfig(JSON.parse(JSON.stringify(buttonMdConfig.rawConfig)));
      setDirty(false);
    }
  }, [buttonMdConfig?.id, setDirty]);

  // 将后端配置转换为 ConfigFieldDefinition 类型
  const convertToConfigField = (key: string, configItem: PluginConfigItem): ConfigFieldDefinition => {
    let type: ConfigFieldType = 'text';
    const rawType = configItem.type?.toLowerCase() || '';
    
    if (rawType.includes('bool')) {
      type = 'boolean';
    } else if (rawType.includes('int')) {
      type = 'number';
    } else if (rawType.includes('list') || rawType.includes('array')) {
      type = configItem.options ? 'multiselect' : 'tags';
    } else if (rawType.includes('gstimer')) {
      type = 'time';
    } else if (rawType.includes('time') || rawType.includes('date')) {
      type = 'date';
    } else if (rawType.includes('str') || rawType.includes('string')) {
      type = configItem.options ? 'select' : 'text';
    } else if (rawType.includes('dict') || rawType.includes('object')) {
      type = 'text';
      if (typeof configItem.value === 'object' && configItem.value !== null) {
        configItem.value = JSON.stringify(configItem.value, null, 2);
      }
      if (typeof configItem.default === 'object' && configItem.default !== null) {
        configItem.default = JSON.stringify(configItem.default, null, 2);
      }
    } else if (rawType.includes('image')) {
      type = 'image';
    }
    
    return {
      type,
      label: configItem.title || key,
      value: configItem.value as ConfigValue,
      options: configItem.options,
      placeholder: configItem.desc || '请输入内容',
      description: configItem.desc || key,
      required: false,
      disabled: false,
    };
  };

  // 获取预料之外的配置项
  const unexpectedConfigItems = useMemo(() => {
    if (!buttonMdConfig?.rawConfig) return {};
    const items: Record<string, ConfigFieldDefinition> = {};
    for (const [key, configItem] of Object.entries(buttonMdConfig.rawConfig)) {
      if (!EXPECTED_CONFIG_KEYS.includes(key)) {
        items[key] = convertToConfigField(key, configItem);
      }
    }
    return items;
  }, [buttonMdConfig?.rawConfig]);

  const handleChange = useCallback((fieldKey: string, value: string | number | boolean | string[]) => {
    if (!buttonMdConfig) return;

    // 检查是否是预料之外的配置项
    if (!EXPECTED_CONFIG_KEYS.includes(fieldKey)) {
      // 更新 rawConfig 中的值
      setConfigs(prev => prev.map(c => {
        if (c.id !== buttonMdConfig.id) return c;
        const updatedRawConfig = { ...c.rawConfig };
        if (updatedRawConfig[fieldKey]) {
          updatedRawConfig[fieldKey] = { ...updatedRawConfig[fieldKey], value };
        }
        return { ...c, rawConfig: updatedRawConfig };
      }));
      setDirty(true);
      return;
    }

    const originalValue = originalConfig[fieldKey as keyof ButtonMarkdownConfig]?.value;
    const hasChanged = JSON.stringify(value) !== JSON.stringify(originalValue);

    setConfigs(prev => prev.map(c => {
      if (c.id !== buttonMdConfig.id) return c;
      return {
        ...c,
        config: {
          ...c.config,
          [fieldKey]: { ...c.config[fieldKey as keyof ButtonMarkdownConfig], value }
        }
      };
    }));
    setDirty(hasChanged);
  }, [buttonMdConfig, originalConfig, setDirty]);

  const togglePlatform = (fieldKey: string, platform: string) => {
    if (!buttonMdConfig) return;
    const currentValue = buttonMdConfig.config[fieldKey as keyof ButtonMarkdownConfig].value as string[];
    const newValue = currentValue.includes(platform)
      ? currentValue.filter(p => p !== platform)
      : [...currentValue, platform];
    handleChange(fieldKey, newValue);
  };

  const handleSaveConfig = async () => {
    if (!buttonMdConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};

      // 保存预期配置项
      Object.entries(buttonMdConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });

      // 保存预料之外的配置项
      if (buttonMdConfig.rawConfig) {
        Object.entries(buttonMdConfig.rawConfig).forEach(([key, field]) => {
          if (!EXPECTED_CONFIG_KEYS.includes(key) && 'value' in field) {
            configToSave[key] = field.value;
          }
        });
      }

      await frameworkConfigApi.updateFrameworkConfig(buttonMdConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(buttonMdConfig.config)));
      setOriginalRawConfig(JSON.parse(JSON.stringify(buttonMdConfig.rawConfig)));
      setDirty(false);
      toast({ title: t('common.success'), description: t('buttonMdConfig.configSaved') });
    } catch (error) {
      toast({
        title: t('common.saveFailed'),
        description: t('buttonMdConfig.saveFailed') || 'Failed to update button markdown configuration',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigDirty = useMemo(() => {
    if (!buttonMdConfig) return false;
    const configChanged = JSON.stringify(buttonMdConfig.config) !== JSON.stringify(originalConfig);
    // 同时检查预料之外的配置项（rawConfig）是否有变化
    const rawConfigChanged = buttonMdConfig.rawConfig && originalRawConfig ?
      JSON.stringify(buttonMdConfig.rawConfig) !== JSON.stringify(originalRawConfig) : false;
    return configChanged || rawConfigChanged;
  }, [buttonMdConfig, originalConfig, originalRawConfig]);

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!buttonMdConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{t('buttonMdConfig.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = buttonMdConfig.config;

  // 从后端返回的 options 动态生成平台列表，fallback 到默认列表
  const sendMDPlatforms = getPlatformsFromOptions(
    config.SendMDPlatform.options?.length ? config.SendMDPlatform.options : PLATFORM_OPTIONS
  );
  const sendButtonsPlatforms = getPlatformsFromOptions(
    config.SendButtonsPlatform.options?.length ? config.SendButtonsPlatform.options : PLATFORM_OPTIONS
  );
  const sendTemplatePlatforms = getPlatformsFromOptions(
    config.SendTemplatePlatform.options?.length ? config.SendTemplatePlatform.options : ['qqgroup', 'qqguild', 'web']
  );

  return (
    <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
      {/* Platform Selection Card */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('buttonMdConfig.platformSelection')}
          </CardTitle>
          <CardDescription>{t('buttonMdConfig.platformSelectionDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Send MD Platform */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <Label>{config.SendMDPlatform.title}</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {sendMDPlatforms.map((platform) => {
                const isSelected = config.SendMDPlatform.value.includes(platform.key);
                return (
                  <button
                    key={platform.key}
                    onClick={() => togglePlatform('SendMDPlatform', platform.key)}
                    className={cn(
                      "p-2 rounded-lg border-2 transition-all flex items-center gap-2",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn("w-3 h-3 rounded-full", platform.color, !isSelected && "opacity-30")} />
                    <span className="text-sm">{platform.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">{config.SendMDPlatform.desc}</p>
          </div>

          <div className="border-t border-border/50 pt-6">
            {/* Send Buttons Platform */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4 text-muted-foreground" />
                <Label>{config.SendButtonsPlatform.title}</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {sendButtonsPlatforms.map((platform) => {
                  const isSelected = config.SendButtonsPlatform.value.includes(platform.key);
                  return (
                    <button
                      key={platform.key}
                      onClick={() => togglePlatform('SendButtonsPlatform', platform.key)}
                      className={cn(
                        "p-2 rounded-lg border-2 transition-all flex items-center gap-2",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn("w-3 h-3 rounded-full", platform.color, !isSelected && "opacity-30")} />
                      <span className="text-sm">{platform.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">{config.SendButtonsPlatform.desc}</p>
            </div>

            {/* Send Template Platform */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-muted-foreground" />
                <Label>{config.SendTemplatePlatform.title}</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {sendTemplatePlatforms.map((platform) => {
                  const isSelected = config.SendTemplatePlatform.value.includes(platform.key);
                  return (
                    <button
                      key={platform.key}
                      onClick={() => togglePlatform('SendTemplatePlatform', platform.key)}
                      className={cn(
                        "p-2 rounded-lg border-2 transition-all flex items-center gap-2",
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={cn("w-3 h-3 rounded-full", platform.color, !isSelected && "opacity-30")} />
                      <span className="text-sm">{platform.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">{config.SendTemplatePlatform.desc}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Button Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="w-5 h-5" />
            {t('buttonMdConfig.buttonSettings')}
          </CardTitle>
          <CardDescription>{t('buttonMdConfig.buttonSettingsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Button Row */}
          <div className="space-y-3">
            <Label>{config.ButtonRow.title}</Label>
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4, 5].map((row) => (
                <button
                  key={row}
                  onClick={() => handleChange('ButtonRow', row)}
                  className={cn(
                    "w-12 h-12 rounded-lg border-2 transition-all flex items-center justify-center",
                    config.ButtonRow.value === row
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {row}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{config.ButtonRow.desc}</p>
          </div>

          <div className="border-t border-border/50 pt-6 space-y-4">
            {/* Try Template For QQ */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  config.TryTemplateForQQ.value ? "bg-blue-500/20" : "bg-muted"
                )}>
                  {config.TryTemplateForQQ.value ? (
                    <ToggleRight className="w-5 h-5 text-blue-500" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{config.TryTemplateForQQ.title}</p>
                  <p className="text-sm text-muted-foreground">{config.TryTemplateForQQ.desc}</p>
                </div>
              </div>
              <Switch
                checked={config.TryTemplateForQQ.value}
                onCheckedChange={(checked) => handleChange('TryTemplateForQQ', checked)}
              />
            </div>

            {/* Force Send MD */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  config.ForceSendMD.value ? "bg-red-500/20" : "bg-muted"
                )}>
                  <FileText className={cn(
                    "w-5 h-5",
                    config.ForceSendMD.value ? "text-red-500" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="font-medium">{config.ForceSendMD.title}</p>
                  <p className="text-sm text-muted-foreground">{config.ForceSendMD.desc}</p>
                </div>
              </div>
              <Switch
                checked={config.ForceSendMD.value}
                onCheckedChange={(checked) => handleChange('ForceSendMD', checked)}
              />
            </div>

            {/* Use CRLF Replace LF */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  config.UseCRLFReplaceLFForMD.value ? "bg-green-500/20" : "bg-muted"
                )}>
                  <ToggleRight className={cn(
                    "w-5 h-5",
                    config.UseCRLFReplaceLFForMD.value ? "text-green-500" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="font-medium">{config.UseCRLFReplaceLFForMD.title}</p>
                  <p className="text-sm text-muted-foreground">{config.UseCRLFReplaceLFForMD.desc}</p>
                </div>
              </div>
              <Switch
                checked={config.UseCRLFReplaceLFForMD.value}
                onCheckedChange={(checked) => handleChange('UseCRLFReplaceLFForMD', checked)}
              />
            </div>

            {/* Split MD And Buttons */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  config.SplitMDAndButtons.value ? "bg-purple-500/20" : "bg-muted"
                )}>
                  <SplitSquareHorizontal className={cn(
                    "w-5 h-5",
                    config.SplitMDAndButtons.value ? "text-purple-500" : "text-muted-foreground"
                  )} />
                </div>
                <div>
                  <p className="font-medium">{config.SplitMDAndButtons.title}</p>
                  <p className="text-sm text-muted-foreground">{config.SplitMDAndButtons.desc}</p>
                </div>
              </div>
              <Switch
                checked={config.SplitMDAndButtons.value}
                onCheckedChange={(checked) => handleChange('SplitMDAndButtons', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 预料之外的配置项 - 使用通用配置卡片渲染 */}
      {Object.keys(unexpectedConfigItems).length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cog className="w-5 h-5" />
              其他设置
            </CardTitle>
            <CardDescription>由插件或后端新增的配置项</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(unexpectedConfigItems).map(([key, field]) => (
                <ConfigField
                  key={key}
                  fieldKey={key}
                  field={field}
                  onChange={handleChange}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
