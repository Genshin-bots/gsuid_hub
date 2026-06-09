/**
 * useProviderConfig
 *
 * 负责「Provider / OpenAI 配置」相关的状态与副作用：
 * - providers / currentProvider：providerConfigApi.getProviders
 * - allConfigs / highLevelConfig / lowLevelConfig / modelSupportMap
 * - openaiConfigData（编辑态）：单个 OpenAI 兼容格式配置
 * - providerConfigOptions：当前 provider 的可选项
 * - 新建 / 编辑表单状态
 * - 4 个 Dialog 的 open 标志 + 触发函数
 * - 5 个 useCallback 异步动作：
 *   - handleSetHighLevelConfig / handleSetLowLevelConfig
 *   - handleCreateOpenaiConfig / handleSaveOpenaiConfig / handleDeleteConfig
 *
 * 由 [`src/pages/AIConfigPage.tsx`](src/pages/AIConfigPage.tsx) 调用。
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  providerConfigApi,
  type AllConfigsSummary,
  type AllConfigItem,
  type OpenAIConfigData,
  type ProviderConfigOptions,
  type ProviderInfo,
} from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export interface UseProviderConfigReturn {
  // --- 拉取数据 ---
  providers: ProviderInfo[];
  currentProvider: string;
  allConfigs: AllConfigsSummary | null;
  highLevelConfig: string;
  lowLevelConfig: string;
  modelSupportMap: Record<string, string[]>;

  // --- 编辑单个 OpenAI config ---
  openaiConfigData: OpenAIConfigData | null;
  isLoadingOpenaiConfig: boolean;
  isSavingOpenaiConfig: boolean;
  providerConfigOptions: ProviderConfigOptions | null;

  // --- 新建表单 ---
  newConfigProvider: string;
  newConfigName: string;
  newConfigBaseUrl: string;
  newConfigModel: string;
  newConfigApiKeys: string[];
  newConfigEmbeddingModel: string;
  newConfigModelSupport: string[];
  newConfigFetchedModels: string[];
  isFetchingNewConfigModels: boolean;

  // --- 编辑表单 ---
  editingConfigName: string;
  editingConfigProvider: string;
  editConfigFetchedModels: string[];
  isFetchingEditConfigModels: boolean;

  // --- Dialog 状态 ---
  isCreateDialogOpen: boolean;
  isEditDialogOpen: boolean;
  isDeleteDialogOpen: boolean;
  isManageConfigDialogOpen: boolean;

  // --- Setters（用于 CreateConfigDialog / EditConfigDialog 的受控表单） ---
  setNewConfigProvider: (v: string) => void;
  setNewConfigName: (v: string) => void;
  setNewConfigBaseUrl: (v: string) => void;
  setNewConfigModel: (v: string) => void;
  setNewConfigApiKeys: (v: string[]) => void;
  toggleNewConfigCapability: (cap: string) => void;
  resetNewConfigForm: () => void;
  setIsCreateDialogOpen: (open: boolean) => void;
  setIsEditDialogOpen: (open: boolean) => void;
  setIsDeleteDialogOpen: (open: boolean) => void;
  setIsManageConfigDialogOpen: (open: boolean) => void;
  clearOpenaiConfigData: () => void;

  /** 直接更新 openaiConfigData 某个字段（受 EditConfigDialog 表单约束） */
  setOpenaiConfigDataField: (
    field: keyof OpenAIConfigData,
    value: string | string[],
  ) => void;
  /** 切换 model_support 中的某项能力 */
  toggleOpenaiConfigCapability: (cap: string) => void;

  // --- 异步动作 ---
  fetchProviderConfigOptions: (provider: string) => Promise<void>;
  fetchProviderModels: (
    provider: string,
    baseUrl: string,
    apiKeys: string[],
    onSuccess: (models: string[]) => void,
    setLoading: (loading: boolean) => void,
  ) => Promise<void>;
  fetchConfigDetailForEdit: (provider: string, configName: string) => Promise<void>;
  refreshAllConfigs: () => Promise<void>;
  handleSetHighLevelConfig: (configFullName: string) => Promise<void>;
  handleSetLowLevelConfig: (configFullName: string) => Promise<void>;
  handleCreateOpenaiConfig: () => Promise<void>;
  handleSaveOpenaiConfig: () => Promise<void>;
  handleDeleteConfig: () => Promise<void>;

  // --- 触发 dialog 打开 ---
  openEditDialog: (configName: string, provider: string) => void;
  openDeleteDialog: (configName: string, provider: string) => void;

  // --- 派生 ---
  allConfigsList: AllConfigItem[];
  isHighLevelConfigValid: boolean;
  isLowLevelConfigValid: boolean;
  taskModelLacksImage: boolean;

  /** 当 high/low 被清空时由 useAIConfig 内部同步回 */
  setHighLevelConfig: (v: string) => void;
  setLowLevelConfig: (v: string) => void;
  /** 工具：url 是否以 / 结尾 */
  baseUrlHasTrailingSlash: (baseUrl: string) => boolean;
}

