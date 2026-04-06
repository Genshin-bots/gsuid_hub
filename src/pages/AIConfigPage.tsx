import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Cpu, Loader2, Save, Settings, Zap, Users, Ban, CheckCircle,
  Sparkles, Search, Brain, Shield, Key, Globe, Clock, MessageSquare,
  Lightbulb, Layers
} from 'lucide-react';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { frameworkConfigApi, PluginConfigItem, FrameworkConfigListItem } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ConfigField, ConfigValue } from '@/components/config';

// ===================
// Types
// ===================

interface LocalFrameworkConfig {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, PluginConfigItem>;
}

// AI模式配置 - 使用i18n键
const getAIModes = (t: any) => [
  {
    value: '提及应答',
    label: t('aiConfig.actionMode.mentionResponse'),
    desc: t('aiConfig.actionMode.mentionResponseDesc'),
    icon: MessageSquare,
    color: 'text-blue-500'
  },
  {
    value: '定时巡检',
    label: t('aiConfig.actionMode.scheduledInspection'),
    desc: t('aiConfig.actionMode.scheduledInspectionDesc'),
    icon: Clock,
    color: 'text-green-500'
  },
  {
    value: '趣向捕捉(暂不可用)',
    label: t('aiConfig.actionMode.interestCapture'),
    desc: t('aiConfig.actionMode.interestCaptureDesc'),
    icon: Lightbulb,
    color: 'text-yellow-500',
    disabled: true
  },
  {
    value: '困境救场(暂不可用)',
    label: t('aiConfig.actionMode.troubleRescue'),
    desc: t('aiConfig.actionMode.troubleRescueDesc'),
    icon: Shield,
    color: 'text-purple-500',
    disabled: true
  },
];

// 模型支持能力 - 使用i18n键
const getModelCapabilities = (t: any) => [
  { value: 'text', label: t('aiConfig.serviceProvider.capabilityText'), icon: MessageSquare, color: 'bg-blue-500' },
  { value: 'image', label: t('aiConfig.serviceProvider.capabilityImage'), icon: Sparkles, color: 'bg-green-500' },
  { value: 'audio', label: t('aiConfig.serviceProvider.capabilityAudio'), icon: Cpu, color: 'bg-yellow-500' },
  { value: 'video', label: t('aiConfig.serviceProvider.capabilityVideo'), icon: Zap, color: 'bg-purple-500' },
];

