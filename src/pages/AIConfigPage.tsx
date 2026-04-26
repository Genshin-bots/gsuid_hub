import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Cpu, Loader2, Save, Settings, Zap, Users, Ban, CheckCircle,
  Sparkles, Search, Brain, Key, Globe, Clock, MessageSquare,
  Layers, MemoryStick, ChevronRight, Bot, Wifi, Database,
  Plus, Pencil, Trash2, Check, FileText,
  Server, AlertTriangle, SlidersHorizontal
} from 'lucide-react';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  frameworkConfigApi,
  providerConfigApi,
  api,
  PluginConfigItem,
  FrameworkConfigListItem,
  OpenAIConfigData,
  ProviderInfo,
  AllConfigsSummary,
  ProviderConfigOptions,
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ConfigField, ConfigValue } from '@/components/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// ============================================================================
// Types
// ============================================================================

interface LocalFrameworkConfig {
  id: string;
  name: string;
  full_name: string;
  config: Record<string, PluginConfigItem>;
}

interface ConfigFileItem {
  name: string;
  provider: string;
  model_name: string;
  base_url: string;
}

// 模型支持能力
const getModelCapabilities = (t: (key: string) => string) => [
  { value: 'text', label: t('aiConfig.serviceProvider.capabilityText'), icon: MessageSquare },
  { value: 'image', label: t('aiConfig.serviceProvider.capabilityImage'), icon: Sparkles },
  { value: 'audio', label: t('aiConfig.serviceProvider.capabilityAudio'), icon: Cpu },
  { value: 'video', label: t('aiConfig.serviceProvider.capabilityVideo'), icon: Zap },
];

// ============================================================================
// Sub-components
// ============================================================================

interface SectionCardProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  iconBgClass: string;
  iconClass: string;
  children: React.ReactNode;
  isGlass: boolean;
  rightAction?: React.ReactNode;
  className?: string;
}

function SectionCard({ title, description, icon, iconBgClass, iconClass, children, isGlass, rightAction, className }: SectionCardProps) {
  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 hover:shadow-md",
      isGlass && "glass-card",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300",
              iconBgClass
            )}>
              {icon}
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{title}</CardTitle>
              {description && <CardDescription className="text-xs mt-0.5">{description}</CardDescription>}
            </div>
          </div>
          {rightAction}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

interface SubConfigPanelProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function SubConfigPanel({ title, icon, children, className }: SubConfigPanelProps) {
  return (
    <div className={cn(
      "mt-4 p-5 rounded-xl border space-y-4",
      "bg-muted/30 border-border/40",
      className
    )}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  );
}

