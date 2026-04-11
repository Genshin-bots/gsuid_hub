import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Badge } from '@/components/ui/badge';
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
  Trophy,
  Zap,
  Brain,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

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
  bot_id: string;
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

async function fetchStatisticsSummary(botId: string = 'all'): Promise<StatisticsSummary> {
  return api.get<StatisticsSummary>(`/api/ai/statistics/summary?bot_id=${botId}`);
}

async function fetchTokenByModel(botId: string = 'all', date?: string): Promise<TokenByModel[]> {
  const url = date
    ? `/api/ai/statistics/token-by-model?bot_id=${botId}&date=${date}`
    : `/api/ai/statistics/token-by-model?bot_id=${botId}`;
  return api.get<TokenByModel[]>(url);
}

async function fetchPersonaLeaderboard(botId: string = 'all', limit: number = 10): Promise<PersonaLeaderboard[]> {
  return api.get<PersonaLeaderboard[]>(`/api/ai/statistics/persona-leaderboard?bot_id=${botId}&limit=${limit}`);
}

async function fetchActiveUsers(botId: string = 'all', limit: number = 20): Promise<ActiveUser[]> {
  return api.get<ActiveUser[]>(`/api/ai/statistics/active-users?bot_id=${botId}&limit=${limit}`);
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
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

interface DataTableProps {
  headers: string[];
  rows: string[][];
}

function DataTable({ headers, rows }: DataTableProps) {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {headers.map((header, i) => (
              <th key={i} className="text-left py-2 px-3 font-medium text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn('border-b border-border/30', isGlass && 'hover:bg-white/5')}>
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  const [personaLeaderboard, setPersonaLeaderboard] = useState<PersonaLeaderboard[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBot, setSelectedBot] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('overview');

  // 加载数据
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [summaryData, tokenData, personaData, usersData] = await Promise.all([
        fetchStatisticsSummary(selectedBot).catch(() => null),
        fetchTokenByModel(selectedBot).catch(() => []),
        fetchPersonaLeaderboard(selectedBot, 10).catch(() => []),
        fetchActiveUsers(selectedBot, 20).catch(() => []),
      ]);

      setSummary(summaryData);
      setTokenByModel(tokenData);
      setPersonaLeaderboard(personaData);
      setActiveUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loadFailed'));
      toast.error(err instanceof Error ? err.message : t('common.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBot, t]);

  // 准备图表数据
  const intentChartData = summary
    ? Object.entries(summary.intent_distribution).map(([name, data]) => ({
        name,
        value: data.count,
        percentage: data.percentage,
      }))
    : [];

  const triggerChartData = summary
    ? Object.entries(summary.trigger_distribution).map(([name, data]) => ({
        name,
        value: data.count,
        percentage: data.percentage,
      }))
    : [];

  const tokenModelChartData = tokenByModel.map((item) => ({
    name: item.model,
    input: item.input_tokens,
    output: item.output_tokens,
    cost: item.cost_usd,
  }));

  const personaChartData = personaLeaderboard.slice(0, 5).map((item) => ({
    name: item.persona,
    mention: item.mention,
    proactive: item.proactive,
    response: item.response,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <TrendingUp className="w-8 h-8" />
            {t('aiStatistics.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('aiStatistics.description')}</p>
        </div>
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

      {/* 错误提示 */}
      {error && (
        <Card className={cn('border-destructive/50', isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardContent className="flex items-center gap-3 p-4 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* 加载状态 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title={t('aiStatistics.tokenUsage')}
              value={summary.token_usage.total_input_tokens + summary.token_usage.total_output_tokens}
              subtitle={`${t('aiStatistics.inputTokens')}: ${summary.token_usage.total_input_tokens.toLocaleString()} | ${t('aiStatistics.outputTokens')}: ${summary.token_usage.total_output_tokens.toLocaleString()}`}
              icon={Coins}
            />
            <StatCard
              title={t('aiStatistics.totalCost')}
              value={`$${summary.token_usage.total_cost_usd.toFixed(4)}`}
              subtitle={`≈ ¥${summary.token_usage.total_cost_cny.toFixed(2)}`}
              icon={Coins}
            />
            <StatCard
              title={t('aiStatistics.latency')}
              value={`${summary.latency.avg.toFixed(2)}s`}
              subtitle={`P95: ${summary.latency.p95.toFixed(2)}s`}
              icon={Clock}
            />
            <StatCard
              title={t('aiStatistics.errors')}
              value={summary.errors.total}
              subtitle={`Timeout: ${summary.errors.timeout} | Rate Limit: ${summary.errors.rate_limit}`}
              icon={AlertTriangle}
            />
          </div>

          {/* Tabs 容器 */}
          <TabButtonGroup
            options={[
              { value: 'overview', label: t('aiStatistics.overview'), icon: <TrendingUp className="w-4 h-4" /> },
              { value: 'tokens', label: t('aiStatistics.tokenAnalysis'), icon: <Coins className="w-4 h-4" /> },
              { value: 'performance', label: t('aiStatistics.performance'), icon: <Activity className="w-4 h-4" /> },
              { value: 'users', label: t('aiStatistics.users'), icon: <Users className="w-4 h-4" /> },
            ]}
            value={activeTab}
            onValueChange={setActiveTab}
            glassClassName={isGlass ? 'glass-card' : undefined}
          />

          {/* 概览 Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
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
                              label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
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
                        <p className="text-2xl font-bold text-green-500">{summary.rag.hit_rate.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.hitRate')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="text-green-500">{summary.rag.hit_count}</span> / {summary.rag.hit_count + summary.rag.miss_count}
                        </p>
                      </div>
                    </div>
                    <Progress value={summary.rag.hit_rate} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t('aiStatistics.hit')}: {summary.rag.hit_count}</span>
                      <span>{t('aiStatistics.miss')}: {summary.rag.miss_count}</span>
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
                        <p className="text-2xl font-bold">{summary.heartbeat.conversion_rate?.toFixed(1) || 0}%</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.conversionRate')}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <ProgressItem
                        label={t('aiStatistics.shouldSpeak')}
                        value={summary.heartbeat.should_speak_true}
                        percentage={(summary.heartbeat.should_speak_true / (summary.heartbeat.should_speak_true + summary.heartbeat.should_speak_false)) * 100 || 0}
                      />
                      <ProgressItem
                        label={t('aiStatistics.shouldNotSpeak')}
                        value={summary.heartbeat.should_speak_false}
                        percentage={(summary.heartbeat.should_speak_false / (summary.heartbeat.should_speak_true + summary.heartbeat.should_speak_false)) * 100 || 0}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Token 分析 Tab */}
          {activeTab === 'tokens' && (
            <div className="space-y-4">
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
                    <DataTable
                      headers={[t('aiStatistics.model'), t('aiStatistics.inputTokens'), t('aiStatistics.outputTokens'), t('aiStatistics.costUSD')]}
                      rows={tokenByModel.map((item) => [
                        item.model,
                        item.input_tokens.toLocaleString(),
                        item.output_tokens.toLocaleString(),
                        `$${item.cost_usd.toFixed(4)}`,
                      ])}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 性能 Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-4">
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
                        <p className="text-2xl font-bold">{summary.session_memory.active_session_count}</p>
                        <p className="text-sm text-muted-foreground">{t('aiStatistics.activeSessions')}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-primary/10">
                        <p className="text-2xl font-bold">{summary.session_memory.avg_messages_per_session.toFixed(1)}</p>
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
                      <ProgressItem label={t('aiStatistics.timeout')} value={summary.errors.timeout} percentage={(summary.errors.timeout / summary.errors.total) * 100 || 0} />
                      <ProgressItem label={t('aiStatistics.rateLimit')} value={summary.errors.rate_limit} percentage={(summary.errors.rate_limit / summary.errors.total) * 100 || 0} />
                      <ProgressItem label={t('aiStatistics.networkError')} value={summary.errors.network_error} percentage={(summary.errors.network_error / summary.errors.total) * 100 || 0} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* 用户 Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Persona 排行榜 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      {t('aiStatistics.personaLeaderboard')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {personaChartData.length > 0 ? (
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={personaChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="response" name={t('aiStatistics.response')} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                        {t('common.noData')}
                      </div>
                    )}
                    <div className="mt-4">
                      <DataTable
                        headers={[t('aiStatistics.persona'), t('aiStatistics.mention'), t('aiStatistics.proactive'), t('aiStatistics.response')]}
                        rows={personaLeaderboard.map((item) => [
                          item.persona,
                          item.mention.toString(),
                          item.proactive.toString(),
                          item.response.toString(),
                        ])}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 活跃用户/群组 */}
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {t('aiStatistics.activeUsers')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      headers={[t('aiStatistics.groupId'), t('aiStatistics.userId'), t('aiStatistics.aiInteraction'), t('aiStatistics.messageCount')]}
                      rows={activeUsers.map((item) => [
                        item.group_id,
                        item.user_id,
                        item.ai_interaction.toString(),
                        item.message_count.toString(),
                      ])}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mb-4 opacity-50" />
            <p>{t('common.noData')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
