import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Puzzle, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { PluginIcon } from '@/components/ui/plugin-icon';
import type { TabButtonOption } from '@/components/ui/TabButtonGroup';
import {
  capabilityAgentsApi,
  type AgentNodeItem,
  type AgentNodeSource,
  type CapabilityAgentTool,
} from '@/lib/api';

const SOURCES: AgentNodeSource[] = ['builtin', 'plugin', 'user'];
export const NODE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
export const BUILTIN_TOOL_PACKS = ['task_basics', 'dynamic'];

export const EMPTY_CAPABILITY_FORM = {
  node_id: '',
  display_name: '',
  when_to_use: '',
  prompt: '',
  match_keywords: [] as string[],
  tool_packs: ['task_basics'] as string[],
  tool_names: [] as string[],
  tool_query: '',
  boundary_override: '',
  base: '',
};

export type CapabilityFormState = typeof EMPTY_CAPABILITY_FORM;
export type CapabilityDialogMode = 'create' | 'edit' | 'view';

export function toCapabilityForm(node?: AgentNodeItem | null, base?: string): CapabilityFormState {
  if (!node) {
    return {
      ...EMPTY_CAPABILITY_FORM,
      match_keywords: [],
      tool_packs: ['task_basics'],
      tool_names: [],
      base: base || '',
    };
  }
  return {
    node_id: node.node_id,
    display_name: node.display_name,
    when_to_use: node.when_to_use || '',
    prompt: node.prompt || '',
    match_keywords: node.match_keywords || [],
    tool_packs: node.tool_packs || [],
    tool_names: node.tool_names || [],
    tool_query: node.tool_query || '',
    boundary_override: node.boundary_override || '',
    base: base || '',
  };
}

