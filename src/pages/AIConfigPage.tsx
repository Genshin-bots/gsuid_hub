import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  Server, AlertTriangle, SlidersHorizontal, HelpCircle
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
  embeddingConfigApi,
  api,
  PluginConfigItem,
  FrameworkConfigListItem,
  OpenAIConfigData,
  ProviderInfo,
  AllConfigsSummary,
  AllConfigItem,
  ProviderConfigOptions,
  EmbeddingConfigSummary,
  EmbeddingConfigField,
} from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ConfigField, ConfigValue, ConfigFieldType, DynamicConfigPanel } from '@/components/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
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
      "transition-all duration-300 hover:shadow-md",
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
  const [highLevelConfig, setHighLevelConfig] = useState<string>(''); // provider++name 格式
  const [lowLevelConfig, setLowLevelConfig] = useState<string>('');   // provider++name 格式

  // State - OpenAI Config
  const [openaiConfigData, setOpenaiConfigData] = useState<OpenAIConfigData | null>(null);
  const [isLoadingOpenaiConfig, setIsLoadingOpenaiConfig] = useState(false);
  const [isSavingOpenaiConfig, setIsSavingOpenaiConfig] = useState(false);

  // State - Provider Config Options
  const [providerConfigOptions, setProviderConfigOptions] = useState<ProviderConfigOptions | null>(null);

  // State - Embedding Config
  const [embeddingSummary, setEmbeddingSummary] = useState<EmbeddingConfigSummary | null>(null);
  const [isLoadingEmbeddingConfig, setIsLoadingEmbeddingConfig] = useState(false);
  const [isSavingEmbeddingConfig, setIsSavingEmbeddingConfig] = useState(false);
  const [embeddingLocalConfig, setEmbeddingLocalConfig] = useState<Record<string, EmbeddingConfigField>>({});
  const [embeddingOpenaiConfig, setEmbeddingOpenaiConfig] = useState<Record<string, EmbeddingConfigField>>({});

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

  // 归一化配置名称：如果没有 ++ 分隔符，默认当作 openai provider 处理
  const normalizeConfigName = useCallback((name: string, configs: AllConfigItem[]): string => {
    if (!name) return '';
    // 如果已经是 provider++name 格式，直接返回
    if (name.includes('++')) return name;
    // 旧格式（不含 ++），默认当作 openai provider
    // 尝试在 configs 中查找匹配的配置
    const match = configs.find(c => c.config_name === name);
    if (match) return match.name; // 返回 provider++name 格式
    // 找不到则默认 openai
    return `openai++${name}`;
  }, []);

  const fetchAllConfigs = useCallback(async () => {
    try {
      const response = await providerConfigApi.getAllConfigs();
      setAllConfigs(response);
      const configList = response.configs || [];
      setHighLevelConfig(normalizeConfigName(response.high_level_config || '', configList));
      setLowLevelConfig(normalizeConfigName(response.low_level_config || '', configList));
    } catch (error) {
      console.error('Failed to fetch all configs:', error);
    }
  }, [normalizeConfigName]);

  const fetchEmbeddingConfig = useCallback(async () => {
    try {
      setIsLoadingEmbeddingConfig(true);
      const summary = await embeddingConfigApi.getSummary();
      setEmbeddingSummary(summary);
      setEmbeddingLocalConfig(summary.local_config || {});
      setEmbeddingOpenaiConfig(summary.openai_config || {});
    } catch (error) {
      console.error('Failed to fetch embedding config:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.serviceProvider.embeddingConfigLoadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEmbeddingConfig(false);
    }
  }, [t]);

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
    fetchEmbeddingConfig();
  }, [fetchConfigList, fetchProviderList, fetchAllConfigs, fetchEmbeddingConfig]);

  // 使用 ref 跟踪已请求过的配置，避免重复请求
  const fetchedConfigNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (configList.length > 0) {
      configList.forEach(config => {
        if (!configs[config.id] && !fetchedConfigNamesRef.current.has(config.full_name)) {
          fetchedConfigNamesRef.current.add(config.full_name);
          fetchConfigDetail(config.full_name);
        }
      });
    }
  }, [configList, configs, fetchConfigDetail]);

  useEffect(() => {
    // 等待所有配置都加载完成后再设置 originalConfig，避免部分加载导致 dirty 误判
    if (configList.length > 0 && Object.keys(configs).length >= configList.length && !hasInitialized) {
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      setHasInitialized(true);
    }
  }, [configs, configList, hasInitialized]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleSetHighLevelConfig = useCallback(async (configFullName: string) => {
    try {
      // configFullName 是 provider++name 格式，直接传给后端
      await providerConfigApi.setHighLevelConfig(configFullName);
      setHighLevelConfig(configFullName);
      toast({
        title: t('common.success'),
        description: t('aiConfig.providerConfig.setHighLevelSuccess', { name: configFullName }),
      });
      // 高低级任务切换不涉及框架配置变更，刷新后同步 originalConfig
      await fetchAllConfigs();
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
    } catch (error) {
      console.error('Failed to set high level config:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.providerConfig.setFailed'),
        variant: 'destructive',
      });
    }
  }, [t, fetchAllConfigs, configs]);

  const handleSetLowLevelConfig = useCallback(async (configFullName: string) => {
    try {
      // configFullName 是 provider++name 格式，直接传给后端
      await providerConfigApi.setLowLevelConfig(configFullName);
      setLowLevelConfig(configFullName);
      toast({
        title: t('common.success'),
        description: t('aiConfig.providerConfig.setLowLevelSuccess', { name: configFullName }),
      });
      // 高低级任务切换不涉及框架配置变更，刷新后同步 originalConfig
      await fetchAllConfigs();
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
    } catch (error) {
      console.error('Failed to set low level config:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.providerConfig.setFailed'),
        variant: 'destructive',
      });
    }
  }, [t, fetchAllConfigs, configs]);

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
    
    const fullConfigName = `${editingConfigProvider}++${editingConfigName}`;
    const configsList = allConfigs?.configs || [];
    
    try {
      // 如果删除的配置正在被使用，需要先处理任务配置
      const isUsedByHigh = highLevelConfig === fullConfigName;
      const isUsedByLow = lowLevelConfig === fullConfigName;
      
      if (isUsedByHigh || isUsedByLow) {
        // 找到另一个可用的配置
        const otherConfig = configsList.find(c => c.name !== fullConfigName);
        
        if (otherConfig) {
          // 有其他配置，切换到另一个配置
          if (isUsedByHigh) {
            await providerConfigApi.setHighLevelConfig(otherConfig.name);
          }
          if (isUsedByLow) {
            await providerConfigApi.setLowLevelConfig(otherConfig.name);
          }
        } else {
          // 没有其他配置，清除任务配置
          if (isUsedByHigh) {
            await providerConfigApi.clearTaskConfig('high');
          }
          if (isUsedByLow) {
            await providerConfigApi.clearTaskConfig('low');
          }
        }
      }
      
      // 再删除配置文件
      await providerConfigApi.deleteConfig(editingConfigProvider, editingConfigName);
      toast({ title: t('common.success'), description: t('aiConfig.openaiConfig.deleteSuccess', { name: editingConfigName }) });
      setIsDeleteDialogOpen(false);
      setEditingConfigName('');
      setHighLevelConfig(prev => prev === fullConfigName ? '' : prev);
      setLowLevelConfig(prev => prev === fullConfigName ? '' : prev);
      await fetchAllConfigs();
    } catch (error) {
      console.error('Failed to delete config:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      toast({
        title: t('common.error'),
        description: errorMsg ? `${t('aiConfig.openaiConfig.deleteFailed')}: ${errorMsg}` : t('aiConfig.openaiConfig.deleteFailed'),
        variant: 'destructive'
      });
    }
  }, [editingConfigName, editingConfigProvider, t, fetchAllConfigs, highLevelConfig, lowLevelConfig, allConfigs]);

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

  // 嵌入模型配置 - 切换提供方
  const handleSwitchEmbeddingProvider = useCallback(async (provider: string) => {
    try {
      const response = await embeddingConfigApi.setProvider(provider);
      toast({
        title: t('common.success'),
        description: response.msg || t('aiConfig.serviceProvider.embeddingProviderSwitched', { provider }),
      });
      // 刷新嵌入模型配置摘要
      await fetchEmbeddingConfig();
    } catch (error) {
      console.error('Failed to switch embedding provider:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.serviceProvider.embeddingProviderSwitchFailed'),
        variant: 'destructive',
      });
    }
  }, [t, fetchEmbeddingConfig]);

  // 嵌入模型配置 - 更新本地配置字段
  const updateEmbeddingLocalField = useCallback((fieldKey: string, value: unknown) => {
    setEmbeddingLocalConfig(prev => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], data: value },
    }));
  }, []);

  // 嵌入模型配置 - 更新 OpenAI 配置字段
  const updateEmbeddingOpenaiField = useCallback((fieldKey: string, value: unknown) => {
    setEmbeddingOpenaiConfig(prev => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], data: value },
    }));
  }, []);

  // 嵌入模型配置 - 保存本地配置
  const handleSaveEmbeddingLocalConfig = useCallback(async () => {
    try {
      setIsSavingEmbeddingConfig(true);
      const configData: Record<string, unknown> = {};
      Object.entries(embeddingLocalConfig).forEach(([key, field]) => {
        configData[key] = field.data;
      });
      await embeddingConfigApi.saveLocalConfig(configData);
      toast({
        title: t('common.success'),
        description: t('aiConfig.serviceProvider.embeddingConfigSaved'),
      });
    } catch (error) {
      console.error('Failed to save embedding local config:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.serviceProvider.embeddingConfigSaveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingEmbeddingConfig(false);
    }
  }, [embeddingLocalConfig, t]);

  // 嵌入模型配置 - 保存 OpenAI 配置
  const handleSaveEmbeddingOpenaiConfig = useCallback(async () => {
    try {
      setIsSavingEmbeddingConfig(true);
      const configData: Record<string, unknown> = {};
      Object.entries(embeddingOpenaiConfig).forEach(([key, field]) => {
        configData[key] = field.data;
      });
      await embeddingConfigApi.saveOpenaiConfig(configData);
      toast({
        title: t('common.success'),
        description: t('aiConfig.serviceProvider.embeddingConfigSaved'),
      });
    } catch (error) {
      console.error('Failed to save embedding openai config:', error);
      toast({
        title: t('common.error'),
        description: t('aiConfig.serviceProvider.embeddingConfigSaveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingEmbeddingConfig(false);
    }
  }, [embeddingOpenaiConfig, t]);

  const openDeleteDialog = (configName: string, provider: string) => {
    setEditingConfigName(configName); // 纯配置名
    setEditingConfigProvider(provider);
    setIsDeleteDialogOpen(true);
  };

  const openEditDialog = (configName: string, provider: string) => {
    setEditingConfigName(configName); // 纯配置名
    setEditingConfigProvider(provider);
    fetchConfigDetailForEdit(provider, configName);
    fetchProviderConfigOptions(provider);
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

  const exaConfig = useMemo(() => {
    return Object.values(configs).find(c =>
      c.name.includes('Exa搜索配置') || c.full_name.includes('Exa搜索配置')
    );
  }, [configs]);

  const miniMaxConfig = useMemo(() => {
    return Object.values(configs).find(c =>
      c.name.includes('MiniMax搜索配置') || c.full_name.includes('MiniMax搜索配置')
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
      // 只保存实际发生变化的配置，避免并发写入导致竞态条件
      const changedConfigs = Object.values(configs).filter(config => {
        const original = originalConfig[config.id];
        if (!original) return true;
        return JSON.stringify(config.config) !== JSON.stringify(original.config);
      });

      if (changedConfigs.length === 0) {
        toast({ title: t('common.success'), description: t('aiConfig.configSaved') });
        setIsSaving(false);
        return;
      }

      for (const config of changedConfigs) {
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
    return allConfigs.configs || [];
  }, [allConfigs]);

  // 验证高级/低级任务配置是否在可用配置列表中
  const isHighLevelConfigValid = useMemo(() => {
    if (!highLevelConfig) return false;
    return allConfigsList.some(c => c.name === highLevelConfig);
  }, [highLevelConfig, allConfigsList]);

  const isLowLevelConfigValid = useMemo(() => {
    if (!lowLevelConfig) return false;
    return allConfigsList.some(c => c.name === lowLevelConfig);
  }, [lowLevelConfig, allConfigsList]);

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bot className="w-8 h-8" />
            {t('aiConfig.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('aiConfig.description')}</p>
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

                {/* 未激活配置警告 */}
                {allConfigsList.length === 0 ? (
                  <Card className={cn(
                    isGlass
                      ? "glass-card border-red-500/50 bg-red-500/10 dark:bg-red-950/50 dark:border-red-800/60"
                      : "border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            {t('aiConfig.providerConfig.noConfigFileTitle') || '暂无配置文件'}
                          </p>
                          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                            {t('aiConfig.providerConfig.noConfigFileWarning') || '请先点击右上角「新建配置」添加一个配置文件，然后再为高级任务和低级任务选择对应的配置'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (!isHighLevelConfigValid && !isLowLevelConfigValid) && (
                  <Card className={cn(
                    isGlass
                      ? "glass-card border-red-500/50 bg-red-500/10 dark:bg-red-950/50 dark:border-red-800/60"
                      : "border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            {t('aiConfig.providerConfig.noActiveConfigTitle')}
                          </p>
                          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                            {t('aiConfig.providerConfig.noActiveConfigWarning')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                          // configItem.name 是 provider++name 格式，highLevelConfig 也是 provider++name 格式
                          const isSelected = configItem.name === highLevelConfig;
                          return (
                            <div
                              key={`high-${configItem.name}`}
                              className={cn(
                                "group flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer",
                                isSelected ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50 hover:border-primary/20"
                              )}
                              onClick={() => handleSetHighLevelConfig(configItem.name)}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                                  isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium truncate block">{configItem.config_name}</span>
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
                                        onClick={(e) => { e.stopPropagation(); openEditDialog(configItem.config_name, configItem.provider); }}
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
                                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(configItem.config_name, configItem.provider); }}
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
                          // configItem.name 是 provider++name 格式，lowLevelConfig 也是 provider++name 格式
                          const isSelected = configItem.name === lowLevelConfig;
                          return (
                            <div
                              key={`low-${configItem.name}`}
                              className={cn(
                                "group flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer",
                                isSelected ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/50 bg-card/50 hover:border-primary/20"
                              )}
                              onClick={() => handleSetLowLevelConfig(configItem.name)}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                                  isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium truncate block">{configItem.config_name}</span>
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
                                        onClick={(e) => { e.stopPropagation(); openEditDialog(configItem.config_name, configItem.provider); }}
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
                                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(configItem.config_name, configItem.provider); }}
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
                    {/* 嵌入模型提供方选择 */}
                    <ChipGroup
                      options={(embeddingSummary?.available_providers || embeddingProviderOptions).map(p => ({
                        value: p,
                        label: p === 'local' ? t('aiConfig.serviceProvider.localModel') : p === 'openai' ? t('aiConfig.serviceProvider.openaiModel') : p,
                        icon: p === 'local' ? <Database className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />,
                      }))}
                      value={[embeddingSummary?.provider || aiConfig.config.embedding_provider?.value as string].filter(Boolean)}
                      onValueChange={(newValue) => {
                        const newProvider = newValue[0] || '';
                        // 同时更新 aiConfig 中的 embedding_provider 和调用 API 切换
                        updateConfigValue(aiConfig.id, 'embedding_provider', newProvider);
                        handleSwitchEmbeddingProvider(newProvider);
                      }}
                      selectMode="single"
                      showRadioIndicator
                    />
                    {/* 提供方描述 */}
                    <p className="text-xs text-muted-foreground mt-1 px-1">
                      {t('aiConfig.serviceProvider.embeddingProviderDesc')}
                    </p>

                    {/* 嵌入模型配置 - 根据提供方显示不同表单 */}
                    {isLoadingEmbeddingConfig ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <SubConfigPanel
                        title={t('aiConfig.serviceProvider.embeddingConfig')}
                        icon={<Layers className="w-3.5 h-3.5" />}
                      >
                        <div className="space-y-4">
                          {/* 本地模型配置 */}
                          {(embeddingSummary?.provider || aiConfig.config.embedding_provider?.value) === 'local' && (
                            <div className="space-y-3">
                              {Object.entries(embeddingLocalConfig).map(([key, field]) => (
                                <div key={key} className="space-y-1.5">
                                  <Label className="text-sm font-medium">{field.title || key}</Label>
                                  {field.desc && <p className="text-xs text-muted-foreground">{field.desc}</p>}
                                  <ConfigField
                                    fieldKey={key}
                                    field={{
                                      type: (Array.isArray(field.options) && field.options.length > 0 ? 'select' : 'text') as ConfigFieldType,
                                      label: field.title || key,
                                      value: field.data as string,
                                      options: field.options || [],
                                      placeholder: '',
                                      description: field.desc || '',
                                    }}
                                    showLabel={false}
                                    onChange={(k, v) => updateEmbeddingLocalField(k, v)}
                                  />
                                </div>
                              ))}
                              <div className="pt-2">
                                <Button
                                  size="sm"
                                  onClick={handleSaveEmbeddingLocalConfig}
                                  disabled={isSavingEmbeddingConfig}
                                  className="gap-2"
                                >
                                  {isSavingEmbeddingConfig ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5" />
                                  )}
                                  {t('common.save')}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* OpenAI 兼容配置 */}
                          {(embeddingSummary?.provider || aiConfig.config.embedding_provider?.value) === 'openai' && (
                            <div className="space-y-3">
                              {Object.entries(embeddingOpenaiConfig).map(([key, field]) => (
                                <div key={key} className="space-y-1.5">
                                  <Label className="text-sm font-medium flex items-center gap-2">
                                    {key === 'base_url' && <Globe className="w-3.5 h-3.5" />}
                                    {key === 'api_key' && <Key className="w-3.5 h-3.5" />}
                                    {key === 'embedding_model' && <Cpu className="w-3.5 h-3.5" />}
                                    {field.title || key}
                                  </Label>
                                  {field.desc && <p className="text-xs text-muted-foreground">{field.desc}</p>}
                                  {key === 'api_key' ? (
                                    <ConfigField
                                      fieldKey={key}
                                      field={{
                                        type: 'tags',
                                        label: field.title || key,
                                        value: (field.data as string[]) || [],
                                        placeholder: '输入API密钥（支持多个）',
                                        description: field.desc || '',
                                      }}
                                      showLabel={false}
                                      onChange={(k, v) => updateEmbeddingOpenaiField(k, v)}
                                    />
                                  ) : (
                                    <InputWithDropdown
                                      value={(field.data as string) || ''}
                                      onChange={(val) => updateEmbeddingOpenaiField(key, val)}
                                      options={field.options || []}
                                      placeholder={`选择或输入${field.title || key}`}
                                      inputPlaceholder={field.options?.[0] || ''}
                                    />
                                  )}
                                </div>
                              ))}
                              <div className="pt-2">
                                <Button
                                  size="sm"
                                  onClick={handleSaveEmbeddingOpenaiConfig}
                                  disabled={isSavingEmbeddingConfig}
                                  className="gap-2"
                                >
                                  {isSavingEmbeddingConfig ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Save className="w-3.5 h-3.5" />
                                  )}
                                  {t('common.save')}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </SubConfigPanel>
                    )}

                    {/* Rerank 配置 */}
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
                        <div className="mt-3 pl-4 border-l-2 border-primary/20">
                          <DynamicConfigPanel
                            config={rerankConfig.config}
                            configId={rerankConfig.id}
                            onChange={updateConfigValue}
                          />
                        </div>
                      )}
                    </div>
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
                        <DynamicConfigPanel
                          config={tavilyConfig.config}
                          configId={tavilyConfig.id}
                          onChange={updateConfigValue}
                          layout={[['api_key'], ['max_results', 'search_depth']]}
                        />
                      </SubConfigPanel>
                    )}
                    {websearchProvider === 'Exa' && exaConfig && (
                      <SubConfigPanel
                        title={t('aiConfig.serviceProvider.exaConfig')}
                        icon={<Key className="w-3.5 h-3.5" />}
                      >
                        <DynamicConfigPanel
                          config={exaConfig.config}
                          configId={exaConfig.id}
                          onChange={updateConfigValue}
                          layout={[['api_key'], ['max_results', 'search_type']]}
                        />
                      </SubConfigPanel>
                    )}
                    {websearchProvider === 'MiniMax' && miniMaxConfig && (
                      <SubConfigPanel
                        title={t('aiConfig.serviceProvider.miniMaxConfig')}
                        icon={<Key className="w-3.5 h-3.5" />}
                      >
                        <DynamicConfigPanel
                          config={miniMaxConfig.config}
                          configId={miniMaxConfig.id}
                          onChange={updateConfigValue}
                          layout={[['api_key'], ['api_host', 'resource_mode']]}
                        />
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
                        {aiConfig.config.multi_agent_lenth?.desc && (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-primary/10 transition-colors focus:outline-none" onClick={(e) => e.preventDefault()}>
                                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p>{aiConfig.config.multi_agent_lenth.desc}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
                            description: aiConfig.config.multi_agent_lenth?.desc || '',
                          }}
                          showLabel={false}
                          onChange={(k, v) => updateConfigValue(aiConfig.id, k, typeof v === 'string' ? parseInt(v) : v)}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{t('aiConfig.advancedSettings.roundsHint')}</span>
                      </div>
                    </div>
                    <Separator className="bg-border/30" />
                    <DynamicConfigPanel
                      config={aiConfig.config}
                      configId={aiConfig.id}
                      onChange={updateConfigValue}
                      excludeKeys={['enable', 'enable_rerank', 'enable_memory', 'websearch_provider', 'embedding_provider', 'multi_agent_lenth', 'high_level_provider_config_name', 'low_level_provider_config_name']}
                      layout={[['white_list', 'black_list']]}
                    />
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
                          {memoryConfig.config.memory_mode?.desc && (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button type="button" className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-primary/10 transition-colors focus:outline-none" onClick={(e) => e.preventDefault()}>
                                    <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p>{memoryConfig.config.memory_mode.desc}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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
                      <DynamicConfigPanel
                        config={memoryConfig.config}
                        configId={memoryConfig.id}
                        onChange={updateConfigValue}
                        excludeKeys={['memory_mode', 'enable_system2', 'eval_mode']}
                        layout={[['memory_session', 'retrieval_top_k']]}
                      />
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
              <InputWithDropdown
                value={newConfigBaseUrl}
                onChange={setNewConfigBaseUrl}
                options={providerConfigOptions?.options?.base_url || []}
                placeholder="选择或输入 API Base URL"
                inputPlaceholder="https://api.openai.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('aiConfig.serviceProvider.apiModel')}</Label>
              <InputWithDropdown
                value={newConfigModel}
                onChange={setNewConfigModel}
                options={providerConfigOptions?.options?.model_name || []}
                placeholder="选择或输入模型名称"
                inputPlaceholder="gpt-4o-mini"
              />
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
                <InputWithDropdown
                  value={openaiConfigData.base_url}
                  onChange={(val) => updateOpenaiConfigField('base_url', val)}
                  options={providerConfigOptions?.options?.base_url || []}
                  placeholder="选择或输入 API Base URL"
                  inputPlaceholder="输入或选择 API Base URL"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><Cpu className="w-4 h-4" />{t('aiConfig.serviceProvider.apiModel')}</Label>
                <InputWithDropdown
                  value={openaiConfigData.model_name}
                  onChange={(val) => updateOpenaiConfigField('model_name', val)}
                  options={providerConfigOptions?.options?.model_name || []}
                  placeholder="选择或输入模型名称"
                  inputPlaceholder="输入或选择模型名称"
                />
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
