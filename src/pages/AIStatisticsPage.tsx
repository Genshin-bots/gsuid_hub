import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { aiStatisticsApi, aiPerformanceApi, getApiErrorMessage } from '@/lib/api';
import { PinnedPage } from '@/components/layout/PinnedPage';
import type {
  HourlyPerformanceItem,
  HourlyPerformanceRangeItem,
  TokenRangeData,
} from '@/lib/api';
import {
  aggregatePerformanceByDate,
  extractHistoryTokenSeries,
  memoryIngestHealth,
} from '@/lib/featureUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Progress } from '@/components/ui/progress';
import { EChartsWrapper, CHART_PALETTE } from '@/components/charts';
import type { EChartsOption } from 'echarts';
import {
  Coins,
  Clock,
  AlertTriangle,
  Activity,
  Database,
  Users,
  Zap,
  Brain,
  RefreshCw,
  TrendingUp,
  Calendar as CalendarIcon,
  CalendarDays,
  Gauge,
  HardDrive,
  ArrowRight,
  Sparkles,
  BarChart3,
  Pencil,
  Layers,
  GitBranch,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, startOfDay, parse } from 'date-fns';
import { MetricDayCalendar } from '@/components/ui/metric-day-calendar';
import {
  formatCompactMetric,
  latestDateWithMetric,
} from '@/lib/featureUtils';

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

/** 预设范围类型 */
type RangePreset = '7d' | '14d' | '30d' | '90d' | 'custom';

const PRESET_DAYS: Record<Exclude<RangePreset, 'custom'>, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '90d': 90,
};

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
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString();
}

// ============================================================================
// 辅助组件
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  className?: string;
  /** 追加在主数字后面同行显示的小字(如 P95) */
  inlineSuffix?: React.ReactNode;
}

