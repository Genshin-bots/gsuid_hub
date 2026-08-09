/**
 * useFrameworkConfig
 *
 * 负责「AI 基础配置（GsCore AI）」相关的状态：
 * - configList：来自 `/api/framework_config/list` 的列表（已过滤「人设」）
 * - configs：按 id 索引的详情字典 { id -> { name, full_name, config } }
 * - isLoading / isLoadingDetail：列表 / 详情加载状态
 * - originalConfig：保存前的原始快照，用于脏检查
 * - updateConfigValue(configId, fieldKey, value)：更新某个字段的 value（不触发重新拉取）
 *
 * 由 [`src/pages/AIConfigPage.tsx`](src/pages/AIConfigPage.tsx) 调用，
 * 它自身不渲染任何 UI。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  frameworkConfigApi,
  type FrameworkConfigListItem,
  type PluginConfigItem,
} from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LocalFrameworkConfig } from '../types';
import type { ConfigValue } from '@/components/config';

export interface UseFrameworkConfigReturn {
  /** 列表（已过滤「人设」配置） */
  configList: FrameworkConfigListItem[];
  /** 详情字典（按 config.id） */
  configs: Record<string, LocalFrameworkConfig>;
  /** 列表是否仍在首次加载 */
  isLoading: boolean;
  /** 详情拉取中 */
  isLoadingDetail: boolean;
  /** 保存时的提交态 */
  isSaving: boolean;
  /** 是否已经完成过首次初始化（用于保存流的「脏检查基线」） */
  hasInitialized: boolean;
  /** 保存前的原始快照（与 configs 一一对应） */
  originalConfig: Record<string, LocalFrameworkConfig>;
  /** 主动重新拉取列表 + 详情 */
  refresh: () => Promise<void>;
  /** 更新某个字段 value（不会触发重新拉取） */
  updateConfigValue: (configId: string, fieldKey: string, value: ConfigValue) => void;
  /**
   * 用新的 configs 重置 originalConfig 快照（保存成功后由调用方触发）。
   * 仅更新快照，不改动当前编辑态 configs。
   */
  markSaved: (nextConfigs: Record<string, LocalFrameworkConfig>) => void;
  /**
   * 原子地同步 configs 与 originalConfig（保存时剥离冲突字段后使用，
   * 避免 updateConfigValue + markSaved 双 setState 不一致）。
   */
  applyConfigsAndMarkSaved: (
    nextConfigs: Record<string, LocalFrameworkConfig>,
  ) => void;
  /** 手动设置 isSaving（保存流使用） */
  setIsSaving: (saving: boolean) => void;
}

export function useFrameworkConfig(): UseFrameworkConfigReturn {
  const { t } = useLanguage();

  const [configList, setConfigList] = useState<FrameworkConfigListItem[]>([]);
  const [configs, setConfigs] = useState<Record<string, LocalFrameworkConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<
    Record<string, LocalFrameworkConfig>
  >({});
  const [hasInitialized, setHasInitialized] = useState(false);

  const fetchedConfigNamesRef = useRef<Set<string>>(new Set());

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

  // 首次加载列表
  useEffect(() => {
    fetchConfigList();
  }, [fetchConfigList]);

  // 列表加载完成后，依次拉取每个详情（去重）
  useEffect(() => {
    if (configList.length === 0) return;
    configList.forEach((config) => {
      if (
        !configs[config.id] &&
        !fetchedConfigNamesRef.current.has(config.full_name)
      ) {
        fetchedConfigNamesRef.current.add(config.full_name);
        fetchConfigDetail(config.full_name);
      }
    });
  }, [configList, configs, fetchConfigDetail]);

  // 所有详情加载完毕 → 初始化原始快照
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

  const markSaved = useCallback(
    (nextConfigs: Record<string, LocalFrameworkConfig>) => {
      setOriginalConfig(JSON.parse(JSON.stringify(nextConfigs)));
    },
    [],
  );

  const applyConfigsAndMarkSaved = useCallback(
    (nextConfigs: Record<string, LocalFrameworkConfig>) => {
      const cloned = JSON.parse(JSON.stringify(nextConfigs)) as Record<
        string,
        LocalFrameworkConfig
      >;
      setConfigs(cloned);
      setOriginalConfig(JSON.parse(JSON.stringify(cloned)));
    },
    [],
  );

  const refresh = useCallback(async () => {
    await fetchConfigList();
    fetchedConfigNamesRef.current.clear();
    setConfigs({});
    setHasInitialized(false);
  }, [fetchConfigList]);

  return {
    configList,
    configs,
    isLoading,
    isLoadingDetail,
    isSaving,
    hasInitialized,
    originalConfig,
    refresh,
    updateConfigValue,
    markSaved,
    applyConfigsAndMarkSaved,
    setIsSaving,
  };
}
