import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ConfigValue } from '@/components/config';
import { useConfigDirty } from '@/contexts/ConfigDirtyContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  configApi,
  type CoreConfigOptionMeta,
  frameworkConfigApi,
  getApiErrorMessage,
} from '@/lib/api';
import {
  buildGroupSavePayload,
  classifyConfigRole,
  computeDirtySummary,
  roleToDomain,
  shouldIncludeFrameworkItem,
} from './classifyGroups';
import { buildSystemCoreSavePayload, coreConfigToFrameworkGroup } from './coreConfigAdapter';
import { DOMAIN_ORDER, type DomainId, type RawFrameworkGroup, SYSTEM_CORE_GROUP_ID } from './types';

function cloneGroup(group: RawFrameworkGroup): RawFrameworkGroup {
  return structuredClone(group);
}

function cloneGroupMap(
  source: Record<string, RawFrameworkGroup>,
): Record<string, RawFrameworkGroup> {
  const next: Record<string, RawFrameworkGroup> = {};
  for (const [key, group] of Object.entries(source)) {
    next[key] = cloneGroup(group);
  }
  return next;
}

export function useCoreFrameworkConfigs(includeSystemCore = true) {
  const { t } = useLanguage();
  const { setDirty } = useConfigDirty();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failedGroupNames, setFailedGroupNames] = useState<string[]>([]);

  const [configs, setConfigs] = useState<Record<string, RawFrameworkGroup>>({});
  const [originalConfigs, setOriginalConfigs] = useState<Record<string, RawFrameworkGroup>>({});
  const [coreOptionsMeta, setCoreOptionsMeta] = useState<Record<string, CoreConfigOptionMeta>>({});

  const loadSeqRef = useRef(0);
  const tRef = useRef(t);
  tRef.current = t;

  const loadAll = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      const seq = ++loadSeqRef.current;
      if (mode === 'initial') {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
        // 刷新前同步清空两边快照，避免刷新瞬间误亮脏状态（Skill §7.4）
        setConfigs({});
        setOriginalConfigs({});
      }
      setLoadError(null);
      setFailedGroupNames([]);

      try {
        const corePromise = includeSystemCore
          ? Promise.all([
              configApi.getCoreConfig(),
              configApi
                .getCoreConfigOptions()
                .catch(() => ({}) as Record<string, CoreConfigOptionMeta>),
            ])
          : Promise.resolve(null);

        const [coreSettled, listSettled] = await Promise.allSettled([
          corePromise,
          frameworkConfigApi.getFrameworkConfigList('GsCore'),
        ]);
        if (seq !== loadSeqRef.current) return;

        const nextConfigs: Record<string, RawFrameworkGroup> = {};
        const failed: string[] = [];

        if (includeSystemCore) {
          if (coreSettled.status === 'fulfilled' && coreSettled.value) {
            const [coreData, optionsMeta] = coreSettled.value;
            if (coreData && typeof coreData === 'object' && Object.keys(coreData).length > 0) {
              setCoreOptionsMeta(optionsMeta ?? {});
              nextConfigs[SYSTEM_CORE_GROUP_ID] = coreConfigToFrameworkGroup(
                coreData,
                optionsMeta,
                tRef.current,
              );
            }
          } else if (coreSettled.status === 'rejected') {
            failed.push(tRef.current('coreFrameworkConfig.title'));
          }
        }

        if (listSettled.status === 'fulfilled' && Array.isArray(listSettled.value)) {
          const filtered = listSettled.value.filter(shouldIncludeFrameworkItem);
          if (filtered.length > 0) {
            const detailSettled = await Promise.allSettled(
              filtered.map((item) => frameworkConfigApi.getFrameworkConfig(item.full_name)),
            );
            if (seq !== loadSeqRef.current) return;

            detailSettled.forEach((result, index) => {
              const meta = filtered[index];
              if (result.status === 'fulfilled' && result.value) {
                const detail = result.value;
                const role = classifyConfigRole(detail);
                nextConfigs[detail.id] = {
                  id: detail.id,
                  name: detail.name,
                  full_name: detail.full_name,
                  role,
                  domain: roleToDomain(role),
                  config: detail.config ?? {},
                };
              } else {
                failed.push(meta.name || meta.full_name);
              }
            });
          }
        } else if (listSettled.status === 'rejected') {
          if (Object.keys(nextConfigs).length === 0) {
            setLoadError(
              getApiErrorMessage(listSettled.reason, tRef.current('frameworkConfig.loadFailed')),
            );
            return;
          }
          failed.push(tRef.current('frameworkConfig.title'));
        }

        if (Object.keys(nextConfigs).length === 0 && failed.length > 0) {
          setLoadError(tRef.current('frameworkConfig.loadFailed'));
        } else {
          // 全部请求落地后再一次性写入 configs 与 originalConfigs，杜绝竞态误判脏
          setConfigs(nextConfigs);
          setOriginalConfigs(cloneGroupMap(nextConfigs));
          setFailedGroupNames(failed);
        }
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setLoadError(getApiErrorMessage(err, tRef.current('frameworkConfig.loadFailed')));
      } finally {
        if (seq === loadSeqRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [includeSystemCore],
  );

  useEffect(() => {
    void loadAll('initial');
  }, [loadAll]);

  const dirtySummary = useMemo(
    () => computeDirtySummary(configs, originalConfigs),
    [configs, originalConfigs],
  );

  useEffect(() => {
    setDirty(dirtySummary.isDirty);
  }, [dirtySummary.isDirty, setDirty]);

  useEffect(() => {
    return () => {
      setDirty(false);
    };
  }, [setDirty]);

  const groupsList = useMemo(() => Object.values(configs), [configs]);

  const groupsByDomain = useMemo(() => {
    const map: Record<DomainId, RawFrameworkGroup[]> = {
      core: [],
      runtime: [],
      database: [],
      media: [],
      interaction: [],
      identity: [],
    };
    for (const group of groupsList) {
      map[group.domain].push(group);
    }
    for (const domain of DOMAIN_ORDER) {
      map[domain].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }
    return map;
  }, [groupsList]);

  const updateField = useCallback(
    (groupId: string, fieldKey: string, value: ConfigValue | unknown) => {
      setConfigs((prev) => {
        const group = prev[groupId];
        const field = group?.config[fieldKey];
        if (!group || !field) return prev;
        return {
          ...prev,
          [groupId]: {
            ...group,
            config: {
              ...group.config,
              [fieldKey]: {
                ...field,
                value,
              },
            },
          },
        };
      });
    },
    [],
  );

  const batchUpdateFields = useCallback((groupId: string, patch: Record<string, unknown>) => {
    setConfigs((prev) => {
      const group = prev[groupId];
      if (!group) return prev;
      const nextGroupConfig = { ...group.config };
      let mutated = false;
      for (const [fieldKey, value] of Object.entries(patch)) {
        const existing = nextGroupConfig[fieldKey];
        if (!existing) continue;
        nextGroupConfig[fieldKey] = {
          ...existing,
          value,
        };
        mutated = true;
      }
      if (!mutated) return prev;
      return {
        ...prev,
        [groupId]: {
          ...group,
          config: nextGroupConfig,
        },
      };
    });
  }, []);

  const resetField = useCallback(
    (groupId: string, fieldKey: string) => {
      const origItem = originalConfigs[groupId]?.config[fieldKey];
      if (!origItem) return;
      updateField(groupId, fieldKey, structuredClone(origItem.value));
    },
    [originalConfigs, updateField],
  );

  const resetGroup = useCallback(
    (groupId: string) => {
      const origGroup = originalConfigs[groupId];
      if (!origGroup) return;
      setConfigs((prev) => ({
        ...prev,
        [groupId]: cloneGroup(origGroup),
      }));
    },
    [originalConfigs],
  );

  const resetAll = useCallback(() => {
    setConfigs(cloneGroupMap(originalConfigs));
  }, [originalConfigs]);

  const refresh = useCallback(() => loadAll('refresh'), [loadAll]);

  const saveChanged = useCallback(async () => {
    if (!dirtySummary.isDirty || isSaving) return false;

    setIsSaving(true);
    const savedGroupIds: string[] = [];
    let firstErrorMsg: string | null = null;

    try {
      for (const groupId of dirtySummary.changedGroupIds) {
        const group = configs[groupId];
        if (!group) continue;

        try {
          if (groupId === SYSTEM_CORE_GROUP_ID) {
            const corePayload = buildSystemCoreSavePayload(group, originalConfigs[groupId]);
            const res = await configApi.setCoreConfig(corePayload);
            if (!res || typeof res.status !== 'number' || res.status === 0) {
              savedGroupIds.push(groupId);
            } else if (!firstErrorMsg) {
              firstErrorMsg = getApiErrorMessage(res, t('coreFrameworkConfig.saveFailed'));
            }
          } else {
            const payload = buildGroupSavePayload(group, originalConfigs[groupId]);
            const res = await frameworkConfigApi.updateFrameworkConfig(group.full_name, payload);
            if (!res || typeof res.status !== 'number' || res.status === 0) {
              savedGroupIds.push(groupId);
            } else if (!firstErrorMsg) {
              firstErrorMsg = getApiErrorMessage(res, t('frameworkConfig.saveFailed'));
            }
          }
        } catch (err) {
          if (!firstErrorMsg) {
            firstErrorMsg = getApiErrorMessage(err, t('frameworkConfig.saveFailed'));
          }
        }
      }

      if (savedGroupIds.length > 0) {
        setOriginalConfigs((prev) => {
          const next = { ...prev };
          for (const id of savedGroupIds) {
            if (configs[id]) {
              next[id] = cloneGroup(configs[id]);
            }
          }
          return next;
        });
      }

      if (firstErrorMsg) {
        toast.error(firstErrorMsg);
        return false;
      }

      if (savedGroupIds.includes(SYSTEM_CORE_GROUP_ID)) {
        toast.success(t('coreFrameworkConfig.configSaved'));
      } else {
        toast.success(t('frameworkConfig.configSaved'));
      }
      return true;
    } finally {
      setIsSaving(false);
    }
  }, [configs, dirtySummary.changedGroupIds, dirtySummary.isDirty, isSaving, originalConfigs, t]);

  return {
    isLoading,
    isRefreshing,
    isSaving,
    loadError,
    failedGroupNames,
    configs,
    originalConfigs,
    coreOptionsMeta,
    groupsList,
    groupsByDomain,
    dirtySummary,
    updateField,
    batchUpdateFields,
    resetField,
    resetGroup,
    resetAll,
    refresh,
    saveChanged,
  };
}
