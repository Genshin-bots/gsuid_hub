import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Settings, Sun, Moon, MessageSquare, UserX, Shield, Clock, ListFilter } from 'lucide-react';
import { frameworkConfigApi, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { cn } from '@/lib/utils';

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

interface LocalMiscConfig {
  id: string;
  name: string;
  full_name: string;
  config: MiscConfig;
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
  const [miscConfigName, setMiscConfigName] = useState<string>('');
  const [blackListInput, setBlackListInput] = useState('');

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
      setDirty(false);
    }
  }, [miscConfig?.id, setDirty]);

  const handleChange = useCallback((fieldKey: string, value: string | number | boolean | string[]) => {
    if (!miscConfig) return;

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

  const handleAddBlackList = () => {
    if (!miscConfig || !blackListInput.trim()) return;
    const newBlackList = [...miscConfig.config.BlackList.value, blackListInput.trim()];
    handleChange('BlackList', newBlackList);
    setBlackListInput('');
  };

  const handleRemoveBlackList = (index: number) => {
    if (!miscConfig) return;
    const newBlackList = miscConfig.config.BlackList.value.filter((_, i) => i !== index);
    handleChange('BlackList', newBlackList);
  };

  const handleSaveConfig = async () => {
    if (!miscConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};

      Object.entries(miscConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });

      await frameworkConfigApi.updateFrameworkConfig(miscConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(miscConfig.config)));
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
    return JSON.stringify(miscConfig.config) !== JSON.stringify(originalConfig);
  }, [miscConfig, originalConfig]);

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!miscConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col -mt-2">
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
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col -mt-2">
      {/* Display Settings */}
      <Card className="glass-card">
        <CardContent className="p-6 space-y-6">
          {/* Help Mode */}
          <div className="space-y-3">
            <Label>{config.HelpMode.title}</Label>
            <div className="grid grid-cols-2 gap-3">
              {['light', 'dark'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleChange('HelpMode', mode)}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all flex items-center gap-3",
                    config.HelpMode.value === mode
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {mode === 'light' && <Sun className="w-5 h-5" />}
                  {mode === 'dark' && <Moon className="w-5 h-5" />}
                  <span className="font-medium">{mode === 'light' ? t('miscConfig.lightMode') : t('miscConfig.darkMode')}</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{config.HelpMode.desc}</p>
          </div>
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
            <div className="grid grid-cols-2 gap-3">
              {['消息最前', '消息最后'].map((pos) => (
                <button
                  key={pos}
                  onClick={() => handleChange('AtSenderPos', pos)}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all text-center",
                    config.AtSenderPos.value === pos
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-medium">{pos}</span>
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
                    "p-3 rounded-lg border-2 transition-all text-center",
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
            <div className="flex flex-wrap gap-3">
              {CD_OPTIONS.map((cd) => (
                <button
                  key={cd}
                  onClick={() => handleChange('SameUserEventCD', cd)}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all min-w-[80px]",
                    config.SameUserEventCD.value === cd
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="font-medium">{cd === 0 ? t('miscConfig.disabled') : `${cd}s`}</span>
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
          <div className="flex gap-3">
            <Input
              value={blackListInput}
              onChange={(e) => setBlackListInput(e.target.value)}
              placeholder={t('miscConfig.blackListPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddBlackList();
                }
              }}
            />
            <Button onClick={handleAddBlackList} className="gap-2">
              <Shield className="w-4 h-4" />
              {t('miscConfig.add')}
            </Button>
          </div>

          {config.BlackList.value.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {config.BlackList.value.map((item, index) => (
                <Badge key={index} variant="secondary" className="gap-2 px-3 py-1">
                  <span>{item}</span>
                  <button
                    onClick={() => handleRemoveBlackList(index)}
                    className="hover:text-destructive"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('miscConfig.emptyBlackList')}</p>
            </div>
          )}
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
