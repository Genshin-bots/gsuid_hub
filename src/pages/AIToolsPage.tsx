import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarShellControlClass,
  tabToolbarGroupWrapClass,
} from '@/components/ui/TabButtonGroup';
import { PluginGridSelector } from '@/components/plugins/PluginUsageBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { headerActionRowClass, pageGapClass, PinnedPage } from '@/components/layout/PinnedPage';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Wrench,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  Server,
  Sparkles,
  Plus,
  Layers,
  Stethoscope,
  Loader2,
  RefreshCw,
  Store,
  FileJson,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiToolsApi, type AITool } from '@/lib/api';
import {
  diagnoseTool,
  EMPTY_TOOLS_VIEW,
  resolveToolsListView,
  type ToolsListView,
} from '@/lib/featureUtils';
import { PersonaToolScopePanel } from '@/components/persona/PersonaToolScopePanel';
import SkillsPanel from '@/pages/AITools/SkillsPanel';
import { MCPConfigPanel, type MCPConfigActions } from '@/pages/AITools/MCPConfigPanel';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============================================================================
// 类型定义
// ============================================================================

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

// 诊断筛选触发器图标：选中问题态时换成对应告警色，与工具卡上的诊断徽章同色
function DiagnosticFilterIcon({ value }: { value: 'all' | 'issues' | 'empty_description' }) {
  if (value === 'issues') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
  if (value === 'empty_description') {
    return <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />;
  }
  return <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />;
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
  // 已提交的搜索词：防抖后再提交，避免频繁请求打爆后端
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [diagnosticFilter, setDiagnosticFilter] = useState<'all' | 'issues' | 'empty_description'>(
    'all',
  );
  // 页签走 ?tab=（skills / mcp），与 /ai-debug、/ai-artifacts 同一约定；
  // 装配预览、实体索引已挪到 /ai-debug，本页只留能力编排（工具 / 技能 / MCP）。
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const pageTab: 'tools' | 'skills' | 'mcp' =
    tabParam === 'skills' || tabParam === 'mcp' ? tabParam : 'tools';
  const setPageTab = useCallback(
    (next: 'tools' | 'skills' | 'mcp') => {
      const params = new URLSearchParams(searchParams);
      if (next === 'tools') params.delete('tab');
      else params.set('tab', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  // 「添加技能」按钮在页签同行（toolbar），弹窗开合状态因此挂在页面层
  const [skillsAddOpen, setSkillsAddOpen] = useState(false);
  // MCP 页签的操作按钮同样在页签同行；面板通过 bindActions 把操作与加载态暴露上来
  const [mcpActions, setMcpActions] = useState<MCPConfigActions | null>(null);
  const navigate = useNavigate();

  // 当前页码（每页 PAGE_SIZE 个工具）
  const [page, setPage] = useState(1);

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

  // 输入法合成状态（IME composition）标记：中文拼音组词未完成时禁止触发防抖提交
  const isComposingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSearch = useCallback((query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      if (isComposingRef.current) return;
      setAppliedSearch(query.trim());
      setPage(1);
    }, 400);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (!isComposingRef.current) {
      scheduleSearch(val);
    }
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const val = e.currentTarget.value;
    setSearchQuery(val);
    scheduleSearch(val);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isComposingRef.current && !e.nativeEvent.isComposing) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      setAppliedSearch(searchQuery.trim());
      setPage(1);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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
        /* 主 Tab 左、筛选右：桌面同一行。控件 min-w-0 + flex-1 仅在窄屏收缩，
           md 起各自 max-w 封顶，余量由 justify-end 留在左侧，筛选组靠右不拉宽 */
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
                  value: 'skills',
                  label: t('aiTools.tabs.skills'),
                  icon: <Sparkles className="w-4 h-4" />,
                },
                {
                  value: 'mcp',
                  label: t('aiTools.tabs.mcp'),
                  icon: <Server className="w-4 h-4" />,
                },
              ]}
              value={pageTab}
              onValueChange={(v) => setPageTab(v as 'tools' | 'skills' | 'mcp')}
              className="shrink-0"
            />
          </div>

          {pageTab === 'tools' && (
            /*
             * 窄屏：搜索框独占一行，下面三个筛选下拉一行三列（两行）。
             * 四个控件挤一行时下拉框只剩 130px，"全部分类"被截成"全部分…"，点不准。
             * 桌面（md+）：外层回到一行，中间那层用 contents 摊平，顺序与原来一致。
             */
            <div className="flex min-w-0 w-full flex-col gap-2 md:flex-1 md:flex-row md:items-center md:justify-end md:gap-1.5">
              <div className="relative min-w-0 w-full md:w-auto md:flex-[1.3] md:max-w-[20rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('aiTools.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onCompositionStart={handleCompositionStart}
                  onCompositionEnd={handleCompositionEnd}
                  onKeyDown={handleSearchKeyDown}
                  className={cn(tabToolbarShellControlClass, 'min-w-0 w-full pl-9')}
                />
              </div>

              <div className="flex min-w-0 w-full gap-2 md:contents">
                <div className="min-w-0 flex-1 md:max-w-[9rem]">
                  <Select
                    value={diagnosticFilter}
                    onValueChange={(v) => handleDiagnosticChange(v as typeof diagnosticFilter)}
                  >
                    <SelectTrigger
                      className={cn(
                        tabToolbarShellControlClass,
                        /* trigger 自带 justify-between：值 span flex-1 占住中段，
                         文案贴住前缀图标、箭头仍在最右（同 /database 筛选列） */
                        'w-full min-w-0 gap-2 px-2 [&>span]:min-w-0 [&>span]:flex-1',
                      )}
                    >
                      <DiagnosticFilterIcon value={diagnosticFilter} />
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

                <div className="min-w-0 flex-1 md:max-w-[12rem]">
                  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger
                      className={cn(
                        tabToolbarShellControlClass,
                        'w-full min-w-0 gap-2 px-2 [&>span]:min-w-0 [&>span]:flex-1',
                      )}
                    >
                      <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
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

                <div className="min-w-0 flex-1 md:max-w-[11rem]">
                  <PluginGridSelector
                    appearance="field"
                    align="end"
                    enableShortcut={false}
                    className={cn(tabToolbarShellControlClass, 'w-full min-w-0 px-2')}
                    placeholder={t('aiTools.selectPlugin')}
                    value={selectedPlugin}
                    onValueChange={handlePluginChange}
                    allOption={{
                      value: 'all',
                      label: t('aiTools.allPlugins'),
                      count: pluginCounts.all || 0,
                    }}
                    plugins={pluginList
                      .filter((plugin) => plugin !== 'all')
                      .map((plugin) => {
                        const count = pluginCounts[plugin] || 0;
                        return {
                          id: plugin,
                          name: plugin,
                          count,
                          disabled: plugin !== selectedPlugin && count === 0,
                        };
                      })}
                  />
                </div>
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

          {/* MCP 页签的操作按钮：面板尚未挂载（bindActions 未回传）时先不渲染 */}
          {pageTab === 'mcp' && mcpActions && (
            <div className={headerActionRowClass}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className={tabToolbarControlClass}
                    onClick={mcpActions.reload}
                    disabled={mcpActions.isReloading}
                  >
                    {mcpActions.isReloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1">{t('mcpConfig.reload')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {t('mcpConfig.reload')} - {t('mcpConfig.description')}
                  </p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="outline"
                className={tabToolbarControlClass}
                onClick={() => navigate('/mcp-market')}
              >
                <Store className="h-4 w-4 mr-1" />
                {t('mcpConfig.market')}
              </Button>
              <Button
                variant="outline"
                className={tabToolbarControlClass}
                onClick={mcpActions.openImport}
              >
                <FileJson className="h-4 w-4 mr-1" />
                {t('mcpConfig.importJson')}
              </Button>
              <Button className={tabToolbarControlClass} onClick={mcpActions.openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                {t('mcpConfig.addConfig')}
              </Button>
            </div>
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

      {/* 工具列表 */}
      {pageTab === 'tools' &&
        (isLoading ? (
          <div
            className={cn(
              'glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
              pageGapClass,
            )}
          >
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
            <div
              className={cn(
                'glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                pageGapClass,
              )}
            >
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

      {/* MCP 配置（原 /mcp-config 整页内容，已并入本页签） */}
      {pageTab === 'mcp' && <MCPConfigPanel bindActions={setMcpActions} />}

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
