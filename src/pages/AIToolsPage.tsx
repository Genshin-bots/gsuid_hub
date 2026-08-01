import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
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
  countToolDiagnostics,
  diagnoseTool,
  filterToolsByDiagnostic,
} from '@/lib/featureUtils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

// ============================================================================
// 组件定义
// ============================================================================

export default function AIToolsPage() {
  const { style } = useTheme();
  const { t, language } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // 状态
  const [tools, setTools] = useState<AITool[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [plugins, setPlugins] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ParsedTool | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // 筛选状态 - 同时支持分类、插件和搜索筛选
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [diagnosticFilter, setDiagnosticFilter] = useState<'all' | 'issues' | 'empty_description'>('all');
  const [pageTab, setPageTab] = useState<'tools' | 'assemble' | 'entity'>('tools');

  // 当前页码（每页 PAGE_SIZE 个工具）
  const [page, setPage] = useState(1);

  // Assemble preview
  const [assembleQuery, setAssembleQuery] = useState('');
  const [assembleLoading, setAssembleLoading] = useState(false);
  const [assembleResult, setAssembleResult] = useState<AIToolAssemblePreviewResponse | null>(null);

  // Entity index
  const [entityIndex, setEntityIndex] = useState<AIEntityIndexResponse | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');

  // 获取所有插件列表（core 放在最后）
  const pluginList = useMemo(() => {
    return ['all', ...plugins.filter(p => p !== 'core').sort(), ...plugins.filter(p => p === 'core')];
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

  // 搜索匹配函数
  const matchesSearch = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (tool: AITool) =>
      !query ||
      tool.name.toLowerCase().includes(query) ||
      (tool.description ?? '').toLowerCase().includes(query);
  }, [searchQuery]);

  const diagnosticCounts = useMemo(() => countToolDiagnostics(tools), [tools]);

  // 按筛选条件过滤后的工具列表
  const filteredTools = useMemo((): AITool[] => {
    const base = tools.filter(tool =>
      (selectedCategory === 'all' || tool.category === selectedCategory) &&
      (selectedPlugin === 'all' || tool.plugin === selectedPlugin) &&
      matchesSearch(tool)
    );
    return filterToolsByDiagnostic(base, diagnosticFilter) as AITool[];
  }, [tools, selectedCategory, selectedPlugin, matchesSearch, diagnosticFilter]);

  // 分类计数:统计在「当前所选插件 + 搜索」条件下,每个分类还有多少工具
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const tool of tools) {
      if (selectedPlugin !== 'all' && tool.plugin !== selectedPlugin) continue;
      if (!matchesSearch(tool)) continue;
      counts[tool.category] = (counts[tool.category] || 0) + 1;
      counts.all += 1;
    }
    return counts;
  }, [tools, selectedPlugin, matchesSearch]);

  // 插件计数:统计在「当前所选分类 + 搜索」条件下,每个插件还有多少工具
  const pluginCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const tool of tools) {
      if (selectedCategory !== 'all' && tool.category !== selectedCategory) continue;
      if (!matchesSearch(tool)) continue;
      counts[tool.plugin] = (counts[tool.plugin] || 0) + 1;
      counts.all += 1;
    }
    return counts;
  }, [tools, selectedCategory, matchesSearch]);

  // 解析后的工具列表
  const parsedTools = useMemo(() => {
    return filteredTools.map(tool => parseToolDescription(tool, language));
  }, [filteredTools, language]);

  // 分页:筛选条件变化时回到第 1 页
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedPlugin, searchQuery, diagnosticFilter]);

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
      const data = await aiToolsApi.getEntityIndex();
      setEntityIndex(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiTools.entityIndex.failed')));
      setEntityIndex(null);
    } finally {
      setEntityLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (pageTab === 'entity' && !entityIndex && !entityLoading) {
      void loadEntityIndex();
    }
  }, [pageTab, entityIndex, entityLoading, loadEntityIndex]);

  const filteredEntities = useMemo(() => {
    const entries = entityIndex?.entries ?? [];
    const q = entitySearch.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.surface.toLowerCase().includes(q) ||
        e.plugins.some((p) => p.toLowerCase().includes(q)),
    );
  }, [entityIndex, entitySearch]);

  const totalPages = Math.max(1, Math.ceil(parsedTools.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedTools = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return parsedTools.slice(start, start + PAGE_SIZE);
  }, [parsedTools, currentPage]);

  // 加载工具列表
  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await aiToolsApi.getToolsList();
        setTools(data.tools || []);
        setCategories(data.categories || []);
        setPlugins(data.plugins || []);
        setTotalCount(data.total_count || 0);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : t('aiTools.loadFailed');
        setError(errorMsg);
        toast.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, [t]);

  const handleToolClick = (tool: ParsedTool) => {
    setSelectedTool(tool);
    setDialogOpen(true);
  };

  return (
    <PinnedPage
      header={
        /* 页面标题（固定区） */
        <div className="min-w-0 overflow-x-auto">
          <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <Wrench className="w-8 h-8 shrink-0" />
            {t('aiTools.title')}
          </h1>
          <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiTools.description')}</p>
        </div>
      }
      toolbar={
        /* 主 Tab 常驻；工具列表的多维筛选压成单行 Select + 搜索，避免 4 组 ButtonGroup 占满视口 */
        <div className="space-y-3">
          <TabButtonGroup
            options={[
              { value: 'tools', label: t('aiTools.tabs.tools'), icon: <Wrench className="w-4 h-4" /> },
              { value: 'assemble', label: t('aiTools.tabs.assemble'), icon: <Boxes className="w-4 h-4" /> },
              { value: 'entity', label: t('aiTools.tabs.entityIndex'), icon: <Network className="w-4 h-4" /> },
            ]}
            value={pageTab}
            onValueChange={(v) => setPageTab(v as 'tools' | 'assemble' | 'entity')}
          />

          {pageTab === 'tools' && !isLoading && categories.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('aiTools.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full pl-9"
                />
              </div>

              <Select
                value={diagnosticFilter}
                onValueChange={(v) => setDiagnosticFilter(v as typeof diagnosticFilter)}
              >
                <SelectTrigger className="h-9 w-full sm:w-[170px]">
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

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="h-9 w-full sm:w-[180px]">
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

              <Select value={selectedPlugin} onValueChange={setSelectedPlugin}>
                <SelectTrigger className="h-9 w-full sm:w-[180px]">
                  <SelectValue placeholder={t('aiTools.selectPlugin')} />
                </SelectTrigger>
                <SelectContent>
                  {pluginList.map((plugin) => {
                    const count = pluginCounts[plugin] || 0;
                    const disabled =
                      plugin !== 'all' && plugin !== selectedPlugin && count === 0;
                    return (
                      <SelectItem key={plugin} value={plugin} disabled={disabled}>
                        {plugin === 'all'
                          ? `${t('aiTools.allPlugins')} (${pluginCounts.all || 0})`
                          : `${plugin} (${count})`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      }
    >
      {/* 错误提示 */}
      {error && pageTab === 'tools' && (
        <Card className={cn(
          "border-destructive/50",
          isGlass ? "glass-card" : "border border-border/50"
        )}>
          <CardContent className="flex items-center gap-3 p-4 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* 诊断徽章 + 工具计数：数据展示，随列表滚动，不占固定 toolbar 高度 */}
      {pageTab === 'tools' && !isLoading && !error && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {diagnosticCounts.total > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">
                {t('aiTools.diagnostics.ok')}: {diagnosticCounts.ok}
              </Badge>
              {diagnosticCounts.emptyDescription > 0 && (
                <Badge variant="destructive">
                  {t('aiTools.diagnostics.emptyDescription')}: {diagnosticCounts.emptyDescription}
                </Badge>
              )}
              {diagnosticCounts.meta > 0 && (
                <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300">
                  {t('aiTools.diagnostics.meta')}: {diagnosticCounts.meta}
                </Badge>
              )}
            </div>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted-foreground shrink-0">
            {t('aiTools.toolCount', { count: filteredTools.length, total: totalCount })}
          </p>
        </div>
      )}

      {pageTab === 'assemble' && (
        <div className="space-y-4">
          <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
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
                  <Button className="h-9" onClick={() => void runAssemblePreview()} disabled={assembleLoading}>
                    {assembleLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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
                          <span className="text-xs text-muted-foreground">{t('common.noData')}</span>
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
                        core={assembleResult.core_pool_size ?? 0} · recall={assembleResult.recall ?? 0} · max_extra=
                        {assembleResult.max_extra ?? 0}
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-48 overflow-auto">
                        {(assembleResult.pool ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">{t('common.noData')}</span>
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
          <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    {t('aiTools.entityIndex.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('aiTools.entityIndex.description')}
                    {entityIndex ? ` · ${entityIndex.count}` : ''}
                  </CardDescription>
                </div>
                <Button variant="outline" className="h-9" onClick={() => void loadEntityIndex()} disabled={entityLoading}>
                  {entityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {t('common.refresh')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                className="h-9 max-w-md"
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                placeholder={t('aiTools.entityIndex.searchPlaceholder')}
              />
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
                      {filteredEntities.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                            {t('common.noData')}
                          </td>
                        </tr>
                      ) : (
                        filteredEntities.map((entry) => (
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
            </CardContent>
          </Card>
        </div>
      )}

      {/* 工具列表 */}
      {pageTab === 'tools' && (isLoading ? (
        <div className="glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className={cn(
              isGlass ? "glass-card" : "border border-border/50"
            )}>
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
        <Card className={cn(
          isGlass ? "glass-card" : "border border-border/50"
        )}>
          <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Wrench className="w-12 h-12 mb-4 opacity-50" />
            <p>{t('aiTools.noTools')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedTools.map((tool) => {
            const diag = diagnoseTool(tools.find((x) => x.name === tool.name) ?? tool);
            return (
            <Card
              key={tool.name}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary/50",
                isGlass ? "glass-card" : "border border-border/50",
                diag.level === 'error' && 'border-destructive/40',
                diag.level === 'warn' && 'border-amber-500/40',
              )}
              onClick={() => handleToolClick(tool)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary" />
                    <span className="text-lg">{tool.title}</span>
                  </CardTitle>
                  <div className="flex flex-col gap-1 items-end">
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
          <div className="flex items-center justify-center gap-2 pt-2">
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
                <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
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

      {/* 工具详情弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              {selectedTool?.title}
            </DialogTitle>
            <DialogDescription className="text-base">
              {selectedTool?.subtitle}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded bg-secondary">{selectedTool?.category}</span>
              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{selectedTool?.plugin}</span>
            </div>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-md overflow-x-auto">
              {selectedTool?.fullDescription}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
