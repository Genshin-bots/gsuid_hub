import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';

// ============================================================================
// 类型定义
// ============================================================================

interface TokenUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  by_model: TokenByModel[];
  by_type: TokenByType[];
}

interface TokenByModel {
  model: string;
  input_tokens: number;
  output_tokens: number;
}

interface TokenByType {
  type: string;
  input_tokens: number;
  output_tokens: number;
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

interface PersonaLeaderboard {
  persona: string;
  mention: number;
  proactive: number;
  response: number;
}

interface ActiveUser {
  group_id: string;
  user_id: string;
  ai_interaction: number;
  message_count: number;
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
  persona_leaderboard: PersonaLeaderboard[];
  active_users: ActiveUser[];
}

// ============================================================================
// API 函数
// ============================================================================

async function fetchStatisticsSummary(date?: string): Promise<StatisticsSummary> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  return api.get<StatisticsSummary>(`/api/ai/statistics/summary?${params.toString()}`);
}

async function fetchTokenByModel(date?: string): Promise<TokenByModel[]> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  return api.get<TokenByModel[]>(`/api/ai/statistics/token-by-model?${params.toString()}`);
}

async function fetchActiveUsers(date?: string, limit: number = 20): Promise<ActiveUser[]> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  params.set('limit', limit.toString());
  return api.get<ActiveUser[]>(`/api/ai/statistics/active-users?${params.toString()}`);
}

async function fetchRagDocuments(): Promise<RagDocument[]> {
  return api.get<RagDocument[]>(`/api/ai/statistics/rag/documents`);
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
}

