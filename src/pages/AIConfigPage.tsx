/**
 * AIConfigPage - 顶层路由组件
 *
 * 该文件是整个 AI 配置页面的状态枢纽：
 * - 维护所有 useState / useMemo / useCallback
 * - 集中调用 frameworkConfigApi / providerConfigApi / mcpConfigApi / embeddingConfigApi / aiWizardApi
 * - 计算 isConfigDirty / taskModelLacksImage 等派生值
 * - 把数据与回调通过 props 注入到 ./AIConfig 下各个纯渲染 section / dialog
 *
 * 详见 ./AIConfig/README.md 中的"状态 / 事件流向"图。
 */
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAIStatus } from '@/contexts/AIStatusContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  Bot,
  Brain,
  Cpu,
  Database,
  Eye,
  FileText,
  ListChecks,
  Loader2,
  MemoryStick,
  Save,
  Search,
  SlidersHorizontal,
  Smile,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  frameworkConfigApi,
  providerConfigApi,
  embeddingConfigApi,
  mcpConfigApi,
  aiWizardApi,
  type PluginConfigItem,
  type FrameworkConfigListItem,
  type OpenAIConfigData,
  type ProviderInfo,
  type AllConfigsSummary,
  type AllConfigItem,
  type ProviderConfigOptions,
  type EmbeddingConfigSummary,
  type EmbeddingConfigField,
  type MCPToolsConfigItem,
  type MCPConfig,
  type AIWizardChecklistItem,
  type AIWizardStatusResponse,
} from '@/lib/api';
import {
  ConfigField,
  type ConfigValue,
  type ConfigFieldType,
  ConfigSelectDropdown,
  DynamicConfigPanel,
  pluginConfigItemToFieldDef,
  MCP_SERVICE_TOOLS_CONFIG_KEY_MAP,
  type McpServiceType,
} from '@/components/config';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { EmptyState } from './AIConfig/shared/EmptyState';
import { SidebarItem } from './AIConfig/shared/SidebarItem';
import {
  ServiceSwitchSection,
  TaskConfigSection,
  WebSearchSection,
  ImageUnderstandSection,
  VectorDbSection,
  VoiceRecognitionSection,
  DocumentExtractSection,
  MemorySettingsSection,
  MemeSettingsSection,
  AdvancedSettingsSection,
  ManageConfigDialog,
  CreateConfigDialog,
  EditConfigDialog,
  DeleteConfigDialog,
  McpToolDialog,
  EmbeddingWarningDialog,
  AIServiceSwitchDialog,
  WizardDialog,
  type McpToolInfo,
  type EmbeddingConfigField as EmbeddingConfigFieldUI,
} from './AIConfig';
import type { LocalFrameworkConfig } from './AIConfig/types';

const baseUrlHasTrailingSlash = (baseUrl: string) => baseUrl.trim().endsWith('/');

const getFirstApiKey = (apiKeys: string[]) =>
  apiKeys.find((key) => key.trim())?.trim() || '';

