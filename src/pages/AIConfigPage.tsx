import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Cpu, Loader2, Save, Settings, Zap, Users, Ban, CheckCircle,
  Sparkles, Search, Brain, Key, Globe, MessageSquare,
  Layers, MemoryStick, ChevronRight, ChevronDown, Bot, Wifi, Database,
  Plus, Pencil, Trash2, Check, FileText,
  Server, AlertTriangle, ArrowUpDown, SlidersHorizontal, HelpCircle,
  Smile, Eye, Wrench, ListChecks, Image
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
  mcpConfigApi,
  MCPConfig,
  aiWizardApi,
  AIWizardChecklistItem,
  AIWizardStatusResponse,
  AIWizardPersonaScope,
  personaApi,
} from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ConfigField, ConfigValue, ConfigFieldType, DynamicConfigPanel, pluginConfigItemToFieldDef, ConfigSelectDropdown } from '@/components/config';
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
        "flex items-center justify-center flex-shrink-0 transition-all duration-300",
        checked ? iconColorClass : "text-muted-foreground"
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

// Persona Avatar Component
function PersonaAvatar({ name, isEnabled }: { name: string; isEnabled: boolean }) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center">
      {!imgError ? (
        <img
          src={personaApi.getAvatarUrl(name, Date.now())}
          alt={name}
          className={cn("w-full h-full object-cover", !isEnabled && "opacity-50")}
          onError={() => setImgError(true)}
        />
      ) : (
        <Bot className={cn("w-4 h-4", isEnabled ? "text-primary" : "text-muted-foreground")} />
      )}
    </div>
  );
}

// 空状态组件
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex items-center justify-center mb-4 text-muted-foreground/50">
        {icon}
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>}
    </div>
  );
}

// ============================================================================
// Sidebar Item
// ============================================================================

interface SidebarItemProps {
  id: string;
  activeSection: string;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  alert?: boolean;
  collapsed?: boolean;
  onClick: (id: string) => void;
}

