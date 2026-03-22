import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Image, Globe, MessageSquare, Smartphone, MessageCircle, Send, Users, Building, Gamepad2, Cpu, Monitor, Link } from 'lucide-react';
import { frameworkConfigApi, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { cn } from '@/lib/utils';

interface ImageSendConfig {
  onebot: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  red: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  onebot_v12: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  qqguild: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  qqgroup: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  telegram: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  discord: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  kook: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  dodo: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  feishu: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  ntchat: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  villa: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  console: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
}

interface LocalImageSendConfig {
  id: string;
  name: string;
  full_name: string;
  config: ImageSendConfig;
}

const PLATFORM_OPTIONS = ['link', 'base64', 'link_local', 'link_remote'];

const PLATFORMS = [
  { key: 'onebot', label: 'OneBot', icon: MessageSquare, color: 'bg-green-500' },
  { key: 'onebot_v12', label: 'OneBot V12', icon: Send, color: 'bg-green-600' },
  { key: 'red', label: 'Red', icon: Smartphone, color: 'bg-red-500' },
  { key: 'qqguild', label: 'QQ Guild', icon: Building, color: 'bg-blue-500' },
  { key: 'qqgroup', label: 'QQ Group', icon: Users, color: 'bg-blue-600' },
  { key: 'telegram', label: 'Telegram', icon: Send, color: 'bg-sky-500' },
  { key: 'discord', label: 'Discord', icon: MessageCircle, color: 'bg-indigo-500' },
  { key: 'kook', label: 'KOOK', icon: MessageSquare, color: 'bg-pink-500' },
  { key: 'dodo', label: 'DoDo', icon: MessageCircle, color: 'bg-purple-500' },
  { key: 'feishu', label: '飞书', icon: Building, color: 'bg-orange-500' },
  { key: 'ntchat', label: 'NtChat', icon: Smartphone, color: 'bg-cyan-500' },
  { key: 'villa', label: '米游社大别野', icon: Gamepad2, color: 'bg-yellow-500' },
  { key: 'console', label: '本地Console', icon: Monitor, color: 'bg-gray-500' },
] as const;

export default function ImageSendSettings() {
  const { t } = useLanguage();
  const { setDirty } = useConfigDirty();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalImageSendConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [imageSendConfigName, setImageSendConfigName] = useState<string>('');

  const imageSendConfig = useMemo(() => {
    return configs.find(c =>
      c.name === '发送图片' ||
      c.full_name === '发送图片' ||
      c.full_name === imageSendConfigName
    );
  }, [configs, imageSendConfigName]);

  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore');
      const imageSendConfigList = data.filter(c => {
        const nameLower = c.name.toLowerCase();
        const fullNameLower = c.full_name.toLowerCase();
        return nameLower.includes('发送图片') ||
               fullNameLower.includes('发送图片') ||
               nameLower.includes('image send') ||
               fullNameLower.includes('image send');
      });

      if (imageSendConfigList.length > 0) {
        setConfigList(imageSendConfigList);
        setImageSendConfigName(imageSendConfigList[0].full_name);
      }
    } catch (error) {
      console.error('Failed to fetch image send config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('imageSendConfig.loadFailed') || 'Unable to load image send configuration',
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

      const convertedConfig: LocalImageSendConfig = {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        config: {
          onebot: {
            value: (data.config.onebot?.value || 'link_local') as string,
            default: (data.config.onebot?.default || 'link_local') as string,
            options: (data.config.onebot?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.onebot?.title || 'OneBot图片发送方式',
            desc: data.config.onebot?.desc || '可选link或base64'
          },
          red: {
            value: (data.config.red?.value || 'base64') as string,
            default: (data.config.red?.default || 'base64') as string,
            options: (data.config.red?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.red?.title || 'Red图片发送方式',
            desc: data.config.red?.desc || '可选link或base64'
          },
          onebot_v12: {
            value: (data.config.onebot_v12?.value || 'base64') as string,
            default: (data.config.onebot_v12?.default || 'base64') as string,
            options: (data.config.onebot_v12?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.onebot_v12?.title || 'OneBot V12图片发送方式',
            desc: data.config.onebot_v12?.desc || '可选link或base64'
          },
          qqguild: {
            value: (data.config.qqguild?.value || 'base64') as string,
            default: (data.config.qqguild?.default || 'base64') as string,
            options: (data.config.qqguild?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.qqguild?.title || 'QQ Guild图片发送方式',
            desc: data.config.qqguild?.desc || '可选link或base64'
          },
          qqgroup: {
            value: (data.config.qqgroup?.value || 'link') as string,
            default: (data.config.qqgroup?.default || 'link') as string,
            options: (data.config.qqgroup?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.qqgroup?.title || 'QQ Group图片发送方式',
            desc: data.config.qqgroup?.desc || '可选link或base64'
          },
          telegram: {
            value: (data.config.telegram?.value || 'base64') as string,
            default: (data.config.telegram?.default || 'base64') as string,
            options: (data.config.telegram?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.telegram?.title || 'Telegram图片发送方式',
            desc: data.config.telegram?.desc || '可选link或base64'
          },
          discord: {
            value: (data.config.discord?.value || 'base64') as string,
            default: (data.config.discord?.default || 'base64') as string,
            options: (data.config.discord?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.discord?.title || 'Discord图片发送方式',
            desc: data.config.discord?.desc || '可选link或base64'
          },
          kook: {
            value: (data.config.kook?.value || 'base64') as string,
            default: (data.config.kook?.default || 'base64') as string,
            options: (data.config.kook?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.kook?.title || 'KOOK图片发送方式',
            desc: data.config.kook?.desc || '可选link或base64'
          },
          dodo: {
            value: (data.config.dodo?.value || 'base64') as string,
            default: (data.config.dodo?.default || 'base64') as string,
            options: (data.config.dodo?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.dodo?.title || 'DoDo图片发送方式',
            desc: data.config.dodo?.desc || '可选link或base64'
          },
          feishu: {
            value: (data.config.feishu?.value || 'base64') as string,
            default: (data.config.feishu?.default || 'base64') as string,
            options: (data.config.feishu?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.feishu?.title || '飞书图片发送方式',
            desc: data.config.feishu?.desc || '可选link或base64'
          },
          ntchat: {
            value: (data.config.ntchat?.value || 'base64') as string,
            default: (data.config.ntchat?.default || 'base64') as string,
            options: (data.config.ntchat?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.ntchat?.title || 'NtChat图片发送方式',
            desc: data.config.ntchat?.desc || '可选link或base64'
          },
          villa: {
            value: (data.config.villa?.value || 'base64') as string,
            default: (data.config.villa?.default || 'base64') as string,
            options: (data.config.villa?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.villa?.title || '米游社大别野图片发送方式',
            desc: data.config.villa?.desc || '可选link或base64'
          },
          console: {
            value: (data.config.console?.value || 'link_local') as string,
            default: (data.config.console?.default || 'link_local') as string,
            options: (data.config.console?.options || PLATFORM_OPTIONS) as string[],
            title: data.config.console?.title || '本地client.py图片发送方式',
            desc: data.config.console?.desc || '可选link或base64'
          }
        }
      };

      setConfigs([convertedConfig]);
      setOriginalConfig(JSON.parse(JSON.stringify(convertedConfig.config)));
    } catch (error) {
      console.error('Failed to fetch image send config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('imageSendConfig.loadFailed') || 'Unable to load image send configuration',
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
    if (imageSendConfigName) {
      fetchConfigDetail(imageSendConfigName);
    }
  }, [imageSendConfigName]);

  useEffect(() => {
    if (imageSendConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(imageSendConfig.config)));
      setDirty(false);
    }
  }, [imageSendConfig?.id, setDirty]);

  const handleChange = useCallback((fieldKey: string, value: string) => {
    if (!imageSendConfig) return;

    const originalValue = originalConfig[fieldKey as keyof ImageSendConfig]?.value;
    const hasChanged = JSON.stringify(value) !== JSON.stringify(originalValue);

    setConfigs(prev => prev.map(c => {
      if (c.id !== imageSendConfig.id) return c;
      return {
        ...c,
        config: {
          ...c.config,
          [fieldKey]: { ...c.config[fieldKey as keyof ImageSendConfig], value }
        }
      };
    }));
    setDirty(hasChanged);
  }, [imageSendConfig, originalConfig, setDirty]);

  const handleSaveConfig = async () => {
    if (!imageSendConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};

      Object.entries(imageSendConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });

      await frameworkConfigApi.updateFrameworkConfig(imageSendConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(imageSendConfig.config)));
      setDirty(false);
      toast({ title: t('common.success'), description: t('imageSendConfig.configSaved') });
    } catch (error) {
      toast({
        title: t('common.saveFailed'),
        description: t('imageSendConfig.saveFailed') || 'Failed to update image send configuration',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigDirty = useMemo(() => {
    if (!imageSendConfig) return false;
    return JSON.stringify(imageSendConfig.config) !== JSON.stringify(originalConfig);
  }, [imageSendConfig, originalConfig]);

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!imageSendConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col -mt-2">
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{t('imageSendConfig.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = imageSendConfig.config;

  // Send method options with icons
  const SEND_METHODS = [
    { key: 'link', icon: Link, label: 'link', desc: t('imageSendConfig.linkDesc') },
    { key: 'base64', icon: Image, label: 'base64', desc: t('imageSendConfig.base64Desc') },
    { key: 'link_local', icon: Monitor, label: 'link_local', desc: t('imageSendConfig.linkLocalDesc') },
    { key: 'link_remote', icon: Globe, label: 'link_remote', desc: t('imageSendConfig.linkRemoteDesc') },
  ];

  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col -mt-2">
      {/* Help Text - Moved to top with better layout */}
      <Card className="glass-card border-primary/30 bg-primary/5">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="w-5 h-5 text-primary" />
            {t('imageSendConfig.sendMethodHelp')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SEND_METHODS.map((method) => {
              const Icon = method.icon;
              return (
                <div
                  key={method.key}
                  className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50"
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <code className="text-sm font-medium text-foreground">{method.label}</code>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{method.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATFORMS.map((platform) => {
          const platformConfig = config[platform.key as keyof ImageSendConfig];
          if (!platformConfig) return null;
          
          const Icon = platform.icon;
          const currentValue = platformConfig.value;
          
          return (
            <Card key={platform.key} className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", platform.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-base font-medium">{platform.label}</div>
                    <div className="text-xs text-muted-foreground font-normal">{platformConfig.desc}</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleChange(platform.key, option)}
                      className={cn(
                        "px-4 py-2.5 rounded-lg border-2 transition-all text-sm font-medium flex items-center justify-center flex-1 min-w-[80px]",
                        currentValue === option
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 bg-muted/30"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