interface ToggleRowProps {
  icon: React.ReactNode;
  iconColorClass: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function ToggleRow({ icon, iconColorClass, title, description, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg transition-colors duration-200 hover:bg-muted/30">
      <div className={cn(
        "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300",
        checked ? "bg-primary/10" : "bg-muted"
      )}>
        <div className={cn("w-5 h-5 transition-colors duration-300", checked ? iconColorClass : "text-muted-foreground")}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// 空状态组件
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIConfigPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const { t } = useLanguage();

  // State - Framework Config (AI基础配置)
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<Record<string, LocalFrameworkConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // State - Provider Config
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('openai');
  const [allConfigs, setAllConfigs] = useState<AllConfigsSummary | null>(null);
  const [highLevelConfig, setHighLevelConfig] = useState<string>('');
  const [lowLevelConfig, setLowLevelConfig] = useState<string>('');

  // State - OpenAI Config
  const [openaiConfigData, setOpenaiConfigData] = useState<OpenAIConfigData | null>(null);
  const [isLoadingOpenaiConfig, setIsLoadingOpenaiConfig] = useState(false);
  const [isSavingOpenaiConfig, setIsSavingOpenaiConfig] = useState(false);

  // State - Provider Config Options
  const [providerConfigOptions, setProviderConfigOptions] = useState<ProviderConfigOptions | null>(null);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [editingConfigName, setEditingConfigName] = useState('');
  const [editingConfigProvider, setEditingConfigProvider] = useState('openai');

  // New config form state
  const [newConfigProvider, setNewConfigProvider] = useState('openai');
  const [newConfigBaseUrl, setNewConfigBaseUrl] = useState('');
  const [newConfigModel, setNewConfigModel] = useState('');
  const [newConfigApiKeys, setNewConfigApiKeys] = useState<string[]>([]);
  const [newConfigEmbeddingModel, setNewConfigEmbeddingModel] = useState('text-embedding-3-small');
  const [newConfigModelSupport, setNewConfigModelSupport] = useState<string[]>(['text']);

  // Track original state
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [hasInitialized, setHasInitialized] = useState(false);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchProviderConfigOptions = useCallback(async (provider: string) => {
    try {
      const response = await providerConfigApi.getConfigOptions(provider);
      setProviderConfigOptions(response);
    } catch (error) {
      console.error(`Failed to fetch provider config options for ${provider}:`, error);
      setProviderConfigOptions(null);
    }
  }, []);

  const fetchConfigDetailForEdit = useCallback(async (provider: string, configName: string) => {
    try {
      setIsLoadingOpenaiConfig(true);
      const response = await providerConfigApi.getConfigDetail(provider, configName);
      const configData: OpenAIConfigData = {
        base_url: (response.config.base_url?.data as string) || '',
        api_key: (response.config.api_key?.data as string[]) || [],
        model_name: (response.config.model_name?.data as string) || '',
        embedding_model: (response.config.embedding_model?.data as string) || 'text-embedding-3-small',
        model_support: (response.config.model_support?.data as string[]) || ['text'],
      };
      setOpenaiConfigData(configData);
      setEditingConfigProvider(provider);
    } catch (error) {
      console.error('Failed to fetch config detail:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.openaiConfig.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingOpenaiConfig(false);
    }
  }, [t]);

  const fetchProviderList = useCallback(async () => {
    try {
      const response = await providerConfigApi.getProviders();
      setProviders(response.providers);
      setCurrentProvider(response.current);
    } catch (error) {
      console.error('Failed to fetch provider list:', error);
    }
  }, []);

  const fetchAllConfigs = useCallback(async () => {
    try {
      const response = await providerConfigApi.getAllConfigs();
      setAllConfigs(response);
      setHighLevelConfig(response.high_level_config);
      setLowLevelConfig(response.low_level_config);
    } catch (error) {
      console.error('Failed to fetch all configs:', error);
    }
  }, []);

  const fetchConfigList = useCallback(async () => {
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
        description: t('aiConfig.loadFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const fetchConfigDetail = useCallback(async (configName: string) => {
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
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigList();
    fetchProviderList();
    fetchAllConfigs();
  }, [fetchConfigList, fetchProviderList, fetchAllConfigs]);

  useEffect(() => {
    if (configList.length > 0) {
      configList.forEach(config => {
        if (!configs[config.id]) {
          fetchConfigDetail(config.full_name);
        }
      });
    }
  }, [configList, configs, fetchConfigDetail]);

  useEffect(() => {
    if (Object.keys(configs).length > 0 && !hasInitialized) {
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      setHasInitialized(true);
    }
  }, [configs, hasInitialized]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleSetHighLevelConfig = useCallback(async (configName: string, provider?: string) => {
    try {
      await providerConfigApi.setHighLevelConfig(configName, provider || currentProvider);
      setHighLevelConfig(configName);
      toast({
        title: t('common.success'),
        description: t('aiConfig.providerConfig.setHighLevelSuccess', { name: configName }),
      });
      fetchAllConfigs();
    } catch (error) {
      console.error('Failed to set high level config:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.providerConfig.setFailed'),
        variant: 'destructive',
      });
    }
  }, [t, fetchAllConfigs, currentProvider]);

  const handleSetLowLevelConfig = useCallback(async (configName: string, provider?: string) => {
    try {
      await providerConfigApi.setLowLevelConfig(configName, provider || currentProvider);
      setLowLevelConfig(configName);
      toast({
        title: t('common.success'),
        description: t('aiConfig.providerConfig.setLowLevelSuccess', { name: configName }),
      });
      fetchAllConfigs();
    } catch (error) {
      console.error('Failed to set low level config:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.providerConfig.setFailed'),
        variant: 'destructive',
      });
    }
  }, [t, fetchAllConfigs, currentProvider]);

  const handleSaveOpenaiConfig = useCallback(async () => {
    if (!openaiConfigData || !editingConfigName || !editingConfigProvider) return;
    try {
      setIsSavingOpenaiConfig(true);
      const configData: Record<string, { data: unknown }> = {
        base_url: { data: openaiConfigData.base_url },
        api_key: { data: openaiConfigData.api_key },
        model_name: { data: openaiConfigData.model_name },
        embedding_model: { data: openaiConfigData.embedding_model },
        model_support: { data: openaiConfigData.model_support },
      };
      await providerConfigApi.saveConfig(editingConfigProvider, editingConfigName, configData);
      toast({
        title: t('common.success'),
        description: t('aiConfig.openaiConfig.saveSuccess'),
      });
      fetchAllConfigs();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.openaiConfig.saveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingOpenaiConfig(false);
    }
  }, [openaiConfigData, editingConfigName, editingConfigProvider, t, fetchAllConfigs]);

  const handleCreateOpenaiConfig = useCallback(async () => {
    if (!newConfigName.trim()) {
      toast({ title: t('common.error'), description: t('aiConfig.openaiConfig.nameRequired'), variant: 'destructive' });
      return;
    }
    if (!newConfigBaseUrl.trim()) {
      toast({ title: t('common.error'), description: t('aiConfig.openaiConfig.baseUrlRequired'), variant: 'destructive' });
      return;
    }
    if (!newConfigModel.trim()) {
      toast({ title: t('common.error'), description: t('aiConfig.openaiConfig.modelRequired'), variant: 'destructive' });
      return;
    }
    if (newConfigApiKeys.length === 0 || newConfigApiKeys.every(k => !k.trim())) {
      toast({ title: t('common.error'), description: t('aiConfig.openaiConfig.apiKeyRequired'), variant: 'destructive' });
      return;
    }
    try {
      const configName = newConfigName.trim();
      const configData: Record<string, { data: unknown }> = {
        base_url: { data: newConfigBaseUrl.trim() },
        api_key: { data: newConfigApiKeys.filter(k => k.trim()) },
        model_name: { data: newConfigModel.trim() },
        embedding_model: { data: newConfigEmbeddingModel },
        model_support: { data: newConfigModelSupport },
      };
      await providerConfigApi.saveConfig(newConfigProvider, configName, configData);
      toast({ title: t('common.success'), description: t('aiConfig.openaiConfig.createSuccess', { name: configName }) });
      setIsCreateDialogOpen(false);
      resetNewConfigForm();
      await fetchAllConfigs();
    } catch (error) {
      console.error(`Failed to create ${newConfigProvider} config:`, error);
      toast({ title: t('common.error'), description: t('aiConfig.openaiConfig.createFailed'), variant: 'destructive' });
    }
  }, [newConfigName, newConfigBaseUrl, newConfigModel, newConfigApiKeys, newConfigEmbeddingModel, newConfigModelSupport, newConfigProvider, t, fetchAllConfigs]);

  const handleDeleteConfig = useCallback(async () => {
    if (!editingConfigName || !editingConfigProvider) return;
    try {
      await providerConfigApi.deleteConfig(editingConfigProvider, editingConfigName);
      toast({ title: t('common.success'), description: t('aiConfig.openaiConfig.deleteSuccess', { name: editingConfigName }) });
      setIsDeleteDialogOpen(false);
      setEditingConfigName('');
      await fetchAllConfigs();
    } catch (error) {
      console.error('Failed to delete config:', error);
      toast({ title: t('common.error'), description: t('aiConfig.openaiConfig.deleteFailed'), variant: 'destructive' });
    }
  }, [editingConfigName, editingConfigProvider, t, fetchAllConfigs]);

  const resetNewConfigForm = () => {
    setNewConfigProvider('openai');
    setNewConfigName('');
    setNewConfigBaseUrl('');
    setNewConfigModel('');
    setNewConfigApiKeys([]);
    setNewConfigEmbeddingModel('text-embedding-3-small');
    setNewConfigModelSupport(['text']);
  };

  const updateOpenaiConfigField = useCallback((field: keyof OpenAIConfigData, value: string | string[]) => {
    setOpenaiConfigData(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  const openDeleteDialog = (configName: string, provider?: string) => {
    setEditingConfigName(configName);
    if (provider) setEditingConfigProvider(provider);
    setIsDeleteDialogOpen(true);
  };

  const openEditDialog = (configName: string, provider?: string) => {
    setEditingConfigName(configName);
    const effectiveProvider = provider || editingConfigProvider || 'openai';
    setEditingConfigProvider(effectiveProvider);
    fetchConfigDetailForEdit(effectiveProvider, configName);
    fetchProviderConfigOptions(effectiveProvider);
    setIsEditDialogOpen(true);
  };

  // ============================================================================
  // Framework Config Helpers
  // ============================================================================

  const aiConfig = useMemo(() => {
    return Object.values(configs).find(c =>
      c.name.includes('AI配置') || c.full_name.includes('AI配置')
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

  const memoryConfig = useMemo(() => {
    return Object.values(configs).find(c =>
      c.name.includes('记忆配置') || c.full_name.includes('记忆配置')
    );
  }, [configs]);

  const isAIEnabled = aiConfig?.config.enable?.value as boolean ?? false;
  const isRerankEnabled = aiConfig?.config.enable_rerank?.value as boolean ?? false;
  const isMemoryEnabled = aiConfig?.config.enable_memory?.value as boolean ?? false;
  const websearchProvider = aiConfig?.config.websearch_provider?.value as string ?? 'Tavily';

  const isConfigDirty = useMemo(() => {
    if (Object.keys(originalConfig).length === 0) return false;
    return JSON.stringify(configs) !== JSON.stringify(originalConfig);
  }, [configs, originalConfig]);

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

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true);
      for (const config of Object.values(configs)) {
        const configToSave: Record<string, any> = {};
        Object.entries(config.config).forEach(([key, field]: [string, any]) => {
          if (field && typeof field === 'object' && 'value' in field) {
            configToSave[key] = field.value;
          }
        });
        await frameworkConfigApi.updateFrameworkConfig(config.full_name, configToSave);
      }
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      toast({ title: t('common.success'), description: t('aiConfig.configSaved') });
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: t('common.saveFailed'), description: t('aiConfig.saveFailed'), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const embeddingProviderOptions = (aiConfig?.config.embedding_provider?.options || ['local']) as string[];
  const websearchProviderOptions = (aiConfig?.config.websearch_provider?.options || ['Tavily']) as string[];

  const allConfigsList = useMemo(() => {
    if (!allConfigs) return [];
    return [
      ...allConfigs.openai_configs.map(c => ({ ...c, provider: 'openai' as string })),
      ...allConfigs.anthropic_configs.map(c => ({ ...c, provider: 'anthropic' as string })),
    ];
  }, [allConfigs]);

  // ============================================================================
  // Render
  // ============================================================================

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
        <EmptyState
          icon={<Bot className="w-8 h-8 text-muted-foreground" />}
          title={t('aiConfig.noAIConfig')}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Bot className="w-7 h-7 text-primary" />
            {t('aiConfig.title')}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t('aiConfig.description')}</p>
        </div>
        <Button
          onClick={handleSaveConfig}
          disabled={!isConfigDirty || isSaving}
          size="sm"
          className={cn(
            "gap-2 transition-all duration-300",
            isConfigDirty && "animate-in fade-in slide-in-from-bottom-2"
          )}
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
        <div className="space-y-6">
          {/* Hero: AI Service Master Switch */}
          <Card className={cn(
            "overflow-hidden transition-all duration-500 border-2 relative",
            isAIEnabled ? "border-primary/20 shadow-lg shadow-primary/5" : "border-border/40",
            isGlass && "glass-card"
          )}>
            <div className={cn(
              "absolute inset-0 transition-opacity duration-700 pointer-events-none",
              isAIEnabled ? "opacity-100" : "opacity-0"
            )}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/3 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center gap-5">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500",
                  isAIEnabled ? "bg-primary/15 text-primary shadow-sm" : "bg-muted text-muted-foreground"
                )}>
                  <Brain className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold">{t('aiConfig.serviceSwitch.title')}</h2>
                    <Badge
                      variant={isAIEnabled ? "default" : "secondary"}
                      className={cn(
                        "text-xs font-medium transition-colors duration-300",
                        isAIEnabled && "bg-primary/15 text-primary hover:bg-primary/20 border-primary/20"
                      )}
                    >
                      {isAIEnabled ? t('common.enabled') : t('common.disabled')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isAIEnabled ? t('aiConfig.serviceSwitch.enabledDesc') : t('aiConfig.serviceSwitch.disabledDesc')}
                  </p>
                </div>
                <Switch
                  checked={isAIEnabled}
                  onCheckedChange={(checked) => updateConfigValue(aiConfig.id, 'enable', checked)}
                  className="data-[state=checked]:bg-primary scale-110"
                />
              </div>
            </CardContent>
          </Card>

          {/* AI启用后的配置 */}
          {isAIEnabled && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Section: 模型配置 */}
              <div className="space-y-4">
                {/* Section Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Wifi className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">{t('aiConfig.serviceProvider.title')}</h2>
                      <p className="text-xs text-muted-foreground">{t('aiConfig.serviceProvider.subtitle') || '管理AI服务提供方和模型配置'}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => { setIsCreateDialogOpen(true); fetchProviderConfigOptions(newConfigProvider); }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('aiConfig.openaiConfig.createNew')}
                  </Button>
                </div>

                {/* 配置文件选择 - 两列布局 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 高级任务配置卡片 */}
                  <SectionCard
                    title={t('aiConfig.providerConfig.highLevelTask') || '高级任务'}
                    description={t('aiConfig.providerConfig.highLevelTaskDesc') || '复杂推理、工具调用等需要强模型能力的任务'}
                    icon={<Sparkles className="w-5 h-5 text-primary" />}
                    iconBgClass="bg-primary/10"
                    iconClass="text-primary"
                    isGlass={isGlass}
                  >
                    {allConfigsList.length === 0 ? (
                      <EmptyState
                        icon={<Server className="w-6 h-6 text-muted-foreground/50" />}
                        title={t('aiConfig.openaiConfig.noConfig')}
                        description={t('aiConfig.openaiConfig.noConfigDesc') || '点击右上角创建新配置'}
                      />
                    ) : (
                      <div className="space-y-2">
                        {allConfigsList.map((configItem) => {
                          const isSelected = configItem.name === highLevelConfig;
                          return (
                            <div
                              key={`high-${configItem.name}`}
                              className={cn(
                                "group flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer",
                                isSelected ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50 hover:border-primary/20"
                              )}
                              onClick={() => handleSetHighLevelConfig(configItem.name, configItem.provider)}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                                  isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium truncate block">{configItem.name}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] h-4 px-1.5",
                                        configItem.provider === 'openai' ? "border-primary/40 text-primary bg-primary/10" : "border-orange-500/40 text-orange-600 bg-orange-500/10"
                                      )}
                                    >
                                      {configItem.provider === 'openai' ? 'OpenAI' : configItem.provider === 'anthropic' ? 'Anthropic' : configItem.provider}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground truncate">{configItem.model_name}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isSelected && (
                                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-primary" />
                                  </div>
                                )}
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); openEditDialog(configItem.name, configItem.provider); }}
                                      >
                                        <Settings className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('common.edit')}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(configItem.name, configItem.provider); }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('common.delete')}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>

                  {/* 低级任务配置卡片 */}
                  <SectionCard
                    title={t('aiConfig.providerConfig.lowLevelTask') || '低级任务'}
                    description={t('aiConfig.providerConfig.lowLevelTaskDesc') || '简单问答、快速响应等只需基础模型能力的任务'}
                    icon={<Zap className="w-5 h-5 text-primary" />}
                    iconBgClass="bg-primary/10"
                    iconClass="text-primary"
                    isGlass={isGlass}
                  >
                    {allConfigsList.length === 0 ? (
                      <EmptyState
                        icon={<Server className="w-6 h-6 text-muted-foreground/50" />}
                        title={t('aiConfig.openaiConfig.noConfig')}
                        description={t('aiConfig.openaiConfig.noConfigDesc') || '点击右上角创建新配置'}
                      />
                    ) : (
                      <div className="space-y-2">
                        {allConfigsList.map((configItem) => {
                          const isSelected = configItem.name === lowLevelConfig;
                          return (
                            <div
                              key={`low-${configItem.name}`}
                              className={cn(
                                "group flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer",
                                isSelected ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50 hover:border-primary/20"
                              )}
                              onClick={() => handleSetLowLevelConfig(configItem.name, configItem.provider)}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                                  isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium truncate block">{configItem.name}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] h-4 px-1.5",
                                        configItem.provider === 'openai' ? "border-primary/40 text-primary bg-primary/10" : "border-orange-500/40 text-orange-600 bg-orange-500/10"
                                      )}
                                    >
                                      {configItem.provider === 'openai' ? 'OpenAI' : configItem.provider === 'anthropic' ? 'Anthropic' : configItem.provider}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground truncate">{configItem.model_name}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {isSelected && (
                                  <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-primary" />
                                  </div>
                                )}
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); openEditDialog(configItem.name, configItem.provider); }}
                                      >
                                        <Settings className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('common.edit')}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(configItem.name, configItem.provider); }}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('common.delete')}</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </SectionCard>
                </div>

                {/* Section: 嵌入模型服务 & 网络搜索服务 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 嵌入模型服务 */}
                  <SectionCard
                    title={t('aiConfig.serviceProvider.embeddingService')}
                    description={t('aiConfig.serviceProvider.embeddingServiceDesc') || '配置向量嵌入模型'}
                    icon={<Database className="w-5 h-5 text-primary" />}
                    iconBgClass="bg-primary/10"
                    iconClass="text-primary"
                    isGlass={isGlass}
                  >
                    <ChipGroup
                      options={embeddingProviderOptions.map(p => ({
                        value: p,
                        label: p === 'local' ? t('aiConfig.serviceProvider.localModel') : p,
                        icon: <Database className="w-3.5 h-3.5" />,
                      }))}
                      value={[aiConfig.config.embedding_provider?.value as string].filter(Boolean)}
                      onValueChange={(newValue) => updateConfigValue(aiConfig.id, 'embedding_provider', newValue[0] || '')}
                      selectMode="single"
                      showRadioIndicator
                    />
                    {embeddingConfig && (
                      <SubConfigPanel
                        title={t('aiConfig.serviceProvider.embeddingConfig')}
                        icon={<Layers className="w-3.5 h-3.5" />}
                      >
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Cpu className="w-3 h-3" />
                              {t('aiConfig.serviceProvider.embeddingModelName')}
                            </Label>
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
                          <div className="pt-4 border-t border-border/30">
                            <ToggleRow
                              icon={<CheckCircle className="w-5 h-5" />}
                              iconColorClass="text-primary"
                              title={t('aiConfig.serviceProvider.enableRerank')}
                              description={t('aiConfig.serviceProvider.rerankQuality')}
                              checked={isRerankEnabled}
                              onCheckedChange={(checked) => updateConfigValue(aiConfig.id, 'enable_rerank', checked)}
                            />
                            {isRerankEnabled && rerankConfig && (
                              <div className="mt-3 space-y-2 pl-4 border-l-2 border-primary/20">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3" />
                                  {t('aiConfig.serviceProvider.rerankModelName')}
                                </Label>
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
                      </SubConfigPanel>
                    )}
                  </SectionCard>

                  {/* 网络搜索服务 */}
                  <SectionCard
                    title={t('aiConfig.serviceProvider.webSearchService')}
                    description={t('aiConfig.serviceProvider.webSearchServiceDesc') || '配置网络搜索能力'}
                    icon={<Search className="w-5 h-5 text-primary" />}
                    iconBgClass="bg-primary/10"
                    iconClass="text-primary"
                    isGlass={isGlass}
                  >
                    <ChipGroup
                      options={websearchProviderOptions.map(p => ({
                        value: p,
                        label: p,
                        icon: <Search className="w-3.5 h-3.5" />,
                      }))}
                      value={[websearchProvider]}
                      onValueChange={(newValue) => updateConfigValue(aiConfig.id, 'websearch_provider', newValue[0] || '')}
                      selectMode="single"
                      showRadioIndicator
                    />
                    {websearchProvider === 'Tavily' && tavilyConfig && (
                      <SubConfigPanel
                        title={t('aiConfig.serviceProvider.tavilyConfig')}
                        icon={<Key className="w-3.5 h-3.5" />}
                      >
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Key className="w-3 h-3" />
                              {t('aiConfig.serviceProvider.apiKey')}
                            </Label>
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
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <SlidersHorizontal className="w-3 h-3" />
                                {t('aiConfig.serviceProvider.maxResults')}
                              </Label>
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
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Search className="w-3 h-3" />
                                {t('aiConfig.serviceProvider.searchDepth')}
                              </Label>
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
                      </SubConfigPanel>
                    )}
                  </SectionCard>
                </div>
              </div>

              {/* Section: 高级设置 & 记忆配置 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 高级设置 */}
                <SectionCard
                  title={t('aiConfig.advancedSettings.title') || '高级设置'}
                  description={t('aiConfig.advancedSettings.description') || '配置AI行为参数'}
                  icon={<Settings className="w-5 h-5 text-primary" />}
                  iconBgClass="bg-primary/10"
                  iconClass="text-primary"
                  isGlass={isGlass}
                >
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">{t('aiConfig.advancedSettings.thinkingRounds')}</Label>
                        <Badge variant="outline" className="text-[10px] font-normal h-5">{t('aiConfig.advancedSettings.tokenConsumption')}</Badge>
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
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{t('aiConfig.advancedSettings.roundsHint')}</span>
                      </div>
                    </div>
                    <Separator className="bg-border/30" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  </div>
                </SectionCard>

                {/* 记忆配置 */}
                <SectionCard
                  title={t('aiConfig.memorySettings.title') || '记忆配置'}
                  description={t('aiConfig.memorySettings.description') || '配置AI记忆系统'}
                  icon={<MemoryStick className="w-5 h-5 text-primary" />}
                  iconBgClass="bg-primary/10"
                  iconClass="text-primary"
                  isGlass={isGlass}
                  rightAction={
                    <Switch
                      checked={isMemoryEnabled}
                      onCheckedChange={(checked) => updateConfigValue(aiConfig.id, 'enable_memory', checked)}
                    />
                  }
                >
                  {!isMemoryEnabled ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 px-2">
                      <ChevronRight className="w-4 h-4" />
                      <span>{t('aiConfig.memorySettings.disabledDesc')}</span>
                    </div>
                  ) : memoryConfig ? (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">{t('aiConfig.memorySettings.memoryMode')}</Label>
                        </div>
                        <ChipGroup
                          options={(memoryConfig.config.memory_mode?.options || ['被动感知', '主动会话']).map((p: string) => ({
                            value: p,
                            label: p,
                            icon: <Brain className="w-3.5 h-3.5" />,
                          }))}
                          value={(memoryConfig.config.memory_mode?.value as string[]) || []}
                          onValueChange={(newValue) => updateConfigValue(memoryConfig.id, 'memory_mode', newValue)}
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-sm font-medium">{t('aiConfig.memorySettings.memorySession')}</Label>
                          </div>
                          <ConfigField
                            fieldKey="memory_session"
                            field={{
                              type: 'select',
                              label: 'memory_session',
                              value: (memoryConfig.config.memory_session?.value as string) || '按人格配置',
                              options: (memoryConfig.config.memory_session?.options as string[]) || ['按人格配置', '全部群聊'],
                              placeholder: '',
                              description: '',
                            }}
                            showLabel={false}
                            onChange={(k, v) => updateConfigValue(memoryConfig.id, k, v)}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Search className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-sm font-medium">{t('aiConfig.memorySettings.retrievalTopK')}</Label>
                          </div>
                          <ConfigField
                            fieldKey="retrieval_top_k"
                            field={{
                              type: 'select',
                              label: 'retrieval_top_k',
                              value: String(memoryConfig.config.retrieval_top_k?.value || 15),
                              options: ((memoryConfig.config.retrieval_top_k?.options as unknown as number[]) || [5, 10, 15, 20]).map(String),
                              placeholder: '',
                              description: '',
                            }}
                            showLabel={false}
                            onChange={(k, v) => updateConfigValue(memoryConfig.id, k, typeof v === 'string' ? parseInt(v) : v)}
                          />
                        </div>
                      </div>
                      <Separator className="bg-border/30" />
                      <div className="space-y-2">
                        <ToggleRow
                          icon={<CheckCircle className="w-5 h-5" />}
                          iconColorClass="text-primary"
                          title={t('aiConfig.memorySettings.enableSystem2')}
                          description={t('aiConfig.memorySettings.enableSystem2Desc') || '提高检索精度但增加性能开销'}
                          checked={(memoryConfig.config.enable_system2?.value as boolean) ?? true}
                          onCheckedChange={(checked) => updateConfigValue(memoryConfig.id, 'enable_system2', checked)}
                        />
                        <ToggleRow
                          icon={<Sparkles className="w-5 h-5" />}
                          iconColorClass="text-primary"
                          title={t('aiConfig.memorySettings.evalMode')}
                          description={t('aiConfig.memorySettings.evalModeDesc') || '启用后无法使用 System-2 和 Rerank'}
                          checked={(memoryConfig.config.eval_mode?.value as boolean) ?? false}
                          onCheckedChange={(checked) => updateConfigValue(memoryConfig.id, 'eval_mode', checked)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 px-2">{t('aiConfig.memorySettings.noConfig') || '记忆配置加载中...'}</div>
                  )}
                </SectionCard>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Config Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {t('aiConfig.openaiConfig.createNew')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('aiConfig.providerConfig.provider')}</Label>
              <div className="flex gap-2">
                <Button type="button" variant={newConfigProvider === 'openai' ? 'default' : 'outline'} size="sm" className="flex-1 gap-2" onClick={() => { setNewConfigProvider('openai'); fetchProviderConfigOptions('openai'); }}>
                  <Server className="w-4 h-4" />OpenAI 兼容格式
                </Button>
                <Button type="button" variant={newConfigProvider === 'anthropic' ? 'default' : 'outline'} size="sm" className="flex-1 gap-2" onClick={() => { setNewConfigProvider('anthropic'); fetchProviderConfigOptions('anthropic'); }}>
                  <Brain className="w-4 h-4" />Anthropic 格式
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="configName">{t('aiConfig.openaiConfig.configName')}</Label>
              <Input id="configName" value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} placeholder={t('aiConfig.openaiConfig.configNamePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('aiConfig.serviceProvider.apiBaseUrl')}</Label>
              <div className="relative w-full">
                <Popover>
                  <div className="relative w-full">
                    <Input value={newConfigBaseUrl} onChange={(e) => setNewConfigBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="bg-background h-10 pr-10 w-full" />
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 hover:bg-transparent">
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                  </div>
                  <PopoverContent className="p-0 w-full" align="start" sideOffset={4} style={{ minWidth: '100%', width: 'auto' }}>
                    <div className="max-h-[200px] overflow-auto">
                      {(providerConfigOptions?.options?.base_url || []).map((url) => (
                        <div key={url} className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground" onClick={() => { setNewConfigBaseUrl(url); document.body.click(); }}>{url}</div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('aiConfig.serviceProvider.apiModel')}</Label>
              <div className="relative w-full">
                <Popover>
                  <div className="relative w-full">
                    <Input value={newConfigModel} onChange={(e) => setNewConfigModel(e.target.value)} placeholder="gpt-4o-mini" className="bg-background h-10 pr-10 w-full" />
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full w-10 hover:bg-transparent">
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                  </div>
                  <PopoverContent className="p-0 w-full" align="start" sideOffset={4} style={{ minWidth: '100%', width: 'auto' }}>
                    <div className="max-h-[200px] overflow-auto">
                      {(providerConfigOptions?.options?.model_name || []).map((model) => (
                        <div key={model} className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground" onClick={() => { setNewConfigModel(model); document.body.click(); }}>{model}</div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('aiConfig.serviceProvider.apiKey')}</Label>
              <ConfigField fieldKey="api_key" field={{ type: 'tags', label: 'api_key', value: newConfigApiKeys, placeholder: '输入API密钥（支持多个）', description: '' }} showLabel={false} onChange={(k, v) => setNewConfigApiKeys(v as string[])} />
            </div>
            <div className="space-y-2">
              <Label>{t('aiConfig.serviceProvider.modelCapabilities')}</Label>
              <div className="flex flex-wrap gap-2">
                {getModelCapabilities(t).map((cap) => {
                  const isSelected = newConfigModelSupport.includes(cap.value);
                  const Icon = cap.icon;
                  return (
                    <button
                      key={cap.value}
                      type="button"
                      onClick={() => { setNewConfigModelSupport(prev => isSelected ? prev.filter(v => v !== cap.value) : [...prev, cap.value]); }}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all", isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30 text-muted-foreground")}
                    >
                      <Icon className="w-4 h-4" />{cap.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetNewConfigForm(); }}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateOpenaiConfig}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Config Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t('aiConfig.openaiConfig.editConfigTitle')}
            </DialogTitle>
            <DialogDescription>{editingConfigName}</DialogDescription>
          </DialogHeader>
          {isLoadingOpenaiConfig ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : openaiConfigData ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><Globe className="w-4 h-4" />{t('aiConfig.serviceProvider.apiBaseUrl')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-start text-left font-normal h-10 px-3">
                      {openaiConfigData.base_url || <span className="text-muted-foreground">选择或输入 API Base URL</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="p-2">
                      <Input
                        value={openaiConfigData.base_url}
                        onChange={(e) => updateOpenaiConfigField('base_url', e.target.value)}
                        placeholder="输入或选择 API Base URL"
                        className="h-9"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-auto border-t">
                      {(providerConfigOptions?.options?.base_url || []).map((url) => (
                        <div
                          key={url}
                          className={cn(
                            "px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                            openaiConfigData.base_url === url && "bg-accent"
                          )}
                          onClick={() => updateOpenaiConfigField('base_url', url)}
                        >
                          {url}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><Cpu className="w-4 h-4" />{t('aiConfig.serviceProvider.apiModel')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-start text-left font-normal h-10 px-3">
                      {openaiConfigData.model_name || <span className="text-muted-foreground">选择或输入模型名称</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="p-2">
                      <Input
                        value={openaiConfigData.model_name}
                        onChange={(e) => updateOpenaiConfigField('model_name', e.target.value)}
                        placeholder="输入或选择模型名称"
                        className="h-9"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-auto border-t">
                      {(providerConfigOptions?.options?.model_name || []).map((model) => (
                        <div
                          key={model}
                          className={cn(
                            "px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                            openaiConfigData.model_name === model && "bg-accent"
                          )}
                          onClick={() => updateOpenaiConfigField('model_name', model)}
                        >
                          {model}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><Key className="w-4 h-4" />{t('aiConfig.serviceProvider.apiKey')}</Label>
                <ConfigField fieldKey="api_key" field={{ type: 'tags', label: 'api_key', value: openaiConfigData.api_key || [], placeholder: '输入API密钥（支持多个）', description: '' }} showLabel={false} onChange={(k, v) => updateOpenaiConfigField('api_key', v as string[])} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4" />{t('aiConfig.serviceProvider.modelCapabilities')}</Label>
                <div className="flex flex-wrap gap-2">
                  {getModelCapabilities(t).map((cap) => {
                    const modelSupport = Array.isArray(openaiConfigData.model_support) ? openaiConfigData.model_support : ['text'];
                    const isSelected = modelSupport.includes(cap.value);
                    const Icon = cap.icon;
                    return (
                      <button
                        key={cap.value}
                        type="button"
                        onClick={() => { const current = Array.isArray(openaiConfigData.model_support) ? openaiConfigData.model_support : ['text']; const newValue = isSelected ? current.filter(v => v !== cap.value) : [...current, cap.value]; updateOpenaiConfigField('model_support', newValue); }}
                        className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all", isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30 text-muted-foreground")}
                      >
                        <Icon className="w-4 h-4" />{cap.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">{t('aiConfig.openaiConfig.noConfig')}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveOpenaiConfig} disabled={isSavingOpenaiConfig}>{isSavingOpenaiConfig && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Config Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t('aiConfig.openaiConfig.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('aiConfig.openaiConfig.deleteMessage').replace('{name}', editingConfigName)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfig} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
