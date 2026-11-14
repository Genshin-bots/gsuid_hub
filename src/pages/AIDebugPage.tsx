/**
 * /ai-debug — 运维排查：运维诊断 / 装配预览 / 实体索引 / Agent 套件槽 / Hook / 认知索引 / 群画像
 *
 * 后端：agent_kits_api.py
 * 套件、花名册都是 GET。花名册只对管理员开放。密封槽空占用必须红字。
 * 关系温度已挪到 /ai-artifacts 的「关系温度」页签，本页不再涉及。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Globe,
  Layers,
  Loader2,
  Network,
  Puzzle,
  RefreshCw,
  ScanSearch,
  Search,
  Stethoscope,
  Unplug,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { pageGapClass, pageStackClass, PinnedPage } from '@/components/layout/PinnedPage';
import { TabButtonGroup, tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassAlert } from '@/components/ui/glass-alert';
import { CognitionAttachments } from '@/components/cognition/CognitionAttachments';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TruncatedText } from '@/components/ui/truncated-text';
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
  type AgentHookPointInfo,
  type AgentKitSlot,
  type CognitionNode,
  type CognitionRebuildMountData,
} from '@/lib/api';
import { GroupProfilePanel } from '@/pages/GroupProfilePage';
import { AIOpsPanel } from '@/pages/AIOpsPage';
import { AssemblePanel } from '@/pages/AIDebug/AssemblePanel';
import { EntityIndexPanel } from '@/pages/AIDebug/EntityIndexPanel';
import {
  isCognitionBackendMissing,
  isWorldHub,
  nodeHref,
  pluginFromWorldRef,
} from '@/lib/cognition';

type TabId = 'ops' | 'assemble' | 'entityIndex' | 'slots' | 'hooks' | 'cognition' | 'group';

const TAB_IDS: TabId[] = ['ops', 'assemble', 'entityIndex', 'slots', 'hooks', 'cognition', 'group'];

function isTabId(value: string | null): value is TabId {
  return value !== null && (TAB_IDS as string[]).includes(value);
}

function isBackendMissing(err: unknown): boolean {
  return (
    isCognitionBackendMissing(err) || /404/.test(err instanceof Error ? err.message : String(err))
  );
}

function handleHref(node: CognitionNode): string | null {
  return nodeHref(node);
}

export default function AIDebugPage() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const tab: TabId = isTabId(tabFromUrl) ? tabFromUrl : 'ops';
  const refreshRef = useRef<(() => void) | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  // slots 数量由 SlotsPanel 拉数后上报，挂在「套件槽」分段上（同插件商店 tab 计数）
  const [slotCount, setSlotCount] = useState<number | null>(null);
  const bindRefresh = useCallback((fn: (() => void) | null, loading: boolean) => {
    refreshRef.current = fn;
    setPanelLoading(loading);
  }, []);
  const showRefresh = tab === 'slots' || tab === 'hooks' || tab === 'group';

  const setTab = (next: TabId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  };

  const tabs = useMemo(
    () => [
      { value: 'ops', label: t('aiRuntime.tabs.ops'), icon: <Activity className="w-4 h-4" /> },
      {
        value: 'assemble',
        label: t('aiTools.tabs.assemble'),
        icon: <Boxes className="w-4 h-4" />,
      },
      {
        value: 'entityIndex',
        label: t('aiTools.tabs.entityIndex'),
        icon: <Network className="w-4 h-4" />,
      },
      {
        value: 'slots',
        label: t('aiRuntime.tabs.slots'),
        icon: <Puzzle className="w-4 h-4" />,
        badge:
          slotCount !== null ? <span className="tab-segment-count">{slotCount}</span> : undefined,
      },
      { value: 'hooks', label: t('aiRuntime.tabs.hooks'), icon: <Unplug className="w-4 h-4" /> },
      {
        value: 'cognition',
        label: t('aiRuntime.tabs.cognition'),
        icon: <ScanSearch className="w-4 h-4" />,
      },
      {
        value: 'group',
        label: t('aiRuntime.tabs.group'),
        icon: <Users className="w-4 h-4" />,
      },
    ],
    [t, slotCount],
  );

  return (
    <PinnedPage
      header={
        <div className="min-w-0">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Stethoscope className="w-8 h-8 shrink-0" />
            {t('aiRuntime.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('aiRuntime.description')}</p>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <TabButtonGroup
            options={tabs}
            value={tab}
            onValueChange={(v) => setTab(v as TabId)}
            className="w-full sm:w-max"
          />
          {showRefresh && (
            <Button
              variant="outline"
              className={cn(tabToolbarControlClass, 'shrink-0')}
              disabled={panelLoading}
              onClick={() => refreshRef.current?.()}
            >
              <RefreshCw className={cn('w-4 h-4', panelLoading && 'animate-spin')} />
              {t('common.refresh')}
            </Button>
          )}
        </div>
      }
    >
      {tab === 'ops' && <AIOpsPanel />}
      {tab === 'assemble' && <AssemblePanel />}
      {tab === 'entityIndex' && <EntityIndexPanel />}
      {tab === 'slots' && <SlotsPanel bindRefresh={bindRefresh} onCount={setSlotCount} />}
      {tab === 'hooks' && <HooksPanel bindRefresh={bindRefresh} />}
      {tab === 'cognition' && <CognitionPanel />}
      {tab === 'group' && <GroupProfilePanel bindRefresh={bindRefresh} />}
    </PinnedPage>
  );
}

function MissingBackendCard() {
  const { t } = useLanguage();
  return (
    <Card className="glass-card">
      <CardContent className="!p-6 text-sm text-muted-foreground">
        {t('aiRuntime.backendTooOld')}
      </CardContent>
    </Card>
  );
}

function SlotsPanel({
  bindRefresh,
  onCount,
}: {
  bindRefresh: (fn: (() => void) | null, loading: boolean) => void;
  onCount?: (count: number | null) => void;
}) {
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
      onCount?.(data.slots?.length ?? 0);
    } catch (e) {
      if (isBackendMissing(e)) {
        console.warn('[AIDebugPage] /api/agent_kits/slots 不可用：请升级 gsuid_core。', e);
        setMissing(true);
        setSlots([]);
        onCount?.(null);
      } else {
        toast.error(getApiErrorMessage(e, t('aiRuntime.loadFailed')));
      }
    } finally {
      setLoading(false);
    }
  }, [t, onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bindRefresh(() => {
      void load();
    }, loading);
    return () => bindRefresh(null, false);
  }, [bindRefresh, load, loading]);

  const sealedEmpty = slots.filter((s) => s.sealed && s.occupants.length === 0);
  const unhealthy = slots.filter((s) => !s.healthy);

  if (missing) return <MissingBackendCard />;

  return (
    <div className={pageStackClass}>
      {(sealedEmpty.length > 0 || unhealthy.length > 0) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
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
      )}

      {sealedEmpty.length > 0 && (
        <GlassAlert tone="danger" icon={AlertTriangle}>
          <span className="font-medium">{t('aiRuntime.slots.sealedEmptyHint')}</span>
        </GlassAlert>
      )}

      {loading ? (
        <div className={cn('glass-card-grid grid sm:grid-cols-2 lg:grid-cols-3', pageGapClass)}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="!p-6 text-sm text-muted-foreground">
            {t('aiRuntime.slots.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className={cn('glass-card-grid grid sm:grid-cols-2 lg:grid-cols-3', pageGapClass)}>
          {slots.map((slot) => {
            const sealedEmptySlot = slot.sealed && slot.occupants.length === 0;
            return (
              <Card
                key={slot.name}
                className={cn('glass-card', sealedEmptySlot && 'border-destructive/50')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="font-mono text-sm truncate">{slot.name}</span>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {slot.sealed && (
                        <Badge variant="destructive" className="max-w-full whitespace-normal">
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

function HooksPanel({
  bindRefresh,
}: {
  bindRefresh: (fn: (() => void) | null, loading: boolean) => void;
}) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [points, setPoints] = useState<AgentHookPointInfo[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const data = await agentKitsApi.getHooks();
      setPoints(data.points ?? []);
    } catch (e) {
      if (isBackendMissing(e)) {
        console.warn('[AIDebugPage] /api/agent_kits/hooks 不可用：请升级 gsuid_core。', e);
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

  useEffect(() => {
    bindRefresh(() => {
      void load();
    }, loading);
    return () => bindRefresh(null, false);
  }, [bindRefresh, load, loading]);

  if (missing) return <MissingBackendCard />;

  return (
    <div className={pageStackClass}>
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
                        <TruncatedText
                          text={point.name}
                          className="max-w-[28ch] font-mono text-xs"
                        />
                        {point.capabilities.length > 0 && (
                          <TruncatedText
                            text={point.capabilities.join(', ')}
                            className="mt-1 max-w-[28ch] text-[11px] text-muted-foreground"
                          />
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
                        <TruncatedText
                          text={
                            point.owners.length > 0
                              ? point.owners.join(', ')
                              : point.wired
                                ? t('aiRuntime.hooks.noOwner')
                                : t('aiRuntime.hooks.notFired')
                          }
                          className="max-w-[32ch]"
                        />
                      </TableCell>
                      <TableCell className="text-xs">{point.default_timeout_ms}ms</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        <TruncatedText text={point.anchor} className="max-w-[40ch]" />
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
        console.warn('[AIDebugPage] /api/cognition/nodes 不可用：请升级 gsuid_core。', e);
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
        console.warn('[AIDebugPage] /api/cognition/rebuild_mount 不可用：请升级 gsuid_core。', e);
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
    <div className={pageStackClass}>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanSearch className="w-5 h-5" />
            {t('aiRuntime.cognition.title')}
          </CardTitle>
          <CardDescription>{t('aiRuntime.cognition.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
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
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {t('common.search')}
            </Button>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setRebuildOpen(true)}
              disabled={loading || rebuilding}
            >
              {rebuilding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
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
            {
              value: 'all',
              label: t('aiRuntime.cognition.filterAll'),
              icon: <Layers className="w-4 h-4" />,
            },
            {
              value: 'world',
              label: t('aiRuntime.cognition.filterWorld'),
              icon: <Globe className="w-4 h-4" />,
            },
            {
              value: 'env',
              label: t('aiRuntime.cognition.filterEnv'),
              icon: <Boxes className="w-4 h-4" />,
            },
          ]}
        />
      )}

      {nodes && visibleNodes.length === 0 && (
        <Card className="glass-card">
          <CardContent className="!p-6 text-sm text-muted-foreground">
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
                    {node.handle && (
                      <span className="font-mono break-all">handle={node.handle}</span>
                    )}
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
