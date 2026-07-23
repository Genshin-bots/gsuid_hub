/**
 * AI 运维诊断中心 — 只保留「别处没有、排障真用得上」的能力：
 *
 * 顶栏状态：Bot 在线 / 存活 Session / 续聊窗口（可展开明细）
 * Tab：触发回放 · 黑白名单 · 输出试跑 · 安全策略 · 配置快照
 *
 * 已下线 UI（API 仍保留，见 docs）：工具拓扑 / 意图 / 生命周期 / 多模态 / 插件诊断
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  ChevronDown,
  Download,
  Flame,
  Loader2,
  Play,
  RefreshCw,
  Route,
  Save,
  Shield,
  Upload,
  Users,
  Wrench,
  Package,
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TagsInput } from '@/components/config/TagsInput';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getApiErrorMessage, opsApi } from '@/lib/api';
import {
  botConnectionSummary,
  downloadJsonFilename,
  oocHitLabel,
  sessionIdleBucket,
  summarizeTriggerReplay,
  validateSnapshotImport,
} from '@/lib/featureUtils';

type TabId = 'trigger' | 'access' | 'output' | 'security' | 'snapshot';
type DetailKind = 'bots' | 'sessions' | 'followup' | null;

export default function AIOpsPage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const [tab, setTab] = useState<TabId>('trigger');

  const tabs = useMemo(
    () => [
      { value: 'trigger', label: t('aiOps.tabs.trigger'), icon: <Route className="w-4 h-4" /> },
      { value: 'access', label: t('aiOps.tabs.access'), icon: <Shield className="w-4 h-4" /> },
      { value: 'output', label: t('aiOps.tabs.output'), icon: <Wrench className="w-4 h-4" /> },
      { value: 'security', label: t('aiOps.tabs.security'), icon: <Flame className="w-4 h-4" /> },
      { value: 'snapshot', label: t('aiOps.tabs.snapshot'), icon: <Package className="w-4 h-4" /> },
    ],
    [t],
  );

  return (
    <PinnedPage
      header={
        <div className="min-w-0 overflow-x-auto">
          <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <Activity className="w-8 h-8 shrink-0" />
            {t('aiOps.title')}
          </h1>
          <p className="whitespace-nowrap text-muted-foreground mt-1">{t('aiOps.description')}</p>
        </div>
      }
      className={cn(isGlass && 'glass-page')}
    >
      <div className="space-y-4 px-0 pb-6">
        <RuntimeStatusBar />
        <TabButtonGroup
          options={tabs}
          value={tab}
          onValueChange={(v) => setTab(v as TabId)}
          className="w-full max-w-full"
        />
        {tab === 'trigger' && <TriggerPanel />}
        {tab === 'access' && <AccessPanel />}
        {tab === 'output' && <OutputPanel />}
        {tab === 'security' && <SecurityPanel />}
        {tab === 'snapshot' && <SnapshotPanel />}
      </div>
    </PinnedPage>
  );
}

function PanelCard({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-border/50">
      <CardHeader className="py-3 flex flex-row items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <p className="text-xs text-muted-foreground font-normal">{description}</p>
          ) : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** 顶栏：Bot / Session / 续聊 摘要；点击展开明细（不再占独立 Tab）。 */
