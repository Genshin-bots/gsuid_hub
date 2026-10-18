import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Wallet,
  Settings,
  Shield,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Activity,
  Users,
  Clock,
  Zap,
  Globe,
  Eye,
  Power,
  Gauge,
  HelpCircle,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  aiBudgetApi,
  AIBudgetConfig,
  AIBudgetRule,
  AIBudgetWhitelistEntry,
  AIBudgetOverview,
  AIBudgetCheckResult,
  AIBudgetWindowUsage,
} from '@/lib/api';
import { PinnedPage } from '@/components/layout/PinnedPage';

// ============================================================================
// Helpers
// ============================================================================

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIBudgetPage() {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('overview');

  const tabOptions = useMemo(
    () => [
      {
        value: 'overview',
        label: t('aiBudget.tabs.overview'),
        icon: <Gauge className="w-4 h-4" />,
      },
      {
        value: 'rules',
        label: t('aiBudget.tabs.rules'),
        icon: <Wallet className="w-4 h-4" />,
      },
      {
        value: 'manage',
        label: t('aiBudget.tabs.manage'),
        icon: <Settings className="w-4 h-4" />,
      },
      {
        value: 'diagnostic',
        label: t('aiBudget.tabs.diagnostic'),
        icon: <Eye className="w-4 h-4" />,
      },
    ],
    [t],
  );

  return (
    <PinnedPage
      className="gap-4"
      header={
        /* Header */
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wallet className="w-8 h-8" />
              {t('aiBudget.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('aiBudget.description')}</p>
          </div>
        </div>
      }
      toolbar={
        <TabButtonGroup options={tabOptions} value={activeTab} onValueChange={setActiveTab} />
      }
    >
      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab onNavigateTab={setActiveTab} />}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'manage' && <ManageTab />}
      {activeTab === 'diagnostic' && <DiagnosticTab />}
    </PinnedPage>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({ onNavigateTab }: { onNavigateTab: (tab: string) => void }) {
  const { t } = useLanguage();
  const [overview, setOverview] = useState<AIBudgetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiBudgetApi.getOverview();
      setOverview(res);
    } catch (e: any) {
      setError(e.message || t('aiBudget.common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (loading) return <OverviewSkeleton />;
  if (error)
    return (
      <Card className="glass-card">
        <CardContent className="!py-8 text-center">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={fetchOverview}>
            <RefreshCw className="w-4 h-4 mr-2" /> {t('aiBudget.common.retry')}
          </Button>
        </CardContent>
      </Card>
    );

  if (!overview) return null;

  // 占比条以榜首为基准，不依赖后端是否已按降序返回
  const topGroupsMax = overview.top_groups_24h.reduce((m, i) => Math.max(m, i.total_tokens), 0);
  const topUsersMax = overview.top_users_24h.reduce((m, i) => Math.max(m, i.total_tokens), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部全局状态卡片（全宽） */}
      <div
        className={cn(
          'glass-card rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-4',
          overview.enabled
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-amber-500/30 bg-amber-500/5',
        )}
      >
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              overview.enabled
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-amber-500/10 text-amber-500',
            )}
          >
            {overview.enabled ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-base text-foreground">
                {overview.enabled
                  ? t('aiBudget.overview.statusOn')
                  : t('aiBudget.overview.statusOff')}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium',
                  overview.enabled
                    ? 'text-emerald-500 border-emerald-500/30'
                    : 'text-amber-500 border-amber-500/30',
                )}
              >
                {overview.enabled
                  ? t('aiBudget.overview.enabled')
                  : t('aiBudget.overview.disabled')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {overview.enabled
                ? t('aiBudget.overview.statusOnDesc')
                : t('aiBudget.overview.tipOff')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {!overview.enabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab('manage')}
              className="h-9"
            >
              <Settings className="w-4 h-4 mr-1.5" />
              {t('aiBudget.overview.configAction')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchOverview} className="h-9">
            <RefreshCw className={cn('w-4 h-4 mr-1.5', loading && 'animate-spin')} />
            {t('aiBudget.overview.refresh')}
          </Button>
        </div>
      </div>

      {/* 4 个核心指标卡片（全宽响应式网格） */}
      <div className="glass-card-grid grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab('rules')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNavigateTab('rules');
          }}
          className="glass-card p-4 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-primary/40 transition-colors group"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {t('aiBudget.overview.ruleCount')}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">
              {overview.rule_count}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 group-hover:text-primary transition-colors">
              {t('aiBudget.overview.manageAction')} <ChevronRight className="w-3 h-3" />
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab('rules')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNavigateTab('rules');
          }}
          className="glass-card p-4 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-primary/40 transition-colors group"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {t('aiBudget.overview.enabledRuleCount')}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">
              {overview.enabled_rule_count}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {overview.rule_count - overview.enabled_rule_count > 0
                ? `${overview.rule_count - overview.enabled_rule_count} ${t('aiBudget.rules.disabledOnly')}`
                : t('aiBudget.rules.all')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab('manage')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNavigateTab('manage');
          }}
          className="glass-card p-4 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-primary/40 transition-colors group"
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {t('aiBudget.overview.whitelistCount')}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">
              {overview.whitelist_count}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 group-hover:text-primary transition-colors">
              {t('aiBudget.overview.configAction')} <ChevronRight className="w-3 h-3" />
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">
              {t('aiBudget.overview.totalTokens24h')}
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">
              {formatTokens(overview.total_tokens_24h)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">tokens / 24h</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 超限规则监控区 */}
      {overview.blocked_rules.length === 0 ? (
        <div className="glass-card p-3.5 px-4 rounded-xl flex items-center justify-between border border-border/50">
          <div className="flex items-center gap-2.5 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-medium text-foreground">
              {t('aiBudget.overview.noBlockedRules')}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              · {t('aiBudget.overview.healthyDesc')}
            </span>
          </div>
          <Badge
            variant="outline"
            className="text-xs text-emerald-500 border-emerald-500/30 bg-emerald-500/5 shrink-0"
          >
            {t('aiBudget.overview.healthyBadge')}
          </Badge>
        </div>
      ) : (
        <Card className="glass-card border-red-500/30">
          <CardHeader className="p-4 py-3 sm:p-4 sm:py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-red-500">
                <AlertTriangle className="h-4 w-4" />
                {t('aiBudget.overview.blockedRules')} ({overview.blocked_rules.length})
              </CardTitle>
              <Badge variant="destructive" className="text-xs">
                {t('aiBudget.rules.usage.over')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 sm:px-4 sm:pb-3 sm:pt-0">
            <div className="space-y-2">
              {overview.blocked_rules.map((br) => (
                <BlockedRuleItem key={br.rule_id} rule={br} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 24h 消耗排行 */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <Card className="glass-card h-full">
          <CardHeader className="p-4 py-3 sm:p-4 sm:py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              {t('aiBudget.overview.topGroups24h')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-2 pt-0 sm:px-4 sm:pb-2 sm:pt-0">
            {overview.top_groups_24h.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {t('aiBudget.overview.noData')}
              </p>
            ) : (
              <div>
                {overview.top_groups_24h.map((item, idx) => (
                  <TopConsumptionRow
                    key={item.group_id}
                    rank={idx + 1}
                    label={item.group_id}
                    tokens={item.total_tokens}
                    maxTokens={topGroupsMax}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card h-full">
          <CardHeader className="p-4 py-3 sm:p-4 sm:py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              {t('aiBudget.overview.topUsers24h')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-2 pt-0 sm:px-4 sm:pb-2 sm:pt-0">
            {overview.top_users_24h.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {t('aiBudget.overview.noData')}
              </p>
            ) : (
              <div>
                {overview.top_users_24h.map((item, idx) => (
                  <TopConsumptionRow
                    key={item.user_id}
                    rank={idx + 1}
                    label={item.user_id}
                    tokens={item.total_tokens}
                    maxTokens={topUsersMax}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 底部快捷入口导航 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mt-1">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab('rules')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNavigateTab('rules');
          }}
          className="glass-card p-4 rounded-xl border border-border/60 hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-4 w-4" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              {t('aiBudget.overview.quickRulesTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t('aiBudget.overview.quickRulesDesc')}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {overview.rule_count} {t('aiBudget.overview.ruleCount')}
            </span>
            <span className="text-primary font-medium group-hover:underline">
              {t('aiBudget.overview.manageAction')} →
            </span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab('manage')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNavigateTab('manage');
          }}
          className="glass-card p-4 rounded-xl border border-border/60 hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <Settings className="h-4 w-4" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              {t('aiBudget.overview.quickManageTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t('aiBudget.overview.quickManageDesc')}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {overview.whitelist_count} {t('aiBudget.overview.whitelistCount')}
            </span>
            <span className="text-primary font-medium group-hover:underline">
              {t('aiBudget.overview.configAction')} →
            </span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab('diagnostic')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onNavigateTab('diagnostic');
          }}
          className="glass-card p-4 rounded-xl border border-border/60 hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <Eye className="h-4 w-4" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">
              {t('aiBudget.overview.quickDiagTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t('aiBudget.overview.quickDiagDesc')}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('aiBudget.diagnostic.resultTitle')}</span>
            <span className="text-primary font-medium group-hover:underline">
              {t('aiBudget.overview.diagAction')} →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManageTab() {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-2">
        <h2 className="flex items-center gap-2 px-1 text-base font-semibold">
          <Settings className="h-4 w-4" />
          {t('aiBudget.config.title')}
        </h2>
        <ConfigTab />
      </section>
      <section className="flex min-w-0 flex-col gap-2">
        <h2 className="flex items-center gap-2 px-1 text-base font-semibold">
          <Shield className="h-4 w-4" />
          {t('aiBudget.whitelist.title')}
        </h2>
        <WhitelistTab />
      </section>
    </div>
  );
}

/** 24h 排行行：群号 / 用户 ID 常是超长字符串，名字区必须 min-w-0 才能截断，
 *  否则长名字撑破卡片、右侧数值被挤换行（P-28：桌面下不允许出现横向溢出）。 */
function TopConsumptionRow({
  rank,
  label,
  tokens,
  maxTokens,
}: {
  rank: number;
  label: string;
  tokens: number;
  maxTokens: number;
}) {
  const { t } = useLanguage();
  const pct = maxTokens > 0 ? Math.max((tokens / maxTokens) * 100, 2) : 0;

  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className="w-6 h-6 shrink-0 justify-center text-xs font-mono tabular-nums"
        >
          {rank}
        </Badge>
        <span className="min-w-0 flex-1 truncate font-mono text-sm" title={label}>
          {label}
        </span>
        <span className="shrink-0 whitespace-nowrap text-sm font-medium tabular-nums">
          {formatTokens(tokens)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {t('aiBudget.overview.tokens')}
          </span>
        </span>
      </div>
      <div className="mt-1.5 ml-9 h-1 rounded-full bg-muted/60 overflow-hidden">
        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BlockedRuleItem({
  rule,
}: {
  rule: { rule_id: number; scope_label: string; blocked: boolean; windows: AIBudgetWindowUsage[] };
}) {
  const { t } = useLanguage();
  return (
    <div className={cn('rounded-lg p-3 border glass-card border-red-500/30')}>
      <div className="flex items-center gap-2 mb-2">
        <XCircle className="w-4 h-4 text-red-500" />
        <span className="font-medium text-sm">{rule.scope_label}</span>
        <Badge variant="destructive" className="text-xs">
          {t('aiBudget.rules.usage.over')}
        </Badge>
      </div>
      <div className="space-y-2">
        {rule.windows
          .filter((w) => w.over)
          .map((w) => (
            <WindowProgressBar key={w.window} window={w} />
          ))}
      </div>
    </div>
  );
}

function WindowProgressBar({ window: w }: { window: AIBudgetWindowUsage }) {
  const { t } = useLanguage();
  const pct = w.limit > 0 ? Math.min((w.used / w.limit) * 100, 100) : 0;
  const isOver = w.over;
  const windowLabel = t(`aiBudget.rules.windows.${w.window}`);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-16 font-medium">{windowLabel}</span>
      <div className="flex-1">
        <Progress value={pct} className={cn('h-3', isOver && '[&>div]:bg-red-500')} />
      </div>
      <span
        className={cn(
          'font-mono text-xs whitespace-nowrap',
          isOver ? 'text-red-500' : 'text-muted-foreground',
        )}
      >
        {formatTokens(w.used)}/{formatTokens(w.limit)}
      </span>
      {w.reset_at && (
        <span className="text-xs text-muted-foreground">
          <Clock className="w-3 h-3 inline mr-1" />
          {formatTimestamp(w.reset_at)}
        </span>
      )}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Config Tab
// ============================================================================

function ConfigTab({
  onDirtyChange,
  onSavingChange,
  saveRef,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  saveRef?: React.MutableRefObject<(() => void) | null>;
} = {}) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<AIBudgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [enable, setEnable] = useState(false);
  const [countMode, setCountMode] = useState('input_output');
  const [countExemptUsage, setCountExemptUsage] = useState(false);
  const [exemptMasters, setExemptMasters] = useState(true);
  const [notifyOnBlock, setNotifyOnBlock] = useState(true);
  const [notifyCooldown, setNotifyCooldown] = useState(300);
  const [blockMessage, setBlockMessage] = useState('');

  // Dirty tracking: compare current form values against fetched config
  const isDirty = useMemo(() => {
    if (!config) return false;
    return (
      enable !== config.enable ||
      countMode !== config.count_mode ||
      countExemptUsage !== config.count_exempt_usage ||
      exemptMasters !== config.exempt_masters ||
      notifyOnBlock !== config.notify_on_block ||
      notifyCooldown !== config.notify_cooldown ||
      blockMessage !== config.block_message
    );
  }, [
    config,
    enable,
    countMode,
    countExemptUsage,
    exemptMasters,
    notifyOnBlock,
    notifyCooldown,
    blockMessage,
  ]);

  // Sync dirty/saving state to parent for header save button
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiBudgetApi.getConfig();
      setConfig(res);
      setEnable(res.enable);
      setCountMode(res.count_mode);
      setCountExemptUsage(res.count_exempt_usage);
      setExemptMasters(res.exempt_masters);
      setNotifyOnBlock(res.notify_on_block);
      setNotifyCooldown(res.notify_cooldown);
      setBlockMessage(res.block_message);
    } catch (e: any) {
      setError(e.message || t('aiBudget.common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await aiBudgetApi.updateConfig({
        enable,
        count_mode: countMode as AIBudgetConfig['count_mode'],
        count_exempt_usage: countExemptUsage,
        exempt_masters: exemptMasters,
        notify_on_block: notifyOnBlock,
        notify_cooldown: notifyCooldown,
        block_message: blockMessage,
      });
      setConfig(res);
      toast.success(t('aiBudget.config.saveSuccess'));
    } catch (e: any) {
      toast.error(t('aiBudget.config.saveFailed') + ': ' + e.message);
    } finally {
      setSaving(false);
    }
  };
  if (saveRef) saveRef.current = handleSave;

  if (loading) return <ConfigSkeleton />;
  if (error)
    return (
      <Card className="glass-card">
        <CardContent className="!py-8 text-center">
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={fetchConfig}>
            <RefreshCw className="w-4 h-4 mr-2" /> {t('aiBudget.common.retry')}
          </Button>
        </CardContent>
      </Card>
    );

  const countModeOptions = [
    { value: 'input_output', label: t('aiBudget.config.countModeOptions.inputOutput') },
    { value: 'total_with_cache', label: t('aiBudget.config.countModeOptions.totalWithCache') },
    { value: 'output_only', label: t('aiBudget.config.countModeOptions.outputOnly') },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Master Switch */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="w-5 h-5" />
            {t('aiBudget.config.enable')}
          </CardTitle>
          <CardDescription>{t('aiBudget.config.enableDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch checked={enable} onCheckedChange={setEnable} />
              <span className="font-medium">
                {enable ? t('aiBudget.common.enabled') : t('aiBudget.common.disabled')}
              </span>
            </div>
            {!enable && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                {t('aiBudget.overview.tipOff')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Counting Mode */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="w-5 h-5" />
            {t('aiBudget.config.countMode')}
          </CardTitle>
          <CardDescription>{t('aiBudget.config.countModeDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>{t('aiBudget.config.countMode')}</Label>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>{t('aiBudget.config.countModeDesc')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select value={countMode} onValueChange={setCountMode}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countModeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>{t('aiBudget.config.notifyCooldown')}</Label>
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>{t('aiBudget.config.notifyCooldownDesc')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                type="number"
                value={notifyCooldown}
                onChange={(e) => setNotifyCooldown(Number(e.target.value))}
                min={0}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exemption Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {t('aiBudget.config.exemptMasters')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="font-medium">{t('aiBudget.config.exemptMasters')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('aiBudget.config.exemptMastersDesc')}
              </p>
            </div>
            <Switch checked={exemptMasters} onCheckedChange={setExemptMasters} />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="font-medium">{t('aiBudget.config.countExemptUsage')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('aiBudget.config.countExemptUsageDesc')}
              </p>
            </div>
            <Switch checked={countExemptUsage} onCheckedChange={setCountExemptUsage} />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="font-medium">{t('aiBudget.config.notifyOnBlock')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('aiBudget.config.notifyOnBlockDesc')}
              </p>
            </div>
            <Switch checked={notifyOnBlock} onCheckedChange={setNotifyOnBlock} />
          </div>
        </CardContent>
      </Card>

      {/* Block Message */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{t('aiBudget.config.blockMessage')}</CardTitle>
          <CardDescription>{t('aiBudget.config.blockMessageDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={blockMessage}
            onChange={(e) => setBlockMessage(e.target.value)}
            rows={3}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end">
        <Button className="button-solid" onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {t('aiBudget.config.save')}
        </Button>
      </div>
    </div>
  );
}

function ConfigSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================================
// Rules Tab
// ============================================================================

function RulesTab() {
  const { t } = useLanguage();
  const [rules, setRules] = useState<AIBudgetRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [scopeTypeFilter, setScopeTypeFilter] = useState('__all__');
  const [enabledFilter, setEnabledFilter] = useState('__all__');
  const [withUsage, setWithUsage] = useState(true);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AIBudgetRule | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<AIBudgetRule | null>(null);

  // Rule detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailRule, setDetailRule] = useState<AIBudgetRule | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (scopeTypeFilter && scopeTypeFilter !== '__all__') params.scope_type = scopeTypeFilter;
      if (enabledFilter && enabledFilter !== '__all__') params.enabled = enabledFilter;
      if (search) params.q = search;
      if (withUsage) params.with_usage = true;
      const res = await aiBudgetApi.getRules(params);
      setRules(res);
    } catch (e: any) {
      setError(e.message || t('aiBudget.common.error'));
    } finally {
      setLoading(false);
    }
  }, [t, scopeTypeFilter, enabledFilter, search, withUsage]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggle = async (rule: AIBudgetRule) => {
    try {
      await aiBudgetApi.toggleRule(rule.id);
      toast.success(
        rule.enabled
          ? t('aiBudget.rules.form.toggleSuccessDisabled')
          : t('aiBudget.rules.form.toggleSuccessEnabled'),
      );
      fetchRules();
    } catch (e: any) {
      toast.error(t('aiBudget.rules.form.toggleFailed') + ': ' + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deletingRule) return;
    try {
      await aiBudgetApi.deleteRule(deletingRule.id);
      toast.success(t('aiBudget.rules.form.deleteSuccess'));
      setDeleteDialogOpen(false);
      setDeletingRule(null);
      fetchRules();
    } catch (e: any) {
      toast.error(t('aiBudget.rules.form.deleteFailed') + ': ' + e.message);
    }
  };

  const handleViewDetail = async (rule: AIBudgetRule) => {
    setDetailDialogOpen(true);
    setDetailLoading(true);
    setDetailRule(null);
    try {
      const res = await aiBudgetApi.getRule(rule.id);
      setDetailRule(res);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const scopeTypeOptions = useMemo(
    () => [
      { value: '__all__', label: t('aiBudget.rules.all') },
      { value: 'global', label: t('aiBudget.rules.scopeTypes.global') },
      { value: 'group', label: t('aiBudget.rules.scopeTypes.group') },
      { value: 'member', label: t('aiBudget.rules.scopeTypes.member') },
      { value: 'user', label: t('aiBudget.rules.scopeTypes.user') },
    ],
    [t],
  );

  const enabledOptions = useMemo(
    () => [
      { value: '__all__', label: t('aiBudget.rules.all') },
      { value: 'true', label: t('aiBudget.rules.enabledOnly') },
      { value: 'false', label: t('aiBudget.rules.disabledOnly') },
    ],
    [t],
  );

  const filteredRules = useMemo(() => {
    return rules;
    // Server-side filtering is already done
  }, [rules]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <Card className="glass-card">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('aiBudget.rules.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>
            <Select value={scopeTypeFilter} onValueChange={setScopeTypeFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder={t('aiBudget.rules.filterScopeType')} />
              </SelectTrigger>
              <SelectContent>
                {scopeTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={enabledFilter} onValueChange={setEnabledFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder={t('aiBudget.rules.filterEnabled')} />
              </SelectTrigger>
              <SelectContent>
                {enabledOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={withUsage} onCheckedChange={setWithUsage} />
              <span className="text-muted-foreground">{t('aiBudget.rules.withUsage')}</span>
            </div>
            <Button size="sm" className="h-9" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> {t('aiBudget.rules.createRule')}
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchRules}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      {loading ? (
        <RulesSkeleton />
      ) : error ? (
        <Card className="glass-card">
          <CardContent className="!py-8 text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={fetchRules}>
              <RefreshCw className="w-4 h-4 mr-2" /> {t('aiBudget.common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : filteredRules.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="!py-8 text-center">
            <Wallet className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('aiBudget.rules.noRules')}</p>
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> {t('aiBudget.rules.createRule')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => handleToggle(rule)}
              onEdit={() => {
                setEditingRule(rule);
                setEditDialogOpen(true);
              }}
              onDelete={() => {
                setDeletingRule(rule);
                setDeleteDialogOpen(true);
              }}
              onViewDetail={() => handleViewDetail(rule)}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <RuleFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        onSuccess={fetchRules}
      />

      {/* Edit Dialog */}
      <RuleFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        rule={editingRule}
        onSuccess={fetchRules}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiBudget.rules.deleteRule')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiBudget.rules.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('aiBudget.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              {t('aiBudget.common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className={cn('max-w-2xl', 'glass-card')}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {detailRule ? detailRule.name : t('aiBudget.rules.title')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('aiBudget.rules.ruleDetailAriaDesc')}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : detailRule && detailRule.usage ? (
            <div className="space-y-4">
              <RuleInfoSection rule={detailRule} />
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium text-sm">{t('aiBudget.rules.columns.usage')}</h4>
                {detailRule.usage.windows.map((w) => (
                  <WindowProgressBar key={w.window} window={w} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-4">{t('aiBudget.rules.usage.noUsage')}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RuleCard({
  rule,
  onToggle,
  onEdit,
  onDelete,
  onViewDetail,
}: {
  rule: AIBudgetRule;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewDetail: () => void;
}) {
  const { t } = useLanguage();
  const scopeTypeLabel = t(`aiBudget.rules.scopeTypes.${rule.scope_type}`);
  const periodModeLabel = t(`aiBudget.rules.periodModes.${rule.period_mode}`);

  return (
    <Card className={cn('glass-card', rule.enabled ? '' : 'opacity-60')}>
      <CardContent className="py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Switch checked={rule.enabled} onCheckedChange={onToggle} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium truncate">
                  {rule.name || t('aiBudget.common.globalScope')}
                </span>
                <Badge variant="outline" className="text-xs">
                  {scopeTypeLabel}
                </Badge>
                {rule.scope_id && (
                  <span className="text-xs font-mono text-muted-foreground">{rule.scope_id}</span>
                )}
                {rule.member_id && (
                  <span className="text-xs font-mono text-muted-foreground">→{rule.member_id}</span>
                )}
                <Badge variant="secondary" className="text-xs">
                  {periodModeLabel}
                </Badge>
                {!rule.enabled && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {t('aiBudget.common.disabled')}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {t('aiBudget.rules.columns.priority')}: {rule.priority}
                </span>
                {rule.limit_short > 0 && <span>S:{formatTokens(rule.limit_short)}</span>}
                {rule.limit_day > 0 && <span>D:{formatTokens(rule.limit_day)}</span>}
                {rule.limit_week > 0 && <span>W:{formatTokens(rule.limit_week)}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onViewDetail}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {/* Full-width usage bars aligned with toolbar right edge */}
        {rule.usage && rule.usage.windows.length > 0 && (
          <div className="mt-4 space-y-2">
            {rule.usage.windows.map((w) => (
              <WindowProgressBar key={w.window} window={w} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuleInfoSection({ rule }: { rule: AIBudgetRule }) {
  const { t } = useLanguage();
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.columns.name')}:</span>{' '}
        {rule.name || '-'}
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.columns.scopeType')}:</span>{' '}
        {t(`aiBudget.rules.scopeTypes.${rule.scope_type}`)}
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.columns.scopeId')}:</span>{' '}
        {rule.scope_id || '-'}
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.columns.memberId')}:</span>{' '}
        {rule.member_id || '-'}
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.columns.periodMode')}:</span>{' '}
        {t(`aiBudget.rules.periodModes.${rule.period_mode}`)}
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.form.shortWindowHours')}:</span>{' '}
        {rule.short_window_hours}h
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.form.limitShort')}:</span>{' '}
        {formatTokens(rule.limit_short)}
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.form.limitDay')}:</span>{' '}
        {formatTokens(rule.limit_day)}
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.form.limitWeek')}:</span>{' '}
        {formatTokens(rule.limit_week)}
      </div>
      <div>
        <span className="text-muted-foreground">{t('aiBudget.rules.columns.priority')}:</span>{' '}
        {rule.priority}
      </div>
    </div>
  );
}

function RuleFormDialog({
  open,
  onOpenChange,
  mode,
  rule,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  rule?: AIBudgetRule | null;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState<'global' | 'group' | 'member' | 'user'>('group');
  const [scopeId, setScopeId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [botId, setBotId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(0);
  const [periodMode, setPeriodMode] = useState<'rolling' | 'fixed'>('rolling');
  const [shortWindowHours, setShortWindowHours] = useState(5);
  const [limitShort, setLimitShort] = useState(0);
  const [limitDay, setLimitDay] = useState(0);
  const [limitWeek, setLimitWeek] = useState(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open && mode === 'edit' && rule) {
      setName(rule.name);
      setScopeType(rule.scope_type);
      setScopeId(rule.scope_id);
      setMemberId(rule.member_id);
      setBotId(rule.bot_id);
      setEnabled(rule.enabled);
      setPriority(rule.priority);
      setPeriodMode(rule.period_mode);
      setShortWindowHours(rule.short_window_hours);
      setLimitShort(rule.limit_short);
      setLimitDay(rule.limit_day);
      setLimitWeek(rule.limit_week);
      setNote(rule.note);
    } else if (open && mode === 'create') {
      setName('');
      setScopeType('group');
      setScopeId('');
      setMemberId('');
      setBotId('');
      setEnabled(true);
      setPriority(0);
      setPeriodMode('rolling');
      setShortWindowHours(5);
      setLimitShort(0);
      setLimitDay(0);
      setLimitWeek(0);
      setNote('');
    }
  }, [open, mode, rule]);

  const scopeTypeOptions = [
    {
      value: 'global',
      label: t('aiBudget.rules.scopeTypes.global'),
      desc: t('aiBudget.rules.scopeTypeDesc.global'),
    },
    {
      value: 'group',
      label: t('aiBudget.rules.scopeTypes.group'),
      desc: t('aiBudget.rules.scopeTypeDesc.group'),
    },
    {
      value: 'member',
      label: t('aiBudget.rules.scopeTypes.member'),
      desc: t('aiBudget.rules.scopeTypeDesc.member'),
    },
    {
      value: 'user',
      label: t('aiBudget.rules.scopeTypes.user'),
      desc: t('aiBudget.rules.scopeTypeDesc.user'),
    },
  ];

  const periodModeOptions = [
    {
      value: 'rolling',
      label: t('aiBudget.rules.periodModes.rolling'),
      desc: t('aiBudget.rules.periodModeDesc.rolling'),
    },
    {
      value: 'fixed',
      label: t('aiBudget.rules.periodModes.fixed'),
      desc: t('aiBudget.rules.periodModeDesc.fixed'),
    },
  ];

  const handleSave = async () => {
    // Validate at least one limit > 0
    if (limitShort <= 0 && limitDay <= 0 && limitWeek <= 0) {
      toast.error(t('aiBudget.rules.form.limitHint'));
      return;
    }
    // Validate scope_id for group/member/user
    if (scopeType !== 'global' && !scopeId) {
      toast.error(t('aiBudget.rules.form.scopeIdPlaceholder'));
      return;
    }
    // Validate member_id for member scope
    if (scopeType === 'member' && !memberId) {
      toast.error(t('aiBudget.rules.form.memberIdPlaceholder'));
      return;
    }

    setSaving(true);
    try {
      const data: Partial<AIBudgetRule> = {
        name,
        scope_type: scopeType,
        scope_id: scopeType === 'global' ? '' : scopeId,
        member_id: scopeType === 'member' ? memberId : '',
        bot_id: botId,
        enabled,
        priority,
        period_mode: periodMode,
        short_window_hours: shortWindowHours,
        limit_short: limitShort,
        limit_day: limitDay,
        limit_week: limitWeek,
        note,
      };

      if (mode === 'create') {
        await aiBudgetApi.createRule(data);
        toast.success(t('aiBudget.rules.form.createSuccess'));
      } else if (rule) {
        await aiBudgetApi.updateRule(rule.id, data);
        toast.success(t('aiBudget.rules.form.updateSuccess'));
      }
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(
        (mode === 'create'
          ? t('aiBudget.rules.form.createFailed')
          : t('aiBudget.rules.form.updateFailed')) +
          ': ' +
          e.message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-2xl max-h-[80vh] flex flex-col', 'glass-card')}>
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {mode === 'create' ? t('aiBudget.rules.createRule') : t('aiBudget.rules.editRule')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('aiBudget.rules.ruleFormAriaDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Scope Type */}
          <div className="space-y-2">
            <Label className="font-medium">{t('aiBudget.rules.form.scopeType')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {scopeTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScopeType(opt.value as any)}
                  className={cn(
                    'flex flex-col items-start p-3 rounded-lg border text-sm transition-all',
                    scopeType === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground mt-1">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Scope ID / Member ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scopeType !== 'global' && (
              <div className="space-y-2">
                <Label>{t('aiBudget.rules.form.scopeId')}</Label>
                <Input
                  value={scopeId}
                  onChange={(e) => setScopeId(e.target.value)}
                  placeholder={t('aiBudget.rules.form.scopeIdPlaceholder')}
                />
              </div>
            )}
            {scopeType === 'member' && (
              <div className="space-y-2">
                <Label>{t('aiBudget.rules.form.memberId')}</Label>
                <Input
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  placeholder={t('aiBudget.rules.form.memberIdPlaceholder')}
                />
              </div>
            )}
          </div>

          {/* Name / Bot ID / Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t('aiBudget.rules.form.name')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('aiBudget.rules.form.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('aiBudget.rules.form.botId')}</Label>
              <Input
                value={botId}
                onChange={(e) => setBotId(e.target.value)}
                placeholder={t('aiBudget.rules.form.botIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('aiBudget.rules.form.priority')}</Label>
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Period Mode */}
          <div className="space-y-2">
            <Label className="font-medium">{t('aiBudget.rules.form.periodMode')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {periodModeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriodMode(opt.value as any)}
                  className={cn(
                    'flex flex-col items-start p-3 rounded-lg border text-sm transition-all',
                    periodMode === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground mt-1">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Short Window Hours */}
          <div className="space-y-2">
            <Label>{t('aiBudget.rules.form.shortWindowHours')}</Label>
            <Input
              type="number"
              value={shortWindowHours}
              onChange={(e) => setShortWindowHours(Number(e.target.value))}
              min={1}
              max={168}
            />
            <p className="text-xs text-muted-foreground">
              {t('aiBudget.rules.form.shortWindowHoursDesc')}
            </p>
          </div>

          {/* Limits */}
          <div className="space-y-2">
            <Label className="font-medium">{t('aiBudget.rules.columns.limits')}</Label>
            <p className="text-xs text-muted-foreground">{t('aiBudget.rules.form.limitHint')}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">{t('aiBudget.rules.form.limitShort')}</Label>
                <Input
                  type="number"
                  value={limitShort || ''}
                  onChange={(e) => setLimitShort(Number(e.target.value) || 0)}
                  min={0}
                />
                <p className="text-xs text-muted-foreground">
                  {t('aiBudget.rules.form.limitShortDesc')}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('aiBudget.rules.form.limitDay')}</Label>
                <Input
                  type="number"
                  value={limitDay || ''}
                  onChange={(e) => setLimitDay(Number(e.target.value) || 0)}
                  min={0}
                />
                <p className="text-xs text-muted-foreground">
                  {t('aiBudget.rules.form.limitDayDesc')}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('aiBudget.rules.form.limitWeek')}</Label>
                <Input
                  type="number"
                  value={limitWeek || ''}
                  onChange={(e) => setLimitWeek(Number(e.target.value) || 0)}
                  min={0}
                />
                <p className="text-xs text-muted-foreground">
                  {t('aiBudget.rules.form.limitWeekDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* Enabled / Note */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <Label>{t('aiBudget.rules.form.enabled')}</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('aiBudget.rules.form.note')}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('aiBudget.rules.form.notePlaceholder')}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('aiBudget.common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'create' ? t('aiBudget.common.create') : t('aiBudget.common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RulesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}

// ============================================================================
// Whitelist Tab
// ============================================================================

function WhitelistTab() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<AIBudgetWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AIBudgetWhitelistEntry | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<AIBudgetWhitelistEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiBudgetApi.getWhitelist();
      setEntries(res);
    } catch (e: any) {
      setError(e.message || t('aiBudget.common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleDelete = async () => {
    if (!deletingEntry) return;
    try {
      await aiBudgetApi.deleteWhitelistEntry(deletingEntry.id);
      toast.success(t('aiBudget.whitelist.form.deleteSuccess'));
      setDeleteDialogOpen(false);
      setDeletingEntry(null);
      fetchEntries();
    } catch (e: any) {
      toast.error(t('aiBudget.whitelist.form.deleteFailed') + ': ' + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <Card className="glass-card">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> {t('aiBudget.whitelist.createEntry')}
            </Button>
            <Button variant="outline" size="icon" onClick={fetchEntries}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entries List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="glass-card">
          <CardContent className="!py-8 text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={fetchEntries}>
              <RefreshCw className="w-4 h-4 mr-2" /> {t('aiBudget.common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="!py-8 text-center">
            <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t('aiBudget.whitelist.noEntries')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <WhitelistEntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => {
                setEditingEntry(entry);
                setEditDialogOpen(true);
              }}
              onDelete={() => {
                setDeletingEntry(entry);
                setDeleteDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <WhitelistFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        onSuccess={fetchEntries}
      />

      {/* Edit Dialog */}
      <WhitelistFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        entry={editingEntry}
        onSuccess={fetchEntries}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiBudget.whitelist.deleteEntry')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiBudget.whitelist.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('aiBudget.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              {t('aiBudget.common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WhitelistEntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: AIBudgetWhitelistEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const isGlobal = !entry.group_id;

  return (
    <Card className={cn('glass-card', !entry.enabled && 'opacity-60')}>
      <CardContent className="py-3">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-medium">{entry.user_id}</span>
                {isGlobal ? (
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                    {t('aiBudget.whitelist.scope.global')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {t('aiBudget.whitelist.scope.groupOnly')} · {entry.group_id}
                  </Badge>
                )}
                {!entry.enabled && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    {t('aiBudget.common.disabled')}
                  </Badge>
                )}
              </div>
              {entry.note && <p className="text-xs text-muted-foreground mt-1">{entry.note}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WhitelistFormDialog({
  open,
  onOpenChange,
  mode,
  entry,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  entry?: AIBudgetWhitelistEntry | null;
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [botId, setBotId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open && mode === 'edit' && entry) {
      setUserId(entry.user_id);
      setGroupId(entry.group_id);
      setBotId(entry.bot_id);
      setEnabled(entry.enabled);
      setNote(entry.note);
    } else if (open && mode === 'create') {
      setUserId('');
      setGroupId('');
      setBotId('');
      setEnabled(true);
      setNote('');
    }
  }, [open, mode, entry]);

  const isGlobal = !groupId;

  const handleSave = async () => {
    if (!userId) {
      toast.error(t('aiBudget.whitelist.form.userIdPlaceholder'));
      return;
    }
    setSaving(true);
    try {
      const data: Partial<AIBudgetWhitelistEntry> = {
        user_id: userId,
        group_id: groupId,
        bot_id: botId,
        enabled,
        note,
      };
      if (mode === 'create') {
        await aiBudgetApi.createWhitelistEntry(data);
        toast.success(t('aiBudget.whitelist.form.createSuccess'));
      } else if (entry) {
        await aiBudgetApi.updateWhitelistEntry(entry.id, data);
        toast.success(t('aiBudget.whitelist.form.updateSuccess'));
      }
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error(
        (mode === 'create'
          ? t('aiBudget.whitelist.form.createFailed')
          : t('aiBudget.whitelist.form.updateFailed')) +
          ': ' +
          e.message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-lg', 'glass-card')}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('aiBudget.whitelist.createEntry')
              : t('aiBudget.whitelist.editEntry')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('aiBudget.whitelist.whitelistFormAriaDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('aiBudget.whitelist.form.userId')} *</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder={t('aiBudget.whitelist.form.userIdPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('aiBudget.whitelist.form.groupId')}</Label>
            <Input
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder={t('aiBudget.whitelist.form.groupIdPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              {isGlobal
                ? t('aiBudget.whitelist.scope.global')
                : t('aiBudget.whitelist.form.groupIdHint')}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t('aiBudget.whitelist.form.botId')}</Label>
            <Input
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              placeholder={t('aiBudget.whitelist.form.botIdPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>{t('aiBudget.whitelist.form.enabled')}</Label>
          </div>
          <div className="space-y-2">
            <Label>{t('aiBudget.whitelist.form.note')}</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('aiBudget.whitelist.form.notePlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('aiBudget.common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'create' ? t('aiBudget.common.create') : t('aiBudget.common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Diagnostic Tab
// ============================================================================

function DiagnosticTab() {
  const { t } = useLanguage();

  // Dry run state
  const [checkUserId, setCheckUserId] = useState('');
  const [checkGroupId, setCheckGroupId] = useState('');
  const [checkBotId, setCheckBotId] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<AIBudgetCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Reset state
  const [resetScopeType, setResetScopeType] = useState('group');
  const [resetScopeId, setResetScopeId] = useState('');
  const [resetMemberId, setResetMemberId] = useState('');
  const [resetBotId, setResetBotId] = useState('');
  const [resetWindow, setResetWindow] = useState('__all__');
  const [resetting, setResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const handleCheck = async () => {
    if (!checkUserId) {
      toast.error(t('aiBudget.diagnostic.userIdPlaceholder'));
      return;
    }
    setChecking(true);
    setCheckError(null);
    setCheckResult(null);
    try {
      const res = await aiBudgetApi.check({
        user_id: checkUserId,
        group_id: checkGroupId,
        bot_id: checkBotId,
      });
      setCheckResult(res);
    } catch (e: any) {
      setCheckError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await aiBudgetApi.reset({
        scope_type: resetScopeType,
        scope_id: resetScopeId,
        member_id: resetMemberId,
        bot_id: resetBotId,
        window: resetWindow === '__all__' ? '' : resetWindow,
      });
      toast.success(t('aiBudget.diagnostic.resetSuccess').replace('{count}', String(res.deleted)));
    } catch (e: any) {
      toast.error(t('aiBudget.diagnostic.resetFailed') + ': ' + e.message);
    } finally {
      setResetting(false);
      setResetConfirmOpen(false);
    }
  };

  const scopeTypeOptions = [
    { value: 'global', label: t('aiBudget.rules.scopeTypes.global') },
    { value: 'group', label: t('aiBudget.rules.scopeTypes.group') },
    { value: 'member', label: t('aiBudget.rules.scopeTypes.member') },
    { value: 'user', label: t('aiBudget.rules.scopeTypes.user') },
  ];

  const windowOptions = [
    { value: '__all__', label: t('aiBudget.diagnostic.resetWindowOptions.all') },
    { value: 'short', label: t('aiBudget.diagnostic.resetWindowOptions.short') },
    { value: 'day', label: t('aiBudget.diagnostic.resetWindowOptions.day') },
    { value: 'week', label: t('aiBudget.diagnostic.resetWindowOptions.week') },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Dry Run Check */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            {t('aiBudget.diagnostic.checkTitle')}
          </CardTitle>
          <CardDescription>{t('aiBudget.diagnostic.checkDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 min-h-[20px]">
                <Label>{t('aiBudget.diagnostic.userId')} *</Label>
              </div>
              <Input
                value={checkUserId}
                onChange={(e) => setCheckUserId(e.target.value)}
                placeholder={t('aiBudget.diagnostic.userIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 min-h-[20px]">
                <Label>{t('aiBudget.diagnostic.groupId')}</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex text-muted-foreground cursor-help" tabIndex={0}>
                        <HelpCircle className="w-3.5 h-3.5" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {t('aiBudget.diagnostic.groupIdHint')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                value={checkGroupId}
                onChange={(e) => setCheckGroupId(e.target.value)}
                placeholder={t('aiBudget.diagnostic.groupIdPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 min-h-[20px]">
                <Label>{t('aiBudget.diagnostic.botId')}</Label>
              </div>
              <Input
                value={checkBotId}
                onChange={(e) => setCheckBotId(e.target.value)}
                placeholder={t('aiBudget.diagnostic.botIdPlaceholder')}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCheck} disabled={checking}>
              {checking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              {checking ? t('aiBudget.diagnostic.checking') : t('aiBudget.diagnostic.runCheck')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Check Result */}
      {checkError && (
        <Card className={cn('glass-card', 'border-red-500/30')}>
          <CardContent className="!py-4 text-center text-red-500">{checkError}</CardContent>
        </Card>
      )}
      {checkResult && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {checkResult.allowed ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              {t('aiBudget.diagnostic.resultTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div
              className={cn(
                'rounded-lg border p-4 glass-card glass-alert glass-alert-tint',
                checkResult.allowed
                  ? 'border-green-500/30 glass-alert-tint-success'
                  : 'border-red-500/30 glass-alert-tint-danger',
              )}
            >
              <div className="flex items-center gap-2 font-medium mb-2">
                {checkResult.allowed
                  ? t('aiBudget.diagnostic.allowed')
                  : t('aiBudget.diagnostic.blocked')}
              </div>
              {!checkResult.enabled && (
                <p className="text-sm text-muted-foreground">
                  {t('aiBudget.diagnostic.notEnabled')}
                </p>
              )}
              {checkResult.exempt && (
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>
                    {t('aiBudget.diagnostic.exempt')}:{' '}
                    {t(`aiBudget.diagnostic.exemptReasons.${checkResult.exempt_reason}`)}
                  </span>
                </div>
              )}
            </div>

            {/* Block detail */}
            {!checkResult.allowed && checkResult.block_rule_id && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  {t('aiBudget.diagnostic.blockDetail')}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 rounded-lg p-3">
                  <div>
                    <span className="text-muted-foreground">
                      {t('aiBudget.diagnostic.blockRule')}:
                    </span>{' '}
                    {checkResult.block_scope_label}
                  </div>
                  {checkResult.block_window && (
                    <>
                      <div>
                        <span className="text-muted-foreground">
                          {t('aiBudget.diagnostic.blockWindow')}:
                        </span>{' '}
                        {checkResult.block_window.window}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t('aiBudget.rules.usage.limit')}:
                        </span>{' '}
                        {formatTokens(checkResult.block_window.limit)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t('aiBudget.rules.usage.used')}:
                        </span>{' '}
                        {formatTokens(checkResult.block_window.used)}
                      </div>
                      {checkResult.block_window.reset_at && (
                        <div>
                          <span className="text-muted-foreground">
                            {t('aiBudget.rules.usage.resetAt')}:
                          </span>{' '}
                          {formatTimestamp(checkResult.block_window.reset_at)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* All rule statuses */}
            {checkResult.rule_statuses.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{t('aiBudget.diagnostic.ruleStatuses')}</h4>
                <div className="space-y-3">
                  {checkResult.rule_statuses.map((rs) => (
                    <div
                      key={rs.rule_id}
                      className={cn(
                        'rounded-lg p-3 border',
                        rs.blocked ? 'border-red-500/30 bg-red-500/5' : 'border-border',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {rs.blocked ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        )}
                        <span className="text-sm font-medium">{rs.scope_label}</span>
                        <Badge variant="outline" className="text-xs">
                          {t(`aiBudget.rules.scopeTypes.${rs.scope_type}`)}
                        </Badge>
                      </div>
                      {rs.windows.map((w) => (
                        <WindowProgressBar key={w.window} window={w} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Reset */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            {t('aiBudget.diagnostic.resetTitle')}
          </CardTitle>
          <CardDescription>{t('aiBudget.diagnostic.resetDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('aiBudget.diagnostic.resetScopeType')}</Label>
              <Select value={resetScopeType} onValueChange={setResetScopeType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {resetScopeType !== 'global' && (
              <div className="space-y-2">
                <Label>{t('aiBudget.diagnostic.resetScopeId')}</Label>
                <Input
                  value={resetScopeId}
                  onChange={(e) => setResetScopeId(e.target.value)}
                  className="h-9"
                />
              </div>
            )}
            {resetScopeType === 'member' && (
              <div className="space-y-2">
                <Label>{t('aiBudget.diagnostic.resetMemberId')}</Label>
                <Input
                  value={resetMemberId}
                  onChange={(e) => setResetMemberId(e.target.value)}
                  className="h-9"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('aiBudget.diagnostic.resetBotId')}</Label>
              <Input
                value={resetBotId}
                onChange={(e) => setResetBotId(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('aiBudget.diagnostic.resetWindow')}</Label>
              <Select value={resetWindow} onValueChange={setResetWindow}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {windowOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={() => setResetConfirmOpen(true)}
              disabled={resetting}
            >
              {resetting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {t('aiBudget.diagnostic.resetBtn')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Confirm */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiBudget.diagnostic.resetBtn')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiBudget.diagnostic.resetConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('aiBudget.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-red-500 hover:bg-red-600">
              {t('aiBudget.common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
