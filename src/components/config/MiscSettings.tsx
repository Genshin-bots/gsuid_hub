import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Settings, Sun, Moon, MessageSquare, UserX, Shield, Clock, ListFilter, HelpCircle, Cog } from 'lucide-react';
import { frameworkConfigApi, FrameworkConfigListItem, PluginConfigItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { cn } from '@/lib/utils';
import { ConfigField, ConfigFieldDefinition, ConfigValue, ConfigFieldType, TagsInput } from '@/components/config';

interface MiscConfig {
  HelpMode: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  AtSenderPos: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  SameUserEventCD: {
    value: number;
    default: number;
    options: number[];
    title: string;
    desc: string;
  };
  BlackList: {
    value: string[];
    default: string[];
    title: string;
    desc: string;
  };
  EnableForwardMessage: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
}

// 预期配置项的 key 列表，用于识别预料之外的配置项
const EXPECTED_CONFIG_KEYS = [
  'HelpMode',
  'AtSenderPos',
  'SameUserEventCD',
  'BlackList',
  'EnableForwardMessage',
];

interface LocalMiscConfig {
  id: string;
  name: string;
  full_name: string;
  config: MiscConfig;
  rawConfig?: Record<string, PluginConfigItem>; // 存储后端返回的原始完整配置
}

const CD_OPTIONS = [0, 1, 2, 3, 5, 10, 15, 30];

export default function MiscSettings() {
  const { t } = useLanguage();
  const { setDirty } = useConfigDirty();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalMiscConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [originalRawConfig, setOriginalRawConfig] = useState<Record<string, PluginConfigItem> | undefined>(undefined);
  const [miscConfigName, setMiscConfigName] = useState<string>('');

  const miscConfig = useMemo(() => {
    return configs.find(c =>
      c.name === '杂项配置' ||
      c.full_name === '杂项配置' ||
      c.full_name === miscConfigName
    );
  }, [configs, miscConfigName]);

  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore');
      const miscConfigList = data.filter(c => {
        const nameLower = c.name.toLowerCase();
        const fullNameLower = c.full_name.toLowerCase();
        return nameLower.includes('杂项') ||
               fullNameLower.includes('misc') ||
               fullNameLower.includes('杂项配置');
      });

      if (miscConfigList.length > 0) {
        setConfigList(miscConfigList);
        setMiscConfigName(miscConfigList[0].full_name);
      }
    } catch (error) {
      console.error('Failed to fetch misc config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('miscConfig.loadFailed') || 'Unable to load misc configuration',
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

      const convertedConfig: LocalMiscConfig = {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        rawConfig: data.config as Record<string, PluginConfigItem>,
        config: {
          HelpMode: {
            value: (data.config.HelpMode?.value || 'dark') as string,
            default: (data.config.HelpMode?.default || 'dark') as string,
            options: (data.config.HelpMode?.options || ['light', 'dark']) as string[],
            title: data.config.HelpMode?.title || '帮助模式',
            desc: data.config.HelpMode?.desc || '帮助模式'
          },
          AtSenderPos: {
            value: (data.config.AtSenderPos?.value || '消息最前') as string,
            default: (data.config.AtSenderPos?.default || '消息最前') as string,
            options: (data.config.AtSenderPos?.options || ['消息最前', '消息最后']) as string[],
            title: data.config.AtSenderPos?.title || '@发送者位置',
            desc: data.config.AtSenderPos?.desc || '消息@发送者的位置'
          },
          SameUserEventCD: {
            value: (data.config.SameUserEventCD?.value || 0) as number,
            default: (data.config.SameUserEventCD?.default || 0) as number,
            options: (data.config.SameUserEventCD?.options || CD_OPTIONS) as number[],
            title: data.config.SameUserEventCD?.title || '启用同个人触发命令CD',
            desc: data.config.SameUserEventCD?.desc || '启用同个人触发命令CD(0为不启用)'
          },
          BlackList: {
            value: (data.config.BlackList?.value || []) as string[],
            default: (data.config.BlackList?.default || []) as string[],
            title: data.config.BlackList?.title || '黑名单',
            desc: data.config.BlackList?.desc || '黑名单用户/群, 不会触发任何命令'
          },
          EnableForwardMessage: {
            value: (data.config.EnableForwardMessage?.value || '允许') as string,
            default: (data.config.EnableForwardMessage?.default || '允许') as string,
            options: (data.config.EnableForwardMessage?.options || ['允许', '禁止(不发送任何消息)', '合并为一条消息', '1', '2', '3', '4', '5', '全部拆成单独消息']) as string[],
            title: data.config.EnableForwardMessage?.title || '是否允许发送合并转发',
            desc: data.config.EnableForwardMessage?.desc || '可选循环发送、合并消息、合并转发、禁止'
          }
        }
      };

      setConfigs([convertedConfig]);
      setOriginalConfig(JSON.parse(JSON.stringify(convertedConfig.config)));
      setOriginalRawConfig(JSON.parse(JSON.stringify(data.config)));
    } catch (error) {
      console.error('Failed to fetch misc config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('miscConfig.loadFailed') || 'Unable to load misc configuration',
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
    if (miscConfigName) {
      fetchConfigDetail(miscConfigName);
    }
  }, [miscConfigName]);

  useEffect(() => {
    if (miscConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(miscConfig.config)));
      setOriginalRawConfig(JSON.parse(JSON.stringify(miscConfig.rawConfig)));
      setDirty(false);
    }
  }, [miscConfig?.id, setDirty]);

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
    if (!miscConfig?.rawConfig) return {};
    const items: Record<string, ConfigFieldDefinition> = {};
    for (const [key, configItem] of Object.entries(miscConfig.rawConfig)) {
      if (!EXPECTED_CONFIG_KEYS.includes(key)) {
        items[key] = convertToConfigField(key, configItem);
      }
    }
    return items;
  }, [miscConfig?.rawConfig]);

  const handleChange = useCallback((fieldKey: string, value: string | number | boolean | string[]) => {
    if (!miscConfig) return;

    // 检查是否是预料之外的配置项
    if (!EXPECTED_CONFIG_KEYS.includes(fieldKey)) {
      setConfigs(prev => prev.map(c => {
        if (c.id !== miscConfig.id) return c;
        const updatedRawConfig = { ...c.rawConfig };
        if (updatedRawConfig[fieldKey]) {
          updatedRawConfig[fieldKey] = { ...updatedRawConfig[fieldKey], value };
        }
        return { ...c, rawConfig: updatedRawConfig };
      }));
      setDirty(true);
      return;
    }

    const originalValue = originalConfig[fieldKey as keyof MiscConfig]?.value;
    const hasChanged = JSON.stringify(value) !== JSON.stringify(originalValue);

    setConfigs(prev => prev.map(c => {
      if (c.id !== miscConfig.id) return c;
      return {
        ...c,
        config: {
          ...c.config,
          [fieldKey]: { ...c.config[fieldKey as keyof MiscConfig], value }
        }
      };
    }));
    setDirty(hasChanged);
  }, [miscConfig, originalConfig, setDirty]);

  const handleSaveConfig = async () => {
    if (!miscConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};

      // 保存预期配置项
      Object.entries(miscConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });

      // 保存预料之外的配置项
      if (miscConfig.rawConfig) {
        Object.entries(miscConfig.rawConfig).forEach(([key, field]) => {
          if (!EXPECTED_CONFIG_KEYS.includes(key) && 'value' in field) {
            configToSave[key] = field.value;
          }
        });
      }

      await frameworkConfigApi.updateFrameworkConfig(miscConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(miscConfig.config)));
      setOriginalRawConfig(JSON.parse(JSON.stringify(miscConfig.rawConfig)));
      setDirty(false);
      toast({ title: t('common.success'), description: t('miscConfig.configSaved') });
    } catch (error) {
      toast({
        title: t('common.saveFailed'),
        description: t('miscConfig.saveFailed') || 'Failed to update misc configuration',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigDirty = useMemo(() => {
    if (!miscConfig) return false;
    const configChanged = JSON.stringify(miscConfig.config) !== JSON.stringify(originalConfig);
    // 同时检查预料之外的配置项（rawConfig）是否有变化
    const rawConfigChanged = miscConfig.rawConfig && originalRawConfig ?
      JSON.stringify(miscConfig.rawConfig) !== JSON.stringify(originalRawConfig) : false;
    return configChanged || rawConfigChanged;
  }, [miscConfig, originalConfig, originalRawConfig]);

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!miscConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{t('miscConfig.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = miscConfig.config;

  return (
    <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
      {/* Display Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            {config.HelpMode.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Help Mode */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['light', 'dark'].map((mode) => (
              <button
                key={mode}
                onClick={() => handleChange('HelpMode', mode)}
                className={cn(
                  "h-10 px-3 rounded-lg border-2 transition-all flex items-center justify-center",
                  config.HelpMode.value === mode
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="font-medium text-sm">{mode === 'light' ? t('miscConfig.lightMode') : t('miscConfig.darkMode')}</span>
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{config.HelpMode.desc}</p>
        </CardContent>
      </Card>

      {/* Message Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t('miscConfig.message')}
          </CardTitle>
          <CardDescription>{t('miscConfig.messageDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* At Sender Position */}
          <div className="space-y-3">
            <Label>{config.AtSenderPos.title}</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['消息最前', '消息最后'].map((pos) => (
                <button
                  key={pos}
                  onClick={() => handleChange('AtSenderPos', pos)}
                  className={cn(
                    "h-10 px-3 rounded-lg border-2 transition-all flex items-center justify-center",
                    config.AtSenderPos.value === pos
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-medium text-sm">{pos}</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{config.AtSenderPos.desc}</p>
          </div>

          {/* Enable Forward Message */}
          <div className="space-y-3">
            <Label>{config.EnableForwardMessage.title}</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['允许', '禁止(不发送任何消息)', '合并为一条消息', '全部拆成单独消息'].map((option) => (
                <button
                  key={option}
                  onClick={() => handleChange('EnableForwardMessage', option)}
                  className={cn(
                    "h-10 px-3 rounded-lg border-2 transition-all flex items-center justify-center",
                    config.EnableForwardMessage.value === option
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-medium text-sm">{option}</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{config.EnableForwardMessage.desc}</p>
          </div>
        </CardContent>
      </Card>

      {/* Cooldown Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('miscConfig.cooldown')}
          </CardTitle>
          <CardDescription>{t('miscConfig.cooldownDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>{config.SameUserEventCD.title}</Label>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {CD_OPTIONS.map((cd) => (
                <button
                  key={cd}
                  onClick={() => handleChange('SameUserEventCD', cd)}
                  className={cn(
                    "h-10 px-3 rounded-lg border-2 transition-all flex items-center justify-center",
                    config.SameUserEventCD.value === cd
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-medium text-sm">{cd === 0 ? t('miscConfig.disabled') : `${cd}s`}</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{config.SameUserEventCD.desc}</p>
          </div>
        </CardContent>
      </Card>

      {/* Blacklist Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5" />
            {config.BlackList.title}
          </CardTitle>
          <CardDescription>{config.BlackList.desc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TagsInput
            value={config.BlackList.value}
            onChange={(value) => handleChange('BlackList', value)}
            placeholder={t('miscConfig.blackListPlaceholder')}
          />
          <p className="text-sm text-muted-foreground">{config.BlackList.desc}</p>
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