function RuntimeStatusBar() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DetailKind>(null);
  const [bots, setBots] = useState<
    Array<{ ws_bot_id: string; bot_id: string; connected: boolean }>
  >([]);
  const [sessions, setSessions] = useState<Awaited<
    ReturnType<typeof opsApi.getSessions>
  > | null>(null);
  const [followup, setFollowup] = useState<Awaited<
    ReturnType<typeof opsApi.getFollowup>
  > | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s, f] = await Promise.all([
        opsApi.getBots(),
        opsApi.getSessions(),
        opsApi.getFollowup(),
      ]);
      setBots(b.items ?? []);
      setSessions(s);
      setFollowup(f);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const botSummary = botConnectionSummary(bots);
  const sessionCount = sessions?.count ?? 0;
  const followupCount = followup?.active_count ?? 0;

  const toggle = (kind: Exclude<DetailKind, null>) => {
    setDetail((prev) => (prev === kind ? null : kind));
  };

  return (
    <Card className="border border-border/50">
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggle('bots')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              detail === 'bots'
                ? 'border-primary/50 bg-primary/10'
                : 'border-border/50 hover:bg-muted/40',
            )}
          >
            <Bot className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{t('aiOps.status.bots')}</span>
            {loading ? (
              <Skeleton className="h-4 w-10" />
            ) : (
              <Badge variant={botSummary.offline ? 'destructive' : 'default'}>
                {botSummary.connected}/{botSummary.total}
              </Badge>
            )}
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-muted-foreground transition-transform',
                detail === 'bots' && 'rotate-180',
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => toggle('sessions')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              detail === 'sessions'
                ? 'border-primary/50 bg-primary/10'
                : 'border-border/50 hover:bg-muted/40',
            )}
          >
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{t('aiOps.status.sessions')}</span>
            {loading ? (
              <Skeleton className="h-4 w-8" />
            ) : (
              <Badge variant="secondary">{sessionCount}</Badge>
            )}
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-muted-foreground transition-transform',
                detail === 'sessions' && 'rotate-180',
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => toggle('followup')}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              detail === 'followup'
                ? 'border-primary/50 bg-primary/10'
                : 'border-border/50 hover:bg-muted/40',
            )}
          >
            <ScrollText className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{t('aiOps.status.followup')}</span>
            {loading ? (
              <Skeleton className="h-4 w-8" />
            ) : (
              <Badge variant={followupCount > 0 ? 'default' : 'outline'}>{followupCount}</Badge>
            )}
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-muted-foreground transition-transform',
                detail === 'followup' && 'rotate-180',
              )}
            />
          </button>

          <Button
            variant="outline"
            className="h-9 ml-auto"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {t('aiOps.status.refresh')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t('aiOps.status.hint')}</p>

        {detail === 'bots' && (
          <div className="rounded-md border border-border/40 p-3 space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">
                {t('aiOps.bots.total')}: {botSummary.total}
              </Badge>
              <Badge variant="default">
                {t('aiOps.bots.connected')}: {botSummary.connected}
              </Badge>
              <Badge variant={botSummary.offline ? 'destructive' : 'outline'}>
                {t('aiOps.bots.offline')}: {botSummary.offline}
              </Badge>
            </div>
            {bots.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('aiOps.bots.empty')}</p>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-1 pr-2">
                  {bots.map((b) => (
                    <div
                      key={b.ws_bot_id}
                      className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">{b.ws_bot_id}</div>
                        <div className="text-xs text-muted-foreground">bot_id: {b.bot_id}</div>
                      </div>
                      <Badge variant={b.connected ? 'default' : 'secondary'}>
                        {b.connected ? t('aiOps.bots.online') : t('aiOps.bots.offline')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {detail === 'sessions' && sessions && (
          <div className="rounded-md border border-border/40 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              {t('aiOps.sessions.count', { count: sessions.count })} · idle≤
              {sessions.idle_threshold}s · hist≤{sessions.max_ai_history}
            </p>
            {sessions.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('aiOps.sessions.empty')}</p>
            ) : (
              <ScrollArea className="h-[220px]">
                <div className="space-y-1 pr-2">
                  {sessions.items.map((s) => {
                    const bucket = sessionIdleBucket(s.idle_seconds, sessions.idle_threshold);
                    return (
                      <div
                        key={s.session_id}
                        className="rounded-md border border-border/40 px-3 py-2 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs break-all">{s.session_id}</span>
                          <Badge
                            variant={
                              bucket === 'active'
                                ? 'default'
                                : bucket === 'idle'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {t(`aiOps.sessions.${bucket}`)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                          <span>persona: {s.persona_name || '—'}</span>
                          <span>hist: {s.history_length}</span>
                          <span>
                            idle:{' '}
                            {s.idle_seconds != null ? `${Math.round(s.idle_seconds)}s` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {detail === 'followup' && followup && (
          <div className="rounded-md border border-border/40 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              window={followup.window_seconds}s · ceiling={followup.max_total_seconds}s · active=
              {followup.active_count}
            </p>
            {followup.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('aiOps.followup.empty')}</p>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-1 pr-2">
                  {followup.items.map((it) => (
                    <div
                      key={`${it.session_id}-${it.user_id}`}
                      className="rounded border border-border/40 px-2 py-1.5 text-xs space-y-0.5"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-mono break-all">{it.session_id}</span>
                        <Badge variant={it.active ? 'default' : 'secondary'}>
                          {it.active ? 'active' : 'expired'}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        user={it.user_id} · remain_window={it.remaining_window}s · remain_ceiling=
                        {it.remaining_ceiling}s
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TriggerPanel() {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [userId, setUserId] = useState('ops_user');
  const [groupId, setGroupId] = useState('ops_group');
  const [isTome, setIsTome] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof opsApi.triggerReplay>> | null>(
    null,
  );

  const run = async () => {
    setLoading(true);
    try {
      setResult(
        await opsApi.triggerReplay({
          text,
          user_id: userId,
          group_id: isPrivate ? null : groupId,
          is_tome: isTome,
          is_private: isPrivate,
        }),
      );
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.trigger.failed')));
    } finally {
      setLoading(false);
    }
  };

  const summary = result ? summarizeTriggerReplay(result) : null;

  return (
    <PanelCard title={t('aiOps.trigger.title')} description={t('aiOps.trigger.desc')}>
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>user_id</Label>
            <Input className="h-9" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>group_id</Label>
            <Input
              className="h-9"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={isPrivate}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={isTome} onCheckedChange={setIsTome} id="is-tome" />
            <Label htmlFor="is-tome">is_tome / @bot</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} id="is-private" />
            <Label htmlFor="is-private">private</Label>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('aiOps.trigger.placeholder')}
          rows={3}
        />
        <Button className="h-9" onClick={() => void run()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {t('aiOps.trigger.run')}
        </Button>
        {result && summary && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge>{t(`aiOps.trigger.${summary.labelKey}`)}</Badge>
              {result.trigger_type && (
                <Badge variant="outline">trigger={result.trigger_type}</Badge>
              )}
              {result.persona_name && (
                <Badge variant="secondary">persona={result.persona_name}</Badge>
              )}
            </div>
            <div className="space-y-1">
              {(result.steps || []).map((s, i) => (
                <div
                  key={`${s.step}-${i}`}
                  className={cn(
                    'rounded border px-2 py-1 text-xs',
                    s.pass ? 'border-border/40' : 'border-destructive/50 bg-destructive/5',
                  )}
                >
                  <span className="font-medium">{s.step}</span> {s.pass ? '✓' : '✗'}
                  <pre className="mt-1 whitespace-pre-wrap break-all text-muted-foreground">
                    {typeof s.detail === 'string'
                      ? s.detail
                      : JSON.stringify(s.detail, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PanelCard>
  );
}

function AccessPanel() {
  const { t } = useLanguage();
  const [black, setBlack] = useState<string[]>([]);
  const [white, setWhite] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await opsApi.getAccess();
      setBlack(data.black_list ?? []);
      setWhite(data.white_list ?? []);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await opsApi.setAccess({ black_list: black, white_list: white });
      setBlack(data.black_list ?? []);
      setWhite(data.white_list ?? []);
      toast.success(t('aiOps.saved'));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelCard
      title={t('aiOps.access.title')}
      description={t('aiOps.access.desc')}
      actions={
        <Button className="h-9" onClick={() => void save()} disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save')}
        </Button>
      }
    >
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('aiOps.access.blackList')}</Label>
            <p className="text-xs text-muted-foreground">{t('aiOps.access.blackHint')}</p>
            <TagsInput value={black} onChange={setBlack} placeholder="user_id / group_id" />
          </div>
          <div className="space-y-2">
            <Label>{t('aiOps.access.whiteList')}</Label>
            <p className="text-xs text-muted-foreground">{t('aiOps.access.whiteHint')}</p>
            <TagsInput value={white} onChange={setWhite} placeholder="user_id / group_id" />
          </div>
        </div>
      )}
    </PanelCard>
  );
}

function OutputPanel() {
  const { t } = useLanguage();
  const [text, setText] = useState('其实我是 GPT-4 啦<br><br>res_abc123 自己看');
  const [userText, setUserText] = useState('你是什么模型？');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof opsApi.outputPreview>> | null>(
    null,
  );

  const run = async () => {
    setLoading(true);
    try {
      setResult(await opsApi.outputPreview({ text, user_text: userText, tier: 'roleplay' }));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.output.failed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelCard title={t('aiOps.output.title')} description={t('aiOps.output.desc')}>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>{t('aiOps.output.userText')}</Label>
          <Input className="h-9" value={userText} onChange={(e) => setUserText(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{t('aiOps.output.aiText')}</Label>
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button className="h-9" onClick={() => void run()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {t('aiOps.output.run')}
        </Button>
        {result && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant={result.firewall_enabled ? 'default' : 'secondary'}>
                firewall={result.firewall_enabled ? 'on' : 'off'}
              </Badge>
              <Badge variant={result.ooc_hit ? 'destructive' : 'outline'}>
                ooc={oocHitLabel(result.ooc_hit)}
              </Badge>
            </div>
            {Object.entries(result.stages || {}).map(([k, v]) => (
              <div key={k} className="rounded border border-border/40 p-2">
                <div className="text-xs text-muted-foreground mb-1">{k}</div>
                <pre className="whitespace-pre-wrap break-all text-xs">{v || '—'}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelCard>
  );
}

/** 仅保留与「进 AI / 出口内容」直接相关的策略；其余配置仍在 /ai-config。 */
function SecurityPanel() {
  const { t } = useLanguage();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setValues((await opsApi.getSecurityOutput()) ?? {});
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      setValues(await opsApi.setSecurityOutput(values));
      toast.success(t('aiOps.saved'));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const boolKeys = ['content_guard_enable', 'output_firewall_enable'] as const;
  const listKeys = ['output_firewall_extra_terms', 'memory_sensitive_extra_terms'] as const;
  // 续聊窗口与触发/顶栏强相关，仍放在本页便于对照
  const numKeys = ['follow_up_window', 'follow_up_max_total'] as const;

  return (
    <PanelCard
      title={t('aiOps.security.title')}
      description={t('aiOps.security.desc')}
      actions={
        <Button className="h-9" onClick={() => void save()} disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save')}
        </Button>
      }
    >
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {boolKeys.map((k) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2"
              >
                <Label className="text-sm">{t(`aiOps.security.fields.${k}`)}</Label>
                <Switch
                  checked={Boolean(values[k])}
                  onCheckedChange={(v) => setValues((prev) => ({ ...prev, [k]: v }))}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {numKeys.map((k) => (
              <div key={k} className="space-y-1">
                <Label className="text-sm">{t(`aiOps.security.fields.${k}`)}</Label>
                <Input
                  className="h-9"
                  type="number"
                  value={Number(values[k] ?? 0)}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [k]: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            ))}
          </div>
          {listKeys.map((k) => {
            const raw = values[k];
            const list = Array.isArray(raw)
              ? (raw as string[])
              : typeof raw === 'string' && raw
                ? raw.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean)
                : [];
            return (
              <div key={k} className="space-y-1">
                <Label className="text-sm">{t(`aiOps.security.fields.${k}`)}</Label>
                <TagsInput
                  value={list}
                  onChange={(next) => setValues((prev) => ({ ...prev, [k]: next }))}
                />
              </div>
            );
          })}
          <Collapsible>
            <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ChevronDown className="w-3.5 h-3.5" />
              {t('aiOps.security.advancedHint')}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('aiOps.security.advancedBody')}
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </PanelCard>
  );
}

function SnapshotPanel() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [applyMemory, setApplyMemory] = useState(false);

  const exportSnap = async () => {
    setLoading(true);
    try {
      const snap = await opsApi.exportSnapshot();
      const text = JSON.stringify(snap, null, 2);
      setJsonText(text);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadJsonFilename('gsuid-config-snapshot');
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('aiOps.snapshot.exported'));
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.snapshot.exportFailed')));
    } finally {
      setLoading(false);
    }
  };

  const importSnap = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      toast.error(t('aiOps.snapshot.invalidJson'));
      return;
    }
    const v = validateSnapshotImport(parsed);
    if (!v.ok || !v.snapshot) {
      toast.error(t('aiOps.snapshot.invalidSnapshot'));
      return;
    }
    setImporting(true);
    try {
      const res = await opsApi.importSnapshot({
        snapshot: v.snapshot,
        apply_ai_config: true,
        apply_access: true,
        apply_security: true,
        apply_memory: applyMemory,
      });
      toast.success(
        t('aiOps.snapshot.imported', { count: res.applied_count ?? res.applied?.length ?? 0 }),
      );
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiOps.snapshot.importFailed')));
    } finally {
      setImporting(false);
    }
  };

  return (
    <PanelCard title={t('aiOps.snapshot.title')} description={t('aiOps.snapshot.desc')}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button className="h-9" onClick={() => void exportSnap()} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {t('aiOps.snapshot.export')}
          </Button>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => void importSnap()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {t('aiOps.snapshot.import')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={applyMemory} onCheckedChange={setApplyMemory} id="apply-mem" />
          <Label htmlFor="apply-mem">{t('aiOps.snapshot.applyMemory')}</Label>
        </div>
        <Textarea
          rows={12}
          className="font-mono text-xs"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder="{ ... snapshot json ... }"
        />
      </div>
    </PanelCard>
  );
}
