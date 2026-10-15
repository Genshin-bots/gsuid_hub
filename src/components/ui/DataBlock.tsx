import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * 看板数据块的统一外观。与 /dashboard 同源：一块数据 = 一张 glass-card，
 * 抬头是「图标 + 标题 + 右侧读数」，抬头压到 p-3 让内容区尽量多留高度。
 *
 * 表面完全交给 glass-card + [data-style]（液态/光感/磨砂/纯色），
 * 这里只负责块内排版，不叠任何自绘色彩或圆角覆盖。
 */

export interface DataBlockProps {
  title: string;
  icon: LucideIcon;
  className?: string;
  /** 标题栏右侧的补充读数（如区间合计）。整块数据没标题读不出来，只给标题等于只给了分类。 */
  extra?: React.ReactNode;
  children: React.ReactNode;
}

export function DataBlock({ title, icon: Icon, className, extra, children }: DataBlockProps) {
  return (
    <Card className={cn('glass-card flex flex-col', className)}>
      <CardHeader className="flex-row items-center gap-2 space-y-0 p-3 pb-1.5 sm:p-3.5 sm:pb-2">
        <Icon className="w-5 h-5 shrink-0 text-muted-foreground" />
        {/* 标题必须 truncate：卡片压到 2~3 列宽时，「首字延迟 (TTFT)」加右侧读数
            放不下就换行，把整卡行高顶高一截，同排其他卡跟着错位。 */}
        <CardTitle className="truncate text-sm font-semibold leading-tight">{title}</CardTitle>
        {extra ? <div className="ml-auto shrink-0">{extra}</div> : null}
      </CardHeader>
      <CardContent className="flex-1 px-3 pb-3 pt-1 sm:px-3.5 sm:pb-3.5">{children}</CardContent>
    </Card>
  );
}

export interface StatStripItem {
  title: string;
  value: string;
  desc?: string;
  /** 迷你走势。读数条和图表卡并排时行高由图表决定，光有两三行字中间会空一大段；
   *  一条 sparkline 既填掉这段空白，也顺手把「哪个时段高」给出来。 */
  spark?: number[];
  sparkColor?: string;
  /** spark 的替代图形：竖向计，按分段从下往上堆。
   *  后端没有分时序列的指标（延迟、错误率）用它 —— 硬画一条 sparkline 等于编造趋势，
   *  但格子高度又得被别的格子撑满，于是用「填充高度 = 当前值」的几何图形占位，
   *  它只说大小，不暗示走势。 */
  meter?: { segments: { value: number; color: string }[]; max?: number };
}

