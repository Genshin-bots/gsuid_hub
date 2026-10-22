import { Children, useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { aiStatisticsApi, aiPerformanceApi, getApiErrorMessage } from '@/lib/api';
import { PinnedPage } from '@/components/layout/PinnedPage';
import type {
  AIErrorEvent,
  HourlyPerformanceItem,
  HourlyPerformanceRangeItem,
  TokenRangeData,
} from '@/lib/api';
import {
  aggregatePerformanceByDate,
  aggregatePerformanceByHour,
  formatCompactMetric,
  latestDateWithMetric,
  memoryIngestHealth,
  perfHourTotals,
  toPerfHourSeries,
} from '@/lib/featureUtils';
import type { PerfHourModel, PerfHourPoint } from '@/lib/featureUtils';
import { Card, CardContent } from '@/components/ui/card';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import {
  DataBlock,
  MetricHero,
  MetricMini,
  RatioBar,
  SectionLabel,
  StatStrip,
} from '@/components/ui/DataBlock';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BAR_RADIUS_RIGHT,
  BAR_RADIUS_TOP,
  BAR_THICKNESS,
  CATEGORY_AXIS_BASE,
  EChartsWrapper,
  VALUE_AXIS_BASE,
  barFill,
  compactTick,
  niceMax,
  softAreaFill,
  stackedCells,
  useChartAxisColors,
  useSeriesRamp,
  withAlpha,
} from '@/components/charts';
import type { EChartsOption } from 'echarts';
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarDays,
  ChevronRight,
  Clock,
  Coins,
  Database,
  Gauge,
  GitBranch,
  Layers,
  RefreshCw,
  Target,
  Table2,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { MetricDayCalendar } from '@/components/ui/metric-day-calendar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format, subDays, startOfDay, parse } from 'date-fns';

// ============================================================================
// 类型定义 (兼容旧接口 + 新缓存字段)
// ============================================================================

interface TokenUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens?: number;
  total_cache_write_tokens?: number;
  by_model: TokenByModel[];
  by_type: TokenByType[];
}

interface TokenByModel {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

interface TokenByType {
  type: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

interface Latency {
  avg: number;
  p95: number;
}

interface IntentDistribution {
  [key: string]: { count: number; percentage: number };
}

interface TriggerDistribution {
  [key: string]: { count: number; percentage: number } | number;
}

interface ErrorStats {
  timeout: number;
  rate_limit: number;
  network_error: number;
  usage_limit: number;
  agent_error: number;
  api_529_error: number;
  total: number;
}

interface HeartbeatStats {
  should_speak_true: number;
  should_speak_false: number;
  conversion_rate: number;
}

interface RagStats {
  hit_count: number;
  miss_count: number;
  hit_rate: number;
}

interface RagDocument {
  document_name: string;
  hit_count: number;
}

interface MemoryStats {
  observations: number;
  ingestions: number;
  ingestion_errors: number;
  retrievals: number;
  entities_created: number;
  edges_created: number;
  episodes_created: number;
}

interface ActiveUser {
  group_id: string;
  user_id: string;
  ai_interaction: number;
  message_count: number;
}

interface EfficiencyStats {
  user_turn_count: number;
  agent_run_count: number;
  root_agent_run_count: number;
  nested_agent_run_count: number;
  user_turn_agent_run_count: number;
  user_turn_input_tokens: number;
  user_turn_output_tokens: number;
  user_turn_cache_read_tokens?: number;
  user_turn_cache_write_tokens?: number;
  avg_tokens_per_user_turn: number;
  avg_input_tokens_per_user_turn: number;
  avg_output_tokens_per_user_turn: number;
  avg_tokens_per_agent_run: number;
  avg_input_tokens_per_agent_run: number;
  avg_output_tokens_per_agent_run: number;
  avg_agent_runs_per_user_turn: number;
}

interface StatisticsSummary {
  date: string;
  token_usage: TokenUsage;
  latency: Latency;
  intent_distribution: IntentDistribution;
  errors: ErrorStats;
  heartbeat: HeartbeatStats;
  trigger_distribution: TriggerDistribution;
  rag: RagStats;
  memory: MemoryStats;
  efficiency?: EfficiencyStats;
  active_users: ActiveUser[];
}

const EMPTY_EFFICIENCY: EfficiencyStats = {
  user_turn_count: 0,
  agent_run_count: 0,
  root_agent_run_count: 0,
  nested_agent_run_count: 0,
  user_turn_agent_run_count: 0,
  user_turn_input_tokens: 0,
  user_turn_output_tokens: 0,
  avg_tokens_per_user_turn: 0,
  avg_input_tokens_per_user_turn: 0,
  avg_output_tokens_per_user_turn: 0,
  avg_tokens_per_agent_run: 0,
  avg_input_tokens_per_agent_run: 0,
  avg_output_tokens_per_agent_run: 0,
  avg_agent_runs_per_user_turn: 0,
};

// ============================================================================
// API 函数
// ============================================================================

async function fetchStatisticsSummary(date?: string): Promise<StatisticsSummary> {
  return aiStatisticsApi.getSummary(date);
}

async function fetchTokenByModel(date?: string): Promise<TokenByModel[]> {
  return aiStatisticsApi.getTokenByModel(date);
}

async function fetchActiveUsers(date?: string, limit: number = 20): Promise<ActiveUser[]> {
  return aiStatisticsApi.getActiveUsers(date, limit);
}

async function fetchRagDocuments(): Promise<RagDocument[]> {
  return aiStatisticsApi.getRagDocuments();
}

async function fetchPerformanceHourly(date?: string): Promise<HourlyPerformanceItem[]> {
  return aiPerformanceApi.getHourly(date);
}

async function fetchTokenByRange(start_date?: string, end_date?: string): Promise<TokenRangeData> {
  return aiStatisticsApi.getTokenByRange(start_date, end_date);
}

/** 预设范围类型。「今日 / 昨日」也是一段长度为 1 的闭区间，所以和预设统一在一套里。 */
type RangePreset = 'today' | 'yesterday' | '7d' | '14d' | '30d' | '90d' | 'custom';

const PRESET_DAYS: Record<Exclude<RangePreset, 'custom' | 'today' | 'yesterday'>, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

function isSingleDayPreset(preset: RangePreset): boolean {
  return preset === 'today' || preset === 'yesterday';
}

/** 昨日固定是自然日的前一天，不跟日历里选中的日期走。 */
function singleDayDate(preset: RangePreset, selected: Date): Date {
  if (preset === 'yesterday') return startOfDay(subDays(new Date(), 1));
  return startOfDay(selected);
}

/** 预设区间的文案。别在 JSX 里堆三元。
 *  刻意不带图标：六颗图标要多占 180px 横向预算，页头那排页签正是被它们挤到第二行的；
 *  预设文案本身就短（「今日 / 7天 / 自定义」），加了图标反而是一排看不懂的小装饰。 */
const RANGE_PRESET_TABS = [
  { value: 'today', labelKey: 'aiStatistics.scopeToday' },
  { value: 'yesterday', labelKey: 'aiStatistics.scopeYesterday' },
  { value: '7d', labelKey: 'aiStatistics.preset7d' },
  { value: '14d', labelKey: 'aiStatistics.preset14d' },
  { value: '30d', labelKey: 'aiStatistics.preset30d' },
  { value: '90d', labelKey: 'aiStatistics.preset90d' },
  { value: 'custom', labelKey: 'aiStatistics.customRange' },
] as const;

/** 根据 preset 计算起止日期(YYYY-MM-DD) */
function computeRangeDates(
  preset: RangePreset,
  start?: Date,
  end?: Date,
): { start_date?: string; end_date?: string } {
  const today = startOfDay(new Date());
  if (preset === 'custom') {
    return {
      start_date: start ? format(start, 'yyyy-MM-dd') : undefined,
      end_date: end ? format(end, 'yyyy-MM-dd') : undefined,
    };
  }
  /* 「今日」用的是日历里选中的那天而不是自然今天 —— 否则日历翻到别的月份时，
     主角卡的数字和下面所有按日取数的卡片会对不上。 */
  if (preset === 'today' || preset === 'yesterday') {
    const day = preset === 'yesterday' ? startOfDay(subDays(today, 1)) : (start ?? today);
    const s = format(day, 'yyyy-MM-dd');
    return { start_date: s, end_date: s };
  }
  const days = PRESET_DAYS[preset];
  // 后端闭区间 [start, end];今天为 end,往前 (days-1) 天作为 start,合计 days 天
  const startDate = subDays(today, days - 1);
  return {
    start_date: format(startDate, 'yyyy-MM-dd'),
    end_date: format(today, 'yyyy-MM-dd'),
  };
}

// ============================================================================
// 工具函数
// ============================================================================

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toLocaleString();
}

// ============================================================================
// 图表装配
// ============================================================================

/** 图表高度带。行高 ROW_HEIGHT 同时定住「一根横条占多高」，卡片高度跟着行数走。 */
const ROW_HEIGHT = 26;
const CHART_MIN = 120;
const CHART_MAX = 300;
/** 性能详情页那张趋势图独占一行，不跟上面并排，用自己的高度。 */
const TREND_HEIGHT = 150;
/** 三张 24 小时剖面 + 效率趋势并成一行，容器高度和 grid 余量都必须共用一份，
 *  绘图区才能逐像素对齐 —— 各自写各的，底边就会错开一截，x 轴标签跟着错位。
 *  右 28 不是随手挑的：左 28 放主轴数字，右 28 是给效率趋势的次轴数字留的位置；
 *  三张单轴图原来写 right: 14，右边界会比双轴图多出 14px，一排看过去右边参差。
 *  底部 34 是四张共用的高度：单轴图只用到轴标签那点、其余留白，效率趋势在轴标签
 *  下面还要摆三项图例，正好用满。绘图区高度 176-12-34=130，与原先 150-12-8 一致，
 *  柱形一根没变，只是底下多出一条边距。 */
const ROW_CHART_HEIGHT = 176;
const ROW_GRID = { left: 28, right: 28, top: 12, bottom: 34 } as const;
/** 环图：下面还要跟一列 React 图例，所以只占卡片上半。 */
const DONUT_HEIGHT = 148;
/** 「今日」档下趋势区往前回看几天。一天的区间在每日走势上只有一个点，那不叫走势。 */
const TREND_LOOKBACK_DAYS = 7;

/**
 * 时间控件（今日的日历、自定义区间、只读区间、刷新）用的玻璃外壳。
 *
 * 与 TabButtonGroup 外壳是同一组类：`glass-card-flat` 给基础底色，`tab-segment-row`
 * 只在光感 / 液态主题下补顶刃高光、色散与背后模糊。之前这几个控件是裸的
 * `variant="outline"` 按钮 —— 旁边那排分段条有玻璃质感，它们还是一整块实底，
 * 在液态主题下尤其像贴上去的。走同一组类才是一套。
 *
 * 代价：这几个按钮必须用 `variant="ghost"` 而不是 `"outline"`。outline 带
 * `bg-background`，会命中 index.css 里 `[data-style="liquid"] :is(button, a).bg-background`
 * 那条「页头描边按钮在液态下改成玻璃」的规则，它的 `!important` 描边/内高光跟
 * `.tab-segment-row` 同为白描边但背景不透明，液态下就把外壳整个压成透明 ——
 * 光感主题因为 `.tab-segment-row` 自带描边反而正常，所以只有液态翻车，很难一眼归因。
 * ghost 不带 `bg-background`，外壳自己说话，三套主题表现一致。
 */
const rangeControlShellClass =
  'tab-segment-row inline-flex items-center rounded-lg glass-card-flat p-1';
const rangeControlBtnClass = 'h-10 w-[152px] justify-start gap-2 px-3 font-normal rounded-md';

/** 日期槽与刷新按钮的胶囊外壳与尺寸，与 TabButtonGroup 严格保持一致的外层 p-1 + 内层 h-10 */

const rangeIconButtonClass = 'h-10 w-10 p-0 justify-center rounded-md';

function rowChartHeight(rows: number): number {
  return Math.min(Math.max(rows * ROW_HEIGHT + 56, CHART_MIN), CHART_MAX);
}

/**
 * Token 构成那两张堆叠条的专用高度带。
 *
 * 这一行三张卡是等高的（最高的是每日走势），高度差得由条形自己吸收：分类轴的行距
 * 等于绘图区高 ÷ 类目数，所以行数少的时候行距自动拉开。原来按行数给高度
 * （3 行 68px、4 行 86px）看着紧凑，可一旦放进等高的行里，占位不到一半的卡就被上下
 * 白边填满 —— 比底边不齐更刺眼。所以改成「先给一个跟趋势图齐平的下限」：
 * 3~4 行都落到下限，高度完全一致；真到 6 行才往上长，下限托不住为止。
 */
const STACK_ROW_HEIGHT = 22;
const STACK_CHART_MIN = 120;
const STACK_CHART_MAX = 150;

/* 本页所有柱系列的条粗细统一走 BAR_THICKNESS（16），不再每张图各写一个上限。
   原先是 22（构成卡）/ 18（效率趋势）/ 16（触发方式、RAG）四种，同一屏里条的粗细
   跟着「这一图有几根」变，读着像四张图不是一个组件画的。
   16 是能统一到的最大值：请求次数那张是 24 根小时柱，类别带宽只有约 17px，
   条比这更粗就得互相压 —— 所以它反过来给全页定了上限。
   构成卡这里原来写 22，行距拉开看着是「厚条 + 大缝」；条粗细交给统一常量，
   行距仍由 STACK_ROW_HEIGHT 管，两者不再各说各话。 */

/** 每日走势要和同行的两张构成卡齐平，比行 2 的剖面图矮一截。 */
const TOKEN_TREND_HEIGHT = 130;

function stackChartHeight(rows: number): number {
  return Math.min(Math.max(rows * STACK_ROW_HEIGHT + 12, STACK_CHART_MIN), STACK_CHART_MAX);
}

interface SliceDatum {
  name: string;
  value: number;
  color: string;
  /** 占总量的比例，0~1 */
  share: number;
}

/**
 * 分类环图的数据整形：前 N 项各占一色，其余并进「其他」。
 * 颜色索引跟着名次走，切日期不会整片换色；「其他」固定吃最后一格中性色，
 * 读者一眼能认出它是兜底项而不是某类。
 */
function buildSlices(
  items: { name: string; value: number }[],
  ramp: string[],
  limit: number,
  otherLabel: string,
): SliceDatum[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, i) => sum + i.value, 0);
  if (total <= 0) return [];
  const head = sorted.slice(0, limit).map((item, idx) => ({
    name: item.name,
    value: item.value,
    color: ramp[idx % 4],
    share: item.value / total,
  }));
  const rest = sorted.slice(limit);
  if (rest.length === 0) return head;
  const restSum = rest.reduce((sum, i) => sum + i.value, 0);
  return [...head, { name: otherLabel, value: restSum, color: ramp[4], share: restSum / total }];
}

