import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  TabButtonGroup,
  tabToolbarShellControlClass,
  tabToolbarGroupWrapClass,
} from '@/components/ui/TabButtonGroup';
import { SearchableMenu } from '@/components/ui/searchable-menu';
import { PluginIcon } from '@/components/ui/plugin-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  Wrench,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Network,
  Boxes,
  Puzzle,
  Sparkles,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  aiToolsApi,
  getApiErrorMessage,
  type AITool,
  type AIToolAssemblePreviewResponse,
  type AIEntityIndexResponse,
} from '@/lib/api';
import {
  diagnoseTool,
  EMPTY_TOOLS_VIEW,
  entityIndexPageRange,
  resolveEntityIndexEntries,
  resolveToolsListView,
  type ToolsListView,
} from '@/lib/featureUtils';
import { PersonaToolScopePanel } from '@/components/persona/PersonaToolScopePanel';
import SkillsPanel from '@/pages/AITools/SkillsPanel';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================================
// 类型定义
// ============================================================================

/** Assemble seed/pool chip with hover tooltip (same pattern as AI History tools_list). */
function AssembleToolChip({
  name,
  plugin,
  variant,
  toolMeta,
  noInfoLabel,
}: {
  name: string;
  plugin?: string;
  variant: 'outline' | 'secondary';
  toolMeta?: AITool | null;
  noInfoLabel: string;
}) {
  const description = (toolMeta?.description ?? '').trim();
  const category = toolMeta?.category;
  const metaLine = [plugin || toolMeta?.plugin, category].filter(Boolean).join(' · ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={variant}
          className="font-mono text-xs cursor-help max-w-full hover:bg-accent hover:text-foreground transition-colors"
        >
          <span className="inline-flex items-center gap-1 min-w-0">
            <Wrench className="w-3 h-3 shrink-0 opacity-60" />
            <span className="truncate">
              {name}
              {plugin ? ` · ${plugin}` : ''}
            </span>
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <p className="text-xs font-mono font-medium break-all">{name}</p>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {description.split('\n')[0]}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground/70 italic">{noInfoLabel}</p>
        )}
        {metaLine ? (
          <p className="mt-1 text-[10px] text-muted-foreground/70 break-all">{metaLine}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

interface ParsedTool {
  name: string;
  title: string;
  subtitle: string;
  summary: string;
  fullDescription: string;
  plugin: string;
  category: string;
}

// ============================================================================
// 工具函数
// ============================================================================

function parseToolDescription(tool: AITool, language: string): ParsedTool {
  const lines = (tool.description ?? '').split('\n');
  const firstLine = (lines[0] ?? '').trim();

  let title: string;
  let subtitle: string;

  if (language === 'zh-CN') {
    // 中文模式：第一行中文作为 title，函数名作为 subtitle
    title = firstLine || tool.name;
    subtitle = tool.name;
  } else {
    // 英文模式：函数名作为 title，第一行作为 subtitle
    title = tool.name;
    subtitle = firstLine || tool.name;
  }

  // Args 之前的所有内容作为简介
  const summaryLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('Args:') || line.startsWith('Returns:') || line.startsWith('Example:')) {
      break;
    }
    if (line.trim()) {
      summaryLines.push(line.trim());
    }
  }
  // 去掉第一行（标题行），保留换行
  const summary = summaryLines.slice(1).join('\n');

  return {
    name: tool.name,
    title,
    subtitle,
    summary,
    fullDescription: tool.description,
    plugin: tool.plugin,
    category: tool.category,
  };
}

// 每页展示的工具数量
const PAGE_SIZE = 100;

// 实体索引每页条数（服务端分页）
const ENTITY_PAGE_SIZE = 50;

// 生成分页页码列表:始终包含首尾页、当前页及其相邻页,其余以省略号折叠
function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

// 插件筛选项前缀图标：'all' 用 Puzzle 占位（与 /ai-capability-agents 的「全部插件」一致），
// 其余走统一 PluginIcon（core_command 等内置名由 getPluginIconUrl 映射到项目 LOGO）
function PluginFilterIcon({ plugin }: { plugin: string }) {
  if (plugin === 'all') return <Puzzle className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <PluginIcon pluginName={plugin} className="h-4 w-4" />;
}