function SidebarItem({ id, activeSection, icon, title, disabled, alert, collapsed, onClick }: SidebarItemProps) {
  const isActive = activeSection === id;
  const button = (
    <button
      onClick={() => !disabled && onClick(id)}
      disabled={disabled}
      title={collapsed ? title : undefined}
      className={cn(
        "w-full flex items-center rounded-lg text-sm transition-all duration-200 text-left",
        collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2",
        isActive
          ? "bg-primary/10 text-primary shadow-sm"
          : disabled
            ? "text-muted-foreground/40 cursor-not-allowed"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <div className={cn(
        "flex items-center justify-center flex-shrink-0 transition-colors relative",
        isActive ? "text-primary" : "text-muted-foreground/60"
      )}>
        {icon}
        {collapsed && alert && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
        )}
      </div>
      {!collapsed && (
        <>
          <span className={cn("font-medium", isActive && "text-primary")}>{title}</span>
          {alert && (
            <span className="shrink-0 ml-auto text-red-500" data-alert-icon>
              <AlertTriangle className="w-3.5 h-3.5" data-alert-icon />
            </span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right"><p>{title}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIConfigPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  // Active section for sidebar (default to taskConfig since serviceSwitch is now standalone)
  const [activeSection, setActiveSection] = useState<string>('taskConfig');

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
  // 所选高/低级任务模型的能力（用于图片理解警告），key 为 provider++name
  const [modelSupportMap, setModelSupportMap] = useState<Record<string, string[]>>({});

  // State - OpenAI Config
  const [openaiConfigData, setOpenaiConfigData] = useState<OpenAIConfigData | null>(null);
  const [isLoadingOpenaiConfig, setIsLoadingOpenaiConfig] = useState(false);
  const [isSavingOpenaiConfig, setIsSavingOpenaiConfig] = useState(false);

  // State - Provider Config Options
  const [providerConfigOptions, setProviderConfigOptions] = useState<ProviderConfigOptions | null>(null);

  // State - Embedding Config
  const [embeddingSummary, setEmbeddingSummary] = useState<EmbeddingConfigSummary | null>(null);
  const [isLoadingEmbeddingConfig, setIsLoadingEmbeddingConfig] = useState(false);
  const [embeddingLocalConfig, setEmbeddingLocalConfig] = useState<Record<string, EmbeddingConfigField>>({});
  const [embeddingOpenaiConfig, setEmbeddingOpenaiConfig] = useState<Record<string, EmbeddingConfigField>>({});
  // 用于追踪嵌入模型配置的原始状态（脏检查）
  const [originalEmbeddingProvider, setOriginalEmbeddingProvider] = useState<string>('');
  const [originalEmbeddingLocalConfig, setOriginalEmbeddingLocalConfig] = useState<Record<string, EmbeddingConfigField>>({});
  const [originalEmbeddingOpenaiConfig, setOriginalEmbeddingOpenaiConfig] = useState<Record<string, EmbeddingConfigField>>({});

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageConfigDialogOpen, setIsManageConfigDialogOpen] = useState(false);
  // Embedding save warning dialog
  const [isEmbeddingWarningOpen, setIsEmbeddingWarningOpen] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<(() => void) | null>(null);
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
  const [newConfigFetchedModels, setNewConfigFetchedModels] = useState<string[]>([]);
  const [editConfigFetchedModels, setEditConfigFetchedModels] = useState<string[]>([]);
  const [isFetchingNewConfigModels, setIsFetchingNewConfigModels] = useState(false);
  const [isFetchingEditConfigModels, setIsFetchingEditConfigModels] = useState(false);

  // Track original state
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [hasInitialized, setHasInitialized] = useState(false);

  // State - MCP Configs
  const [mcpConfigs, setMcpConfigs] = useState<MCPConfig[]>([]);
  const [mcpToolDialogOpen, setMcpToolDialogOpen] = useState(false);
  const [mcpToolDialogType, setMcpToolDialogType] = useState<'websearch' | 'image_understand'>('websearch');

  // State - AI Wizard
  const [isWizardDialogOpen, setIsWizardDialogOpen] = useState(false);
  const [wizardChecklist, setWizardChecklist] = useState<AIWizardChecklistItem[]>([]);
  const [wizardOverallStatus, setWizardOverallStatus] = useState<'overall_ok' | 'overall_warning' | 'overall_error'>('overall_ok');
  const [wizardUsable, setWizardUsable] = useState(false);
  const [wizardSummary, setWizardSummary] = useState({ total: 0, ok: 0, warning: 0, error: 0 });
  const [isWizardLoading, setIsWizardLoading] = useState(false);
  const [wizardStatus, setWizardStatus] = useState<AIWizardStatusResponse | null>(null);

  const baseUrlHasTrailingSlash = useCallback((baseUrl: string) => baseUrl.trim().endsWith('/'), []);

  const getFirstApiKey = useCallback((apiKeys: string[]) => {
    return apiKeys.find((key) => key.trim())?.trim() || '';
  }, []);

  const mergeModelOptions = useCallback((fetchedModels: string[], defaultModels: string[] = []) => {
    return Array.from(new Set([...fetchedModels, ...defaultModels].filter(Boolean)));
  }, []);

  const fetchProviderModels = useCallback(async (
    provider: string,
    baseUrl: string,
    apiKeys: string[],
    onSuccess: (models: string[]) => void,
    setLoading: (loading: boolean) => void,
  ) => {
    const trimmedBaseUrl = baseUrl.trim();
    const apiKey = getFirstApiKey(apiKeys);
    if (!trimmedBaseUrl || !apiKey || baseUrlHasTrailingSlash(trimmedBaseUrl)) {
      onSuccess([]);
      return;
    }

    try {
      setLoading(true);
      const models = provider === 'anthropic'
        ? await providerConfigApi.fetchAnthropicModels(trimmedBaseUrl, apiKey)
        : await providerConfigApi.fetchOpenAIModels(trimmedBaseUrl, apiKey);
      onSuccess(models);
    } catch (error) {
      console.error(`Failed to fetch ${provider} models:`, error);
      onSuccess([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrlHasTrailingSlash, getFirstApiKey]);

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

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchProviderModels(
        newConfigProvider,
        newConfigBaseUrl,
        newConfigApiKeys,
        setNewConfigFetchedModels,
        setIsFetchingNewConfigModels,
      );
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [fetchProviderModels, newConfigProvider, newConfigBaseUrl, newConfigApiKeys]);

  useEffect(() => {
    if (!openaiConfigData) {
      setEditConfigFetchedModels([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      fetchProviderModels(
        editingConfigProvider,
        openaiConfigData.base_url,
        openaiConfigData.api_key || [],
        setEditConfigFetchedModels,
        setIsFetchingEditConfigModels,
      );
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [fetchProviderModels, editingConfigProvider, openaiConfigData?.base_url, openaiConfigData?.api_key]);

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
      toast.error(t('aiConfig.openaiConfig.loadFailed'));
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
      const localCfg = summary.local_config || {};
      const openaiCfg = summary.openai_config || {};
      setEmbeddingLocalConfig(localCfg);
      setEmbeddingOpenaiConfig(openaiCfg);
      // 记录原始状态用于脏检查
      setOriginalEmbeddingProvider(summary.provider || '');
      setOriginalEmbeddingLocalConfig(JSON.parse(JSON.stringify(localCfg)));
      setOriginalEmbeddingOpenaiConfig(JSON.parse(JSON.stringify(openaiCfg)));
    } catch (error) {
      console.error('Failed to fetch embedding config:', error);
      toast.error(t('aiConfig.serviceProvider.embeddingConfigLoadFailed'));
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
      toast.error(t('aiConfig.loadFailed'));
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

  const fetchMcpConfigs = useCallback(async () => {
    try {
      const data = await mcpConfigApi.getList();
      setMcpConfigs(data.configs);
    } catch (error) {
      console.error('Failed to fetch MCP configs:', error);
    }
  }, []);

  useEffect(() => {
    fetchConfigList();
    fetchProviderList();
    fetchAllConfigs();
    fetchEmbeddingConfig();
    fetchMcpConfigs();
  }, [fetchConfigList, fetchProviderList, fetchAllConfigs, fetchEmbeddingConfig, fetchMcpConfigs]);

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

  // 拉取所选高/低级任务配置的 model_support（用于图片理解能力警告）
  useEffect(() => {
    const list = allConfigs?.configs || [];
    const targets = [highLevelConfig, lowLevelConfig].filter(Boolean);
    targets.forEach((fullName) => {
      if (modelSupportMap[fullName] !== undefined) return; // 已缓存
      const item = list.find((c) => c.name === fullName);
      if (!item) return;
      providerConfigApi.getConfigDetail(item.provider, item.config_name)
        .then((detail) => {
          const support = (detail.config?.model_support?.data as string[]) || ['text'];
          setModelSupportMap((prev) => ({ ...prev, [fullName]: support }));
        })
        .catch((error) => {
          console.error('Failed to fetch model_support:', error);
        });
    });
  }, [highLevelConfig, lowLevelConfig, allConfigs, modelSupportMap]);

  // ============================================================================
  // Actions
  // ============================================================================

  const handleSetHighLevelConfig = useCallback(async (configFullName: string) => {
    try {
      // configFullName 是 provider++name 格式，直接传给后端
      await providerConfigApi.setHighLevelConfig(configFullName);
      setHighLevelConfig(configFullName);
      toast.success(t('aiConfig.providerConfig.setHighLevelSuccess', { name: configFullName }));
      // 高低级任务切换不涉及框架配置变更，刷新后同步 originalConfig
      await fetchAllConfigs();
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
    } catch (error) {
      console.error('Failed to set high level config:', error);
      toast.error(t('aiConfig.providerConfig.setFailed'));
    }
  }, [t, fetchAllConfigs, configs]);

  const handleSetLowLevelConfig = useCallback(async (configFullName: string) => {
    try {
      // configFullName 是 provider++name 格式，直接传给后端
      await providerConfigApi.setLowLevelConfig(configFullName);
      setLowLevelConfig(configFullName);
      toast.success(t('aiConfig.providerConfig.setLowLevelSuccess', { name: configFullName }));
      // 高低级任务切换不涉及框架配置变更，刷新后同步 originalConfig
      await fetchAllConfigs();
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
    } catch (error) {
      console.error('Failed to set low level config:', error);
      toast.error(t('aiConfig.providerConfig.setFailed'));
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
      toast.success(t('aiConfig.openaiConfig.saveSuccess'));
      fetchAllConfigs();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error(t('aiConfig.openaiConfig.saveFailed'));
    } finally {
      setIsSavingOpenaiConfig(false);
    }
  }, [openaiConfigData, editingConfigName, editingConfigProvider, t, fetchAllConfigs]);

  const handleCreateOpenaiConfig = useCallback(async () => {
    if (!newConfigName.trim()) {
      toast.error(t('aiConfig.openaiConfig.nameRequired'));
      return;
    }
    if (!newConfigBaseUrl.trim()) {
      toast.error(t('aiConfig.openaiConfig.baseUrlRequired'));
      return;
    }
    if (!newConfigModel.trim()) {
      toast.error(t('aiConfig.openaiConfig.modelRequired'));
      return;
    }
    if (newConfigApiKeys.length === 0 || newConfigApiKeys.every(k => !k.trim())) {
      toast.error(t('aiConfig.openaiConfig.apiKeyRequired'));
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
      toast.success(t('aiConfig.openaiConfig.createSuccess', { name: configName }));
      setIsCreateDialogOpen(false);
      resetNewConfigForm();
      await fetchAllConfigs();
    } catch (error) {
      console.error(`Failed to create ${newConfigProvider} config:`, error);
      toast.error(t('aiConfig.openaiConfig.createFailed'));
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
      toast.success(t('aiConfig.openaiConfig.deleteSuccess', { name: editingConfigName }));
      setIsDeleteDialogOpen(false);
      setEditingConfigName('');
      setHighLevelConfig(prev => prev === fullConfigName ? '' : prev);
      setLowLevelConfig(prev => prev === fullConfigName ? '' : prev);
      await fetchAllConfigs();
    } catch (error) {
      console.error('Failed to delete config:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg ? `${t('aiConfig.openaiConfig.deleteFailed')}: ${errorMsg}` : t('aiConfig.openaiConfig.deleteFailed'));
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
    setNewConfigFetchedModels([]);
  };

  const updateOpenaiConfigField = useCallback((field: keyof OpenAIConfigData, value: string | string[]) => {
    setOpenaiConfigData(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  // 嵌入模型配置 - 切换提供方（仅更新本地状态，保存时统一提交）
  const handleSwitchEmbeddingProvider = useCallback((provider: string) => {
    setEmbeddingSummary(prev => prev ? { ...prev, provider } : null);
  }, []);

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

  const memeConfig = useMemo(() => {
    return Object.values(configs).find(c =>
      c.name.includes('表情包配置') || c.full_name.includes('表情包配置')
    );
  }, [configs]);

  const mcpToolsConfig = useMemo(() => {
    return Object.values(configs).find(c =>
      c.name.includes('MCP 工具配置') || c.full_name.includes('MCP 工具配置')
    );
  }, [configs]);

  const qdrantConfig = useMemo(() => {
    return Object.values(configs).find(c =>
      c.name.includes('Qdrant') || c.full_name.includes('Qdrant')
    );
  }, [configs]);

  const isAIEnabled = aiConfig?.config.enable?.value as boolean ?? false;
  const isRerankEnabled = aiConfig?.config.enable_rerank?.value as boolean ?? false;
  const rerankProvider = aiConfig?.config.rerank_provider?.value as string ?? 'local';
  const isMemoryEnabled = aiConfig?.config.enable_memory?.value as boolean ?? false;
  const websearchProvider = aiConfig?.config.websearch_provider?.value as string ?? 'Tavily';
  const imageUnderstandProvider = aiConfig?.config.image_understand_provider?.value as string ?? '';
  const qdrantProvider = aiConfig?.config.qdrant_provider?.value as string ?? 'local';
  const embeddingProvider = (embeddingSummary?.provider || aiConfig?.config.embedding_provider?.value as string) ?? 'local';

  // Generate MCP tool options from MCP configs
  const mcpToolOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (const config of mcpConfigs) {
      for (const tool of config.tools) {
        options.push({
          value: `${config.config_id} - ${tool.name}`,
          label: `${config.name} - ${tool.name}`,
        });
      }
    }
    return options;
  }, [mcpConfigs]);

  const websearchMcpToolId = (mcpToolsConfig?.config.websearch_mcp_tool_id?.value as string) || '';
  const imageUnderstandMcpToolId = (mcpToolsConfig?.config.image_understand_mcp_tool_id?.value as string) || '';

  const openMcpToolDialog = useCallback((type: 'websearch' | 'image_understand') => {
    setMcpToolDialogType(type);
    setMcpToolDialogOpen(true);
  }, []);

  const isConfigDirty = useMemo(() => {
    // 框架配置脏检查
    const configChanged = Object.keys(originalConfig).length > 0 && JSON.stringify(configs) !== JSON.stringify(originalConfig);
    // 嵌入模型配置脏检查（提供方 + 字段配置）
    const embeddingProviderChanged = embeddingSummary?.provider !== originalEmbeddingProvider;
    const embeddingLocalChanged = JSON.stringify(embeddingLocalConfig) !== JSON.stringify(originalEmbeddingLocalConfig);
    const embeddingOpenaiChanged = JSON.stringify(embeddingOpenaiConfig) !== JSON.stringify(originalEmbeddingOpenaiConfig);
    return configChanged || embeddingProviderChanged || embeddingLocalChanged || embeddingOpenaiChanged;
  }, [configs, originalConfig, embeddingSummary, originalEmbeddingProvider, embeddingLocalConfig, originalEmbeddingLocalConfig, embeddingOpenaiConfig, originalEmbeddingOpenaiConfig]);

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

  const handleSelectMcpTool = useCallback(async (toolId: string) => {
    if (!mcpToolsConfig) return;
    const configKey = mcpToolDialogType === 'websearch' ? 'websearch_mcp_tool_id' : 'image_understand_mcp_tool_id';
    try {
      await frameworkConfigApi.updateFrameworkConfigItem(mcpToolsConfig.full_name, configKey, toolId);
      updateConfigValue(mcpToolsConfig.id, configKey, toolId);
      toast.success(t('aiConfig.mcpTool.selectSuccess'));
      setMcpToolDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '');
    }
  }, [mcpToolsConfig, mcpToolDialogType, updateConfigValue, t]);

  // 实际执行保存逻辑
  const executeSave = async () => {
    try {
      setIsSaving(true);

      // 1. 保存框架配置（仅变化的部分）
      const changedConfigs = Object.values(configs).filter(config => {
        const original = originalConfig[config.id];
        if (!original) return true;
        return JSON.stringify(config.config) !== JSON.stringify(original.config);
      });

      for (const config of changedConfigs) {
        const configToSave: Record<string, any> = {};
        Object.entries(config.config).forEach(([key, field]: [string, any]) => {
          if (!field || typeof field !== 'object' || !('value' in field)) return;
          const rawType = (field.type || '').toLowerCase();
          let value = field.value;

          // 根据后端原始类型还原正确的值类型
          if (rawType === 'gsint') {
            if (typeof value === 'string') value = parseInt(value, 10);
          } else if (rawType === 'gsfloat') {
            if (typeof value === 'string') value = parseFloat(value);
          } else if (rawType === 'gsbool') {
            if (typeof value === 'string') value = value === 'true';
            else value = !!value;
          } else if (rawType === 'gsdict') {
            if (typeof value === 'string') {
              try { value = JSON.parse(value); } catch { /* keep as string */ }
            }
          } else if (rawType === 'gslist') {
            if (Array.isArray(value)) value = value.map(Number).filter((n: number) => !isNaN(n));
          } else if (rawType === 'gsliststr') {
            if (Array.isArray(value)) value = value.map(String);
          } else if (rawType === 'gsdivider') {
            return; // skip divider
          }

          configToSave[key] = value;
        });
        await frameworkConfigApi.updateFrameworkConfig(config.full_name, configToSave);
      }
      if (changedConfigs.length > 0) {
        setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      }

      // 2. 保存嵌入模型配置
      const currentProvider = embeddingSummary?.provider || '';
      if (currentProvider !== originalEmbeddingProvider) {
        const response = await embeddingConfigApi.setProvider(currentProvider);
        toast.success(response.msg || t('aiConfig.serviceProvider.embeddingProviderSwitched', { provider: currentProvider }));
        setOriginalEmbeddingProvider(currentProvider);
      }
      // 保存本地嵌入模型字段配置
      if (JSON.stringify(embeddingLocalConfig) !== JSON.stringify(originalEmbeddingLocalConfig)) {
        const localPayload: Record<string, unknown> = {};
        Object.entries(embeddingLocalConfig).forEach(([key, field]) => {
          localPayload[key] = field.data;
        });
        await embeddingConfigApi.saveLocalConfig(localPayload);
        setOriginalEmbeddingLocalConfig(JSON.parse(JSON.stringify(embeddingLocalConfig)));
      }
      // 保存 OpenAI 嵌入模型字段配置
      if (JSON.stringify(embeddingOpenaiConfig) !== JSON.stringify(originalEmbeddingOpenaiConfig)) {
        const openaiPayload: Record<string, unknown> = {};
        Object.entries(embeddingOpenaiConfig).forEach(([key, field]) => {
          openaiPayload[key] = field.data;
        });
        await embeddingConfigApi.saveOpenaiConfig(openaiPayload);
        setOriginalEmbeddingOpenaiConfig(JSON.parse(JSON.stringify(embeddingOpenaiConfig)));
      }

      toast.success(t('aiConfig.configSaved'));

      // 保存成功后调用向导 API 获取配置状态
      await fetchWizardChecklist();
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('aiConfig.saveFailed'));
    } finally {
      setIsSaving(false);
      setPendingSaveAction(null);
    }
  };

  const handleSaveConfig = () => {
    // 检查是否有嵌入模型配置变化
    const currentProvider = embeddingSummary?.provider || '';
    const hasEmbeddingChanges =
      currentProvider !== originalEmbeddingProvider ||
      JSON.stringify(embeddingLocalConfig) !== JSON.stringify(originalEmbeddingLocalConfig) ||
      JSON.stringify(embeddingOpenaiConfig) !== JSON.stringify(originalEmbeddingOpenaiConfig);

    // 检查 Qdrant 部署方式是否变化（切换后需重启并迁移数据）
    const aiConfigId = aiConfig?.id;
    const originalQdrant = aiConfigId ? (originalConfig[aiConfigId]?.config?.qdrant_provider?.value) : undefined;
    const currentQdrant = aiConfig?.config.qdrant_provider?.value;
    const hasQdrantChange = originalQdrant !== undefined && currentQdrant !== originalQdrant;

    if (hasEmbeddingChanges || hasQdrantChange) {
      // 有向量库相关变化，弹出警告对话框
      setPendingSaveAction(() => executeSave);
      setIsEmbeddingWarningOpen(true);
    } else {
      // 无变化，直接保存
      executeSave();
    }
  };

  const handleConfirmEmbeddingSave = () => {
    setIsEmbeddingWarningOpen(false);
    if (pendingSaveAction) {
      pendingSaveAction();
    }
  };

  const fetchWizardChecklist = async () => {
    try {
      setIsWizardLoading(true);
      const [checklistResponse, statusResponse] = await Promise.all([
        aiWizardApi.getChecklist(),
        aiWizardApi.getStatus(),
      ]);
      console.log('Wizard checklist:', checklistResponse);
      console.log('Wizard status:', statusResponse);
      setWizardChecklist(checklistResponse.items);
      setWizardOverallStatus(checklistResponse.overall_status);
      setWizardUsable(checklistResponse.usable);
      setWizardSummary(checklistResponse.summary);
      setWizardStatus(statusResponse);
      setIsWizardDialogOpen(true);
    } catch (error) {
      console.error('Failed to fetch wizard checklist:', error);
      toast.error(error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsWizardLoading(false);
    }
  };

  const embeddingProviderOptions = (aiConfig?.config.embedding_provider?.options || ['local']) as string[];
  const rerankProviderOptions = (aiConfig?.config.rerank_provider?.options || ['local']) as string[];
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

  // 所选高/低级任务模型是否缺少图片能力（已加载 model_support 且不含 image 时才警告）
  const taskModelLacksImage = useMemo(() => {
    const lacks = (fullName: string) => {
      if (!fullName) return false;
      const support = modelSupportMap[fullName];
      if (!support) return false; // 未加载完成，暂不警告
      return !support.includes('image');
    };
    return lacks(highLevelConfig) || lacks(lowLevelConfig);
  }, [highLevelConfig, lowLevelConfig, modelSupportMap]);

  const qdrantProviderOptions = (aiConfig?.config.qdrant_provider?.options || ['local', 'remote']) as string[];

  // ============================================================================
  // Render Helpers
  // ============================================================================


  // 嵌入模型字段渲染（本地 / OpenAI 兼容），用于「向量数据库服务」卡片
  const renderEmbeddingFields = () => {
    if (isLoadingEmbeddingConfig) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (embeddingProvider === 'local') {
      return (
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
                  value: field.data == null ? '' : String(field.data),
                  options: (field.options || []).map((o) => String(o)),
                  placeholder: '',
                  description: field.desc || '',
                }}
                showLabel={false}
                onChange={(k, v) => updateEmbeddingLocalField(k, v)}
              />
            </div>
          ))}
        </div>
      );
    }
    return (
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
                value={field.data == null ? '' : String(field.data)}
                onChange={(val) => updateEmbeddingOpenaiField(key, val)}
                options={(field.options || []).map((o) => String(o))}
                placeholder={`选择或输入${field.title || key}`}
                inputPlaceholder={field.options?.[0] != null ? String(field.options[0]) : ''}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // ============================================================================
  // Section Renderers
  // ============================================================================

  const renderServiceSwitchSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Bot className="w-5 h-5 text-primary" />
          {t('aiConfig.serviceSwitch.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAIEnabled ? t('aiConfig.serviceSwitch.enabledDesc') : t('aiConfig.serviceSwitch.disabledDesc')}
        </p>
      </div>

      <div className="flex items-center gap-5 p-5 rounded-xl border-2 border-border/40 bg-card/50">
        <div className={cn(
          "flex items-center justify-center flex-shrink-0 transition-all duration-500",
          isAIEnabled ? "text-primary" : "text-muted-foreground"
        )}>
          <Brain className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold">{t('aiConfig.serviceSwitch.title')}</span>
            <Badge
              variant={isAIEnabled ? "default" : "secondary"}
              className={cn(
                "text-xs font-medium",
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
          onCheckedChange={(checked) => updateConfigValue(aiConfig!.id, 'enable', checked)}
          className="scale-110"
        />
      </div>
    </div>
  );

  const renderTaskConfigSection = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <ListChecks className="w-5 h-5 text-primary" />
            {t('aiConfig.taskConfig.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('aiConfig.taskConfig.description')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 whitespace-nowrap text-xs"
          onClick={() => setIsManageConfigDialogOpen(true)}
        >
          <Settings className="w-3.5 h-3.5" />
          {t('aiConfig.manageConfig')}
        </Button>
      </div>

      {allConfigsList.length === 0 ? (
        <div className={cn(
          "rounded-xl p-4",
          isGlass
            ? "border border-red-500/50 bg-red-500/10 dark:bg-red-950/50 dark:border-red-800/60"
            : "border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
        )}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                {t('aiConfig.providerConfig.noConfigFileTitle')}
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                {t('aiConfig.taskConfig.emptyHint')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-8 gap-1.5 text-xs"
                onClick={() => setIsManageConfigDialogOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                {t('aiConfig.openaiConfig.createNew')}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* 高级任务 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">{t('aiConfig.providerConfig.highLevelTask')}</Label>
            </div>
            <p className="text-xs text-muted-foreground">{t('aiConfig.providerConfig.highLevelTaskDesc')}</p>
            <ConfigSelectDropdown
              items={allConfigsList}
              selectedName={highLevelConfig}
              onSelect={handleSetHighLevelConfig}
            />
            {!isHighLevelConfigValid && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t('aiConfig.taskConfig.notSelectedWarning')}
              </p>
            )}
          </div>
          <Separator className="bg-border/30" />
          {/* 低级任务 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">{t('aiConfig.providerConfig.lowLevelTask')}</Label>
            </div>
            <p className="text-xs text-muted-foreground">{t('aiConfig.providerConfig.lowLevelTaskDesc')}</p>
            <ConfigSelectDropdown
              items={allConfigsList}
              selectedName={lowLevelConfig}
              onSelect={handleSetLowLevelConfig}
            />
            {!isLowLevelConfigValid && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {t('aiConfig.taskConfig.notSelectedWarning')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderWebSearchSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Search className="w-5 h-5 text-primary" />
          {t('aiConfig.serviceProvider.webSearchService')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('aiConfig.searchImage.description')}</p>
      </div>

      <ChipGroup
        options={websearchProviderOptions.map(p => ({ value: p, label: p, icon: <Search className="w-3.5 h-3.5" /> }))}
        value={[websearchProvider]}
        onValueChange={(newValue) => updateConfigValue(aiConfig!.id, 'websearch_provider', newValue[0] || '')}
        selectMode="single"
        showRadioIndicator
      />
      {websearchProvider === 'Tavily' && tavilyConfig && (
        <div className="pt-3 border-t border-border/30">
          <DynamicConfigPanel config={tavilyConfig.config} configId={tavilyConfig.id} onChange={updateConfigValue} layout={[['api_key'], ['max_results', 'search_depth']]} />
        </div>
      )}
      {websearchProvider === 'Exa' && exaConfig && (
        <div className="pt-3 border-t border-border/30">
          <DynamicConfigPanel config={exaConfig.config} configId={exaConfig.id} onChange={updateConfigValue} layout={[['api_key'], ['max_results', 'search_type']]} />
        </div>
      )}
      {websearchProvider === 'MiniMax' && miniMaxConfig && (
        <div className="pt-3 border-t border-border/30">
          <DynamicConfigPanel config={miniMaxConfig.config} configId={miniMaxConfig.id} onChange={updateConfigValue} layout={[['api_key'], ['api_host', 'resource_mode']]} />
        </div>
      )}
      {websearchProvider === 'MCP' && (
        <div className="pt-3 border-t border-border/30 flex items-center justify-between gap-2">
          {websearchMcpToolId ? (
            <Badge variant="outline" className="text-xs font-mono">
              <Wrench className="h-3 w-3 mr-1" />
              {websearchMcpToolId}
            </Badge>
          ) : (
            <p className="text-xs text-muted-foreground">{t('aiConfig.mcpTool.noToolAssociated')}</p>
          )}
          <Button variant="ghost" size="sm" className="text-xs text-primary h-7 shrink-0" onClick={() => openMcpToolDialog('websearch')}>
            {websearchMcpToolId ? t('aiConfig.mcpTool.selectTool') : t('aiConfig.mcpTool.goAssociate')}
          </Button>
        </div>
      )}
    </div>
  );

  const renderImageUnderstandSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Eye className="w-5 h-5 text-primary" />
          {t('aiConfig.imageUnderstand.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{aiConfig?.config.image_understand_provider?.desc || t('aiConfig.imageUnderstand.providerDesc')}</p>
      </div>

      {taskModelLacksImage && !imageUnderstandProvider && (
        <div className={cn(
          "rounded-lg p-3 flex items-start gap-2",
          isGlass ? "border border-red-500/50 bg-red-500/10" : "border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
        )}>
          <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">{t('aiConfig.imageUnderstand.modelNoImageWarning')}</p>
        </div>
      )}
      <ChipGroup
        options={((aiConfig?.config.image_understand_provider?.options || ['MCP']) as string[]).map(p => ({ value: p, label: p, icon: <Eye className="w-3.5 h-3.5" /> }))}
        value={[aiConfig?.config.image_understand_provider?.value as string].filter(Boolean)}
        onValueChange={(newValue) => updateConfigValue(aiConfig!.id, 'image_understand_provider', newValue[0] || '')}
        selectMode="single"
        showRadioIndicator
      />
      {imageUnderstandProvider === 'MCP' && (
        <div className="pt-3 border-t border-border/30 flex items-center justify-between gap-2">
          {imageUnderstandMcpToolId ? (
            <Badge variant="outline" className="text-xs font-mono">
              <Wrench className="h-3 w-3 mr-1" />
              {imageUnderstandMcpToolId}
            </Badge>
          ) : (
            <p className="text-xs text-muted-foreground">{t('aiConfig.mcpTool.noToolAssociated')}</p>
          )}
          <Button variant="ghost" size="sm" className="text-xs text-primary h-7 shrink-0" onClick={() => openMcpToolDialog('image_understand')}>
            {imageUnderstandMcpToolId ? t('aiConfig.mcpTool.selectTool') : t('aiConfig.mcpTool.goAssociate')}
          </Button>
        </div>
      )}
    </div>
  );

  const renderVectorDbSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-primary" />
          {t('aiConfig.vectorDb.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('aiConfig.vectorDb.description')}</p>
      </div>

      {/* 切换警告（常驻） */}
      <div className={cn(
        "rounded-lg p-3 flex items-start gap-2",
        isGlass ? "border border-amber-500/40 bg-amber-500/10" : "border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40"
      )}>
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">{t('aiConfig.vectorDb.switchWarning')}</p>
      </div>

      {/* 1. Qdrant 部署方式 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">{t('aiConfig.vectorDb.qdrantProvider')}</Label>
        </div>
        <p className="text-xs text-muted-foreground">{aiConfig?.config.qdrant_provider?.desc || t('aiConfig.vectorDb.qdrantProviderDesc')}</p>
        <ChipGroup
          options={qdrantProviderOptions.map(p => ({ value: p, label: p === 'local' ? t('aiConfig.vectorDb.qdrantLocal') : p === 'remote' ? t('aiConfig.vectorDb.qdrantRemote') : p, icon: p === 'local' ? <Database className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" /> }))}
          value={[qdrantProvider].filter(Boolean)}
          onValueChange={(newValue) => updateConfigValue(aiConfig!.id, 'qdrant_provider', newValue[0] || '')}
          selectMode="single"
          showRadioIndicator
        />
        {qdrantProvider !== 'remote' && (
        <div className={cn(
          "rounded-lg p-3 flex items-start gap-2",
          isGlass ? "border border-blue-500/40 bg-blue-500/10" : "border border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-950/40"
        )}>
          <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5">
            <p>{t('aiConfig.vectorDb.qdrantRecommendTip')}</p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://github.com/qdrant/qdrant/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              >
                GitHub Releases
              </a>
              <span className="text-blue-400 dark:text-blue-600">·</span>
              <a
                href="https://cloud.qdrant.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
              >
                Qdrant Cloud
              </a>
            </div>
          </div>
        </div>
        )}
        {qdrantProvider === 'remote' && qdrantConfig && (
          <div className="pt-3 border-t border-border/30">
            <DynamicConfigPanel config={qdrantConfig.config} configId={qdrantConfig.id} onChange={updateConfigValue} layout={[['url'], ['api_key']]} />
          </div>
        )}
      </div>

      <Separator className="bg-border/30" />

      {/* 2. 嵌入模型提供方 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">{t('aiConfig.serviceProvider.embeddingService')}</Label>
        </div>
        <ChipGroup
          options={(embeddingSummary?.available_providers || embeddingProviderOptions).map(p => ({ value: p, label: p === 'local' ? t('aiConfig.serviceProvider.localModel') : p === 'openai' ? t('aiConfig.serviceProvider.openaiModel') : p, icon: p === 'local' ? <Database className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" /> }))}
          value={[embeddingProvider].filter(Boolean)}
          onValueChange={(newValue) => { const np = newValue[0] || ''; updateConfigValue(aiConfig!.id, 'embedding_provider', np); handleSwitchEmbeddingProvider(np); }}
          selectMode="single"
          showRadioIndicator
        />
        <div className="pt-3 border-t border-border/30">
          {renderEmbeddingFields()}
        </div>
      </div>

      <Separator className="bg-border/30" />

      {/* 3. 重排序模型 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">{t('aiConfig.serviceProvider.rerankService')}</Label>
          </div>
          <Switch checked={isRerankEnabled} onCheckedChange={(checked) => updateConfigValue(aiConfig!.id, 'enable_rerank', checked)} />
        </div>
        <div className={cn(
          "rounded-lg p-3 flex items-start gap-2",
          isGlass ? "border border-amber-500/40 bg-amber-500/10" : "border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40"
        )}>
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">{t('aiConfig.vectorDb.rerankWarning')}</p>
        </div>
        {isRerankEnabled && (
          <>
            <ChipGroup
              options={rerankProviderOptions.map(p => ({ value: p, label: p === 'local' ? t('aiConfig.serviceProvider.localModel') : p === 'openai' ? t('aiConfig.serviceProvider.openaiModel') : p, icon: p === 'local' ? <Database className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" /> }))}
              value={[rerankProvider].filter(Boolean)}
              onValueChange={(newValue) => updateConfigValue(aiConfig!.id, 'rerank_provider', newValue[0] || '')}
              selectMode="single"
              showRadioIndicator
            />
            {rerankConfig && (
              <div className="pt-3 border-t border-border/30">
                <DynamicConfigPanel
                  config={rerankConfig.config}
                  configId={rerankConfig.id}
                  onChange={updateConfigValue}
                  excludeKeys={rerankProvider === 'openai' ? [] : ['base_url', 'api_key']}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderVoiceRecognitionSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Cpu className="w-5 h-5 text-primary" />
          {t('aiConfig.voiceRecognition.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{aiConfig?.config.asr_provider?.desc || t('aiConfig.voiceRecognition.providerDesc')}</p>
      </div>
      <ChipGroup
        options={((aiConfig?.config.asr_provider?.options || ['MCP']) as string[]).map(p => ({ value: p, label: p, icon: <Cpu className="w-3.5 h-3.5" /> }))}
        value={[aiConfig?.config.asr_provider?.value as string].filter(Boolean)}
        onValueChange={(newValue) => updateConfigValue(aiConfig!.id, 'asr_provider', newValue[0] || '')}
        selectMode="single"
        showRadioIndicator
      />
    </div>
  );

  const renderDocumentExtractSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <FileText className="w-5 h-5 text-primary" />
          {t('aiConfig.documentExtract.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{aiConfig?.config.document_extract_provider?.desc || t('aiConfig.documentExtract.providerDesc')}</p>
      </div>
      <ChipGroup
        options={((aiConfig?.config.document_extract_provider?.options || ['MCP']) as string[]).map(p => ({ value: p, label: p, icon: <FileText className="w-3.5 h-3.5" /> }))}
        value={[aiConfig?.config.document_extract_provider?.value as string].filter(Boolean)}
        onValueChange={(newValue) => updateConfigValue(aiConfig!.id, 'document_extract_provider', newValue[0] || '')}
        selectMode="single"
        showRadioIndicator
      />
    </div>
  );

  const renderMemorySettingsSection = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
            <MemoryStick className="w-5 h-5 text-primary" />
            {t('aiConfig.memorySettings.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('aiConfig.memorySettings.description')}</p>
        </div>
        <Switch checked={isMemoryEnabled} onCheckedChange={(checked) => updateConfigValue(aiConfig!.id, 'enable_memory', checked)} />
      </div>

      {!isMemoryEnabled ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">
          <ChevronRight className="w-4 h-4" />
          <span>{t('aiConfig.memorySettings.disabledDesc')}</span>
        </div>
      ) : memoryConfig ? (
        <div className="space-y-4">
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
                    <TooltipContent side="top" className="max-w-xs"><p>{memoryConfig.config.memory_mode.desc}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <ChipGroup
              options={(memoryConfig.config.memory_mode?.options || ['被动感知', '主动会话']).map((p: string) => ({ value: p, label: p, icon: <Brain className="w-3.5 h-3.5" /> }))}
              value={(memoryConfig.config.memory_mode?.value as string[]) || []}
              onValueChange={(newValue) => updateConfigValue(memoryConfig.id, 'memory_mode', newValue)}
            />
          </div>

          <div className="pt-2">
            <DynamicConfigPanel
              config={memoryConfig.config}
              configId={memoryConfig.id}
              onChange={updateConfigValue}
              excludeKeys={['memory_mode', 'enable_system2', 'eval_mode']}
              layout={[['memory_session', 'retrieval_top_k']]}
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-border/20">
            <ToggleRow
              icon={<CheckCircle className="w-5 h-5" strokeWidth={1.5} />}
              iconColorClass="text-primary"
              title={t('aiConfig.memorySettings.enableSystem2')}
              description={t('aiConfig.memorySettings.enableSystem2Desc') || '提高检索精度但增加延迟'}
              checked={(memoryConfig.config.enable_system2?.value as boolean) ?? true}
              onCheckedChange={(checked) => updateConfigValue(memoryConfig.id, 'enable_system2', checked)}
            />
            <ToggleRow
              icon={<Sparkles className="w-5 h-5" strokeWidth={1.5} />}
              iconColorClass="text-primary"
              title={t('aiConfig.memorySettings.evalMode')}
              description={t('aiConfig.memorySettings.evalModeDesc') || '启用后无法使用 System-2 和 Rerank'}
              checked={(memoryConfig.config.eval_mode?.value as boolean) ?? false}
              onCheckedChange={(checked) => updateConfigValue(memoryConfig.id, 'eval_mode', checked)}
            />
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">{t('aiConfig.memorySettings.noConfig')}</div>
      )}
    </div>
  );

  const renderMemeSettingsSection = () => {
    if (!memeConfig) return null;
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Smile className="w-5 h-5 text-primary" />
              {t('aiConfig.memeSettings.title')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('aiConfig.memeSettings.description')}</p>
          </div>
          <Switch checked={(memeConfig.config.meme_enable?.value as boolean) ?? false} onCheckedChange={(checked) => updateConfigValue(memeConfig.id, 'meme_enable', checked)} />
        </div>

        {(memeConfig.config.meme_enable?.value as boolean) ? (
          <div className="space-y-4">
            <div className="p-3 rounded-lg border border-border/30 bg-muted/20">
              <ToggleRow
                icon={<Sparkles className="w-5 h-5" strokeWidth={1.5} />}
                iconColorClass="text-primary"
                title={t('aiConfig.memeSettings.autoCollect')}
                description={t('aiConfig.memeSettings.autoCollectDesc')}
                checked={(memeConfig.config.meme_auto_collect?.value as boolean) ?? false}
                onCheckedChange={(checked) => updateConfigValue(memeConfig.id, 'meme_auto_collect', checked)}
              />
            </div>
            <DynamicConfigPanel
              config={memeConfig.config}
              configId={memeConfig.id}
              onChange={updateConfigValue}
              excludeKeys={['meme_enable', 'meme_auto_collect']}
              layout={[
                ['meme_max_file_kb', 'meme_daily_collect_limit'],
                ['meme_min_width', 'meme_min_height'],
                ['meme_vlm_semaphore', 'meme_tag_interval_sec'],
                ['meme_nsfw_threshold', 'meme_send_cooldown_sec'],
                ['meme_recent_exclude_count'],
              ]}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">
            <ChevronRight className="w-4 h-4" />
            <span>{t('aiConfig.memeSettings.enableMemeDesc')}</span>
          </div>
        )}
      </div>
    );
  };

  const renderAdvancedSettingsSection = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
          {t('aiConfig.advancedSettings.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('aiConfig.advancedSettings.description')}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(() => {
          const excludeKeys = [
            'enable', 'enable_rerank', 'enable_memory',
            'websearch_provider', 'image_understand_provider',
            'embedding_provider', 'qdrant_provider', 'high_level_provider_config_name',
            'low_level_provider_config_name', 'asr_provider',
            'tts_provider', 'video_understand_provider',
            'document_extract_provider', 'rerank_provider'
          ];
          const entries = Object.entries(aiConfig!.config).filter(
            ([key]) => !excludeKeys.includes(key)
          );
          if (entries.length === 0) {
            return (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <p>{t('plugins.noConfigItems') || '暂无配置项'}</p>
              </div>
            );
          }
          return entries.map(([key, item]) => {
            let fieldDef = pluginConfigItemToFieldDef(key, item);
            if (key === 'multi_agent_lenth') {
              fieldDef = {
                ...fieldDef,
                label: t('aiConfig.advancedSettings.thinkingRounds') || '思考轮数',
                type: 'select' as ConfigFieldType,
                options: ['9', '12', '20', '30'],
                value: String(fieldDef.value || '12'),
              };
            }
            const isDivider = fieldDef.type === 'divider';
            return (
              <div key={key} className={isDivider ? 'col-span-full' : undefined}>
                <ConfigField
                  fieldKey={key}
                  field={fieldDef}
                  onChange={(fieldKey, value) => {
                    const finalValue = fieldKey === 'multi_agent_lenth' && typeof value === 'string'
                      ? parseInt(value)
                      : value;
                    updateConfigValue(aiConfig!.id, fieldKey, finalValue);
                  }}
                />
              </div>
            );
          });
        })()}
      </div>
    </div>
  );

  // ============================================================================
  // Main Render
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

  // Sidebar menu definition (serviceSwitch removed - now standalone at top)
  const sidebarItems = [
    { id: 'taskConfig', title: t('aiConfig.taskConfig.title'), icon: <ListChecks className="w-5 h-5" />, disabled: !isAIEnabled },
    { id: 'vectorDb', title: t('aiConfig.vectorDb.title'), icon: <Database className="w-5 h-5" />, disabled: !isAIEnabled },
    { id: 'webSearch', title: t('aiConfig.serviceProvider.webSearchService'), icon: <Search className="w-5 h-5" />, disabled: !isAIEnabled },
    { id: 'imageUnderstand', title: t('aiConfig.imageUnderstand.title'), icon: <Eye className="w-5 h-5" />, disabled: !isAIEnabled, alert: isAIEnabled && taskModelLacksImage && !imageUnderstandProvider },
    { id: 'voiceRecognition', title: t('aiConfig.voiceRecognition.title'), icon: <Cpu className="w-5 h-5" />, disabled: !isAIEnabled },
    { id: 'documentExtract', title: t('aiConfig.documentExtract.title'), icon: <FileText className="w-5 h-5" />, disabled: !isAIEnabled },
    { id: 'memorySettings', title: t('aiConfig.memorySettings.title'), icon: <MemoryStick className="w-5 h-5" />, disabled: !isAIEnabled },
    ...(memeConfig ? [{ id: 'memeSettings', title: t('aiConfig.memeSettings.title'), icon: <Smile className="w-5 h-5" />, disabled: !isAIEnabled }] : []),
    { id: 'advancedSettings', title: t('aiConfig.advancedSettings.title'), icon: <SlidersHorizontal className="w-5 h-5" />, disabled: !isAIEnabled },
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'taskConfig': return renderTaskConfigSection();
      case 'webSearch': return renderWebSearchSection();
      case 'imageUnderstand': return renderImageUnderstandSection();
      case 'vectorDb': return renderVectorDbSection();
      case 'voiceRecognition': return renderVoiceRecognitionSection();
      case 'documentExtract': return renderDocumentExtractSection();
      case 'memorySettings': return renderMemorySettingsSection();
      case 'memeSettings': return renderMemeSettingsSection();
      case 'advancedSettings': return renderAdvancedSettingsSection();
      default: return renderTaskConfigSection();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - matches PersonaConfigPage style */}
      <div className="shrink-0 px-3 sm:px-6 pt-3 sm:pt-6 pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <Bot className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
              {t('aiConfig.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1 text-xs sm:text-sm">{t('aiConfig.description')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
            <Button
              onClick={() => fetchWizardChecklist()}
              disabled={isWizardLoading}
              size="sm"
              variant="outline"
              className="gap-1.5 sm:gap-2 whitespace-nowrap text-xs sm:text-sm"
            >
              {isWizardLoading ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
              {t('aiConfig.checkConfig')}
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={!isConfigDirty || isSaving}
              size="sm"
              className={cn(
                "gap-1.5 sm:gap-2 whitespace-nowrap transition-all duration-300 text-xs sm:text-sm",
                isConfigDirty && "animate-in fade-in slide-in-from-bottom-2"
              )}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
              {t('aiConfig.saveButton')}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Service Master Switch - standalone above sidebar layout */}
      <div className="shrink-0 px-3 sm:px-6 pt-2 pb-3 sm:pb-4">
        <div className="flex items-center gap-3 sm:gap-5 p-3 sm:p-5 rounded-xl border-2 border-border/40 bg-card/50">
          <div className={cn(
            "flex items-center justify-center flex-shrink-0 transition-all duration-500",
            isAIEnabled ? "text-primary" : "text-muted-foreground"
          )}>
            <Brain className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-sm sm:text-base font-semibold">{t('aiConfig.serviceSwitch.title')}</span>
              <Badge
                variant={isAIEnabled ? "default" : "secondary"}
                className={cn(
                  "text-xs font-medium",
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
            onCheckedChange={(checked) => updateConfigValue(aiConfig!.id, 'enable', checked)}
            className="scale-110"
          />
        </div>
      </div>

      {/* Main Content Area - sidebar + content */}
      <div className="flex-1 flex overflow-hidden px-3 sm:px-6 gap-2 sm:gap-0">
        {/* Sidebar */}
        <div className={cn("border-r border-border/40 flex flex-col shrink-0", isMobile ? "w-14" : "w-60")}>
          <ScrollArea className="flex-1 px-1 pb-2 pt-2 sm:px-2">
            <div className="space-y-0.5">
              {sidebarItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  id={item.id}
                  activeSection={activeSection}
                  icon={item.icon}
                  title={item.title}
                  disabled={item.disabled}
                  alert={item.alert}
                  collapsed={isMobile}
                  onClick={setActiveSection}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Right Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-6">
            {isLoadingDetail && Object.keys(configs).length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              renderActiveSection()
            )}
          </div>
        </div>
      </div>

      {/* Manage Config Dialog */}
      <Dialog open={isManageConfigDialogOpen} onOpenChange={setIsManageConfigDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              {t('aiConfig.manageConfig')}
            </DialogTitle>
            <DialogDescription>{t('aiConfig.manageConfigDesc')}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end">
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

          <div className="space-y-2 py-2 max-h-[55vh] overflow-y-auto">
            {allConfigsList.length === 0 ? (
              <EmptyState
                icon={<Server className="w-8 h-8 text-muted-foreground/50" />}
                title={t('aiConfig.openaiConfig.noConfig')}
                description={t('aiConfig.taskConfig.emptyHint')}
              />
            ) : (
              allConfigsList.map((configItem) => {
                const usedByHigh = configItem.name === highLevelConfig;
                const usedByLow = configItem.name === lowLevelConfig;
                return (
                  <div
                    key={`manage-${configItem.name}`}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl border border-border/50 bg-card/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate block">{configItem.config_name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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
                          {usedByHigh && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{t('aiConfig.providerConfig.highLevel')}</Badge>}
                          {usedByLow && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{t('aiConfig.providerConfig.lowLevel')}</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => openEditDialog(configItem.config_name, configItem.provider)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(configItem.config_name, configItem.provider)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManageConfigDialogOpen(false)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                className={baseUrlHasTrailingSlash(newConfigBaseUrl) ? 'border-red-500 text-red-600 dark:text-red-400' : undefined}
              />
              {baseUrlHasTrailingSlash(newConfigBaseUrl) && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('aiConfig.openaiConfig.baseUrlTrailingSlashWarning')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('aiConfig.serviceProvider.apiKey')}</Label>
              <ConfigField fieldKey="api_key" field={{ type: 'tags', label: 'api_key', value: newConfigApiKeys, placeholder: '输入API密钥（支持多个）', description: '' }} showLabel={false} onChange={(k, v) => setNewConfigApiKeys(v as string[])} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {t('aiConfig.serviceProvider.apiModel')}
                {isFetchingNewConfigModels && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </Label>
              <InputWithDropdown
                value={newConfigModel}
                onChange={setNewConfigModel}
                options={mergeModelOptions(newConfigFetchedModels, providerConfigOptions?.options?.model_name || [])}
                placeholder={isFetchingNewConfigModels ? t('aiConfig.openaiConfig.fetchingModels') : '选择或输入模型名称'}
                inputPlaceholder="gpt-4o-mini"
              />
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
                  className={baseUrlHasTrailingSlash(openaiConfigData.base_url) ? 'border-red-500 text-red-600 dark:text-red-400' : undefined}
                />
                {baseUrlHasTrailingSlash(openaiConfigData.base_url) && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t('aiConfig.openaiConfig.baseUrlTrailingSlashWarning')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2"><Key className="w-4 h-4" />{t('aiConfig.serviceProvider.apiKey')}</Label>
                <ConfigField fieldKey="api_key" field={{ type: 'tags', label: 'api_key', value: openaiConfigData.api_key || [], placeholder: '输入API密钥（支持多个）', description: '' }} showLabel={false} onChange={(k, v) => updateOpenaiConfigField('api_key', v as string[])} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4" />{t('aiConfig.serviceProvider.apiModel')}
                  {isFetchingEditConfigModels && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </Label>
                <InputWithDropdown
                  value={openaiConfigData.model_name}
                  onChange={(val) => updateOpenaiConfigField('model_name', val)}
                  options={mergeModelOptions(editConfigFetchedModels, providerConfigOptions?.options?.model_name || [])}
                  placeholder={isFetchingEditConfigModels ? t('aiConfig.openaiConfig.fetchingModels') : '选择或输入模型名称'}
                  inputPlaceholder="输入或选择模型名称"
                />
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

      {/* MCP Tool Selection Dialog */}
      <Dialog open={mcpToolDialogOpen} onOpenChange={setMcpToolDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[70vh] glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              {t('aiConfig.mcpTool.selectTool')}
            </DialogTitle>
            <DialogDescription>
              {mcpToolDialogType === 'websearch'
                ? t('aiConfig.mcpTool.webSearchMcpTool')
                : t('aiConfig.mcpTool.imageUnderstandMcpTool')
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
            {mcpConfigs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Server className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">{t('aiConfig.mcpTool.noMcpConfigs')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t('aiConfig.mcpTool.noMcpConfigsDesc')}</p>
              </div>
            ) : mcpToolOptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Wrench className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">{t('aiConfig.mcpTool.noToolAssociated')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t('aiConfig.mcpTool.noToolAssociatedDesc')}</p>
              </div>
            ) : (
              mcpToolOptions.map((option) => {
                const currentToolId = mcpToolDialogType === 'websearch' ? websearchMcpToolId : imageUnderstandMcpToolId;
                const isSelected = currentToolId === option.value;
                return (
                  <div
                    key={option.value}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary/5 border-primary/30"
                        : "border-border/50 hover:bg-muted/50"
                    )}
                    onClick={() => handleSelectMcpTool(option.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wrench className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-sm font-medium truncate">{option.label}</span>
                      </div>
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMcpToolDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Wizard Configuration Status Dialog */}
      <Dialog open={isWizardDialogOpen} onOpenChange={setIsWizardDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t('aiConfig.wizard.title')}
            </DialogTitle>
            <DialogDescription>
              {t('aiConfig.wizard.description')}
            </DialogDescription>
          </DialogHeader>

          {isWizardLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overall Status Banner */}
              <div className={cn(
                "p-4 rounded-lg border flex items-center gap-3",
                wizardOverallStatus === 'overall_ok' && "bg-green-500/10 border-green-500/20",
                wizardOverallStatus === 'overall_warning' && "bg-yellow-500/10 border-yellow-500/20",
                wizardOverallStatus === 'overall_error' && "bg-red-500/10 border-red-500/20"
              )}>
                {wizardOverallStatus === 'overall_ok' && <CheckCircle className="w-6 h-6 text-green-500" />}
                {wizardOverallStatus === 'overall_warning' && <AlertTriangle className="w-6 h-6 text-yellow-500" />}
                {wizardOverallStatus === 'overall_error' && <AlertTriangle className="w-6 h-6 text-red-500" />}
                <div>
                  <p className="font-medium">
                    {wizardUsable
                      ? t('aiConfig.wizard.aiUsable')
                      : t('aiConfig.wizard.aiNotUsable')
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('aiConfig.wizard.summary', {
                      total: wizardSummary.total,
                      ok: wizardSummary.ok,
                      warning: wizardSummary.warning
                    })}
                  </p>
                </div>
              </div>

              {/* Persona List Section */}
              {wizardStatus?.persona && (
                <div className="p-3 rounded-lg border bg-muted/30 border-border/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('aiConfig.wizard.personaList') || '人格配置'}</span>
                    <span className="text-xs text-muted-foreground">({wizardStatus.persona.note})</span>
                  </div>
                  {/* AI Enable Range Info - Only show when not mode=all */}
                  {wizardStatus?.ai_enable_range && wizardStatus.ai_enable_range.mode !== 'all' && (
                    <div className="mb-2 p-2 rounded bg-muted/50 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">{wizardStatus.ai_enable_range.mode === 'white_list' ? t('aiConfig.wizard.whitelistNote') || '白名单' : t('aiConfig.wizard.blacklistNote') || '黑名单'}:</span>
                        <Badge variant="default" className="text-[10px]">{wizardStatus.ai_enable_range.mode}</Badge>
                      </div>
                      <div className="ml-5 space-y-0.5">
                        {wizardStatus.ai_enable_range.mode === 'white_list' && wizardStatus.ai_enable_range.white_list.map((userId, idx) => (
                          <p key={idx} className="text-muted-foreground/70">✓ {userId}</p>
                        ))}
                        {wizardStatus.ai_enable_range.mode === 'black_list' && wizardStatus.ai_enable_range.black_list.map((userId, idx) => (
                          <p key={idx} className="text-muted-foreground/70">✗ {userId}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className={cn(
                    "grid gap-3",
                    wizardStatus.persona.personas.length > 1 ? "grid-cols-2" : "grid-cols-1"
                  )}>
                    {wizardStatus.persona.personas.map((persona, idx) => (
                      <div key={idx} className={cn(
                        "p-3 rounded-lg border text-xs",
                        persona.is_enabled ? "bg-green-500/5 border-green-500/10" : "bg-muted border-muted"
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="relative w-8 h-8 flex-shrink-0">
                            <PersonaAvatar name={persona.name} isEnabled={persona.is_enabled} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {persona.is_enabled ? (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              ) : (
                                <Ban className="w-3 h-3 text-muted-foreground" />
                              )}
                              <span className="font-medium">{persona.name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge variant="default" className="text-[10px]">
                            {persona.scope === 'global' && t('aiConfig.wizard.scopeGlobal')}
                            {persona.scope === 'specific' && t('aiConfig.wizard.scopeSpecific')}
                            {persona.scope === 'disabled' && t('aiConfig.wizard.scopeDisabled')}
                          </Badge>
                          {persona.has_inspect && (
                            <Badge variant="secondary" className="text-[10px]">
                              {t('aiConfig.wizard.inspect') || '巡检'}({persona.inspect_interval})
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground text-[11px]">{persona.scope_desc}</p>
                        {persona.scope === 'specific' && persona.target_groups.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {persona.target_groups.map((group, gIdx) => (
                              <p key={gIdx} className="text-muted-foreground/70 text-[10px] ml-1">├ {group}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist Items */}
              <div className="grid grid-cols-2 gap-3">
                {wizardChecklist.filter(item => item.id !== 'ai_enable' && item.id !== 'ai_range' && item.id !== 'persona').map((item) => (
                  <TooltipProvider key={item.id} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "p-3 rounded-lg border flex items-start gap-3 cursor-help",
                            item.status === 'ok' && "bg-green-500/5 border-green-500/10",
                            item.status === 'warning' && "bg-yellow-500/5 border-yellow-500/10",
                            item.status === 'error' && "bg-red-500/5 border-red-500/10"
                          )}
                        >
                          {item.status === 'ok' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
                          {item.status === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />}
                          {item.status === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{item.message}</p>
                          </div>
                        </div>
                      </TooltipTrigger>
                      {item.id === 'memory' && item.status === 'warning' && (
                        <TooltipContent side="top" className="max-w-xs">
                          <p>{t('aiConfig.wizard.memoryWarningTip') || '全部群聊模式会处理所有群聊的记忆，可能占用较多 Token'}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWizardDialogOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedding Save Warning Dialog */}
      <AlertDialog open={isEmbeddingWarningOpen} onOpenChange={setIsEmbeddingWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('aiConfig.serviceProvider.embeddingSaveWarningTitle') || '修改嵌入模型配置警告'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiConfig.serviceProvider.embeddingSaveWarningDesc') || '修改嵌入模型服务配置将导致大部分嵌入数据重构。建议先备份 data/ai_core 文件夹后再执行，配置保存后需要重启服务才能生效。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsEmbeddingWarningOpen(false)}>
              {t('common.cancel') || '取消'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEmbeddingSave}>
              {t('common.confirm') || '确认保存'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