/** 「每行由 4 种 token 构成」的堆叠横条：按总量降序 + yAxis.inverse，#1 落在最上面。 */
interface StackRow {
  id: string;
  values: number[];
}

/** 堆叠分段固定顺序：未命中输入 → 缓存命中 → 输出。三者合计即为真实 Total Tokens。 */
const TOKEN_STACK_FIELDS = ['uncachedInput', 'cacheRead', 'output'] as const;

const TOKEN_STACK_LABEL_KEYS: Record<(typeof TOKEN_STACK_FIELDS)[number], string> = {
  uncachedInput: 'aiStatistics.uncachedInput',
  cacheRead: 'aiStatistics.cacheHit',
  output: 'aiStatistics.outputTokens',
};

function buildStackRows(
  items: {
    name: string;
    uncachedInput: number;
    cacheRead: number;
    output: number;
  }[],
  limit: number,
  otherLabel: string,
): { rows: StackRow[] } {
  const sorted = [...items]
    .map((item) => ({
      item,
      total: TOKEN_STACK_FIELDS.reduce((sum, k) => sum + (item[k] || 0), 0),
    }))
    .sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  const rows: StackRow[] = head.map(({ item }) => ({
    id: item.name,
    values: TOKEN_STACK_FIELDS.map((k) => item[k] || 0),
  }));
  if (rest.length > 0) {
    rows.push({
      id: otherLabel,
      values: TOKEN_STACK_FIELDS.map((k) => rest.reduce((sum, r) => sum + (r.item[k] || 0), 0)),
    });
  }
  return { rows };
}

// ============================================================================
// 辅助组件
// ============================================================================

/** 空态。高度跟着图表走，不然卡片会因为少了一块而塌一截。 */
function EmptyChart({ height = ROW_CHART_HEIGHT, label }: { height?: number; label: string }) {
  return (
    <div
      className="flex items-center justify-center text-xs text-muted-foreground"
      style={{ height }}
    >
      {label}
    </div>
  );
}

/**
 * 环图。图例交给 React 画（DonutLegend），所以这里不必给 ECharts 留右侧位置，
 * 环就能真正居中 —— 右偏 35% 再配一列图例是老式画法，读起来重心是歪的。
 */
function DonutChart({
  slices,
  total,
  centerLabel,
  height = DONUT_HEIGHT,
}: {
  slices: SliceDatum[];
  total: number;
  centerLabel: string;
  height?: number;
}) {
  const { text, muted } = useChartAxisColors();
  if (slices.length === 0) return <EmptyChart height={height} label="—" />;

  const option: EChartsOption = {
    animationDuration: 700,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'item',
      formatter: (params: any) =>
        `${params.name}<br/>${formatCompactNumber(Number(params.value ?? 0))} (${params.percent}%)`,
    },
    /* 图例由 DonutLegend 用 React 画。EChartsWrapper 的基础 option 里带了 legend 节点，
       不显式关掉的话 ECharts 会按 series 名自动长出一份 legend，压在环图下方。 */
    legend: { show: false },
    title: {
      text: formatCompactNumber(total),
      subtext: centerLabel,
      left: 'center',
      top: '37%',
      textStyle: { fontSize: 20, fontWeight: 700, color: text },
      subtextStyle: { fontSize: 11, color: muted },
    },
    series: [
      {
        type: 'pie',
        radius: ['64%', '88%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: 'transparent', borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 6 },
        data: slices.map((slice) => ({
          name: slice.name,
          value: slice.value,
          itemStyle: { color: slice.color },
        })),
      },
    ],
  };
  return <EChartsWrapper option={option} height={height} />;
}

/** 环图的图例行。ECharts 自带图例在窄卡片里会换行盖住图，指针悬停也只高亮方块，
 *  这里用 React 写死四列（色点 / 名称 / 数值 / 占比），条目再多也不会错位。 */
function DonutLegend({ slices, className }: { slices: SliceDatum[]; className?: string }) {
  return (
    /* w-full min-w-0 两处都要：ul 是 flex 子节点的子节点，不锁住宽度的话长模型名
       （deepseek/deepseek-v4.1-flash 之类）会把整行撑出卡片，压到隔壁卡片上。 */
    <ul className={cn('mt-1 w-full min-w-0 space-y-1', className)}>
      {slices.map((slice) => (
        <li key={slice.name} className="flex min-w-0 items-center gap-2 text-xs">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: slice.color }}
          />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{slice.name}</span>
          <span className="shrink-0 tabular-nums font-medium">
            {formatCompactNumber(slice.value)}
          </span>
          <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">
            {(slice.share * 100).toFixed(1)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 100% 堆叠条。两三个量的构成关系（比如命中 / 未命中、Root / 嵌套）：
 *  画环图是杀鸡用牛刀，一条按比例分段的横条比任何图都直接。
 *  color 由调用方给：色阶色给主项，中性色给兜底项。 */
function SplitBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) {
    return <div className="h-2 w-full rounded-full bg-muted" />;
  }
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {visible.map((segment, index) => (
        <div
          key={segment.label}
          className={cn(
            'h-full',
            index === 0 && 'rounded-l-full',
            index === visible.length - 1 && 'rounded-r-full',
          )}
          style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }}
        />
      ))}
    </div>
  );
}

/** 兜底项的中性色：深浅色模式各有一档透明度，直接吃 CSS 变量跟着主题走。 */
const NEUTRAL_SEGMENT = 'hsl(var(--muted-foreground) / 0.28)';

/**
 * 占比行。单序列就吃主题色阶第一色 —— 按项各上色就成了彩虹条。
 *
 * 这里没用 <Progress>：它的指示条写死 `bg-primary`，而 shadcn 浅色预设的 primary 是
 * 近黑的深蓝，和同一页里走色阶的图表并排放会明显对不上。自己画这根条才能和 SplitBar
 * 共用同一套色，页面才是一个颜色系统。
 */
