/**
 * useEmbeddingConfig
 *
 * 负责「嵌入模型配置」相关的状态与副作用：
 * - embeddingSummary：来自 embeddingConfigApi.getSummary（含 provider / available_providers /
 *   local_config / openai_config / extra_providers）
 * - embeddingLocalConfig / embeddingOpenaiConfig：当前编辑值
 * - originalEmbeddingProvider / originalEmbeddingLocalConfig / originalEmbeddingOpenaiConfig：保存前快照
 * - isLoadingEmbeddingConfig：加载标志
 * - 3 个 setter：handleSwitchEmbeddingProvider / updateEmbeddingLocalField / updateEmbeddingOpenaiField
 * - markSaved：保存成功后刷新快照
 *
 * 插件注册的第三方 provider 信息通过 `embeddingSummary.extra_providers` 暴露，
 * 该类 provider 的配置由前端以只读方式展示，修改走插件管理页（`/api/plugins`）。
 *
 * 由 [`src/pages/AIConfigPage.tsx`](src/pages/AIConfigPage.tsx) 调用。
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  embeddingConfigApi,
  type EmbeddingConfigSummary,
} from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EmbeddingConfigField as EmbeddingConfigFieldUI } from '../index';

export type EmbeddingFieldMap = Record<string, EmbeddingConfigFieldUI>;

export interface UseEmbeddingConfigReturn {
  /** 后端 summary（含 provider / available_providers / local_config / openai_config / extra_providers） */
  embeddingSummary: EmbeddingConfigSummary | null;
  /** 当前正在编辑的 local 字段 */
  embeddingLocalConfig: EmbeddingFieldMap;
  /** 当前正在编辑的 openai 字段 */
  embeddingOpenaiConfig: EmbeddingFieldMap;
  /** 加载标志 */
  isLoadingEmbeddingConfig: boolean;

  // 原始快照（用于脏检查）
  originalEmbeddingProvider: string;
  originalEmbeddingLocalConfig: EmbeddingFieldMap;
  originalEmbeddingOpenaiConfig: EmbeddingFieldMap;

  // setters / actions
  handleSwitchEmbeddingProvider: (provider: string) => void;
  updateEmbeddingLocalField: (fieldKey: string, value: unknown) => void;
  updateEmbeddingOpenaiField: (fieldKey: string, value: unknown) => void;
  refresh: () => Promise<void>;
  /** 保存成功后由调用方触发，用最新值刷新快照 */
  markSaved: (
    nextProvider: string,
    nextLocal: EmbeddingFieldMap,
    nextOpenai: EmbeddingFieldMap,
  ) => void;
}

export function useEmbeddingConfig(): UseEmbeddingConfigReturn {
  const { t } = useLanguage();

  const [embeddingSummary, setEmbeddingSummary] =
    useState<EmbeddingConfigSummary | null>(null);
  const [isLoadingEmbeddingConfig, setIsLoadingEmbeddingConfig] = useState(false);
  const [embeddingLocalConfig, setEmbeddingLocalConfig] = useState<EmbeddingFieldMap>(
    {},
  );
  const [embeddingOpenaiConfig, setEmbeddingOpenaiConfig] =
    useState<EmbeddingFieldMap>({});

  const [originalEmbeddingProvider, setOriginalEmbeddingProvider] = useState('');
  const [originalEmbeddingLocalConfig, setOriginalEmbeddingLocalConfig] =
    useState<EmbeddingFieldMap>({});
  const [originalEmbeddingOpenaiConfig, setOriginalEmbeddingOpenaiConfig] =
    useState<EmbeddingFieldMap>({});

  const fetchEmbeddingConfig = useCallback(async () => {
    try {
      setIsLoadingEmbeddingConfig(true);
      const summary = await embeddingConfigApi.getSummary();
      setEmbeddingSummary(summary);
      const localCfg = (summary.local_config || {}) as EmbeddingFieldMap;
      const openaiCfg = (summary.openai_config || {}) as EmbeddingFieldMap;
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

  useEffect(() => {
    fetchEmbeddingConfig();
  }, [fetchEmbeddingConfig]);

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

  const refresh = useCallback(async () => {
    await fetchEmbeddingConfig();
  }, [fetchEmbeddingConfig]);

  const markSaved = useCallback(
    (
      nextProvider: string,
      nextLocal: EmbeddingFieldMap,
      nextOpenai: EmbeddingFieldMap,
    ) => {
      setOriginalEmbeddingProvider(nextProvider);
      setOriginalEmbeddingLocalConfig(JSON.parse(JSON.stringify(nextLocal)));
      setOriginalEmbeddingOpenaiConfig(JSON.parse(JSON.stringify(nextOpenai)));
    },
    [],
  );

  return {
    embeddingSummary,
    embeddingLocalConfig,
    embeddingOpenaiConfig,
    isLoadingEmbeddingConfig,
    originalEmbeddingProvider,
    originalEmbeddingLocalConfig,
    originalEmbeddingOpenaiConfig,
    handleSwitchEmbeddingProvider,
    updateEmbeddingLocalField,
    updateEmbeddingOpenaiField,
    refresh,
    markSaved,
  };
}