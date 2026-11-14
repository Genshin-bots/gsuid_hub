import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { TruncatedText } from '@/components/ui/truncated-text';
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
  getApiErrorMessage,
  relationshipApi,
  type RelationshipListData,
  type RelationshipListItem,
} from '@/lib/api';
import { isCognitionBackendMissing } from '@/lib/cognition';

const ROSTER_PAGE_SIZE = 100;

interface RosterQuery {
  keyword: string;
  botId: string;
  offset: number;
  reload: number;
}

function isBackendMissing(err: unknown): boolean {
  return (
    isCognitionBackendMissing(err) || /404/.test(err instanceof Error ? err.message : String(err))
  );
}

function isAdminForbidden(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('需要管理员') || /HTTP Error:\s*403/i.test(msg);
}

function formatUnix(ts: number | undefined, empty: string): string {
  if (!ts) return empty;
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return empty;
  return date.toLocaleString();
}

function formatDelta(delta: number | undefined, empty: string): string {
  if (delta === undefined) return empty;
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

function zoneBadgeVariant(zone: string): 'destructive' | 'secondary' | 'outline' | 'default' {
  if (zone === 'hostile' || zone === 'cold') return 'destructive';
  if (zone === 'distant') return 'secondary';
  if (zone === 'acquaintance') return 'outline';
  return 'default';
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium break-all">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function RelationshipPanel() {
  const { t } = useLanguage();
  const [view, setView] = useState<RelationshipListItem | null>(null);
  const [draftKeyword, setDraftKeyword] = useState('');
  const [draftBot, setDraftBot] = useState('');
  const [rosterQuery, setRosterQuery] = useState<RosterQuery>({
    keyword: '',
    botId: '',
    offset: 0,
    reload: 0,
  });
  const [roster, setRoster] = useState<RelationshipListData | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterMissing, setRosterMissing] = useState(false);
  const [rosterForbidden, setRosterForbidden] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const pendingScroll = useRef(false);
  const rosterTableRef = useRef<HTMLDivElement | null>(null);
  // 右侧还有隐藏列（scrollLeft < maxScroll）时给固定操作列加遮罩/阴影提示；
  // 同值 setState 会被 React 跳过，1px 容差消化 HiDPI 亚像素舍入
  const [hasMoreRight, setHasMoreRight] = useState(false);

  const syncMoreRight = useCallback(() => {
    const el = rosterTableRef.current;
    if (!el) return;
    const canRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    setHasMoreRight((prev) => (prev === canRight ? prev : canRight));
  }, []);

  // 数据刷新 / 容器尺寸变化后 scrollLeft 可能被浏览器重置，重新同步一次
  useEffect(() => {
    syncMoreRight();
    const el = rosterTableRef.current;
    if (!el) return;
    const observer = new ResizeObserver(syncMoreRight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [roster, syncMoreRight]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setRosterLoading(true);
      try {
        const data = await relationshipApi.list({
          bot_id: rosterQuery.botId || undefined,
          keyword: rosterQuery.keyword || undefined,
          offset: rosterQuery.offset,
          limit: ROSTER_PAGE_SIZE,
        });
        if (cancelled) return;
        setRoster(data);
        setRosterForbidden(false);
        setRosterMissing(false);
      } catch (e) {
        if (cancelled) return;
        if (isAdminForbidden(e)) {
          setRosterForbidden(true);
          setRosterMissing(false);
          setRoster(null);
        } else if (isBackendMissing(e)) {
          console.warn('[AIOutputsPage] /api/relationship/list 不可用：请升级 gsuid_core。', e);
          setRosterMissing(true);
          setRosterForbidden(false);
          setRoster(null);
        } else {
          toast.error(getApiErrorMessage(e, t('aiRuntime.loadFailed')));
        }
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [rosterQuery, t]);

  useEffect(() => {
    if (!pendingScroll.current || !view) return;
    pendingScroll.current = false;
    detailRef.current?.scrollIntoView({ block: 'nearest' });
  }, [view]);

  const openRow = (item: RelationshipListItem) => {
    setView(item);
    pendingScroll.current = true;
  };

  const applyRosterFilter = () => {
    setRosterQuery((prev) => ({
      keyword: draftKeyword.trim(),
      botId: draftBot.trim(),
      offset: 0,
      reload: prev.reload + 1,
    }));
  };

  const pageCount = Math.max(1, Math.ceil((roster?.total ?? 0) / ROSTER_PAGE_SIZE));
  const pageCurrent = Math.floor(rosterQuery.offset / ROSTER_PAGE_SIZE) + 1;

  return (
    <div className={pageStackClass}>
      {view && (
        <div ref={detailRef} className={pageStackClass}>
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
            <CardContent className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3 text-sm">
              <Field
                label={t('aiRuntime.relationship.score')}
                value={String(view.score ?? '—')}
                hint={t('aiRuntime.relationship.scoreHint')}
              />
              <Field
                label={t('aiRuntime.relationship.lastReason')}
                value={view.last_reason || t('aiRuntime.relationship.none')}
              />
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
              <Field
                label={t('aiRuntime.relationship.dailyYmd')}
                value={view.daily_ymd || t('aiRuntime.relationship.none')}
              />
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
        </div>
      )}

      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('aiRuntime.relationship.rosterTitle')}
              </CardTitle>
              <CardDescription>{t('aiRuntime.relationship.rosterDesc')}</CardDescription>
            </div>
            <Button
              variant="outline"
              className="shrink-0 self-start"
              onClick={() => setRosterQuery((prev) => ({ ...prev, reload: prev.reload + 1 }))}
              disabled={rosterLoading || rosterForbidden || rosterMissing}
            >
              <RefreshCw className={cn('w-4 h-4', rosterLoading && 'animate-spin')} />
              {t('common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          {rosterForbidden ? (
            <p className="text-sm text-muted-foreground">
              {t('aiRuntime.relationship.rosterForbidden')}
            </p>
          ) : rosterMissing ? (
            <p className="text-sm text-muted-foreground">
              {t('aiRuntime.relationship.rosterMissing')}
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor="rel-roster-kw">{t('aiRuntime.relationship.rosterKeyword')}</Label>
                  <Input
                    id="rel-roster-kw"
                    className="h-9"
                    value={draftKeyword}
                    placeholder={t('aiRuntime.relationship.rosterKeywordPlaceholder')}
                    onChange={(e) => setDraftKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyRosterFilter();
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rel-roster-bot">{t('aiRuntime.relationship.botId')}</Label>
                  <Input
                    id="rel-roster-bot"
                    className="h-9 font-mono"
                    value={draftBot}
                    placeholder={t('aiRuntime.relationship.rosterBotPlaceholder')}
                    onChange={(e) => setDraftBot(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyRosterFilter();
                    }}
                  />
                </div>
                <Button className="h-9" onClick={applyRosterFilter} disabled={rosterLoading}>
                  <Search className="w-4 h-4" />
                  {t('aiRuntime.relationship.rosterSearch')}
                </Button>
              </div>

              {roster && (
                <p className="text-sm text-muted-foreground">
                  {t('aiRuntime.relationship.rosterCount', { count: roster.total })}
                </p>
              )}

              {rosterLoading && !roster ? (
                <Skeleton className="h-40 w-full" />
              ) : roster && roster.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('aiRuntime.relationship.rosterEmpty')}
                </p>
              ) : roster ? (
                <>
                  {/* ≥lg：完整表格（11 列，宽屏横滚兜底）；窄屏走下方卡片列表 */}
                  <div
                    className={cn('hidden lg:block overflow-x-auto', rosterLoading && 'opacity-60')}
                  >
                    <Table
                      className="w-max min-w-full whitespace-nowrap"
                      wrapperRef={rosterTableRef}
                      onWrapperScroll={syncMoreRight}
                    >
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.colUser')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.botId')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.score')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.colZone')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.colLine')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.lastReason')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.lastDelta')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.lastEval')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.daily')}
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            {t('aiRuntime.relationship.interactions')}
                          </TableHead>
                          <TableHead
                            className={cn(
                              'table-sticky-right',
                              hasMoreRight && 'table-sticky-fade table-sticky-shadow',
                            )}
                          >
                            <span className="sr-only">{t('common.actions')}</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roster.items.map((item) => (
                          <TableRow
                            key={`${item.bot_id}:${item.user_id}:${item.id}`}
                            className={cn(
                              view?.user_id === item.user_id &&
                                view.bot_id === item.bot_id &&
                                'bg-muted/40',
                            )}
                          >
                            <TableCell className="max-w-[24ch]">
                              <div className="flex items-center gap-2">
                                <TruncatedText
                                  text={item.user_name || item.user_id}
                                  className="font-medium"
                                />
                                {item.is_master && (
                                  <Badge variant="default" className="shrink-0 whitespace-nowrap">
                                    {t('aiRuntime.relationship.master')}
                                  </Badge>
                                )}
                              </div>
                              {item.user_name && item.user_name !== item.user_id && (
                                <TruncatedText
                                  text={item.user_id}
                                  className="font-mono text-[11px] text-muted-foreground"
                                />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <TruncatedText text={item.bot_id} className="max-w-[20ch]" />
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium">
                              {item.score}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant={zoneBadgeVariant(item.zone)}
                                className="whitespace-nowrap"
                              >
                                {item.zone_label} · {item.zone}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[16rem] text-xs">
                              <TruncatedText text={item.line} />
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <TruncatedText
                                text={item.last_reason || t('aiRuntime.relationship.none')}
                                className="max-w-[24ch]"
                              />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDelta(item.last_delta, t('aiRuntime.relationship.none'))}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {formatUnix(item.last_eval_at, t('aiRuntime.relationship.none'))}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">
                              {t('aiRuntime.relationship.gain')} {item.daily_gain ?? 0} /{' '}
                              {t('aiRuntime.relationship.loss')} {item.daily_loss ?? 0}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.interaction_count ?? 0}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'table-sticky-right',
                                hasMoreRight && 'table-sticky-fade table-sticky-shadow',
                              )}
                            >
                              <Button
                                variant="outline"
                                className="h-8"
                                onClick={() => openRow(item)}
                              >
                                {t('aiRuntime.relationship.viewRow')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* <lg：名单卡片——11 列表格在手机上只能横拖，改成信息卡逐条排 */}
                  <div className={cn('space-y-2.5 lg:hidden', rosterLoading && 'opacity-60')}>
                    {roster.items.map((item) => (
                      <div
                        key={`${item.bot_id}:${item.user_id}:${item.id}`}
                        className={cn(
                          'rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2',
                          view?.user_id === item.user_id &&
                            view.bot_id === item.bot_id &&
                            'border-primary/40 bg-primary/5',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium">
                              {item.user_name || item.user_id}
                            </span>
                            {item.is_master && (
                              <Badge variant="default" className="shrink-0 whitespace-nowrap">
                                {t('aiRuntime.relationship.master')}
                              </Badge>
                            )}
                          </div>
                          <span className="shrink-0 font-semibold tabular-nums">{item.score}</span>
                        </div>
                        {item.user_name && item.user_name !== item.user_id && (
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {item.user_id}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                            {item.bot_id}
                          </span>
                          <Badge
                            variant={zoneBadgeVariant(item.zone)}
                            className="ml-auto shrink-0 whitespace-nowrap"
                          >
                            {item.zone_label} · {item.zone}
                          </Badge>
                        </div>
                        {item.line ? (
                          <p className="truncate text-xs text-muted-foreground" title={item.line}>
                            {item.line}
                          </p>
                        ) : null}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                          <Field
                            label={t('aiRuntime.relationship.lastReason')}
                            value={item.last_reason || t('aiRuntime.relationship.none')}
                          />
                          <Field
                            label={t('aiRuntime.relationship.lastDelta')}
                            value={formatDelta(item.last_delta, t('aiRuntime.relationship.none'))}
                          />
                          <Field
                            label={t('aiRuntime.relationship.lastEval')}
                            value={formatUnix(item.last_eval_at, t('aiRuntime.relationship.none'))}
                          />
                          <Field
                            label={t('aiRuntime.relationship.daily')}
                            value={`${t('aiRuntime.relationship.gain')} ${item.daily_gain ?? 0} / ${t('aiRuntime.relationship.loss')} ${item.daily_loss ?? 0}`}
                          />
                          <div className="col-span-2">
                            <Field
                              label={t('aiRuntime.relationship.interactions')}
                              value={String(item.interaction_count ?? 0)}
                            />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="h-8 w-full"
                          onClick={() => openRow(item)}
                        >
                          {t('aiRuntime.relationship.viewRow')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {roster && roster.total > ROSTER_PAGE_SIZE && (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    className="h-9"
                    disabled={rosterQuery.offset === 0 || rosterLoading}
                    onClick={() =>
                      setRosterQuery((prev) => ({
                        ...prev,
                        offset: Math.max(0, prev.offset - ROSTER_PAGE_SIZE),
                      }))
                    }
                  >
                    {t('common.previousPage')}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {t('common.pageInfo', { current: pageCurrent, total: pageCount })}
                  </span>
                  <Button
                    variant="outline"
                    className="h-9"
                    disabled={
                      rosterQuery.offset + ROSTER_PAGE_SIZE >= roster.total || rosterLoading
                    }
                    onClick={() =>
                      setRosterQuery((prev) => ({
                        ...prev,
                        offset: prev.offset + ROSTER_PAGE_SIZE,
                      }))
                    }
                  >
                    {t('common.nextPage')}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
