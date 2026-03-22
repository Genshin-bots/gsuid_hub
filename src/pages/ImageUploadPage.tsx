import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Image, Loader2, Save, Cloud, Server, HardDrive, Code, Globe, Trash2, Clock } from 'lucide-react';
import { frameworkConfigApi, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const UPLOAD_TYPES = ['smms', 's3', 'local', 'custom'] as const;
type UploadType = typeof UPLOAD_TYPES[number];

interface ImageUploadConfig {
  EnablePicSrv: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  PicUploader: {
    value: string;
    default: string;
    options: string[];
    title: string;
    desc: string;
  };
  AutoDelete: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  smms_token: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  s3_endpoint: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  s3_access_key: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  s3_secret_key: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  s3_bucket: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  s3_region: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  custom_url: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  custom_header: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  PicSrv: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
  EnableCleanPicSrv: {
    value: boolean;
    default: boolean;
    title: string;
    desc: string;
  };
  ScheduledCleanPicSrv: {
    value: string;
    default: string;
    title: string;
    desc: string;
  };
}

interface LocalImageUploadConfig {
  id: string;
  name: string;
  full_name: string;
  config: ImageUploadConfig;
}

export default function ImageUploadPage() {
  const { t } = useLanguage();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalImageUploadConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [imageUploadConfigName, setImageUploadConfigName] = useState<string>('');

  const imageUploadConfig = useMemo(() => {
    return configs.find(c =>
      c.name === 'GsCore图片上传' ||
      c.full_name === 'GsCore图片上传' ||
      c.id === 'GsCore图片上传' ||
      c.full_name === imageUploadConfigName
    );
  }, [configs, imageUploadConfigName]);

  const currentUploadType = (imageUploadConfig?.config?.PicUploader?.value) as UploadType || 'smms';

  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore');
      const imgConfigList = data.filter(c => {
        const nameLower = c.name.toLowerCase();
        const fullNameLower = c.full_name.toLowerCase();
        return nameLower.includes('图片') ||
               fullNameLower.includes('图片') ||
               nameLower.includes('image') ||
               fullNameLower.includes('image') ||
               nameLower.includes('upload') ||
               fullNameLower.includes('upload');
      });
      
      if (imgConfigList.length > 0) {
        setConfigList(imgConfigList);
        setImageUploadConfigName(imgConfigList[0].full_name);
      }
    } catch (error) {
      console.error('Failed to fetch image upload config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('imageUpload.loadFailed') || 'Unable to load image upload configuration',
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
      
      const convertedConfig: LocalImageUploadConfig = {
        id: data.id,
        name: data.name,
        full_name: data.full_name,
        config: {
          EnablePicSrv: {
            value: (data.config.EnablePicSrv?.value ?? false) as boolean,
            default: (data.config.EnablePicSrv?.default ?? false) as boolean,
            title: data.config.EnablePicSrv?.title || '启用将图片转链接发送(需公网)',
            desc: data.config.EnablePicSrv?.desc || '发送图片转链接'
          },
          PicUploader: {
            value: (data.config.PicUploader?.value || 'smms') as string,
            default: (data.config.PicUploader?.default || 'smms') as string,
            options: (data.config.PicUploader?.options || ['smms', 's3', 'local', 'custom']) as string[],
            title: data.config.PicUploader?.title || '上传图片方式',
            desc: data.config.PicUploader?.desc || '可选s3或smms或custom或local'
          },
          AutoDelete: {
            value: (data.config.AutoDelete?.value ?? true) as boolean,
            default: (data.config.AutoDelete?.default ?? true) as boolean,
            title: data.config.AutoDelete?.title || '上传完后自动删除',
            desc: data.config.AutoDelete?.desc || '是否自动删除图片'
          },
          smms_token: {
            value: (data.config.smms_token?.value || '') as string,
            default: (data.config.smms_token?.default || '') as string,
            title: data.config.smms_token?.title || 'sm.ms_token',
            desc: data.config.smms_token?.desc || 'sm.ms的token'
          },
          s3_endpoint: {
            value: (data.config.s3_endpoint?.value || '') as string,
            default: (data.config.s3_endpoint?.default || '') as string,
            title: data.config.s3_endpoint?.title || 's3_endpoint',
            desc: data.config.s3_endpoint?.desc || '终结点url'
          },
          s3_access_key: {
            value: (data.config.s3_access_key?.value || '') as string,
            default: (data.config.s3_access_key?.default || '') as string,
            title: data.config.s3_access_key?.title || 's3_access_key',
            desc: data.config.s3_access_key?.desc || 'AK'
          },
          s3_secret_key: {
            value: (data.config.s3_secret_key?.value || '') as string,
            default: (data.config.s3_secret_key?.default || '') as string,
            title: data.config.s3_secret_key?.title || 's3_secret_key',
            desc: data.config.s3_secret_key?.desc || 'SK'
          },
          s3_bucket: {
            value: (data.config.s3_bucket?.value || '') as string,
            default: (data.config.s3_bucket?.default || '') as string,
            title: data.config.s3_bucket?.title || 's3_bucket',
            desc: data.config.s3_bucket?.desc || 'Bucket'
          },
          s3_region: {
            value: (data.config.s3_region?.value || '') as string,
            default: (data.config.s3_region?.default || '') as string,
            title: data.config.s3_region?.title || 's3_region',
            desc: data.config.s3_region?.desc || 'Region'
          },
          custom_url: {
            value: (data.config.custom_url?.value || '') as string,
            default: (data.config.custom_url?.default || '') as string,
            title: data.config.custom_url?.title || '自定义上传图片API',
            desc: data.config.custom_url?.desc || '填入上传图片API'
          },
          custom_header: {
            value: (data.config.custom_header?.value || '') as string,
            default: (data.config.custom_header?.default || '') as string,
            title: data.config.custom_header?.title || '自定义上传图片Header',
            desc: data.config.custom_header?.desc || '填入上传图片header'
          },
          PicSrv: {
            value: (data.config.PicSrv?.value || '') as string,
            default: (data.config.PicSrv?.default || '') as string,
            title: data.config.PicSrv?.title || '图片转链接为(需公网)',
            desc: data.config.PicSrv?.desc || '发送图片转链接'
          },
          EnableCleanPicSrv: {
            value: (data.config.EnableCleanPicSrv?.value ?? true) as boolean,
            default: (data.config.EnableCleanPicSrv?.default ?? true) as boolean,
            title: data.config.EnableCleanPicSrv?.title || '是否定期清理本地图床',
            desc: data.config.EnableCleanPicSrv?.desc || '定期清理图床开关'
          },
          ScheduledCleanPicSrv: {
            value: (data.config.ScheduledCleanPicSrv?.value || '180') as string,
            default: (data.config.ScheduledCleanPicSrv?.default || '180') as string,
            title: data.config.ScheduledCleanPicSrv?.title || '本地图床定期清理(秒)',
            desc: data.config.ScheduledCleanPicSrv?.desc || '定期删除图片'
          }
        }
      };
      
      setConfigs([convertedConfig]);
      setOriginalConfig(JSON.parse(JSON.stringify(convertedConfig.config)));
    } catch (error) {
      console.error('Failed to fetch image upload config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('imageUpload.loadFailed') || 'Unable to load image upload configuration',
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
    if (imageUploadConfigName) {
      fetchConfigDetail(imageUploadConfigName);
    }
  }, [imageUploadConfigName]);

  useEffect(() => {
    if (imageUploadConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(imageUploadConfig.config)));
    }
  }, [imageUploadConfig?.id]);

  const handleChange = useCallback((fieldKey: string, value: string | number | boolean) => {
    if (!imageUploadConfig) return;
    
    setConfigs(prev => prev.map(c => {
      if (c.id !== imageUploadConfig.id) return c;
      return {
        ...c,
        config: {
          ...c.config,
          [fieldKey]: { ...c.config[fieldKey as keyof ImageUploadConfig], value }
        }
      };
    }));
    setIsDirty(true);
  }, [imageUploadConfig]);

  const handleSaveConfig = async () => {
    if (!imageUploadConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};
      
      Object.entries(imageUploadConfig.config).forEach(([key, field]) => {
        if (field && typeof field === 'object' && 'value' in field) {
          configToSave[key] = (field as { value: any }).value;
        }
      });
      
      await frameworkConfigApi.updateFrameworkConfig(imageUploadConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(imageUploadConfig.config)));
      toast({ title: t('common.success'), description: t('imageUpload.configSaved') });
    } catch (error) {
      toast({ 
        title: t('common.saveFailed'), 
        description: t('imageUpload.saveFailed') || 'Failed to update image upload configuration', 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConfigDirty = useMemo(() => {
    if (!imageUploadConfig) return false;
    return JSON.stringify(imageUploadConfig.config) !== JSON.stringify(originalConfig);
  }, [imageUploadConfig, originalConfig]);

  if (isLoading || isLoadingDetail) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!imageUploadConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
        <Card className="glass-card">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{t('imageUpload.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const uploadConfig = imageUploadConfig.config;
  const isPicSrvEnabled = uploadConfig.EnablePicSrv.value;

  return (
    <div className="space-y-6 flex-1 overflow-visible h-full flex flex-col">
      {/* Image Service Toggle - First as main switch */}
      <Card className={cn("glass-card", !isPicSrvEnabled && "opacity-60")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('imageUpload.imageService')}
          </CardTitle>
          <CardDescription>{t('imageUpload.imageServiceDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isPicSrvEnabled ? "bg-green-500/20" : "bg-muted"
              )}>
                <Globe className={cn(
                  "w-5 h-5",
                  isPicSrvEnabled ? "text-green-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{t('imageUpload.enablePicSrv')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('imageUpload.enablePicSrvDesc')}
                </p>
              </div>
            </div>
            <Switch
              checked={isPicSrvEnabled}
              onCheckedChange={(checked) => handleChange('EnablePicSrv', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto Delete - Common setting, before upload method */}
      <Card className={cn("glass-card", !isPicSrvEnabled && "opacity-60")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            {t('imageUpload.autoDelete')}
          </CardTitle>
          <CardDescription>{t('imageUpload.autoDeleteDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                uploadConfig.AutoDelete.value ? "bg-orange-500/20" : "bg-muted"
              )}>
                <Trash2 className={cn(
                  "w-5 h-5",
                  uploadConfig.AutoDelete.value ? "text-orange-500" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium">{t('imageUpload.autoDeleteTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('imageUpload.autoDeleteHelp')}
                </p>
              </div>
            </div>
            <Switch
              checked={uploadConfig.AutoDelete.value}
              onCheckedChange={(checked) => handleChange('AutoDelete', checked)}
              disabled={!isPicSrvEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Upload Method Selection */}
      <Card className={cn("glass-card", !isPicSrvEnabled && "opacity-60")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            {t('imageUpload.uploadMethod')}
          </CardTitle>
          <CardDescription>{t('imageUpload.uploadMethodDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {UPLOAD_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => isPicSrvEnabled && handleChange('PicUploader', type)}
                disabled={!isPicSrvEnabled}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all text-left",
                  currentUploadType === type && isPicSrvEnabled
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50",
                  !isPicSrvEnabled && "cursor-not-allowed opacity-50"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {type === 'smms' && <Cloud className="w-5 h-5" />}
                  {type === 's3' && <Server className="w-5 h-5" />}
                  {type === 'local' && <HardDrive className="w-5 h-5" />}
                  {type === 'custom' && <Code className="w-5 h-5" />}
                  <span className="font-medium">{type.toUpperCase()}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {type === 'smms' && t('imageUpload.smmsDesc')}
                  {type === 's3' && t('imageUpload.s3Desc')}
                  {type === 'local' && t('imageUpload.localDesc')}
                  {type === 'custom' && t('imageUpload.customDesc')}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SMMS Configuration */}
      {currentUploadType === 'smms' && (
        <Card className={cn("glass-card", !isPicSrvEnabled && "opacity-60")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              {t('imageUpload.smmsSettings')}
            </CardTitle>
            <CardDescription>{t('imageUpload.smmsSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="smms_token" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                {t('imageUpload.smmsToken')}
              </Label>
              <Input
                id="smms_token"
                type="password"
                value={uploadConfig.smms_token.value}
                onChange={(e) => handleChange('smms_token', e.target.value)}
                placeholder={t('imageUpload.smmsTokenPlaceholder')}
                disabled={!isPicSrvEnabled}
              />
              <p className="text-sm text-muted-foreground">{t('imageUpload.smmsTokenHelp')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* S3 Configuration */}
      {currentUploadType === 's3' && (
        <Card className={cn("glass-card", !isPicSrvEnabled && "opacity-60")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              {t('imageUpload.s3Settings')}
            </CardTitle>
            <CardDescription>{t('imageUpload.s3SettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s3_endpoint" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                {t('imageUpload.s3Endpoint')}
              </Label>
              <Input
                id="s3_endpoint"
                value={uploadConfig.s3_endpoint.value}
                onChange={(e) => handleChange('s3_endpoint', e.target.value)}
                placeholder={t('imageUpload.s3EndpointPlaceholder')}
                disabled={!isPicSrvEnabled}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="s3_access_key" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                  {t('imageUpload.s3AccessKey')}
                </Label>
                <Input
                  id="s3_access_key"
                  type="password"
                  value={uploadConfig.s3_access_key.value}
                  onChange={(e) => handleChange('s3_access_key', e.target.value)}
                  placeholder={t('imageUpload.s3AccessKeyPlaceholder')}
                  disabled={!isPicSrvEnabled}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="s3_secret_key" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                  {t('imageUpload.s3SecretKey')}
                </Label>
                <Input
                  id="s3_secret_key"
                  type="password"
                  value={uploadConfig.s3_secret_key.value}
                  onChange={(e) => handleChange('s3_secret_key', e.target.value)}
                  placeholder={t('imageUpload.s3SecretKeyPlaceholder')}
                  disabled={!isPicSrvEnabled}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="s3_bucket" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                  {t('imageUpload.s3Bucket')}
                </Label>
                <Input
                  id="s3_bucket"
                  value={uploadConfig.s3_bucket.value}
                  onChange={(e) => handleChange('s3_bucket', e.target.value)}
                  placeholder={t('imageUpload.s3BucketPlaceholder')}
                  disabled={!isPicSrvEnabled}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="s3_region" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                  {t('imageUpload.s3Region')}
                </Label>
                <Input
                  id="s3_region"
                  value={uploadConfig.s3_region.value}
                  onChange={(e) => handleChange('s3_region', e.target.value)}
                  placeholder={t('imageUpload.s3RegionPlaceholder')}
                  disabled={!isPicSrvEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Local Configuration */}
      {currentUploadType === 'local' && (
        <>
          <Card className={cn("glass-card", !isPicSrvEnabled && "opacity-60")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                {t('imageUpload.localSettings')}
              </CardTitle>
              <CardDescription>{t('imageUpload.localSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">{t('imageUpload.localDefault')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t('imageUpload.localDefaultPath')}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-600">
                  {t('imageUpload.local')}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="PicSrv" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                  {t('imageUpload.picSrvUrl')}
                </Label>
                <Input
                  id="PicSrv"
                  value={uploadConfig.PicSrv.value}
                  onChange={(e) => handleChange('PicSrv', e.target.value)}
                  placeholder={t('imageUpload.picSrvPlaceholder')}
                  disabled={!isPicSrvEnabled}
                />
                <p className="text-sm text-muted-foreground">{t('imageUpload.picSrvHelp')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Clean - Local only */}
          <Card className={cn("glass-card", !isPicSrvEnabled && "opacity-60")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {t('imageUpload.scheduledClean')}
              </CardTitle>
              <CardDescription>{t('imageUpload.scheduledCleanDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      uploadConfig.EnableCleanPicSrv.value ? "bg-purple-500/20" : "bg-muted"
                    )}>
                      <Clock className={cn(
                        "w-5 h-5",
                        uploadConfig.EnableCleanPicSrv.value ? "text-purple-500" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <p className="font-medium">{t('imageUpload.enableScheduledClean')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('imageUpload.enableScheduledCleanHelp')}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={uploadConfig.EnableCleanPicSrv.value}
                    onCheckedChange={(checked) => handleChange('EnableCleanPicSrv', checked)}
                    disabled={!isPicSrvEnabled}
                  />
                </div>
                
                {uploadConfig.EnableCleanPicSrv.value && isPicSrvEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="ScheduledCleanPicSrv">{t('imageUpload.cleanInterval')}</Label>
                    <Input
                      id="ScheduledCleanPicSrv"
                      type="number"
                      value={uploadConfig.ScheduledCleanPicSrv.value}
                      onChange={(e) => handleChange('ScheduledCleanPicSrv', e.target.value)}
                      placeholder={t('imageUpload.cleanIntervalPlaceholder')}
                    />
                    <p className="text-sm text-muted-foreground">{t('imageUpload.cleanIntervalHelp')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Custom API Configuration */}
      {currentUploadType === 'custom' && (
        <Card className={cn("glass-card", !isPicSrvEnabled && "opacity-60")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              {t('imageUpload.customSettings')}
            </CardTitle>
            <CardDescription>{t('imageUpload.customSettingsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom_url" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                {t('imageUpload.customUrl')}
              </Label>
              <Input
                id="custom_url"
                value={uploadConfig.custom_url.value}
                onChange={(e) => handleChange('custom_url', e.target.value)}
                placeholder={t('imageUpload.customUrlPlaceholder')}
                disabled={!isPicSrvEnabled}
              />
              <p className="text-sm text-muted-foreground">{t('imageUpload.customUrlHelp')}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="custom_header" className={cn(!isPicSrvEnabled && "text-muted-foreground")}>
                {t('imageUpload.customHeader')}
              </Label>
              <Input
                id="custom_header"
                value={uploadConfig.custom_header.value}
                onChange={(e) => handleChange('custom_header', e.target.value)}
                placeholder={t('imageUpload.customHeaderPlaceholder')}
                disabled={!isPicSrvEnabled}
              />
              <p className="text-sm text-muted-foreground">{t('imageUpload.customHeaderHelp')}</p>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSaveConfig}
          disabled={!isDirty || isSaving}
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