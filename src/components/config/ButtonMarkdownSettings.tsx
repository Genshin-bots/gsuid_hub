import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Settings, Layout, FileText, List, Columns, ToggleLeft, ToggleRight, SplitSquareHorizontal } from 'lucide-react';
import { frameworkConfigApi, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { cn } from '@/lib/utils';

interface ButtonMarkdownConfig {
  SendMDPlatform: {
    value: string[];
    default: string[];
    options: string[];
    title: string;
    desc: string;
  };
  ButtonRow: {
    value: number;
    default: number;
    title: string;
    desc: string;
  };
  SendButtonsPlatform: {
    value: string[];
    default: string[];
    options: string[];
    title: string;
    desc: string;
  };
  SendTemplatePlatform: {
    value: string[];
    default: string[];
    options: string[];
    title: string;
    desc: string;
  };
  TryTemplateForQQ: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  ForceSendMD: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  UseCRLFReplaceLFForMD: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  SplitMDAndButtons: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
}

interface LocalButtonMarkdownConfig {
  id: string;
  name: string;
  full_name: string;
  config: ButtonMarkdownConfig;
}

const PLATFORM_OPTIONS = ['villa', 'kaiheila', 'dodo', 'discord', 'telegram', 'qqgroup', 'qqguild', 'web'];

const PLATFORMS = [
  { key: 'villa', label: '米游社大别野', color: 'bg-yellow-500' },
  { key: 'kaiheila', label: '开黑啦', color: 'bg-green-500' },
  { key: 'dodo', label: 'DoDo', color: 'bg-purple-500' },
  { key: 'discord', label: 'Discord', color: 'bg-indigo-500' },
  { key: 'telegram', label: 'Telegram', color: 'bg-sky-500' },
  { key: 'qqgroup', label: 'QQ群', color: 'bg-blue-500' },
  { key: 'qqguild', label: 'QQ频道', color: 'bg-blue-600' },
  { key: 'web', label: 'Web', color: 'bg-gray-500' },
] as const;

export default function ButtonMarkdownSettings() {
  const { t } = useLanguage();
  const { setDirty } = useConfigDirty();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalButtonMarkdownConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [buttonMdConfigName, setButtonMdConfigName] = useState<string>('');

  const buttonMdConfig = useMemo(() => {
    return configs.find(c =>
      c.name === '按钮和Markdown配置' ||
      c.full_name === '按钮和Markdown配置' ||
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
      setDirty(false);
    }
  }, [buttonMdConfig?.id, setDirty]);

  const handleChange = useCallback((fieldKey: string, value: string | number | boolean | string[]) => {
    if (!buttonMdConfig) return;

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

      Object.entries(buttonMdConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });

      await frameworkConfigApi.updateFrameworkConfig(buttonMdConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(buttonMdConfig.config)));
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
    return JSON.stringify(buttonMdConfig.config) !== JSON.stringify(originalConfig);
  }, [buttonMdConfig, originalConfig]);

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!buttonMdConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col -mt-2">
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{t('buttonMdConfig.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = buttonMdConfig.config;

  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col -mt-2">
      {/* Platform Selection Card */}
      <Card className="glass-card">
        <CardContent className="p-6 space-y-6">
          {/* Send MD Platform */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <Label>{config.SendMDPlatform.title}</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((platform) => {
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
                {PLATFORMS.map((platform) => {
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
                {PLATFORMS.filter(p => ['qqgroup', 'qqguild', 'web'].includes(p.key)).map((platform) => {
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
