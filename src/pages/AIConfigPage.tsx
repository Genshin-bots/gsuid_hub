import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, Loader2, Save, Cpu } from 'lucide-react';
import { ConfigField, ConfigFieldDefinition, ConfigValue, ConfigFieldType } from '@/components/config';
import { frameworkConfigApi, PluginConfigItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
    } else if (rawType.includes('gstime')) {
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
  const [configs, setConfigs] = useState<LocalFrameworkConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Track original state for change detection
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  
  // Get current selected config
  const selectedConfig = useMemo(() => {
    return configs.find(c => c.id === selectedConfigId);
  }, [configs, selectedConfigId]);
  
  // Change detection
  const isConfigDirty = useMemo(() => {
    if (!selectedConfig) return false;
    return JSON.stringify(selectedConfig.config) !== JSON.stringify(originalConfig);
  }, [selectedConfig?.config, originalConfig]);
  
  // Fetch AI configs from API
  const fetchConfigs = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigs();
      // Filter configs that start with "GsCore AI" (case insensitive)
      const aiConfigs = data.filter(c => 
        c.name.toLowerCase().startsWith('gscore ai') ||
        c.full_name.toLowerCase().startsWith('gscore ai')
      );
      const converted = aiConfigs.map(c => ({
        ...c,
        config: convertToConfig(c.config)
      }));
      setConfigs(converted);
      
      // If has configs and none selected, select first
      if (converted.length > 0 && !selectedConfigId) {
        const firstConfig = converted[0];
        setSelectedConfigId(firstConfig.id);
        setOriginalConfig(JSON.parse(JSON.stringify(firstConfig.config)));
      }
    } catch (error) {
      console.error('Failed to fetch AI configs:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('aiConfig.loadFailed') || 'Unable to load AI configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchConfigs();
  }, []);
  
  // Update original state when selected config changes
  useEffect(() => {
    if (selectedConfig) {
      setOriginalConfig(JSON.parse(JSON.stringify(selectedConfig.config)));
    }
  }, [selectedConfigId]);
  
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
      ) : configs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('aiConfig.noAIConfig')}
        </div>
      ) : (
        <>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <Label className="flex items-center gap-2 text-base font-bold min-w-[120px]">
                  <Settings className="w-4 h-4 text-primary" />
                  {t('aiConfig.selectConfig')}
                </Label>
                <ToggleGroup
                  type="single"
                  value={selectedConfigId}
                  onValueChange={(value) => {
                    if (value) setSelectedConfigId(value);
                  }}
                  className="flex flex-wrap gap-2"
                  disabled={isLoading}
                >
                  {configs.map((config) => (
                    <ToggleGroupItem
                      key={config.id}
                      value={config.id}
                      className="px-3 py-1.5"
                    >
                      {getDisplayName(config.name)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </CardContent>
          </Card>
          
          {selectedConfig && (
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