function ShareRow({
  label,
  value,
  percentage,
  color,
}: {
  label: string;
  value: number;
  percentage: number;
  color: string;
}) {
  const pct = Number.isFinite(percentage) ? Math.min(Math.max(percentage, 0), 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 tabular-nums">
          <span className="font-medium">{value.toLocaleString()}</span>
          <span className="ml-1 text-muted-foreground">{pct.toFixed(1)}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

const TABLE_HEAD = 'py-2 px-3 text-[11px] font-medium text-muted-foreground';
const TABLE_CELL = 'py-2 px-3 text-[13px]';
const TABLE_NUM = 'py-2 px-3 text-right text-[13px] tabular-nums';

/** 详情表。列名与数字对齐规则全站统一：文字左对齐、数字右对齐 + 等宽数字。 */
function DataTable({
  head,
  children,
  emptyLabel,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  emptyLabel?: string;
}) {
  const isEmpty = Children.count(children) === 0;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">{head}</tr>
        </thead>
        <tbody>
          {isEmpty ? (
            // colSpan 给宽值即可：浏览器会截到实际列数，不影响对齐
            <tr>
              <td colSpan={16} className={cn(TABLE_CELL, 'text-muted-foreground')}>
                {emptyLabel}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function TileSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass-card">
          <CardContent className="space-y-2 p-3.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-2.5 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export default function AIStatisticsPage() {
  const { t } = useLanguage();
  /** 全页图表共用一套主题色阶：切主题时所有图一起换色。与 /dashboard 同一份实现。 */
  const ramp = useSeriesRamp();
  const axis = useChartAxisColors();

  // 状态
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
  /** 单日口径的按模型 / 按类型分布，只在「今日」档用；区间档见下面 tokenByModel / tokenByType。 */
  const [dayTokenByModel, setDayTokenByModel] = useState<TokenByModel[]>([]);
  const [dayTokenByType, setDayTokenByType] = useState<TokenByType[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [ragDocuments, setRagDocuments] = useState<RagDocument[]>([]);
  const [performanceData, setPerformanceData] = useState<HourlyPerformanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  /** yyyy-MM-dd → 当日 input_tokens（日历角标） */
  const [dailyInputTokens, setDailyInputTokens] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>('overview');
  /** 最近一次成功拉取的时刻，供工具栏显示「更新于」 */
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // 概览里的明细不跳页签，点开成弹窗：明细是补充信息，不该把用户从仪表盘上带走
  const [perfDetailOpen, setPerfDetailOpen] = useState(false);
  const [dataDetailOpen, setDataDetailOpen] = useState(false);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const [errorEvents, setErrorEvents] = useState<AIErrorEvent[] | null>(null);
  const [errorEventsFallback, setErrorEventsFallback] = useState(false);

  // 时间段 Token 统计相关状态
  const [rangeData, setRangeData] = useState<TokenRangeData | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>('today');
  const [rangeStartDate, setRangeStartDate] = useState<Date | undefined>(undefined);
  const [rangeEndDate, setRangeEndDate] = useState<Date | undefined>(undefined);

  // 历史趋势页签已并入概览：每日走势 / 效率趋势由 rangeData.daily 供给，
  // 原来的 getHistory 一条链路（historyDays + historySeries）整条删掉，
  // 每日明细那张表改读 rangeData.daily 放进「数据明细」弹窗。

  /* 趋势区专用的一份区间数据。「今日」档一天画不出走势，所以那一档下另取最近 7 天；
     区间档直接复用顶部那份 rangeData，不额外发请求。 */
  const [trendData, setTrendData] = useState<TokenRangeData | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);

  // 性能: 单日 / 日期范围。区间模式不再有自己的预设，直接跟顶部的时间维度走。
  const [perfMode, setPerfMode] = useState<'day' | 'range'>('day');
  const [perfRangeRows, setPerfRangeRows] = useState<HourlyPerformanceRangeItem[]>([]);
  const [perfRangeLoading, setPerfRangeLoading] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const dateStr = format(singleDayDate(rangePreset, selectedDate), 'yyyy-MM-dd');
      const [summaryData, tokenData, usersData, ragData, perfData] = await Promise.all([
        fetchStatisticsSummary(dateStr).catch(() => null),
        fetchTokenByModel(dateStr).catch(() => []),
        fetchActiveUsers(dateStr, 20).catch(() => []),
        fetchRagDocuments().catch(() => []),
        fetchPerformanceHourly(dateStr).catch(() => []),
      ]);

      setSummary(summaryData);
      setDayTokenByModel(tokenData);
      setDayTokenByType(summaryData?.token_usage?.by_type ?? []);
      setActiveUsers(usersData);
      setRagDocuments(ragData);
      setPerformanceData(perfData);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
      toast.error(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [rangePreset, selectedDate, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 日历：近 60 天每日 input token
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await aiStatisticsApi.getDailyTokenCounts(60);
        if (cancelled) return;
        const record: Record<string, number> = {};
        for (const item of rows ?? []) {
          record[item.date] = item.input_tokens ?? 0;
        }
        setDailyInputTokens(record);
        const cur = format(selectedDate, 'yyyy-MM-dd');
        if ((record[cur] ?? 0) <= 0) {
          const latest = latestDateWithMetric(record);
          if (latest) {
            setSelectedDate(parse(latest, 'yyyy-MM-dd', new Date()));
          }
        }
      } catch (err) {
        console.warn(
          '[AIStatisticsPage] /api/ai/statistics/daily-token-counts 不可用，日历无角标。请升级 gsuid_core。',
          err,
        );
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  // 时间段 Token 统计 - 拉取数据
  const fetchRangeData = useCallback(async () => {
    try {
      setRangeLoading(true);
      setRangeError(null);
      const { start_date, end_date } = computeRangeDates(
        rangePreset,
        // 「今日」把日历里选中的那天当起点；自定义区间仍用自己那两个选择器
        isSingleDayPreset(rangePreset)
          ? singleDayDate(rangePreset, selectedDate)
          : rangeStartDate,
        rangeEndDate,
      );
      const data = await fetchTokenByRange(start_date, end_date);
      setRangeData(data);
    } catch (err) {
      const msg = getApiErrorMessage(err, t('aiStatistics.loadFailed'));
      setRangeError(msg);
      setRangeData(null);
    } finally {
      setRangeLoading(false);
    }
  }, [rangePreset, rangeStartDate, rangeEndDate, selectedDate, t]);

  useEffect(() => {
    // 概览的「区间走势」和「时间段统计」是同一份区间数据，两处都要它；
    // 条件写窄了这个 effect 就只在一半的页签上生效。
    if (activeTab === 'range' || activeTab === 'overview') {
      fetchRangeData();
    }
  }, [activeTab, fetchRangeData]);

  /* 趋势区的窗口。区间档就是顶部那个区间；「今日」档往前带 7 天 ——
     一天的区间在每日走势上只有一个点，那不叫走势。 */
  const trendWindow = useMemo(() => {
    if (!isSingleDayPreset(rangePreset)) {
      return computeRangeDates(rangePreset, rangeStartDate, rangeEndDate);
    }
    const end = singleDayDate(rangePreset, selectedDate ?? new Date());
    return {
      start_date: format(subDays(end, TREND_LOOKBACK_DAYS - 1), 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
    };
  }, [rangePreset, rangeStartDate, rangeEndDate, selectedDate]);

  const fetchTrendData = useCallback(async () => {
    try {
      setTrendLoading(true);
      setTrendError(null);
      const data = await fetchTokenByRange(trendWindow.start_date, trendWindow.end_date);
      setTrendData(data);
    } catch (err) {
      setTrendError(getApiErrorMessage(err, t('aiStatistics.loadFailed')));
      setTrendData(null);
    } finally {
      setTrendLoading(false);
    }
  }, [trendWindow, t]);

  useEffect(() => {
    // 只有「今日」档需要这份：区间档的趋势区直接读 rangeData，不重复请求
    if (activeTab === 'overview' && isSingleDayPreset(rangePreset)) {
      void fetchTrendData();
    }
  }, [activeTab, rangePreset, fetchTrendData]);

  // 性能日期范围：跟着顶部的时间维度走，日期解析口径和 Token 那一路完全一致
  const fetchPerfRange = useCallback(async () => {
    try {
      setPerfRangeLoading(true);
      const { start_date, end_date } = computeRangeDates(
        rangePreset,
        isSingleDayPreset(rangePreset)
          ? singleDayDate(rangePreset, selectedDate)
          : rangeStartDate,
        rangeEndDate,
      );
      const rows = await aiPerformanceApi.getHourlyRange(start_date, end_date);
      setPerfRangeRows(rows ?? []);
    } catch {
      setPerfRangeRows([]);
    } finally {
      setPerfRangeLoading(false);
    }
  }, [rangePreset, rangeStartDate, rangeEndDate, selectedDate]);

  useEffect(() => {
    // 概览的三张 24 小时图跟着顶部时间维度走：只有区间档需要 hourly-range，
    // 「今日」那一档单日 hourly 已经覆盖了，不用多打一次请求。
    if (!isSingleDayPreset(rangePreset)) {
      void fetchPerfRange();
    } else {
      setPerfRangeRows([]);
    }
  }, [rangePreset, fetchPerfRange]);

  useEffect(() => {
    if (!errorDetailOpen) return;
    let cancelled = false;
    const { start_date, end_date } = computeRangeDates(
      rangePreset,
      isSingleDayPreset(rangePreset) ? singleDayDate(rangePreset, selectedDate) : rangeStartDate,
      rangeEndDate,
    );
    if (!start_date || !end_date) return;
    setErrorEvents(null);
    setErrorEventsFallback(false);
    aiStatisticsApi
      .getErrorEvents(start_date, end_date)
      .then((rows) => {
        if (!cancelled) setErrorEvents(rows ?? []);
      })
      .catch((err) => {
        console.warn('[AIStatisticsPage] /api/ai/statistics/error-events 不可用', err);
        if (!cancelled) {
          setErrorEvents([]);
          setErrorEventsFallback(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [errorDetailOpen, rangePreset, selectedDate, rangeStartDate, rangeEndDate]);

  // ============================================================================
  // 图表装配
  // ============================================================================

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  /** 底部单行图例：项数多时换行会盖住绘图区，所以 scroll + 压小尺寸。
   *  `tight` 给挤在窄列里的图用：每日走势有 5 个 series，占 3 列时默认尺寸要分页，
   *  翻页才能看全，不如直接压紧一行放下。 */
  const bottomLegend = useCallback(
    (names: string[], tight?: boolean) =>
      ({
        type: 'scroll',
        orient: 'horizontal',
        data: names,
        bottom: 0,
        left: 'center',
        width: '98%',
        icon: 'roundRect',
        itemWidth: tight ? 9 : 12,
        itemHeight: tight ? 7 : 8,
        itemGap: tight ? 7 : 12,
        pageIconSize: 12,
        pageButtonGap: 6,
        textStyle: { fontSize: tight ? 10 : 11, color: axis.muted },
      }) as EChartsOption['legend'],
    [axis.muted],
  );

  /** 堆叠图的 tooltip：分段 + 合计，比默认的浮层好读。 */
  const stackTooltip = useCallback(
    (names: string[]) => (params: any) => {
      if (!Array.isArray(params) || params.length === 0) return '';
      let total = 0;
      let rows = '';
      params.forEach((p: any) => {
        if (Number(p.value) <= 0) return;
        total += Number(p.value);
        rows += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:2px 0">
            <span style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color}"></span>
              ${names[p.seriesIndex] ?? p.seriesName}
            </span>
            <span style="font-weight:600">${formatCompactNumber(Number(p.value))}</span>
          </div>`;
      });
      if (!rows) return '';
      return `<div style="min-width:150px">
          <div style="font-weight:600;margin-bottom:6px">${params[0].axisValue}</div>
          ${rows}
          <div style="border-top:1px solid rgba(128,128,128,0.2);margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
            <span>${t('aiStatistics.totalTokens')}</span><span style="font-weight:700">${formatCompactNumber(total)}</span>
          </div>
        </div>`;
    },
    [t],
  );

  // ---- 概览：分布类 ----

  const intentSlices = useMemo(
    () =>
      buildSlices(
        Object.entries(summary?.intent_distribution ?? {}).map(([name, data]) => ({
          name,
          value: data?.count ?? 0,
        })),
        ramp,
        5,
        t('aiStatistics.other'),
      ),
    [summary, ramp, t],
  );

  const triggerItems = useMemo(
    () =>
      Object.entries(summary?.trigger_distribution ?? {})
        .map(([name, data]) => ({
          name,
          value: typeof data === 'number' ? data : (data?.count ?? 0),
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [summary],
  );

  /** 触发方式：单序列排名图。名称已经在 Y 轴上了，再按名称上色就是纯装饰。 */
  const triggerOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 700,
      animationEasing: 'cubicOut',
      grid: { left: 2, right: 34, bottom: 8, top: 8, containLabel: true },
      xAxis: {
        ...VALUE_AXIS_BASE,
        axisLabel: { fontSize: 10 },
        splitNumber: 2,
      },
      yAxis: {
        ...CATEGORY_AXIS_BASE,
        data: triggerItems.map((d) => d.name),
        inverse: true,
        axisLabel: { fontSize: 10, width: 84, overflow: 'truncate' },
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { show: false },
      series: [
        {
          type: 'bar',
          data: triggerItems.map((d) => d.value),
          barMaxWidth: BAR_THICKNESS,
          itemStyle: { color: barFill(ramp[0]), borderRadius: BAR_RADIUS_RIGHT },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: axis.muted,
            formatter: (p: any) => formatCompactNumber(Number(p.value)),
          },
          emphasis: { focus: 'series' },
        },
      ],
    }),
    [triggerItems, ramp, axis.muted],
  );

  // ---- Token 分析：按模型 / 按类型的堆叠横条 ----

  /**
   * 构成两张卡（以及「数据明细」弹窗里的逐行表）的数据源，跟着顶部时间维度走。
   *
   * 原来这两个数组永远是「选中那天」的单日值：切到 30 天档，卡片标题和右上角总量读数
   * 都写着区间，条形却还是某一天的 —— 数字和标题对不上，看的人无从判断在看哪段时间。
   * 今日档仍走单日（今日是内存实时值，历史走 summary / token-by-model），
   * 区间档改吃 token-by-range 的 by_model / by_type：后端已经按区间跨天聚合好了，
   * 与卡片右上角的总量读数同源，不需要再多打一个请求。
   */
  const tokenByModel = useMemo<TokenByModel[]>(
    () => (isSingleDayPreset(rangePreset) ? dayTokenByModel : (rangeData?.by_model ?? [])),
    [rangePreset, dayTokenByModel, rangeData],
  );
  const tokenByType = useMemo<TokenByType[]>(
    () => (isSingleDayPreset(rangePreset) ? dayTokenByType : (rangeData?.by_type ?? [])),
    [rangePreset, dayTokenByType, rangeData],
  );

  const tokenModelChartData = useMemo(
    () =>
      tokenByModel.map((item) => {
        const inp = item.input_tokens ?? 0;
        const cr = item.cache_read_tokens ?? 0;
        return {
          name: item.model || 'Unknown',
          uncachedInput: Math.max(0, inp - cr),
          cacheRead: cr,
          output: item.output_tokens ?? 0,
        };
      }),
    [tokenByModel],
  );

  const tokenTypeChartData = useMemo(
    () =>
      tokenByType.map((item) => {
        const inp = item.input_tokens ?? 0;
        const cr = item.cache_read_tokens ?? 0;
        return {
          name: item.type || 'Unknown',
          uncachedInput: Math.max(0, inp - cr),
          cacheRead: cr,
          output: item.output_tokens ?? 0,
        };
      }),
    [tokenByType],
  );

  /**
   * 堆叠条形图：将输入拆为「未命中输入」与「缓存命中」，加上「输出」，
   * 三段相加正好等于真实总 Token，同时一眼看清缓存结构。
   */
  const buildTokenStackOption = useCallback(
    (
      items: {
        name: string;
        uncachedInput: number;
        cacheRead: number;
        output: number;
      }[],
      limit: number,
      labelWidth: number,
    ) => {
      const { rows } = buildStackRows(items, limit, t('aiStatistics.other'));
      const names = TOKEN_STACK_FIELDS.map((field) => t(TOKEN_STACK_LABEL_KEYS[field]));
      const cells = stackedCells(rows.map((r) => r.values));
      const total = rows.reduce((sum, r) => sum + r.values.reduce((x, v) => x + v, 0), 0);
      /* 上界自己算，不交给 auto。ECharts 的取整只认 1/2/5/10 档：最大行 17M 会被抬到
         30M，最长那条只占绘图区 57%，右边空出一大片，看起来像图没画完。
         钉到 niceMax 之后条形能吃掉 85%~95% 的宽度，占比直接用长度读 ——
         这正是拿横条代替饼环的理由（上界松了，环和条给的信息量就差远了）。 */
      const max = niceMax(rows.map((r) => r.values.reduce((x, v) => x + v, 0)));
      return {
        rows: rows.length,
        option: {
          animationDuration: 700,
          animationEasing: 'cubicOut',
          /* bottom 只留网格的呼吸位：四种 token 的色板由两张图共用一行 HTML 图例，
             再让 ECharts 各画一条就是同一句话讲两遍，还各吃掉 32px。 */
          grid: { left: 2, right: 14, bottom: 6, top: 6, containLabel: true },
          xAxis: {
            ...VALUE_AXIS_BASE,
            max,
            interval: max / 2,
            /* 刻度压缩：原样输出「1,500,000」会被卡片右边缘切掉半个字 */
            axisLabel: { fontSize: 10, formatter: compactTick },
            splitNumber: 2,
          },
          yAxis: {
            ...CATEGORY_AXIS_BASE,
            data: rows.map((r) => r.id),
            inverse: true,
            axisLabel: { fontSize: 10, width: labelWidth, overflow: 'truncate' },
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: stackTooltip(names),
          },
          /* EChartsWrapper 的 baseOption 里带着 legend.textStyle，legend.show 仍是默认的
             true —— 不显式关掉，它会照着 series 名字自己长出一条图例来，白占 32px。 */
          legend: { show: false },
          series: names.map((name, index) => ({
            name,
            type: 'bar' as const,
            stack: 'total',
            data: cells.map((row) => row[index]),
            barMaxWidth: BAR_THICKNESS,
            itemStyle: { color: ramp[index % 4] },
            emphasis: { focus: 'series' as const },
          })),
        } satisfies EChartsOption,
        total,
      };
    },
    [ramp, stackTooltip, t],
  );

  /* 模型名带 provider 前缀（anthropic/claude-opus-4-8），窄列只能露出十几个字符，
     这张卡占了 7 列，就把标签宽度放开；类型名本来就短，走窄列。
     条数都收到 4 行以内：再往下排就只是「更多项」，而每一项在「数据明细」弹窗里
     都有一整张逐行表可查，一级不必替它做完。 */
  const modelStack = useMemo(
    () => buildTokenStackOption(tokenModelChartData, 5, 168),
    [tokenModelChartData, buildTokenStackOption],
  );
  const typeStack = useMemo(
    () => buildTokenStackOption(tokenTypeChartData, 3, 92),
    [tokenTypeChartData, buildTokenStackOption],
  );

  // ---- 性能 ----

  /**
   * 三张 24 小时图的数据源跟着顶部时间维度走，不再由区内的「单日 / 今日」开关决定：
   * 「今日」用单日 hourly，区间用 hourly-range 按 hour 聚合（跨天合并同一小时）。
   * 两种返回结构不一样，先拍平成 PerfHourPoint，下面的图表和读数只认这一种形状。
   */
  const perfHourSeries = useMemo<PerfHourPoint[]>(
    () =>
      isSingleDayPreset(rangePreset)
        ? toPerfHourSeries(performanceData)
        : aggregatePerformanceByHour(perfRangeRows),
    [rangePreset, performanceData, perfRangeRows],
  );

  const perfModelList = useMemo(() => {
    const map = new Map<string, { provider: string; model: string }>();
    for (const point of perfHourSeries) {
      for (const p of point.models) {
        const key = `${p.provider}-${p.model}`;
        if (!map.has(key)) {
          map.set(key, { provider: p.provider, model: p.model });
        }
      }
    }
    return Array.from(map.values());
  }, [perfHourSeries]);

  const perfHours = useMemo(
    () => perfHourSeries.map((d) => `${String(d.hour).padStart(2, '0')}:00`),
    [perfHourSeries],
  );

  /** 一项指标一张图：TTFT(ms)、TPS、请求数 量级差着几十倍，共用一根 Y 轴会把小的压平。 */
  const buildPerfHourOption = useCallback(
    (kind: 'line' | 'bar', pick: (p: PerfHourModel) => number): EChartsOption => {
      /* 同一天这些模型多半挂在同一个 provider 下，名字全带一份「openai-」前缀。
         三条一起就把底部图例撑到框宽之外，后面的色块压在前一个名字的最后一个字母上
         （Preview 少个 w、deepseek-v4.1-flas 少个 h）。前缀只对多 provider 才有区分度。 */
      const providerCount = new Set(perfModelList.map((pm) => pm.provider)).size;
      const names = perfModelList.map((pm) =>
        providerCount > 1 ? `${pm.provider}-${pm.model}` : pm.model,
      );
      const data = perfModelList.map((pm) =>
        perfHourSeries.map((h) => {
          const found = h.models.find((pp) => pp.provider === pm.provider && pp.model === pm.model);
          if (!found) return null;
          const v = pick(found);
          return v > 0 ? v : null;
        }),
      );
      const values = data.flat().filter((v): v is number => v !== null);
      const max = niceMax(values);
      /* 图例一律关掉。三张图并排时每张只有 2 列宽，模型名（deepseek/deepseek-v4.1-flash
         这类）根本放不下：ECharts 会分页到 1/3，还把名字截成「…-M」，读者要翻页才能
         对上颜色。关掉后底部 34px 还给绘图区，模型对应关系由同排「模型分布」的图例
         统一给（配色同为 ramp 按模型索引取色，tooltip 里也带模型名）。 */
      const legend: EChartsOption['legend'] = { show: false };
      const shell = {
        animationDuration: 700,
        animationEasing: 'cubicOut' as const,
        /* 写死余量而不是交给 containLabel：开了之后每格绘图区宽度随自己的标签长度浮动
           （TTFT 顶到 1k、请求数顶到 100），三格并排就对不齐。余量取 ROW_GRID ——
           这一行四张图共用同一份，绘图区才能逐像素对齐。 */
        grid: ROW_GRID,
        xAxis: {
          ...CATEGORY_AXIS_BASE,
          data: perfHours,
          axisLabel: { fontSize: 9, hideOverlap: true, margin: 6, interval: 'auto' as const },
        },
        yAxis: {
          ...VALUE_AXIS_BASE,
          min: 0,
          max,
          /* 上界自己定等分，不交给 auto split：上界刚好落在 niceMax 的档上时，
             它会算出一串到不了上界的刻度，再额外补一个上界数字，
             于是「900」紧贴「1k」两行糊在一起。/5 让最后一档正好落在 max 上。 */
          interval: max / 5,
          axisLabel: { fontSize: 9, formatter: compactTick },
        },
        tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
        legend,
      };
      // 折线与柱状是两种 series 类型，ECharts 的类型是按字面量收窄的，
      // 这里必须分两支返回，不能把 type 提成变量。
      if (kind === 'bar') {
        return {
          ...shell,
          series: names.map((name, idx) => {
            const color = ramp[idx % 4];
            return {
              name,
              type: 'bar' as const,
              data: data[idx],
              /* 独占一行的 24 根小时柱。24 个连续时间桶，所以组间距给 0 —— 小时本身
                 就是连续的，条挨着条才读得出「这是时间轴上的一个连续直方图」。
                 顺带把条撑满自己的槽位：不设 barCategoryGap 时 ECharts 默认留 20%，
                 13px 的槽被压成 10px，比全页其它柱细一截，看着像另一套画的。
                 这张是全页最密的一张（24 类挤 ~350px），槽宽到不了 16，
                 所以条粗细最多到槽宽为止；槽随视口变宽就会自己追上 16。 */
              barMaxWidth: BAR_THICKNESS,
              barCategoryGap: '0%',
              itemStyle: { color: barFill(color), borderRadius: BAR_RADIUS_TOP },
              emphasis: { focus: 'series' as const, itemStyle: { color } },
            };
          }),
        };
      }
      return {
        ...shell,
        series: names.map((name, idx) => {
          const color = ramp[idx % 4];
          return {
            name,
            type: 'line' as const,
            smooth: 0.25,
            connectNulls: false,
            showSymbol: false,
            symbol: 'circle',
            symbolSize: 4,
            data: data[idx],
            lineStyle: { width: 2, cap: 'round' as const },
            itemStyle: { color },
            /* 24 点折线铺一层主色渐变，和区间趋势同一套画法 */
            areaStyle: { color: barFill(color) },
            emphasis: { focus: 'series' as const },
          };
        }),
      };
    },
    [perfModelList, perfHourSeries, perfHours, ramp],
  );

  const perfTTFTOption = useMemo(
    () => buildPerfHourOption('line', (p) => p.ttft_avg_ms),
    [buildPerfHourOption],
  );
  const perfTPSOption = useMemo(
    () => buildPerfHourOption('line', (p) => p.tps_avg),
    [buildPerfHourOption],
  );
  const perfRequestOption = useMemo(
    () => buildPerfHourOption('bar', (p) => p.request_count),
    [buildPerfHourOption],
  );

  const perfRangeAggregated = useMemo(
    () => aggregatePerformanceByDate(perfRangeRows),
    [perfRangeRows],
  );

  // ---- 时间段 ----

  /* 趋势区吃哪份区间数据。区间档直接复用顶部那份 rangeData；「今日」档一天画不出走势，
     换成单独取的最近 7 天。放在三个 option 之前算好，它们就不用再关心分支。 */
  const trendSource = isSingleDayPreset(rangePreset) ? trendData : rangeData;
  const trendLoadingNow = isSingleDayPreset(rangePreset) ? trendLoading : rangeLoading;
  const trendErrorNow = isSingleDayPreset(rangePreset) ? trendError : rangeError;
  const trendIsEmpty =
    !trendSource ||
    trendSource.daily.length === 0 ||
    trendSource.daily.every(
      (d) => d.total_tokens === 0 && d.input_tokens === 0 && d.output_tokens === 0,
    );

  /** 区间每日 Token 走势。总 Token 铺主色渐变，四项拆分走细线。 */
  const rangeTrendOption = useMemo<EChartsOption>(() => {
    const days = trendSource?.daily ?? [];
    const totals = days.map((d) => d.total_tokens);
    const names = [
      t('aiStatistics.totalTokens'),
      t('aiStatistics.inputTokens'),
      t('aiStatistics.outputTokens'),
      t('aiStatistics.cacheReadTokens'),
      t('aiStatistics.cacheWriteTokens'),
    ];
    const line = (name: string, data: number[], color: string, width: number, area?: boolean) => ({
      name,
      type: 'line' as const,
      smooth: 0.25,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 4,
      data,
      lineStyle: { width, cap: 'round' as const },
      itemStyle: { color },
      areaStyle: area ? { color: barFill(color) } : undefined,
    });
    return {
      animationDuration: 700,
      animationEasing: 'cubicOut',
      grid: { left: 2, right: 14, bottom: 32, top: 10, containLabel: true },
      xAxis: {
        ...CATEGORY_AXIS_BASE,
        data: days.map((d) => d.date.slice(5)),
        axisLabel: { fontSize: 10, hideOverlap: true, margin: 6 },
      },
      yAxis: {
        ...VALUE_AXIS_BASE,
        min: 0,
        max: niceMax(totals),
        axisLabel: { fontSize: 10, formatter: compactTick },
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { type: 'dashed' } } },
      legend: bottomLegend(names, true),
      series: [
        line(names[0], totals, ramp[0], 2, true),
        line(
          names[1],
          days.map((d) => d.input_tokens),
          ramp[1],
          1.5,
        ),
        line(
          names[2],
          days.map((d) => d.output_tokens),
          ramp[2],
          1.5,
        ),
        line(
          names[3],
          days.map((d) => d.cache_read_tokens),
          ramp[3],
          1.5,
        ),
        line(
          names[4],
          days.map((d) => d.cache_write_tokens),
          ramp[4],
          1.5,
        ),
      ],
    };
  }, [trendSource, ramp, bottomLegend, t]);

  /** 区间效率趋势：两项均耗走左轴，用户回合数走右轴柱子。 */
  const rangeEfficiencyOption = useMemo<EChartsOption>(() => {
    const days = trendSource?.daily ?? [];
    const names = [
      t('aiStatistics.avgTokensPerUserTurn'),
      t('aiStatistics.avgTokensPerAgentRun'),
      t('aiStatistics.userTurnCount'),
    ];
    // 两根轴各自算自己的上界和等分：共用一个 interval 只会有一边对齐
    const tokenMax = niceMax(days.map((d) => d.avg_tokens_per_user_turn ?? 0));
    const turnMax = niceMax(days.map((d) => d.user_turn_count ?? 0));
    return {
      animationDuration: 700,
      animationEasing: 'cubicOut',
      /* 双 Y 轴，两侧各留一条数字的宽度，底部三项图例。
         grid 直接用 ROW_GRID：单轴图与这张双轴图共用同一份余量，
         绘图区才落在同一个矩形里，x 轴标签才在一条水平线上。 */
      grid: ROW_GRID,
      xAxis: {
        ...CATEGORY_AXIS_BASE,
        data: days.map((d) => d.date.slice(5)),
        axisLabel: { fontSize: 9, hideOverlap: true, margin: 6, interval: 'auto' },
      },
      yAxis: [
        {
          ...VALUE_AXIS_BASE,
          min: 0,
          max: tokenMax,
          interval: tokenMax / 5,
          axisLabel: { fontSize: 9, color: axis.text, formatter: compactTick },
        },
        {
          ...VALUE_AXIS_BASE,
          min: 0,
          max: turnMax,
          interval: turnMax / 5,
          /* 次轴必须显式贴到右侧：两轴默认都画在左边，两列数字叠在一起读不出来 */
          position: 'right',
          splitLine: { show: false },
          axisLabel: { fontSize: 9, color: axis.text, formatter: compactTick },
        },
      ],
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      /* tight：这张图只占 3 列（约 350px），默认尺寸放不下三项中文图例，
         ECharts 会分页到 1/2，读者得翻页才能对上颜色。压紧后一行放下。 */
      legend: bottomLegend(names, true),
      series: [
        {
          name: names[0],
          type: 'line',
          yAxisIndex: 0,
          smooth: 0.25,
          showSymbol: false,
          data: days.map((d) => d.avg_tokens_per_user_turn ?? 0),
          lineStyle: { width: 2, cap: 'round' },
          itemStyle: { color: ramp[0] },
          areaStyle: { color: softAreaFill(ramp[0]) },
        },
        {
          name: names[1],
          type: 'line',
          yAxisIndex: 0,
          smooth: 0.25,
          showSymbol: false,
          data: days.map((d) => d.avg_tokens_per_agent_run ?? 0),
          lineStyle: { width: 2, cap: 'round' },
          itemStyle: { color: ramp[1] },
        },
        {
          name: names[2],
          type: 'bar',
          yAxisIndex: 1,
          data: days.map((d) => d.user_turn_count ?? 0),
          barMaxWidth: BAR_THICKNESS,
          itemStyle: { color: withAlpha(ramp[2], 0.75), borderRadius: BAR_RADIUS_TOP },
        },
      ],
    };
  }, [trendSource, ramp, axis.text, bottomLegend, t]);

  // ---- RAG 文档命中 Top ----

  const ragTopDocs = useMemo(
    () =>
      [...ragDocuments]
        .filter((doc) => (doc?.hit_count ?? 0) > 0)
        .sort((a, b) => (b.hit_count ?? 0) - (a.hit_count ?? 0))
        .slice(0, 10),
    [ragDocuments],
  );

  const ragDocsOption = useMemo<EChartsOption>(
    () => ({
      animationDuration: 700,
      animationEasing: 'cubicOut',
      grid: { left: 2, right: 14, bottom: 8, top: 8, containLabel: true },
      xAxis: {
        ...VALUE_AXIS_BASE,
        /* 刻度压缩：原样输出「1,500,000」会被卡片右边缘切掉半个字 */
        axisLabel: { fontSize: 10, formatter: compactTick },
        splitNumber: 2,
      },
      yAxis: {
        ...CATEGORY_AXIS_BASE,
        data: ragTopDocs.map((d) => d.document_name || '-'),
        inverse: true,
        axisLabel: { fontSize: 10, width: 140, overflow: 'truncate' },
      },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { show: false },
      series: [
        {
          type: 'bar',
          data: ragTopDocs.map((d) => d.hit_count),
          barMaxWidth: BAR_THICKNESS,
          itemStyle: { color: barFill(ramp[0]), borderRadius: BAR_RADIUS_RIGHT },
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            color: axis.muted,
            formatter: '{c}',
          },
          emphasis: { focus: 'series' },
        },
      ],
    }),
    [ragTopDocs, ramp, axis.muted],
  );

  // ============================================================================
  // 派生读数
  // ============================================================================

  const efficiency = summary?.efficiency ?? EMPTY_EFFICIENCY;
  const tokenUsage = summary?.token_usage;
  const inputTokens = tokenUsage?.total_input_tokens ?? 0;
  const outputTokens = tokenUsage?.total_output_tokens ?? 0;
  const cacheReadTokens = tokenUsage?.total_cache_read_tokens ?? 0;
  const cacheWriteTokens = tokenUsage?.total_cache_write_tokens ?? 0;
  const errorTotal = summary?.errors?.total ?? 0;

  /** 占比读数。分母为 0 时给 0%，别把 NaN 印到卡上。 */
  const shareOf = (part: number, base: number) =>
    base > 0 ? `${((part / base) * 100).toFixed(1)}%` : '0%';

  /** 主角卡跟着顶部的「看哪段时间」走：口径只有一套，summary 和 rangeData 各出一次，
   *  进来先归一成同一个形状，卡片就不需要知道自己现在看的是今天还是近 7 天。
   *  配色取 ramp[0..3]，和下面「各类型 Token 消耗」的堆叠条同一套 —— 同一页里两种蓝
   *  会被读成两种含义。 */
  const isRangeEmpty = useMemo(() => {
    if (!rangeData) return true;
    if (rangeData.daily.length === 0) return true;
    return rangeData.daily.every(
      (d) => d.total_tokens === 0 && d.input_tokens === 0 && d.output_tokens === 0,
    );
  }, [rangeData]);

  /** 当前时间维度的短标签，弹窗和性能区的区间档都靠它说清「这段是哪段」。 */
  const scopeLabel = t(
    RANGE_PRESET_TABS.find((p) => p.value === rangePreset)?.labelKey ?? 'aiStatistics.preset7d',
  );
  /** 相对档（7/14/30/90 天）实际解析出来的起止日，喂给页头那条只读日期条。 */
  const scopeDates = useMemo(() => {
    const { start_date: s, end_date: e } = computeRangeDates(rangePreset, selectedDate);
    if (!s) return '';
    if (!e || s === e) return s.slice(5);
    return `${s.slice(5)} → ${e.slice(5)}`;
  }, [rangePreset, selectedDate]);
  const scopeTotals = useMemo(() => {
    if (rangeData && !isRangeEmpty) {
      return {
        input: rangeData.total.input_tokens,
        output: rangeData.total.output_tokens,
        cacheRead: rangeData.total.cache_read_tokens,
        cacheWrite: rangeData.total.cache_write_tokens,
        label: `${rangeData.start_date} → ${rangeData.end_date} · ${t('aiStatistics.itemCount', { count: rangeData.days })}`,
      };
    }
    return {
      input: inputTokens,
      output: outputTokens,
      cacheRead: cacheReadTokens,
      cacheWrite: cacheWriteTokens,
      label: dateStr,
    };
  }, [
    rangeData,
    isRangeEmpty,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    dateStr,
    t,
  ]);

  const scopeTotal = scopeTotals.input + scopeTotals.output;

  const scopeMixSlices = [
    {
      label: t('aiStatistics.uncachedInput'),
      value: Math.max(0, scopeTotals.input - scopeTotals.cacheRead),
      text: formatCompactNumber(Math.max(0, scopeTotals.input - scopeTotals.cacheRead)),
      color: ramp[0],
    },
    {
      label: t('aiStatistics.cacheHit'),
      value: scopeTotals.cacheRead,
      text: formatCompactNumber(scopeTotals.cacheRead),
      color: ramp[2],
    },
    {
      label: t('aiStatistics.outputTokens'),
      value: scopeTotals.output,
      text: formatCompactNumber(scopeTotals.output),
      color: ramp[1],
    },
  ];

  /** 缓存命中率分母为 input_tokens（provider prompt_tokens 本身已包含缓存命中部分）。 */
  const scopeCacheBase = scopeTotals.input;

  /** 剖面读数给三张图卡的抬头用：请求数求和、TTFT / TPS 各模型均值。
   *  原来的三格 sparkline 就是同一份数据的缩影 —— 曲线下面就是那三张图，
   *  等于把同一句话在一行读数里说一遍、在下一行又说一遍，所以一并删掉了。 */
  const perfTotals = useMemo(
    () => (perfHourSeries.length === 0 ? null : perfHourTotals(perfHourSeries)),
    [perfHourSeries],
  );

  /** 延迟 / 错误率的时间标签：今日档写当天，区间档写起止日。
   *  这三块原先只跟「选中日」走（/summary 只按 selectedDate 返回），而 Token 和
   *  三张 24 小时图跟着顶部的范围走 —— 同一屏摆着两段时间，切到 30 天就会读成
   *  「这 30 天的错误率」，而分子分母其实都只有某一天。后端现在把区间口径一起
   *  返回（token-by-range 的 latency / errors），两块才真的是同一段。 */
  const isRangeScope = !isSingleDayPreset(rangePreset);
  const scopeMark = isRangeScope
    ? scopeDates
    : format(singleDayDate(rangePreset, selectedDate), 'MM-dd');

  const latencyAvg = isRangeScope ? (rangeData?.latency?.avg ?? 0) : (summary?.latency?.avg ?? 0);
  const latencyP95 = isRangeScope ? (rangeData?.latency?.p95 ?? 0) : (summary?.latency?.p95 ?? 0);
  const latencyReady = isRangeScope ? !!rangeData?.latency : !!summary?.latency;
  /** 区间全是迁移前的历史行时后端拿不到样本数，avg 是「各日均值的算术平均」的估算值。
   *  标出来，别让它看起来和加权后的精确值一样。 */
  const latencyEstimated = isRangeScope && !!rangeData?.latency && rangeData.latency.samples === 0;

  const errorBreakdown = useMemo(() => {
    const err = (isRangeScope ? rangeData?.errors : summary?.errors) ?? ({} as ErrorStats);
    return [
      { key: 'timeout', label: t('aiStatistics.timeout'), value: err.timeout ?? 0 },
      { key: 'rateLimit', label: t('aiStatistics.rateLimit'), value: err.rate_limit ?? 0 },
      { key: 'networkError', label: t('aiStatistics.networkError'), value: err.network_error ?? 0 },
      { key: 'usageLimit', label: t('aiStatistics.usageLimit'), value: err.usage_limit ?? 0 },
      { key: 'agentError', label: t('aiStatistics.agentError'), value: err.agent_error ?? 0 },
      { key: 'api529Error', label: t('aiStatistics.api529Error'), value: err.api_529_error ?? 0 },
    ].filter((item) => item.value > 0);
  }, [isRangeScope, rangeData, summary, t]);

  const errorTypeLabel = (raw: string) => {
    const keyByType: Record<string, string> = {
      timeout: 'aiStatistics.timeout',
      rate_limit: 'aiStatistics.rateLimit',
      network_error: 'aiStatistics.networkError',
      usage_limit: 'aiStatistics.usageLimit',
      agent_error: 'aiStatistics.agentError',
      api_529_error: 'aiStatistics.api529Error',
      quota_breaker_open: 'aiStatistics.quotaBreakerOpen',
      quota_exhausted: 'aiStatistics.quotaExhausted',
      content_rejected: 'aiStatistics.contentRejected',
      client_error: 'aiStatistics.clientError',
    };
    const key = keyByType[raw];
    return key ? t(key) : raw;
  };

  const memoryStats = summary?.memory;
  const memoryHealth = useMemo(() => memoryIngestHealth(memoryStats), [memoryStats]);

  /** 错误率 = 区间错误数 / 区间请求数。分母直接取「请求次数」卡上那个数
   *  （perfTotals.requests），它本来就跟着范围走 —— 分子分母取同一段，
   *  顺带让两个读数能互相验算。 */
  const perfErrorTotal = isRangeScope ? (rangeData?.errors?.total ?? 0) : errorTotal;
  const errorRate = (() => {
    const requests = perfTotals?.requests ?? 0;
    return requests > 0 ? (perfErrorTotal / requests) * 100 : null;
  })();

  // ============================================================================
  // 渲染
  // ============================================================================

  /* 「历史趋势」页签已撤：它那两张图（每日走势 / 效率趋势）就是「区间走势」区的
     同一组数据，只是各占满一整行；内容并进概览后逐行明细没处放，搬进了「数据明细」。 */
  const tabOptions = [
    {
      value: 'overview',
      label: t('aiStatistics.overview'),
      icon: <TrendingUp className="w-4 h-4" />,
    },
    { value: 'rag', label: t('aiStatistics.ragEffect'), icon: <Database className="w-4 h-4" /> },
    { value: 'users', label: t('aiStatistics.users'), icon: <Users className="w-4 h-4" /> },
  ];

  const presetTabs = (values: ReadonlyArray<RangePreset>) =>
    values.map((value) => {
      const preset = RANGE_PRESET_TABS.find((p) => p.value === value);
      return { value, label: t(preset?.labelKey ?? 'aiStatistics.preset7d') };
    });

  /**
   * 「查看详情」按钮：概览只给读数与趋势，明细点开成弹窗，不跳走。
   * 和分段器同一行右对齐 —— 它是那组控件的一部分，不是组标题的一部分。
   */
  const detailTrigger = (label: string, onClick: () => void) => (
    <Button
      variant="ghost"
      className="h-10 shrink-0 gap-1 px-3 text-sm text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </Button>
  );

  return (
    <PinnedPage
      className="gap-4"
      header={
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="w-8 h-8" />
            {t('aiStatistics.title')}
          </h1>
          {/* 「更新于」是页面元信息，不是筛选控件 —— 和 H1 底边对齐挂在标题行右端。
              它原先和 preset、日期、刷新挤在同一行，是那行放不下、右侧页签被顶到
              第二行的直接原因；挪走后工具栏只剩「选哪段时间 / 看哪一页」两类控件。 */}
          <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {t('aiStatistics.lastUpdated')}
            {updatedAt ? ` ${format(updatedAt, 'HH:mm:ss')}` : ''}
          </span>
        </div>
      }
      toolbar={
        /* 时间和分类是两种筛选，都跟着标题常驻。左边这一排是全页唯一的「看哪段时间」
           入口：主角卡、区间走势、性能区共用它，不再在区块里各摆一排预设。 */
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TabButtonGroup
              options={presetTabs(['today', 'yesterday', '7d', '14d', '30d', '90d', 'custom'])}
              value={rangePreset}
              onValueChange={(v) => setRangePreset(v as RangePreset)}
              collapseOnMobile
            />
            {/* 日期控件恒定占一个 152px 的槽：切档时整行宽度不变，右侧那排页签
                就不会被挤到第二行、孤零零地靠左摆着（看着最不协调）。
                相对档没有可选项，就放一条只读的解析结果 —— 只在「今日」冒出一张
                日历卡、其余档又消失，行宽忽宽忽窄才是「不协调」的真正来源。 */}
            {rangePreset === 'today' ? (
              <div className={rangeControlShellClass}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" className={rangeControlBtnClass}>
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span className="truncate tabular-nums">{dateStr}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
                    <MetricDayCalendar
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      metrics={dailyInputTokens}
                      disableEmpty
                      formatMetric={formatCompactMetric}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : rangePreset === 'custom' ? (
              /* 起止两个按钮并排会把这行撑到 300px 宽，「自定义」一选就换行。
                 改成一个区间日历：宽度恒定，还能一次拖出整段。 */
              <div className={rangeControlShellClass}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        rangeControlBtnClass,
                        (!rangeStartDate || !rangeEndDate) && 'text-muted-foreground',
                      )}
                    >
                      <CalendarDays className="h-4 w-4 shrink-0" />
                      <span className="truncate tabular-nums">
                        {rangeStartDate && rangeEndDate
                          ? `${format(rangeStartDate, 'MM-dd')} → ${format(rangeEndDate, 'MM-dd')}`
                          : t('aiStatistics.rangeStart')}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
                    <CalendarComponent
                      mode="range"
                      numberOfMonths={2}
                      selected={
                        rangeStartDate || rangeEndDate
                          ? { from: rangeStartDate, to: rangeEndDate }
                          : undefined
                      }
                      onSelect={(r) => {
                        setRangeStartDate(r?.from);
                        setRangeEndDate(r?.to);
                      }}
                      defaultMonth={rangeStartDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <div className={rangeControlShellClass}>
                <span className="flex h-10 w-[152px] items-center gap-2 px-3 text-sm tabular-nums text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span className="truncate">{scopeDates}</span>
                </span>
              </div>
            )}
            {/* 刷新收成图标按钮：这行是整页唯一放得下「筛选 + 页签」的地方，
                45px 的按钮文案换 45px 的留白更划算 —— 页签组因此能在 1366 宽的笔电上
                也留在同一行。动作本身不常错，Tooltip 报得出它是什么。 */}
            <div className={rangeControlShellClass}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => void loadData()}
                    disabled={isLoading}
                    aria-label={t('common.refresh')}
                    className={rangeIconButtonClass}
                  >
                    <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('common.refresh')}</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {/* 页签组 ml-auto + shrink-0：左侧筛选先吃空隙，实在放不下时才换行，
              页签组永远贴着右边缘，不会孤零零掉在第二行左边。 */}
          <div className="ml-auto flex shrink-0 items-center">
            <TabButtonGroup
              options={tabOptions}
              value={activeTab}
              onValueChange={setActiveTab}
              collapseOnMobile
            />
          </div>
        </div>
      }
    >
      {error && (
        <GlassAlert tone="danger" icon={AlertTriangle}>
          {error}
        </GlassAlert>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <TileSkeleton count={6} />
          <TileSkeleton count={6} />
        </div>
      ) : summary ? (
        <>
          {/* ================================================================
              概览
              ================================================================ */}

          {activeTab === 'overview' && (
            <div className="glass-card-grid">
              {/* 用量与性能合成一区：三张 24 小时图讲的是同一段时间的同一批请求，
                  原来它们被「Token 计量」和「性能」两个区标题、一排「单日 / 今日」
                  胶囊、一整行读数条隔开，读的时候要在两屏之间来回对时间口径。
                  现在一区到底：读数 → 一天的形状 → 构成拆解，省掉一个区标题、
                  一排开关和一整行读数条。 */}
              <SectionLabel
                title={t('aiStatistics.usageAndPerformance')}
                icon={Coins}
                hint={isSingleDayPreset(rangePreset) ? undefined : t('aiStatistics.hourProfileRangeHint')}
                action={
                  <div className="flex items-center gap-1">
                    {detailTrigger(t('aiStatistics.dataDetail'), () => setDataDetailOpen(true))}
                    {detailTrigger(t('aiStatistics.performanceDetail'), () => {
                      setPerfMode(isSingleDayPreset(rangePreset) ? 'day' : 'range');
                      setPerfDetailOpen(true);
                    })}
                  </div>
                }
              />

              {/* 四类 Token 收成主角卡里的一根占比条：原来四张拆分卡各占 1/6 页宽、
                  各自只装两行字，卡与卡之间还有缝，纵向多花一整行。现在条形给比例、
                  图例给名字、悬停浮窗给数字。数字跟着顶部的时间维度走，切近 7 天
                  主角卡就变成这 7 天的合计。
                  主角卡从 8+4 收成 6+3，右边腾出的 3 列给延迟 / 错误率 ——
                  原来这两格在三张图的读数条里，那一整行就为了两个数。 */}
              <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-12">
                <div className="md:col-span-12 xl:col-span-6">
                  <MetricHero
                    title={t('aiStatistics.totalTokens')}
                    value={formatCompactNumber(scopeTotal)}
                    desc={scopeTotals.label}
                    icon={Coins}
                  >
                    <RatioBar slices={scopeMixSlices} total={scopeTotal} />
                  </MetricHero>
                </div>
                {/* 缓存命中率只有一行数字，单独一张卡会被主角卡撑出半张白。
                    拆成「命中 / 未命中」两段条 + 两行图例，高度就和主角卡齐平了。 */}
                <div className="md:col-span-12 xl:col-span-3">
                  <MetricHero
                    title={t('aiStatistics.cacheHitRate')}
                    value={shareOf(scopeTotals.cacheRead, scopeCacheBase)}
                    desc={`${formatCompactNumber(scopeTotals.cacheRead)} / ${formatCompactNumber(scopeCacheBase)}`}
                    icon={Zap}
                  >
                    <RatioBar
                      slices={[
                        {
                          label: t('aiStatistics.cacheHit'),
                          value: scopeTotals.cacheRead,
                          text: formatCompactNumber(scopeTotals.cacheRead),
                          color: ramp[2],
                        },
                        {
                          label: t('aiStatistics.cacheMiss'),
                          value: Math.max(0, scopeTotals.input - scopeTotals.cacheRead),
                          text: formatCompactNumber(
                            Math.max(0, scopeTotals.input - scopeTotals.cacheRead),
                          ),
                          color: NEUTRAL_SEGMENT,
                        },
                      ]}
                      total={scopeCacheBase}
                    />
                  </MetricHero>
                </div>
                {/* 延迟和错误率是仅有的两个「没有对应图表」的指标：后端只给了汇总值，
                    没有小时级序列。请求次数 / TTFT / TPS 那三格原来也占着位置，
                    但它们的 sparkline 就是下面三张图本身 —— 数字直接搬进那三张卡的
                    抬头，这里只留下真正需要单独占一格的。

                    两格都跟着顶部范围走（scopeMark 就是那段日期）：今日档取内存实时值，
                    区间档取 token-by-range 一起带回来的 latency / errors。描述里把
                    这段写出来，是为了让人一眼看出这块读数覆盖的是哪几天。 */}
                <div className="md:col-span-12 xl:col-span-3">
                  <StatStrip
                    className="h-full"
                    items={[
                      /* 延迟是「整个请求」的口径，和 TTFT（首字）不是一回事，
                         拿 TTFT 的走势顶替会读错。竖向计：下段是平均，
                         上段是 P95 减平均的尾巴，一眼看出「尾部有多长」。
                         区间档的 P95 是各日峰值取最大，标成「峰值」而不是区间 P95 ——
                         逐日 P95 没法再合并成一个 P95。 */
                      {
                        title: t('aiStatistics.latency'),
                        value: latencyReady ? `${latencyAvg.toFixed(2)}s` : '—',
                        desc: [
                          scopeMark,
                          isRangeScope
                            ? t('aiStatistics.latencyPeak', { value: latencyP95.toFixed(2) })
                            : `P95 ${latencyP95.toFixed(2)}s`,
                          latencyEstimated ? t('aiStatistics.latencyEstimated') : null,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                        meter: {
                          max: Math.max(latencyP95, 0.01),
                          segments: [
                            { value: latencyAvg, color: ramp[0] },
                            {
                              value: Math.max(latencyP95 - latencyAvg, 0),
                              color: ramp[1],
                            },
                          ],
                        },
                      },
                      /* 错误率而不是错误条数：条数会随并发量乱跳，率才看得出
                         「是不是真的坏了」。刻度取 0~10% 而不是 0~100%：1.4% 在
                         百刻度上只有一根发丝，看上去和「没数据」没两样。
                         分母取「请求次数」卡上那个数，分子分母同一段。 */
                      {
                        title: t('aiStatistics.errorRate'),
                        value: errorRate !== null ? `${errorRate.toFixed(1)}%` : '—',
                        desc: `${scopeMark} · ${t('aiStatistics.errorCount', { count: perfErrorTotal })}`,
                        meter: {
                          max: 10,
                          segments: [{ value: errorRate ?? 0, color: ramp[3] }],
                        },
                        onClick: () => setErrorDetailOpen(true),
                      },
                    ]}
                  />
                </div>
              </div>

              {/* 四张时间序列图并成一行，各占 3 列：三张 24 小时剖面 + 一张效率趋势。
                  「每日走势」原来也挤在这行里（5 张，前三张各 2 列）。三列宽装不下
                  「首字延迟 (TTFT)」这种标题 —— 右边还有读数，一挤就 truncate 成
                  「首字延迟 (T...」；而且它讲的是 token，下面那行整行讲的也是 token，
                  搬过去反而各得其所。这一行空出来的两列，四张图每张从 2/3 列涨到 3 列。 */}
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-12">
                <DataBlock
                  title={t('aiStatistics.ttft')}
                  icon={Clock}
                  className="xl:col-span-3"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {perfTotals ? `${perfTotals.ttft.toFixed(1)} ms` : '—'}
                    </span>
                  }
                >
                  <div className="flex h-full items-center">
                    {perfHourSeries.length > 0 ? (
                      <EChartsWrapper option={perfTTFTOption} height={ROW_CHART_HEIGHT} />
                    ) : (
                      <EmptyChart label={t('common.noData')} />
                    )}
                  </div>
                </DataBlock>

                <DataBlock
                  title={t('aiStatistics.tps')}
                  icon={Zap}
                  className="xl:col-span-3"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {perfTotals ? perfTotals.tps.toFixed(1) : '—'}
                    </span>
                  }
                >
                  <div className="flex h-full items-center">
                    {perfHourSeries.length > 0 ? (
                      <EChartsWrapper option={perfTPSOption} height={ROW_CHART_HEIGHT} />
                    ) : (
                      <EmptyChart label={t('common.noData')} />
                    )}
                  </div>
                </DataBlock>

                <DataBlock
                  title={t('aiStatistics.requestCount')}
                  icon={Gauge}
                  className="xl:col-span-3"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {perfTotals ? perfTotals.requests.toLocaleString() : '—'}
                    </span>
                  }
                >
                  <div className="flex h-full items-center">
                    {perfHourSeries.length > 0 ? (
                      <EChartsWrapper option={perfRequestOption} height={ROW_CHART_HEIGHT} />
                    ) : (
                      <EmptyChart label={t('common.noData')} />
                    )}
                  </div>
                </DataBlock>

                {/* 效率趋势。数据源和错误/空态都跟每日走势共用 trendSource，
                    早先整块挂在 `scope !== 'today'` 上，于是默认档位下这张图
                    等于消失了 —— 页签撤掉之后就没有第二个入口能再找到它。 */}
                {trendErrorNow && !trendLoadingNow ? (
                  <Card className="glass-card border-destructive/50 xl:col-span-3">
                    <CardContent className="flex items-center gap-3 p-4 text-destructive">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span className="min-w-0 flex-1 break-words text-sm">{trendErrorNow}</span>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void (isSingleDayPreset(rangePreset) ? fetchTrendData() : fetchRangeData())
                        }
                      >
                        <RefreshCw className="mr-1 h-4 w-4" />
                        {t('aiStatistics.refresh')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : trendLoadingNow ? (
                  <Skeleton className="h-[220px] rounded-[inherit] xl:col-span-3" />
                ) : trendSource && !trendIsEmpty ? (
                  <DataBlock
                    title={t('aiStatistics.efficiencyTrend')}
                    icon={Target}
                    className="xl:col-span-3"
                    extra={
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {`${t('aiStatistics.userTurnCount')} ${trendSource.efficiency?.user_turn_count ?? 0}`}
                        {' · '}
                        {`${t('aiStatistics.agentRunCount')} ${trendSource.efficiency?.agent_run_count ?? 0}`}
                      </span>
                    }
                  >
                    <div className="flex h-full items-center">
                      <EChartsWrapper
                        option={rangeEfficiencyOption}
                        height={ROW_CHART_HEIGHT}
                        lazyUpdate={false}
                      />
                    </div>
                  </DataBlock>
                ) : (
                  <DataBlock
                    title={t('aiStatistics.efficiencyTrend')}
                    icon={Target}
                    className="xl:col-span-3"
                  >
                    <EmptyChart height={ROW_CHART_HEIGHT} label={t('aiStatistics.noDataInRange')} />
                  </DataBlock>
                )}
              </div>

              {/* token 的三个视角并成一行，各 4 列：随时间的走势、按模型拆、按类型拆。
                  「每日走势」原来挤在时序行里（那一行塞了 5 张，三张 24h 剖面被压到
                  2 列，标题直接 truncate 成「首字延迟 (T...」），而构成行只有两张却占了
                  7+5 列 —— 横条图拉到 790px 宽，条形却只到 57%，右边空出一大片。
                  合成一行三张，两头都不匀的问题一起消掉。 */}
              {/* 不加 items-start：这一行三张卡必须等高，底边不齐比卡内留白刺眼得多。
                  每日走势比两张构成卡略高（TOKEN_TREND_HEIGHT 130），构成图的下限又正好
                  是 120，所以三张卡实际差在十像素上下，肉眼看不出来。 */}
              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
                {/* 每日走势。跟上一行的效率趋势共用 trendSource，但各自成卡，
                    所以加载、错误、空态在这一格里单独处理 —— 错误要能就地重试。 */}
                {trendErrorNow && !trendLoadingNow ? (
                  <Card className="glass-card border-destructive/50 lg:col-span-6 xl:col-span-4">
                    <CardContent className="flex items-center gap-3 p-4 text-destructive">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span className="min-w-0 flex-1 break-words text-sm">{trendErrorNow}</span>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void (isSingleDayPreset(rangePreset) ? fetchTrendData() : fetchRangeData())
                        }
                      >
                        <RefreshCw className="mr-1 h-4 w-4" />
                        {t('aiStatistics.refresh')}
                      </Button>
                    </CardContent>
                  </Card>
                ) : trendLoadingNow ? (
                  <Skeleton className="h-[220px] rounded-[inherit] lg:col-span-6 xl:col-span-4" />
                ) : trendSource && !trendIsEmpty ? (
                  <DataBlock
                    title={t('aiStatistics.dailyTrend')}
                    icon={Activity}
                    className="lg:col-span-6 xl:col-span-4"
                    extra={
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatCompactNumber(trendSource.total.total_tokens)}
                      </span>
                    }
                  >
                    <div className="flex h-full items-center">
                      <EChartsWrapper
                        option={rangeTrendOption}
                        height={TOKEN_TREND_HEIGHT}
                        lazyUpdate={false}
                      />
                    </div>
                  </DataBlock>
                ) : (
                  <DataBlock
                    title={t('aiStatistics.dailyTrend')}
                    icon={Activity}
                    className="lg:col-span-6 xl:col-span-4"
                  >
                    <EmptyChart
                      height={TOKEN_TREND_HEIGHT}
                      label={t('aiStatistics.noDataInRange')}
                    />
                  </DataBlock>
                )}

                {/* 「模型分布」环图已删：它和这张横条本来就是同一个东西 —— 同按模型拆、
                    同一个 total_token，只是一个用区间数据、一个用单日数据。两张并排读者
                    第一反应就是「这俩有区别吗」，而横条长度本身就是占比，环图没多给信息。
                    现在两条横条都跟着顶部时间维度走，口径统一，也不存在「一个区间一个
                    单日」的问题了。 */}
                <DataBlock
                  title={t('aiStatistics.tokenByModel')}
                  icon={Coins}
                  className="lg:col-span-6 xl:col-span-4"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatCompactNumber(modelStack.total)}
                    </span>
                  }
                >
                  <div className="flex h-full items-center">
                    {modelStack.rows > 0 ? (
                      <EChartsWrapper
                        option={modelStack.option}
                        height={stackChartHeight(modelStack.rows)}
                      />
                    ) : (
                      <EmptyChart label={t('common.noData')} />
                    )}
                  </div>
                </DataBlock>

                <DataBlock
                  title={t('aiStatistics.tokenByType')}
                  icon={Coins}
                  className="lg:col-span-6 xl:col-span-4"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatCompactNumber(typeStack.total)}
                    </span>
                  }
                >
                  <div className="flex h-full items-center">
                    {typeStack.rows > 0 ? (
                      <EChartsWrapper
                        option={typeStack.option}
                        height={stackChartHeight(typeStack.rows)}
                      />
                    ) : (
                      <EmptyChart label={t('common.noData')} />
                    )}
                  </div>
                </DataBlock>

                {/* 共享色板 + 分组说明：两张堆叠条的四段颜色是同一套，图例只画一次。 */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 lg:col-span-12">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t('aiStatistics.tokenComposition')}
                  </span>
                  <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                    {TOKEN_STACK_FIELDS.map((field, index) => (
                      <li key={field} className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: ramp[index % 4] }}
                        />
                        <span className="text-muted-foreground">
                          {t(TOKEN_STACK_LABEL_KEYS[field])}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4">
                <SectionLabel title={t('aiStatistics.zoneInvocation')} icon={GitBranch} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-12">
                <DataBlock
                  title={t('aiStatistics.intentDistribution')}
                  icon={Brain}
                  className="xl:col-span-4"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t('aiStatistics.itemCount', { count: intentSlices.length })}
                    </span>
                  }
                >
                  {/* 同行卡片等高后，内容垂直居中，空白均分上下而不是全堆在底部 */}
                  <div className="flex h-full flex-col justify-center gap-3">
                    <DonutChart
                      slices={intentSlices}
                      total={intentSlices.reduce((sum, s) => sum + s.value, 0)}
                      centerLabel={t('aiStatistics.totalTokens')}
                    />
                    <DonutLegend slices={intentSlices} />
                  </div>
                </DataBlock>

                <DataBlock
                  title={t('aiStatistics.triggerDistribution')}
                  icon={Zap}
                  className="xl:col-span-4"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t('aiStatistics.itemCount', { count: triggerItems.length })}
                    </span>
                  }
                >
                  {/* 曾经写死 height="100%" 吃满同行卡片的高度：行数少时分类轴把行距
                      拉开到 40 多 px，5 行条子稀稀拉拉铺开一整屏，读起来比图更费劲。
                      现在按行数给固定高度（上下居中，多的那点高度均成上下两条白边），
                      行距稳在 26px —— 白边是「这格没那么满」，拉开的空条带是「排坏了」。 */}
                  <div className="flex h-full items-center">
                    {triggerItems.length > 0 ? (
                      <EChartsWrapper
                        option={triggerOption}
                        height={rowChartHeight(triggerItems.length)}
                      />
                    ) : (
                      <EmptyChart label={t('common.noData')} />
                    )}
                  </div>
                </DataBlock>

                <DataBlock
                  title={t('aiStatistics.runComposition')}
                  icon={GitBranch}
                  className="xl:col-span-4"
                  extra={
                    <span className="text-[11px] text-muted-foreground">
                      {t('aiStatistics.runCompositionHint')}
                    </span>
                  }
                >
                  {/* 大数字放「总运行数」，Root / 嵌套拆到下面两行。
                      原来大数字是 Root、总数塞在右上角，两个数没有任何文字说明谁是谁，
                      读的人会把 130 当成总数，一看下面的 211 就以为数据错了 ——
                      口径其实是对的（root + nested = 总数），是排版让人误会。 */}
                  {/* 原来用 justify-between：被同行卡片撑高时，大数字钉在顶上、
                      两行占比钉在底下，中间空出几十 px，看着像少排了一块内容。
                      改成整块垂直居中 + 固定间距，多出来的高度均分到上下。 */}
                  <div className="flex h-full flex-col justify-center gap-3">
                    <div>
                      <p className="text-4xl font-bold leading-none tabular-nums tracking-tight">
                        {(efficiency.agent_run_count ?? 0).toLocaleString()}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {t('aiStatistics.agentRunCount')}
                      </p>
                    </div>
                    <SplitBar
                      segments={[
                        {
                          label: t('aiStatistics.rootAgentRuns'),
                          value: efficiency.root_agent_run_count ?? 0,
                          color: ramp[0],
                        },
                        {
                          label: t('aiStatistics.nestedAgentRuns'),
                          value: efficiency.nested_agent_run_count ?? 0,
                          color: ramp[1],
                        },
                      ]}
                    />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: ramp[0] }}
                          />
                          <span className="truncate">{t('aiStatistics.rootAgentRuns')}</span>
                        </p>
                        <p className="tabular-nums font-medium">
                          {(efficiency.root_agent_run_count ?? 0).toLocaleString()}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {efficiency.agent_run_count
                              ? `${((efficiency.root_agent_run_count / efficiency.agent_run_count) * 100).toFixed(1)}%`
                              : '0%'}
                          </span>
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-muted-foreground">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: ramp[1] }}
                          />
                          <span className="truncate">{t('aiStatistics.nestedAgentRuns')}</span>
                        </p>
                        <p className="tabular-nums font-medium">
                          {(efficiency.nested_agent_run_count ?? 0).toLocaleString()}
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            {efficiency.agent_run_count
                              ? `${((efficiency.nested_agent_run_count / efficiency.agent_run_count) * 100).toFixed(1)}%`
                              : '0%'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </DataBlock>

                <DataBlock
                  title={t('aiStatistics.ragEffect')}
                  icon={Database}
                  className="lg:col-span-1 xl:col-span-6"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t('aiStatistics.itemCount', {
                        count: (summary.rag?.hit_count ?? 0) + (summary.rag?.miss_count ?? 0),
                      })}
                    </span>
                  }
                >
                  <div className="flex h-full flex-col justify-center gap-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-3xl font-bold leading-none tabular-nums tracking-tight">
                        {(summary.rag?.hit_rate ?? 0).toFixed(1)}%
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t('aiStatistics.hitRate')}
                      </span>
                    </div>
                    <SplitBar
                      segments={[
                        {
                          label: t('aiStatistics.hit'),
                          value: summary.rag?.hit_count ?? 0,
                          color: ramp[0],
                        },
                        {
                          label: t('aiStatistics.miss'),
                          value: summary.rag?.miss_count ?? 0,
                          color: NEUTRAL_SEGMENT,
                        },
                      ]}
                    />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: ramp[0] }}
                        />
                        <span className="truncate text-muted-foreground">
                          {t('aiStatistics.hit')}
                        </span>
                        <span className="ml-auto tabular-nums font-medium">
                          {(summary.rag?.hit_count ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: NEUTRAL_SEGMENT }}
                        />
                        <span className="truncate text-muted-foreground">
                          {t('aiStatistics.miss')}
                        </span>
                        <span className="ml-auto tabular-nums font-medium">
                          {(summary.rag?.miss_count ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </DataBlock>

                <DataBlock
                  title={t('aiStatistics.heartbeat')}
                  icon={Activity}
                  className="lg:col-span-1 xl:col-span-6"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {(summary.heartbeat?.conversion_rate ?? 0).toFixed(1)}%
                    </span>
                  }
                >
                  <div className="flex h-full flex-col justify-center gap-3 py-2">
                    <ShareRow
                      label={t('aiStatistics.shouldSpeak')}
                      value={summary.heartbeat?.should_speak_true ?? 0}
                      percentage={
                        ((summary.heartbeat?.should_speak_true ?? 0) /
                          ((summary.heartbeat?.should_speak_true ?? 0) +
                            (summary.heartbeat?.should_speak_false ?? 0))) *
                          100 || 0
                      }
                      color={ramp[0]}
                    />
                    <ShareRow
                      label={t('aiStatistics.shouldNotSpeak')}
                      value={summary.heartbeat?.should_speak_false ?? 0}
                      percentage={
                        ((summary.heartbeat?.should_speak_false ?? 0) /
                          ((summary.heartbeat?.should_speak_true ?? 0) +
                            (summary.heartbeat?.should_speak_false ?? 0))) *
                          100 || 0
                      }
                      color={ramp[0]}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t('aiStatistics.conversionRate')}{' '}
                      <span className="tabular-nums font-medium text-foreground">
                        {(summary.heartbeat?.conversion_rate ?? 0).toFixed(1)}%
                      </span>
                    </p>
                  </div>
                </DataBlock>
              </div>

              <div className="mt-4">
                <SectionLabel title={t('aiStatistics.zoneMemory')} icon={Brain} />
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
                <MetricMini
                  title={t('aiStatistics.userTurnCount')}
                  value={(efficiency.user_turn_count ?? 0).toLocaleString()}
                  desc={`${t('aiStatistics.userTurnTokens')} ${formatCompactNumber(
                    (efficiency.user_turn_input_tokens ?? 0) +
                      (efficiency.user_turn_output_tokens ?? 0),
                  )}`}
                />
                <MetricMini
                  title={t('aiStatistics.agentRunCount')}
                  value={(efficiency.agent_run_count ?? 0).toLocaleString()}
                  desc={`${t('aiStatistics.rootAgentRuns')} ${efficiency.root_agent_run_count ?? 0}`}
                />
                <MetricMini
                  title={t('aiStatistics.avgTokensPerUserTurn')}
                  value={formatCompactNumber(efficiency.avg_tokens_per_user_turn ?? 0)}
                  desc={`${t('aiStatistics.avgInputPerUserTurn')} ${formatCompactNumber(
                    efficiency.avg_input_tokens_per_user_turn ?? 0,
                  )}`}
                />
                <MetricMini
                  title={t('aiStatistics.avgTokensPerAgentRun')}
                  value={formatCompactNumber(efficiency.avg_tokens_per_agent_run ?? 0)}
                  desc={`${t('aiStatistics.avgOutputPerUserTurn')} ${formatCompactNumber(
                    efficiency.avg_output_tokens_per_user_turn ?? 0,
                  )}`}
                />
                <MetricMini
                  title={t('aiStatistics.avgAgentRunsPerUserTurn')}
                  value={(efficiency.avg_agent_runs_per_user_turn ?? 0).toFixed(2)}
                  desc={`${(efficiency.user_turn_count ?? 0).toLocaleString()} ${t('aiStatistics.userTurnCount')}`}
                />
                <MetricMini
                  title={t('aiStatistics.nestedAgentRuns')}
                  value={(efficiency.nested_agent_run_count ?? 0).toLocaleString()}
                  desc={`${t('aiStatistics.rootAgentRuns')} ${efficiency.root_agent_run_count ?? 0}`}
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
                <DataBlock
                  title={t('aiStatistics.memoryPipeline')}
                  icon={Brain}
                  className="xl:col-span-12"
                  extra={
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px]',
                        memoryHealth.label === 'healthy' && 'bg-emerald-500/15 text-emerald-600',
                        memoryHealth.label === 'degraded' && 'bg-amber-500/15 text-amber-600',
                        memoryHealth.label === 'empty' && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {t(`aiStatistics.${memoryHealth.label}`)}
                    </span>
                  }
                >
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-7">
                    {(
                      [
                        ['observations', memoryStats?.observations ?? 0],
                        ['ingestions', memoryStats?.ingestions ?? 0],
                        ['ingestionErrors', memoryStats?.ingestion_errors ?? 0],
                        ['retrievals', memoryStats?.retrievals ?? 0],
                        ['entitiesCreated', memoryStats?.entities_created ?? 0],
                        ['edgesCreated', memoryStats?.edges_created ?? 0],
                        ['episodesCreated', memoryStats?.episodes_created ?? 0],
                      ] as const
                    ).map(([key, value]) => (
                      <div key={key} className="min-w-0">
                        <p className="truncate text-[11px] text-muted-foreground">
                          {t(`aiStatistics.${key}`)}
                        </p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight">
                          {formatCompactNumber(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </DataBlock>
              </div>
            </div>
          )}

          <Dialog open={errorDetailOpen} onOpenChange={setErrorDetailOpen}>
            <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col p-6">
              <DialogHeader className="shrink-0 pb-1">
                <DialogTitle>{t('aiStatistics.errorEventsTitle')}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t('aiStatistics.errorEventsHint')}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-1 pr-1">
                {errorEvents === null ? (
                  <p className="text-sm text-muted-foreground">{t('aiStatistics.loading')}</p>
                ) : errorEvents.length > 0 ? (
                  errorEvents.map((event, index) => (
                    <div key={`${event.date}-${event.time}-${index}`} className="glass-card p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {event.date} {event.time}
                        </span>
                        <span className="font-medium text-foreground">
                          {errorTypeLabel(event.error_type)}
                        </span>
                        <span className="font-mono text-[11px] text-primary">
                          [{event.error_type}]
                        </span>
                      </div>
                      {event.message ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{event.message}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="space-y-3">
                    {errorEventsFallback ? (
                      <p className="text-sm text-muted-foreground">
                        {t('aiStatistics.errorEventsUnavailable')}
                      </p>
                    ) : null}
                    {errorBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('aiStatistics.noDataInRange')}</p>
                    ) : (
                      errorBreakdown.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-3 glass-card px-3 py-2 text-sm"
                        >
                          <span>{item.label}</span>
                          <span className="tabular-nums font-medium">{item.value}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* 数据明细弹窗：区间与当日构成逐行可查 */}
          <Dialog open={dataDetailOpen} onOpenChange={setDataDetailOpen}>
            <DialogContent className="max-h-[85vh] max-w-6xl flex flex-col p-6">
              <DialogHeader className="shrink-0 pb-1">
                <DialogTitle>{t('aiStatistics.dataDetail')}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t('aiStatistics.dataDetailHint')}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-1">
                <div className="glass-card-grid">
                  {rangeLoading ? (
                    <TileSkeleton count={3} />
                  ) : rangeData && !isRangeEmpty ? (
                    <>
                      <div className="mt-0">
                        <SectionLabel title={t('aiStatistics.dayDetail')} icon={Layers} />
                      </div>

                      <div className="mt-2.5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <DataBlock
                          title={t('aiStatistics.modelDetail')}
                          icon={Layers}
                          extra={
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {t('aiStatistics.itemCount', { count: tokenByModel.length })}
                            </span>
                          }
                        >
                          <DataTable
                            emptyLabel={t('common.noData')}
                            head={
                              <>
                                <th className={TABLE_HEAD}>{t('aiStatistics.model')}</th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.inputTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.outputTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.cacheReadTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.cacheWriteTokens')}
                                </th>
                              </>
                            }
                          >
                            {tokenByModel.map((item, i) => (
                              <tr
                                key={`${item.model}-${i}`}
                                className="border-b border-border/30 last:border-0"
                              >
                                <td className={TABLE_CELL}>{item.model ?? '-'}</td>
                                <td className={TABLE_NUM}>
                                  {(item.input_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.output_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.cache_read_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.cache_write_tokens ?? 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </DataTable>
                        </DataBlock>

                        <DataBlock
                          title={t('aiStatistics.typeDetail')}
                          icon={Layers}
                          extra={
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {t('aiStatistics.itemCount', { count: tokenByType.length })}
                            </span>
                          }
                        >
                          <DataTable
                            emptyLabel={t('common.noData')}
                            head={
                              <>
                                <th className={TABLE_HEAD}>{t('aiStatistics.type')}</th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.inputTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.outputTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.cacheReadTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.cacheWriteTokens')}
                                </th>
                              </>
                            }
                          >
                            {tokenByType.map((item, i) => (
                              <tr
                                key={`${item.type}-${i}`}
                                className="border-b border-border/30 last:border-0"
                              >
                                <td className={TABLE_CELL}>{item.type ?? '-'}</td>
                                <td className={TABLE_NUM}>
                                  {(item.input_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.output_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.cache_read_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.cache_write_tokens ?? 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </DataTable>
                        </DataBlock>
                      </div>

                      <div className="mt-3">
                        <DataBlock
                          title={t('aiStatistics.rangeModelDetail')}
                          icon={Coins}
                          extra={
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {t('aiStatistics.itemCount', { count: rangeData.by_model.length })}
                            </span>
                          }
                        >
                          <DataTable
                            emptyLabel={t('common.noData')}
                            head={
                              <>
                                <th className={TABLE_HEAD}>{t('aiStatistics.model')}</th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.inputTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.outputTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.cacheReadTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.cacheWriteTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.totalTokens')}
                                </th>
                              </>
                            }
                          >
                            {rangeData.by_model.map((item, i) => (
                              <tr
                                key={`${item.model}-${i}`}
                                className="border-b border-border/30 last:border-0"
                              >
                                <td className={TABLE_CELL}>{item.model ?? '-'}</td>
                                <td className={TABLE_NUM}>
                                  {(item.input_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.output_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.cache_read_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(item.cache_write_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={cn(TABLE_NUM, 'font-medium')}>
                                  {(item.total_tokens ?? 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </DataTable>
                        </DataBlock>
                      </div>

                      {/* 每日明细跟着「历史趋势」页签一起搬进这个弹窗：它本来就是
                        这两张区间表（按模型 / 按类型）的同源逐日展开，
                        数据直接读 rangeData.daily，不再单独打 /statistics/history。 */}
                      <div className="mt-3">
                        <DataBlock
                          title={t('aiStatistics.dailyDetail')}
                          icon={Table2}
                          extra={
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {t('aiStatistics.itemCount', { count: rangeData.daily.length })}
                            </span>
                          }
                        >
                          <DataTable
                            emptyLabel={t('common.noData')}
                            head={
                              <>
                                <th className={TABLE_HEAD}>{t('aiStatistics.date')}</th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.inputTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.outputTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.totalTokens')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.userTurnCount')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.agentRunCount')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.avgTokensPerUserTurn')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.avgAgentRunsPerUserTurn')}
                                </th>
                              </>
                            }
                          >
                            {rangeData.daily.map((d) => (
                              <tr key={d.date} className="border-b border-border/30 last:border-0">
                                <td className={TABLE_CELL}>{d.date}</td>
                                <td className={TABLE_NUM}>
                                  {(d.input_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(d.output_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={cn(TABLE_NUM, 'font-medium')}>
                                  {(d.total_tokens ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(d.user_turn_count ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(d.agent_run_count ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {Math.round(d.avg_tokens_per_user_turn ?? 0).toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {(d.avg_agent_runs_per_user_turn ?? 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </DataTable>
                        </DataBlock>
                      </div>
                    </>
                  ) : (
                    <Card className="glass-card mt-3">
                      <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                        <CalendarDays className="mb-4 h-12 w-12 opacity-50" />
                        <p>{t('aiStatistics.noDataInRange')}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 性能明细弹窗：概览只留曲线，逐行明细点开看 */}
          <Dialog open={perfDetailOpen} onOpenChange={setPerfDetailOpen}>
            <DialogContent className="max-h-[85vh] max-w-6xl flex flex-col p-6">
              <DialogHeader className="shrink-0 pb-1">
                <DialogTitle>{t('aiStatistics.performanceDetail')}</DialogTitle>
                <DialogDescription className="sr-only">
                  {t('aiStatistics.performanceDetailHint')}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-1">
                <div className="glass-card-grid">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <TabButtonGroup
                      options={[
                        {
                          value: 'day',
                          label: t('aiStatistics.singleDay'),
                          icon: <Clock className="w-4 h-4" />,
                        },
                        {
                          value: 'range',
                          label: t('aiStatistics.dateRangePerformance'),
                          icon: <CalendarDays className="w-4 h-4" />,
                        },
                      ]}
                      value={perfMode}
                      onValueChange={(v) => setPerfMode(v as 'day' | 'range')}
                    />
                    {perfMode === 'range' && (
                      /* 弹窗里只读：区间跟着顶部的维度走，这里把当前范围写清楚，
                       不再放一排会让人以为能在这里改口径的胶囊。 */
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {scopeLabel}
                      </span>
                    )}
                  </div>

                  {perfMode === 'range' ? (
                    perfRangeLoading ? (
                      <Skeleton className="mt-3 h-[264px] w-full" />
                    ) : perfRangeAggregated.length > 0 ? (
                      <div className="mt-3">
                        <DataBlock
                          title={t('aiStatistics.rangePerformanceDetail')}
                          icon={Gauge}
                          extra={
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {t('aiStatistics.itemCount', { count: perfRangeAggregated.length })}
                            </span>
                          }
                        >
                          <DataTable
                            emptyLabel={t('common.noData')}
                            head={
                              <>
                                <th className={TABLE_HEAD}>{t('aiStatistics.date')}</th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.requestCount')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.ttftAvg')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.tpsAvg')}
                                </th>
                              </>
                            }
                          >
                            {perfRangeAggregated.map((row) => (
                              <tr
                                key={row.date}
                                className="border-b border-border/30 last:border-0"
                              >
                                <td className={TABLE_CELL}>{row.date}</td>
                                <td className={TABLE_NUM}>{row.requests.toLocaleString()}</td>
                                <td className={TABLE_NUM}>{row.ttftAvg.toFixed(1)} ms</td>
                                <td className={TABLE_NUM}>{row.tpsAvg.toFixed(1)}</td>
                              </tr>
                            ))}
                          </DataTable>
                        </DataBlock>
                      </div>
                    ) : (
                      <EmptyChart height={TREND_HEIGHT} label={t('common.noData')} />
                    )
                  ) : (
                    <div className="mt-3">
                      <DataBlock
                        title={t('aiStatistics.hourlyPerformance')}
                        icon={Gauge}
                        extra={
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {t('aiStatistics.itemCount', {
                              count: performanceData.reduce(
                                (sum, h) => sum + h.providers.length,
                                0,
                              ),
                            })}
                          </span>
                        }
                      >
                        <DataTable
                          emptyLabel={t('common.noData')}
                          head={
                            <>
                              <th className={TABLE_HEAD}>{t('aiStatistics.hour')}</th>
                              <th className={TABLE_HEAD}>{t('aiStatistics.provider')}</th>
                              <th className={TABLE_HEAD}>{t('aiStatistics.model')}</th>
                              <th className={cn(TABLE_HEAD, 'text-right')}>
                                {t('aiStatistics.requestCount')}
                              </th>
                              <th className={cn(TABLE_HEAD, 'text-right')}>
                                {t('aiStatistics.ttftAvg')}
                              </th>
                              <th className={cn(TABLE_HEAD, 'text-right')}>
                                {t('aiStatistics.tpsAvg')}
                              </th>
                              <th className={cn(TABLE_HEAD, 'text-right')}>
                                {t('aiStatistics.inputTokens')}
                              </th>
                              <th className={cn(TABLE_HEAD, 'text-right')}>
                                {t('aiStatistics.outputTokens')}
                              </th>
                              <th className={cn(TABLE_HEAD, 'text-right')}>
                                {t('aiStatistics.cacheReadTokens')}
                              </th>
                              <th className={cn(TABLE_HEAD, 'text-right')}>
                                {t('aiStatistics.cacheWriteTokens')}
                              </th>
                              <th className={cn(TABLE_HEAD, 'text-right')}>
                                {t('aiStatistics.toolCalls')}
                              </th>
                            </>
                          }
                        >
                          {performanceData.flatMap((hourItem) =>
                            hourItem.providers.map((p, idx) => (
                              <tr
                                key={`${hourItem.hour}-${idx}`}
                                className="border-b border-border/30 last:border-0"
                              >
                                <td className={TABLE_CELL}>
                                  {String(hourItem.hour).padStart(2, '0')}:00
                                </td>
                                <td className={TABLE_CELL}>{p.provider}</td>
                                <td className={TABLE_CELL}>{p.model}</td>
                                <td className={TABLE_NUM}>{p.request_count.toLocaleString()}</td>
                                <td className={TABLE_NUM}>{p.ttft_avg_ms.toFixed(1)} ms</td>
                                <td className={TABLE_NUM}>{p.tps_avg.toFixed(1)}</td>
                                <td className={TABLE_NUM}>{p.input_tokens.toLocaleString()}</td>
                                <td className={TABLE_NUM}>{p.output_tokens.toLocaleString()}</td>
                                <td className={TABLE_NUM}>
                                  {p.cache_read_tokens.toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>
                                  {p.cache_write_tokens.toLocaleString()}
                                </td>
                                <td className={TABLE_NUM}>{p.tool_call_count.toLocaleString()}</td>
                              </tr>
                            )),
                          )}
                        </DataTable>
                      </DataBlock>
                    </div>
                  )}

                  {/* 错误按类型的构成从概览挪到这里：概览只留一个错误率读数，
                    那一格撑不起一张图表卡（真实数据常常只有一种错误，卡片半空）。
                    需要追「到底是超时还是限流」的时候在这里逐行看。
                    抬头补上时间标签，跟概览那块读数对齐同一段。 */}
                  {errorBreakdown.length > 0 ? (
                    <div className="mt-3">
                      <DataBlock
                        title={t('aiStatistics.errorStats')}
                        icon={AlertTriangle}
                        extra={
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {scopeMark} · {t('aiStatistics.errorCount', { count: perfErrorTotal })}
                          </span>
                        }
                      >
                        <div className="flex flex-col gap-3">
                          <SplitBar
                            segments={errorBreakdown.map((item, index) => ({
                              label: item.label,
                              value: item.value,
                              color: ramp[index % ramp.length],
                            }))}
                          />
                          <DataTable
                            emptyLabel={t('common.noData')}
                            head={
                              <>
                                <th className={TABLE_HEAD}>{t('aiStatistics.errorType')}</th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.requestCount')}
                                </th>
                                <th className={cn(TABLE_HEAD, 'text-right')}>
                                  {t('aiStatistics.share')}
                                </th>
                              </>
                            }
                          >
                            {errorBreakdown.map((item, index) => (
                              <tr
                                key={item.key}
                                className="border-b border-border/30 last:border-b-0"
                              >
                                <td className={TABLE_CELL}>
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{ backgroundColor: ramp[index % ramp.length] }}
                                    />
                                    {item.label}
                                  </span>
                                </td>
                                <td className={TABLE_NUM}>{item.value.toLocaleString()}</td>
                                <td className={TABLE_NUM}>
                                  {((item.value / (perfErrorTotal || 1)) * 100).toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                          </DataTable>
                        </div>
                      </DataBlock>
                    </div>
                  ) : null}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* ================================================================
              RAG
              ================================================================ */}
          {activeTab === 'rag' && (
            <div className="glass-card-grid">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <DataBlock
                  title={t('aiStatistics.ragDocuments')}
                  icon={Database}
                  className="lg:col-span-2"
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t('aiStatistics.itemCount', { count: ragTopDocs.length })}
                    </span>
                  }
                >
                  <div className="flex h-full items-center">
                    {ragTopDocs.length > 0 ? (
                      <EChartsWrapper
                        option={ragDocsOption}
                        height={rowChartHeight(ragTopDocs.length)}
                      />
                    ) : (
                      <EmptyChart label={t('common.noData')} />
                    )}
                  </div>
                </DataBlock>

                <DataBlock
                  title={t('aiStatistics.ragEffect')}
                  icon={Target}
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {(summary.rag?.hit_rate ?? 0).toFixed(1)}%
                    </span>
                  }
                >
                  <div className="flex h-full flex-col justify-center gap-4 py-2">
                    <div>
                      <p className="text-4xl font-bold leading-none tabular-nums tracking-tight">
                        {(summary.rag?.hit_count ?? 0).toLocaleString()}
                      </p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {t('aiStatistics.hit')}
                      </p>
                    </div>
                    <SplitBar
                      segments={[
                        {
                          label: t('aiStatistics.hit'),
                          value: summary.rag?.hit_count ?? 0,
                          color: ramp[0],
                        },
                        {
                          label: t('aiStatistics.miss'),
                          value: summary.rag?.miss_count ?? 0,
                          color: NEUTRAL_SEGMENT,
                        },
                      ]}
                    />
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: ramp[0] }}
                        />
                        <span className="truncate text-muted-foreground">
                          {t('aiStatistics.hit')}
                        </span>
                        <span className="ml-auto tabular-nums font-medium">
                          {(summary.rag?.hit_count ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: NEUTRAL_SEGMENT }}
                        />
                        <span className="truncate text-muted-foreground">
                          {t('aiStatistics.miss')}
                        </span>
                        <span className="ml-auto tabular-nums font-medium">
                          {(summary.rag?.miss_count ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </DataBlock>
              </div>

              <div className="mt-3">
                <DataBlock
                  title={t('aiStatistics.ragDocumentDetail')}
                  icon={Layers}
                  extra={
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t('aiStatistics.itemCount', { count: ragDocuments.length })}
                    </span>
                  }
                >
                  <DataTable
                    emptyLabel={t('common.noData')}
                    head={
                      <>
                        <th className={TABLE_HEAD}>{t('aiStatistics.documentName')}</th>
                        <th className={cn(TABLE_HEAD, 'text-right')}>
                          {t('aiStatistics.hitCount')}
                        </th>
                      </>
                    }
                  >
                    {ragDocuments.map((doc, i) => (
                      <tr
                        key={`${doc?.document_name}-${i}`}
                        className="border-b border-border/30 last:border-0"
                      >
                        <td className={TABLE_CELL}>{doc?.document_name ?? '-'}</td>
                        <td className={TABLE_NUM}>{(doc?.hit_count ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </DataTable>
                </DataBlock>
              </div>
            </div>
          )}

          {/* ================================================================
              活跃用户
              ================================================================ */}
          {activeTab === 'users' && (
            <div className="glass-card-grid">
              <DataBlock
                title={t('aiStatistics.activeUsers')}
                icon={Users}
                extra={
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {t('aiStatistics.itemCount', { count: activeUsers.length })}
                  </span>
                }
              >
                <DataTable
                  emptyLabel={t('common.noData')}
                  head={
                    <>
                      <th className={TABLE_HEAD}>{t('aiStatistics.groupId')}</th>
                      <th className={TABLE_HEAD}>{t('aiStatistics.userId')}</th>
                      <th className={cn(TABLE_HEAD, 'text-right')}>
                        {t('aiStatistics.aiInteraction')}
                      </th>
                      <th className={cn(TABLE_HEAD, 'text-right')}>
                        {t('aiStatistics.messageCount')}
                      </th>
                    </>
                  }
                >
                  {activeUsers.map((item, i) => (
                    <tr
                      key={`${item?.group_id}-${item?.user_id}-${i}`}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className={TABLE_CELL}>{item?.group_id ?? '-'}</td>
                      <td className={TABLE_CELL}>{item?.user_id ?? '-'}</td>
                      <td className={TABLE_NUM}>{(item?.ai_interaction ?? 0).toLocaleString()}</td>
                      <td className={TABLE_NUM}>{(item?.message_count ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </DataTable>
              </DataBlock>
            </div>
          )}
        </>
      ) : (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
            <TrendingUp className="mb-4 h-12 w-12 opacity-50" />
            <p>{t('common.noData')}</p>
          </CardContent>
        </Card>
      )}
    </PinnedPage>
  );
}
