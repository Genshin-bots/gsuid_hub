/**
 * AIConfigPage - 顶层路由组件
 *
 * 该文件是整个 AI 配置页面的"装配中心"：
 * - 调用 6 个领域 hook（useFrameworkConfig / useProviderConfig / useEmbeddingConfig
 *   / useMcpToolsConfig / useAIWizard / useAIServiceSwitch）拿到全部状态与回调
 * - 计算 aiConfig / 各 provider config 等派生字段
 * - 计算 isConfigDirty 等保存流派生值
 * - 把数据与回调通过 props 注入到 ./AIConfig 下各个纯渲染 section / dialog
 *
 * 详见 ./AIConfig/README.md 中的"状态 / 事件流向"图。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Globe,
  Heart,
  ListChecks,
  Loader2,
  MemoryStick,
  Puzzle,
  Save,
  ScanSearch,
  Search,
  SlidersHorizontal,
  Smile,
  Sparkles,
  HelpCircle,
  Server,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  embeddingConfigApi,
  frameworkConfigApi,
  mcpConfigApi,
  type PluginConfigItem,
} from '@/lib/api';
import {
  MCP_SERVICE_TOOLS_CONFIG_KEY_MAP,
  type McpServiceType,
} from '@/components/config';
import { EmptyState } from './AIConfig/shared/EmptyState';
import { SidebarItem } from './AIConfig/shared/SidebarItem';
import { filterOutPrimaryProvider } from './AIConfig/shared/providerId';
import {
  ServiceSwitchSection,
  TaskConfigSection,
  WebSearchSection,
  WebFetchSection,
  ImageUnderstandSection,
  VectorDbSection,
  VoiceRecognitionSection,
  DocumentExtractSection,
  MemorySettingsSection,
  MemeSettingsSection,
  RelationshipSettingsSection,
  AgentKitsSettingsSection,
  CognitionSettingsSection,
  AdvancedSettingsSection,
  GsCoreAiMcpServerSection,
  CommandExecutorSection,
  ManageConfigDialog,
  CreateConfigDialog,
  EditConfigDialog,
  DeleteConfigDialog,
  McpToolDialog,
  EmbeddingWarningDialog,
  AIServiceSwitchDialog,
  WizardDialog,
} from './AIConfig';
import {
  useFrameworkConfig,
  useProviderConfig,
  useEmbeddingConfig,
  useMcpToolsConfig,
  useAIWizard,
  useAIServiceSwitch,
} from './AIConfig/hooks';

export default function AIConfigPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  // ====================== Active section ======================
  const [activeSection, setActiveSection] = useState<string>('taskConfig');

  // ====================== Framework Config (AI基础配置) ======================
  const {
    configs,
    isLoading,
    isLoadingDetail,
    isSaving,
    originalConfig,
    setIsSaving,
    updateConfigValue,
    markSaved: markConfigsSaved,
    applyConfigsAndMarkSaved,
  } = useFrameworkConfig();

  // ====================== Provider / OpenAI Config ======================
  const provider = useProviderConfig();

  // ====================== Embedding Config ======================
  const embedding = useEmbeddingConfig();

  // ====================== 派生：当前 configs 中各具名配置 ======================
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
          c.name.includes('Rerank模型配置') ||
          c.full_name.includes('Rerank模型配置'),
      ),
    [configs],
  );

  const tavilyConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) =>
          c.name.includes('Tavily搜索配置') || c.full_name.includes('Tavily搜索配置'),
      ),
    [configs],
  );

  const exaConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) =>
          c.name.includes('Exa搜索配置') || c.full_name.includes('Exa搜索配置'),
      ),
    [configs],
  );

  const miniMaxConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) =>
          c.name.includes('MiniMax搜索配置') ||
          c.full_name.includes('MiniMax搜索配置'),
      ),
    [configs],
  );

  const jinaConfig = useMemo(
    () =>
      Object.values(configs).find((c) => {
        const name = `${c.name} ${c.full_name}`;
        // 优先完整中文名；回退仅当名称同时含 Jina 与搜索/抓取语义，避免误匹配其它插件
        if (
          c.name.includes('Jina搜索抓取配置') ||
          c.full_name.includes('Jina搜索抓取配置')
        ) {
          return true;
        }
        return (
          /jina/i.test(name) &&
          (name.includes('搜索') ||
            name.includes('抓取') ||
            /search|fetch|reader/i.test(name))
        );
      }),
    [configs],
  );

  const webFetchConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) =>
          c.name.includes('WebFetch抓取配置') ||
          c.full_name.includes('WebFetch抓取配置'),
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
        (c) =>
          c.name.includes('表情包配置') || c.full_name.includes('表情包配置'),
      ),
    [configs],
  );

  const mcpToolsConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) =>
          c.name.includes('MCP 工具配置') || c.full_name.includes('MCP 工具配置'),
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

  const commandExecutorConfig = useMemo(
    () =>
      Object.values(configs).find(
        (c) =>
          c.name.includes('命令执行器') ||
          c.full_name.includes('命令执行器'),
      ),
    [configs],
  );

  /** 安全地将 unknown 解析为 boolean（处理后端可能返回字符串 "true"/"false" 的情况） */
  const toBool = (v: unknown): boolean =>
    v === true || v === 'true' || v === 1;

  const isAIEnabled = toBool(aiConfig?.config.enable?.value);
  const isRerankEnabled = toBool(aiConfig?.config.enable_rerank?.value);
  const rerankProvider =
    (aiConfig?.config.rerank_provider?.value as string) ?? 'local';
  const isMemoryEnabled = toBool(aiConfig?.config.enable_memory?.value);
  const websearchProvider =
    (aiConfig?.config.websearch_provider?.value as string) ?? 'Jina';
  const websearchLbStrategy =
    (aiConfig?.config.websearch_lb_strategy?.value as string) ?? 'error_switch';
  const websearchFallbackOrder = useMemo(() => {
    const raw = aiConfig?.config.websearch_fallback_order?.value;
    if (Array.isArray(raw)) return raw.map(String);
    return [] as string[];
  }, [aiConfig?.config.websearch_fallback_order?.value]);
  const webfetchProvider =
    (aiConfig?.config.webfetch_provider?.value as string) ?? 'Jina';
  const webfetchLbStrategy =
    (aiConfig?.config.webfetch_lb_strategy?.value as string) ?? 'error_switch';
  const webfetchFallbackOrder = useMemo(() => {
    const raw = aiConfig?.config.webfetch_fallback_order?.value;
    // 尊重用户清空（[]）；字段缺失时也用 []（与后端默认对齐，不在前端合成未落盘值）
    if (Array.isArray(raw)) return raw.map(String);
    return [] as string[];
  }, [aiConfig?.config.webfetch_fallback_order?.value]);
  const imageUnderstandProvider =
    (aiConfig?.config.image_understand_provider?.value as string) ?? '';
  const qdrantProvider =
    (aiConfig?.config.qdrant_provider?.value as string) ?? 'local';
  const embeddingProvider =
    (embedding.embeddingSummary?.provider ||
      (aiConfig?.config.embedding_provider?.value as string)) ??
    'local';
  const asrProvider = (aiConfig?.config.asr_provider?.value as string) ?? '';
  const documentExtractProvider =
    (aiConfig?.config.document_extract_provider?.value as string) ?? '';

  // 主备双配置：备用配置由后端在主配置失败/限流时切换使用。
  // 这两个字段持久化在 aiConfig（framework-config: `GsCore AI AI配置`）
  // 下，类型为字符串（保存的也是 provider++name 形式），与主配置同源。
  const highLevel2ndConfigValue =
    (aiConfig?.config.high_level_2nd_provider_config_name?.value as string) ??
    '';
  const lowLevel2ndConfigValue =
    (aiConfig?.config.low_level_2nd_provider_config_name?.value as string) ??
    '';
  const isHighLevel2ndConfigValid =
    !!highLevel2ndConfigValue &&
    provider.allConfigsList.some((c) => c.name === highLevel2ndConfigValue);
  const isLowLevel2ndConfigValid =
    !!lowLevel2ndConfigValue &&
    provider.allConfigsList.some((c) => c.name === lowLevel2ndConfigValue);

  // ====================== MCP tools ======================
  const mcp = useMcpToolsConfig({ mcpToolsConfig, updateConfigValue });

  const websearchMcpToolId =
    (mcpToolsConfig?.config.websearch_mcp_tool_id?.value as string) || '';
  const imageUnderstandMcpToolId =
    (mcpToolsConfig?.config.image_understand_mcp_tool_id?.value as string) || '';
  const asrMcpToolId =
    (mcpToolsConfig?.config.asr_mcp_tool_id?.value as string) || '';
  const documentExtractMcpToolId =
    (mcpToolsConfig?.config.document_extract_mcp_tool_id?.value as string) || '';

  const imageUnderstandToolInfo = useMemo(
    () =>
      imageUnderstandMcpToolId
        ? mcp.mcpToolOptions.find(
            (opt) => opt.value === imageUnderstandMcpToolId,
          ) || null
        : null,
    [imageUnderstandMcpToolId, mcp.mcpToolOptions],
  );

  const websearchToolInfo = useMemo(
    () =>
      websearchMcpToolId
        ? mcp.mcpToolOptions.find((opt) => opt.value === websearchMcpToolId) ||
          null
        : null,
    [websearchMcpToolId, mcp.mcpToolOptions],
  );

  const asrToolInfo = useMemo(
    () =>
      asrMcpToolId
        ? mcp.mcpToolOptions.find((opt) => opt.value === asrMcpToolId) || null
        : null,
    [asrMcpToolId, mcp.mcpToolOptions],
  );

  const documentExtractToolInfo = useMemo(
    () =>
      documentExtractMcpToolId
        ? mcp.mcpToolOptions.find(
            (opt) => opt.value === documentExtractMcpToolId,
          ) || null
        : null,
    [documentExtractMcpToolId, mcp.mcpToolOptions],
  );

  // ====================== AI Status (global context for sidebar) ======================
  const { setAIEnabled: setGlobalAIEnabled } = useAIStatus();
  useEffect(() => {
    setGlobalAIEnabled(isAIEnabled);
  }, [isAIEnabled, setGlobalAIEnabled]);

  // ====================== AI Wizard ======================
  const wizard = useAIWizard();

  // ====================== AI Service Switch ======================
  const aiSwitch = useAIServiceSwitch({
    aiConfig,
    updateConfigValue,
    isAIEnabled,
    setGlobalAIEnabled,
    setPendingRestart: wizard.setIsPendingRestart,
  });

  // ====================== 下方所有配置的锁定状态 ======================
  // 锁定条件:AI 服务未启用 或 后端核心尚未加载(wizard 接口 404)。
  // 在该状态下,侧边栏 + 内容区都应置灰且不可交互。
  const isSectionsLocked = !isAIEnabled || wizard.isBackendPendingRestart;
  const sectionsLockedTooltip = t(
    'aiConfig.serviceSwitch.sectionsLockedHint',
  );

  // ====================== Options (枚举) ======================
  const embeddingProviderOptions =
    (aiConfig?.config.embedding_provider?.options || ['local']) as string[];
  const rerankProviderOptions =
    (aiConfig?.config.rerank_provider?.options || ['local']) as string[];
  const websearchProviderOptions =
    (aiConfig?.config.websearch_provider?.options || [
      'Jina',
      'Tavily',
      'Exa',
      'MiniMax',
      'MCP',
    ]) as string[];
  const websearchLbStrategyOptions =
    (aiConfig?.config.websearch_lb_strategy?.options || [
      'none',
      'error_switch',
      'auto_balance',
    ]) as string[];
  const websearchFallbackOptions =
    (aiConfig?.config.websearch_fallback_order?.options ||
      websearchProviderOptions) as string[];
  const webfetchProviderOptions =
    (aiConfig?.config.webfetch_provider?.options || ['Jina', 'local']) as string[];
  const webfetchLbStrategyOptions =
    (aiConfig?.config.webfetch_lb_strategy?.options || [
      'none',
      'error_switch',
      'auto_balance',
    ]) as string[];
  const webfetchFallbackOptions =
    (aiConfig?.config.webfetch_fallback_order?.options ||
      webfetchProviderOptions) as string[];
  const qdrantProviderOptions =
    (aiConfig?.config.qdrant_provider?.options || [
      'local',
      'remote',
    ]) as string[];
  const imageUnderstandProviderOptions =
    (aiConfig?.config.image_understand_provider?.options || ['MCP']) as string[];
  const asrProviderOptions =
    (aiConfig?.config.asr_provider?.options || ['MCP']) as string[];
  const documentExtractProviderOptions =
    (aiConfig?.config.document_extract_provider?.options || ['MCP']) as string[];

  // ====================== Dirty check + 保存流 ======================
  const isConfigDirty = useMemo(() => {
    const configChanged =
      Object.keys(originalConfig).length === 0
        ? Object.keys(configs).length > 0
        : JSON.stringify(configs) !== JSON.stringify(originalConfig);
    const embeddingProviderChanged =
      embedding.embeddingSummary?.provider !==
      embedding.originalEmbeddingProvider;
    const embeddingLocalChanged =
      JSON.stringify(embedding.embeddingLocalConfig) !==
      JSON.stringify(embedding.originalEmbeddingLocalConfig);
    const embeddingOpenaiChanged =
      JSON.stringify(embedding.embeddingOpenaiConfig) !==
      JSON.stringify(embedding.originalEmbeddingOpenaiConfig);
    const mcpToolsChanged =
      JSON.stringify(mcp.mcpToolsConfigs) !==
        JSON.stringify(mcp.originalMcpToolsConfigs) ||
      JSON.stringify(mcp.mcpDetailsEditing) !==
        JSON.stringify(mcp.originalMcpDetails);
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
    embedding.embeddingSummary,
    embedding.originalEmbeddingProvider,
    embedding.embeddingLocalConfig,
    embedding.originalEmbeddingLocalConfig,
    embedding.embeddingOpenaiConfig,
    embedding.originalEmbeddingOpenaiConfig,
    mcp.mcpToolsConfigs,
    mcp.originalMcpToolsConfigs,
    mcp.mcpDetailsEditing,
    mcp.originalMcpDetails,
  ]);

  // pendingSaveAction / EmbeddingWarningDialog 状态
  const [isEmbeddingWarningOpen, setIsEmbeddingWarningOpen] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<
    (() => void) | null
  >(null);

  // 实际执行保存逻辑
  const executeSave = useCallback(async () => {
    try {
      setIsSaving(true);

      // 1. 保存框架配置（仅变化的部分）
      const changedConfigs = Object.values(configs).filter((config) => {
        const original = originalConfig[config.id];
        if (!original) return true;
        return (
          JSON.stringify(config.config) !== JSON.stringify(original.config)
        );
      });

      /** 备用列表里若含主用，保存时剔除并稍后 toast + 回写 UI */
      let fallbackPrimaryConflict = false;
      const uiSyncFallback: {
        websearch?: string[];
        webfetch?: string[];
      } = {};

      for (const config of changedConfigs) {
        const configToSave: Record<string, unknown> = {};
        Object.entries(config.config).forEach(
          ([key, field]: [string, PluginConfigItem]) => {
            if (
              !field ||
              typeof field !== 'object' ||
              !('value' in field)
            )
              return;
            const rawType = (field.type || '').toLowerCase();
            let value: unknown = field.value;

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
                value = value
                  .map(Number)
                  .filter((n: number) => !isNaN(n));
            } else if (rawType === 'gsliststr') {
              if (Array.isArray(value)) value = value.map(String);
            } else if (rawType === 'gsdivider') {
              return;
            }

            // 网络搜索 / 网页抓取：备用列表不得含主用源（大小写不敏感）
            if (
              key === 'websearch_fallback_order' &&
              Array.isArray(value)
            ) {
              const primary = String(
                config.config.websearch_provider?.value ?? '',
              );
              const next = filterOutPrimaryProvider(
                value as string[],
                primary,
              );
              if (next.length !== (value as string[]).length) {
                fallbackPrimaryConflict = true;
                uiSyncFallback.websearch = next;
                value = next;
              }
            }
            if (
              key === 'webfetch_fallback_order' &&
              Array.isArray(value)
            ) {
              const primary = String(
                config.config.webfetch_provider?.value ?? '',
              );
              const next = filterOutPrimaryProvider(
                value as string[],
                primary,
              );
              if (next.length !== (value as string[]).length) {
                fallbackPrimaryConflict = true;
                uiSyncFallback.webfetch = next;
                value = next;
              }
            }

            configToSave[key] = value;
          },
        );
        await frameworkConfigApi.updateFrameworkConfig(
          config.full_name,
          configToSave,
        );
      }
      if (changedConfigs.length > 0) {
        // 若剔除了「备用=主用」冲突，原子同步 configs + original，避免双 setState 不一致
        if (
          aiConfig?.id &&
          (uiSyncFallback.websearch || uiSyncFallback.webfetch)
        ) {
          const id = aiConfig.id;
          const base = configs[id];
          if (base) {
            const nextConfig = { ...base.config };
            if (
              uiSyncFallback.websearch &&
              nextConfig.websearch_fallback_order
            ) {
              nextConfig.websearch_fallback_order = {
                ...nextConfig.websearch_fallback_order,
                value: uiSyncFallback.websearch,
              };
            }
            if (
              uiSyncFallback.webfetch &&
              nextConfig.webfetch_fallback_order
            ) {
              nextConfig.webfetch_fallback_order = {
                ...nextConfig.webfetch_fallback_order,
                value: uiSyncFallback.webfetch,
              };
            }
            applyConfigsAndMarkSaved({
              ...configs,
              [id]: { ...base, config: nextConfig },
            });
          } else {
            markConfigsSaved(configs);
          }
        } else {
          markConfigsSaved(configs);
        }
      }
      if (fallbackPrimaryConflict) {
        toast.warning(
          t('aiConfig.serviceProvider.fallbackPrimaryStrippedOnSave'),
        );
      }

      // 2. 保存嵌入模型配置
      const currentProviderValue =
        embedding.embeddingSummary?.provider || '';
      if (currentProviderValue !== embedding.originalEmbeddingProvider) {
        const response =
          await embeddingConfigApi.setProvider(currentProviderValue);
        toast.success(
          response.msg ||
            t('aiConfig.serviceProvider.embeddingProviderSwitched', {
              provider: currentProviderValue,
            }),
        );
      }
      if (
        JSON.stringify(embedding.embeddingLocalConfig) !==
        JSON.stringify(embedding.originalEmbeddingLocalConfig)
      ) {
        const localPayload: Record<string, unknown> = {};
        Object.entries(embedding.embeddingLocalConfig).forEach(
          ([key, field]) => {
            localPayload[key] = field.data;
          },
        );
        await embeddingConfigApi.saveLocalConfig(localPayload);
      }
      if (
        JSON.stringify(embedding.embeddingOpenaiConfig) !==
        JSON.stringify(embedding.originalEmbeddingOpenaiConfig)
      ) {
        const openaiPayload: Record<string, unknown> = {};
        Object.entries(embedding.embeddingOpenaiConfig).forEach(
          ([key, field]) => {
            openaiPayload[key] = field.data;
          },
        );
        await embeddingConfigApi.saveOpenaiConfig(openaiPayload);
      }
      embedding.markSaved(
        currentProviderValue,
        embedding.embeddingLocalConfig,
        embedding.embeddingOpenaiConfig,
      );

      // 3. 保存 MCP 工具参数映射配置
      const mcpToolsChanged =
        JSON.stringify(mcp.mcpToolsConfigs) !==
          JSON.stringify(mcp.originalMcpToolsConfigs) ||
        JSON.stringify(mcp.mcpDetailsEditing) !==
          JSON.stringify(mcp.originalMcpDetails);
      if (mcpToolsChanged) {
        const allKeys = new Set([
          ...Object.keys(mcp.mcpToolsConfigs),
          ...Object.keys(mcp.originalMcpToolsConfigs),
        ]);
        for (const key of allKeys) {
          const currentData = mcp.mcpToolsConfigs[key]?.data ?? '';
          const currentDetails = mcp.mcpDetailsEditing[key] ?? {};
          const origData = mcp.originalMcpToolsConfigs[key]?.data ?? '';
          const origDetails = mcp.originalMcpDetails[key] ?? {};
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
        mcp.markSaved(mcp.mcpToolsConfigs, mcp.mcpDetailsEditing);
      }

      toast.success(t('aiConfig.configSaved'));
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('aiConfig.saveFailed'));
    } finally {
      setIsSaving(false);
      setPendingSaveAction(null);
    }
  }, [
    setIsSaving,
    configs,
    originalConfig,
    markConfigsSaved,
    applyConfigsAndMarkSaved,
    embedding,
    mcp,
    t,
    aiConfig?.id,
  ]);

  const handleSaveConfig = useCallback(() => {
    const currentProviderValue = embedding.embeddingSummary?.provider || '';
    const hasEmbeddingChanges =
      currentProviderValue !== embedding.originalEmbeddingProvider ||
      JSON.stringify(embedding.embeddingLocalConfig) !==
        JSON.stringify(embedding.originalEmbeddingLocalConfig) ||
      JSON.stringify(embedding.embeddingOpenaiConfig) !==
        JSON.stringify(embedding.originalEmbeddingOpenaiConfig);

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
  }, [embedding, aiConfig, originalConfig, executeSave]);

  const handleConfirmEmbeddingSave = useCallback(() => {
    setIsEmbeddingWarningOpen(false);
    if (pendingSaveAction) {
      pendingSaveAction();
    }
  }, [pendingSaveAction]);

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
      <div className="space-y-6">
        <EmptyState
          icon={<Bot className="w-8 h-8 text-muted-foreground" />}
          title={t('aiConfig.noAIConfig')}
        />
      </div>
    );
  }

  // ====================== 侧边栏菜单项 ======================
  const sidebarItems = [
    {
      id: 'taskConfig',
      title: t('aiConfig.taskConfig.title'),
      icon: <ListChecks className="w-5 h-5" />,
    },
    {
      id: 'vectorDb',
      title: t('aiConfig.vectorDb.title'),
      icon: <Database className="w-5 h-5" />,
    },
    {
      id: 'webSearch',
      title: t('aiConfig.serviceProvider.webSearchService'),
      icon: <Search className="w-5 h-5" />,
    },
    {
      id: 'webFetch',
      title: t('aiConfig.webFetch.title'),
      icon: <Globe className="w-5 h-5" />,
    },
    {
      id: 'imageUnderstand',
      title: t('aiConfig.imageUnderstand.title'),
      icon: <Eye className="w-5 h-5" />,
      alert:
        provider.taskModelLacksImage && !imageUnderstandProvider,
    },
    {
      id: 'voiceRecognition',
      title: t('aiConfig.voiceRecognition.title'),
      icon: <Cpu className="w-5 h-5" />,
    },
    {
      id: 'documentExtract',
      title: t('aiConfig.documentExtract.title'),
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: 'memorySettings',
      title: t('aiConfig.memorySettings.title'),
      icon: <MemoryStick className="w-5 h-5" />,
    },
    ...(memeConfig
      ? [
          {
            id: 'memeSettings',
            title: t('aiConfig.memeSettings.title'),
            icon: <Smile className="w-5 h-5" />,
          },
        ]
      : []),
    {
      id: 'gsCoreAiMcpServer',
      title: t('gsCoreAiMcpServer.title'),
      icon: <Server className="w-5 h-5" />,
    },
    {
      id: 'commandExecutor',
      title: t('aiConfig.commandExecutor.title'),
      icon: <Terminal className="w-5 h-5" />,
    },
    {
      id: 'relationshipSettings',
      title: t('aiConfig.relationshipSettings.title'),
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: 'agentKitsSettings',
      title: t('aiConfig.agentKitsSettings.title'),
      icon: <Puzzle className="w-5 h-5" />,
    },
    {
      id: 'cognitionSettings',
      title: t('aiConfig.cognitionSettings.title'),
      icon: <ScanSearch className="w-5 h-5" />,
    },
    {
      id: 'advancedSettings',
      title: t('aiConfig.advancedSettings.title'),
      icon: <SlidersHorizontal className="w-5 h-5" />,
    },
  ];

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'taskConfig':
        return (
          <TaskConfigSection
            t={t}
            isGlass={isGlass}
            allConfigsList={provider.allConfigsList}
            highLevelConfig={provider.highLevelConfig}
            lowLevelConfig={provider.lowLevelConfig}
            highLevel2ndConfig={highLevel2ndConfigValue}
            lowLevel2ndConfig={lowLevel2ndConfigValue}
            isHighLevelConfigValid={provider.isHighLevelConfigValid}
            isLowLevelConfigValid={provider.isLowLevelConfigValid}
            isHighLevel2ndConfigValid={isHighLevel2ndConfigValid}
            isLowLevel2ndConfigValid={isLowLevel2ndConfigValid}
            onSetHighLevelConfig={provider.handleSetHighLevelConfig}
            onSetLowLevelConfig={provider.handleSetLowLevelConfig}
            onSetHighLevel2ndConfig={(v) =>
              updateConfigValue(aiConfig.id, 'high_level_2nd_provider_config_name', v)
            }
            onSetLowLevel2ndConfig={(v) =>
              updateConfigValue(aiConfig.id, 'low_level_2nd_provider_config_name', v)
            }
            onOpenManageDialog={() =>
              provider.setIsManageConfigDialogOpen(true)
            }
          />
        );
      case 'webSearch':
        return (
          <WebSearchSection
            t={t}
            websearchProvider={websearchProvider}
            websearchProviderOptions={websearchProviderOptions}
            websearchLbStrategy={websearchLbStrategy}
            websearchLbStrategyOptions={websearchLbStrategyOptions}
            websearchFallbackOrder={websearchFallbackOrder}
            websearchFallbackOptions={websearchFallbackOptions}
            tavilyConfig={tavilyConfig}
            exaConfig={exaConfig}
            jinaConfig={jinaConfig}
            miniMaxConfig={miniMaxConfig}
            websearchMcpToolId={websearchMcpToolId}
            websearchToolInfo={websearchToolInfo}
            mcpDetails={mcp.mcpDetailsEditing['websearch_mcp_tool_id'] || {}}
            onChangeProvider={(v) => {
              updateConfigValue(aiConfig.id, 'websearch_provider', v);
              // 静默从备用列表剔除新主用，避免保存时误报 toast
              const next = filterOutPrimaryProvider(websearchFallbackOrder, v);
              if (next.length !== websearchFallbackOrder.length) {
                updateConfigValue(
                  aiConfig.id,
                  'websearch_fallback_order',
                  next,
                );
              }
            }}
            onChangeLbStrategy={(v) =>
              updateConfigValue(aiConfig.id, 'websearch_lb_strategy', v)
            }
            onChangeFallbackOrder={(order) =>
              updateConfigValue(aiConfig.id, 'websearch_fallback_order', order)
            }
            onUpdateConfig={updateConfigValue}
            onOpenMcpToolDialog={() => mcp.openMcpToolDialog('websearch')}
            onClearMcpTool={() => mcp.handleClearMcpTool('websearch')}
            onDetailValueChange={(name, val) =>
              mcp.updateMcpDetailValue('websearch_mcp_tool_id', name, val)
            }
            onMcpParamNameChange={(oldN, newN) =>
              mcp.renameMcpDetailKey('websearch_mcp_tool_id', oldN, newN)
            }
            onAddMcpDetailRow={() =>
              mcp.addMcpDetailRow('websearch_mcp_tool_id')
            }
            onRemoveMcpDetailRow={(name) =>
              mcp.removeMcpDetailRow('websearch_mcp_tool_id', name)
            }
          />
        );
      case 'webFetch':
        return (
          <WebFetchSection
            t={t}
            webfetchProvider={webfetchProvider}
            webfetchProviderOptions={webfetchProviderOptions}
            webfetchLbStrategy={webfetchLbStrategy}
            webfetchLbStrategyOptions={webfetchLbStrategyOptions}
            webfetchFallbackOrder={webfetchFallbackOrder}
            webfetchFallbackOptions={webfetchFallbackOptions}
            webFetchConfig={webFetchConfig}
            jinaConfig={jinaConfig}
            onChangeProvider={(v) => {
              updateConfigValue(aiConfig.id, 'webfetch_provider', v);
              const next = filterOutPrimaryProvider(webfetchFallbackOrder, v);
              if (next.length !== webfetchFallbackOrder.length) {
                updateConfigValue(
                  aiConfig.id,
                  'webfetch_fallback_order',
                  next,
                );
              }
            }}
            onChangeLbStrategy={(v) =>
              updateConfigValue(aiConfig.id, 'webfetch_lb_strategy', v)
            }
            onChangeFallbackOrder={(order) =>
              updateConfigValue(aiConfig.id, 'webfetch_fallback_order', order)
            }
            onUpdateConfig={updateConfigValue}
          />
        );
      case 'imageUnderstand':
        return (
          <ImageUnderstandSection
            t={t}
            isGlass={isGlass}
            imageUnderstandProvider={imageUnderstandProvider}
            imageUnderstandProviderOptions={imageUnderstandProviderOptions}
            taskModelLacksImage={provider.taskModelLacksImage}
            providerDesc={aiConfig?.config.image_understand_provider?.desc}
            imageUnderstandMcpToolId={imageUnderstandMcpToolId}
            imageUnderstandToolInfo={imageUnderstandToolInfo}
            mcpDetails={
              mcp.mcpDetailsEditing['image_understand_mcp_tool_id'] || {}
            }
            onChangeProvider={(v) =>
              updateConfigValue(aiConfig.id, 'image_understand_provider', v)
            }
            onOpenMcpToolDialog={() =>
              mcp.openMcpToolDialog('image_understand')
            }
            onClearMcpTool={() =>
              mcp.handleClearMcpTool('image_understand')
            }
            onDetailValueChange={(name, val) =>
              mcp.updateMcpDetailValue('image_understand_mcp_tool_id', name, val)
            }
            onMcpParamNameChange={(oldN, newN) =>
              mcp.renameMcpDetailKey(
                'image_understand_mcp_tool_id',
                oldN,
                newN,
              )
            }
            onAddMcpDetailRow={() =>
              mcp.addMcpDetailRow('image_understand_mcp_tool_id')
            }
            onRemoveMcpDetailRow={(name) =>
              mcp.removeMcpDetailRow('image_understand_mcp_tool_id', name)
            }
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
            availableProviders={embedding.embeddingSummary?.available_providers}
            extraProviders={embedding.embeddingSummary?.extra_providers}
            isLoadingEmbeddingConfig={embedding.isLoadingEmbeddingConfig}
            embeddingLocalConfig={embedding.embeddingLocalConfig}
            embeddingOpenaiConfig={embedding.embeddingOpenaiConfig}
            embeddingConfig={embeddingConfig}
            isRerankEnabled={isRerankEnabled}
            rerankProvider={rerankProvider}
            rerankProviderOptions={rerankProviderOptions}
            rerankConfig={rerankConfig}
            onUpdateConfig={updateConfigValue}
            onSwitchEmbeddingProvider={embedding.handleSwitchEmbeddingProvider}
            onUpdateEmbeddingLocalField={embedding.updateEmbeddingLocalField}
            onUpdateEmbeddingOpenaiField={embedding.updateEmbeddingOpenaiField}
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
            mcpDetails={mcp.mcpDetailsEditing['asr_mcp_tool_id'] || {}}
            onChangeProvider={(v) =>
              updateConfigValue(aiConfig.id, 'asr_provider', v)
            }
            onOpenMcpToolDialog={() => mcp.openMcpToolDialog('asr')}
            onClearMcpTool={() => mcp.handleClearMcpTool('asr')}
            onDetailValueChange={(name, val) =>
              mcp.updateMcpDetailValue('asr_mcp_tool_id', name, val)
            }
            onMcpParamNameChange={(oldN, newN) =>
              mcp.renameMcpDetailKey('asr_mcp_tool_id', oldN, newN)
            }
            onAddMcpDetailRow={() => mcp.addMcpDetailRow('asr_mcp_tool_id')}
            onRemoveMcpDetailRow={(name) =>
              mcp.removeMcpDetailRow('asr_mcp_tool_id', name)
            }
          />
        );
      case 'documentExtract':
        return (
          <DocumentExtractSection
            t={t}
            aiConfigId={aiConfig.id}
            documentExtractProvider={documentExtractProvider}
            documentExtractProviderOptions={documentExtractProviderOptions}
            documentExtractProviderDesc={
              aiConfig?.config.document_extract_provider?.desc
            }
            documentExtractMcpToolId={documentExtractMcpToolId}
            documentExtractToolInfo={documentExtractToolInfo}
            mcpDetails={
              mcp.mcpDetailsEditing['document_extract_mcp_tool_id'] || {}
            }
            onChangeProvider={(v) =>
              updateConfigValue(aiConfig.id, 'document_extract_provider', v)
            }
            onOpenMcpToolDialog={() =>
              mcp.openMcpToolDialog('document_extract')
            }
            onClearMcpTool={() =>
              mcp.handleClearMcpTool('document_extract')
            }
            onDetailValueChange={(name, val) =>
              mcp.updateMcpDetailValue(
                'document_extract_mcp_tool_id',
                name,
                val,
              )
            }
            onMcpParamNameChange={(oldN, newN) =>
              mcp.renameMcpDetailKey(
                'document_extract_mcp_tool_id',
                oldN,
                newN,
              )
            }
            onAddMcpDetailRow={() =>
              mcp.addMcpDetailRow('document_extract_mcp_tool_id')
            }
            onRemoveMcpDetailRow={(name) =>
              mcp.removeMcpDetailRow('document_extract_mcp_tool_id', name)
            }
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
            onToggleMemory={(checked) =>
              updateConfigValue(aiConfig.id, 'enable_memory', checked)
            }
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
      case 'gsCoreAiMcpServer':
        return (
          <GsCoreAiMcpServerSection
            t={t}
            isGlass={isGlass}
          />
        );
      case 'commandExecutor':
        return (
          <CommandExecutorSection
            t={t}
            commandExecutorConfig={commandExecutorConfig}
            onUpdateConfig={updateConfigValue}
          />
        );
      case 'relationshipSettings':
        return (
          <RelationshipSettingsSection
            t={t}
            aiConfig={aiConfig}
            onUpdateConfig={updateConfigValue}
          />
        );
      case 'agentKitsSettings':
        return (
          <AgentKitsSettingsSection
            t={t}
            aiConfig={aiConfig}
            onUpdateConfig={updateConfigValue}
          />
        );
      case 'cognitionSettings':
        return (
          <CognitionSettingsSection
            t={t}
            aiConfig={aiConfig}
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
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Header（外边距由 AppLayout --layout-gutter 统一提供） */}
      <div className="shrink-0 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
                onClick={aiSwitch.handleOpenHelp}
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
                  onClick={() => wizard.fetchWizardChecklist()}
                  disabled={
                    wizard.isWizardLoading || wizard.isPendingRestart
                  }
                  size="sm"
                  variant="outline"
                  className="gap-1.5 sm:gap-2 whitespace-nowrap text-xs sm:text-sm"
                >
                  {wizard.isWizardLoading ? (
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                  {t('aiConfig.checkConfig')}
                </Button>
              );
              // 只有按钮被禁用时才显示提示 tooltip
              if (wizard.isPendingRestart) {
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

      {/* Main Content Area - banner + sidebar + content in unified glass-card */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 glass-card rounded-2xl flex flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
          {/* AI Service Master Switch Banner */}
          <div className="shrink-0 px-3 sm:px-5 pt-3 sm:pt-5 pb-2">
            {wizard.isBackendPendingRestart && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-xs sm:text-sm">
                  <p className="font-semibold">
                    {t('aiConfig.serviceSwitch.restartRequiredTitle')}
                  </p>
                  <p className="mt-1 opacity-90">
                    {t('aiConfig.serviceSwitch.restartRequiredDesc')}
                  </p>
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
                onCheckedChange={aiSwitch.handleAISwitchChange}
                className="scale-110"
              />
            </div>
          </div>

          {/* Sidebar + Content */}
          <div className="flex-1 flex min-h-0 border-t border-border/40">
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
                      disabled={isSectionsLocked}
                      disabledTooltip={
                        isSectionsLocked ? sectionsLockedTooltip : undefined
                      }
                      alert={'alert' in item ? item.alert : false}
                      collapsed={isMobile}
                      onClick={setActiveSection}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div
                className={cn(
                  'p-3 sm:p-6 transition-opacity duration-200',
                  isSectionsLocked &&
                    'pointer-events-none opacity-50 select-none',
                )}
                aria-disabled={isSectionsLocked}
              >
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
          </div>
        </div>
      </div>

      {/* ====================== Dialogs ====================== */}

      <ManageConfigDialog
        open={provider.isManageConfigDialogOpen}
        t={t}
        allConfigsList={provider.allConfigsList}
        highLevelConfig={provider.highLevelConfig}
        lowLevelConfig={provider.lowLevelConfig}
        onOpenChange={provider.setIsManageConfigDialogOpen}
        onOpenCreate={() => {
          provider.setIsCreateDialogOpen(true);
          provider.fetchProviderConfigOptions(provider.newConfigProvider);
        }}
        onOpenEdit={provider.openEditDialog}
        onOpenDelete={provider.openDeleteDialog}
      />

      <CreateConfigDialog
        open={provider.isCreateDialogOpen}
        t={t}
        provider={provider.newConfigProvider}
        configName={provider.newConfigName}
        baseUrl={provider.newConfigBaseUrl}
        apiKeys={provider.newConfigApiKeys}
        model={provider.newConfigModel}
        modelSupport={provider.newConfigModelSupport}
        modelEffort={provider.newConfigModelEffort}
        maxConcurrency={provider.newConfigMaxConcurrency}
        maxTokens={provider.newConfigMaxTokens}
        usageStatsMode={provider.newConfigUsageStatsMode}
        requestMethod={provider.newConfigRequestMethod}
        remoteWebSearch={provider.newConfigRemoteWebSearch}
        sendBackThinking={provider.newConfigSendBackThinking}
        forwardEndUserId={provider.newConfigForwardEndUserId}
        endUserIdSalt={provider.newConfigEndUserIdSalt}
        fetchedModels={provider.newConfigFetchedModels}
        isFetching={provider.isFetchingNewConfigModels}
        providerConfigOptions={provider.providerConfigOptions}
        baseUrlHasTrailingSlash={provider.baseUrlHasTrailingSlash}
        onOpenChange={provider.setIsCreateDialogOpen}
        onChangeProvider={provider.setNewConfigProvider}
        onFetchProviderConfigOptions={provider.fetchProviderConfigOptions}
        onChangeConfigName={provider.setNewConfigName}
        onChangeBaseUrl={provider.setNewConfigBaseUrl}
        onChangeApiKeys={provider.setNewConfigApiKeys}
        onChangeModel={provider.setNewConfigModel}
        onChangeModelEffort={provider.setNewConfigModelEffort}
        onChangeModelSupport={provider.setNewConfigModelSupport}
        onChangeMaxConcurrency={provider.setNewConfigMaxConcurrency}
        onChangeMaxTokens={provider.setNewConfigMaxTokens}
        onChangeUsageStatsMode={provider.setNewConfigUsageStatsMode}
        onChangeRequestMethod={provider.setNewConfigRequestMethod}
        onChangeRemoteWebSearch={provider.setNewConfigRemoteWebSearch}
        onChangeSendBackThinking={provider.setNewConfigSendBackThinking}
        onChangeForwardEndUserId={provider.setNewConfigForwardEndUserId}
        onChangeEndUserIdSalt={provider.setNewConfigEndUserIdSalt}
        onReset={provider.resetNewConfigForm}
        onSubmit={provider.handleCreateOpenaiConfig}
      />

      <EditConfigDialog
        open={provider.isEditDialogOpen}
        t={t}
        configName={provider.editingConfigName}
        editingConfigProvider={provider.editingConfigProvider}
        data={provider.openaiConfigData}
        isLoading={provider.isLoadingOpenaiConfig}
        isSaving={provider.isSavingOpenaiConfig}
        providerConfigOptions={provider.providerConfigOptions}
        fetchedModels={provider.editConfigFetchedModels}
        isFetching={provider.isFetchingEditConfigModels}
        baseUrlHasTrailingSlash={provider.baseUrlHasTrailingSlash}
        onOpenChange={(open) => {
          if (!open) {
            provider.clearOpenaiConfigData();
          }
          provider.setIsEditDialogOpen(open);
        }}
        onChangeField={(field, value) =>
          provider.setOpenaiConfigDataField(field, value)
        }
        onChangeModelEffort={(val) =>
          provider.setOpenaiConfigDataField('model_effort', val)
        }
        onSave={provider.handleSaveOpenaiConfig}
      />

      <DeleteConfigDialog
        open={provider.isDeleteDialogOpen}
        t={t}
        configName={provider.editingConfigName}
        onOpenChange={provider.setIsDeleteDialogOpen}
        onConfirm={provider.handleDeleteConfig}
      />

      <McpToolDialog
        open={mcp.mcpToolDialogOpen}
        t={t}
        serviceType={mcp.mcpToolDialogType}
        mcpConfigs={mcp.mcpConfigs}
        mcpToolOptions={mcp.mcpToolOptions}
        currentDialogMcpToolId={mcp.currentDialogMcpToolId}
        selectedMcpToolInfo={mcp.selectedMcpToolInfo}
        onOpenChange={mcp.setMcpToolDialogOpen}
        onSelect={mcp.handleSelectMcpTool}
        onClear={() => mcp.handleClearMcpTool(mcp.mcpToolDialogType)}
      />

      <EmbeddingWarningDialog
        open={isEmbeddingWarningOpen}
        t={t}
        onOpenChange={setIsEmbeddingWarningOpen}
        onConfirm={handleConfirmEmbeddingSave}
      />

      <AIServiceSwitchDialog
        open={aiSwitch.isAISwitchDialogOpen}
        mode={aiSwitch.pendingAISwitchValue ? 'enable' : 'disable'}
        t={t}
        onOpenChange={aiSwitch.setIsAISwitchDialogOpen}
        onConfirm={aiSwitch.handleConfirmAISwitch}
        helpOnly={aiSwitch.isHelpOnly}
      />

      <WizardDialog
        open={wizard.isWizardDialogOpen}
        t={t}
        isLoading={wizard.isWizardLoading}
        overallStatus={wizard.wizardOverallStatus}
        usable={wizard.wizardUsable}
        summary={wizard.wizardSummary}
        checklist={wizard.wizardChecklist}
        status={wizard.wizardStatus}
        onOpenChange={wizard.setIsWizardDialogOpen}
      />
    </div>
  );
}

