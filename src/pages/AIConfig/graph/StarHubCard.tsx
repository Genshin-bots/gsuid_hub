import { AlertTriangle, Check, Edit3, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModelBrandIcon, ProviderBrandIcon } from '@/components/ui/model-brand-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AITaskGraphHubNode, AllConfigItem } from '@/lib/api';
import { cn, formatTokens } from '@/lib/utils';
import { formatUsageShare, type StarHubLayoutItem, type StarUsageMetric } from './starGraphModel';

export interface StarHubCardProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  item: StarHubLayoutItem;
  allConfigsList: readonly AllConfigItem[];
  configByName: ReadonlyMap<string, AllConfigItem>;
  metric: StarUsageMetric;
  /** 图谱内是否存在非零用量，用于决定是否渲染星核底部占比进度条 */
  hasAnyGraphUsage?: boolean;
  /** 动态半高（显示占比进度条时略高，供坐标居中与连线终点保持一致） */
  halfHeight?: number;
  /** 实际高档默认槽位（chat 连向的星核，与后端槽位推导语义一致） */
  isHighDefault: boolean;
  /** 实际低档默认槽位（turn_router 连向的星核） */
  isLowDefault: boolean;
  isHighlighted: boolean;
  isDropTarget: boolean;
  isUnconfiguredBlocked: boolean;
  isDragging?: boolean;
  canRemove: boolean;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onPointerDownHub: (e: React.PointerEvent<HTMLDivElement>, hubId: string) => void;
  onSelectPrimary: (hubId: string, fullName: string) => void;
  onSelectSecondary: (hubId: string, fullName: string) => void;
  onRequestCreateForHub: (hubId: string) => void;
  onOpenEditConfig: (configName: string, provider: string) => void;
  onRequestRemoveHub: (node: AITaskGraphHubNode, connectedCount: number) => void;
}

export const HUB_CARD_HALF_W = 112;
export const HUB_CARD_HALF_H = 50;
export const HUB_CARD_HALF_H_WITH_USAGE = 58;

function providerShortLabel(provider: string): string {
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'gemini') return 'Gemini';
  return provider;
}