export function useCapabilityAgents() {
  const { t } = useLanguage();

  const [activeSource, setActiveSource] = useState<AgentNodeSource>('builtin');
  const [selectedPlugin, setSelectedPlugin] = useState<string>('__all__');
  const [profiles, setProfiles] = useState<AgentNodeItem[]>([]);
  const [tools, setTools] = useState<CapabilityAgentTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<CapabilityDialogMode>('view');
  const [form, setForm] = useState<CapabilityFormState>(() => ({
    ...EMPTY_CAPABILITY_FORM,
    match_keywords: [],
    tool_packs: ['task_basics'],
    tool_names: [],
  }));
  const [deleteTarget, setDeleteTarget] = useState<AgentNodeItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [profileData, toolData] = await Promise.all([
        capabilityAgentsApi.getList(),
        capabilityAgentsApi.getAvailableTools(),
      ]);
      setProfiles(profileData.items || []);
      setTools(toolData.items || []);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('aiCapabilityAgents.loadFailed');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sourceCounts = useMemo(() => {
    return profiles.reduce(
      (acc, profile) => {
        if (
          profile.source === 'builtin' ||
          profile.source === 'plugin' ||
          profile.source === 'user'
        ) {
          acc[profile.source] += 1;
        }
        return acc;
      },
      { builtin: 0, plugin: 0, user: 0 } as Record<'builtin' | 'plugin' | 'user', number>,
    );
  }, [profiles]);

  const pluginFilterMeta = useMemo(() => {
    const counts = new Map<string, number>();
    for (const profile of profiles) {
      if (profile.source !== 'plugin') continue;
      const name = (profile.plugin || '').trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const names = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
    return { names, counts };
  }, [profiles]);

  useEffect(() => {
    if (selectedPlugin === '__all__') return;
    if (!pluginFilterMeta.counts.has(selectedPlugin)) {
      setSelectedPlugin('__all__');
    }
  }, [pluginFilterMeta, selectedPlugin]);

  const sourceOptions: TabButtonOption[] = useMemo(
    () =>
      SOURCES.map((source) => {
        if (source !== 'plugin') {
          return {
            value: source,
            label: `${t(`aiCapabilityAgents.sources.${source}`)} ${sourceCounts[source]}`,
            icon:
              source === 'builtin' ? (
                <Package className="h-4 w-4" />
              ) : (
                <UserRound className="h-4 w-4" />
              ),
          };
        }

        const isAll = selectedPlugin === '__all__';
        const pluginCount = isAll
          ? sourceCounts.plugin
          : pluginFilterMeta.counts.get(selectedPlugin) || 0;
        const label = isAll
          ? `${t('aiCapabilityAgents.sources.plugin')} ${pluginCount}`
          : t('aiCapabilityAgents.pluginFilterLabel', { name: selectedPlugin, count: pluginCount });

        return {
          value: source,
          label,
          icon: isAll ? (
            <Puzzle className="h-4 w-4" />
          ) : (
            <PluginIcon pluginName={selectedPlugin} className="h-4 w-4" />
          ),
          dropdown: {
            value: selectedPlugin,
            onValueChange: setSelectedPlugin,
            allValue: '__all__',
            align: 'start' as const,
            items: [
              {
                value: '__all__',
                label: `${t('aiCapabilityAgents.allPlugins')} (${sourceCounts.plugin})`,
                icon: <Puzzle className="h-4 w-4 shrink-0" />,
              },
              ...pluginFilterMeta.names.map((name) => ({
                value: name,
                label: `${name} (${pluginFilterMeta.counts.get(name) || 0})`,
                icon: <PluginIcon pluginName={name} className="h-4 w-4" />,
              })),
            ],
          },
        };
      }),
    [pluginFilterMeta, selectedPlugin, sourceCounts, t],
  );

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (profile.source === 'persona') return false;
      if (profile.source !== activeSource) return false;
      if (
        activeSource === 'plugin' &&
        selectedPlugin !== '__all__' &&
        (profile.plugin || '').trim() !== selectedPlugin
      ) {
        return false;
      }
      if (!query) return true;
      return [
        profile.node_id,
        profile.display_name,
        profile.when_to_use,
        profile.prompt,
        profile.plugin,
        ...(profile.match_keywords || []),
      ]
        .join('\n')
        .toLowerCase()
        .includes(query);
    });
  }, [activeSource, profiles, searchQuery, selectedPlugin]);

  const openDialog = useCallback(
    (mode: CapabilityDialogMode, profile?: AgentNodeItem, base?: string) => {
      setDialogMode(mode);
      if (mode === 'create' && profile) {
        setForm({
          ...toCapabilityForm(profile, base || profile.node_id),
          node_id: '',
          display_name: '',
          base: base || profile.node_id,
        });
      } else {
        setForm(toCapabilityForm(profile, base));
      }
      setDialogOpen(true);
    },
    [],
  );

  const updateForm = useCallback(
    <K extends keyof CapabilityFormState>(key: K, value: CapabilityFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const validateForm = useCallback(() => {
    if (dialogMode === 'create' && !NODE_ID_PATTERN.test(form.node_id.trim())) {
      toast.error(t('aiCapabilityAgents.validation.nodeId'));
      return false;
    }
    if (!form.display_name.trim()) {
      toast.error(t('aiCapabilityAgents.validation.displayName'));
      return false;
    }
    if (!form.prompt.trim()) {
      toast.error(t('aiCapabilityAgents.validation.prompt'));
      return false;
    }
    return true;
  }, [dialogMode, form.display_name, form.node_id, form.prompt, t]);

  const saveProfile = useCallback(async () => {
    if (!validateForm()) return;
    try {
      setIsSaving(true);
      const payload = {
        display_name: form.display_name.trim(),
        when_to_use: form.when_to_use.trim(),
        prompt: form.prompt.trim(),
        match_keywords: form.match_keywords,
        tool_packs: form.tool_packs,
        tool_names: form.tool_names,
        tool_query: form.tool_query.trim(),
        boundary_override: form.boundary_override.trim(),
      };
      if (dialogMode === 'create') {
        await capabilityAgentsApi.create({
          ...payload,
          node_id: form.node_id.trim(),
          base: form.base || undefined,
        });
        toast.success(t('aiCapabilityAgents.createSuccess'));
      } else {
        await capabilityAgentsApi.update(form.node_id, payload);
        toast.success(t('aiCapabilityAgents.updateSuccess'));
      }
      setDialogOpen(false);
      await loadData();
      setActiveSource('user');
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('aiCapabilityAgents.saveFailed');
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }, [dialogMode, form, loadData, t, validateForm]);

  const deleteProfile = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await capabilityAgentsApi.delete(deleteTarget.node_id);
      toast.success(t('aiCapabilityAgents.deleteSuccess'));
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('aiCapabilityAgents.deleteFailed');
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, loadData, t]);

  const isReadOnly = dialogMode === 'view' || (dialogMode === 'edit' && activeSource !== 'user');

  return {
    activeSource,
    setActiveSource,
    selectedPlugin,
    setSelectedPlugin,
    profiles,
    tools,
    isLoading,
    isSaving,
    isDeleting,
    searchQuery,
    setSearchQuery,
    dialogOpen,
    setDialogOpen,
    dialogMode,
    form,
    updateForm,
    deleteTarget,
    setDeleteTarget,
    loadData,
    sourceOptions,
    filteredProfiles,
    openDialog,
    saveProfile,
    deleteProfile,
    isReadOnly,
  };
}

export type UseCapabilityAgentsReturn = ReturnType<typeof useCapabilityAgents>;
