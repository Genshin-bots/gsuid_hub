import { Check, ChevronDown, ChevronRight, CornerUpLeft, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModelBrandIcon } from '@/components/ui/model-brand-icon';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  resolveKindTitle,
  resolveNodeSourceBadge,
  resolveTaskKindIcon,
  type TrFn,
} from '@/lib/aiTaskKinds';
import type { AITaskGraphHubNode, AllConfigItem } from '@/lib/api';
import { cn, formatTokens } from '@/lib/utils';
import type { StarSatelliteItem, StarUsageMetric } from './starGraphModel';

export interface StarSatelliteBubbleProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  tr: TrFn;
  satellite: StarSatelliteItem;
  anchorX: number;
  anchorY: number;
  parentTitle?: string;
  preferredPopoverSide: 'top' | 'bottom' | 'left' | 'right';
  hubNodes: readonly AITaskGraphHubNode[];
  configByName: ReadonlyMap<string, AllConfigItem>;
  metric: StarUsageMetric;
  isHighlighted: boolean;
  isBatchSelected?: boolean;
  isParentDropTarget?: boolean;
  isDimmed: boolean;
  isDragging?: boolean;
  popoverOpen: boolean;
  onSelectSatellite: (
    satellite: StarSatelliteItem,
    e: React.MouseEvent | React.KeyboardEvent,
  ) => void;
  onToggleExpandParent: (parentTaskId: string) => void;
  onPopoverOpenChange: (open: boolean) => void;
  onPointerDownSatellite: (e: React.PointerEvent<HTMLDivElement>, satelliteId: string) => void;
  onPointerDownWireHandle: (
    e: React.PointerEvent<HTMLButtonElement>,
    satellite: StarSatelliteItem,
  ) => void;
  onConnectToHub: (taskId: string, targetHubId: string) => void;
  onReattachToParent: (childTaskId: string) => void;
}

