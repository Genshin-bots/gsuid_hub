import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, ChevronDown, Copy, Eye, Loader2, Lock, Package, Plus, Puzzle, RefreshCw, Save, Search, Sparkles, Tags, Trash2, UserRound, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import {
  capabilityAgentsApi,
  AgentNodeItem,
  AgentNodeSource,
  CapabilityAgentTool,
} from '@/lib/api';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/** 能力代理页仅展示 builtin / plugin / user；persona 走人格配置页 */
const SOURCES: AgentNodeSource[] = ['builtin', 'plugin', 'user'];
const NODE_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
// 框架内置能力族；capability_domain 族名可自由追加，故 TagInput 不做白名单限制
const BUILTIN_TOOL_PACKS = ['task_basics', 'dynamic'];

const EMPTY_FORM = {
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

type FormState = typeof EMPTY_FORM;
type DialogMode = 'create' | 'edit' | 'view';

function sourceClass(source: AgentNodeSource) {
  if (source === 'builtin') return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
  if (source === 'plugin') return 'bg-violet-500/15 text-violet-600 border-violet-500/30';
  return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
}

function toForm(node?: AgentNodeItem | null, base?: string): FormState {
  if (!node) return { ...EMPTY_FORM, match_keywords: [], tool_packs: ['task_basics'], tool_names: [], base: base || '' };
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

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (value: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');

  const addTags = useCallback((raw: string) => {
    const next = raw.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
    if (next.length === 0) return;
    onChange(Array.from(new Set([...value, ...next])));
    setDraft('');
  }, [onChange, value]);

  return (
    <div className="rounded-md border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => onChange(value.filter((item) => item !== tag))}>×</button>
          </Badge>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => addTags(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            addTags(draft);
          }
        }}
        placeholder={placeholder}
        className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

interface ToolMultiSelectDropdownProps {
  tools: CapabilityAgentTool[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function ToolMultiSelectDropdown({ tools, value, onChange, disabled, t }: ToolMultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pluginFilter, setPluginFilter] = useState('all');

  const selectedSet = useMemo(() => new Set(value), [value]);
  const toolMap = useMemo(() => {
    return tools.reduce<Record<string, CapabilityAgentTool>>((acc, tool) => {
      acc[tool.name] = tool;
      return acc;
    }, {});
  }, [tools]);

  const pluginOptions = useMemo(() => {
    return Array.from(new Set(tools.map((tool) => tool.plugin || 'core'))).sort((a, b) => a.localeCompare(b));
  }, [tools]);

  const groupedTools = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tools
      .filter((tool) => pluginFilter === 'all' || (tool.plugin || 'core') === pluginFilter)
      .filter((tool) => !keyword || [tool.name, tool.description, tool.plugin, tool.category].join('\n').toLowerCase().includes(keyword))
      .reduce<Record<string, CapabilityAgentTool[]>>((acc, tool) => {
        const plugin = tool.plugin || 'core';
        acc[plugin] = acc[plugin] || [];
        acc[plugin].push(tool);
        return acc;
      }, {});
  }, [pluginFilter, query, tools]);

  const toggleTool = (toolName: string) => {
    if (disabled) return;
    onChange(selectedSet.has(toolName)
      ? value.filter((name) => name !== toolName)
      : [...value, toolName]);
  };

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((toolName) => {
            const tool = toolMap[toolName];
            return (
              <TooltipProvider key={toolName} delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="max-w-full cursor-help gap-1">
                      <Wrench className="h-3 w-3 shrink-0" />
                      <span className="truncate font-mono">{toolName}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="whitespace-pre-wrap text-xs">{tool?.description || toolName}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
          {t('aiCapabilityAgents.tools.noSelected')}
        </div>
      )}

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between gap-3"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="truncate text-left">
            {disabled ? t('aiCapabilityAgents.tools.readonlyDisabled') : t('aiCapabilityAgents.tools.openDropdown').replace('{count}', String(value.length)).replace('{{count}}', String(value.length))}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
        </Button>

        {!disabled && open && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-50 rounded-md border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('aiCapabilityAgents.tools.searchPlaceholder')} className="pl-9" />
                </div>
                <Select value={pluginFilter} onValueChange={setPluginFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('aiCapabilityAgents.tools.allPlugins')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('aiCapabilityAgents.tools.allPlugins')}</SelectItem>
                    {pluginOptions.map((plugin) => (
                      <SelectItem key={plugin} value={plugin}>{plugin}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div
              className="max-h-[430px] overflow-y-scroll overscroll-contain pr-1"
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="space-y-4 p-3">
                {Object.keys(groupedTools).length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">{t('aiCapabilityAgents.tools.noMatched')}</div>
                ) : Object.entries(groupedTools).map(([plugin, pluginTools]) => (
                  <div key={plugin} className="space-y-2">
                    <div className="sticky top-0 z-10 flex items-center justify-between rounded-md bg-popover/95 px-3 py-2 backdrop-blur">
                      <Label className="font-semibold">{plugin}</Label>
                      <Badge variant="outline" className="ml-3">{pluginTools.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {pluginTools.map((tool) => {
                        const checked = selectedSet.has(tool.name);
                        return (
                          <div
                            role="button"
                            tabIndex={0}
                            key={tool.name}
                            onClick={() => toggleTool(tool.name)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                toggleTool(tool.name);
                              }
                            }}
                            className={cn(
                              'flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/40',
                              checked ? 'border-primary/50 bg-primary/10' : 'border-border/50',
                            )}
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggleTool(tool.name)} onClick={(event) => event.stopPropagation()} className="mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-sm font-semibold">{tool.name}</span>
                                <Badge variant="outline" className="text-[10px]">{tool.category}</Badge>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tool.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AICapabilityAgentsPage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';

  const [activeSource, setActiveSource] = useState<AgentNodeSource>('builtin');
  /** 插件 Tab 二级筛选：`__all__` = 全部插件；其它值为 list 接口里的 plugin 字段 */
  const [selectedPlugin, setSelectedPlugin] = useState<string>('__all__');
  const [profiles, setProfiles] = useState<AgentNodeItem[]>([]);
  const [tools, setTools] = useState<CapabilityAgentTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('view');
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY_FORM, match_keywords: [], tool_packs: ['task_basics'], tool_names: [] }));
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
        if (profile.source === 'builtin' || profile.source === 'plugin' || profile.source === 'user') {
          acc[profile.source] += 1;
        }
        return acc;
      },
      { builtin: 0, plugin: 0, user: 0 } as Record<'builtin' | 'plugin' | 'user', number>,
    );
  }, [profiles]);

  /** 按 list 接口每项的 plugin 字段聚合（仅 source=plugin） */
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

  // 列表刷新后若当前选中的插件已不存在，回退到「全部」
  useEffect(() => {
    if (selectedPlugin === '__all__') return;
    if (!pluginFilterMeta.counts.has(selectedPlugin)) {
      setSelectedPlugin('__all__');
    }
  }, [pluginFilterMeta, selectedPlugin]);

  const sourceOptions = useMemo(() => SOURCES.map((source) => {
    if (source !== 'plugin') {
      return {
        value: source,
        label: `${t(`aiCapabilityAgents.sources.${source}`)} ${sourceCounts[source]}`,
        icon: source === 'builtin'
          ? <Package className="h-4 w-4" />
          : <UserRound className="h-4 w-4" />,
      };
    }

    const isAll = selectedPlugin === '__all__';
    const pluginCount = isAll
      ? sourceCounts.plugin
      : (pluginFilterMeta.counts.get(selectedPlugin) || 0);
    const label = isAll
      ? `${t('aiCapabilityAgents.sources.plugin')} ${pluginCount}`
      : t('aiCapabilityAgents.pluginFilterLabel', { name: selectedPlugin, count: pluginCount });

    return {
      value: source,
      label,
      // 选中具体插件时，主 Tab 也展示该插件 ICON
      icon: isAll
        ? <Puzzle className="h-4 w-4" />
        : <PluginIcon pluginName={selectedPlugin} className="h-4 w-4" />,
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
  }), [pluginFilterMeta, selectedPlugin, sourceCounts, t]);

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return profiles.filter((profile) => {
      // 能力代理页不展示 persona 投影节点
      if (profile.source === 'persona') return false;
      if (profile.source !== activeSource) return false;
      if (
        activeSource === 'plugin'
        && selectedPlugin !== '__all__'
        && (profile.plugin || '').trim() !== selectedPlugin
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

  const openDialog = (mode: DialogMode, profile?: AgentNodeItem, base?: string) => {
    setDialogMode(mode);
    if (mode === 'create' && profile) {
      setForm({ ...toForm(profile, base || profile.node_id), node_id: '', display_name: '', base: base || profile.node_id });
    } else {
      setForm(toForm(profile, base));
    }
    setDialogOpen(true);
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateForm = () => {
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
  };

  const saveProfile = async () => {
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
        await capabilityAgentsApi.create({ ...payload, node_id: form.node_id.trim(), base: form.base || undefined });
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
  };

  const deleteProfile = async () => {
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
  };

  const isReadOnly = dialogMode === 'view' || (dialogMode === 'edit' && activeSource !== 'user');
  const dialogTitle = dialogMode === 'create'
    ? t('aiCapabilityAgents.dialog.createTitle')
    : dialogMode === 'edit'
      ? t('aiCapabilityAgents.dialog.editTitle')
      : t('aiCapabilityAgents.dialog.viewTitle');

  return (
    <PinnedPage
      header={
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Bot className="w-8 h-8 shrink-0" />
              {t('aiCapabilityAgents.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiCapabilityAgents.description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
            <Button variant="outline" onClick={loadData} disabled={isLoading} className="gap-2">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t('common.refresh') || '刷新'}
            </Button>
            <Button onClick={() => openDialog('create')} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('aiCapabilityAgents.newProfile')}
            </Button>
          </div>
        </div>
      }
      toolbar={
        /* 来源筛选 + 搜索 */
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <TabButtonGroup
              options={sourceOptions}
              value={activeSource}
              onValueChange={(value) => setActiveSource(value as AgentNodeSource)}
              className="w-max"
            />
          </div>
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('aiCapabilityAgents.searchPlaceholder')} className="pl-9" />
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('common.loading') || 'Loading...'}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Bot className="mb-4 h-12 w-12 opacity-50" />
            <p>{t('aiCapabilityAgents.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="glass-card-grid grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredProfiles.map((profile) => {
            const locked = profile.source !== 'user';
            return (
              <Card key={profile.node_id} className={cn('group transition-all hover:border-primary/50 hover:shadow-md', isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                        <span className="truncate">{profile.display_name}</span>
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">{profile.node_id}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={sourceClass(profile.source)}>{profile.source}</Badge>
                      {locked && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild><Lock className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                            <TooltipContent>{t('aiCapabilityAgents.readonlyTip')}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="min-h-[3rem] text-sm text-muted-foreground line-clamp-3">{profile.when_to_use || t('aiCapabilityAgents.noUsage')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1"><Wrench className="h-3 w-3" />{t('aiCapabilityAgents.toolCount', { count: profile.tool_names?.length || 0 })}</Badge>
                    <Badge variant="secondary" className="gap-1"><Tags className="h-3 w-3" />{profile.match_keywords?.length || 0}</Badge>
                    {(profile.tool_packs || []).map((pack) => (
                      <Badge key={pack} variant="outline" className="gap-1 text-[10px]"><Package className="h-3 w-3" />{pack}</Badge>
                    ))}
                  </div>
                  {profile.match_keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.match_keywords.slice(0, 6).map((keyword) => <Badge key={keyword} variant="outline" className="text-[10px]">{keyword}</Badge>)}
                      {profile.match_keywords.length > 6 && <Badge variant="outline" className="text-[10px]">+{profile.match_keywords.length - 6}</Badge>}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => openDialog('view', profile)} className="gap-1.5"><Eye className="h-4 w-4" />{t('common.view') || '查看'}</Button>
                    {profile.source === 'user' && <Button variant="outline" size="sm" onClick={() => openDialog('edit', profile)}>{t('common.edit')}</Button>}
                    <Button variant="outline" size="sm" onClick={() => openDialog('create', profile, profile.node_id)} className="gap-1.5"><Copy className="h-4 w-4" />{t('aiCapabilityAgents.copyAsNew')}</Button>
                    {profile.source === 'user' && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(profile)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-[1100px]">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />{dialogTitle}</DialogTitle>
            <DialogDescription>{form.base ? t('aiCapabilityAgents.dialog.baseDesc', { base: form.base }) : t('aiCapabilityAgents.dialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-6 p-6 lg:grid-cols-2">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t('aiCapabilityAgents.fields.nodeId')}</Label>
                    <Input value={form.node_id} onChange={(event) => updateForm('node_id', event.target.value)} disabled={dialogMode !== 'create'} placeholder="finance_agent" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('aiCapabilityAgents.fields.displayName')}</Label>
                    <Input value={form.display_name} onChange={(event) => updateForm('display_name', event.target.value)} disabled={isReadOnly} placeholder={t('aiCapabilityAgents.placeholders.displayName')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('aiCapabilityAgents.fields.whenToUse')}</Label>
                  <Textarea value={form.when_to_use} onChange={(event) => updateForm('when_to_use', event.target.value)} disabled={isReadOnly} rows={3} placeholder={t('aiCapabilityAgents.placeholders.whenToUse')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('aiCapabilityAgents.fields.prompt')}</Label>
                  <Textarea value={form.prompt} onChange={(event) => updateForm('prompt', event.target.value)} disabled={isReadOnly} rows={12} placeholder={t('aiCapabilityAgents.placeholders.prompt')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('aiCapabilityAgents.fields.matchKeywords')}</Label>
                  <TagInput value={form.match_keywords} onChange={(value) => updateForm('match_keywords', value)} placeholder={t('aiCapabilityAgents.placeholders.matchKeywords')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('aiCapabilityAgents.fields.toolPacks')}</Label>
                  <p className="text-xs text-muted-foreground">{t('aiCapabilityAgents.toolPacksHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    {BUILTIN_TOOL_PACKS.map((pack) => {
                      const active = form.tool_packs.includes(pack);
                      return (
                        <Button
                          key={pack}
                          type="button"
                          size="sm"
                          variant={active ? 'default' : 'outline'}
                          disabled={isReadOnly}
                          onClick={() => updateForm('tool_packs', active ? form.tool_packs.filter((item) => item !== pack) : [...form.tool_packs, pack])}
                        >
                          {pack}
                        </Button>
                      );
                    })}
                  </div>
                  <TagInput
                    value={form.tool_packs.filter((pack) => !BUILTIN_TOOL_PACKS.includes(pack))}
                    onChange={(value) => updateForm('tool_packs', [...form.tool_packs.filter((pack) => BUILTIN_TOOL_PACKS.includes(pack)), ...value])}
                    placeholder={t('aiCapabilityAgents.placeholders.toolPacks')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('aiCapabilityAgents.fields.toolQuery')}</Label>
                  <Input value={form.tool_query} onChange={(event) => updateForm('tool_query', event.target.value)} disabled={isReadOnly} placeholder={t('aiCapabilityAgents.placeholders.toolQuery')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('aiCapabilityAgents.fields.boundaryOverride')}</Label>
                  <Textarea value={form.boundary_override} onChange={(event) => updateForm('boundary_override', event.target.value)} disabled={isReadOnly} rows={3} placeholder={t('aiCapabilityAgents.placeholders.boundaryOverride')} />
                </div>
              </div>

              <div className="space-y-5">
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="text-base">{t('aiCapabilityAgents.preview.title')}</CardTitle>
                    <CardDescription>{t('aiCapabilityAgents.preview.description')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none rounded-lg bg-muted/40 p-4 text-foreground dark:prose-invert max-h-64 overflow-auto">
                      <ReactMarkdown>{form.prompt || t('aiCapabilityAgents.preview.empty')}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{t('aiCapabilityAgents.fields.toolNames')}</CardTitle>
                        <CardDescription>{t('aiCapabilityAgents.tools.description')}</CardDescription>
                      </div>
                      <Badge variant="secondary">{form.tool_names.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                      🔒 {t('aiCapabilityAgents.tools.alwaysMounted')}
                    </div>
                    <ToolMultiSelectDropdown
                      tools={tools}
                      value={form.tool_names}
                      onChange={(value) => updateForm('tool_names', value)}
                      disabled={isReadOnly}
                      t={t}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            {dialogMode !== 'view' && <Button onClick={saveProfile} disabled={isSaving} className="gap-2">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t('common.save')}</Button>}
            {dialogMode !== 'create' && <Button variant="secondary" onClick={() => openDialog('create', profiles.find((item) => item.node_id === form.node_id), form.node_id)} className="gap-2"><Copy className="h-4 w-4" />{t('aiCapabilityAgents.copyAsNew')}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiCapabilityAgents.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiCapabilityAgents.deleteDialog.description', { name: deleteTarget?.display_name || '' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProfile} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? t('aiCapabilityAgents.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PinnedPage>
  );
}