/** 迷你柱状 sparkline。纯 div：24 根柱子不值得一个 ECharts 实例。
 *  高度交给外层的 flex-1 —— 读数条被图表撑高时柱子跟着长，正好把那段留白吃掉。 */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 0);
  if (values.length === 0 || max <= 0) {
    return <div className="h-full min-h-10 w-full rounded-sm bg-muted/40" />;
  }
  return (
    <div className="flex h-full min-h-10 w-full items-end gap-px" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px]"
          style={{
            height: `${Math.max((v / max) * 100, 2)}%`,
            backgroundColor: color,
            opacity: 0.45,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 一张卡里的几格紧凑读数。刻意做成「标签在上、数值在下」两行，而不是标签和数值各占一端：
 * 4 列宽的卡里每格只有 160px，两端对齐的话中间空掉一大段 —— 读数条在窄卡里永远像漏排。
 *
 * 外层 flex flex-col + 内容 flex-1：和图表卡并排时行高由图表决定，读数跟着撑开。
 * 格内 justify-between 把读数钉在顶部、sparkline 吃掉剩余高度 —— 整格内容垂直居中时
 * 上下各空一条，反而像没排完。
 */
export function StatStrip({ items, className }: { items: StatStripItem[]; className?: string }) {
  return (
    <Card className={cn('glass-card flex flex-col', className)}>
      <div className="flex flex-1 flex-col divide-y divide-border/50 sm:flex-row sm:divide-x sm:divide-y-0">
        {items.map((item) => (
          <div
            key={item.title}
            /* 全部格子一律顶对齐：以前没 spark 的格走 justify-center 整格居中，
               标签行和数值行就跟旁边几格错开一截，一排读数看着像散了架。
               现在没有 spark 的格只是下方空着 —— 空白比错位好收拾。 */
            className="flex min-w-0 flex-1 flex-col gap-2 px-3.5 py-3"
          >
            <div>
              <p className="truncate text-[11px] font-medium text-muted-foreground">{item.title}</p>
              {/* 读数不换行：「6032.8 ms」断成两行会把整格的行高顶起来，
                  连带把 sparkline 压扁，一排读数全乱。 */}
              <p className="mt-1 whitespace-nowrap text-xl font-bold leading-none tabular-nums tracking-tight">
                {item.value}
              </p>
              {item.desc ? (
                <p className="mt-1 truncate text-[10px] text-muted-foreground">{item.desc}</p>
              ) : null}
            </div>
            {item.spark ? (
              <div className="min-h-10 flex-1">
                <Sparkline values={item.spark} color={item.sparkColor ?? 'hsl(var(--primary))'} />
              </div>
            ) : item.meter ? (
              /* flexGrow 是「比例」不是百分比：只渲染分段的话，单段永远吃满 100%。
                 所以补一段透明的余量段（rest = max - 各段之和）参与分配，
                 填充高度才是真正的 value / max。 */
              <div className="flex min-h-10 flex-1">
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-sm bg-muted/40">
                  {(() => {
                    const sum = item.meter!.segments.reduce((s, x) => s + x.value, 0);
                    const rest = Math.max((item.meter!.max ?? sum) - sum, 0);
                    return [
                      ...item.meter!.segments.map((seg, i) => (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: 分段数固定 2~3，无稳定 id
                          key={i}
                          style={{
                            flexGrow: Math.max(seg.value, 0),
                            flexBasis: 0,
                            backgroundColor: seg.color,
                          }}
                        />
                      )),
                      ...(rest > 0
                        ? [<div key="rest" style={{ flexGrow: rest, flexBasis: 0 }} />]
                        : []),
                    ];
                  })()}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

export interface MetricTileProps {
  title: string;
  value: string;
  desc: string;
  icon?: LucideIcon;
}

export interface RatioSlice {
  label: string;
  value: number;
  /** 展示用的格式化数字（如 649.20K）。分母仍走 value，文本只是显示。 */
  text: string;
  color: string;
}

/**
 * 主角卡里那根占比条。四类 Token 各占一段，底下跟一行图例，鼠标停在某段上弹出浮窗
 * 报出该项的具体值和占比。
 *
 * 存在的理由是「四张拆分卡收进一条线」这件事本身有代价：卡片没了，数值不能跟着消失。
 * 条形给出比例、图例给出名字、浮窗给出数字 —— 三层合起来才等于原来四张卡的信息量。
 */
export function RatioBar({
  slices,
  total,
  className,
  showLegend = true,
}: {
  slices: RatioSlice[];
  total: number;
  className?: string;
  showLegend?: boolean;
}) {
  const visible = slices.filter((s) => s.value > 0);
  if (total <= 0) {
    return <div className={cn('h-2 w-full rounded-full bg-muted', className)} />;
  }
  return (
    <div className={className}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {visible.map((slice, index) => (
          <Tooltip key={slice.label}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'h-full cursor-default transition-opacity hover:opacity-75',
                  index === 0 && 'rounded-l-full',
                  index === visible.length - 1 && 'rounded-r-full',
                )}
                style={{
                  width: `${(slice.value / total) * 100}%`,
                  backgroundColor: slice.color,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {slice.label} · {slice.text} · {((slice.value / total) * 100).toFixed(1)}%
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {showLegend && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {visible.map((slice) => (
            <li key={slice.label} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-muted-foreground">{slice.label}</span>
              <span className="tabular-nums font-medium">{slice.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 主指标。多个指标等权排开的时候，「错误 0」和「总 Token 128K」长得一样重，
 * 眼睛不知道该看哪儿 —— 那不叫高端，那叫没有主次。
 * 所以一页只让一个数字当主角：放大到 text-4xl，图标也只留它一个。
 * children 挂在脚注下面，给占比条之类「和这个数字同一件事」的内容留位置。
 */
export function MetricHero({
  title,
  value,
  desc,
  icon: Icon,
  children,
}: MetricTileProps & {
  children?: React.ReactNode;
}) {
  return (
    <Card className="glass-card flex flex-col">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-3.5 pb-1 sm:p-4 sm:pb-1.5">
        <CardTitle className="truncate text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon ? <Icon className="w-4 h-4 shrink-0 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent className="flex-1 px-3.5 pb-3.5 pt-0 sm:px-4 sm:pb-4 sm:pt-0">
        <p className="text-4xl font-bold leading-none tabular-nums tracking-tight">{value}</p>
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{desc}</p>
        {children ? <div className="mt-3">{children}</div> : null}
      </CardContent>
    </Card>
  );
}

/**
 * 次要指标。压成三行小字、去图标、和 Hero 等高排在一行 —— 只提供细节，不抢视线。
 *
 * 整行卡片的高度是 Hero（三行大字）撑出来的，mini 只有三行小字，底部就会空出一条。
 * 让内容区撑满并垂直居中，空白均分到上下，视觉上就不塌。
 */
export function MetricMini({ title, value, desc }: MetricTileProps) {
  return (
    <Card className="glass-card flex flex-col">
      <CardHeader className="space-y-0 p-3 pb-0.5 sm:p-3.5 sm:pb-1">
        <CardTitle className="truncate text-[11px] font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center px-3 pb-3 pt-0 sm:px-3.5 sm:pb-3.5 sm:pt-0">
        <p className="text-xl font-bold tabular-nums tracking-tight">{value}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

/**
 * 组内小节标题。一页里分组多了，光靠卡片标题分不出「这几块讲的是同一件事」。
 * 一行「图标 + 名称 + 右侧说明」比再套一层卡片便宜得多。
 */
export function SectionLabel({
  title,
  icon: Icon,
  hint,
  action,
}: {
  title: string;
  icon: LucideIcon;
  hint?: string;
  /** 标题行右侧的操作（如「查看详情」跳二级页）。概览只放仪表，明细从这里进。 */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="w-4 h-4 shrink-0" />
        {title}
      </h2>
      <div className="flex items-center gap-3">
        {hint ? <p className="text-[11px] text-muted-foreground/80">{hint}</p> : null}
        {action}
      </div>
    </div>
  );
}
