import { useCallback, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  ChevronDown,
  Copy,
  Eye,
  Loader2,
  Lock,
  Package,
  Plus,
  Puzzle,
  Save,
  Search,
  Sparkles,
  Tags,
  Trash2,
  Wrench,
} from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { AgentNodeItem, AgentNodeSource, CapabilityAgentTool } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchableMenu } from '@/components/ui/searchable-menu';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { BUILTIN_TOOL_PACKS, type UseCapabilityAgentsReturn } from './useCapabilityAgents';

function sourceClass(source: AgentNodeSource) {
  if (source === 'builtin') return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
  if (source === 'plugin') return 'bg-violet-500/15 text-violet-600 border-violet-500/30';
  return 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  const addTags = useCallback(
    (raw: string) => {
      const next = raw
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      if (next.length === 0) return;
      onChange(Array.from(new Set([...value, ...next])));
      setDraft('');
    },
    [onChange, value],
  );

  return (
    <div className="rounded-md border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
      <div className="mb-2 flex flex-wrap gap-2">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              ×
            </button>
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

function ToolMultiSelectDropdown({
  tools,
  value,
  onChange,
  disabled,
  t,
}: ToolMultiSelectDropdownProps) {
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
    return Array.from(new Set(tools.map((tool) => tool.plugin || 'core'))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [tools]);

  const groupedTools = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tools
      .filter((tool) => pluginFilter === 'all' || (tool.plugin || 'core') === pluginFilter)
      .filter(
        (tool) =>
          !keyword ||
          [tool.name, tool.description, tool.plugin, tool.category]
            .join('\n')
            .toLowerCase()
            .includes(keyword),
      )
      .reduce<Record<string, CapabilityAgentTool[]>>((acc, tool) => {
        const plugin = tool.plugin || 'core';
        acc[plugin] = acc[plugin] || [];
        acc[plugin].push(tool);
        return acc;
      }, {});
  }, [pluginFilter, query, tools]);

  const toggleTool = (toolName: string) => {
    if (disabled) return;
    onChange(
      selectedSet.has(toolName) ? value.filter((name) => name !== toolName) : [...value, toolName],
    );
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
            {disabled
              ? t('aiCapabilityAgents.tools.readonlyDisabled')
              : t('aiCapabilityAgents.tools.openDropdown', { count: value.length })}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
          />
        </Button>

        {!disabled && open && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-50 rounded-md border bg-popover text-popover-foreground shadow-lg">
            <div className="border-b p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('aiCapabilityAgents.tools.searchPlaceholder')}
                    className="pl-9"
                  />
                </div>
                <SearchableMenu
                  appearance="field"
                  width="trigger"
                  align="end"
                  className="h-10"
                  placeholder={t('aiCapabilityAgents.tools.allPlugins')}
                  value={pluginFilter}
                  onValueChange={setPluginFilter}
                  items={[
                    {
                      value: 'all',
                      label: t('aiCapabilityAgents.tools.allPlugins'),
                      icon: <Puzzle className="h-4 w-4" />,
                    },
                    ...pluginOptions.map((plugin) => ({
                      value: plugin,
                      label: plugin,
                      icon: <PluginIcon pluginName={plugin} className="h-4 w-4" />,
                    })),
                  ]}
                />
              </div>
            </div>
            <div
              className="max-h-[430px] overflow-y-scroll overscroll-contain pr-1"
              onWheel={(event) => event.stopPropagation()}
            >
              <div className="space-y-4 p-3">
                {Object.keys(groupedTools).length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    {t('aiCapabilityAgents.tools.noMatched')}
                  </div>
                ) : (
                  Object.entries(groupedTools).map(([plugin, pluginTools]) => (
                    <div key={plugin} className="space-y-2">
                      <div className="sticky top-0 z-10 flex items-center justify-between rounded-md bg-popover/95 px-3 py-2 backdrop-blur">
                        <Label className="font-semibold">{plugin}</Label>
                        <Badge variant="outline" className="ml-3">
                          {pluginTools.length}
                        </Badge>
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
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleTool(tool.name)}
                                onClick={(event) => event.stopPropagation()}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm font-semibold">
                                    {tool.name}
                                  </span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {tool.category}
                                  </Badge>
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {tool.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CapabilityAgentsPanel({ capability }: { capability: UseCapabilityAgentsReturn }) {
  const { t } = useLanguage();
  const {
    isLoading,
    isSaving,
    isDeleting,
    filteredProfiles,
    openDialog,
    dialogOpen,
    setDialogOpen,
    dialogMode,
    form,
    updateForm,
    tools,
    saveProfile,
    deleteTarget,
    setDeleteTarget,
    deleteProfile,
    isReadOnly,
  } = capability;

  const dialogTitle =
    dialogMode === 'create'
      ? t('aiCapabilityAgents.dialog.createTitle')
      : dialogMode === 'edit'
        ? t('aiCapabilityAgents.dialog.editTitle')
        : t('aiCapabilityAgents.dialog.viewTitle');

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('common.loading')}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card className={cn('glass-card')}>
          <CardContent className="flex flex-col items-center justify-center !py-16 text-center text-muted-foreground">
            <Bot className="mb-4 h-12 w-12 opacity-50" />
            <p>{t('aiCapabilityAgents.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="glass-card-grid grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredProfiles.map((profile) => {
            const locked = profile.source !== 'user';
            return (
              <Card
                key={profile.node_id}
                className={cn(
                  'group transition-all hover:border-primary/50 hover:shadow-md',
                  'glass-card',
                )}
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                        <span className="truncate">{profile.display_name}</span>
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {profile.node_id}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={sourceClass(profile.source)}>
                        {profile.source}
                      </Badge>
                      {locked && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>{t('aiCapabilityAgents.readonlyTip')}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="min-h-[3rem] text-sm text-muted-foreground line-clamp-3">
                    {profile.when_to_use || t('aiCapabilityAgents.noUsage')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Wrench className="h-3 w-3" />
                      {t('aiCapabilityAgents.toolCount', {
                        count: profile.tool_names?.length || 0,
                      })}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Tags className="h-3 w-3" />
                      {profile.match_keywords?.length || 0}
                    </Badge>
                    {(profile.tool_packs || []).map((pack) => (
                      <Badge key={pack} variant="outline" className="gap-1 text-[10px]">
                        <Package className="h-3 w-3" />
                        {pack}
                      </Badge>
                    ))}
                  </div>
                  {profile.match_keywords && profile.match_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {profile.match_keywords.slice(0, 6).map((keyword) => (
                        <Badge key={keyword} variant="outline" className="text-[10px]">
                          {keyword}
                        </Badge>
                      ))}
                      {profile.match_keywords.length > 6 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{profile.match_keywords.length - 6}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDialog('view', profile)}
                      className="gap-1.5"
                    >
                      <Eye className="h-4 w-4" />
                      {t('common.view')}
                    </Button>
                    {profile.source === 'user' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog('edit', profile)}
                      >
                        {t('common.edit')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDialog('create', profile, profile.node_id)}
                      className="gap-1.5"
                    >
                      <Copy className="h-4 w-4" />
                      {t('aiCapabilityAgents.copyAsNew')}
                    </Button>
                    {profile.source === 'user' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(profile)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 创建 / 编辑 / 查看 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-[1100px]">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              {dialogTitle}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {dialogMode === 'create'
                ? t('aiCapabilityAgents.dialog.createDesc')
                : dialogMode === 'edit'
                  ? t('aiCapabilityAgents.dialog.editDesc')
                  : t('aiCapabilityAgents.dialog.viewDesc')}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              {/* 继承基底提示 */}
              {form.base && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                  {t('aiCapabilityAgents.inheritedFrom', { base: form.base })}
                </div>
              )}

              {/* 基础字段 */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="node_id">
                    {t('aiCapabilityAgents.fields.nodeId')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="node_id"
                    disabled={dialogMode !== 'create'}
                    value={form.node_id}
                    onChange={(e) => updateForm('node_id', e.target.value)}
                    placeholder="my_agent"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('aiCapabilityAgents.fields.nodeIdHelp')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_name">
                    {t('aiCapabilityAgents.fields.displayName')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="display_name"
                    disabled={isReadOnly}
                    value={form.display_name}
                    onChange={(e) => updateForm('display_name', e.target.value)}
                    placeholder={t('aiCapabilityAgents.fields.displayNamePlaceholder')}
                  />
                </div>
              </div>

              {/* 适用场景 */}
              <div className="space-y-2">
                <Label htmlFor="when_to_use">{t('aiCapabilityAgents.fields.whenToUse')}</Label>
                <Textarea
                  id="when_to_use"
                  disabled={isReadOnly}
                  value={form.when_to_use}
                  onChange={(e) => updateForm('when_to_use', e.target.value)}
                  placeholder={t('aiCapabilityAgents.fields.whenToUsePlaceholder')}
                  rows={2}
                />
              </div>

              {/* 提示词 */}
              <div className="space-y-2">
                <Label htmlFor="prompt">
                  {t('aiCapabilityAgents.fields.prompt')}
                  <span className="text-destructive">*</span>
                </Label>
                {isReadOnly ? (
                  <div className="rounded-md border bg-muted/40 p-4 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{form.prompt || ''}</ReactMarkdown>
                  </div>
                ) : (
                  <Textarea
                    id="prompt"
                    value={form.prompt}
                    onChange={(e) => updateForm('prompt', e.target.value)}
                    placeholder={t('aiCapabilityAgents.fields.promptPlaceholder')}
                    rows={8}
                    className="font-mono text-sm"
                  />
                )}
              </div>

              {/* 触发关键词 */}
              <div className="space-y-2">
                <Label>{t('aiCapabilityAgents.fields.keywords')}</Label>
                {isReadOnly ? (
                  <div className="flex flex-wrap gap-2">
                    {form.match_keywords.length > 0 ? (
                      form.match_keywords.map((kw) => (
                        <Badge key={kw} variant="secondary">
                          {kw}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t('aiCapabilityAgents.fields.noKeywords')}
                      </span>
                    )}
                  </div>
                ) : (
                  <TagInput
                    value={form.match_keywords}
                    onChange={(keywords) => updateForm('match_keywords', keywords)}
                    placeholder={t('aiCapabilityAgents.fields.keywordsPlaceholder')}
                  />
                )}
              </div>

              {/* 工具配置 */}
              <div className="space-y-4 rounded-lg border p-4">
                <h4 className="font-semibold text-sm">
                  {t('aiCapabilityAgents.fields.toolSection')}
                </h4>

                <div className="space-y-2">
                  <Label>{t('aiCapabilityAgents.fields.toolPacks')}</Label>
                  <div className="flex flex-wrap gap-2">
                    {BUILTIN_TOOL_PACKS.map((pack) => {
                      const checked = form.tool_packs.includes(pack);
                      return (
                        <Button
                          type="button"
                          key={pack}
                          variant={checked ? 'default' : 'outline'}
                          size="sm"
                          disabled={isReadOnly}
                          onClick={() => {
                            if (isReadOnly) return;
                            updateForm(
                              'tool_packs',
                              checked
                                ? form.tool_packs.filter((p) => p !== pack)
                                : [...form.tool_packs, pack],
                            );
                          }}
                          className="gap-1.5"
                        >
                          <Package className="h-3.5 w-3.5" />
                          {pack}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('aiCapabilityAgents.fields.specificTools')}</Label>
                  <ToolMultiSelectDropdown
                    tools={tools}
                    value={form.tool_names}
                    onChange={(selected) => updateForm('tool_names', selected)}
                    disabled={isReadOnly}
                    t={t}
                  />
                </div>
              </div>

              {/* 高级配置 */}
              <div className="space-y-4 rounded-lg border p-4">
                <h4 className="font-semibold text-sm">
                  {t('aiCapabilityAgents.fields.advancedSection')}
                </h4>

                <div className="space-y-2">
                  <Label htmlFor="tool_query">{t('aiCapabilityAgents.fields.toolQuery')}</Label>
                  <Input
                    id="tool_query"
                    disabled={isReadOnly}
                    value={form.tool_query}
                    onChange={(e) => updateForm('tool_query', e.target.value)}
                    placeholder={t('aiCapabilityAgents.fields.toolQueryPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="boundary_override">
                    {t('aiCapabilityAgents.fields.boundaryOverride')}
                  </Label>
                  <Textarea
                    id="boundary_override"
                    disabled={isReadOnly}
                    value={form.boundary_override}
                    onChange={(e) => updateForm('boundary_override', e.target.value)}
                    placeholder={t('aiCapabilityAgents.fields.boundaryOverridePlaceholder')}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {isReadOnly ? t('common.close') : t('common.cancel')}
            </Button>
            {!isReadOnly && (
              <Button onClick={saveProfile} disabled={isSaving} className="gap-2">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('common.save')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 AlertDialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiCapabilityAgents.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiCapabilityAgents.deleteConfirmDesc', {
                name: deleteTarget?.display_name || deleteTarget?.node_id || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteProfile}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