function StatCard({ title, value, subtitle, icon: Icon, className, inlineSuffix }: StatCardProps) {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';

  return (
    <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold flex items-baseline gap-2 whitespace-nowrap">
          <span>{value}</span>
          {inlineSuffix && (
            <span className="text-xs font-normal text-muted-foreground">{inlineSuffix}</span>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

interface ProgressItemProps {
  label: string;
  value: number;
  percentage: number;
}

function ProgressItem({ label, value, percentage }: ProgressItemProps) {
  const safePercentage = isNaN(percentage) ? 0 : percentage;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value} ({safePercentage.toFixed(1)}%)</span>
      </div>
      <Progress value={safePercentage} className="h-2" />
    </div>
  );
}

/** 快速预览区:单个面板内左右两个可点击的"时间段"块(7d/30d),点击跳转 range tab */
interface QuickPreviewProps {
  isGlass: boolean;
  loading7d: boolean;
  loading30d: boolean;
  data7d: TokenRangeData | null;
  data30d: TokenRangeData | null;
  error: string | null;
  onSelectPreset: (preset: RangePreset) => void;
  t: (key: string) => string;
}

function QuickPreviewPanel({
  isGlass,
  loading7d,
  loading30d,
  data7d,
  data30d,
  error,
  onSelectPreset,
  t,
}: QuickPreviewProps) {
  return (
    <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/50">
        <QuickPreviewItem
          title={t('aiStatistics.last7Days')}
          icon={<CalendarDays className="w-4 h-4" />}
          loading={loading7d}
          data={data7d}
          error={error}
          onClick={() => onSelectPreset('7d')}
          t={t}
        />
        <QuickPreviewItem
          title={t('aiStatistics.last30Days')}
          icon={<BarChart3 className="w-4 h-4" />}
          loading={loading30d}
          data={data30d}
          error={error}
          onClick={() => onSelectPreset('30d')}
          t={t}
        />
      </div>
    </Card>
  );
}

/** 单个时间段预览块(无 Card 容器,只在面板内作为可点击单元格) */
interface QuickPreviewItemProps {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  data: TokenRangeData | null;
  error: string | null;
  onClick: () => void;
  t: (key: string) => string;
}

function QuickPreviewItem({ title, icon, loading, data, error, onClick, t }: QuickPreviewItemProps) {
  return (
    <div
      className="group cursor-pointer p-4 transition-colors hover:bg-accent/30 focus-visible:bg-accent/40 outline-none"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="text-primary/70">{icon}</span>
          <span>{title}</span>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ) : error && !data ? (
        <div className="text-sm text-muted-foreground">{error}</div>
      ) : data ? (
        <div className="space-y-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums leading-none">
              {/* 缓存 Token 属于输入的一部分,总计仅取 输入+输出,避免与缓存重复累加 */}
              {formatCompactNumber(data.total.input_tokens + data.total.output_tokens)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('aiStatistics.totalTokens')}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-muted-foreground truncate">{t('aiStatistics.inputTokens')}</span>
              <span className="tabular-nums font-medium">
                {formatCompactNumber(data.total.input_tokens)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-muted-foreground truncate">{t('aiStatistics.outputTokens')}</span>
              <span className="tabular-nums font-medium">
                {formatCompactNumber(data.total.output_tokens)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-muted-foreground truncate">{t('aiStatistics.cacheReadTokens')}</span>
              <span className="tabular-nums font-medium">
                {formatCompactNumber(data.total.cache_read_tokens)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 min-w-0">
              <span className="text-muted-foreground truncate">{t('aiStatistics.cacheWriteTokens')}</span>
              <span className="tabular-nums font-medium">
                {formatCompactNumber(data.total.cache_write_tokens)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">{t('common.noData')}</div>
      )}
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export default function AIStatisticsPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // 状态
  const [summary, setSummary] = useState<StatisticsSummary | null>(null);
  const [tokenByModel, setTokenByModel] = useState<TokenByModel[]>([]);
  const [tokenByType, setTokenByType] = useState<TokenByType[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [ragDocuments, setRagDocuments] = useState<RagDocument[]>([]);
  const [performanceData, setPerformanceData] = useState<HourlyPerformanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  /** yyyy-MM-dd → 当日 input_tokens（日历角标） */
  const [dailyInputTokens, setDailyInputTokens] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>('overview');

  // 时间段 Token 统计相关状态
  const [rangeData, setRangeData] = useState<TokenRangeData | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>('7d');
  const [rangeStartDate, setRangeStartDate] = useState<Date | undefined>(undefined);
  const [rangeEndDate, setRangeEndDate] = useState<Date | undefined>(undefined);

  // 顶部快速预览(7天/30天)
  const [quick7d, setQuick7d] = useState<TokenRangeData | null>(null);
  const [quick30d, setQuick30d] = useState<TokenRangeData | null>(null);
  const [quickLoading, setQuickLoading] = useState(true);
  const [quickError, setQuickError] = useState<string | null>(null);

  // 历史趋势 (getHistory)
  const [historyDays, setHistoryDays] = useState<7 | 14 | 30>(7);
  const [historySeries, setHistorySeries] = useState<
    Array<{
      date: string;
      input: number;
      output: number;
      total: number;
      userTurns: number;
      agentRuns: number;
      avgPerTurn: number;
      avgPerRun: number;
      avgRunsPerTurn: number;
    }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // 性能: 单日 / 日期范围
  const [perfMode, setPerfMode] = useState<'day' | 'range'>('day');
  const [perfRangePreset, setPerfRangePreset] = useState<Exclude<RangePreset, 'custom'>>('7d');
  const [perfRangeRows, setPerfRangeRows] = useState<HourlyPerformanceRangeItem[]>([]);
  const [perfRangeLoading, setPerfRangeLoading] = useState(false);

  // 加载数据
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [summaryData, tokenData, usersData, ragData, perfData] = await Promise.all([
        fetchStatisticsSummary(dateStr).catch(() => null),
        fetchTokenByModel(dateStr).catch(() => []),
        fetchActiveUsers(dateStr, 20).catch(() => []),
        fetchRagDocuments().catch(() => []),
        fetchPerformanceHourly(dateStr).catch(() => []),
      ]);

      setSummary(summaryData);
      setTokenByModel(tokenData);
      setTokenByType(summaryData?.token_usage?.by_type ?? []);
      setActiveUsers(usersData);
      setRagDocuments(ragData);
      setPerformanceData(perfData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
      toast.error(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, t]);

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
        rangeStartDate,
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
  }, [rangePreset, rangeStartDate, rangeEndDate, t]);

  useEffect(() => {
    // 仅在切到 range tab 或日期变化时拉取,减少不必要请求
    if (activeTab === 'range') {
      fetchRangeData();
    }
  }, [activeTab, fetchRangeData]);

  // 顶部快速预览(7天/30天) - 独立请求,静默失败
  const fetchQuickPreview = useCallback(async () => {
    try {
      setQuickLoading(true);
      const today = startOfDay(new Date());
      const start7 = format(subDays(today, 6), 'yyyy-MM-dd');
      const start30 = format(subDays(today, 29), 'yyyy-MM-dd');
      const end = format(today, 'yyyy-MM-dd');
      const [d7, d30] = await Promise.all([
        fetchTokenByRange(start7, end).catch(() => null),
        fetchTokenByRange(start30, end).catch(() => null),
      ]);
      setQuick7d(d7);
      setQuick30d(d30);
      if (!d7 && !d30) {
        setQuickError(t('aiStatistics.loadFailed'));
      } else {
        setQuickError(null);
      }
    } catch (err) {
      // 后端版本过旧可能没有此端点,降级为 warn 而不是 error
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        '[AIStatisticsPage] /api/ai/statistics/token-by-range 不可用,顶部快速预览保持为空。请升级 gsuid_core。',
        msg,
      );
      setQuickError(null);
    } finally {
      setQuickLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchQuickPreview();
  }, [fetchQuickPreview]);

  // 历史趋势
  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const rows = await aiStatisticsApi.getHistory(historyDays);
      setHistorySeries(extractHistoryTokenSeries(rows ?? []));
    } catch (err) {
      setHistoryError(getApiErrorMessage(err, t('aiStatistics.loadFailed')));
      setHistorySeries([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDays, t]);

  useEffect(() => {
    if (activeTab === 'history') {
      void fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  // 性能日期范围
  const fetchPerfRange = useCallback(async () => {
    try {
      setPerfRangeLoading(true);
      const { start_date, end_date } = computeRangeDates(perfRangePreset);
      const rows = await aiPerformanceApi.getHourlyRange(start_date, end_date);
      setPerfRangeRows(rows ?? []);
    } catch {
      setPerfRangeRows([]);
    } finally {
      setPerfRangeLoading(false);
    }
  }, [perfRangePreset]);

  useEffect(() => {
    if (activeTab === 'performance' && perfMode === 'range') {
      void fetchPerfRange();
    }
  }, [activeTab, perfMode, fetchPerfRange]);

  // 准备图表数据
  const intentChartData = summary
    ? Object.entries(summary.intent_distribution ?? {}).map(([name, data]) => ({
        name,
        value: data?.count ?? 0,
        percentage: data?.percentage ?? 0,
      }))
    : [];

  const triggerChartData = summary
    ? Object.entries(summary.trigger_distribution ?? {}).map(([name, data]) => ({
        name,
        value: typeof data === 'number' ? data : (data?.count ?? 0),
        percentage: typeof data === 'number' ? 0 : (data?.percentage ?? 0),
      }))
    : [];

  const tokenModelChartData = tokenByModel.map((item) => ({
    name: item.model ?? 'Unknown',
    input: item.input_tokens ?? 0,
    output: item.output_tokens ?? 0,
    cacheRead: item.cache_read_tokens ?? 0,
    cacheWrite: item.cache_write_tokens ?? 0,
  }));

  const tokenTypeChartData = tokenByType.map((item) => ({
    name: item.type ?? 'Unknown',
    input: item.input_tokens ?? 0,
    output: item.output_tokens ?? 0,
    cacheRead: item.cache_read_tokens ?? 0,
    cacheWrite: item.cache_write_tokens ?? 0,
  }));

  // ============================================================================
  // ECharts 配置
  // ============================================================================

  // 动态 series 过多时：底部单行滚动图例，预留 grid 空间，避免换行盖住绘图区
  const scrollBottomLegend = useCallback((
    names: string[],
    textFontSize = 10,
  ): EChartsOption['legend'] => ({
    type: 'scroll',
    orient: 'horizontal',
    data: names,
    bottom: 0,
    left: 'center',
    width: '92%',
    itemWidth: 12,
    itemHeight: 10,
    itemGap: 10,
    pageIconSize: 12,
    pageButtonGap: 6,
    pageButtonItemGap: 4,
    textStyle: { fontSize: textFontSize },
  }), []);

  // 饼图右侧竖向滚动图例（项数多时不溢出盖住饼图）
  const scrollRightLegend = useCallback((): EChartsOption['legend'] => ({
    type: 'scroll',
    orient: 'vertical',
    right: '2%',
    top: 'middle',
    height: '80%',
    textStyle: { fontSize: 11 },
    itemGap: 8,
    pageIconSize: 12,
  }), []);

  // 意图分布 - 环形图
  const intentPieOption = useMemo<EChartsOption>(() => ({
    animationDuration: 1000,
    animationEasing: 'cubicOut' as const,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: scrollRightLegend(),
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: 'transparent',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        labelLine: {
          show: false,
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          label: {
            show: true,
            fontSize: 13,
            fontWeight: 'bold',
            formatter: '{b}\n{d}%',
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        data: intentChartData.map((item, index) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: CHART_PALETTE[index % CHART_PALETTE.length] },
        })),
      },
    ],
  }), [intentChartData, scrollRightLegend]);
  // 触发方式分布 - 水平柱状图
  const triggerBarOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '10%', bottom: '8%', top: '8%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: triggerChartData.map(d => d.name),
      axisLabel: { fontSize: 11 },
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    series: [
      {
        type: 'bar',
        data: triggerChartData.map((d, i) => ({
          value: d.value,
          itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
        })),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        emphasis: { focus: 'series' },
        label: {
          show: true,
          position: 'right',
          formatter: '{c}',
          fontSize: 11,
        },
      },
    ],
  }), [triggerChartData]);

  // Token by Model - 分组柱状图 (含缓存)
  const tokenModelOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '4%', bottom: 48, top: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: tokenModelChartData.map(d => d.name),
      axisLabel: { rotate: tokenModelChartData.length > 5 ? 30 : 0, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      type: 'scroll',
      data: [
        { name: t('aiStatistics.inputTokens'), icon: 'roundRect' },
        { name: t('aiStatistics.outputTokens'), icon: 'roundRect' },
        { name: t('aiStatistics.cacheReadTokens'), icon: 'roundRect' },
        { name: t('aiStatistics.cacheWriteTokens'), icon: 'roundRect' },
      ],
      bottom: 0,
      left: 'center',
      width: '92%',
      textStyle: { fontSize: 11 },
    },
    series: [
      {
        name: t('aiStatistics.inputTokens'),
        type: 'bar',
        data: tokenModelChartData.map(d => d.input),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: t('aiStatistics.outputTokens'),
        type: 'bar',
        data: tokenModelChartData.map(d => d.output),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: t('aiStatistics.cacheReadTokens'),
        type: 'bar',
        data: tokenModelChartData.map(d => d.cacheRead),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#10b981' },
        emphasis: { focus: 'series' },
      },
      {
        name: t('aiStatistics.cacheWriteTokens'),
        type: 'bar',
        data: tokenModelChartData.map(d => d.cacheWrite),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#f59e0b' },
        emphasis: { focus: 'series' },
      },
    ],
  }), [tokenModelChartData, t]);

  // Token by Type - 分组柱状图 (含缓存)
  const tokenTypeOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '4%', bottom: 48, top: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: tokenTypeChartData.map(d => d.name),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      type: 'scroll',
      data: [
        { name: t('aiStatistics.inputTokens'), icon: 'roundRect' },
        { name: t('aiStatistics.outputTokens'), icon: 'roundRect' },
        { name: t('aiStatistics.cacheReadTokens'), icon: 'roundRect' },
        { name: t('aiStatistics.cacheWriteTokens'), icon: 'roundRect' },
      ],
      bottom: 0,
      left: 'center',
      width: '92%',
      textStyle: { fontSize: 11 },
    },
    series: [
      {
        name: t('aiStatistics.inputTokens'),
        type: 'bar',
        data: tokenTypeChartData.map(d => d.input),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: t('aiStatistics.outputTokens'),
        type: 'bar',
        data: tokenTypeChartData.map(d => d.output),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: t('aiStatistics.cacheReadTokens'),
        type: 'bar',
        data: tokenTypeChartData.map(d => d.cacheRead),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#10b981' },
        emphasis: { focus: 'series' },
      },
      {
        name: t('aiStatistics.cacheWriteTokens'),
        type: 'bar',
        data: tokenTypeChartData.map(d => d.cacheWrite),
        barMaxWidth: 24,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: '#f59e0b' },
        emphasis: { focus: 'series' },
      },
    ],
  }), [tokenTypeChartData, t]);

  // 性能 - 唯一 provider-model 列表(稳定分配颜色)
  const perfModelList = useMemo(() => {
    const map = new Map<string, { provider: string; model: string }>();
    for (const hourItem of performanceData) {
      for (const p of hourItem.providers) {
        const key = `${p.provider}-${p.model}`;
        if (!map.has(key)) {
          map.set(key, { provider: p.provider, model: p.model });
        }
      }
    }
    return Array.from(map.values());
  }, [performanceData]);

  // 性能 - TTFT 按小时折线图
  const perfTTFTOption = useMemo<EChartsOption>(() => {
    const hours = performanceData.map(d => `${d.hour}:00`);
    const series = perfModelList.map((pm, idx) => ({
      name: `${pm.provider}-${pm.model}`,
      type: 'line' as const,
      smooth: true,
      connectNulls: false,
      data: performanceData.map(h => {
        const found = h.providers.find(pp => pp.provider === pm.provider && pp.model === pm.model);
        if (!found) return null;
        const v = found.ttft_avg_ms;
        return v > 0 ? v : null;
      }),
      itemStyle: { color: CHART_PALETTE[idx % CHART_PALETTE.length] },
      lineStyle: { color: CHART_PALETTE[idx % CHART_PALETTE.length] },
    }));

    return {
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
      // 模型系列动态增长：预留底部单行 scroll 图例空间
      grid: { left: '3%', right: '4%', bottom: 48, top: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: 'ms',
        axisLabel: { fontSize: 11 },
      },
      tooltip: { trigger: 'axis' },
      legend: scrollBottomLegend(series.map(s => s.name)),
      series,
    };
  }, [performanceData, perfModelList, scrollBottomLegend]);

  // 性能 - TPS 按小时折线图
  const perfTPSOption = useMemo<EChartsOption>(() => {
    const hours = performanceData.map(d => `${d.hour}:00`);
    const series = perfModelList.map((pm, idx) => ({
      name: `${pm.provider}-${pm.model}`,
      type: 'line' as const,
      smooth: true,
      connectNulls: false,
      data: performanceData.map(h => {
        const found = h.providers.find(pp => pp.provider === pm.provider && pp.model === pm.model);
        if (!found) return null;
        const v = found.tps_avg;
        return v > 0 ? v : null;
      }),
      itemStyle: { color: CHART_PALETTE[idx % CHART_PALETTE.length] },
      lineStyle: { color: CHART_PALETTE[idx % CHART_PALETTE.length] },
    }));

    return {
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
      grid: { left: '3%', right: '4%', bottom: 48, top: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: 'tokens/s',
        axisLabel: { fontSize: 11 },
      },
      tooltip: { trigger: 'axis' },
      legend: scrollBottomLegend(series.map(s => s.name)),
      series,
    };
  }, [performanceData, perfModelList, scrollBottomLegend]);

  // 性能 - 请求数按小时柱状图
  const perfRequestOption = useMemo<EChartsOption>(() => {
    const hours = performanceData.map(d => `${d.hour}:00`);
    const series = perfModelList.map((pm, idx) => ({
      name: `${pm.provider}-${pm.model}`,
      type: 'bar' as const,
      data: performanceData.map(h => {
        const found = h.providers.find(pp => pp.provider === pm.provider && pp.model === pm.model);
        if (!found) return null;
        const v = found.request_count;
        return v > 0 ? v : null;
      }),
      itemStyle: { color: CHART_PALETTE[idx % CHART_PALETTE.length] },
    }));

    return {
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
      grid: { left: '3%', right: '4%', bottom: 48, top: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: hours,
        axisLabel: { fontSize: 11 },
      },
      yAxis: { type: 'value', axisLabel: { fontSize: 11 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: scrollBottomLegend(series.map(s => s.name)),
      series,
    };
  }, [performanceData, perfModelList, scrollBottomLegend]);

  const perfRangeAggregated = useMemo(
    () => aggregatePerformanceByDate(perfRangeRows),
    [perfRangeRows],
  );

  const historyTrendOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '4%', bottom: 48, top: '12%', containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: {
      type: 'scroll',
      data: [
        t('aiStatistics.inputTokens'),
        t('aiStatistics.outputTokens'),
        t('aiStatistics.totalTokens'),
      ],
      bottom: 0,
      left: 'center',
      width: '92%',
      textStyle: { fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: historySeries.map((d) => d.date),
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, formatter: (v: number) => formatCompactNumber(v) },
    },
    series: [
      {
        name: t('aiStatistics.totalTokens'),
        type: 'line',
        smooth: true,
        data: historySeries.map((d) => d.total),
        itemStyle: { color: '#6366f1' },
        areaStyle: { color: 'rgba(99, 102, 241, 0.12)' },
      },
      {
        name: t('aiStatistics.inputTokens'),
        type: 'line',
        smooth: true,
        data: historySeries.map((d) => d.input),
        itemStyle: { color: '#3b82f6' },
      },
      {
        name: t('aiStatistics.outputTokens'),
        type: 'line',
        smooth: true,
        data: historySeries.map((d) => d.output),
        itemStyle: { color: '#a855f7' },
      },
    ],
  }), [historySeries, t]);

  const efficiency = summary?.efficiency ?? EMPTY_EFFICIENCY;

  // 效率：Root vs Nested 运行占比
  const efficiencyNestPieOption = useMemo<EChartsOption>(() => {
    const root = efficiency.root_agent_run_count ?? 0;
    const nested = efficiency.nested_agent_run_count ?? 0;
    const data = [
      { name: t('aiStatistics.rootAgentRuns'), value: root, itemStyle: { color: CHART_PALETTE[0] } },
      { name: t('aiStatistics.nestedAgentRuns'), value: nested, itemStyle: { color: CHART_PALETTE[2] } },
    ].filter((d) => d.value > 0);
    return {
      animationDuration: 800,
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: scrollRightLegend(),
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['35%', '50%'],
          data: data.length
            ? data
            : [{ name: t('aiStatistics.noData'), value: 1, itemStyle: { color: '#94a3b8' } }],
          label: { show: false },
          emphasis: {
            scale: true,
            label: { show: true, fontSize: 12, fontWeight: 'bold', formatter: '{b}\n{d}%' },
          },
        },
      ],
    };
  }, [efficiency, t, scrollRightLegend]);

  // 历史效率趋势：回合均耗 / 运行均耗
  const efficiencyHistoryOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    grid: { left: '3%', right: '4%', bottom: 48, top: '12%', containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: {
      type: 'scroll',
      data: [
        t('aiStatistics.avgTokensPerUserTurn'),
        t('aiStatistics.avgTokensPerAgentRun'),
        t('aiStatistics.avgAgentRunsPerUserTurn'),
      ],
      bottom: 0,
      left: 'center',
      width: '92%',
      textStyle: { fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: historySeries.map((d) => d.date),
      axisLabel: { fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'tokens',
        axisLabel: { fontSize: 11, formatter: (v: number) => formatCompactNumber(v) },
      },
      {
        type: 'value',
        name: 'runs',
        splitLine: { show: false },
        axisLabel: { fontSize: 11 },
      },
    ],
    series: [
      {
        name: t('aiStatistics.avgTokensPerUserTurn'),
        type: 'line',
        smooth: true,
        data: historySeries.map((d) => d.avgPerTurn),
        itemStyle: { color: '#6366f1' },
        areaStyle: { color: 'rgba(99, 102, 241, 0.1)' },
      },
      {
        name: t('aiStatistics.avgTokensPerAgentRun'),
        type: 'line',
        smooth: true,
        data: historySeries.map((d) => d.avgPerRun),
        itemStyle: { color: '#10b981' },
      },
      {
        name: t('aiStatistics.avgAgentRunsPerUserTurn'),
        type: 'bar',
        yAxisIndex: 1,
        data: historySeries.map((d) => d.avgRunsPerTurn),
        itemStyle: { color: 'rgba(245, 158, 11, 0.65)', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 20,
      },
    ],
  }), [historySeries, t]);

  // 时间段效率趋势（range tab 的 daily 字段）
  const rangeEfficiencyOption = useMemo<EChartsOption>(() => {
    const days = rangeData?.daily ?? [];
    return {
      animationDuration: 800,
      grid: { left: '3%', right: '4%', bottom: 48, top: '12%', containLabel: true },
      tooltip: { trigger: 'axis' },
      legend: {
        type: 'scroll',
        data: [
          t('aiStatistics.avgTokensPerUserTurn'),
          t('aiStatistics.avgTokensPerAgentRun'),
          t('aiStatistics.userTurnCount'),
        ],
        bottom: 0,
        left: 'center',
        width: '92%',
        textStyle: { fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: days.map((d) => d.date),
        axisLabel: { fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: { fontSize: 11, formatter: (v: number) => formatCompactNumber(v) },
        },
        {
          type: 'value',
          splitLine: { show: false },
          axisLabel: { fontSize: 11 },
        },
      ],
      series: [
        {
          name: t('aiStatistics.avgTokensPerUserTurn'),
          type: 'line',
          smooth: true,
          data: days.map((d) => d.avg_tokens_per_user_turn ?? 0),
          itemStyle: { color: '#6366f1' },
        },
        {
          name: t('aiStatistics.avgTokensPerAgentRun'),
          type: 'line',
          smooth: true,
          data: days.map((d) => d.avg_tokens_per_agent_run ?? 0),
          itemStyle: { color: '#10b981' },
        },
        {
          name: t('aiStatistics.userTurnCount'),
          type: 'bar',
          yAxisIndex: 1,
          data: days.map((d) => d.user_turn_count ?? 0),
          itemStyle: { color: 'rgba(59, 130, 246, 0.55)', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 18,
        },
      ],
    };
  }, [rangeData, t]);

  const perfRangeTrendOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '4%', bottom: 48, top: '12%', containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: {
      type: 'scroll',
      data: [
        t('aiStatistics.requestCount'),
        t('aiStatistics.ttftAvg'),
        t('aiStatistics.tpsAvg'),
      ],
      bottom: 0,
      left: 'center',
      width: '92%',
      textStyle: { fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: perfRangeAggregated.map((d) => d.date),
      axisLabel: { fontSize: 11 },
    },
    yAxis: [
      { type: 'value', name: t('aiStatistics.requestCount'), axisLabel: { fontSize: 11 } },
      { type: 'value', name: 'ms / tps', axisLabel: { fontSize: 11 } },
    ],
    series: [
      {
        name: t('aiStatistics.requestCount'),
        type: 'bar',
        data: perfRangeAggregated.map((d) => d.requests),
        itemStyle: { color: '#6366f1' },
        barMaxWidth: 28,
      },
      {
        name: t('aiStatistics.ttftAvg'),
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: perfRangeAggregated.map((d) => Number(d.ttftAvg.toFixed(1))),
        itemStyle: { color: '#f59e0b' },
      },
      {
        name: t('aiStatistics.tpsAvg'),
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: perfRangeAggregated.map((d) => Number(d.tpsAvg.toFixed(1))),
        itemStyle: { color: '#10b981' },
      },
    ],
  }), [perfRangeAggregated, t]);

  // ============================================================================
  // 时间段统计 - 图表配置
  // ============================================================================

  // 按天趋势 - 多系列堆叠折线图(输入/输出/缓存读/缓存写/总量)
  const rangeTrendOption = useMemo<EChartsOption>(() => {
    const days = rangeData?.daily ?? [];
    const dates = days.map(d => d.date);
    return {
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
      grid: { left: '3%', right: '4%', bottom: 48, top: '12%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        type: 'scroll',
        data: [
          { name: t('aiStatistics.inputTokens') },
          { name: t('aiStatistics.outputTokens') },
          { name: t('aiStatistics.cacheReadTokens') },
          { name: t('aiStatistics.cacheWriteTokens') },
          { name: t('aiStatistics.totalTokens') },
        ],
        bottom: 0,
        left: 'center',
        width: '92%',
        textStyle: { fontSize: 11 },
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 11, formatter: (v: number) => formatCompactNumber(v) },
      },
      series: [
        {
          name: t('aiStatistics.totalTokens'),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: days.map(d => d.total_tokens),
          lineStyle: { width: 3 },
          itemStyle: { color: '#6366f1' },
          emphasis: { focus: 'series' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(99, 102, 241, 0.25)' },
                { offset: 1, color: 'rgba(99, 102, 241, 0.02)' },
              ],
            },
          },
        },
        {
          name: t('aiStatistics.inputTokens'),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          data: days.map(d => d.input_tokens),
          itemStyle: { color: '#3b82f6' },
          emphasis: { focus: 'series' },
        },
        {
          name: t('aiStatistics.outputTokens'),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          data: days.map(d => d.output_tokens),
          itemStyle: { color: '#a855f7' },
          emphasis: { focus: 'series' },
        },
        {
          name: t('aiStatistics.cacheReadTokens'),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          data: days.map(d => d.cache_read_tokens),
          itemStyle: { color: '#10b981' },
          emphasis: { focus: 'series' },
        },
        {
          name: t('aiStatistics.cacheWriteTokens'),
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          data: days.map(d => d.cache_write_tokens),
          itemStyle: { color: '#f59e0b' },
          emphasis: { focus: 'series' },
        },
      ],
    };
  }, [rangeData, t]);

  // 按模型分布 - 环形饼图(按 total_tokens)
  const rangeModelPieOption = useMemo<EChartsOption>(() => {
    const models = rangeData?.by_model ?? [];
    return {
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const v = Number(params.value ?? 0);
          return `${params.name}<br/>${formatCompactNumber(v)} (${params.percent}%)`;
        },
      },
      legend: scrollRightLegend(),
      series: [
        {
          type: 'pie',
          radius: ['40%', '65%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: 'transparent',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 8,
            label: {
              show: true,
              fontSize: 13,
              fontWeight: 'bold',
              formatter: '{b}\n{d}%',
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
          data: models.map((m, i) => ({
            name: m.model || 'Unknown',
            value: m.total_tokens,
            itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
          })),
        },
      ],
    };
  }, [rangeData, scrollRightLegend]);

  // 时间段统计是否全部为 0(用于空态判定)
  const isRangeEmpty = useMemo(() => {
    if (!rangeData) return true;
    if (rangeData.daily.length === 0) return true;
    return rangeData.daily.every(
      d => d.total_tokens === 0 && d.input_tokens === 0 && d.output_tokens === 0,
    );
  }, [rangeData]);

  return (
    <PinnedPage
      header={
        /* 页面标题 */
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <TrendingUp className="w-8 h-8 shrink-0" />
              {t('aiStatistics.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiStatistics.description')}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, 'yyyy-MM-dd')}
                  {(dailyInputTokens[format(selectedDate, 'yyyy-MM-dd')] ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      in {formatCompactMetric(dailyInputTokens[format(selectedDate, 'yyyy-MM-dd')])}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
                <MetricDayCalendar
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  metrics={dailyInputTokens}
                  disableEmpty
                  formatMetric={formatCompactMetric}
                />
              </PopoverContent>
            </Popover>
            <button
              onClick={loadData}
              disabled={isLoading}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-md text-sm transition-colors',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      }
    >
      {/* 错误提示 */}
      {error && (
        <div className="px-6">
          <Card className={cn('border-destructive/50', isGlass ? 'glass-card' : 'border border-border/50')}>
            <CardContent className="flex items-center gap-3 p-4 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 px-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="w-4 h-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <>
          {/* 时间段快速预览 - 7天/30天(单面板双块对比) */}
          <div className="px-6">
            <QuickPreviewPanel
              isGlass={isGlass}
              loading7d={quickLoading}
              loading30d={quickLoading}
              data7d={quick7d}
              data30d={quick30d}
              error={quickError}
              onSelectPreset={(preset) => {
                setRangePreset(preset);
                setActiveTab('range');
              }}
              t={t}
            />
          </div>

          {/* Token 计量：概览统计卡片 - 一行6列 */}
          <div className="px-6 space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="w-4 h-4" />
              {t('aiStatistics.tokenMetering')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                title={t('aiStatistics.inputTokens')}
                value={formatCompactNumber(summary.token_usage?.total_input_tokens ?? 0)}
                icon={Coins}
              />
              <StatCard
                title={t('aiStatistics.outputTokens')}
                value={formatCompactNumber(summary.token_usage?.total_output_tokens ?? 0)}
                icon={Coins}
              />
              <StatCard
                title={t('aiStatistics.cacheReadTokens')}
                value={formatCompactNumber(summary.token_usage?.total_cache_read_tokens ?? 0)}
                icon={HardDrive}
              />
              <StatCard
                title={t('aiStatistics.cacheWriteTokens')}
                value={formatCompactNumber(summary.token_usage?.total_cache_write_tokens ?? 0)}
                icon={HardDrive}
              />
              <StatCard
                title={t('aiStatistics.latency')}
                value={`${(summary.latency?.avg ?? 0).toFixed(2)}s`}
                inlineSuffix={`P95: ${(summary.latency?.p95 ?? 0).toFixed(2)}s`}
                icon={Clock}
              />
              {(() => {
                const err = summary.errors ?? ({} as ErrorStats);
                const errEntries: { key: keyof ErrorStats; label: string; value: number }[] = [
                  { key: 'timeout', label: t('aiStatistics.timeout'), value: err.timeout ?? 0 },
                  { key: 'rate_limit', label: t('aiStatistics.rateLimit'), value: err.rate_limit ?? 0 },
                  { key: 'network_error', label: t('aiStatistics.networkError'), value: err.network_error ?? 0 },
                  { key: 'usage_limit', label: t('aiStatistics.usageLimit'), value: err.usage_limit ?? 0 },
                  { key: 'agent_error', label: t('aiStatistics.agentError'), value: err.agent_error ?? 0 },
                  { key: 'api_529_error', label: t('aiStatistics.api529Error'), value: err.api_529_error ?? 0 },
                ];
                const topErr = errEntries.reduce<typeof errEntries[number] | null>(
                  (acc, cur) => (acc == null || cur.value > acc.value ? cur : acc),
                  null
                );
                const errSuffix = topErr && topErr.value > 0 ? `${topErr.label}: ${topErr.value}` : null;
                return (
                  <StatCard
                    title={t('aiStatistics.errors')}
                    value={err.total ?? 0}
                    inlineSuffix={errSuffix ?? undefined}
                    icon={AlertTriangle}
                  />
                );
              })()}
            </div>
          </div>

          {/* Token 效率：User Turn / Agent Run */}
          <div className="px-6 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="w-4 h-4" />
                {t('aiStatistics.efficiencyTitle')}
              </h2>
              <p className="text-xs text-muted-foreground max-w-2xl">
                {t('aiStatistics.efficiencyHint')}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                title={t('aiStatistics.userTurnCount')}
                value={efficiency.user_turn_count ?? 0}
                subtitle={t('aiStatistics.userTurnTokens') + ': ' + formatCompactNumber(
                  (efficiency.user_turn_input_tokens ?? 0) + (efficiency.user_turn_output_tokens ?? 0),
                )}
                icon={Layers}
              />
              <StatCard
                title={t('aiStatistics.agentRunCount')}
                value={efficiency.agent_run_count ?? 0}
                subtitle={`${t('aiStatistics.rootAgentRuns')} ${efficiency.root_agent_run_count ?? 0} · ${t('aiStatistics.nestedAgentRuns')} ${efficiency.nested_agent_run_count ?? 0}`}
                icon={GitBranch}
              />
              <StatCard
                title={t('aiStatistics.avgTokensPerUserTurn')}
                value={formatCompactNumber(efficiency.avg_tokens_per_user_turn ?? 0)}
                subtitle={`${t('aiStatistics.avgInputPerUserTurn')} ${formatCompactNumber(efficiency.avg_input_tokens_per_user_turn ?? 0)}`}
                icon={Target}
              />
              <StatCard
                title={t('aiStatistics.avgTokensPerAgentRun')}
                value={formatCompactNumber(efficiency.avg_tokens_per_agent_run ?? 0)}
                subtitle={`${t('aiStatistics.avgOutputPerUserTurn')} ${formatCompactNumber(efficiency.avg_output_tokens_per_user_turn ?? 0)}`}
                icon={Gauge}
              />
              <StatCard
                title={t('aiStatistics.avgAgentRunsPerUserTurn')}
                value={(efficiency.avg_agent_runs_per_user_turn ?? 0).toFixed(2)}
                icon={Activity}
              />
              <StatCard
                title={t('aiStatistics.nestedAgentRuns')}
                value={efficiency.nested_agent_run_count ?? 0}
                subtitle={`${t('aiStatistics.rootAgentRuns')}: ${efficiency.root_agent_run_count ?? 0}`}
                icon={GitBranch}
              />
            </div>
          </div>

          {/* Tabs 容器 */}
          <div className="px-6">
            <TabButtonGroup
              options={[
                { value: 'overview', label: t('aiStatistics.overview'), icon: <TrendingUp className="w-4 h-4" /> },
                { value: 'tokens', label: t('aiStatistics.tokenAnalysis'), icon: <Coins className="w-4 h-4" /> },
                { value: 'range', label: t('aiStatistics.tokenRange'), icon: <CalendarDays className="w-4 h-4" /> },
                { value: 'history', label: t('aiStatistics.historyTrend'), icon: <BarChart3 className="w-4 h-4" /> },
                { value: 'performance', label: t('aiStatistics.performance'), icon: <Activity className="w-4 h-4" /> },
                { value: 'rag', label: t('aiStatistics.ragEffect'), icon: <Database className="w-4 h-4" /> },
                { value: 'users', label: t('aiStatistics.users'), icon: <Users className="w-4 h-4" /> },
              ]}
              value={activeTab}
              onValueChange={setActiveTab}
            />
          </div>

          {/* 概览 Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4 px-6">
              <div className="glass-card-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 效率：Root vs Nested */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GitBranch className="w-5 h-5" />
                      {t('aiStatistics.efficiencyTitle')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[260px]">
                      <EChartsWrapper option={efficiencyNestPieOption} height={260} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        {t('aiStatistics.avgTokensPerUserTurn')}:{' '}
                        <span className="font-medium text-foreground tabular-nums">
                          {formatCompactNumber(efficiency.avg_tokens_per_user_turn ?? 0)}
                        </span>
                      </div>
                      <div>
                        {t('aiStatistics.avgTokensPerAgentRun')}:{' '}
                        <span className="font-medium text-foreground tabular-nums">
                          {formatCompactNumber(efficiency.avg_tokens_per_agent_run ?? 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* 意图分布 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      {t('aiStatistics.intentDistribution')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      {intentChartData.length > 0 ? (
                        <EChartsWrapper option={intentPieOption} height={200} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 触发方式分布 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      {t('aiStatistics.triggerDistribution')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      {triggerChartData.length > 0 ? (
                        <EChartsWrapper option={triggerBarOption} height={200} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* RAG 知识库效果 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      {t('aiStatistics.ragEffect')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-2xl font-bold text-green-500">{(summary.rag?.hit_rate ?? 0).toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.hitRate')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="text-green-500">{summary.rag?.hit_count ?? 0}</span> / {(summary.rag?.hit_count ?? 0) + (summary.rag?.miss_count ?? 0)}
                        </p>
                      </div>
                    </div>
                    <Progress value={summary.rag?.hit_rate ?? 0} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('aiStatistics.hit')}: {summary.rag?.hit_count ?? 0}</span>
                      <span>{t('aiStatistics.miss')}: {summary.rag?.miss_count ?? 0}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Heartbeat 巡检 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5" />
                      {t('aiStatistics.heartbeat')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-2xl font-bold">{(summary.heartbeat?.conversion_rate ?? 0).toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.conversionRate')}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <ProgressItem
                        label={t('aiStatistics.shouldSpeak')}
                        value={summary.heartbeat?.should_speak_true ?? 0}
                        percentage={((summary.heartbeat?.should_speak_true ?? 0) / ((summary.heartbeat?.should_speak_true ?? 0) + (summary.heartbeat?.should_speak_false ?? 0))) * 100 || 0}
                      />
                      <ProgressItem
                        label={t('aiStatistics.shouldNotSpeak')}
                        value={summary.heartbeat?.should_speak_false ?? 0}
                        percentage={((summary.heartbeat?.should_speak_false ?? 0) / ((summary.heartbeat?.should_speak_true ?? 0) + (summary.heartbeat?.should_speak_false ?? 0))) * 100 || 0}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Memory 管线 7 指标 */}
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    {t('aiStatistics.memory')}
                    {(() => {
                      const health = memoryIngestHealth(summary.memory);
                      return (
                        <span
                          className={cn(
                            'ml-2 text-xs font-normal px-2 py-0.5 rounded-full',
                            health.label === 'healthy' && 'bg-emerald-500/15 text-emerald-600',
                            health.label === 'degraded' && 'bg-amber-500/15 text-amber-600',
                            health.label === 'empty' && 'bg-muted text-muted-foreground',
                          )}
                        >
                          {t(`aiStatistics.${health.label}`)}
                        </span>
                      );
                    })()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    {([
                      ['observations', summary.memory?.observations ?? 0],
                      ['ingestions', summary.memory?.ingestions ?? 0],
                      ['ingestionErrors', summary.memory?.ingestion_errors ?? 0],
                      ['retrievals', summary.memory?.retrievals ?? 0],
                      ['entitiesCreated', summary.memory?.entities_created ?? 0],
                      ['edgesCreated', summary.memory?.edges_created ?? 0],
                      ['episodesCreated', summary.memory?.episodes_created ?? 0],
                    ] as const).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5"
                      >
                        <p className="text-xs text-muted-foreground truncate">
                          {t(`aiStatistics.${key}`)}
                        </p>
                        <p className="text-xl font-bold tabular-nums mt-1">
                          {formatCompactNumber(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 历史趋势 Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4 px-6">
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground shrink-0">
                      {t('aiStatistics.queryRange')}:
                    </span>
                    <TabButtonGroup
                      options={[
                        { value: '7', label: t('aiStatistics.preset7d'), icon: <Sparkles className="w-4 h-4" /> },
                        { value: '14', label: t('aiStatistics.preset14d'), icon: <Zap className="w-4 h-4" /> },
                        { value: '30', label: t('aiStatistics.preset30d'), icon: <BarChart3 className="w-4 h-4" /> },
                      ]}
                      value={String(historyDays)}
                      onValueChange={(v) => setHistoryDays(Number(v) as 7 | 14 | 30)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2"
                      onClick={() => void fetchHistory()}
                      disabled={historyLoading}
                    >
                      <RefreshCw className={cn('w-4 h-4', historyLoading && 'animate-spin')} />
                      {t('common.refresh')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    {t('aiStatistics.historyTrend')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {historyError ? (
                    <div className="text-sm text-destructive py-8 text-center">{historyError}</div>
                  ) : historyLoading ? (
                    <Skeleton className="h-[320px] w-full" />
                  ) : historySeries.length === 0 ? (
                    <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                      {t('common.noData')}
                    </div>
                  ) : (
                    <EChartsWrapper option={historyTrendOption} height={320} />
                  )}
                </CardContent>
              </Card>
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    {t('aiStatistics.efficiencyTrend')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {historyError ? (
                    <div className="text-sm text-destructive py-8 text-center">{historyError}</div>
                  ) : historyLoading ? (
                    <Skeleton className="h-[320px] w-full" />
                  ) : historySeries.length === 0 ? (
                    <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                      {t('common.noData')}
                    </div>
                  ) : (
                    <EChartsWrapper option={efficiencyHistoryOption} height={320} />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Token 分析 Tab */}
          {activeTab === 'tokens' && (
            <div className="space-y-4 px-6">
              <div className="glass-card-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Token 消耗图表 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="w-5 h-5" />
                      {t('aiStatistics.tokenByModel')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {tokenModelChartData.length > 0 ? (
                        <EChartsWrapper option={tokenModelOption} height={300} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Token by Type 图表 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="w-5 h-5" />
                      {t('aiStatistics.tokenByType')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {tokenTypeChartData.length > 0 ? (
                        <EChartsWrapper option={tokenTypeOption} height={300} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 模型 Token 详情 */}
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader>
                  <CardTitle>{t('aiStatistics.tokenByModel')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.model')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.inputTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.outputTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.cacheReadTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.cacheWriteTokens')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenByModel.map((item, i) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-2 px-3">{item.model ?? '-'}</td>
                            <td className="py-2 px-3">{(item.input_tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3">{(item.output_tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3">{(item.cache_read_tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3">{(item.cache_write_tokens ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Token by Type 详情 */}
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader>
                  <CardTitle>{t('aiStatistics.tokenByType')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.type')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.inputTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.outputTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.cacheReadTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.cacheWriteTokens')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenByType.map((item, i) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-2 px-3">{item.type ?? '-'}</td>
                            <td className="py-2 px-3">{(item.input_tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3">{(item.output_tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3">{(item.cache_read_tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3">{(item.cache_write_tokens ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 性能 Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-4 px-6">
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardContent className="py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <TabButtonGroup
                      options={[
                        { value: 'day', label: t('aiStatistics.singleDay'), icon: <Clock className="w-4 h-4" /> },
                        { value: 'range', label: t('aiStatistics.dateRangePerformance'), icon: <CalendarDays className="w-4 h-4" /> },
                      ]}
                      value={perfMode}
                      onValueChange={(v) => setPerfMode(v as 'day' | 'range')}
                    />
                    {perfMode === 'range' && (
                      <TabButtonGroup
                        options={[
                          { value: '7d', label: t('aiStatistics.preset7d'), icon: <Sparkles className="w-4 h-4" /> },
                          { value: '14d', label: t('aiStatistics.preset14d'), icon: <Zap className="w-4 h-4" /> },
                          { value: '30d', label: t('aiStatistics.preset30d'), icon: <BarChart3 className="w-4 h-4" /> },
                          { value: '90d', label: t('aiStatistics.preset90d'), icon: <TrendingUp className="w-4 h-4" /> },
                        ]}
                        value={perfRangePreset}
                        onValueChange={(v) => setPerfRangePreset(v as Exclude<RangePreset, 'custom'>)}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {perfMode === 'range' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {perfRangeAggregated.length > 0 && (() => {
                      const totalRequests = perfRangeAggregated.reduce((s, d) => s + d.requests, 0);
                      const avgTTFT =
                        perfRangeAggregated.reduce((s, d) => s + d.ttftAvg, 0) /
                          perfRangeAggregated.length || 0;
                      const avgTPS =
                        perfRangeAggregated.reduce((s, d) => s + d.tpsAvg, 0) /
                          perfRangeAggregated.length || 0;
                      return (
                        <>
                          <StatCard title={t('aiStatistics.requestCount')} value={totalRequests.toLocaleString()} icon={Gauge} />
                          <StatCard title={t('aiStatistics.ttftAvg')} value={`${avgTTFT.toFixed(1)} ms`} icon={Clock} />
                          <StatCard title={t('aiStatistics.tpsAvg')} value={`${avgTPS.toFixed(1)} tokens/s`} icon={Zap} />
                        </>
                      );
                    })()}
                  </div>
                  <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        {t('aiStatistics.dateRangePerformance')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {perfRangeLoading ? (
                        <Skeleton className="h-[320px] w-full" />
                      ) : perfRangeAggregated.length === 0 ? (
                        <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      ) : (
                        <EChartsWrapper option={perfRangeTrendOption} height={320} />
                      )}
                    </CardContent>
                  </Card>
                  <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                    <CardHeader>
                      <CardTitle>{t('aiStatistics.dateRangePerformance')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.date')}</th>
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.requestCount')}</th>
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.ttftAvg')}</th>
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.tpsAvg')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {perfRangeAggregated.map((row) => (
                              <tr key={row.date} className="border-b border-border/30">
                                <td className="py-2 px-3">{row.date}</td>
                                <td className="py-2 px-3">{row.requests.toLocaleString()}</td>
                                <td className="py-2 px-3">{row.ttftAvg.toFixed(1)} ms</td>
                                <td className="py-2 px-3">{row.tpsAvg.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
              <>
              {/* 性能概览卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {performanceData.length > 0 && (() => {
                  const totalRequests = performanceData.reduce((sum, h) => sum + h.providers.reduce((s, p) => s + p.request_count, 0), 0);
                  const avgTTFT = performanceData.reduce((sum, h) => sum + h.providers.reduce((s, p) => s + p.ttft_avg_ms, 0), 0) /
                    performanceData.reduce((sum, h) => sum + h.providers.length, 0) || 0;
                  const avgTPS = performanceData.reduce((sum, h) => sum + h.providers.reduce((s, p) => s + p.tps_avg, 0), 0) /
                    performanceData.reduce((sum, h) => sum + h.providers.length, 0) || 0;
                  return (
                    <>
                      <StatCard
                        title={t('aiStatistics.requestCount')}
                        value={totalRequests.toLocaleString()}
                        icon={Gauge}
                      />
                      <StatCard
                        title={t('aiStatistics.ttftAvg')}
                        value={`${avgTTFT.toFixed(1)} ms`}
                        icon={Clock}
                      />
                      <StatCard
                        title={t('aiStatistics.tpsAvg')}
                        value={`${avgTPS.toFixed(1)} tokens/s`}
                        icon={Zap}
                      />
                    </>
                  );
                })()}
              </div>

              <div className="glass-card-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* TTFT 趋势 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      {t('aiStatistics.ttft')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {performanceData.length > 0 ? (
                        <EChartsWrapper option={perfTTFTOption} height={300} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* TPS 趋势 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      {t('aiStatistics.tps')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {performanceData.length > 0 ? (
                        <EChartsWrapper option={perfTPSOption} height={300} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 请求数趋势 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="w-5 h-5" />
                      {t('aiStatistics.requestCount')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      {performanceData.length > 0 ? (
                        <EChartsWrapper option={perfRequestOption} height={300} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 错误统计 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      {t('aiStatistics.errorStats')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <ProgressItem label={t('aiStatistics.timeout')} value={summary.errors?.timeout ?? 0} percentage={((summary.errors?.timeout ?? 0) / (summary.errors?.total ?? 1)) * 100 || 0} />
                      <ProgressItem label={t('aiStatistics.rateLimit')} value={summary.errors?.rate_limit ?? 0} percentage={((summary.errors?.rate_limit ?? 0) / (summary.errors?.total ?? 1)) * 100 || 0} />
                      <ProgressItem label={t('aiStatistics.networkError')} value={summary.errors?.network_error ?? 0} percentage={((summary.errors?.network_error ?? 0) / (summary.errors?.total ?? 1)) * 100 || 0} />
                      <ProgressItem label={t('aiStatistics.usageLimit')} value={summary.errors?.usage_limit ?? 0} percentage={((summary.errors?.usage_limit ?? 0) / (summary.errors?.total ?? 1)) * 100 || 0} />
                      <ProgressItem label={t('aiStatistics.agentError')} value={summary.errors?.agent_error ?? 0} percentage={((summary.errors?.agent_error ?? 0) / (summary.errors?.total ?? 1)) * 100 || 0} />
                      <ProgressItem label={t('aiStatistics.api529Error')} value={summary.errors?.api_529_error ?? 0} percentage={((summary.errors?.api_529_error ?? 0) / (summary.errors?.total ?? 1)) * 100 || 0} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 性能详情表格 */}
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="w-5 h-5" />
                    {t('aiStatistics.hourlyPerformance')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.hour')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.provider')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.model')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.requestCount')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.ttftAvg')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.tpsAvg')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.inputTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.outputTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.cacheReadTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.cacheWriteTokens')}</th>
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.toolCalls')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {performanceData.flatMap(hourItem =>
                          hourItem.providers.map((p, idx) => (
                            <tr key={`${hourItem.hour}-${idx}`} className="border-b border-border/30">
                              <td className="py-2 px-3">{hourItem.hour}:00</td>
                              <td className="py-2 px-3">{p.provider}</td>
                              <td className="py-2 px-3">{p.model}</td>
                              <td className="py-2 px-3">{p.request_count.toLocaleString()}</td>
                              <td className="py-2 px-3">{p.ttft_avg_ms.toFixed(1)} ms</td>
                              <td className="py-2 px-3">{p.tps_avg.toFixed(1)}</td>
                              <td className="py-2 px-3">{p.input_tokens.toLocaleString()}</td>
                              <td className="py-2 px-3">{p.output_tokens.toLocaleString()}</td>
                              <td className="py-2 px-3">{p.cache_read_tokens.toLocaleString()}</td>
                              <td className="py-2 px-3">{p.cache_write_tokens.toLocaleString()}</td>
                              <td className="py-2 px-3">{p.tool_call_count.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              </>
              )}
            </div>
          )}

          {/* RAG Tab */}
          {activeTab === 'rag' && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-1 gap-4">
                {/* RAG 文档命中列表 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      {t('aiStatistics.ragDocuments')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.documentName')}</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.hitCount')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ragDocuments.map((doc, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-2 px-3">{doc?.document_name ?? '-'}</td>
                              <td className="py-2 px-3">{doc?.hit_count ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 用户 Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-1 gap-4">
                {/* 活跃用户/群组 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {t('aiStatistics.activeUsers')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.groupId')}</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.userId')}</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.aiInteraction')}</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.messageCount')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeUsers.map((item, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-2 px-3">{item?.group_id ?? '-'}</td>
                              <td className="py-2 px-3">{item?.user_id ?? '-'}</td>
                              <td className="py-2 px-3">{item?.ai_interaction ?? 0}</td>
                              <td className="py-2 px-3">{item?.message_count ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 时间段统计 Tab */}
          {activeTab === 'range' && (
            <div className="space-y-4 px-6">
              {/* 工具栏:快捷预设 + 自定义日期范围 */}
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardContent className="py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground shrink-0">
                        {t('aiStatistics.queryRange')}:
                      </span>
                      <TabButtonGroup
                        options={[
                          { value: '7d', label: t('aiStatistics.preset7d'), icon: <Sparkles className="w-4 h-4" /> },
                          { value: '14d', label: t('aiStatistics.preset14d'), icon: <Zap className="w-4 h-4" /> },
                          { value: '30d', label: t('aiStatistics.preset30d'), icon: <BarChart3 className="w-4 h-4" /> },
                          { value: '90d', label: t('aiStatistics.preset90d'), icon: <TrendingUp className="w-4 h-4" /> },
                          { value: 'custom', label: t('aiStatistics.customRange'), icon: <Pencil className="w-4 h-4" /> },
                        ]}
                        value={rangePreset}
                        onValueChange={(v) => setRangePreset(v as RangePreset)}
                      />
                    </div>
                    {rangePreset === 'custom' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'h-9 gap-2 justify-start font-normal',
                                !rangeStartDate && 'text-muted-foreground',
                              )}
                            >
                              <CalendarIcon className="h-4 w-4" />
                              {rangeStartDate
                                ? format(rangeStartDate, 'yyyy-MM-dd')
                                : t('aiStatistics.rangeStart')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent
                              mode="single"
                              selected={rangeStartDate}
                              onSelect={setRangeStartDate}
                              defaultMonth={rangeStartDate}
                            />
                          </PopoverContent>
                        </Popover>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                'h-9 gap-2 justify-start font-normal',
                                !rangeEndDate && 'text-muted-foreground',
                              )}
                            >
                              <CalendarIcon className="h-4 w-4" />
                              {rangeEndDate
                                ? format(rangeEndDate, 'yyyy-MM-dd')
                                : t('aiStatistics.rangeEnd')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <CalendarComponent
                              mode="single"
                              selected={rangeEndDate}
                              onSelect={setRangeEndDate}
                              defaultMonth={rangeEndDate}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 错误提示 */}
              {rangeError && !rangeLoading && (
                <Card className={cn('border-destructive/50', isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardContent className="flex items-center gap-3 p-4 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="flex-1">{rangeError}</span>
                    <Button size="sm" variant="outline" onClick={fetchRangeData} className="h-9">
                      <RefreshCw className="w-4 h-4 mr-1" />
                      {t('aiStatistics.refresh')}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* 加载骨架屏 */}
              {rangeLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Card key={i} className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="w-4 h-4" />
                        </CardHeader>
                        <CardContent>
                          <Skeleton className="h-8 w-24" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <div className="glass-card-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                      <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                      <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
                    </Card>
                    <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                      <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
                      <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
                    </Card>
                  </div>
                </div>
              ) : rangeData && !isRangeEmpty ? (
                <>
                  {/* 概览统计卡片 - 五类Token */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatCard
                      title={t('aiStatistics.inputTokens')}
                      value={formatCompactNumber(rangeData.total.input_tokens)}
                      icon={Coins}
                    />
                    <StatCard
                      title={t('aiStatistics.outputTokens')}
                      value={formatCompactNumber(rangeData.total.output_tokens)}
                      icon={Coins}
                    />
                    <StatCard
                      title={t('aiStatistics.cacheReadTokens')}
                      value={formatCompactNumber(rangeData.total.cache_read_tokens)}
                      icon={HardDrive}
                    />
                    <StatCard
                      title={t('aiStatistics.cacheWriteTokens')}
                      value={formatCompactNumber(rangeData.total.cache_write_tokens)}
                      icon={HardDrive}
                    />
                    <StatCard
                      title={t('aiStatistics.totalTokens')}
                      value={formatCompactNumber(rangeData.total.total_tokens)}
                      icon={TrendingUp}
                      className="ring-1 ring-primary/30"
                    />
                  </div>

                  {/* 折线图 + 饼图 */}
                  <div className="glass-card-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 按天趋势 */}
                    <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="w-5 h-5" />
                          {t('aiStatistics.dailyTrend')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[320px]">
                          <EChartsWrapper option={rangeTrendOption} height={320} />
                        </div>
                      </CardContent>
                    </Card>

                    {/* 模型分布 */}
                    <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="w-5 h-5" />
                          {t('aiStatistics.modelDistribution')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[320px]">
                          {rangeData.by_model.length > 0 ? (
                            <EChartsWrapper option={rangeModelPieOption} height={320} />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              {t('common.noData')}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 区间效率趋势 */}
                  <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        {t('aiStatistics.efficiencyTrend')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>
                          {t('aiStatistics.userTurnCount')}:{' '}
                          <strong className="text-foreground tabular-nums">
                            {rangeData.efficiency?.user_turn_count ?? 0}
                          </strong>
                        </span>
                        <span>
                          {t('aiStatistics.agentRunCount')}:{' '}
                          <strong className="text-foreground tabular-nums">
                            {rangeData.efficiency?.agent_run_count ?? 0}
                          </strong>
                        </span>
                        <span>
                          {t('aiStatistics.avgTokensPerUserTurn')}:{' '}
                          <strong className="text-foreground tabular-nums">
                            {formatCompactNumber(rangeData.efficiency?.avg_tokens_per_user_turn ?? 0)}
                          </strong>
                        </span>
                        <span>
                          {t('aiStatistics.avgTokensPerAgentRun')}:{' '}
                          <strong className="text-foreground tabular-nums">
                            {formatCompactNumber(rangeData.efficiency?.avg_tokens_per_agent_run ?? 0)}
                          </strong>
                        </span>
                      </div>
                      <div className="h-[320px]">
                        <EChartsWrapper option={rangeEfficiencyOption} height={320} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* 模型 Token 详情表 */}
                  <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Coins className="w-5 h-5" />
                        {t('aiStatistics.modelDistribution')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.model')}</th>
                              <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.inputTokens')}</th>
                              <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.outputTokens')}</th>
                              <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.cacheReadTokens')}</th>
                              <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.cacheWriteTokens')}</th>
                              <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.totalTokens')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rangeData.by_model.map((item, i) => (
                              <tr key={i} className="border-b border-border/30">
                                <td className="py-2 px-3">{item.model ?? '-'}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{(item.input_tokens ?? 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{(item.output_tokens ?? 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{(item.cache_read_tokens ?? 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right tabular-nums">{(item.cache_write_tokens ?? 0).toLocaleString()}</td>
                                <td className="py-2 px-3 text-right tabular-nums font-medium">{(item.total_tokens ?? 0).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                    <CalendarDays className="w-12 h-12 mb-4 opacity-50" />
                    <p>{t('aiStatistics.noDataInRange')}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="px-6">
          <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
            <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mb-4 opacity-50" />
              <p>{t('common.noData')}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </PinnedPage>
  );
}
