import { useCallback, useEffect, useState } from 'react';
import { Boxes, Loader2, Search, Wrench } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  aiToolsApi,
  getApiErrorMessage,
  type AITool,
  type AIToolAssemblePreviewResponse,
} from '@/lib/api';

/** Assemble seed/pool chip with hover tooltip (same pattern as AI History tools_list). */
function AssembleToolChip({
  name,
  plugin,
  variant,
  toolMeta,
  noInfoLabel,
  description,
  category,
}: {
  name: string;
  plugin?: string;
  variant: 'outline' | 'secondary';
  toolMeta?: AITool | null;
  noInfoLabel: string;
  /** 预览条目自带描述/分类；旧后端缺省时回退 toolMeta */
  description?: string;
  category?: string;
}) {
  const descText = (description ?? toolMeta?.description ?? '').trim();
  const metaLine = [plugin || toolMeta?.plugin, category ?? toolMeta?.category]
    .filter(Boolean)
    .join(' · ');

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
        {descText ? (
          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {descText.split('\n')[0]}
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

export function AssemblePanel() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIToolAssemblePreviewResponse | null>(null);
  const [toolMetaMap, setToolMetaMap] = useState<ReadonlyMap<string, AITool> | null>(null);

  // 旧后端 assemble_preview 不带描述时的回退数据；新后端返回自带描述，这份只是兜底
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await aiToolsApi.getToolsList();
        if (!cancelled) {
          setToolMetaMap(new Map((data.tools ?? []).map((x) => [x.name, x])));
        }
      } catch {
        // 兜底元数据拉取失败不阻塞预览：chips 退回接口自带字段
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runPreview = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      toast.error(t('aiTools.assemble.queryRequired'));
      return;
    }
    setLoading(true);
    try {
      setResult(await aiToolsApi.assemblePreview(q));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('aiTools.assemble.failed')));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [query, t]);

  return (
    <div className={pageStackClass}>
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('aiTools.assemble.queryPlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && void runPreview()}
              />
              <Button className="h-9" onClick={() => void runPreview()} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {t('aiTools.assemble.run')}
              </Button>
            </div>
          </div>
          {result && (
            <TooltipProvider delayDuration={150}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 pt-2">
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{t('aiTools.assemble.seeds')}</h4>
                    <Badge variant="secondary">{result.seeds?.length ?? 0}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(result.seeds ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">{t('common.noData')}</span>
                    )}
                    {(result.seeds ?? []).map((s) => (
                      <AssembleToolChip
                        key={`seed-${s.name}`}
                        name={s.name}
                        plugin={s.plugin}
                        description={s.description}
                        category={s.category}
                        variant="outline"
                        toolMeta={toolMetaMap?.get(s.name)}
                        noInfoLabel={t('aiTools.assemble.toolNoInfo')}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{t('aiTools.assemble.pool')}</h4>
                    <Badge variant="secondary">{result.pool?.length ?? 0}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    core={result.core_pool_size ?? 0} · recall={result.recall ?? 0} · max_extra=
                    {result.max_extra ?? 0}
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-auto">
                    {(result.pool ?? []).length === 0 && (
                      <span className="text-xs text-muted-foreground">{t('common.noData')}</span>
                    )}
                    {(result.pool ?? []).map((s) => (
                      <AssembleToolChip
                        key={`pool-${s.name}`}
                        name={s.name}
                        plugin={s.plugin}
                        description={s.description}
                        category={s.category}
                        variant="secondary"
                        toolMeta={toolMetaMap?.get(s.name)}
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
  );
}
