import * as React from 'react';
import { ArrowUpRight, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { DynamicConfigPanel, type ConfigValue } from '@/components/config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PluginConfigItem } from '@/lib/api';
import { EmptyState } from '../shared/ProgressivePrimitives';
import type { DomainId, FrameworkSearchHit } from '../types';

export interface GlobalSearchResultsProps {
  hits: FrameworkSearchHit[];
  searchQuery: string;
  onlyChanged: boolean;
  getDomainLabel: (domain: DomainId) => string;
  onJumpToDomain: (domain: DomainId) => void;
  onClearFilter: () => void;
  onUpdateField: (groupId: string, fieldKey: string, value: ConfigValue | unknown) => void;
  onResetField: (groupId: string, fieldKey: string) => void;
}

export function GlobalSearchResults({
  hits,
  searchQuery,
  onlyChanged,
  getDomainLabel,
  onJumpToDomain,
  onClearFilter,
  onUpdateField,
  onResetField,
}: GlobalSearchResultsProps) {
  const { t } = useLanguage();

  const grouped = React.useMemo(() => {
    const map = new Map<
      string,
      {
        groupId: string;
        groupName: string;
        domain: DomainId;
        configSlice: Record<string, PluginConfigItem>;
        modifiedKeys: string[];
      }
    >();

    hits.forEach((hit) => {
      let bucket = map.get(hit.groupId);
      if (!bucket) {
        bucket = {
          groupId: hit.groupId,
          groupName: hit.groupName,
          domain: hit.domain,
          configSlice: {},
          modifiedKeys: [],
        };
        map.set(hit.groupId, bucket);
      }
      bucket.configSlice[hit.fieldKey] = hit.item;
      if (hit.isModified) {
        bucket.modifiedKeys.push(hit.fieldKey);
      }
    });

    return Array.from(map.values());
  }, [hits]);

  if (grouped.length === 0) {
    return (
      <Card className="glass-card p-6">
        <EmptyState
          icon={<Search className="h-8 w-8 text-muted-foreground" />}
          title={
            onlyChanged && !searchQuery.trim()
              ? t('frameworkConfig.search.noModifiedItems')
              : t('frameworkConfig.search.noMatchTitle')
          }
          description={t('frameworkConfig.search.noMatchDesc')}
          action={
            <Button type="button" variant="outline" size="sm" onClick={onClearFilter}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              {t('frameworkConfig.search.clearFilter')}
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex min-w-0 items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0 truncate">
            {t('frameworkConfig.search.resultSummary', {
              count: hits.length,
              groups: grouped.length,
            })}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearFilter}
          className="h-8 shrink-0 gap-1 px-2 text-xs"
        >
          <X className="h-3.5 w-3.5" />
          {t('frameworkConfig.search.clearFilter')}
        </Button>
      </div>

      {grouped.map((bucket) => (
        <Card key={bucket.groupId} className="glass-card space-y-4 p-4 sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Badge
                variant="outline"
                className="h-5 shrink-0 border-primary/30 bg-primary/10 px-2 text-[11px] font-medium text-foreground"
              >
                {getDomainLabel(bucket.domain)}
              </Badge>
              <h3
                className="min-w-0 truncate text-base font-semibold text-foreground"
                title={bucket.groupName}
              >
                {bucket.groupName}
              </h3>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {bucket.modifiedKeys.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    bucket.modifiedKeys.forEach((k) => {
                      onResetField(bucket.groupId, k);
                    });
                  }}
                  className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">
                    {t('frameworkConfig.progressive.resetSection')}
                  </span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onJumpToDomain(bucket.domain)}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <span>{t('frameworkConfig.search.jumpToSection')}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <DynamicConfigPanel
            config={bucket.configSlice}
            configId={bucket.groupId}
            onChange={onUpdateField}
          />
        </Card>
      ))}
    </div>
  );
}
