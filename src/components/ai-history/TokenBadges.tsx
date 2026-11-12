import React, { useState, useRef } from 'react';
import { cn, formatTokens } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, PenLine, CircleSlash, ArrowDownRight, Timer, Coins } from 'lucide-react';
import { estimateCosts, formatEstimatedCost, type CostUnit } from './usage';
import type { TraceSpan } from './TraceWaterfall';

type TFunc = (key: string, options?: Record<string, unknown>) => string;

export interface TokenBadgesProps {
  sp?: TraceSpan;
  inTok?: number;
  outTok?: number;
  cacheR?: number;
  cacheW?: number;
  costUnits?: CostUnit[];
  ttftMs?: number;
  showSigma?: boolean;
  suffix?: React.ReactNode;
  t: TFunc;
  className?: string;
  leading?: JSX.Element;
}

/**
 * Token 徽章（单轮 chat：↗in ↙out ⚡hit%；单轮 run / 整个 session：带 Σ 合计）。
 * hover 展开图例（缓存读 / 缓存写 / 未命中 / 输出 / TTFT / 估算费用）+ 构成细条进度条。
 */
export function TokenBadges({
  sp,
  inTok: inTokProp,
  outTok: outTokProp,
  cacheR: cacheRProp,
  cacheW: cacheWProp,
  costUnits: costUnitsProp,
  ttftMs: ttftMsProp,
  showSigma: showSigmaProp,
  suffix,
  t,
  className,
  leading,
}: TokenBadgesProps) {
  const inTok = inTokProp ?? (sp?.kind === 'run' ? sp.sumTokensIn : sp?.tokensIn) ?? 0;
  const outTok = outTokProp ?? (sp?.kind === 'run' ? sp.sumTokensOut : sp?.tokensOut) ?? 0;
  const cacheR = cacheRProp ?? (sp?.kind === 'run' ? sp.sumCacheRead : sp?.cacheRead) ?? 0;
  const cacheW = cacheWProp ?? (sp?.kind === 'run' ? sp.sumCacheWrite : sp?.cacheWrite) ?? 0;
  const ttftMs = ttftMsProp ?? sp?.ttftMs;
  const showSigma = showSigmaProp ?? sp?.kind === 'run';

  const [cost, setCost] = useState<number | null>(null);
  const costRequested = useRef(false);

  if (!inTok && !outTok) return null;

  // input_tokens 已含 cache_read+cache_write（pydantic-ai UsageBase 归一），命中率只按读算
  const pct = inTok ? Math.round(((cacheR || 0) / inTok) * 100) : null;
  // 未命中 = 输入 − 缓存读 − 缓存写（写入缓存的 prompt 不算 miss），与构成条同口径
  const uncached = Math.max(0, (inTok || 0) - (cacheR || 0) - (cacheW || 0));

  // 图例 + 构成条共用一套分段：缓存读 → 缓存写 → 未命中输入 → 输出，合计 = in + out
  const segments: { label: string; value: number; bar: string; icon: JSX.Element }[] = [
    {
      label: t('aiHistory.waterfall.usage.cacheRead'),
      value: cacheR || 0,
      bar: 'bg-amber-500',
      icon: <Zap className="w-3 h-3 text-amber-500" />,
    },
    {
      label: t('aiHistory.waterfall.usage.cacheWrite'),
      value: cacheW || 0,
      bar: 'bg-amber-300',
      icon: <PenLine className="w-3 h-3 text-amber-500/80" />,
    },
    {
      label: t('aiHistory.waterfall.usage.uncached'),
      value: uncached,
      bar: 'bg-muted-foreground/30',
      icon: <CircleSlash className="w-3 h-3 text-muted-foreground" />,
    },
    {
      label: t('aiHistory.waterfall.usage.output'),
      value: outTok || 0,
      bar: 'bg-emerald-500',
      icon: <ArrowDownRight className="w-3 h-3 text-emerald-500" />,
    },
  ];
  const total = (inTok || 0) + (outTok || 0);
  const barSegs = segments.filter((s) => s.value > 0);

  // 计价单元：chat 用自身用量；run 按各子 chat 逐一估算后求和（Σ 合计可能跨模型）；无子 chat 则 fallback 自身模型
  const costUnits: CostUnit[] = (() => {
    if (costUnitsProp) return costUnitsProp;
    if (sp?.kind === 'chat' && sp.model) {
      return [
        {
          model: sp.model,
          inp: inTok || 0,
          out: outTok || 0,
          cr: cacheR || 0,
          cw: cacheW || 0,
        },
      ];
    }
    if (sp?.kind === 'run') {
      const childUnits = sp.children.flatMap((c) =>
        c.kind === 'chat' && c.model
          ? [
              {
                model: c.model,
                inp: c.tokensIn || 0,
                out: c.tokensOut || 0,
                cr: c.cacheRead || 0,
                cw: c.cacheWrite || 0,
              },
            ]
          : [],
      );
      if (childUnits.length > 0) return childUnits;
      if (sp.model) {
        return [
          {
            model: sp.model,
            inp: inTok || 0,
            out: outTok || 0,
            cr: cacheR || 0,
            cw: cacheW || 0,
          },
        ];
      }
    }
    return [];
  })();

  const fetchCost = () => {
    if (costRequested.current || costUnits.length === 0) return;
    costRequested.current = true;
    estimateCosts(costUnits).then((c) => {
      if (c !== null) setCost(c);
    });
  };

  return (
    <Tooltip onOpenChange={(open) => open && fetchCost()}>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded-md bg-muted/60 border border-border/40 shrink-0 cursor-help',
            className,
          )}
        >
          {leading}
          {showSigma && <span className="opacity-70">Σ</span>}
          <span className="text-sky-500">↗{formatTokens(inTok || 0)}</span>
          <span className="text-emerald-500">↙{formatTokens(outTok || 0)}</span>
          {pct !== null && <span className="text-amber-500">⚡{pct}%</span>}
          {suffix}
        </span>
      </TooltipTrigger>
      <TooltipContent className="px-3 py-2">
        {/* 图例行：icon + 名称 + 数值单行不换行；细条独占一行，颜色与图例一致 */}
        <div className="flex items-center gap-x-3 whitespace-nowrap text-[10px] font-mono">
          {segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1 whitespace-nowrap">
                {s.icon}
                <span className="text-muted-foreground">{s.label}</span>
                <span>{formatTokens(s.value)}</span>
              </span>
            ))}
          {ttftMs ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Timer className="w-3 h-3 text-indigo-400" />
              <span className="text-muted-foreground">{t('aiHistory.waterfall.usage.ttft')}</span>
              <span>{ttftMs}ms</span>
            </span>
          ) : null}
          {cost !== null && cost > 0 && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Coins className="w-3 h-3 text-yellow-500" />
              <span className="text-muted-foreground">{t('aiHistory.waterfall.usage.cost')}</span>
              <span>≈{formatEstimatedCost(cost)}</span>
            </span>
          )}
        </div>
        <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          {barSegs.map((s, i) => (
            <div
              key={s.label}
              title={`${s.label} ${formatTokens(s.value)}`}
              className={cn(
                'h-full',
                s.bar,
                i === 0 && 'rounded-l-full',
                i === barSegs.length - 1 && 'rounded-r-full',
              )}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default TokenBadges;
