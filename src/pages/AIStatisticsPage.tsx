import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Progress } from '@/components/ui/progress';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
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
  total_cost_usd: number;
  total_cost_cny: number;
  by_model: TokenByModel[];
}

interface TokenByModel {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface Latency {
  avg: number;
  p95: number;
}

interface IntentDistribution {
  [key: string]: { count: number; percentage: number };
}

interface TriggerDistribution {
  [key: string]: { count: number; percentage: number };
}

interface ErrorStats {
  timeout: number;
  rate_limit: number;
  network_error: number;
  usage_limit: number;
  agent_error: number;
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

interface SessionMemory {
  active_session_count: number;
  avg_messages_per_session: number;
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
  session_memory: SessionMemory;
  persona_leaderboard: PersonaLeaderboard[];
  active_users: ActiveUser[];
}

// 颜色配置
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

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
        value: data?.count ?? 0,
        percentage: data?.percentage ?? 0,
      }))
    : [];

  const tokenModelChartData = tokenByModel.map((item) => ({
    name: item.model ?? 'Unknown',
    input: item.input_tokens ?? 0,
    output: item.output_tokens ?? 0,
    cost: item.cost_usd ?? 0,
  }));

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
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={intentChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              dataKey="value"
                              label={({ name, percentage }) => `${name} (${(percentage ?? 0).toFixed(1)}%)`}
                            >
                              {intentChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
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
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={triggerChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={80} />
                            <Tooltip />
                            <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
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
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={tokenModelChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="input" name={t('aiStatistics.inputTokens')} fill={CHART_COLORS[0]} />
                            <Bar dataKey="output" name={t('aiStatistics.outputTokens')} fill={CHART_COLORS[1]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          {t('common.noData')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 模型费用详情 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle>{t('aiStatistics.modelCostDetail')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/50">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.model')}</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.inputTokens')}</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.outputTokens')}</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('aiStatistics.costUSD')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tokenByModel.map((item, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-2 px-3">{item.model}</td>
                              <td className="py-2 px-3">{(item.input_tokens ?? 0).toLocaleString()}</td>
                              <td className="py-2 px-3">{(item.output_tokens ?? 0).toLocaleString()}</td>
                              <td className="py-2 px-3">${(item.cost_usd ?? 0).toFixed(4)}</td>
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

          {/* 性能 Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-4 px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Session 内存 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      {t('aiStatistics.sessionMemory')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{summary.session_memory?.active_session_count ?? 0}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.activeSessions')}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{(summary.session_memory?.avg_messages_per_session ?? 0).toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.avgMessagesPerSession')}</p>
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