export default function AIConfigPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const { t } = useLanguage();
  
  // State
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<Record<string, LocalFrameworkConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Track original state - only set once after initial load
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Get configs by type
  const aiConfig = useMemo(() => {
    return Object.values(configs).find(c => 
      c.name.includes('AI配置') || c.full_name.includes('AI配置')
    );
  }, [configs]);
  
  const openaiConfig = useMemo(() => {
    return Object.values(configs).find(c => 
      c.name.includes('OpenAI配置') || c.full_name.includes('OpenAI配置')
    );
  }, [configs]);
  
  const embeddingConfig = useMemo(() => {
    return Object.values(configs).find(c => 
      c.name.includes('嵌入模型配置') || c.full_name.includes('嵌入模型配置')
    );
  }, [configs]);
  
  const rerankConfig = useMemo(() => {
    return Object.values(configs).find(c => 
      c.name.includes('Rerank模型配置') || c.full_name.includes('Rerank模型配置')
    );
  }, [configs]);
  
  const tavilyConfig = useMemo(() => {
    return Object.values(configs).find(c => 
      c.name.includes('Tavily搜索配置') || c.full_name.includes('Tavily搜索配置')
    );
  }, [configs]);
  
  // Derived state
  const isAIEnabled = aiConfig?.config.enable?.value as boolean ?? false;
  const isRerankEnabled = aiConfig?.config.enable_rerank?.value as boolean ?? false;
  const websearchProvider = aiConfig?.config.websearch_provider?.value as string ?? 'Tavily';
  
  // Check if config has changes
  const isConfigDirty = useMemo(() => {
    if (Object.keys(originalConfig).length === 0) return false;
    return JSON.stringify(configs) !== JSON.stringify(originalConfig);
  }, [configs, originalConfig]);
  
  // Fetch config list
  const fetchConfigList = async () => {
    try {
      setIsLoading(true);
      const data = await frameworkConfigApi.getFrameworkConfigList('GsCore AI');
      const filteredData = data.filter(config =>
        !config.name.toLowerCase().includes('人设')
      );
      setConfigList(filteredData);
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
  
  // Fetch config detail
  const fetchConfigDetail = async (configName: string) => {
    try {
      setIsLoadingDetail(true);
      const data = await frameworkConfigApi.getFrameworkConfig(configName);
      
      setConfigs(prev => ({
        ...prev,
        [data.id]: {
          id: data.id,
          name: data.name,
          full_name: data.full_name,
          config: data.config as Record<string, PluginConfigItem>,
        }
      }));
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
  
  useEffect(() => {
    if (configList.length > 0) {
      configList.forEach(config => {
        if (!configs[config.id]) {
          fetchConfigDetail(config.full_name);
        }
      });
    }
  }, [configList]);
  
  useEffect(() => {
    if (Object.keys(configs).length > 0 && !hasInitialized) {
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      setHasInitialized(true);
    }
  }, [configs, hasInitialized]);
  
  // Update config value
  const updateConfigValue = useCallback((configId: string, fieldKey: string, value: ConfigValue) => {
    setConfigs(prev => {
      if (!prev[configId]) return prev;
      return {
        ...prev,
        [configId]: {
          ...prev[configId],
          config: {
            ...prev[configId].config,
            [fieldKey]: { ...prev[configId].config[fieldKey], value },
          },
        }
      };
    });
  }, []);
  
  // Handle save
  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      
      // Save all configs that have been loaded
      for (const [configId, config] of Object.entries(configs)) {
        const configToSave: Record<string, any> = {};
        
        // Extract just the values from the config
        Object.entries(config.config).forEach(([key, field]: [string, any]) => {
          if (field && typeof field === 'object' && 'value' in field) {
            configToSave[key] = field.value;
          }
        });
        
        console.log('Saving config:', config.full_name, configToSave);
        await frameworkConfigApi.updateFrameworkConfig(config.full_name, configToSave);
      }
      
      // Update original config after successful save
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      toast({ title: t('common.success'), description: t('aiConfig.configSaved') });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: t('common.saveFailed'),
        description: t('aiConfig.saveFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Get options
  const aiModeValue = (aiConfig?.config.ai_mode?.value as string[]) || [];
  const openaiProviderOptions = (aiConfig?.config.openai_provider?.options || ['openai']) as string[];
  const embeddingProviderOptions = (aiConfig?.config.embedding_provider?.options || ['local']) as string[];
  const websearchProviderOptions = (aiConfig?.config.websearch_provider?.options || ['Tavily']) as string[];
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!aiConfig) {
    return (
      <div className="space-y-6 flex-1 overflow-auto p-6 h-full flex flex-col">
        <div className="text-center text-muted-foreground">{t('aiConfig.noAIConfig')}</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 flex-1 overflow-auto p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            {t('aiConfig.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('aiConfig.description')}
          </p>
        </div>
        <Button
          onClick={handleSaveConfig}
          disabled={!isConfigDirty || isSaving}
          size="sm"
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {t('aiConfig.saveButton')}
        </Button>
      </div>
      
      {isLoadingDetail && Object.keys(configs).length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Card 1: 服务开关 */}
          <Card className={cn("overflow-hidden", isGlass && "glass-card")}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  isAIEnabled ? "bg-green-500/20" : "bg-muted"
                )}>
                  <Cpu className={cn(
                    "w-5 h-5",
                    isAIEnabled ? "text-green-500" : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{t('aiConfig.serviceSwitch.title')}</p>
                  <p className="text-xs text-muted-foreground">
                    {isAIEnabled
                      ? t('aiConfig.serviceSwitch.enabledDesc')
                      : t('aiConfig.serviceSwitch.disabledDesc')}
                  </p>
                </div>
                <Switch
                  checked={isAIEnabled}
                  onCheckedChange={(checked) => updateConfigValue(aiConfig.id, 'enable', checked)}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* AI启用后的配置 */}
          {isAIEnabled && (
            <>
              {/* Card 2: 行动模式 */}
              <Card className={cn("overflow-hidden", isGlass && "glass-card")}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="text-base font-semibold">{t('aiConfig.actionMode.title')}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('aiConfig.actionMode.description')}
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {getAIModes(t).map((mode) => {
                      const isSelected = aiModeValue.includes(mode.value);
                      const Icon = mode.icon;
                      return (
                        <button
                          key={mode.value}
                          onClick={() => {
                            if (mode.disabled) return;
                            const newValue = isSelected
                              ? aiModeValue.filter(v => v !== mode.value)
                              : [...aiModeValue, mode.value];
                            updateConfigValue(aiConfig.id, 'ai_mode', newValue);
                          }}
                          disabled={mode.disabled}
                          className={cn(
                            "p-3 rounded-xl border-2 text-left transition-all",
                            "hover:shadow-sm",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30",
                            mode.disabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={cn("w-4 h-4", mode.color)} />
                            <span className={cn(
                              "font-medium text-sm",
                              isSelected && "text-primary"
                            )}>
                              {mode.label}
                            </span>
                            {isSelected && (
                              <CheckCircle className="w-3.5 h-3.5 text-primary ml-auto" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {mode.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              
              {/* Card 3: 服务提供方（大卡片，无标题，不可折叠） */}
              <Card className={cn("overflow-hidden", isGlass && "glass-card")}>
                <CardContent className="p-6 space-y-8">
                  {/* AI模型服务 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground">{t('aiConfig.serviceProvider.aiModelService')}</h3>
                    </div>
                    
                    <ChipGroup
                      options={openaiProviderOptions.map(p => ({
                        value: p,
                        label: p === 'openai' ? t('aiConfig.serviceProvider.openaiCompatible') : p,
                        icon: <Globe className="w-4 h-4" />,
                      }))}
                      value={[aiConfig.config.openai_provider?.value as string].filter(Boolean)}
                      onValueChange={(newValue) => updateConfigValue(aiConfig.id, 'openai_provider', newValue[0] || '')}
                      selectMode="single"
                      showRadioIndicator
                    />
                    
                    {/* OpenAI配置 - 作为子配置展开 */}
                    {openaiConfig && (
                      <div className="mt-4 p-5 bg-muted/30 rounded-xl space-y-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">{t('aiConfig.serviceProvider.apiConfig')}</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.apiBaseUrl')}</Label>
                            <ConfigField
                              fieldKey="base_url"
                              field={{
                                type: 'select',
                                label: 'base_url',
                                value: openaiConfig.config.base_url?.value as string || '',
                                options: openaiConfig.config.base_url?.options as string[] || [],
                                placeholder: '选择API服务地址',
                                description: '',
                              }}
                              showLabel={false}
                              onChange={(k, v) => updateConfigValue(openaiConfig.id, k, v)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.apiModel')}</Label>
                            <ConfigField
                              fieldKey="model_name"
                              field={{
                                type: 'select',
                                label: 'model_name',
                                value: openaiConfig.config.model_name?.value as string || '',
                                options: openaiConfig.config.model_name?.options as string[] || [],
                                placeholder: '选择AI模型',
                                description: '',
                              }}
                              showLabel={false}
                              onChange={(k, v) => updateConfigValue(openaiConfig.id, k, v)}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.apiKey')}</Label>
                          <ConfigField
                            fieldKey="api_key"
                            field={{
                              type: 'tags',
                              label: 'api_key',
                              value: (openaiConfig.config.api_key?.value as string[]) || [],
                              placeholder: '输入API密钥（支持多个）',
                              description: '',
                            }}
                            showLabel={false}
                            onChange={(k, v) => updateConfigValue(openaiConfig.id, k, v)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.modelCapabilities')}</Label>
                          <div className="flex flex-wrap gap-2">
                            {getModelCapabilities(t).map((cap) => {
                              const isSelected = ((openaiConfig.config.model_support?.value as string[]) || ['text']).includes(cap.value);
                              const Icon = cap.icon;
                              return (
                                <button
                                  key={cap.value}
                                  onClick={() => {
                                    const current = (openaiConfig.config.model_support?.value as string[]) || ['text'];
                                    const newValue = isSelected
                                      ? current.filter(v => v !== cap.value)
                                      : [...current, cap.value];
                                    updateConfigValue(openaiConfig.id, 'model_support', newValue);
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all",
                                    isSelected
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border hover:border-primary/30 text-muted-foreground"
                                  )}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  {cap.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Separator className="bg-border/50" />
                  
                  {/* 嵌入模型服务 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground">{t('aiConfig.serviceProvider.embeddingService')}</h3>
                    </div>
                    
                    <ChipGroup
                      options={embeddingProviderOptions.map(p => ({
                        value: p,
                        label: p === 'local' ? t('aiConfig.serviceProvider.localModel') : p,
                        icon: <Brain className="w-4 h-4" />,
                      }))}
                      value={[aiConfig.config.embedding_provider?.value as string].filter(Boolean)}
                      onValueChange={(newValue) => updateConfigValue(aiConfig.id, 'embedding_provider', newValue[0] || '')}
                      selectMode="single"
                      showRadioIndicator
                    />
                    
                    {/* 嵌入模型配置 */}
                    {embeddingConfig && (
                      <div className="mt-4 p-5 bg-muted/30 rounded-xl space-y-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">{t('aiConfig.serviceProvider.embeddingConfig')}</h4>
                        </div>
                        
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.embeddingModelName')}</Label>
                          <ConfigField
                            fieldKey="embedding_model_name"
                            field={{
                              type: 'select',
                              label: 'embedding_model_name',
                              value: embeddingConfig.config.embedding_model_name?.value as string || 'BAAI/bge-small-zh-v1.5',
                              options: embeddingConfig.config.embedding_model_name?.options as string[] || ['BAAI/bge-small-zh-v1.5'],
                              placeholder: '选择嵌入模型',
                              description: '',
                            }}
                            showLabel={false}
                            onChange={(k, v) => updateConfigValue(embeddingConfig.id, k, v)}
                          />
                        </div>
                        
                        {/* Rerank配置 */}
                        <div className="pt-4 border-t border-border/50">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <CheckCircle className={cn("w-4 h-4", isRerankEnabled ? "text-purple-500" : "text-muted-foreground")} />
                              <span className="text-sm font-medium">{t('aiConfig.serviceProvider.enableRerank')}</span>
                              <Badge variant="secondary" className="text-xs">{t('aiConfig.serviceProvider.rerankQuality')}</Badge>
                            </div>
                            <Switch
                              checked={isRerankEnabled}
                              onCheckedChange={(checked) => updateConfigValue(aiConfig.id, 'enable_rerank', checked)}
                            />
                          </div>
                          
                          {isRerankEnabled && rerankConfig && (
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.rerankModelName')}</Label>
                              <ConfigField
                                fieldKey="rerank_model_name"
                                field={{
                                  type: 'select',
                                  label: 'rerank_model_name',
                                  value: rerankConfig.config.rerank_model_name?.value as string || 'BAAI/bge-reranker-base',
                                  options: rerankConfig.config.rerank_model_name?.options as string[] || ['BAAI/bge-reranker-base'],
                                  placeholder: '选择Rerank模型',
                                  description: '',
                                }}
                                showLabel={false}
                                onChange={(k, v) => updateConfigValue(rerankConfig.id, k, v)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <Separator className="bg-border/50" />
                  
                  {/* 网络搜索服务 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Search className="w-5 h-5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground">{t('aiConfig.serviceProvider.webSearchService')}</h3>
                    </div>
                    
                    <ChipGroup
                      options={websearchProviderOptions.map(p => ({
                        value: p,
                        label: p,
                        icon: <Search className="w-4 h-4" />,
                      }))}
                      value={[websearchProvider]}
                      onValueChange={(newValue) => updateConfigValue(aiConfig.id, 'websearch_provider', newValue[0] || '')}
                      selectMode="single"
                      showRadioIndicator
                    />
                    
                    {/* Tavily配置 */}
                    {websearchProvider === 'Tavily' && tavilyConfig && (
                      <div className="mt-4 p-5 bg-muted/30 rounded-xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-4 h-4 text-muted-foreground" />
                          <h4 className="text-sm font-medium text-muted-foreground">{t('aiConfig.serviceProvider.tavilyConfig')}</h4>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.apiKey')}</Label>
                          <ConfigField
                            fieldKey="api_key"
                            field={{
                              type: 'tags',
                              label: 'api_key',
                              value: (tavilyConfig.config.api_key?.value as string[]) || [],
                              placeholder: '输入Tavily API密钥',
                              description: '',
                            }}
                            showLabel={false}
                            onChange={(k, v) => updateConfigValue(tavilyConfig.id, k, v)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.maxResults')}</Label>
                            <ConfigField
                              fieldKey="max_results"
                              field={{
                                type: 'number',
                                label: 'max_results',
                                value: (tavilyConfig.config.max_results?.value as number) || 10,
                                placeholder: '',
                                description: '',
                              }}
                              showLabel={false}
                              onChange={(k, v) => updateConfigValue(tavilyConfig.id, k, v)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.searchDepth')}</Label>
                            <ConfigField
                              fieldKey="search_depth"
                              field={{
                                type: 'select',
                                label: 'search_depth',
                                value: String(tavilyConfig.config.search_depth?.value || 'advanced'),
                                options: (tavilyConfig.config.search_depth?.options as string[]) || ['basic', 'advanced'],
                                placeholder: '',
                                description: '',
                              }}
                              showLabel={false}
                              onChange={(k, v) => updateConfigValue(tavilyConfig.id, k, v)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Card 4: 高级设置（大卡片，无标题，不可折叠） */}
              <Card className={cn("overflow-hidden", isGlass && "glass-card")}>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">{t('aiConfig.advancedSettings.thinkingRounds')}</Label>
                      <Badge variant="outline" className="text-xs">{t('aiConfig.advancedSettings.tokenConsumption')}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <ConfigField
                        fieldKey="multi_agent_lenth"
                        field={{
                          type: 'select',
                          label: 'multi_agent_lenth',
                          value: String(aiConfig.config.multi_agent_lenth?.value || 12),
                          options: ['9', '12', '20', '30'],
                          placeholder: '',
                          description: '',
                        }}
                        showLabel={false}
                        onChange={(k, v) => updateConfigValue(aiConfig.id, k, typeof v === 'string' ? parseInt(v) : v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {t('aiConfig.advancedSettings.roundsHint')}
                      </span>
                    </div>
                  </div>
                  
                  <Separator className="bg-border/50" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-green-500" />
                        <Label className="text-sm font-medium">{t('aiConfig.advancedSettings.whitelist')}</Label>
                      </div>
                      <ConfigField
                        fieldKey="white_list"
                        field={{
                          type: 'tags',
                          label: 'white_list',
                          value: (aiConfig.config.white_list?.value as string[]) || [],
                          placeholder: t('aiConfig.advancedSettings.whitelistPlaceholder'),
                          description: '',
                        }}
                        showLabel={false}
                        onChange={(k, v) => updateConfigValue(aiConfig.id, k, v)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-500" />
                        <Label className="text-sm font-medium">{t('aiConfig.advancedSettings.blacklist')}</Label>
                      </div>
                      <ConfigField
                        fieldKey="black_list"
                        field={{
                          type: 'tags',
                          label: 'black_list',
                          value: (aiConfig.config.black_list?.value as string[]) || [],
                          placeholder: t('aiConfig.advancedSettings.blacklistPlaceholder'),
                          description: '',
                        }}
                        showLabel={false}
                        onChange={(k, v) => updateConfigValue(aiConfig.id, k, v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
