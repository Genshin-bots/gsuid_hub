import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Wrench, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { aiToolsApi, AITool } from '@/lib/api';
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
  const lines = tool.description.split('\n');
  const firstLine = lines[0].trim();
  
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

  // 当前页码（每页 PAGE_SIZE 个工具）
  const [page, setPage] = useState(1);

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
      tool.description.toLowerCase().includes(query);
  }, [searchQuery]);

  // 按筛选条件过滤后的工具列表
  const filteredTools = useMemo(() => {
    return tools.filter(tool =>
      (selectedCategory === 'all' || tool.category === selectedCategory) &&
      (selectedPlugin === 'all' || tool.plugin === selectedPlugin) &&
      matchesSearch(tool)
    );
  }, [tools, selectedCategory, selectedPlugin, matchesSearch]);

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
  }, [selectedCategory, selectedPlugin, searchQuery]);

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
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="min-w-0 overflow-x-auto">
        <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
          <Wrench className="w-8 h-8 shrink-0" />
          {t('aiTools.title')}
        </h1>
        <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiTools.description')}</p>
      </div>

      {/* 筛选区域 */}
      {!isLoading && categories.length > 0 && (
        <div className="space-y-4">
          {/* 分类筛选 */}
          <TabButtonGroup
            options={categoryList.map((category) => ({
              value: category,
              label: category === 'all'
                ? `${t('aiTools.allCategories') || '全部分类'} (${categoryCounts.all || 0})`
                : `${category} (${categoryCounts[category] || 0})`,
              icon: <Wrench className="w-4 h-4" />,
              // 当前筛选下数量为 0 的分类置灰(全部/已选中的除外)
              disabled: category !== 'all'
                && category !== selectedCategory
                && (categoryCounts[category] || 0) === 0,
            }))}
            value={selectedCategory}
            onValueChange={setSelectedCategory}
          />

          {/* 插件筛选 */}
          <TabButtonGroup
            options={pluginList.map((plugin) => ({
              value: plugin,
              label: plugin === 'all'
                ? `${t('aiTools.allPlugins') || '全部插件'} (${pluginCounts.all || 0})`
                : `${plugin} (${pluginCounts[plugin] || 0})`,
              icon: <Wrench className="w-4 h-4" />,
              // 当前筛选下数量为 0 的插件置灰(全部/已选中的除外)
              disabled: plugin !== 'all'
                && plugin !== selectedPlugin
                && (pluginCounts[plugin] || 0) === 0,
            }))}
            value={selectedPlugin}
            onValueChange={setSelectedPlugin}
          />

          {/* 搜索筛选 */}
          <Input
            type="text"
            placeholder={t('aiTools.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-sm"
          />

          {/* 工具统计 */}
          <p className="text-sm text-muted-foreground">
            {t('aiTools.toolCount', { count: filteredTools.length, total: totalCount })}
          </p>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
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

      {/* 工具列表 */}
      {isLoading ? (
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
          {pagedTools.map((tool) => (
            <Card
              key={tool.name}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary/50",
                isGlass ? "glass-card" : "border border-border/50"
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
          ))}
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
      )}

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
    </div>
  );
}
