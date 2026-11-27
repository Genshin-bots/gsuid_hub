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
import {
  buildRoundedRectRingPath,
  computeRingFillPercent,
  formatUsageShare,
  resolveSatelliteAccentColor,
  type StarSatelliteItem,
  type StarUsageMetric,
} from './starGraphModel';

/** 环绕进度条中心线相对卡片外边缘的外扩距离（px），供连线起点与拉线圆点对齐。 */
export const SATELLITE_RING_OUTSET = 4;

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
  /** 当前主题全局圆角（px），用于让环绕进度条与 glass-card 圆角保持同心 */
  borderRadius: number;
  /** 图谱中是否存在任意非零用量 */
  hasAnyGraphUsage: boolean;
  isHighlighted: boolean;
  isStripFocused?: boolean;
  isBatchSelected?: boolean;
  isParentDropTarget?: boolean;
  isDimmed: boolean;
  isDragging?: boolean;
  popoverOpen: boolean;
  onHoverChange?: (satelliteId: string | null) => void;
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
  borderRadius,
  hasAnyGraphUsage,
  isHighlighted,
  isStripFocused = false,
  isBatchSelected = false,
  isParentDropTarget = false,
  isDimmed,
  isDragging = false,
  popoverOpen,
  onHoverChange,
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
    metricValue,
    usageShare,
    hubUsageShare,
    tokens,
    requests,
  } = satellite;
  const diameter = radius * 2;
  const isMainChat = kind.id === 'chat';
  const isAutonomy = kind.id === 'autonomy';
  const isChild = tier === 'child';
  const childCount = childKinds.length;

  const ringOuterRadius = radius + SATELLITE_RING_OUTSET;
  const ringStrokeWidth = isChild ? 2.75 : 3.5;
  const ringSvgBleed = 4;
  const ringSvgSize = (ringOuterRadius + ringSvgBleed) * 2;
  const cardCornerRadius = Math.min(borderRadius, radius);
  const ringCornerRadius =
    cardCornerRadius <= 0 ? 0 : Math.min(cardCornerRadius + SATELLITE_RING_OUTSET, ringOuterRadius);
  const ringPath = buildRoundedRectRingPath(ringSvgSize, ringSvgBleed, ringCornerRadius);
  const ringFillPercent = computeRingFillPercent(usageShare, metricValue > 0);
  const accentColor = resolveSatelliteAccentColor(kind, isDetachedChild);
  const shareText = formatUsageShare(usageShare);
  const showShareOnLabel = hasAnyGraphUsage && metricValue > 0;
  const showHubShareSeparately = hubUsageShare > 0 && Math.abs(hubUsageShare - usageShare) >= 0.005;

  const angleToAnchor = Math.atan2(anchorY - y, anchorX - x);
  const handleOffsetX = Math.cos(angleToAnchor) * ringOuterRadius;
  const handleOffsetY = Math.sin(angleToAnchor) * ringOuterRadius;

  const title = resolveKindTitle(kind, tr);
  const desc = tr(`aiConfig.taskModels.kinds.${kind.id}.desc`, kind.desc);

  const metricShort =
    metric === 'tokens'
      ? formatTokens(tokens)
      : t('aiConfig.starGraph.requestsShort', { count: requests.toLocaleString() });

  const iconSize = Math.round(radius * 0.96);
  const iconStrokeWidth = radius >= 38 ? 1.85 : 2;
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
            onMouseEnter={() => onHoverChange?.(id)}
            onMouseLeave={() => onHoverChange?.(null)}
            onClick={(e) => {
              e.stopPropagation();
              // 由 onSelectSatellite 统一裁决弹窗开关与子节点展开/收回，避免 Radix PopoverTrigger 二次翻转状态
              e.preventDefault();
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
                ? 'border-primary/80 bg-primary/15 text-primary shadow-md'
                : isAutonomy
                  ? 'border-amber-500/80 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-md'
                  : isChild
                    ? isDetachedChild
                      ? 'border-sky-500/75 bg-sky-500/12 text-sky-600 dark:text-sky-400 shadow-sm'
                      : 'border-dashed border-primary/50 bg-background/85 text-foreground/90 hover:border-primary'
                    : 'border-border/80 hover:border-primary/65 text-foreground',
              isExpandedParent &&
                !isMainChat &&
                !isAutonomy &&
                'ring-2 ring-primary/30 border-primary/65',
              (isHighlighted || isStripFocused) && 'scale-105 ring-2 ring-primary/55',
              isBatchSelected && 'scale-105 border-primary ring-[3px] ring-primary/70 shadow-lg',
              isParentDropTarget && 'scale-110 ring-4 ring-emerald-500/50 border-emerald-500',
            )}
          >
            {/* 贴合圆角外缘的顺时针环绕用量进度条（从 12 点钟方向起顺时针填充） */}
            <svg
              aria-hidden="true"
              width={ringSvgSize}
              height={ringSvgSize}
              viewBox={`0 0 ${ringSvgSize} ${ringSvgSize}`}
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              className="pointer-events-none absolute overflow-visible"
            >
              <path
                d={ringPath}
                fill="none"
                stroke={
                  metricValue > 0
                    ? 'hsl(var(--foreground) / 0.14)'
                    : 'hsl(var(--foreground) / 0.08)'
                }
                strokeWidth={ringStrokeWidth}
                strokeDasharray={metricValue === 0 && hasAnyGraphUsage ? '3 3' : undefined}
              />
              {ringFillPercent > 0 && (
                <path
                  d={ringPath}
                  pathLength={100}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={isStripFocused ? ringStrokeWidth + 0.75 : ringStrokeWidth}
                  strokeLinecap={ringFillPercent >= 100 ? 'butt' : 'round'}
                  strokeDasharray={ringFillPercent >= 100 ? undefined : `${ringFillPercent} 102`}
                  strokeDashoffset={0}
                  style={{
                    transition: 'stroke-dasharray 320ms ease, stroke-width 200ms ease',
                    filter:
                      usageShare >= 0.05 || isStripFocused
                        ? `drop-shadow(0 0 3px ${accentColor})`
                        : undefined,
                  }}
                />
              )}
            </svg>

            {isBatchSelected && (
              <span className="absolute -left-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
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
                className="absolute -right-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-border/60 bg-background text-amber-500 shadow-sm"
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
                  'absolute -bottom-1.5 -right-2 z-10 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm transition-colors',
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

        {/* 气泡正下方单行截断标签与占比读数 */}
        <div
          style={{ top: ringOuterRadius + 6 }}
          className={cn(
            'pointer-events-none absolute left-1/2 -translate-x-1/2 flex flex-col items-center',
            isChild ? 'w-28' : 'w-32',
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
          <span
            className={cn(
              'mt-0.5 max-w-full truncate text-[10px] tabular-nums',
              showShareOnLabel ? 'text-muted-foreground' : 'text-muted-foreground/70',
            )}
            title={showShareOnLabel ? `${metricShort} · ${shareText}` : metricShort}
          >
            {metricShort}
            {showShareOnLabel && (
              <>
                {' · '}
                <span className="font-semibold text-foreground/90">{shareText}</span>
              </>
            )}
          </span>
        </div>

        <PopoverContent
          side={preferredPopoverSide}
          align="center"
          sideOffset={14}
          collisionPadding={12}
          className="w-72 p-3 space-y-2.5 glass-card"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="space-y-1.5 min-w-0">
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
            {hasAnyGraphUsage && (
              <div className="space-y-1 pt-0.5">
                {metricValue > 0 ? (
                  <>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                      <div
                        className="h-full rounded-full transition-[width] duration-300 ease-out"
                        style={{
                          width: `${Math.min(100, Math.max(2, usageShare * 100))}%`,
                          backgroundColor: accentColor,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums text-muted-foreground">
                      <span className="truncate font-medium text-foreground/85">
                        {t('aiConfig.starGraph.usageShareOfTotal', { share: shareText })}
                      </span>
                      {showHubShareSeparately && (
                        <span className="truncate shrink-0">
                          {t('aiConfig.starGraph.usageShareOfHub', {
                            share: formatUsageShare(hubUsageShare),
                          })}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground/80">
                    {t('aiConfig.starGraph.usageShareZero')}
                  </p>
                )}
              </div>
            )}
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
