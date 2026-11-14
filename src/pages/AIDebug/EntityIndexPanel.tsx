import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Network, Search } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { tabToolbarShellControlClass } from '@/components/ui/TabButtonGroup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { aiToolsApi, getApiErrorMessage, type AIEntityIndexResponse } from '@/lib/api';
import { entityIndexPageRange, resolveEntityIndexEntries } from '@/lib/featureUtils';

const ENTITY_PAGE_SIZE = 50;

export function EntityIndexPanel() {
  const { t } = useLanguage();
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

  // 面板挂载即拉取；改筛选 / 翻页 / 点刷新都重新拉。
  // 依赖里不放 entityIndex，否则加载完写回 state 又会触发一次。
  useEffect(() => {
    void loadEntityIndex();
  }, [entityRefreshKey, loadEntityIndex]);

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

  return (
    <div className={pageStackClass}>
      {/* 筛选行：搜索 + 只看归属冲突。高度对齐页签外壳，右对齐不拉伸 */}
      <div className="flex min-w-0 w-full items-center gap-2 md:justify-end">
        <div className="relative min-w-0 flex-[1.3] md:max-w-[20rem]">
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
                      <td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        {entityFilter.conflictOnly && !entityFilter.search
                          ? t('aiTools.entityIndex.conflictEmpty')
                          : t('common.noData')}
                      </td>
                    </tr>
                  ) : (
                    entityEntries.map((entry) => (
                      <tr key={entry.surface} className="border-b border-border/30">
                        <td className="py-2 px-2 text-sm text-muted-foreground">{entry.surface}</td>
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
  );
}