function StatCard({ title, value, subtitle, icon: Icon, className }: StatCardProps) {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';

  return (
    <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<string>('overview');

  // 加载数据
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [summaryData, tokenData, usersData, ragData] = await Promise.all([
        fetchStatisticsSummary(dateStr).catch(() => null),
        fetchTokenByModel(dateStr).catch(() => []),
        fetchActiveUsers(dateStr, 20).catch(() => []),
        fetchRagDocuments().catch(() => []),
      ]);

      setSummary(summaryData);
      setTokenByModel(tokenData);
      setTokenByType(summaryData?.token_usage?.by_type ?? []);
      setActiveUsers(usersData);
      setRagDocuments(ragData);
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
  }));

  const tokenTypeChartData = tokenByType.map((item) => ({
    name: item.type ?? 'Unknown',
    input: item.input_tokens ?? 0,
    output: item.output_tokens ?? 0,
  }));

  // ============================================================================
  // ECharts 配置
  // ============================================================================

  // 意图分布 - 环形图
  const intentPieOption = useMemo<EChartsOption>(() => ({
    animationDuration: 1000,
    animationEasing: 'cubicOut' as const,
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: '2%',
      top: 'center',
      textStyle: { fontSize: 11 },
      itemGap: 8,
    },
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
  }), [intentChartData]);

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

  // Token by Model - 分组柱状图
  const tokenModelOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: tokenModelChartData.map(d => d.name),
      axisLabel: { rotate: tokenModelChartData.length > 5 ? 30 : 0, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: [
        { name: t('aiStatistics.inputTokens'), icon: 'roundRect' },
        { name: t('aiStatistics.outputTokens'), icon: 'roundRect' },
      ],
      bottom: 0,
    },
    series: [
      {
        name: t('aiStatistics.inputTokens'),
        type: 'bar',
        data: tokenModelChartData.map(d => d.input),
        barMaxWidth: 30,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: t('aiStatistics.outputTokens'),
        type: 'bar',
        data: tokenModelChartData.map(d => d.output),
        barMaxWidth: 30,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
    ],
  }), [tokenModelChartData, t]);

  // Token by Type - 分组柱状图
  const tokenTypeOption = useMemo<EChartsOption>(() => ({
    animationDuration: 800,
    animationEasing: 'cubicOut' as const,
    grid: { left: '3%', right: '4%', bottom: '12%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: tokenTypeChartData.map(d => d.name),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: [
        { name: t('aiStatistics.inputTokens'), icon: 'roundRect' },
        { name: t('aiStatistics.outputTokens'), icon: 'roundRect' },
      ],
      bottom: 0,
    },
    series: [
      {
        name: t('aiStatistics.inputTokens'),
        type: 'bar',
        data: tokenTypeChartData.map(d => d.input),
        barMaxWidth: 30,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
      {
        name: t('aiStatistics.outputTokens'),
        type: 'bar',
        data: tokenTypeChartData.map(d => d.output),
        barMaxWidth: 30,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
      },
    ],
  }), [tokenTypeChartData, t]);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between px-6 pt-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="w-8 h-8" />
            {t('aiStatistics.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('aiStatistics.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, 'yyyy-MM-dd')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                defaultMonth={selectedDate}
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={loadData}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-6">
          {Array.from({ length: 4 }).map((_, i) => (
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
          {/* 概览统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-6">
            <StatCard
              title={t('aiStatistics.inputTokens')}
              value={(summary.token_usage?.total_input_tokens ?? 0).toLocaleString()}
              icon={Coins}
            />
            <StatCard
              title={t('aiStatistics.outputTokens')}
              value={(summary.token_usage?.total_output_tokens ?? 0).toLocaleString()}
              icon={Coins}
            />
            <StatCard
              title={t('aiStatistics.latency')}
              value={`${(summary.latency?.avg ?? 0).toFixed(2)}s`}
              subtitle={`P95: ${(summary.latency?.p95 ?? 0).toFixed(2)}s`}
              icon={Clock}
            />
            <StatCard
              title={t('aiStatistics.errors')}
              value={summary.errors?.total ?? 0}
              subtitle={`Timeout: ${summary.errors?.timeout ?? 0} | Rate Limit: ${summary.errors?.rate_limit ?? 0}`}
              icon={AlertTriangle}
            />
          </div>

          {/* Tabs 容器 */}
          <div className="px-6">
            <TabButtonGroup
              options={[
                { value: 'overview', label: t('aiStatistics.overview'), icon: <TrendingUp className="w-4 h-4" /> },
                { value: 'tokens', label: t('aiStatistics.tokenAnalysis'), icon: <Coins className="w-4 h-4" /> },
                { value: 'performance', label: t('aiStatistics.performance'), icon: <Activity className="w-4 h-4" /> },
                { value: 'rag', label: t('aiStatistics.ragEffect'), icon: <Database className="w-4 h-4" /> },
                { value: 'users', label: t('aiStatistics.users'), icon: <Users className="w-4 h-4" /> },
              ]}
              value={activeTab}
              onValueChange={setActiveTab}
              glassClassName={isGlass ? 'glass-card' : undefined}
            />
          </div>

          {/* 概览 Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
            </div>
          )}

          {/* Token 分析 Tab */}
          {activeTab === 'tokens' && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                        </tr>
                      </thead>
                      <tbody>
                        {tokenByModel.map((item, i) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-2 px-3">{item.model ?? '-'}</td>
                            <td className="py-2 px-3">{(item.input_tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3">{(item.output_tokens ?? 0).toLocaleString()}</td>
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
                        </tr>
                      </thead>
                      <tbody>
                        {tokenByType.map((item, i) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-2 px-3">{item.type ?? '-'}</td>
                            <td className="py-2 px-3">{(item.input_tokens ?? 0).toLocaleString()}</td>
                            <td className="py-2 px-3">{(item.output_tokens ?? 0).toLocaleString()}</td>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Memory 统计 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      {t('aiStatistics.memory')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{summary.memory?.observations ?? 0}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.observations')}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{summary.memory?.ingestions ?? 0}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.ingestions')}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{summary.memory?.retrievals ?? 0}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.retrievals')}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{summary.memory?.entities_created ?? 0}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.entitiesCreated')}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{summary.memory?.edges_created ?? 0}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.edgesCreated')}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{summary.memory?.episodes_created ?? 0}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.episodesCreated')}</p>
                      </div>
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
    </div>
  );
}