export function StarSatelliteBubble({
  t,
  tr,
  satellite,
  anchorX,
  anchorY,
  parentTitle,
  preferredPopoverSide,
  hubNodes,
  configByName,
  metric,
  isHighlighted,
  isBatchSelected = false,
  isParentDropTarget = false,
  isDimmed,
  isDragging = false,
  popoverOpen,
  onSelectSatellite,
  onToggleExpandParent,
  onPopoverOpenChange,
  onPointerDownSatellite,
  onPointerDownWireHandle,
  onConnectToHub,
  onReattachToParent,
}: StarSatelliteBubbleProps) {
  const {
    id,
    kind,
    tier,
    childKinds,
    isExpandedParent,
    isDetachedChild,
    radius,
    x,
    y,
    tokens,
    requests,
  } = satellite;
  const diameter = radius * 2;
  const isMainChat = kind.id === 'chat';
  const isAutonomy = kind.id === 'autonomy';
  const isChild = tier === 'child';
  const childCount = childKinds.length;

  const angleToAnchor = Math.atan2(anchorY - y, anchorX - x);
  const handleOffsetX = Math.cos(angleToAnchor) * radius;
  const handleOffsetY = Math.sin(angleToAnchor) * radius;

  const title = resolveKindTitle(kind, tr);
  const desc = tr(`aiConfig.taskModels.kinds.${kind.id}.desc`, kind.desc);

  const metricShort =
    metric === 'tokens'
      ? formatTokens(tokens)
      : t('aiConfig.starGraph.requestsShort', { count: requests.toLocaleString() });

  const iconSize = Math.round(radius * 1.04);
  const iconStrokeWidth = radius >= 40 ? 1.8 : 2;
  const IconComp = resolveTaskKindIcon(kind);

  const hubDisplayLabel = (hub: AITaskGraphHubNode) => {
    if (!hub.primary) {
      return hub.role === 'high'
        ? t('aiConfig.starGraph.placeholderHigh')
        : hub.role === 'low'
          ? t('aiConfig.starGraph.placeholderLow')
          : t('aiConfig.starGraph.placeholderCustom');
    }
    return configByName.get(hub.primary)?.config_name ?? hub.primary;
  };

  return (
    <div
      style={{
        transform: `translate(${x}px, ${y}px)`,
      }}
      className={cn(
        'absolute left-0 top-0 select-none group',
        isChild ? 'z-10' : 'z-[15]',
        isDragging
          ? 'z-30 transition-opacity duration-150'
          : 'transition-[transform,opacity] duration-200 ease-out',
        isDimmed && 'opacity-35',
      )}
    >
      <Popover open={popoverOpen} onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            style={{
              width: diameter,
              height: diameter,
              marginLeft: -radius,
              marginTop: -radius,
            }}
            onPointerDown={(e) => onPointerDownSatellite(e, id)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectSatellite(satellite, e);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectSatellite(satellite, e);
              }
            }}
            className={cn(
              'relative flex items-center justify-center rounded-full border transition-transform duration-200 cursor-grab active:cursor-grabbing glass-card',
              isMainChat
                ? 'border-primary ring-4 ring-primary/25 bg-primary/15 text-primary shadow-md'
                : isAutonomy
                  ? 'border-amber-500 ring-4 ring-amber-500/20 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-md'
                  : isChild
                    ? isDetachedChild
                      ? 'border-sky-500/75 bg-sky-500/12 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'border-dashed border-primary/50 bg-background/85 text-foreground/90 hover:border-primary'
                    : 'border-border/80 hover:border-primary/65 text-foreground',
              isExpandedParent &&
                !isMainChat &&
                !isAutonomy &&
                'ring-2 ring-primary/30 border-primary/65',
              isHighlighted && 'scale-105 ring-2 ring-primary/55',
              isBatchSelected && 'scale-105 border-primary ring-[3px] ring-primary/70 shadow-lg',
              isParentDropTarget && 'scale-110 ring-4 ring-emerald-500/50 border-emerald-500',
            )}
          >
            {isBatchSelected && (
              <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <Check className="h-2.5 w-2.5 shrink-0 stroke-[3]" />
              </span>
            )}
            {kind.group === 'plugin' && kind.plugin ? (
              <span style={{ width: iconSize, height: iconSize }} className="inline-flex shrink-0">
                <PluginIcon pluginName={kind.plugin} className="h-full w-full rounded-md" />
              </span>
            ) : (
              <IconComp
                style={{ width: iconSize, height: iconSize }}
                strokeWidth={iconStrokeWidth}
                className="shrink-0"
              />
            )}

            {kind.fast && (
              <span
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border/60 bg-background text-amber-500 shadow-sm"
                title={t('aiConfig.taskModels.fastBadge')}
              >
                <Zap className="h-2.5 w-2.5 shrink-0" />
              </span>
            )}

            {childCount > 0 && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpandParent(id);
                }}
                title={
                  isExpandedParent
                    ? t('aiConfig.starGraph.collapseChildrenBtn')
                    : t('aiConfig.starGraph.expandChildrenBtn', { count: childCount })
                }
                className={cn(
                  'absolute -bottom-1 -right-1.5 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm transition-colors',
                  isExpandedParent
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-primary/45 bg-background text-primary hover:bg-primary/10',
                )}
              >
                {isExpandedParent ? (
                  <ChevronDown className="h-2.5 w-2.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                )}
                <span>{childCount}</span>
              </button>
            )}
          </div>
        </PopoverTrigger>

        {/* 朝向锚点（母节点或中心星核）的拉线圆点 */}
        <button
          type="button"
          aria-label={t('aiConfig.starGraph.dragToConnect')}
          title={t('aiConfig.starGraph.dragToConnect')}
          onPointerDown={(e) => onPointerDownWireHandle(e, satellite)}
          style={{
            transform: `translate(${handleOffsetX - 7}px, ${handleOffsetY - 7}px)`,
          }}
          className={cn(
            'absolute left-0 top-0 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background transition-transform cursor-crosshair',
            isMainChat
              ? 'bg-primary'
              : isAutonomy
                ? 'bg-amber-500'
                : isChild && !isDetachedChild
                  ? 'bg-muted-foreground/70 opacity-75 group-hover:opacity-100 hover:scale-125'
                  : 'bg-primary/85 opacity-80 group-hover:opacity-100 hover:scale-125',
          )}
        />

        {/* 气泡正下方单行截断标签 */}
        <div
          style={{ top: radius + 5 }}
          className={cn(
            'pointer-events-none absolute left-1/2 -translate-x-1/2 flex flex-col items-center',
            isChild ? 'w-24' : 'w-28',
          )}
        >
          <span
            className={cn(
              'max-w-full truncate rounded-md px-1.5 py-0.5 leading-tight backdrop-blur-sm',
              isChild ? 'text-[10px]' : 'text-[11px]',
              isMainChat
                ? 'font-semibold text-primary bg-background/80'
                : isAutonomy
                  ? 'font-semibold text-amber-600 dark:text-amber-400 bg-background/80'
                  : isChild && !isDetachedChild
                    ? 'font-medium text-muted-foreground bg-background/75'
                    : 'font-medium text-foreground/90 bg-background/75',
            )}
            title={title}
          >
            {title}
          </span>
          <span className="max-w-full truncate text-[10px] tabular-nums text-muted-foreground">
            {metricShort}
          </span>
        </div>

        <PopoverContent
          side={preferredPopoverSide}
          align="center"
          sideOffset={12}
          collisionPadding={12}
          className="w-72 p-3 space-y-2.5 glass-card"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-semibold truncate text-foreground" title={title}>
                {title}
              </span>
              {resolveNodeSourceBadge(kind, tr) ? (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] shrink-0">
                  {resolveNodeSourceBadge(kind, tr)}
                </Badge>
              ) : parentTitle ? (
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 text-[10px] shrink-0 max-w-[120px] truncate"
                >
                  {parentTitle}
                </Badge>
              ) : null}
            </div>
            {desc && <p className="text-[11px] leading-relaxed text-muted-foreground">{desc}</p>}
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {t('aiConfig.starGraph.usage30dDetail', {
                tokens: formatTokens(tokens),
                requests: requests.toLocaleString(),
              })}
            </p>
          </div>

          {childCount > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/45 bg-muted/25 px-2.5 py-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground truncate">
                {t('aiConfig.starGraph.subordinateCountHint', { count: childCount })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] shrink-0"
                onClick={() => onToggleExpandParent(id)}
              >
                {isExpandedParent
                  ? t('aiConfig.starGraph.collapseChildrenBtn')
                  : t('aiConfig.starGraph.expandChildrenShort')}
              </Button>
            </div>
          )}

          <div className="space-y-1.5 border-t border-border/40 pt-2">
            <span className="text-[11px] font-medium text-muted-foreground">
              {t('aiConfig.starGraph.switchTargetHub')}
            </span>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {hubNodes.map((hub) => {
                const cfg = hub.primary ? configByName.get(hub.primary) : undefined;
                const active = hub.id === satellite.hubId && (!isChild || isDetachedChild);
                return (
                  <button
                    key={hub.id}
                    type="button"
                    onClick={() => {
                      onConnectToHub(kind.id, hub.id);
                      onPopoverOpenChange(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      active ? 'bg-primary/12 font-medium text-primary' : 'hover:bg-muted/60',
                    )}
                  >
                    {cfg ? (
                      <ModelBrandIcon
                        modelName={cfg.model_name}
                        provider={cfg.provider}
                        size={14}
                      />
                    ) : (
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded border border-dashed border-primary/60 text-[10px] text-primary">
                        +
                      </span>
                    )}
                    <span className="truncate flex-1">{hubDisplayLabel(hub)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isChild && isDetachedChild && parentTitle && (
            <div className="border-t border-border/40 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-full gap-1.5 text-xs"
                onClick={() => {
                  onPopoverOpenChange(false);
                  onReattachToParent(kind.id);
                }}
              >
                <CornerUpLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {t('aiConfig.starGraph.followParentBtn', { parent: parentTitle })}
                </span>
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
