import { useState, useCallback, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Loader2, Save, Cpu } from 'lucide-react';
import { ConfigField, ConfigFieldDefinition, ConfigValue, ConfigFieldType } from '@/components/config';
import { frameworkConfigApi, PluginConfigItem, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import ImageUploadPage from '@/pages/ImageUploadPage';
import DatabaseConfigPage from '@/pages/DatabaseConfigPage';
import StateConfigPage from '@/pages/StateConfigPage';
import CoreSettings from '@/components/config/CoreSettings';
import MiscSettings from '@/components/config/MiscSettings';
import VerificationSettings from '@/components/config/VerificationSettings';
import ImageSendSettings from '@/components/config/ImageSendSettings';
import ButtonMarkdownSettings from '@/components/config/ButtonMarkdownSettings';

// Local config type with converted fields
interface LocalFrameworkConfig {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, ConfigFieldDefinition>;
}

// Convert API config to local config type
const convertToConfig = (config: Record<string, PluginConfigItem>): Record<string, ConfigFieldDefinition> => {
  const result: Record<string, ConfigFieldDefinition> = {};
  for (const [key, value] of Object.entries(config)) {
    const configItem = value as PluginConfigItem;
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
    
    result[key] = {
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
      upload_to: configItem.upload_to,
      filename: configItem.filename,
      suffix: configItem.suffix,
    } as unknown as ConfigFieldDefinition & { default: unknown; rawType: string };
  }
  return result;
};

export default function FrameworkConfigPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const { isDirty, setDirty } = useConfigDirty();
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<LocalFrameworkConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Track original state for change detection
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  
  // Check if tabs can fit in one row
  const containerRef = useRef<HTMLDivElement>(null);
  const [canFitTabs, setCanFitTabs] = useState(true);
  
  useLayoutEffect(() => {
    const checkFit = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const tabWidth = configList.length * 140 + 16; // Approximate tab width + padding
      setCanFitTabs(containerWidth >= tabWidth);
    };
    
    checkFit();
    window.addEventListener('resize', checkFit);
    return () => window.removeEventListener('resize', checkFit);
  }, [configList.length]);
  
  // Get current selected config
  const selectedConfig = useMemo(() => {
    return configs.find(c => c.id === selectedConfigId);
  }, [configs, selectedConfigId]);
  
  // Change detection
  const isConfigDirty = useMemo(() => {
    if (!selectedConfig) return false;
    return JSON.stringify(selectedConfig.config) !== JSON.stringify(originalConfig);
  }, [selectedConfig?.config, originalConfig]);
  
  // Fetch config list from API (轻量级接口)
  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore');
      // Filter out backup config and AI configs as they're handled in separate pages
      const filtered = data.filter(c => {
        const nameLower = c.name.toLowerCase();
        const fullNameLower = c.full_name.toLowerCase();
        return nameLower !== 'backup' &&
          nameLower !== '备份配置' &&
          !nameLower.startsWith('gscore ai') &&
          !fullNameLower.startsWith('gscore ai');
      });
      setConfigList(filtered);
      
      // If has configs and none selected, select first
      if (filtered.length > 0 && !selectedConfigId) {
        setSelectedConfigId(filtered[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch framework config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('frameworkConfig.loadFailed') || 'Unable to load framework configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch config detail for a specific config
  const fetchConfigDetail = async (configName: string) => {
    try {
      setIsLoadingDetail(true);
      const data = await frameworkConfigApi.getFrameworkConfig(configName);
      const converted = {
        ...data,
        config: convertToConfig(data.config)
      };
      
      setConfigs(prev => {
        // Remove existing config with same id if exists, then add new one
        const filtered = prev.filter(c => c.id !== data.id);
        return [...filtered, converted];
      });
      
      // If this is the selected config, set original config
      if (data.id === selectedConfigId) {
        setOriginalConfig(JSON.parse(JSON.stringify(converted.config)));
      }
    } catch (error) {
      console.error('Failed to fetch framework config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('frameworkConfig.loadFailed') || 'Unable to load framework configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };
  
  useEffect(() => {
    fetchConfigList();
  }, []);

  // Fetch detail when selected config changes
  useEffect(() => {
    if (selectedConfigId) {
      // Check if we already have the detail for this config
      const existingConfig = configs.find(c => c.id === selectedConfigId);
      if (!existingConfig) {
        // Need to fetch detail for this config
        const configInfo = configList.find(c => c.id === selectedConfigId);
        if (configInfo) {
          fetchConfigDetail(configInfo.full_name);
        }
      }
    }
  }, [selectedConfigId, configList, configs]);
  
  // Update original state when selected config changes
  useEffect(() => {
    if (selectedConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(selectedConfig.config)));
      setDirty(false);
    }
  }, [selectedConfigId, setDirty]);
  
  const updateConfigValue = useCallback((fieldKey: string, value: ConfigValue) => {
    setConfigs(prev =>
      prev.map(c =>
        c.id === selectedConfigId
          ? {
              ...c,
              config: {
                ...c.config,
                [fieldKey]: { ...c.config[fieldKey], value },
              },
            }
          : c
      )
    );
    setDirty(true);
  }, [selectedConfigId, setDirty]);
  
  const handleSaveConfig = async () => {
    const currentConfig = configs.find(c => c.id === selectedConfigId);
    if (!currentConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};
      Object.entries(currentConfig.config).forEach(([key, field]: [string, any]) => {
        configToSave[key] = field.value;
      });
      await frameworkConfigApi.updateFrameworkConfig(currentConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(currentConfig.config)));
      setDirty(false);
      toast({ title: t('common.success'), description: t('frameworkConfig.configSaved') });
    } catch (error) {
      toast({ title: t('common.saveFailed'), description: t('frameworkConfig.saveFailed') || 'Failed to update framework configuration', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Cpu className="w-8 h-8" />
            {t('frameworkConfig.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('frameworkConfig.description')}</p>
        </div>
      </div>
      
      <div ref={containerRef} className="flex items-center justify-between w-full">
        {canFitTabs ? (
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border/40 w-fit">
            {configList.map((config) => (
              <button
                key={config.id}
                onClick={() => setSelectedConfigId(config.id)}
                disabled={isLoading}
                className={`
                  relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200
                  ${selectedConfigId === config.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }
                `}
              >
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  {config.name}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Card className="glass-card w-full sm:w-fit">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Settings className="w-4 h-4" />
                  <span>{t('frameworkConfig.selectConfig')}</span>
                </div>
                <div className="flex-1 w-full">
                  <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger className="w-full sm:w-[300px] bg-background/50">
                      <SelectValue placeholder={t('frameworkConfig.selectConfig')} />
                    </SelectTrigger>
                    <SelectContent>
                      {configList.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          <span className="flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            {config.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : !selectedConfig || isLoadingDetail ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (selectedConfig.name === 'GsCore图片上传' || selectedConfig.full_name === 'GsCore图片上传') ? (
        <ImageUploadPage />
      ) : (selectedConfig.name === 'GsCore数据库配置' || selectedConfig.full_name === 'GsCore数据库配置') ? (
        <DatabaseConfigPage />
      ) : (selectedConfig.name === 'GsCore状态配置' || selectedConfig.full_name === 'GsCore状态配置') ? (
        <StateConfigPage />
      ) : (selectedConfig.name === '核心配置' || selectedConfig.full_name === 'GsCore') ? (
        <CoreSettings />
      ) : (selectedConfig.name === '杂项配置' || selectedConfig.full_name === '杂项配置') ? (
        <MiscSettings />
      ) : (selectedConfig.name === '验证配置' || selectedConfig.full_name === '验证配置') ? (
        <VerificationSettings />
      ) : (selectedConfig.name === '发送图片' || selectedConfig.full_name === '发送图片') ? (
        <ImageSendSettings />
      ) : (selectedConfig.name === '按钮和Markdown配置' || selectedConfig.full_name === '按钮和Markdown配置') ? (
        <ButtonMarkdownSettings />
      ) : !selectedConfig.config || Object.keys(selectedConfig.config).length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="text-center py-8 text-muted-foreground">
              暂无框架配置
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="glass-card">
            <CardContent className="p-6">
              {Object.keys(selectedConfig.config).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  该配置组暂无参数配置项
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(selectedConfig.config).map(([key, field]: [string, any]) => (
                    <ConfigField
                      key={key}
                      fieldKey={key}
                      field={field}
                      onChange={updateConfigValue}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
        </>
      )}
    </div>
  );
}