export default function AIConfigPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  // ====================== Active section ======================
  const [activeSection, setActiveSection] = useState<string>('taskConfig');

  // ====================== Framework Config (AI基础配置) ======================
  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<Record<string, LocalFrameworkConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ====================== Provider Config ======================
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('openai');
  const [allConfigs, setAllConfigs] = useState<AllConfigsSummary | null>(null);
  const [highLevelConfig, setHighLevelConfig] = useState<string>('');
  const [lowLevelConfig, setLowLevelConfig] = useState<string>('');
  const [modelSupportMap, setModelSupportMap] = useState<Record<string, string[]>>({});

  // ====================== OpenAI Config ======================
  const [openaiConfigData, setOpenaiConfigData] = useState<OpenAIConfigData | null>(null);
  const [isLoadingOpenaiConfig, setIsLoadingOpenaiConfig] = useState(false);
  const [isSavingOpenaiConfig, setIsSavingOpenaiConfig] = useState(false);

  // ====================== Provider Config Options ======================
  const [providerConfigOptions, setProviderConfigOptions] = useState<ProviderConfigOptions | null>(null);

  // ====================== Embedding Config ======================
  const [embeddingSummary, setEmbeddingSummary] = useState<EmbeddingConfigSummary | null>(null);
  const [isLoadingEmbeddingConfig, setIsLoadingEmbeddingConfig] = useState(false);
  const [embeddingLocalConfig, setEmbeddingLocalConfig] = useState<Record<string, EmbeddingConfigFieldUI>>({});
  const [embeddingOpenaiConfig, setEmbeddingOpenaiConfig] = useState<Record<string, EmbeddingConfigFieldUI>>({});
  const [originalEmbeddingProvider, setOriginalEmbeddingProvider] = useState<string>('');
  const [originalEmbeddingLocalConfig, setOriginalEmbeddingLocalConfig] = useState<Record<string, EmbeddingConfigFieldUI>>({});
  const [originalEmbeddingOpenaiConfig, setOriginalEmbeddingOpenaiConfig] = useState<Record<string, EmbeddingConfigFieldUI>>({});

  // ====================== MCP tools details (脏检查) ======================
  const [originalMcpToolsConfigs, setOriginalMcpToolsConfigs] = useState<Record<string, MCPToolsConfigItem>>({});
  const [originalMcpDetails, setOriginalMcpDetails] = useState<Record<string, Record<string, string | number | boolean | null>>>({});

  // ====================== Dialog states ======================
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageConfigDialogOpen, setIsManageConfigDialogOpen] = useState(false);
  const [isEmbeddingWarningOpen, setIsEmbeddingWarningOpen] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<(() => void) | null>(null);
  const [newConfigName, setNewConfigName] = useState('');
  const [editingConfigName, setEditingConfigName] = useState('');
  const [editingConfigProvider, setEditingConfigProvider] = useState('openai');

  // ====================== New config form state ======================
  const [newConfigProvider, setNewConfigProvider] = useState('openai');
  const [newConfigBaseUrl, setNewConfigBaseUrl] = useState('');
  const [newConfigModel, setNewConfigModel] = useState('');
  const [newConfigApiKeys, setNewConfigApiKeys] = useState<string[]>([]);
  const [newConfigEmbeddingModel] = useState('text-embedding-3-small');
  const [newConfigModelSupport, setNewConfigModelSupport] = useState<string[]>(['text']);
  const [newConfigFetchedModels, setNewConfigFetchedModels] = useState<string[]>([]);
  const [editConfigFetchedModels, setEditConfigFetchedModels] = useState<string[]>([]);
  const [isFetchingNewConfigModels, setIsFetchingNewConfigModels] = useState(false);
  const [isFetchingEditConfigModels, setIsFetchingEditConfigModels] = useState(false);

  // ====================== Track original state ======================
  const [originalConfig, setOriginalConfig] = useState<Record<string, any>>({});
  const [hasInitialized, setHasInitialized] = useState(false);

  // ====================== MCP Configs ======================
  const [mcpConfigs, setMcpConfigs] = useState<MCPConfig[]>([]);
  const [mcpToolDialogOpen, setMcpToolDialogOpen] = useState(false);
  const [mcpToolDialogType, setMcpToolDialogType] = useState<McpServiceType>('websearch');

  // ====================== MCP Tools Config ======================
  const [mcpToolsConfigs, setMcpToolsConfigs] = useState<Record<string, MCPToolsConfigItem>>({});
  const [mcpDetailsEditing, setMcpDetailsEditing] = useState<Record<string, Record<string, string | number | boolean | null>>>({});

  // ====================== AI Wizard ======================
  // AI 服务总开关刚刚被切换，需要重启核心服务才能使检查配置生效
  const [isPendingRestart, setIsPendingRestart] = useState(false);
  // 后端还未重启（/api/ai/wizard/status 返回 404）
  const [isBackendPendingRestart, setIsBackendPendingRestart] = useState(false);
  const [isWizardDialogOpen, setIsWizardDialogOpen] = useState(false);

  // 启动时检测后端 AI 服务是否已就绪（/api/ai/wizard/status 是否存在）
  useEffect(() => {
    let cancelled = false;
    const checkBackendStatus = async () => {
      try {
        const res = await fetch('/api/ai/wizard/status', { credentials: 'include' });
        if (cancelled) return;
        // 404 意味着后端还未加载 AI 核心，需要重启
        setIsBackendPendingRestart(res.status === 404);
      } catch {
        if (!cancelled) setIsBackendPendingRestart(false);
      }
    };
    checkBackendStatus();
    return () => {
      cancelled = true;
    };
  }, []);
  const [wizardChecklist, setWizardChecklist] = useState<AIWizardChecklistItem[]>([]);
  const [wizardOverallStatus, setWizardOverallStatus] = useState<'overall_ok' | 'overall_warning' | 'overall_error'>('overall_ok');
  const [wizardUsable, setWizardUsable] = useState(false);
  const [wizardSummary, setWizardSummary] = useState({ total: 0, ok: 0, warning: 0, error: 0 });
  const [isWizardLoading, setIsWizardLoading] = useState(false);
  const [wizardStatus, setWizardStatus] = useState<AIWizardStatusResponse | null>(null);

  // ====================== AI Service Switch Dialog ======================
  const [isAISwitchDialogOpen, setIsAISwitchDialogOpen] = useState(false);
  const [pendingAISwitchValue, setPendingAISwitchValue] = useState<boolean>(false);
  const [isHelpOnly, setIsHelpOnly] = useState(false);

  // ============================================================================
  // Data Fetching helpers
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

  const fetchProviderModels = useCallback(
    async (
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
    },
    [],
  );

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

  const normalizeConfigName = useCallback(
    (name: string, configs: AllConfigItem[]): string => {
      if (!name) return '';
      if (name.includes('++')) return name;
      const match = configs.find((c) => c.config_name === name);
      if (match) return match.name;
      return `openai++${name}`;
    },
    [],
  );

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
      const localCfg = (summary.local_config || {}) as Record<string, EmbeddingConfigFieldUI>;
      const openaiCfg = (summary.openai_config || {}) as Record<string, EmbeddingConfigFieldUI>;
      setEmbeddingLocalConfig(localCfg);
      setEmbeddingOpenaiConfig(openaiCfg);
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
      const filteredData = data.filter(
        (config) => !config.name.toLowerCase().includes('人设'),
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
      setConfigs((prev) => ({
        ...prev,
        [data.id]: {
          id: data.id,
          name: data.name,
          full_name: data.full_name,
          config: data.config as Record<string, PluginConfigItem>,
        },
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
    try {
      const toolsConfigData = await mcpConfigApi.getToolsConfigList();
      const configMap: Record<string, MCPToolsConfigItem> = {};
      for (const item of toolsConfigData.items) {
        configMap[item.key] = item;
      }
      setMcpToolsConfigs(configMap);
      const detailsMap: Record<string, Record<string, string | number | boolean | null>> = {};
      for (const item of toolsConfigData.items) {
        detailsMap[item.key] = { ...item.details };
      }
      setMcpDetailsEditing(detailsMap);
      setOriginalMcpToolsConfigs(JSON.parse(JSON.stringify(configMap)));
      setOriginalMcpDetails(JSON.parse(JSON.stringify(detailsMap)));
    } catch (error) {
      console.error('Failed to fetch MCP tools config:', error);
    }
  }, []);

  useEffect(() => {
    fetchConfigList();
    fetchProviderList();
    fetchAllConfigs();
    fetchEmbeddingConfig();
    fetchMcpConfigs();
  }, [fetchConfigList, fetchProviderList, fetchAllConfigs, fetchEmbeddingConfig, fetchMcpConfigs]);

  const fetchedConfigNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (configList.length > 0) {
      configList.forEach((config) => {
        if (!configs[config.id] && !fetchedConfigNamesRef.current.has(config.full_name)) {
          fetchedConfigNamesRef.current.add(config.full_name);
          fetchConfigDetail(config.full_name);
        }
      });
    }
  }, [configList, configs, fetchConfigDetail]);

  useEffect(() => {
    if (
      configList.length > 0 &&
      Object.keys(configs).length >= configList.length &&
      !hasInitialized
    ) {
      setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      setHasInitialized(true);
    }
  }, [configs, configList, hasInitialized]);

  // 拉取所选高/低级任务配置的 model_support（用于图片理解能力警告）
  useEffect(() => {
    const list = allConfigs?.configs || [];
    const targets = [highLevelConfig, lowLevelConfig].filter(Boolean);
    targets.forEach((fullName) => {
      if (modelSupportMap[fullName] !== undefined) return;
      const item = list.find((c) => c.name === fullName);
      if (!item) return;
      providerConfigApi
        .getConfigDetail(item.provider, item.config_name)
        .then((detail) => {
          const support = (detail.config?.model_support?.data as string[]) || ['text'];
          setModelSupportMap((prev) => ({ ...prev, [fullName]: support }));
        })
        .catch((error) => {
          console.error('Failed to fetch model_support:', error);
        });
    });
  }, [highLevelConfig, lowLevelConfig, allConfigs, modelSupportMap]);

  // 实时拉取 CreateConfigDialog 中的 model 列表
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

  // ============================================================================
  // Actions
  // ============================================================================

  const handleSetHighLevelConfig = useCallback(
    async (configFullName: string) => {
      try {
        await providerConfigApi.setHighLevelConfig(configFullName);
        setHighLevelConfig(configFullName);
        toast.success(t('aiConfig.providerConfig.setHighLevelSuccess', { name: configFullName }));
        await fetchAllConfigs();
        setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      } catch (error) {
        console.error('Failed to set high level config:', error);
        toast.error(t('aiConfig.providerConfig.setFailed'));
      }
    },
    [t, fetchAllConfigs, configs],
  );

  const handleSetLowLevelConfig = useCallback(
    async (configFullName: string) => {
      try {
        await providerConfigApi.setLowLevelConfig(configFullName);
        setLowLevelConfig(configFullName);
        toast.success(t('aiConfig.providerConfig.setLowLevelSuccess', { name: configFullName }));
        await fetchAllConfigs();
        setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      } catch (error) {
        console.error('Failed to set low level config:', error);
        toast.error(t('aiConfig.providerConfig.setFailed'));
      }
    },
    [t, fetchAllConfigs, configs],
  );

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
    if (newConfigApiKeys.length === 0 || newConfigApiKeys.every((k) => !k.trim())) {
      toast.error(t('aiConfig.openaiConfig.apiKeyRequired'));
      return;
    }
    try {
      const configName = newConfigName.trim();
      const configData: Record<string, { data: unknown }> = {
        base_url: { data: newConfigBaseUrl.trim() },
        api_key: { data: newConfigApiKeys.filter((k) => k.trim()) },
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
  }, [
    newConfigName,
    newConfigBaseUrl,
    newConfigModel,
    newConfigApiKeys,
    newConfigEmbeddingModel,
    newConfigModelSupport,
    newConfigProvider,
    t,
    fetchAllConfigs,
  ]);

  const handleDeleteConfig = useCallback(async () => {
    if (!editingConfigName || !editingConfigProvider) return;
    const fullConfigName = `${editingConfigProvider}++${editingConfigName}`;
    const configsList = allConfigs?.configs || [];
    try {
      const isUsedByHigh = highLevelConfig === fullConfigName;
      const isUsedByLow = lowLevelConfig === fullConfigName;

      if (isUsedByHigh || isUsedByLow) {
        const otherConfig = configsList.find((c) => c.name !== fullConfigName);
        if (otherConfig) {
          if (isUsedByHigh) {
            await providerConfigApi.setHighLevelConfig(otherConfig.name);
          }
          if (isUsedByLow) {
            await providerConfigApi.setLowLevelConfig(otherConfig.name);
          }
        } else {
          if (isUsedByHigh) {
            await providerConfigApi.clearTaskConfig('high');
          }
          if (isUsedByLow) {
            await providerConfigApi.clearTaskConfig('low');
          }
        }
      }

      await providerConfigApi.deleteConfig(editingConfigProvider, editingConfigName);
      toast.success(t('aiConfig.openaiConfig.deleteSuccess', { name: editingConfigName }));
      setIsDeleteDialogOpen(false);
      setEditingConfigName('');
      setHighLevelConfig((prev) => (prev === fullConfigName ? '' : prev));
      setLowLevelConfig((prev) => (prev === fullConfigName ? '' : prev));
      await fetchAllConfigs();
    } catch (error) {
      console.error('Failed to delete config:', error);
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg
          ? `${t('aiConfig.openaiConfig.deleteFailed')}: ${errorMsg}`
          : t('aiConfig.openaiConfig.deleteFailed'),
      );
    }
  }, [
    editingConfigName,
    editingConfigProvider,
    t,
    fetchAllConfigs,
    highLevelConfig,
    lowLevelConfig,
    allConfigs,
  ]);

  const resetNewConfigForm = () => {
    setNewConfigProvider('openai');
    setNewConfigName('');
    setNewConfigBaseUrl('');
    setNewConfigModel('');
    setNewConfigApiKeys([]);
    setNewConfigModelSupport(['text']);
    setNewConfigFetchedModels([]);
  };

  const updateOpenaiConfigField = useCallback(
    (field: keyof OpenAIConfigData, value: string | string[]) => {
      setOpenaiConfigData((prev) => (prev ? { ...prev, [field]: value } : null));
    },
    [],
  );

  const handleSwitchEmbeddingProvider = useCallback((provider: string) => {
    setEmbeddingSummary((prev) => (prev ? { ...prev, provider } : null));
  }, []);

  const updateEmbeddingLocalField = useCallback(
    (fieldKey: string, value: unknown) => {
      setEmbeddingLocalConfig((prev) => ({
        ...prev,
        [fieldKey]: { ...prev[fieldKey], data: value },
      }));
    },
    [],
  );

  const updateEmbeddingOpenaiField = useCallback(
    (fieldKey: string, value: unknown) => {
      setEmbeddingOpenaiConfig((prev) => ({
        ...prev,
        [fieldKey]: { ...prev[fieldKey], data: value },
      }));
    },
    [],
  );

  const openDeleteDialog = (configName: string, provider: string) => {
    setEditingConfigName(configName);
    setEditingConfigProvider(provider);
    setIsDeleteDialogOpen(true);
  };

  const openEditDialog = (configName: string, provider: string) => {
    setEditingConfigName(configName);
    setEditingConfigProvider(provider);
    fetchConfigDetailForEdit(provider, configName);
    fetchProviderConfigOptions(provider);
    setIsEditDialogOpen(true);
  };

  // ============================================================================
  // AI Service Switch Dialog
  // ============================================================================
  // Framework Config Helpers
  // ============================================================================

  const aiConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) => c.name.includes('AI配置') || c.full_name.includes('AI配置'),
      ),
    [configs],
  );

  const embeddingConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) =>
          c.name.includes('嵌入模型配置') || c.full_name.includes('嵌入模型配置'),
      ),
    [configs],
  );

  const rerankConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) =>
          c.name.includes('Rerank模型配置') || c.full_name.includes('Rerank模型配置'),
      ),
    [configs],
  );

  const tavilyConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) => c.name.includes('Tavily搜索配置') || c.full_name.includes('Tavily搜索配置'),
      ),
    [configs],
  );

  const exaConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) => c.name.includes('Exa搜索配置') || c.full_name.includes('Exa搜索配置'),
      ),
    [configs],
  );

  const miniMaxConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) => c.name.includes('MiniMax搜索配置') || c.full_name.includes('MiniMax搜索配置'),
      ),
    [configs],
  );

  const memoryConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) => c.name.includes('记忆配置') || c.full_name.includes('记忆配置'),
      ),
    [configs],
  );

  const memeConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) => c.name.includes('表情包配置') || c.full_name.includes('表情包配置'),
      ),
    [configs],
  );

  const mcpToolsConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) => c.name.includes('MCP 工具配置') || c.full_name.includes('MCP 工具配置'),
      ),
    [configs],
  );

  const qdrantConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) => c.name.includes('Qdrant') || c.full_name.includes('Qdrant'),
      ),
    [configs],
  );

  const isAIEnabled = (aiConfig?.config.enable?.value as boolean) ?? false;

  // 同步 AI 启用状态到全局 context，供 AppSidebar 消费
  const { setAIEnabled: setGlobalAIEnabled } = useAIStatus();
  useEffect(() => {
    setGlobalAIEnabled(isAIEnabled);
  }, [isAIEnabled, setGlobalAIEnabled]);
  const isRerankEnabled = (aiConfig?.config.enable_rerank?.value as boolean) ?? false;
  const rerankProvider = (aiConfig?.config.rerank_provider?.value as string) ?? 'local';
  const isMemoryEnabled = (aiConfig?.config.enable_memory?.value as boolean) ?? false;
  const websearchProvider =
    (aiConfig?.config.websearch_provider?.value as string) ?? 'Tavily';
  const imageUnderstandProvider =
    (aiConfig?.config.image_understand_provider?.value as string) ?? '';
  const qdrantProvider = (aiConfig?.config.qdrant_provider?.value as string) ?? 'local';
  const embeddingProvider =
    (embeddingSummary?.provider ||
      (aiConfig?.config.embedding_provider?.value as string)) ??
    'local';
  const asrProvider = (aiConfig?.config.asr_provider?.value as string) ?? '';
  const documentExtractProvider =
    (aiConfig?.config.document_extract_provider?.value as string) ?? '';

  // Build MCP tool options from MCP configs (with rich metadata)
  const mcpToolOptions: McpToolInfo[] = useMemo(() => {
    const options: McpToolInfo[] = [];
    for (const config of mcpConfigs) {
      for (const tool of config.tools) {
        options.push({
          value: `${config.config_id} - ${tool.name}`,
          label: `${config.name} / ${tool.name}`,
          description: tool.description || '',
          serverName: config.name,
          toolName: tool.name,
        });
      }
    }
    return options;
  }, [mcpConfigs]);

  const websearchMcpToolId =
    (mcpToolsConfig?.config.websearch_mcp_tool_id?.value as string) || '';
  const imageUnderstandMcpToolId =
    (mcpToolsConfig?.config.image_understand_mcp_tool_id?.value as string) || '';
  const asrMcpToolId =
    (mcpToolsConfig?.config.asr_mcp_tool_id?.value as string) || '';
  const documentExtractMcpToolId =
    (mcpToolsConfig?.config.document_extract_mcp_tool_id?.value as string) || '';

  const getMcpToolIdByType = useCallback(
    (type: McpServiceType): string => {
      const configKey = MCP_SERVICE_TOOLS_CONFIG_KEY_MAP[type];
      return (mcpToolsConfig?.config[configKey]?.value as string) || '';
    },
    [mcpToolsConfig],
  );

  const currentDialogMcpToolId = useMemo(
    () => getMcpToolIdByType(mcpToolDialogType),
    [getMcpToolIdByType, mcpToolDialogType],
  );

  const selectedMcpToolInfo = useMemo(
    () =>
      currentDialogMcpToolId
        ? mcpToolOptions.find((opt) => opt.value === currentDialogMcpToolId) || null
        : null,
    [currentDialogMcpToolId, mcpToolOptions],
  );

  const imageUnderstandToolInfo = useMemo(
    () =>
      imageUnderstandMcpToolId
        ? mcpToolOptions.find((opt) => opt.value === imageUnderstandMcpToolId) || null
        : null,
    [imageUnderstandMcpToolId, mcpToolOptions],
  );

  const websearchToolInfo = useMemo(
    () =>
      websearchMcpToolId
        ? mcpToolOptions.find((opt) => opt.value === websearchMcpToolId) || null
        : null,
    [websearchMcpToolId, mcpToolOptions],
  );

  const asrToolInfo = useMemo(
    () =>
      asrMcpToolId
        ? mcpToolOptions.find((opt) => opt.value === asrMcpToolId) || null
        : null,
    [asrMcpToolId, mcpToolOptions],
  );

  const documentExtractToolInfo = useMemo(
    () =>
      documentExtractMcpToolId
        ? mcpToolOptions.find((opt) => opt.value === documentExtractMcpToolId) || null
        : null,
    [documentExtractMcpToolId, mcpToolOptions],
  );

  const openMcpToolDialog = useCallback((type: McpServiceType) => {
    setMcpToolDialogType(type);
    setMcpToolDialogOpen(true);
  }, []);

  const isConfigDirty = useMemo(() => {
    const configChanged =
      Object.keys(originalConfig).length > 0 &&
      JSON.stringify(configs) !== JSON.stringify(originalConfig);
    const embeddingProviderChanged =
      embeddingSummary?.provider !== originalEmbeddingProvider;
    const embeddingLocalChanged =
      JSON.stringify(embeddingLocalConfig) !== JSON.stringify(originalEmbeddingLocalConfig);
    const embeddingOpenaiChanged =
      JSON.stringify(embeddingOpenaiConfig) !== JSON.stringify(originalEmbeddingOpenaiConfig);
    const mcpToolsChanged =
      JSON.stringify(mcpToolsConfigs) !== JSON.stringify(originalMcpToolsConfigs) ||
      JSON.stringify(mcpDetailsEditing) !== JSON.stringify(originalMcpDetails);
    return (
      configChanged ||
      embeddingProviderChanged ||
      embeddingLocalChanged ||
      embeddingOpenaiChanged ||
      mcpToolsChanged
    );
  }, [
    configs,
    originalConfig,
    embeddingSummary,
    originalEmbeddingProvider,
    embeddingLocalConfig,
    originalEmbeddingLocalConfig,
    embeddingOpenaiConfig,
    originalEmbeddingOpenaiConfig,
    mcpToolsConfigs,
    originalMcpToolsConfigs,
    mcpDetailsEditing,
    originalMcpDetails,
  ]);

  const updateConfigValue = useCallback(
    (configId: string, fieldKey: string, value: ConfigValue) => {
      setConfigs((prev) => {
        if (!prev[configId]) return prev;
        return {
          ...prev,
          [configId]: {
            ...prev[configId],
            config: {
              ...prev[configId].config,
              [fieldKey]: { ...prev[configId].config[fieldKey], value },
            },
          },
        };
      });
    },
    [],
  );

  // ============================================================================

  /**
   * 处理 AI 服务总开关的切换。
   * 当开关状态改变时，显示确认对话框而不是直接更新。
   */
  const handleAISwitchChange = useCallback((checked: boolean) => {
    setPendingAISwitchValue(checked);
    setIsHelpOnly(false);
    setIsAISwitchDialogOpen(true);
  }, []);

  /**
   * 确认 AI 服务开关的切换，实际更新配置。
   */
  const handleConfirmAISwitch = useCallback(() => {
    setIsAISwitchDialogOpen(false);
    if (aiConfig) {
      updateConfigValue(aiConfig.id, 'enable', pendingAISwitchValue);
      // 同步侧边栏 AI 状态
      setGlobalAIEnabled(pendingAISwitchValue);
      // 标记需要重启核心服务后才能执行检查配置
      setIsPendingRestart(true);
    }
  }, [aiConfig, pendingAISwitchValue, updateConfigValue, setGlobalAIEnabled]);

  /**
   * 打开使用帮助（重新显示 AI 服务开关确认对话框）
   */
  const handleOpenHelp = useCallback(() => {
    if (isAIEnabled) {
      setPendingAISwitchValue(true);
      setIsHelpOnly(true);
      setIsAISwitchDialogOpen(true);
    }
  }, [isAIEnabled]);

  // ============================================================================

  const getMcpToolParams = useCallback(
    (toolId: string): string[] => {
      if (!toolId) return [];
      const parts = toolId.split(' - ');
      if (parts.length < 2) return [];
      const [, ...toolNameParts] = parts;
      const toolName = toolNameParts.join(' - ');
      const configId = parts[0];
      const config = mcpConfigs.find((c) => c.config_id === configId);
      if (!config) return [];
      const tool = config.tools.find((t) => t.name === toolName);
      if (!tool || !tool.parameters) return [];
      return Object.keys(tool.parameters);
    },
    [mcpConfigs],
  );

  const handleSelectMcpTool = useCallback(
    (toolId: string) => {
      if (!mcpToolsConfig) return;
      const configKey = MCP_SERVICE_TOOLS_CONFIG_KEY_MAP[mcpToolDialogType];
      const mcpToolsConfigKey = configKey;
      const currentToolId = (mcpToolsConfig.config[configKey]?.value as string) || '';
      const finalValue = currentToolId === toolId ? '' : toolId;

      updateConfigValue(mcpToolsConfig.id, configKey, finalValue);

      if (finalValue) {
        const paramNames = getMcpToolParams(finalValue);
        const autoDetails: Record<string, string> = {};
        for (const paramName of paramNames) {
          autoDetails[paramName] = `params - ${paramName}`;
        }
        setMcpToolsConfigs((prev) => ({
          ...prev,
          [mcpToolsConfigKey]: {
            ...prev[mcpToolsConfigKey],
            key: mcpToolsConfigKey,
            data: finalValue,
            details: autoDetails,
          } as MCPToolsConfigItem,
        }));
        setMcpDetailsEditing((prev) => ({
          ...prev,
          [mcpToolsConfigKey]: { ...autoDetails },
        }));
      } else {
        setMcpToolsConfigs((prev) => ({
          ...prev,
          [mcpToolsConfigKey]: {
            ...prev[mcpToolsConfigKey],
            key: mcpToolsConfigKey,
            data: '',
            details: {},
          } as MCPToolsConfigItem,
        }));
        setMcpDetailsEditing((prev) => ({
          ...prev,
          [mcpToolsConfigKey]: {},
        }));
      }

      setMcpToolDialogOpen(false);
    },
    [mcpToolsConfig, mcpToolDialogType, updateConfigValue, getMcpToolParams],
  );

  const handleClearMcpTool = useCallback(
    (type: McpServiceType) => {
      if (!mcpToolsConfig) return;
      const configKey = MCP_SERVICE_TOOLS_CONFIG_KEY_MAP[type];
      updateConfigValue(mcpToolsConfig.id, configKey, '');

      setMcpToolsConfigs((prev) => ({
        ...prev,
        [configKey]: {
          ...prev[configKey],
          key: configKey,
          data: '',
          details: {},
        } as MCPToolsConfigItem,
      }));
      setMcpDetailsEditing((prev) => ({
        ...prev,
        [configKey]: {},
      }));
    },
    [mcpToolsConfig, updateConfigValue],
  );

  const updateMcpDetailValue = useCallback(
    (configKey: string, mcpParamName: string, value: string | number | boolean | null) => {
      setMcpDetailsEditing((prev) => ({
        ...prev,
        [configKey]: {
          ...prev[configKey],
          [mcpParamName]: value,
        },
      }));
    },
    [],
  );

  const renameMcpDetailKey = useCallback(
    (configKey: string, oldName: string, newName: string) => {
      setMcpDetailsEditing((prev) => {
        const details = { ...prev[configKey] };
        const val = details[oldName];
        delete details[oldName];
        details[newName] = val;
        return { ...prev, [configKey]: details };
      });
    },
    [],
  );

  const addMcpDetailRow = useCallback((configKey: string) => {
    setMcpDetailsEditing((prev) => ({
      ...prev,
      [configKey]: {
        ...prev[configKey],
        '': 'params - ',
      },
    }));
  }, []);

  const removeMcpDetailRow = useCallback(
    (configKey: string, mcpParamName: string) => {
      setMcpDetailsEditing((prev) => {
        const newDetails = { ...prev[configKey] };
        delete newDetails[mcpParamName];
        return {
          ...prev,
          [configKey]: newDetails,
        };
      });
    },
    [],
  );

  // 实际执行保存逻辑
  const executeSave = async () => {
    try {
      setIsSaving(true);

      // 1. 保存框架配置（仅变化的部分）
      const changedConfigs = Object.values(configs).filter((config) => {
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

          if (rawType === 'gsint') {
            if (typeof value === 'string') value = parseInt(value, 10);
          } else if (rawType === 'gsfloat') {
            if (typeof value === 'string') value = parseFloat(value);
          } else if (rawType === 'gsbool') {
            if (typeof value === 'string') value = value === 'true';
            else value = !!value;
          } else if (rawType === 'gsdict') {
            if (typeof value === 'string') {
              try {
                value = JSON.parse(value);
              } catch {
                /* keep as string */
              }
            }
          } else if (rawType === 'gslist') {
            if (Array.isArray(value))
              value = value.map(Number).filter((n: number) => !isNaN(n));
          } else if (rawType === 'gsliststr') {
            if (Array.isArray(value)) value = value.map(String);
          } else if (rawType === 'gsdivider') {
            return;
          }

          configToSave[key] = value;
        });
        await frameworkConfigApi.updateFrameworkConfig(config.full_name, configToSave);
      }
      if (changedConfigs.length > 0) {
        setOriginalConfig(JSON.parse(JSON.stringify(configs)));
      }

      // 2. 保存嵌入模型配置
      const currentProviderValue = embeddingSummary?.provider || '';
      if (currentProviderValue !== originalEmbeddingProvider) {
        const response = await embeddingConfigApi.setProvider(currentProviderValue);
        toast.success(
          response.msg ||
            t('aiConfig.serviceProvider.embeddingProviderSwitched', {
              provider: currentProviderValue,
            }),
        );
        setOriginalEmbeddingProvider(currentProviderValue);
      }
      if (JSON.stringify(embeddingLocalConfig) !== JSON.stringify(originalEmbeddingLocalConfig)) {
        const localPayload: Record<string, unknown> = {};
        Object.entries(embeddingLocalConfig).forEach(([key, field]) => {
          localPayload[key] = field.data;
        });
        await embeddingConfigApi.saveLocalConfig(localPayload);
        setOriginalEmbeddingLocalConfig(JSON.parse(JSON.stringify(embeddingLocalConfig)));
      }
      if (JSON.stringify(embeddingOpenaiConfig) !== JSON.stringify(originalEmbeddingOpenaiConfig)) {
        const openaiPayload: Record<string, unknown> = {};
        Object.entries(embeddingOpenaiConfig).forEach(([key, field]) => {
          openaiPayload[key] = field.data;
        });
        await embeddingConfigApi.saveOpenaiConfig(openaiPayload);
        setOriginalEmbeddingOpenaiConfig(JSON.parse(JSON.stringify(embeddingOpenaiConfig)));
      }

      // 3. 保存 MCP 工具参数映射配置
      const mcpToolsChanged =
        JSON.stringify(mcpToolsConfigs) !== JSON.stringify(originalMcpToolsConfigs) ||
        JSON.stringify(mcpDetailsEditing) !== JSON.stringify(originalMcpDetails);
      if (mcpToolsChanged) {
        const allKeys = new Set([
          ...Object.keys(mcpToolsConfigs),
          ...Object.keys(originalMcpToolsConfigs),
        ]);
        for (const key of allKeys) {
          const currentData = mcpToolsConfigs[key]?.data ?? '';
          const currentDetails = mcpDetailsEditing[key] ?? {};
          const origData = originalMcpToolsConfigs[key]?.data ?? '';
          const origDetails = originalMcpDetails[key] ?? {};
          if (
            currentData !== origData ||
            JSON.stringify(currentDetails) !== JSON.stringify(origDetails)
          ) {
            await mcpConfigApi.updateToolsConfig(key, {
              data: currentData,
              details: currentDetails,
            });
          }
        }
        setOriginalMcpToolsConfigs(JSON.parse(JSON.stringify(mcpToolsConfigs)));
        setOriginalMcpDetails(JSON.parse(JSON.stringify(mcpDetailsEditing)));
      }

      toast.success(t('aiConfig.configSaved'));
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('aiConfig.saveFailed'));
    } finally {
      setIsSaving(false);
      setPendingSaveAction(null);
    }
  };

  const handleSaveConfig = () => {
    const currentProviderValue = embeddingSummary?.provider || '';
    const hasEmbeddingChanges =
      currentProviderValue !== originalEmbeddingProvider ||
      JSON.stringify(embeddingLocalConfig) !== JSON.stringify(originalEmbeddingLocalConfig) ||
      JSON.stringify(embeddingOpenaiConfig) !== JSON.stringify(originalEmbeddingOpenaiConfig);

    const aiConfigId = aiConfig?.id;
    const originalQdrant = aiConfigId
      ? (originalConfig[aiConfigId]?.config?.qdrant_provider?.value)
      : undefined;
    const currentQdrant = aiConfig?.config.qdrant_provider?.value;
    const hasQdrantChange =
      originalQdrant !== undefined && currentQdrant !== originalQdrant;

    if (hasEmbeddingChanges || hasQdrantChange) {
      setPendingSaveAction(() => executeSave);
      setIsEmbeddingWarningOpen(true);
    } else {
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

  const embeddingProviderOptions =
    (aiConfig?.config.embedding_provider?.options || ['local']) as string[];
  const rerankProviderOptions =
    (aiConfig?.config.rerank_provider?.options || ['local']) as string[];
  const websearchProviderOptions =
    (aiConfig?.config.websearch_provider?.options || ['Tavily']) as string[];
  const qdrantProviderOptions =
    (aiConfig?.config.qdrant_provider?.options || ['local', 'remote']) as string[];
  const imageUnderstandProviderOptions =
    (aiConfig?.config.image_understand_provider?.options || ['MCP']) as string[];
  const asrProviderOptions =
    (aiConfig?.config.asr_provider?.options || ['MCP']) as string[];
  const documentExtractProviderOptions =
    (aiConfig?.config.document_extract_provider?.options || ['MCP']) as string[];

  const allConfigsList = useMemo<AllConfigItem[]>(
    () => (allConfigs ? allConfigs.configs || [] : []),
    [allConfigs],
  );

  const isHighLevelConfigValid = useMemo(
    () => !!highLevelConfig && allConfigsList.some((c) => c.name === highLevelConfig),
    [highLevelConfig, allConfigsList],
  );

  const isLowLevelConfigValid = useMemo(
    () => !!lowLevelConfig && allConfigsList.some((c) => c.name === lowLevelConfig),
    [lowLevelConfig, allConfigsList],
  );

  const taskModelLacksImage = useMemo(() => {
    const lacks = (fullName: string) => {
      if (!fullName) return false;
      const support = modelSupportMap[fullName];
      if (!support) return false;
      return !support.includes('image');
    };
    return lacks(highLevelConfig) || lacks(lowLevelConfig);
  }, [highLevelConfig, lowLevelConfig, modelSupportMap]);

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

  // ====================== 侧边栏菜单项 ======================
  const sidebarItems = [
    { id: 'taskConfig', title: t('aiConfig.taskConfig.title'), icon: <ListChecks className="w-5 h-5" /> },
    { id: 'vectorDb', title: t('aiConfig.vectorDb.title'), icon: <Database className="w-5 h-5" /> },
    { id: 'webSearch', title: t('aiConfig.serviceProvider.webSearchService'), icon: <Search className="w-5 h-5" /> },
    { id: 'imageUnderstand', title: t('aiConfig.imageUnderstand.title'), icon: <Eye className="w-5 h-5" />, alert: taskModelLacksImage && !imageUnderstandProvider },
    { id: 'voiceRecognition', title: t('aiConfig.voiceRecognition.title'), icon: <Cpu className="w-5 h-5" /> },
    { id: 'documentExtract', title: t('aiConfig.documentExtract.title'), icon: <FileText className="w-5 h-5" /> },
    { id: 'memorySettings', title: t('aiConfig.memorySettings.title'), icon: <MemoryStick className="w-5 h-5" /> },
    ...(memeConfig ? [{ id: 'memeSettings', title: t('aiConfig.memeSettings.title'), icon: <Smile className="w-5 h-5" /> }] : []),
    { id: 'advancedSettings', title: t('aiConfig.advancedSettings.title'), icon: <SlidersHorizontal className="w-5 h-5" /> },
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'taskConfig':
        return (
          <TaskConfigSection
            t={t}
            isGlass={isGlass}
            allConfigsList={allConfigsList}
            highLevelConfig={highLevelConfig}
            lowLevelConfig={lowLevelConfig}
            isHighLevelConfigValid={isHighLevelConfigValid}
            isLowLevelConfigValid={isLowLevelConfigValid}
            onSetHighLevelConfig={handleSetHighLevelConfig}
            onSetLowLevelConfig={handleSetLowLevelConfig}
            onOpenManageDialog={() => setIsManageConfigDialogOpen(true)}
          />
        );
      case 'webSearch':
        return (
          <WebSearchSection
            t={t}
            aiConfigId={aiConfig.id}
            websearchProvider={websearchProvider}
            websearchProviderOptions={websearchProviderOptions}
            tavilyConfig={tavilyConfig}
            exaConfig={exaConfig}
            miniMaxConfig={miniMaxConfig}
            websearchMcpToolId={websearchMcpToolId}
            websearchToolInfo={websearchToolInfo}
            mcpDetails={mcpDetailsEditing['websearch_mcp_tool_id'] || {}}
            onChangeProvider={(v) => updateConfigValue(aiConfig.id, 'websearch_provider', v)}
            onUpdateConfig={updateConfigValue}
            onOpenMcpToolDialog={() => openMcpToolDialog('websearch')}
            onClearMcpTool={() => handleClearMcpTool('websearch')}
            onDetailValueChange={(name, val) => updateMcpDetailValue('websearch_mcp_tool_id', name, val)}
            onMcpParamNameChange={(oldN, newN) => renameMcpDetailKey('websearch_mcp_tool_id', oldN, newN)}
            onAddMcpDetailRow={() => addMcpDetailRow('websearch_mcp_tool_id')}
            onRemoveMcpDetailRow={(name) => removeMcpDetailRow('websearch_mcp_tool_id', name)}
          />
        );
      case 'imageUnderstand':
        return (
          <ImageUnderstandSection
            t={t}
            isGlass={isGlass}
            imageUnderstandProvider={imageUnderstandProvider}
            imageUnderstandProviderOptions={imageUnderstandProviderOptions}
            taskModelLacksImage={taskModelLacksImage}
            providerDesc={aiConfig?.config.image_understand_provider?.desc}
            imageUnderstandMcpToolId={imageUnderstandMcpToolId}
            imageUnderstandToolInfo={imageUnderstandToolInfo}
            mcpDetails={mcpDetailsEditing['image_understand_mcp_tool_id'] || {}}
            onChangeProvider={(v) => updateConfigValue(aiConfig.id, 'image_understand_provider', v)}
            onOpenMcpToolDialog={() => openMcpToolDialog('image_understand')}
            onClearMcpTool={() => handleClearMcpTool('image_understand')}
            onDetailValueChange={(name, val) => updateMcpDetailValue('image_understand_mcp_tool_id', name, val)}
            onMcpParamNameChange={(oldN, newN) => renameMcpDetailKey('image_understand_mcp_tool_id', oldN, newN)}
            onAddMcpDetailRow={() => addMcpDetailRow('image_understand_mcp_tool_id')}
            onRemoveMcpDetailRow={(name) => removeMcpDetailRow('image_understand_mcp_tool_id', name)}
          />
        );
      case 'vectorDb':
        return (
          <VectorDbSection
            t={t}
            isGlass={isGlass}
            aiConfigId={aiConfig.id}
            qdrantProvider={qdrantProvider}
            qdrantProviderOptions={qdrantProviderOptions}
            qdrantProviderDesc={aiConfig?.config.qdrant_provider?.desc}
            qdrantConfig={qdrantConfig}
            embeddingProvider={embeddingProvider}
            embeddingProviderOptions={embeddingProviderOptions}
            availableProviders={embeddingSummary?.available_providers}
            isLoadingEmbeddingConfig={isLoadingEmbeddingConfig}
            embeddingLocalConfig={embeddingLocalConfig}
            embeddingOpenaiConfig={embeddingOpenaiConfig}
            isRerankEnabled={isRerankEnabled}
            rerankProvider={rerankProvider}
            rerankProviderOptions={rerankProviderOptions}
            rerankConfig={rerankConfig}
            onUpdateConfig={updateConfigValue}
            onSwitchEmbeddingProvider={handleSwitchEmbeddingProvider}
            onUpdateEmbeddingLocalField={updateEmbeddingLocalField}
            onUpdateEmbeddingOpenaiField={updateEmbeddingOpenaiField}
          />
        );
      case 'voiceRecognition':
        return (
          <VoiceRecognitionSection
            t={t}
            aiConfigId={aiConfig.id}
            asrProvider={asrProvider}
            asrProviderOptions={asrProviderOptions}
            asrProviderDesc={aiConfig?.config.asr_provider?.desc}
            asrMcpToolId={asrMcpToolId}
            asrToolInfo={asrToolInfo}
            mcpDetails={mcpDetailsEditing['asr_mcp_tool_id'] || {}}
            onChangeProvider={(v) => updateConfigValue(aiConfig.id, 'asr_provider', v)}
            onOpenMcpToolDialog={() => openMcpToolDialog('asr')}
            onClearMcpTool={() => handleClearMcpTool('asr')}
            onDetailValueChange={(name, val) => updateMcpDetailValue('asr_mcp_tool_id', name, val)}
            onMcpParamNameChange={(oldN, newN) => renameMcpDetailKey('asr_mcp_tool_id', oldN, newN)}
            onAddMcpDetailRow={() => addMcpDetailRow('asr_mcp_tool_id')}
            onRemoveMcpDetailRow={(name) => removeMcpDetailRow('asr_mcp_tool_id', name)}
          />
        );
      case 'documentExtract':
        return (
          <DocumentExtractSection
            t={t}
            aiConfigId={aiConfig.id}
            documentExtractProvider={documentExtractProvider}
            documentExtractProviderOptions={documentExtractProviderOptions}
            documentExtractProviderDesc={aiConfig?.config.document_extract_provider?.desc}
            documentExtractMcpToolId={documentExtractMcpToolId}
            documentExtractToolInfo={documentExtractToolInfo}
            mcpDetails={mcpDetailsEditing['document_extract_mcp_tool_id'] || {}}
            onChangeProvider={(v) => updateConfigValue(aiConfig.id, 'document_extract_provider', v)}
            onOpenMcpToolDialog={() => openMcpToolDialog('document_extract')}
            onClearMcpTool={() => handleClearMcpTool('document_extract')}
            onDetailValueChange={(name, val) => updateMcpDetailValue('document_extract_mcp_tool_id', name, val)}
            onMcpParamNameChange={(oldN, newN) => renameMcpDetailKey('document_extract_mcp_tool_id', oldN, newN)}
            onAddMcpDetailRow={() => addMcpDetailRow('document_extract_mcp_tool_id')}
            onRemoveMcpDetailRow={(name) => removeMcpDetailRow('document_extract_mcp_tool_id', name)}
          />
        );
      case 'memorySettings':
        return (
          <MemorySettingsSection
            t={t}
            aiConfigId={aiConfig.id}
            isMemoryEnabled={isMemoryEnabled}
            memoryConfig={memoryConfig}
            onUpdateConfig={updateConfigValue}
            onToggleMemory={(checked) => updateConfigValue(aiConfig.id, 'enable_memory', checked)}
          />
        );
      case 'memeSettings':
        return (
          <MemeSettingsSection
            t={t}
            memeConfig={memeConfig}
            onUpdateConfig={updateConfigValue}
          />
        );
      case 'advancedSettings':
        return (
          <AdvancedSettingsSection
            t={t}
            aiConfig={aiConfig}
            onUpdateConfig={updateConfigValue}
          />
        );
      case 'aiHistory':
        // AI 历史调用页面（外部路由 /ai-history，此处返回 null 作为占位）
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-3 sm:px-6 pt-3 sm:pt-6 pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-xl sm:text-3xl font-bold flex items-center gap-2 sm:gap-3">
              <Bot className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" />
              {t('aiConfig.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1 text-xs sm:text-sm">
              {t('aiConfig.description')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
            {isAIEnabled && (
              <Button
                onClick={handleOpenHelp}
                size="sm"
                variant="outline"
                className="gap-1.5 sm:gap-2 whitespace-nowrap text-xs sm:text-sm"
              >
                <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {t('aiConfig.serviceSwitch.usageHelp')}
              </Button>
            )}
            {(() => {
              const checkConfigBtn = (
                <Button
                  onClick={() => fetchWizardChecklist()}
                  disabled={isWizardLoading || isPendingRestart}
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
              );
              // 只有按钮被禁用时才显示提示 tooltip
              if (isPendingRestart) {
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="inline-flex">
                        {checkConfigBtn}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {t('aiConfig.serviceSwitch.checkConfigPendingRestart')}
                    </TooltipContent>
                  </Tooltip>
                );
              }
              return checkConfigBtn;
            })()}
            <Button
              onClick={handleSaveConfig}
              disabled={!isConfigDirty || isSaving}
              size="sm"
              className={cn(
                'gap-1.5 sm:gap-2 whitespace-nowrap transition-all duration-300 text-xs sm:text-sm',
                isConfigDirty && 'animate-in fade-in slide-in-from-bottom-2',
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

      {/* AI Service Master Switch */}
      <div className="shrink-0 px-3 sm:px-6 pt-2 pb-3 sm:pb-4">
        {isBackendPendingRestart && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-medium">{t('aiConfig.serviceSwitch.restartRequiredTitle')}</p>
              <p className="mt-1 opacity-90">{t('aiConfig.serviceSwitch.restartRequiredDesc')}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 sm:gap-5 p-3 sm:p-5 rounded-2xl border border-border/30 bg-card/30">
          <div
            className={cn(
              'flex items-center justify-center flex-shrink-0 transition-all duration-500',
              isAIEnabled ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Brain className="w-6 h-6 sm:w-8 sm:h-8" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-sm sm:text-base font-semibold">
                {t('aiConfig.serviceSwitch.title')}
              </span>
              <Badge
                variant={isAIEnabled ? 'default' : 'secondary'}
                className={cn(
                  'text-xs font-medium',
                  isAIEnabled &&
                    'bg-primary/15 text-primary hover:bg-primary/20 border-primary/20',
                )}
              >
                {isAIEnabled ? t('common.enabled') : t('common.disabled')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isAIEnabled
                ? t('aiConfig.serviceSwitch.enabledDesc')
                : t('aiConfig.serviceSwitch.disabledDesc')}
            </p>
          </div>
          <Switch
            checked={isAIEnabled}
            onCheckedChange={handleAISwitchChange}
            className="scale-110"
          />
        </div>
      </div>

      {/* Main Content Area - sidebar + content */}
      <div className="flex-1 flex overflow-hidden px-3 sm:px-6 gap-2 sm:gap-0">
        <div
          className={cn(
            'border-r border-border/40 flex flex-col shrink-0',
            isMobile ? 'w-14' : 'w-60',
          )}
        >
          <ScrollArea className="flex-1 px-1 pb-2 pt-2 sm:px-2">
            <div className="space-y-0.5">
              {sidebarItems.map((item) => (
                <SidebarItem
                  key={item.id}
                  id={item.id}
                  activeSection={activeSection}
                  icon={item.icon}
                  title={item.title}
                  disabled={false}
                  alert={'alert' in item ? item.alert : false}
                  collapsed={isMobile}
                  onClick={setActiveSection}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

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

      {/* ====================== Dialogs ====================== */}

      <ManageConfigDialog
        open={isManageConfigDialogOpen}
        t={t}
        allConfigsList={allConfigsList}
        highLevelConfig={highLevelConfig}
        lowLevelConfig={lowLevelConfig}
        onOpenChange={setIsManageConfigDialogOpen}
        onOpenCreate={() => {
          setIsCreateDialogOpen(true);
          fetchProviderConfigOptions(newConfigProvider);
        }}
        onOpenEdit={openEditDialog}
        onOpenDelete={openDeleteDialog}
      />

      <CreateConfigDialog
        open={isCreateDialogOpen}
        t={t}
        provider={newConfigProvider}
        configName={newConfigName}
        baseUrl={newConfigBaseUrl}
        apiKeys={newConfigApiKeys}
        model={newConfigModel}
        embeddingModel={newConfigEmbeddingModel}
        modelSupport={newConfigModelSupport}
        fetchedModels={newConfigFetchedModels}
        isFetching={isFetchingNewConfigModels}
        providerConfigOptions={providerConfigOptions}
        baseUrlHasTrailingSlash={baseUrlHasTrailingSlash}
        onOpenChange={setIsCreateDialogOpen}
        onChangeProvider={setNewConfigProvider}
        onFetchProviderConfigOptions={fetchProviderConfigOptions}
        onChangeConfigName={setNewConfigName}
        onChangeBaseUrl={setNewConfigBaseUrl}
        onChangeApiKeys={setNewConfigApiKeys}
        onChangeModel={setNewConfigModel}
        onChangeEmbeddingModel={() => {}}
        onToggleCapability={(cap) => {
          setNewConfigModelSupport((prev) =>
            prev.includes(cap) ? prev.filter((v) => v !== cap) : [...prev, cap],
          );
        }}
        onReset={resetNewConfigForm}
        onSubmit={handleCreateOpenaiConfig}
      />

      <EditConfigDialog
        open={isEditDialogOpen}
        t={t}
        configName={editingConfigName}
        data={openaiConfigData}
        isLoading={isLoadingOpenaiConfig}
        isSaving={isSavingOpenaiConfig}
        providerConfigOptions={providerConfigOptions}
        fetchedModels={editConfigFetchedModels}
        isFetching={isFetchingEditConfigModels}
        baseUrlHasTrailingSlash={baseUrlHasTrailingSlash}
        onOpenChange={setIsEditDialogOpen}
        onChangeField={updateOpenaiConfigField}
        onToggleCapability={(cap) => {
          setOpenaiConfigData((prev) => {
            if (!prev) return prev;
            const current = Array.isArray(prev.model_support)
              ? prev.model_support
              : ['text'];
            const next = current.includes(cap)
              ? current.filter((v) => v !== cap)
              : [...current, cap];
            return { ...prev, model_support: next };
          });
        }}
        onSave={handleSaveOpenaiConfig}
      />

      <DeleteConfigDialog
        open={isDeleteDialogOpen}
        t={t}
        configName={editingConfigName}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfig}
      />

      <McpToolDialog
        open={mcpToolDialogOpen}
        t={t}
        serviceType={mcpToolDialogType}
        mcpConfigs={mcpConfigs}
        mcpToolOptions={mcpToolOptions}
        currentDialogMcpToolId={currentDialogMcpToolId}
        selectedMcpToolInfo={selectedMcpToolInfo}
        onOpenChange={setMcpToolDialogOpen}
        onSelect={handleSelectMcpTool}
        onClear={() => handleClearMcpTool(mcpToolDialogType)}
      />

      <EmbeddingWarningDialog
        open={isEmbeddingWarningOpen}
        t={t}
        onOpenChange={setIsEmbeddingWarningOpen}
        onConfirm={handleConfirmEmbeddingSave}
      />

      <AIServiceSwitchDialog
        open={isAISwitchDialogOpen}
        mode={pendingAISwitchValue ? 'enable' : 'disable'}
        t={t}
        onOpenChange={setIsAISwitchDialogOpen}
        onConfirm={handleConfirmAISwitch}
        helpOnly={isHelpOnly}
      />

      <WizardDialog
        open={isWizardDialogOpen}
        t={t}
        isLoading={isWizardLoading}
        overallStatus={wizardOverallStatus}
        usable={wizardUsable}
        summary={wizardSummary}
        checklist={wizardChecklist}
        status={wizardStatus}
        onOpenChange={setIsWizardDialogOpen}
      />
    </div>
  );
}