export function useProviderConfig(): UseProviderConfigReturn {
  const { t } = useLanguage();

  // ---------- Provider list ----------
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [currentProvider, setCurrentProvider] = useState<string>('openai');
  const [allConfigs, setAllConfigs] = useState<AllConfigsSummary | null>(null);
  const [highLevelConfig, setHighLevelConfig] = useState<string>('');
  const [lowLevelConfig, setLowLevelConfig] = useState<string>('');
  const [modelSupportMap, setModelSupportMap] = useState<Record<string, string[]>>(
    {},
  );

  // ---------- OpenAI edit state ----------
  const [openaiConfigData, setOpenaiConfigData] = useState<OpenAIConfigData | null>(
    null,
  );
  const [isLoadingOpenaiConfig, setIsLoadingOpenaiConfig] = useState(false);
  const [isSavingOpenaiConfig, setIsSavingOpenaiConfig] = useState(false);
  const [providerConfigOptions, setProviderConfigOptions] =
    useState<ProviderConfigOptions | null>(null);

  // ---------- New config form ----------
  const [newConfigProvider, setNewConfigProvider] = useState('openai');
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigBaseUrl, setNewConfigBaseUrl] = useState('');
  const [newConfigModel, setNewConfigModel] = useState('');
  const [newConfigApiKeys, setNewConfigApiKeys] = useState<string[]>([]);
  const [newConfigEmbeddingModel] = useState('text-embedding-3-small');
  const [newConfigModelSupport, setNewConfigModelSupport] = useState<string[]>([
    'text',
  ]);
  const [newConfigFetchedModels, setNewConfigFetchedModels] = useState<string[]>([]);
  const [editConfigFetchedModels, setEditConfigFetchedModels] = useState<string[]>(
    [],
  );
  const [isFetchingNewConfigModels, setIsFetchingNewConfigModels] = useState(false);
  const [isFetchingEditConfigModels, setIsFetchingEditConfigModels] = useState(false);

  // ---------- Edit form / Dialog ----------
  const [editingConfigName, setEditingConfigName] = useState('');
  const [editingConfigProvider, setEditingConfigProvider] = useState('openai');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isManageConfigDialogOpen, setIsManageConfigDialogOpen] = useState(false);

  // ============================================================================
  // utils
  // ============================================================================
  const baseUrlHasTrailingSlash = useCallback(
    (baseUrl: string) => baseUrl.trim().endsWith('/'),
    [],
  );

  const getFirstApiKey = useCallback(
    (apiKeys: string[]) =>
      apiKeys.find((key) => key.trim())?.trim() || '',
    [],
  );

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

  // ============================================================================
  // Fetch helpers
  // ============================================================================
  const fetchProviderConfigOptions = useCallback(async (provider: string) => {
    try {
      const response = await providerConfigApi.getConfigOptions(provider);
      setProviderConfigOptions(response);
    } catch (error) {
      console.error(
        `Failed to fetch provider config options for ${provider}:`,
        error,
      );
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
      if (
        !trimmedBaseUrl ||
        !apiKey ||
        baseUrlHasTrailingSlash(trimmedBaseUrl)
      ) {
        onSuccess([]);
        return;
      }

      try {
        setLoading(true);
        const models =
          provider === 'anthropic'
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
    [baseUrlHasTrailingSlash, getFirstApiKey],
  );

  const fetchConfigDetailForEdit = useCallback(
    async (provider: string, configName: string) => {
      try {
        setIsLoadingOpenaiConfig(true);
        const response = await providerConfigApi.getConfigDetail(provider, configName);
        const configData: OpenAIConfigData = {
          base_url: (response.config.base_url?.data as string) || '',
          api_key: (response.config.api_key?.data as string[]) || [],
          model_name: (response.config.model_name?.data as string) || '',
          embedding_model:
            (response.config.embedding_model?.data as string) ||
            'text-embedding-3-small',
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
    },
    [t],
  );

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
      const configList = response.configs || [];
      setHighLevelConfig(
        normalizeConfigName(response.high_level_config || '', configList),
      );
      setLowLevelConfig(
        normalizeConfigName(response.low_level_config || '', configList),
      );
    } catch (error) {
      console.error('Failed to fetch all configs:', error);
    }
  }, [normalizeConfigName]);

  const refreshAllConfigs = useCallback(async () => {
    await fetchAllConfigs();
  }, [fetchAllConfigs]);

  // ---------- 首次加载 ----------
  useEffect(() => {
    fetchProviderList();
    fetchAllConfigs();
  }, [fetchProviderList, fetchAllConfigs]);

  // ---------- 拉取所选高/低级任务配置的 model_support（用于图片理解能力警告） ----------
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
          const support =
            (detail.config?.model_support?.data as string[]) || ['text'];
          setModelSupportMap((prev) => ({ ...prev, [fullName]: support }));
        })
        .catch((error) => {
          console.error('Failed to fetch model_support:', error);
        });
    });
  }, [highLevelConfig, lowLevelConfig, allConfigs, modelSupportMap]);

  // ---------- 实时拉取 CreateConfigDialog 中的 model 列表 ----------
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
  }, [
    fetchProviderModels,
    editingConfigProvider,
    openaiConfigData?.base_url,
    openaiConfigData?.api_key,
  ]);

  // ============================================================================
  // Actions
  // ============================================================================
  const handleSetHighLevelConfig = useCallback(
    async (configFullName: string) => {
      try {
        await providerConfigApi.setHighLevelConfig(configFullName);
        setHighLevelConfig(configFullName);
        toast.success(
          t('aiConfig.providerConfig.setHighLevelSuccess', { name: configFullName }),
        );
        await fetchAllConfigs();
      } catch (error) {
        console.error('Failed to set high level config:', error);
        toast.error(t('aiConfig.providerConfig.setFailed'));
      }
    },
    [t, fetchAllConfigs],
  );

  const handleSetLowLevelConfig = useCallback(
    async (configFullName: string) => {
      try {
        await providerConfigApi.setLowLevelConfig(configFullName);
        setLowLevelConfig(configFullName);
        toast.success(
          t('aiConfig.providerConfig.setLowLevelSuccess', { name: configFullName }),
        );
        await fetchAllConfigs();
      } catch (error) {
        console.error('Failed to set low level config:', error);
        toast.error(t('aiConfig.providerConfig.setFailed'));
      }
    },
    [t, fetchAllConfigs],
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
      await providerConfigApi.saveConfig(
        editingConfigProvider,
        editingConfigName,
        configData,
      );
      toast.success(t('aiConfig.openaiConfig.saveSuccess'));
      fetchAllConfigs();
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error(t('aiConfig.openaiConfig.saveFailed'));
    } finally {
      setIsSavingOpenaiConfig(false);
    }
  }, [openaiConfigData, editingConfigName, editingConfigProvider, t, fetchAllConfigs]);

  const resetNewConfigForm = useCallback(() => {
    setNewConfigProvider('openai');
    setNewConfigName('');
    setNewConfigBaseUrl('');
    setNewConfigModel('');
    setNewConfigApiKeys([]);
    setNewConfigModelSupport(['text']);
    setNewConfigFetchedModels([]);
  }, []);

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
    if (
      newConfigApiKeys.length === 0 ||
      newConfigApiKeys.every((k) => !k.trim())
    ) {
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
    resetNewConfigForm,
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
      toast.success(
        t('aiConfig.openaiConfig.deleteSuccess', { name: editingConfigName }),
      );
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

  const openDeleteDialog = useCallback((configName: string, provider: string) => {
    setEditingConfigName(configName);
    setEditingConfigProvider(provider);
    setIsDeleteDialogOpen(true);
  }, []);

  const openEditDialog = useCallback(
    (configName: string, provider: string) => {
      setEditingConfigName(configName);
      setEditingConfigProvider(provider);
      setOpenaiConfigData(null);
      setEditConfigFetchedModels([]);
      fetchConfigDetailForEdit(provider, configName);
      fetchProviderConfigOptions(provider);
      setIsEditDialogOpen(true);
    },
    [fetchConfigDetailForEdit, fetchProviderConfigOptions],
  );

  const toggleNewConfigCapability = useCallback((cap: string) => {
    setNewConfigModelSupport((prev) =>
      prev.includes(cap) ? prev.filter((v) => v !== cap) : [...prev, cap],
    );
  }, []);

  const clearOpenaiConfigData = useCallback(() => {
    setOpenaiConfigData(null);
    setEditConfigFetchedModels([]);
  }, []);

  const setOpenaiConfigDataField = useCallback(
    (field: keyof OpenAIConfigData, value: string | string[]) => {
      setOpenaiConfigData((prev) => (prev ? { ...prev, [field]: value } : null));
    },
    [],
  );

  const toggleOpenaiConfigCapability = useCallback((cap: string) => {
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
  }, []);

  // ============================================================================
  // 派生
  // ============================================================================
  const allConfigsList: AllConfigItem[] = allConfigs ? allConfigs.configs || [] : [];

  const isHighLevelConfigValid =
    !!highLevelConfig && allConfigsList.some((c) => c.name === highLevelConfig);

  const isLowLevelConfigValid =
    !!lowLevelConfig && allConfigsList.some((c) => c.name === lowLevelConfig);

  const taskModelLacksImage = (() => {
    const lacks = (fullName: string) => {
      if (!fullName) return false;
      const support = modelSupportMap[fullName];
      if (!support) return false;
      return !support.includes('image');
    };
    return lacks(highLevelConfig) || lacks(lowLevelConfig);
  })();

  return {
    // 拉取数据
    providers,
    currentProvider,
    allConfigs,
    highLevelConfig,
    lowLevelConfig,
    modelSupportMap,

    // edit
    openaiConfigData,
    isLoadingOpenaiConfig,
    isSavingOpenaiConfig,
    providerConfigOptions,

    // new form
    newConfigProvider,
    newConfigName,
    newConfigBaseUrl,
    newConfigModel,
    newConfigApiKeys,
    newConfigEmbeddingModel,
    newConfigModelSupport,
    newConfigFetchedModels,
    isFetchingNewConfigModels,

    // edit form
    editingConfigName,
    editingConfigProvider,
    editConfigFetchedModels,
    isFetchingEditConfigModels,

    // dialog state
    isCreateDialogOpen,
    isEditDialogOpen,
    isDeleteDialogOpen,
    isManageConfigDialogOpen,

    // setters
    setNewConfigProvider,
    setNewConfigName,
    setNewConfigBaseUrl,
    setNewConfigModel,
    setNewConfigApiKeys,
    toggleNewConfigCapability,
    resetNewConfigForm,
    setIsCreateDialogOpen,
    setIsEditDialogOpen,
    setIsDeleteDialogOpen,
    setIsManageConfigDialogOpen,
    clearOpenaiConfigData,
    setOpenaiConfigDataField,
    toggleOpenaiConfigCapability,

    // async actions
    fetchProviderConfigOptions,
    fetchProviderModels,
    fetchConfigDetailForEdit,
    refreshAllConfigs,
    handleSetHighLevelConfig,
    handleSetLowLevelConfig,
    handleCreateOpenaiConfig,
    handleSaveOpenaiConfig,
    handleDeleteConfig,

    // dialog openers
    openEditDialog,
    openDeleteDialog,

    // 派生
    allConfigsList,
    isHighLevelConfigValid,
    isLowLevelConfigValid,
    taskModelLacksImage,

    // 跨 hook 同步
    setHighLevelConfig,
    setLowLevelConfig,

    // utils
    baseUrlHasTrailingSlash,
  };
}
