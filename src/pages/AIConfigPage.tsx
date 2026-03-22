import { useState, useCallback, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Loader2, Save, Cpu } from 'lucide-react';
import { ConfigField, ConfigFieldDefinition, ConfigValue, ConfigFieldType } from '@/components/config';
import { frameworkConfigApi, PluginConfigItem, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

// Remove "AI " prefix from config name for display
const getDisplayName = (name: string): string => {
  // Handle names starting with "AI " (including leading space)
  const trimmed = name.trimStart();
  if (trimmed.toLowerCase().startsWith('ai ')) {
    return trimmed.substring(3);
  }
  return trimmed;
};

export default function AIConfigPage() {
  const { t } = useLanguage();
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
  
  // Fetch AI config list from API (轻量级接口)
  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore AI');
      setConfigList(data);
      
      // If has configs and none selected, select first
      if (data.length > 0) {
        setSelectedConfigId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch AI config list:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('aiConfig.loadFailed') || 'Unable to load AI configuration',
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
      console.error('Failed to fetch AI config detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('aiConfig.loadFailed') || 'Unable to load AI configuration',
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
    if (selectedConfigId && configList.length > 0) {
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
  }, [selectedConfigId, configList, configs, fetchConfigDetail]);
  
  // Update original state when selected config changes
  useEffect(() => {
    if (selectedConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(selectedConfig.config)));
    }
  }, [selectedConfig?.id]);
  
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
  }, [selectedConfigId]);
  
  const handleSaveConfig = async () => {
    if (!selectedConfig) return;
    try {
      setIsSaving(true);
      const configToSave: Record<string, any> = {};
      Object.entries(selectedConfig.config).forEach(([key, field]: [string, any]) => {
        configToSave[key] = field.value;
      });
      await frameworkConfigApi.updateFrameworkConfig(selectedConfig.full_name, configToSave);
      setOriginalConfig(JSON.parse(JSON.stringify(selectedConfig.config)));
      toast({ title: t('common.success'), description: t('aiConfig.configSaved') });
    } catch (error) {
      toast({ title: t('common.saveFailed'), description: t('aiConfig.saveFailed') || 'Failed to update AI configuration', variant: 'destructive' });
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
            {t('aiConfig.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('aiConfig.description')}</p>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : configList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('aiConfig.noAIConfig')}
        </div>
      ) : (
        <>
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
                      {getDisplayName(config.name)}
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
                      <span>{t('aiConfig.selectConfig')}</span>
                    </div>
                    <div className="flex-1 w-full">
                      <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                        <SelectTrigger className="w-full sm:w-[300px] bg-background/50">
                          <SelectValue placeholder={t('aiConfig.selectConfig')} />
                        </SelectTrigger>
                        <SelectContent>
                          {configList.map((config) => (
                            <SelectItem key={config.id} value={config.id}>
                              <span className="flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                {getDisplayName(config.name)}
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
          
          {!selectedConfig || isLoadingDetail ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  <CardTitle>{getDisplayName(selectedConfig.name)}</CardTitle>
                </div>
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
                  保存配置
                </Button>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4">
                  修改 {getDisplayName(selectedConfig.name)} 相关的配置参数
                </CardDescription>
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
          )}
        </>
      )}
    </div>
  );
}