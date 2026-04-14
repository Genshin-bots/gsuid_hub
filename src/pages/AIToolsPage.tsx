import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Wrench, AlertCircle } from 'lucide-react';
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
  summary: string;
  fullDescription: string;
  plugin: string;
  category: string;
}

// ============================================================================
// 工具函数
// ============================================================================

function parseToolDescription(tool: AITool): ParsedTool {
  const lines = tool.description.split('\n');
  const firstLine = lines[0];
  // 如果第一行字数小于11，则作为标题
  const title = firstLine.length < 11 ? firstLine : tool.name;
  
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
    summary,
    fullDescription: tool.description,
    plugin: tool.plugin,
    category: tool.category,
  };
}

// ============================================================================
// 组件定义
// ============================================================================

export default function AIToolsPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // 状态
  const [tools, setTools] = useState<AITool[]>([]);
  const [toolsByCategory, setToolsByCategory] = useState<Record<string, AITool[]>>({});
  const [toolsByPlugin, setToolsByPlugin] = useState<Record<string, AITool[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [plugins, setPlugins] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<ParsedTool | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // 筛选状态 - 同时支持分类和插件筛选
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<string>('all');

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

  // 按筛选条件过滤后的工具列表
  const filteredTools = useMemo(() => {
    let result = tools;
    
    if (selectedCategory !== 'all') {
      result = result.filter(tool => tool.category === selectedCategory);
    }
    
    if (selectedPlugin !== 'all') {
      result = result.filter(tool => tool.plugin === selectedPlugin);
    }
    
    return result;
  }, [tools, selectedCategory, selectedPlugin]);

  // 解析后的工具列表
  const parsedTools = useMemo(() => {
    return filteredTools.map(tool => parseToolDescription(tool));
  }, [filteredTools]);

  // 加载工具列表
  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await aiToolsApi.getToolsList();
        setTools(data.tools || []);
        setToolsByCategory(data.by_category || {});
        setToolsByPlugin(data.by_plugin || {});
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
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Wrench className="w-8 h-8" />
          {t('aiTools.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('aiTools.description')}</p>
      </div>

      {/* 筛选区域 */}
      {!isLoading && categories.length > 0 && (
        <div className="space-y-4">
          {/* 分类筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('aiTools.category') || '分类'}：</span>
            <TabButtonGroup
              options={categoryList.map((category) => ({
                value: category,
                label: category === 'all'
                  ? (t('aiTools.allCategories') || '全部分类')
                  : `${category} (${toolsByCategory[category]?.length || 0})`,
                icon: <Wrench className="w-4 h-4" />,
              }))}
              value={selectedCategory}
              onValueChange={setSelectedCategory}
              glassClassName={isGlass ? 'glass-card' : 'border border-border/50'}
            />
          </div>

          {/* 插件筛选 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('aiTools.plugin') || '插件'}：</span>
            <TabButtonGroup
              options={pluginList.map((plugin) => ({
                value: plugin,
                label: plugin === 'all'
                  ? (t('aiTools.allPlugins') || '全部插件')
                  : `${plugin} (${toolsByPlugin[plugin]?.length || 0})`,
                icon: <Wrench className="w-4 h-4" />,
              }))}
              value={selectedPlugin}
              onValueChange={setSelectedPlugin}
              glassClassName={isGlass ? 'glass-card' : 'border border-border/50'}
            />
          </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parsedTools.map((tool) => (
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
                  {tool.name}
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
      )}

      {/* 工具详情弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              {selectedTool?.name}
            </DialogTitle>
            <DialogDescription className="text-base">
              {selectedTool?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('aiTools.category') || '分类'}：</span>
              <span className="px-2 py-0.5 rounded bg-secondary">{selectedTool?.category}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('aiTools.plugin') || '插件'}：</span>
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
