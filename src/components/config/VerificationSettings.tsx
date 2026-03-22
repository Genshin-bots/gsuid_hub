import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Settings, Shield, AlertTriangle, Key, Eye, EyeOff } from 'lucide-react';
import { frameworkConfigApi, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { cn } from '@/lib/utils';

interface VerificationConfig {
  _pass_API: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  CaptchaPass: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  MysPass: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
}

interface LocalVerificationConfig {
  id: string;
  name: string;
  full_name: string;
  config: VerificationConfig;
}

export default function VerificationSettings() {
  const { t } = useLanguage();
  const { setDirty } = useConfigDirty();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalVerificationConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [verificationConfigName, setVerificationConfigName] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState(false);

  const verificationConfig = useMemo(() => {
    return configs.find(c =>
      c.name === '验证配置' ||
      c.full_name === '验证配置' ||
      c.full_name === verificationConfigName
    );
  }, [configs, verificationConfigName]);

  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore');
      const verificationConfigList = data.filter(c => {
        const nameLower = c.name.toLowerCase();
        const fullNameLower = c.full_name.toLowerCase();
        return nameLower.includes('验证') ||
               fullNameLower.includes('verify') ||
               fullNameLower.includes('verification') ||
               fullNameLower.includes('验证配置');
      });

      if (verificationConfigList.length > 0) {
        setConfigList(verificationConfigList);
        setVerificationConfigName(verificationConfigList[0].full_name);
      }
    } catch (error) {
      console.error('Failed to fetch verification config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('verificationConfig.loadFailed') || 'Unable to load verification configuration',
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

      const convertedConfig: LocalVerificationConfig = {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        config: {
          _pass_API: {
            value: (data.config._pass_API?.value || '') as string,
            default: (data.config._pass_API?.default || '') as string,
            title: data.config._pass_API?.title || '神奇API',
            desc: data.config._pass_API?.desc || '设置某种神奇的API'
          },
          CaptchaPass: {
            value: (data.config.CaptchaPass?.value ?? true) as boolean,
            default: (data.config.CaptchaPass?.default ?? true) as boolean,
            title: data.config.CaptchaPass?.title || '失效项',
            desc: data.config.CaptchaPass?.desc || '该选项已经无效且可能有一定危险性...'
          },
          MysPass: {
            value: (data.config.MysPass?.value ?? false) as boolean,
            default: (data.config.MysPass?.default ?? false) as boolean,
            title: data.config.MysPass?.title || '无效项',
            desc: data.config.MysPass?.desc || '该选项已经无效且可能有一定危险性...'
          }
        }
      };

      setConfigs([convertedConfig]);
      setOriginalConfig(JSON.parse(JSON.stringify(convertedConfig.config)));
    } catch (error) {
      console.error('Failed to fetch verification config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('verificationConfig.loadFailed') || 'Unable to load verification configuration',
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
    if (verificationConfigName) {
      fetchConfigDetail(verificationConfigName);
    }
  }, [verificationConfigName]);

  useEffect(() => {
    if (verificationConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(verificationConfig.config)));
      setDirty(false);
    }
  }, [verificationConfig?.id, setDirty]);

  const handleChange = useCallback((fieldKey: string, value: string | boolean) => {
    if (!verificationConfig) return;

    const originalValue = originalConfig[fieldKey as keyof VerificationConfig]?.value;
    const hasChanged = JSON.stringify(value) !== JSON.stringify(originalValue);

    setConfigs(prev => prev.map(c => {
      if (c.id !== verificationConfig.id) return c;
      return {
        ...c,
        config: {
          ...c.config,
          [fieldKey]: { ...c.config[fieldKey as keyof VerificationConfig], value }
        }
      };
    }));
    setDirty(hasChanged);
  }, [verificationConfig, originalConfig, setDirty]);

  const handleSaveConfig = async () => {
    if (!verificationConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};

      Object.entries(verificationConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });

      await frameworkConfigApi.updateFrameworkConfig(verificationConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(verificationConfig.config)));
      setDirty(false);
      toast({ title: t('common.success'), description: t('verificationConfig.configSaved') });
    } catch (error) {
      toast({
        title: t('common.saveFailed'),
        description: t('verificationConfig.saveFailed') || 'Failed to update verification configuration',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigDirty = useMemo(() => {
    if (!verificationConfig) return false;
    return JSON.stringify(verificationConfig.config) !== JSON.stringify(originalConfig);
  }, [verificationConfig, originalConfig]);

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!verificationConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{t('verificationConfig.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const config = verificationConfig.config;

  return (
    <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
      {/* Warning Card */}
      <Card className="glass-card border-amber-500/50 bg-amber-500/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-amber-600 font-medium">
            <AlertTriangle className="w-5 h-5" />
            {t('verificationConfig.warning')}
          </div>
          <p className="text-sm text-amber-600/80 mt-1">
            {t('verificationConfig.warningDesc')}
          </p>
        </CardContent>
      </Card>

      {/* API Settings */}
      <Card className="glass-card">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="_pass_API">{config._pass_API.title}</Label>
            <div className="relative">
              <Input
                id="_pass_API"
                type={showApiKey ? 'text' : 'password'}
                value={config._pass_API.value}
                onChange={(e) => handleChange('_pass_API', e.target.value)}
                placeholder={config._pass_API.desc}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-sm text-muted-foreground">{config._pass_API.desc}</p>
          </div>
        </CardContent>
      </Card>

      {/* Deprecated Options */}
      <Card className="glass-card border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {t('verificationConfig.deprecated')}
          </CardTitle>
          <CardDescription>{t('verificationConfig.deprecatedDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CaptchaPass */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium">{config.CaptchaPass.title}</p>
                <p className="text-sm text-muted-foreground">{config.CaptchaPass.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/50">
                {t('verificationConfig.deprecated')}
              </Badge>
              <Switch
                checked={config.CaptchaPass.value}
                onCheckedChange={(checked) => handleChange('CaptchaPass', checked)}
              />
            </div>
          </div>

          {/* MysPass */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium">{config.MysPass.title}</p>
                <p className="text-sm text-muted-foreground">{config.MysPass.desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/50">
                {t('verificationConfig.deprecated')}
              </Badge>
              <Switch
                checked={config.MysPass.value}
                onCheckedChange={(checked) => handleChange('MysPass', checked)}
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