function pluginFilterLabel(plugin: string, count: number, allLabel: string): string {
  return plugin === 'all' ? `${allLabel} (${count})` : `${plugin} (${count})`;
}

// ============================================================================
// 组件定义
// ============================================================================

export default function AIToolsPage() {
  const { t, language } = useLanguage();

  // 状态
  const [tools, setTools] = useState<AITool[]>([]);
  const [toolView, setToolView] = useState<ToolsListView>(EMPTY_TOOLS_VIEW);
  const [categories, setCategories] = useState<string[]>([]);
  const [plugins, setPlugins] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ParsedTool | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 筛选状态 - 同时支持分类、插件和搜索筛选
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  // 已提交的搜索词：输入框每次按键都发请求会打爆后端，防抖后再提交
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [diagnosticFilter, setDiagnosticFilter] = useState<'all' | 'issues' | 'empty_description'>(
    'all',
  );
  const [pageTab, setPageTab] = useState<'tools' | 'assemble' | 'entity' | 'skills'>('tools');
  // 「添加技能」按钮在页签同行（toolbar），弹窗开合状态因此挂在页面层
  const [skillsAddOpen, setSkillsAddOpen] = useState(false);

  // 当前页码（每页 PAGE_SIZE 个工具）
  const [page, setPage] = useState(1);

  // Assemble preview
  const [assembleQuery, setAssembleQuery] = useState('');
  const [assembleLoading, setAssembleLoading] = useState(false);
  const [assembleResult, setAssembleResult] = useState<AIToolAssemblePreviewResponse | null>(null);

  // Entity index（服务端分页：搜索 / 冲突筛选 / 翻页都交给后端）
  const [entityIndex, setEntityIndex] = useState<AIEntityIndexResponse | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  // 输入框即时值与已提交值分开：翻页必须复用上次提交的 query（§1.10）
  const [entitySearch, setEntitySearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<{ search: string; conflictOnly: boolean }>({
    search: '',
    // 默认只看归属冲突（同一 surface 被多个插件注册）
    conflictOnly: true,
  });
  const [entityOffset, setEntityOffset] = useState(0);
  const [entityRefreshKey, setEntityRefreshKey] = useState(0);

  // 获取所有插件列表（core 放在最后）
  const pluginList = useMemo(() => {
    return [
      'all',
      ...plugins.filter((p) => p !== 'core').sort(),
      ...plugins.filter((p) => p === 'core'),
    ];
  }, [plugins]);

  // 获取所有分类列表（self, buildin 放在前面）
  const categoryList = useMemo(() => {
    const priorityOrder = ['self', 'buildin'];
    const sortedCategories = [...categories].sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a);
      const bIndex = priorityOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    return ['all', ...sortedCategories];
  }, [categories]);

  // 搜索防抖：输入框每次按键都打一次接口会打爆后端，停手 400ms 才提交
  useEffect(() => {
    const id = setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // 筛选变化 → 回到第 1 页（否则停在第 3 页时改筛选会看到空列表）
  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategory(value);
    setPage(1);
  }, []);

  const handlePluginChange = useCallback((value: string) => {
    setSelectedPlugin(value);
    setPage(1);
  }, []);

  const handleDiagnosticChange = useCallback((value: 'all' | 'issues' | 'empty_description') => {
    setDiagnosticFilter(value);
    setPage(1);
  }, []);

  // 解析后的工具列表（当前页）
  const parsedTools = useMemo(() => {
    return tools.map((tool) => parseToolDescription(tool, language));
  }, [tools, language]);

  // 分类 / 插件 / 诊断计数：来自后端的**总数**，不随翻页变化
  const categoryCounts = toolView.categoryCounts;
  const pluginCounts = toolView.pluginCounts;
  const diagnosticCounts = toolView.diagnosticCounts;

  const runAssemblePreview = useCallback(async () => {
    const q = assembleQuery.trim();
    if (!q) {
      toast.error(t('aiTools.assemble.queryRequired'));
      return;
    }
    setAssembleLoading(true);
    try {
      const data = await aiToolsApi.assemblePreview(q);
      setAssembleResult(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiTools.assemble.failed')));
      setAssembleResult(null);
    } finally {
      setAssembleLoading(false);
    }
  }, [assembleQuery, t]);

  const loadEntityIndex = useCallback(async () => {
    setEntityLoading(true);
    try {
      const data = await aiToolsApi.getEntityIndex({
        search: entityFilter.search || undefined,
        ambiguousOnly: entityFilter.conflictOnly,
        limit: ENTITY_PAGE_SIZE,
        offset: entityOffset,
      });
      setEntityIndex(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiTools.entityIndex.failed')));
      setEntityIndex(null);
    } finally {
      setEntityLoading(false);
    }
  }, [entityFilter, entityOffset, t]);

  // 切到实体页签 / 改筛选 / 翻页 / 点刷新都重新拉。
  // 依赖里不放 entityIndex，否则加载完写回 state 又会触发一次。
  useEffect(() => {
    if (pageTab !== 'entity') return;
    void loadEntityIndex();
  }, [pageTab, entityRefreshKey, loadEntityIndex]);

  // 提交搜索：把输入框的值落到已提交 filter 并回到第一页
  const submitEntitySearch = useCallback(() => {
    setEntityFilter((f) => ({ ...f, search: entitySearch.trim() }));
    setEntityOffset(0);
    setEntityRefreshKey((k) => k + 1);
  }, [entitySearch]);

  // 冲突筛选变化 → 回到第一页重查
  const handleEntityConflictOnlyChange = useCallback((checked: boolean) => {
    setEntityFilter((f) => ({ ...f, conflictOnly: checked }));
    setEntityOffset(0);
  }, []);

  const entityEntries = useMemo(
    () => resolveEntityIndexEntries(entityIndex, entityFilter),
    [entityIndex, entityFilter],
  );

  const entityTotal = entityIndex?.total ?? entityIndex?.count ?? 0;
  const entityTotalAll = entityIndex?.total_all ?? entityIndex?.count ?? 0;
  const entityCanPrev = entityOffset > 0;
  // 旧后端不认分页（没有 items），此时不提供翻页
  const entityCanNext =
    entityIndex?.items !== undefined && entityOffset + ENTITY_PAGE_SIZE < entityTotal;
  const entityRange = entityIndexPageRange(entityOffset, entityEntries.length, entityTotal);

  const totalPages = toolView.totalPages;
  const currentPage = Math.min(page, totalPages);

  // 加载工具列表：筛选与分页都在服务端做，前端只负责传条件和渲染
  const fetchTools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await aiToolsApi.getToolsList({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        plugin: selectedPlugin === 'all' ? undefined : selectedPlugin,
        search: appliedSearch || undefined,
        diagnostic: diagnosticFilter,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
      });
      setTools(data.tools || []);
      setCategories(data.categories || []);
      setPlugins(data.plugins || []);
      setToolView(
        resolveToolsListView(
          data,
          {
            category: selectedCategory,
            plugin: selectedPlugin,
            search: appliedSearch,
            diagnostic: diagnosticFilter,
          },
          currentPage,
          PAGE_SIZE,
        ),
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('aiTools.loadFailed');
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, selectedPlugin, appliedSearch, diagnosticFilter, currentPage, t]);

  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  const handleToolClick = (tool: ParsedTool) => {
    setSelectedTool(tool);
    setDialogOpen(true);
  };
  return (
    <PinnedPage
      header={
        /* 页面标题（固定区） */
        <div className="min-w-0 sm:overflow-x-auto">
          <h1 className="sm:whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <Wrench className="w-8 h-8 shrink-0" />
            {t('aiTools.title')}
          </h1>
          <p className="sm:whitespace-nowrap text-muted-foreground mt-1">
            {t('aiTools.description')}
          </p>
        </div>
      }
      toolbar={
        /* 主 Tab 左、筛选右：桌面同一行。筛选控件全部 min-w-0 + flex-1，窄屏均分宽度并截断，不撑出边距 */
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className={cn(tabToolbarGroupWrapClass, 'max-w-full')}>
            <TabButtonGroup
              options={[
                {
                  value: 'tools',
                  label: t('aiTools.tabs.tools'),
                  icon: <Wrench className="w-4 h-4" />,
                },
                {
                  value: 'assemble',
                  label: t('aiTools.tabs.assemble'),
                  icon: <Boxes className="w-4 h-4" />,
                },
                {
                  value: 'entity',
                  label: t('aiTools.tabs.entityIndex'),
                  icon: <Network className="w-4 h-4" />,
                },
                {
                  value: 'skills',
                  label: t('aiTools.tabs.skills'),
                  icon: <Sparkles className="w-4 h-4" />,
                },
              ]}
              value={pageTab}
              onValueChange={(v) => setPageTab(v as 'tools' | 'assemble' | 'entity' | 'skills')}
              className="shrink-0"
            />
          </div>

          {pageTab === 'tools' && !isLoading && categories.length > 0 && (
            <div className="flex min-w-0 w-full items-center gap-1.5 md:flex-1 md:justify-end">
              <div className="relative min-w-0 flex-[1.3]">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('aiTools.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(tabToolbarShellControlClass, 'min-w-0 w-full pl-9')}
                />
              </div>

              <div className="min-w-0 flex-1">
                <Select
                  value={diagnosticFilter}
                  onValueChange={(v) => handleDiagnosticChange(v as typeof diagnosticFilter)}
                >
                  <SelectTrigger
                    className={cn(
                      tabToolbarShellControlClass,
                      'w-full min-w-0 px-2 [&>span]:min-w-0',
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('aiTools.diagnostics.filterAll')}</SelectItem>
                    <SelectItem value="issues">
                      {t('aiTools.diagnostics.filterIssues')} (
                      {diagnosticCounts.emptyDescription + diagnosticCounts.meta})
                    </SelectItem>
                    <SelectItem value="empty_description">
                      {t('aiTools.diagnostics.filterEmpty')} ({diagnosticCounts.emptyDescription})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0 flex-1">
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                  <SelectTrigger
                    className={cn(
                      tabToolbarShellControlClass,
                      'w-full min-w-0 px-2 [&>span]:min-w-0',
                    )}
                  >
                    <SelectValue placeholder={t('aiTools.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryList.map((category) => {
                      const count = categoryCounts[category] || 0;
                      const disabled =
                        category !== 'all' && category !== selectedCategory && count === 0;
                      return (
                        <SelectItem key={category} value={category} disabled={disabled}>
                          {category === 'all'
                            ? `${t('aiTools.allCategories')} (${categoryCounts.all || 0})`
                            : `${category} (${count})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0 flex-1">
                <SearchableMenu
                  appearance="field"
                  width="trigger"
                  align="end"
                  className={cn(tabToolbarShellControlClass, 'w-full min-w-0 px-2')}
                  placeholder={t('aiTools.selectPlugin')}
                  searchPlaceholder={t('common.search')}
                  value={selectedPlugin}
                  onValueChange={handlePluginChange}
                  items={pluginList.map((plugin) => {
                    const count = pluginCounts[plugin] || 0;
                    return {
                      value: plugin,
                      label: pluginFilterLabel(plugin, count, t('aiTools.allPlugins')),
                      icon: <PluginFilterIcon plugin={plugin} />,
                      disabled: plugin !== 'all' && plugin !== selectedPlugin && count === 0,
                    };
                  })}
                />
              </div>
            </div>
          )}

          {/* 实体页签的筛选行：搜索 + 只看归属冲突。高度对齐页签外壳 */}
          {pageTab === 'entity' && (
            <div className="flex min-w-0 w-full items-center gap-2 md:flex-1 md:justify-end">
              <div className="relative min-w-0 flex-[1.3]">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('aiTools.entityIndex.searchPlaceholder')}
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitEntitySearch();
                  }}
                  className={cn(tabToolbarShellControlClass, 'min-w-0 w-full pl-9')}
                />
              </div>

              <div className="flex shrink-0 items-center gap-2 pl-1">
                <Switch
                  checked={entityFilter.conflictOnly}
                  onCheckedChange={handleEntityConflictOnlyChange}
                />
                <Label className="whitespace-nowrap cursor-pointer">
                  {t('aiTools.entityIndex.conflictOnly')}
                </Label>
              </div>
            </div>
          )}

          {/* 技能页签的操作按钮：与页签同行右对齐，高度对齐页签外壳 */}
          {pageTab === 'skills' && (
            <Button
              onClick={() => setSkillsAddOpen(true)}
              className={cn(tabToolbarShellControlClass, 'w-full gap-2 md:w-auto')}
            >
              <Plus className="h-4 w-4" />
              {t('aiSkills.addSkill')}
            </Button>
          )}
        </div>
      }
    >
      {/* 错误提示 */}
      {error && pageTab === 'tools' && (
        <GlassAlert tone="danger" icon={AlertCircle}>
          {error}
        </GlassAlert>
      )}

      {pageTab === 'assemble' && (
        <div className="space-y-4">
          <Card className={cn('glass-card')}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Boxes className="w-4 h-4" />
                {t('aiTools.assemble.title')}
              </CardTitle>
              <CardDescription>{t('aiTools.assemble.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t('aiTools.assemble.query')}</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    className="h-9 flex-1"
                    value={assembleQuery}
                    onChange={(e) => setAssembleQuery(e.target.value)}
                    placeholder={t('aiTools.assemble.queryPlaceholder')}
                    onKeyDown={(e) => e.key === 'Enter' && void runAssemblePreview()}
                  />
                  <Button
                    className="h-9"
                    onClick={() => void runAssemblePreview()}
                    disabled={assembleLoading}
                  >
                    {assembleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {t('aiTools.assemble.run')}
                  </Button>
                </div>
              </div>
              {assembleResult && (
                <TooltipProvider delayDuration={150}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="rounded-lg border border-border/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">{t('aiTools.assemble.seeds')}</h4>
                        <Badge variant="secondary">{assembleResult.seeds?.length ?? 0}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(assembleResult.seeds ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t('common.noData')}
                          </span>
                        )}
                        {(assembleResult.seeds ?? []).map((s) => (
                          <AssembleToolChip
                            key={`seed-${s.name}`}
                            name={s.name}
                            plugin={s.plugin}
                            variant="outline"
                            toolMeta={tools.find((x) => x.name === s.name)}
                            noInfoLabel={t('aiTools.assemble.toolNoInfo')}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">{t('aiTools.assemble.pool')}</h4>
                        <Badge variant="secondary">{assembleResult.pool?.length ?? 0}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        core={assembleResult.core_pool_size ?? 0} · recall=
                        {assembleResult.recall ?? 0} · max_extra=
                        {assembleResult.max_extra ?? 0}
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-auto">
                        {(assembleResult.pool ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t('common.noData')}
                          </span>
                        )}
                        {(assembleResult.pool ?? []).map((s) => (
                          <AssembleToolChip
                            key={`pool-${s.name}`}
                            name={s.name}
                            plugin={s.plugin}
                            variant="secondary"
                            toolMeta={tools.find((x) => x.name === s.name)}
                            noInfoLabel={t('aiTools.assemble.toolNoInfo')}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {pageTab === 'entity' && (
        <div className="space-y-4">
          <Card className={cn('glass-card')}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    {t('aiTools.entityIndex.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('aiTools.entityIndex.description')}
                    {entityIndex ? ` · ${entityTotal}` : ''}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={submitEntitySearch}
                  disabled={entityLoading}
                >
                  {entityLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {t('common.refresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {entityLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-2/3" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* 列表正文与上方 CardDescription 同为系统 UI 字体（不用 mono），字号/颜色对齐 subtitle */}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          {t('aiTools.entityIndex.surface')}
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          {t('aiTools.entityIndex.plugins')}
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          {t('aiTools.entityIndex.ambiguous')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entityEntries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            {entityFilter.conflictOnly && !entityFilter.search
                              ? t('aiTools.entityIndex.conflictEmpty')
                              : t('common.noData')}
                          </td>
                        </tr>
                      ) : (
                        entityEntries.map((entry) => (
                          <tr key={entry.surface} className="border-b border-border/30">
                            <td className="py-2 px-2 text-sm text-muted-foreground">
                              {entry.surface}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex flex-wrap gap-1">
                                {entry.plugins.map((p) => (
                                  <Badge key={p} variant="outline" className="text-xs font-normal">
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              {entry.ambiguous ? (
                                <Badge variant="destructive" className="text-xs font-normal">
                                  {t('aiTools.entityIndex.yes')}
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t('aiTools.entityIndex.pagination.label', {
                    from: entityRange.from,
                    to: entityRange.to,
                    total: entityTotal,
                  })}
                  {entityFilter.conflictOnly && entityTotalAll > entityTotal
                    ? ` · ${t('aiTools.entityIndex.pagination.allTotal', { total: entityTotalAll })}`
                    : ''}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9"
                    disabled={!entityCanPrev || entityLoading}
                    onClick={() => setEntityOffset(Math.max(0, entityOffset - ENTITY_PAGE_SIZE))}
                  >
                    {t('aiTools.entityIndex.pagination.prev')}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9"
                    disabled={!entityCanNext || entityLoading}
                    onClick={() => setEntityOffset(entityOffset + ENTITY_PAGE_SIZE)}
                  >
                    {t('aiTools.entityIndex.pagination.next')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 工具列表 */}
      {pageTab === 'tools' &&
        (isLoading ? (
          <div className="glass-card-grid grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className={cn('glass-card')}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : parsedTools.length === 0 ? (
          <Card className={cn('glass-card')}>
            <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
              <Wrench className="w-12 h-12 mb-4 opacity-50" />
              <p>
                {selectedCategory === 'all' &&
                selectedPlugin === 'all' &&
                !appliedSearch &&
                diagnosticFilter === 'all'
                  ? t('aiTools.noTools')
                  : t('aiTools.noMatches')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="glass-card-grid grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {parsedTools.map((tool) => {
                const diag = diagnoseTool(tools.find((x) => x.name === tool.name) ?? tool);
                return (
                  <Card
                    key={tool.name}
                    className={cn(
                      'cursor-pointer transition-colors hover:border-primary/50',
                      'glass-card',
                      diag.level === 'error' && 'border-destructive/40',
                      diag.level === 'warn' && 'border-amber-500/40',
                    )}
                    onClick={() => handleToolClick(tool)}
                  >
                    <CardHeader>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <CardTitle className="flex min-w-0 items-center gap-2">
                          <Wrench className="w-5 h-5 text-primary shrink-0" />
                          <span className="text-lg truncate">{tool.title}</span>
                        </CardTitle>
                        <div className="flex shrink-0 flex-col gap-1 items-start sm:items-end">
                          {diag.reasons.includes('empty_description') && (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {t('aiTools.diagnostics.emptyDescription')}
                            </Badge>
                          )}
                          {diag.reasons.includes('meta_not_vector_searchable') && (
                            <Badge className="text-[10px] gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              <AlertTriangle className="w-3 h-3" />
                              meta
                            </Badge>
                          )}
                          {tool.plugin && tool.plugin !== 'core' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {tool.plugin}
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                            {tool.category}
                          </span>
                        </div>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground font-mono">
                        {tool.subtitle}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {tool.summary}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="text-xs text-muted-foreground mr-1">
                  {t('aiTools.pagination.label', { total: toolView.total })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {getPageNumbers(currentPage, totalPages).map((p, i) =>
                  p === 'ellipsis' ? (
                    <span key={`e${i}`} className="px-2 text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === currentPage ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ),
                )}
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        ))}

      {/* 技能列表（原 /ai-skills 整页内容，已并入本页签） */}
      {pageTab === 'skills' && (
        <SkillsPanel addDialogOpen={skillsAddOpen} onAddDialogOpenChange={setSkillsAddOpen} />
      )}

      {/* 工具详情弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              {selectedTool?.title}
            </DialogTitle>
            <DialogDescription className="text-base">{selectedTool?.subtitle}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-2 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded bg-secondary">{selectedTool?.category}</span>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
                {selectedTool?.plugin}
              </span>
            </div>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-md overflow-x-auto">
              {selectedTool?.fullDescription}
            </pre>

            {selectedTool && (
              <>
                <div className="pt-2 text-sm font-semibold">{t('aiTools.personaScope')}</div>
                <PersonaToolScopePanel
                  plugin={selectedTool.plugin || 'core'}
                  toolName={selectedTool.title}
                  t={t}
                />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
