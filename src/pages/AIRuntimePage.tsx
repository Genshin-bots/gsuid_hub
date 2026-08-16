/**
 * /ai-runtime — Agent 套件槽 / Hook / 关系温度 / 认知索引
 *
 * 后端：agent_kits_api.py
 * 四个接口全是 GET。密封槽空占用必须红字。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  Globe,
  Heart,
  Layers,
  Loader2,
  Puzzle,
  RefreshCw,
  ScanSearch,
  Search,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CognitionAttachments } from '@/components/cognition/CognitionAttachments';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  agentKitsApi,
  cognitionApi,
  getApiErrorMessage,
  relationshipApi,
  type AgentHookPointInfo,
  type AgentKitSlot,
  type CognitionNode,
  type CognitionRebuildMountData,
  type RelationshipViewData,
} from '@/lib/api';
import {
  isCognitionBackendMissing,
  isWorldHub,
  nodeHref,
  pluginFromWorldRef,
} from '@/lib/cognition';

type TabId = 'slots' | 'hooks' | 'relationship' | 'cognition';

const TAB_IDS: TabId[] = ['slots', 'hooks', 'relationship', 'cognition'];

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as string[]).includes(value);
}

function isBackendMissing(err: unknown): boolean {
  return isCognitionBackendMissing(err) || /404/.test(err instanceof Error ? err.message : String(err));
}

function formatUnix(ts: number | undefined, empty: string): string {
  if (!ts) return empty;
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return empty;
  return date.toLocaleString();
}

function zoneBadgeVariant(
  zone: string,
): 'destructive' | 'secondary' | 'outline' | 'default' {
  if (zone === 'hostile' || zone === 'cold') return 'destructive';
  if (zone === 'distant') return 'secondary';
  if (zone === 'acquaintance') return 'outline';
  return 'default';
}

function handleHref(node: CognitionNode): string | null {
  return nodeHref(node);
}

export default function AIRuntimePage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const tab: TabId = isTabId(tabFromUrl) ? tabFromUrl : 'slots';

  const setTab = (next: TabId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  };

  const tabs = useMemo(
    () => [
      { value: 'slots', label: t('aiRuntime.tabs.slots'), icon: <Puzzle className="w-4 h-4" /> },
      { value: 'hooks', label: t('aiRuntime.tabs.hooks'), icon: <Unplug className="w-4 h-4" /> },
      {
        value: 'relationship',
        label: t('aiRuntime.tabs.relationship'),
        icon: <Heart className="w-4 h-4" />,
      },
      {
        value: 'cognition',
        label: t('aiRuntime.tabs.cognition'),
        icon: <ScanSearch className="w-4 h-4" />,
      },
    ],
    [t],
  );

  return (
    <PinnedPage
      className="gap-6"
      header={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Puzzle className="w-8 h-8 shrink-0" />
              {t('aiRuntime.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('aiRuntime.description')}</p>
          </div>
        </div>
      }
      toolbar={
        <TabButtonGroup
          options={tabs}
          value={tab}
          onValueChange={(v) => setTab(v as TabId)}
          className="w-full max-w-full"
        />
      }
    >
      {tab === 'slots' && <SlotsPanel />}
      {tab === 'hooks' && <HooksPanel />}
      {tab === 'relationship' && <RelationshipPanel />}
      {tab === 'cognition' && <CognitionPanel />}
    </PinnedPage>
  );
}

function MissingBackendCard() {
  const { t } = useLanguage();
  return (
    <Card className="glass-card">
      <CardContent className="p-6 text-sm text-muted-foreground">
        {t('aiRuntime.backendTooOld')}
      </CardContent>
    </Card>
  );
}

function SlotsPanel() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [slots, setSlots] = useState<AgentKitSlot[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const data = await agentKitsApi.getSlots();
      setSlots(data.slots ?? []);
    } catch (e) {
      if (isBackendMissing(e)) {
        console.warn('[AIRuntimePage] /api/agent_kits/slots 不可用：请升级 gsuid_core。', e);
        setMissing(true);
        setSlots([]);
      } else {
        toast.error(getApiErrorMessage(e, t('aiRuntime.loadFailed')));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sealedEmpty = slots.filter((s) => s.sealed && s.occupants.length === 0);
  const unhealthy = slots.filter((s) => !s.healthy);

  if (missing) return <MissingBackendCard />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant="secondary" className="max-w-full whitespace-normal">
            {t('aiRuntime.slots.count', { count: slots.length })}
          </Badge>
          {sealedEmpty.length > 0 && (
            <Badge variant="destructive" className="max-w-full whitespace-normal">
              {t('aiRuntime.slots.sealedEmptyCount', { count: sealedEmpty.length })}
            </Badge>
          )}
          {unhealthy.length > 0 && (
            <Badge variant="outline" className="max-w-full whitespace-normal">
              {t('aiRuntime.slots.unhealthyCount', { count: unhealthy.length })}
            </Badge>
          )}
        </div>
        <Button className="h-9 shrink-0 self-start sm:self-auto" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          {t('common.refresh')}
        </Button>
      </div>

      {sealedEmpty.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{t('aiRuntime.slots.sealedEmptyHint')}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-card-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t('aiRuntime.slots.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="glass-card-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => {
            const sealedEmptySlot = slot.sealed && slot.occupants.length === 0;
            return (
              <Card
                key={slot.name}
                className={cn(
                  'glass-card',
                  sealedEmptySlot && 'border-destructive/50',
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="font-mono text-sm truncate">{slot.name}</span>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {slot.sealed && (
                        <Badge
                          variant="destructive"
                          className="max-w-full whitespace-normal"
                        >
                          {t('aiRuntime.slots.sealed')}
                        </Badge>
                      )}
                      {!slot.healthy && (
                        <Badge variant="outline" className="max-w-full whitespace-normal">
                          {t('aiRuntime.slots.unhealthy')}
                        </Badge>
                      )}
                      {slot.occupants.length === 0 && (
                        <Badge
                          variant={slot.sealed ? 'destructive' : 'secondary'}
                          className="max-w-full whitespace-normal"
                        >
                          {t('aiRuntime.slots.off')}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                  <CardDescription>{slot.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-muted-foreground">
                    {t('aiRuntime.slots.defaultKit')}:{' '}
                    <span className="font-mono text-foreground">{slot.default_kit_id}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {t('aiRuntime.slots.configured')}:{' '}
                    <span className="font-mono text-foreground">
                      {slot.configured.length > 0
                        ? slot.configured.join(', ')
                        : t('aiRuntime.slots.none')}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {t('aiRuntime.slots.occupants')}:{' '}
                    <span className="font-mono text-foreground">
                      {slot.occupants.length > 0
                        ? slot.occupants.join(', ')
                        : t('aiRuntime.slots.none')}
                    </span>
                  </div>
                  {slot.exclusive && (
                    <p className="text-xs text-muted-foreground">
                      {t('aiRuntime.slots.exclusive')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HooksPanel() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [total, setTotal] = useState(0);
  const [points, setPoints] = useState<AgentHookPointInfo[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const data = await agentKitsApi.getHooks();
      setEnabled(Boolean(data.enabled));
      setTotal(data.total_hooks ?? 0);
      setPoints(data.points ?? []);
    } catch (e) {
      if (isBackendMissing(e)) {
        console.warn('[AIRuntimePage] /api/agent_kits/hooks 不可用：请升级 gsuid_core。', e);
        setMissing(true);
        setPoints([]);
      } else {
        toast.error(getApiErrorMessage(e, t('aiRuntime.loadFailed')));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (missing) return <MissingBackendCard />;

  const wiredEmpty = points.filter((p) => p.wired && p.owners.length === 0);
  const unwired = points.filter((p) => !p.wired);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Badge
            variant={enabled ? 'default' : 'destructive'}
            className="max-w-full whitespace-normal"
          >
            {enabled ? t('aiRuntime.hooks.enabled') : t('aiRuntime.hooks.disabled')}
          </Badge>
          <Badge variant="secondary" className="max-w-full whitespace-normal">
            {t('aiRuntime.hooks.total', { count: total })}
          </Badge>
          <Badge variant="outline" className="max-w-full whitespace-normal">
            {t('aiRuntime.hooks.wiredEmpty', { count: wiredEmpty.length })}
          </Badge>
          <Badge variant="outline" className="max-w-full whitespace-normal">
            {t('aiRuntime.hooks.unwiredCount', { count: unwired.length })}
          </Badge>
        </div>
        <Button className="h-9 shrink-0 self-start sm:self-auto" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          {t('common.refresh')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('aiRuntime.hooks.hint')}</p>

      <Card className="glass-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : points.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t('aiRuntime.hooks.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('aiRuntime.hooks.colName')}</TableHead>
                    <TableHead>{t('aiRuntime.hooks.colWired')}</TableHead>
                    <TableHead>{t('aiRuntime.hooks.colOwners')}</TableHead>
                    <TableHead>{t('aiRuntime.hooks.colTimeout')}</TableHead>
                    <TableHead>{t('aiRuntime.hooks.colAnchor')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {points.map((point) => (
                    <TableRow key={point.id}>
                      <TableCell>
                        <div className="font-mono text-xs">{point.name}</div>
                        {point.capabilities.length > 0 && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {point.capabilities.join(', ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {point.wired ? (
                          <Badge variant="default">{t('aiRuntime.hooks.wired')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('aiRuntime.hooks.unwired')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {point.owners.length > 0
                          ? point.owners.join(', ')
                          : point.wired
                            ? t('aiRuntime.hooks.noOwner')
                            : t('aiRuntime.hooks.notFired')}
                      </TableCell>
                      <TableCell className="text-xs">{point.default_timeout_ms}ms</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {point.anchor}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RelationshipPanel() {
  const { t } = useLanguage();
  const [userId, setUserId] = useState('');
  const [botId, setBotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState<RelationshipViewData | null>(null);

  const lookup = async () => {
    const uid = userId.trim();
    if (!uid) {
      toast.error(t('aiRuntime.relationship.userRequired'));
      return;
    }
    setLoading(true);
    setMissing(false);
    try {
      const data = await relationshipApi.getView({
        user_id: uid,
        bot_id: botId.trim() || undefined,
      });
      setView(data);
    } catch (e) {
      if (isBackendMissing(e)) {
        console.warn('[AIRuntimePage] /api/relationship/view 不可用：请升级 gsuid_core。', e);
        setMissing(true);
        setView(null);
      } else {
        toast.error(getApiErrorMessage(e, t('aiRuntime.loadFailed')));
      }
    } finally {
      setLoading(false);
    }
  };

  if (missing) return <MissingBackendCard />;

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            {t('aiRuntime.relationship.title')}
          </CardTitle>
          <CardDescription>{t('aiRuntime.relationship.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="rel-user">{t('aiRuntime.relationship.userId')}</Label>
              <Input
                id="rel-user"
                className="h-9 font-mono"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void lookup();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rel-bot">{t('aiRuntime.relationship.botId')}</Label>
              <Input
                id="rel-bot"
                className="h-9 font-mono"
                value={botId}
                onChange={(e) => setBotId(e.target.value)}
                placeholder={t('aiRuntime.relationship.botPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void lookup();
                }}
              />
            </div>
          </div>
          <Button className="h-9" onClick={() => void lookup()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t('aiRuntime.relationship.lookup')}
          </Button>
        </CardContent>
      </Card>

      {view && !view.scored && (
        <Card className="glass-card">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t('aiRuntime.relationship.unscored', { user: view.user_id })}
          </CardContent>
        </Card>
      )}

      {view && view.scored && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-mono text-base">{view.user_id}</span>
              <Badge
                variant={zoneBadgeVariant(view.zone)}
                className="max-w-full whitespace-normal shrink-0"
              >
                {view.zone_label} · {view.zone}
              </Badge>
            </CardTitle>
            <CardDescription>{view.line}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <Field label={t('aiRuntime.relationship.score')} value={String(view.score ?? '—')} hint={t('aiRuntime.relationship.scoreHint')} />
            <Field label={t('aiRuntime.relationship.lastReason')} value={view.last_reason || t('aiRuntime.relationship.none')} />
            <Field
              label={t('aiRuntime.relationship.lastDelta')}
              value={view.last_delta !== undefined ? String(view.last_delta) : '—'}
            />
            <Field
              label={t('aiRuntime.relationship.lastEval')}
              value={formatUnix(view.last_eval_at, t('aiRuntime.relationship.none'))}
            />
            <Field
              label={t('aiRuntime.relationship.daily')}
              value={`${t('aiRuntime.relationship.gain')} ${view.daily_gain ?? 0} / ${t('aiRuntime.relationship.loss')} ${view.daily_loss ?? 0}`}
            />
            <Field label={t('aiRuntime.relationship.dailyYmd')} value={view.daily_ymd || t('aiRuntime.relationship.none')} />
            <Field
              label={t('aiRuntime.relationship.lastPositive')}
              value={formatUnix(view.last_positive_interact_at, t('aiRuntime.relationship.none'))}
            />
            <Field
              label={t('aiRuntime.relationship.interactions')}
              value={String(view.interaction_count ?? 0)}
            />
            <Field
              label={t('aiRuntime.relationship.botId')}
              value={view.bot_id || t('aiRuntime.relationship.none')}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium break-all">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CognitionPanel() {
  const { t } = useLanguage();
  const [keyword, setKeyword] = useState('');
  const [scopeKey, setScopeKey] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'world' | 'env'>('all');
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildOpen, setRebuildOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const [nodes, setNodes] = useState<CognitionNode[] | null>(null);

  const search = async () => {
    setLoading(true);
    setMissing(false);
    try {
      const data = await cognitionApi.getNodes({
        keyword: keyword.trim() || undefined,
        scope_key: scopeKey.trim() || undefined,
        owner_user_id: ownerUserId.trim() || undefined,
        limit: 100,
      });
      setNodes(data.nodes ?? []);
    } catch (e) {
      if (isBackendMissing(e)) {
        console.warn('[AIRuntimePage] /api/cognition/nodes 不可用：请升级 gsuid_core。', e);
        setMissing(true);
        setNodes(null);
      } else {
        toast.error(getApiErrorMessage(e, t('aiRuntime.loadFailed')));
      }
    } finally {
      setLoading(false);
    }
  };

  const rebuild = async () => {
    setRebuilding(true);
    try {
      const stats: CognitionRebuildMountData = await cognitionApi.rebuildMount();
      toast.success(
        t('aiRuntime.cognition.rebuildDone', {
          hubs: stats.hubs,
          attachments: stats.attachments,
          linked: stats.linked_env,
        }),
      );
      if (stats.last_error) {
        toast.warning(stats.last_error);
      }
      setRebuildOpen(false);
      await search();
    } catch (e) {
      if (isBackendMissing(e)) {
        console.warn('[AIRuntimePage] /api/cognition/rebuild_mount 不可用：请升级 gsuid_core。', e);
        toast.error(t('aiRuntime.backendTooOld'));
      } else {
        toast.error(getApiErrorMessage(e, t('aiRuntime.cognition.rebuildFailed')));
      }
    } finally {
      setRebuilding(false);
    }
  };

  const visibleNodes = (nodes ?? []).filter((node) => {
    if (kindFilter === 'world') return isWorldHub(node);
    if (kindFilter === 'env') return !isWorldHub(node);
    return true;
  });

  if (missing) return <MissingBackendCard />;

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanSearch className="w-5 h-5" />
            {t('aiRuntime.cognition.title')}
          </CardTitle>
          <CardDescription>{t('aiRuntime.cognition.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="cog-kw">{t('aiRuntime.cognition.keyword')}</Label>
              <Input
                id="cog-kw"
                className="h-9"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void search();
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cog-scope">{t('aiRuntime.cognition.scopeKey')}</Label>
              <Input
                id="cog-scope"
                className="h-9 font-mono"
                value={scopeKey}
                onChange={(e) => setScopeKey(e.target.value)}
                placeholder={t('aiRuntime.cognition.scopePlaceholder')}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cog-owner">{t('aiRuntime.cognition.owner')}</Label>
              <Input
                id="cog-owner"
                className="h-9 font-mono"
                value={ownerUserId}
                onChange={(e) => setOwnerUserId(e.target.value)}
              />
            </div>
          </div>
          {!ownerUserId.trim() && (
            <p className="text-xs text-muted-foreground">{t('aiRuntime.cognition.aclHint')}</p>
          )}
          <p className="text-xs text-muted-foreground">{t('aiRuntime.cognition.worldHint')}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button className="h-9" onClick={() => void search()} disabled={loading || rebuilding}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {t('common.search')}
            </Button>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setRebuildOpen(true)}
              disabled={loading || rebuilding}
            >
              {rebuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {t('aiRuntime.cognition.rebuild')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {nodes && (
        <TabButtonGroup
          value={kindFilter}
          onValueChange={(v) => setKindFilter(v as typeof kindFilter)}
          className="w-full max-w-full"
          options={[
            { value: 'all', label: t('aiRuntime.cognition.filterAll'), icon: <Layers className="w-4 h-4" /> },
            { value: 'world', label: t('aiRuntime.cognition.filterWorld'), icon: <Globe className="w-4 h-4" /> },
            { value: 'env', label: t('aiRuntime.cognition.filterEnv'), icon: <Boxes className="w-4 h-4" /> },
          ]}
        />
      )}

      {nodes && visibleNodes.length === 0 && (
        <Card className="glass-card">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t('aiRuntime.cognition.empty')}
          </CardContent>
        </Card>
      )}

      {visibleNodes.length > 0 && (
        <div className="space-y-3">
          {visibleNodes.map((node) => {
            const href = handleHref(node);
            const world = isWorldHub(node);
            const plugin = world ? pluginFromWorldRef(node.ref) : '';
            const attachments = node.attachments ?? [];
            return (
              <Card key={`${node.kind}-${node.ref}-${node.id ?? ''}`} className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-base">
                    <span className="truncate">{node.title || node.ref}</span>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {world && (
                        <Badge className="max-w-full whitespace-normal">
                          <Globe className="w-3 h-3 mr-1" />
                          {t('aiRuntime.cognition.worldBadge')}
                        </Badge>
                      )}
                      <Badge variant="outline" className="max-w-full whitespace-normal">
                        {node.kind}
                      </Badge>
                      {attachments.length > 0 && (
                        <Badge variant="secondary" className="max-w-full whitespace-normal">
                          {t('aiRuntime.cognition.articleCount', { count: attachments.length })}
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs break-all">
                    {node.scope_key || t('aiRuntime.cognition.publicScope')}
                    {node.owner_user_id ? ` · owner=${node.owner_user_id}` : ''}
                    {plugin ? ` · plugin=${plugin}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {node.summary && (
                    <p className="text-muted-foreground whitespace-pre-wrap break-words">
                      {node.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {node.as_of && <span>as_of={node.as_of}</span>}
                    {node.source && <span>source={node.source}</span>}
                    <span>decay={node.decay}</span>
                    {node.handle && <span className="font-mono break-all">handle={node.handle}</span>}
                    {node.canon && (
                      <span className="font-mono break-all">
                        {t('aiRuntime.cognition.canon')}= {node.canon}
                      </span>
                    )}
                    <span className="font-mono break-all">ref={node.ref}</span>
                  </div>
                  {href && (
                    <Button variant="outline" size="sm" className="h-8" asChild>
                      <Link to={href}>{t('aiRuntime.cognition.openBody')}</Link>
                    </Button>
                  )}
                  {(world || attachments.length > 0) && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium">{t('aiRuntime.cognition.attachments')}</p>
                      <CognitionAttachments
                        attachments={attachments}
                        emptyText={t('aiRuntime.cognition.noAttachments')}
                        openLabel={t('aiRuntime.cognition.openArticle')}
                        writableLabel={t('aiRuntime.cognition.writable')}
                        readonlyLabel={t('aiRuntime.cognition.readonly')}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={rebuildOpen} onOpenChange={setRebuildOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiRuntime.cognition.rebuild')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiRuntime.cognition.rebuildHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rebuilding}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void rebuild()} disabled={rebuilding}>
              {rebuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
