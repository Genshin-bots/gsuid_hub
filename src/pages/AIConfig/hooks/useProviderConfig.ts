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
  newConfigModelSupport: string[];
  newConfigModelEffort: string;
  newConfigMaxConcurrency: number;
  /** 仅 Anthropic 等 provider 在 UI 暴露 */
  newConfigMaxTokens: string;
  /** 仅 OpenAI 系列在 UI 暴露 */
  newConfigUsageStatsMode: string;
  /** 仅 OpenAI 系列在 UI 暴露（Anthropic 没有请求方式这一说） */
  newConfigRequestMethod: string;
  /** 仅 OpenAI 系列在 UI 暴露：远端 Web Search off/on */
  newConfigRemoteWebSearch: string;
  /** 仅 OpenAI 系列在 UI 暴露：思考回传 auto/off */
  newConfigSendBackThinking: string;
  /** 仅 OpenAI 系列在 UI 暴露：终端用户标识透传 off/hashed/raw */
  newConfigForwardEndUserId: string;
  /** 仅 OpenAI 系列在 UI 暴露：`hashed` 模式的盐值 */
  newConfigEndUserIdSalt: string;
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
  setNewConfigModelEffort: (v: string) => void;
  setNewConfigModelSupport: (v: string[]) => void;
  setNewConfigMaxConcurrency: (v: number) => void;
  setNewConfigMaxTokens: (v: string) => void;
  setNewConfigUsageStatsMode: (v: string) => void;
  setNewConfigRequestMethod: (v: string) => void;
  setNewConfigRemoteWebSearch: (v: string) => void;
  setNewConfigSendBackThinking: (v: string) => void;
  setNewConfigForwardEndUserId: (v: string) => void;
  setNewConfigEndUserIdSalt: (v: string) => void;
  resetNewConfigForm: () => void;
  setIsCreateDialogOpen: (open: boolean) => void;
  setIsEditDialogOpen: (open: boolean) => void;
  setIsDeleteDialogOpen: (open: boolean) => void;
  setIsManageConfigDialogOpen: (open: boolean) => void;
  clearOpenaiConfigData: () => void;

  /**
   * 直接更新 openaiConfigData 某个字段（受 EditConfigDialog 表单约束）。
   *
   * 因为 `max_concurrency` 是数字而后两个枚举是字符串，签名统一放宽到
   * `unknown`：调用方传入什么类型 hook 都原样塞回去，仅在字段不存在时
   * 跳过。
   */
  setOpenaiConfigDataField: (field: keyof OpenAIConfigData, value: unknown) => void;

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
  const [newConfigModelSupport, setNewConfigModelSupport] = useState<string[]>([
    'text',
  ]);
  const [newConfigModelEffort, setNewConfigModelEffort] = useState('enable');
  // 三个 provider 相关字段：缺省值与后端 options 中的常见代表值对齐
  const [newConfigMaxConcurrency, setNewConfigMaxConcurrency] = useState(2);
  // 仅 Anthropic：默认 8K tokens
  const [newConfigMaxTokens, setNewConfigMaxTokens] = useState('8192');
  // 仅 OpenAI 系列
  const [newConfigUsageStatsMode, setNewConfigUsageStatsMode] = useState('auto');
  const [newConfigRequestMethod, setNewConfigRequestMethod] = useState(
    'chat_completions',
  );
  const [newConfigRemoteWebSearch, setNewConfigRemoteWebSearch] = useState('on');
  const [newConfigSendBackThinking, setNewConfigSendBackThinking] = useState('auto');
  // 默认 off：透传终端用户标识属于要显式打开的行为，不能默认外发
  const [newConfigForwardEndUserId, setNewConfigForwardEndUserId] = useState('off');
  const [newConfigEndUserIdSalt, setNewConfigEndUserIdSalt] = useState('');
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
            : provider === 'gemini'
              ? await providerConfigApi.fetchGeminiModels(trimmedBaseUrl, apiKey)
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
        const cfg = response.config;
        // 后端对 anthropic / openai 返回的字段集不一致：
        //  - 共有：base_url / api_key / model_name / model_support / model_effort /
        //          max_concurrency
        //  - 仅 Anthropic：max_tokens
        //  - 仅 OpenAI 系列：usage_stats_mode / request_method / remote_web_search
        // 没有的字段用 `undefined` 占位，UI / save 时按 provider 再处理。
        const configData: OpenAIConfigData = {
          base_url: (cfg.base_url?.data as string) || '',
          api_key: (cfg.api_key?.data as string[]) || [],
          model_name: (cfg.model_name?.data as string) || '',
          model_support: (cfg.model_support?.data as string[]) || ['text'],
          model_effort: (cfg.model_effort?.data as string) || 'enable',
          max_concurrency:
            (cfg.max_concurrency?.data as number | undefined) ?? 2,
          // 以下三个都是「按 provider 可选」
          max_tokens: cfg.max_tokens?.data as string | undefined,
          usage_stats_mode: cfg.usage_stats_mode?.data as string | undefined,
          request_method: cfg.request_method?.data as string | undefined,
          remote_web_search: cfg.remote_web_search?.data as string | undefined,
          send_back_thinking: cfg.send_back_thinking?.data as string | undefined,
          forward_end_user_id: cfg.forward_end_user_id?.data as string | undefined,
          end_user_id_salt: cfg.end_user_id_salt?.data as string | undefined,
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
      // 共有字段：所有 provider 都要带
      const configData: Record<string, { data: unknown }> = {
        base_url: { data: openaiConfigData.base_url },
        api_key: { data: openaiConfigData.api_key },
        model_name: { data: openaiConfigData.model_name },
        model_support: { data: openaiConfigData.model_support },
        model_effort: { data: openaiConfigData.model_effort || 'enable' },
        max_concurrency: { data: openaiConfigData.max_concurrency },
      };
      // 按 provider 增删字段，避免 backend 报「未知字段」
      if (editingConfigProvider === 'anthropic') {
        if (openaiConfigData.max_tokens) {
          configData.max_tokens = { data: openaiConfigData.max_tokens };
        }
        configData.remote_web_search = {
          data: openaiConfigData.remote_web_search || 'on',
        };
      } else if (editingConfigProvider === 'gemini') {
        // Gemini 只有公共字段，无 max_tokens / usage_stats_mode / request_method
      } else {
        // 其他类型一律走 OpenAI 系列字段；将来新增 provider 在此分支扩展
        configData.usage_stats_mode = {
          data: openaiConfigData.usage_stats_mode || 'auto',
        };
        configData.request_method = {
          data: openaiConfigData.request_method || 'chat_completions',
        };
        configData.remote_web_search = {
          data: openaiConfigData.remote_web_search || 'on',
        };
        configData.send_back_thinking = {
          data: openaiConfigData.send_back_thinking || 'auto',
        };
        configData.forward_end_user_id = {
          data: openaiConfigData.forward_end_user_id || 'off',
        };
        // 盐值允许为空串（无密钥摘要），所以不能用 `||` 兜底成默认值
        configData.end_user_id_salt = {
          data: openaiConfigData.end_user_id_salt ?? '',
        };
      }
      await providerConfigApi.saveConfig(
        editingConfigProvider,
        editingConfigName,
        configData,
      );
      toast.success(t('aiConfig.openaiConfig.saveSuccess'));
      setIsEditDialogOpen(false);
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
    setNewConfigModelEffort('enable');
    setNewConfigMaxConcurrency(2);
    setNewConfigMaxTokens('8192');
    setNewConfigUsageStatsMode('auto');
    setNewConfigRequestMethod('chat_completions');
    setNewConfigRemoteWebSearch('on');
    setNewConfigSendBackThinking('auto');
    setNewConfigForwardEndUserId('off');
    setNewConfigEndUserIdSalt('');
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
      // 共有字段
      const configData: Record<string, { data: unknown }> = {
        base_url: { data: newConfigBaseUrl.trim() },
        api_key: { data: newConfigApiKeys.filter((k) => k.trim()) },
        model_name: { data: newConfigModel.trim() },
        model_support: { data: newConfigModelSupport },
        model_effort: { data: newConfigModelEffort },
        max_concurrency: { data: newConfigMaxConcurrency },
      };
      if (newConfigProvider === 'anthropic') {
        configData.max_tokens = { data: newConfigMaxTokens };
        configData.remote_web_search = { data: newConfigRemoteWebSearch };
      } else if (newConfigProvider === 'gemini') {
        // Gemini 只有公共字段
      } else {
        configData.usage_stats_mode = { data: newConfigUsageStatsMode };
        configData.request_method = { data: newConfigRequestMethod };
        configData.remote_web_search = { data: newConfigRemoteWebSearch };
        configData.send_back_thinking = { data: newConfigSendBackThinking };
        configData.forward_end_user_id = { data: newConfigForwardEndUserId };
        configData.end_user_id_salt = { data: newConfigEndUserIdSalt };
      }
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
    newConfigModelSupport,
    newConfigModelEffort,
    newConfigMaxConcurrency,
    newConfigMaxTokens,
    newConfigUsageStatsMode,
    newConfigRequestMethod,
    newConfigRemoteWebSearch,
    newConfigSendBackThinking,
    newConfigForwardEndUserId,
    newConfigEndUserIdSalt,
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
    (field: keyof OpenAIConfigData, value: unknown) => {
      // 由于 `max_concurrency` 是 number、模型名称是 string、model_support 是 string[]，
      // 这里统一放宽到 unknown：调用方按字段类型传值即可。
      setOpenaiConfigData((prev) => {
        if (!prev) return prev;
        return { ...prev, [field]: value } as OpenAIConfigData;
      });
    },
    [],
  );

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
    newConfigModelSupport,
    newConfigModelEffort,
    newConfigMaxConcurrency,
    newConfigMaxTokens,
    newConfigUsageStatsMode,
    newConfigRequestMethod,
    newConfigRemoteWebSearch,
    newConfigSendBackThinking,
    newConfigForwardEndUserId,
    newConfigEndUserIdSalt,
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
    setNewConfigModelEffort,
    setNewConfigModelSupport,
    setNewConfigMaxConcurrency,
    setNewConfigMaxTokens,
    setNewConfigUsageStatsMode,
    setNewConfigRequestMethod,
    setNewConfigRemoteWebSearch,
    setNewConfigSendBackThinking,
    setNewConfigForwardEndUserId,
    setNewConfigEndUserIdSalt,
    resetNewConfigForm,
    setIsCreateDialogOpen,
    setIsEditDialogOpen,
    setIsDeleteDialogOpen,
    setIsManageConfigDialogOpen,
    clearOpenaiConfigData,
    setOpenaiConfigDataField,

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