export function StarHubCard({
  t,
  item,
  allConfigsList,
  configByName,
  metric,
  hasAnyGraphUsage = false,
  halfHeight = HUB_CARD_HALF_H,
  isHighDefault,
  isLowDefault,
  isHighlighted,
  isDropTarget,
  isUnconfiguredBlocked,
  isDragging = false,
  canRemove,
  popoverOpen,
  onPopoverOpenChange,
  onPointerDownHub,
  onSelectPrimary,
  onSelectSecondary,
  onRequestCreateForHub,
  onOpenEditConfig,
  onRequestRemoveHub,
}: StarHubCardProps) {
  const { node, x, y, connectedTaskCount, totalTokens, totalRequests, usageShare } = item;
  const primaryItem = node.primary ? configByName.get(node.primary) : undefined;
  const secondaryItem = node.secondary ? configByName.get(node.secondary) : undefined;
  const isPlaceholder = !node.primary;
  const isMissingFile = Boolean(node.primary && !primaryItem);

  const rolePlaceholderTitle =
    node.role === 'high'
      ? t('aiConfig.starGraph.placeholderHigh')
      : node.role === 'low'
        ? t('aiConfig.starGraph.placeholderLow')
        : t('aiConfig.starGraph.placeholderCustom');

  const usageSummaryText =
    metric === 'tokens'
      ? `${formatTokens(totalTokens)} tok`
      : t('aiConfig.starGraph.requestsShort', { count: totalRequests.toLocaleString() });

  const secondaryCandidates = allConfigsList.filter((c) => c.name !== node.primary);

  const handleCardClick = () => {
    if (isPlaceholder && allConfigsList.length === 0) {
      onRequestCreateForHub(node.id);
      return;
    }
    onPopoverOpenChange(!popoverOpen);
  };

  return (
    <div
      data-hub-id={node.id}
      style={{
        transform: `translate(${x - HUB_CARD_HALF_W}px, ${y - halfHeight}px)`,
        width: HUB_CARD_HALF_W * 2,
      }}
      className={cn(
        'absolute left-0 top-0 z-20 select-none',
        !isDragging && 'transition-transform duration-200 ease-out',
      )}
      onPointerDown={(e) => onPointerDownHub(e, node.id)}
    >
      <Popover open={popoverOpen} onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick();
              }
            }}
            className={cn(
              'glass-card rounded-2xl p-3 transition-all duration-200 cursor-pointer border',
              isPlaceholder
                ? 'border-dashed border-primary/60 bg-primary/5 hover:bg-primary/10'
                : isMissingFile
                  ? 'border-destructive/70 ring-2 ring-destructive/20'
                  : 'border-border/70 hover:border-primary/60',
              isHighlighted && 'ring-2 ring-primary/40 border-primary/70 shadow-lg',
              isDropTarget && 'scale-105 ring-4 ring-primary/50 border-primary',
              isUnconfiguredBlocked && 'ring-2 ring-amber-500/70 border-amber-500',
            )}
          >
            {isPlaceholder ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-primary/50 bg-primary/10 text-primary">
                  <Plus className="h-6 w-6 shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="text-xs font-semibold text-foreground truncate"
                      title={rolePlaceholderTitle}
                    >
                      {rolePlaceholderTitle}
                    </span>
                  </div>
                  <p
                    className="mt-0.5 text-[11px] text-primary/90 truncate"
                    title={t('aiConfig.starGraph.clickToConfigure')}
                  >
                    {t('aiConfig.starGraph.clickToConfigure')} ·{' '}
                    {t('aiConfig.starGraph.connectedCount', { count: connectedTaskCount })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/50 border border-border/50">
                    <ModelBrandIcon
                      modelName={primaryItem?.model_name}
                      provider={primaryItem?.provider}
                      size={30}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="text-sm font-semibold truncate text-foreground"
                        title={primaryItem?.config_name ?? node.primary}
                      >
                        {primaryItem?.config_name ?? node.primary}
                      </span>
                      {isHighDefault && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[10px] font-normal shrink-0"
                        >
                          {t('aiConfig.starGraph.roleHighBadge')}
                        </Badge>
                      )}
                      {isLowDefault && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[10px] font-normal shrink-0"
                        >
                          {t('aiConfig.starGraph.roleLowBadge')}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground">
                      {primaryItem ? (
                        <>
                          <ProviderBrandIcon
                            provider={primaryItem.provider}
                            size={11}
                            className="shrink-0"
                          />
                          <span className="truncate" title={primaryItem.model_name}>
                            {primaryItem.model_name}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive truncate">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {t('aiConfig.starGraph.configMissing')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-border/40 pt-1.5">
                  <div className="flex items-center justify-between gap-1.5 text-[10px] text-muted-foreground">
                    <span className="truncate shrink-0">
                      {t('aiConfig.starGraph.connectedCount', { count: connectedTaskCount })} ·{' '}
                      {usageSummaryText}
                    </span>
                    {node.secondary && (
                      <span
                        className="inline-flex min-w-0 items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300"
                        title={`${t('aiConfig.starGraph.backupLabel')}: ${secondaryItem?.config_name ?? node.secondary}`}
                      >
                        <ShieldCheck className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {secondaryItem?.config_name ?? node.secondary}
                        </span>
                      </span>
                    )}
                  </div>

                  {hasAnyGraphUsage && (
                    <div
                      className="flex items-center gap-2"
                      title={t('aiConfig.starGraph.usageShareOfTotal', {
                        share: formatUsageShare(usageShare),
                      })}
                    >
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                        {usageShare > 0 && (
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                            style={{
                              width: `${Math.min(100, Math.max(3, usageShare * 100))}%`,
                            }}
                          />
                        )}
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-[10px] tabular-nums',
                          usageShare > 0
                            ? 'font-semibold text-foreground/90'
                            : 'text-muted-foreground/70',
                        )}
                      >
                        {formatUsageShare(usageShare)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="w-80 p-3 space-y-3 glass-card"
          align="center"
          sideOffset={8}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground truncate">
              {t('aiConfig.starGraph.hubInspectorTitle')}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {primaryItem && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => {
                    onPopoverOpenChange(false);
                    onOpenEditConfig(primaryItem.config_name, primaryItem.provider);
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5 shrink-0" />
                  {t('common.edit')}
                </Button>
              )}
              {canRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  title={t('aiConfig.starGraph.removeHub')}
                  onClick={() => {
                    onPopoverOpenChange(false);
                    onRequestRemoveHub(node, connectedTaskCount);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                {t('aiConfig.taskModels.primaryLabel')}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                onClick={() => {
                  onPopoverOpenChange(false);
                  onRequestCreateForHub(node.id);
                }}
              >
                <Plus className="h-3 w-3 shrink-0" />
                {t('aiConfig.openaiConfig.createNew')}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border/50 p-1">
              {allConfigsList.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  {t('aiConfig.taskConfig.emptyHint')}
                </p>
              ) : (
                allConfigsList.map((cfg) => {
                  const selected = cfg.name === node.primary;
                  return (
                    <button
                      key={cfg.name}
                      type="button"
                      onClick={() => onSelectPrimary(node.id, cfg.name)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                        selected ? 'bg-primary/12 text-foreground' : 'hover:bg-muted/60',
                      )}
                    >
                      <ModelBrandIcon
                        modelName={cfg.model_name}
                        provider={cfg.provider}
                        size={16}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium truncate">{cfg.config_name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {providerShortLabel(cfg.provider)}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {cfg.model_name}
                        </p>
                      </div>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {node.primary && (
            <div className="space-y-1.5 border-t border-border/40 pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {t('aiConfig.taskModels.secondaryLabel')}
                </span>
                {node.secondary && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => onSelectSecondary(node.id, '')}
                  >
                    <X className="h-3 w-3 shrink-0" />
                    {t('aiConfig.taskModels.clearSecondary')}
                  </button>
                )}
              </div>
              {secondaryCandidates.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {t('aiConfig.starGraph.noBackupCandidate')}
                </p>
              ) : (
                <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-border/50 p-1">
                  {secondaryCandidates.map((cfg) => {
                    const selected = cfg.name === node.secondary;
                    return (
                      <button
                        key={`sec-${cfg.name}`}
                        type="button"
                        onClick={() => onSelectSecondary(node.id, selected ? '' : cfg.name)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors',
                          selected ? 'bg-emerald-500/12 text-foreground' : 'hover:bg-muted/60',
                        )}
                      >
                        <ModelBrandIcon
                          modelName={cfg.model_name}
                          provider={cfg.provider}
                          size={14}
                        />
                        <span className="text-xs truncate flex-1">{cfg.config_name}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[96px]">
                          {cfg.model_name}
                        </span>
                        {selected && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
