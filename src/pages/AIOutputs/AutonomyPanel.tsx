/**
 * 自主行动页签。后端 autonomy_api.py 的 GET /api/autonomy/feed。
 * 筛选行挂在合并页 toolbar；列表和详情留在这里。
 */
import { useEffect, useRef, useState } from 'react';
import { Compass, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { TruncatedText } from '@/components/ui/truncated-text';
import { autonomyApi, getApiErrorMessage, type AutonomyActivity } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AUTONOMY_PERSONA_ALL } from './constants';

const PAGE_SIZE = 20;

const DRIVE_KINDS = ['care_user', 'group_topic', 'self_explore', 'rest'] as const;
const DELIVERY_MODES = ['immediate_push', 'staged_merge', 'silent_only'] as const;

type DriveKind = (typeof DRIVE_KINDS)[number];
type DeliveryMode = (typeof DELIVERY_MODES)[number];

export interface AutonomyPanelProps {
  personaName: string;
  onPersonaNameChange: (value: string) => void;
  personaNames: string[];
  onPersonaNames: (names: string[]) => void;
  offset: number;
  onOffsetChange: (value: number) => void;
  refreshKey: number;
  onRefresh: () => void;
}

function isDrive(value: string): value is DriveKind {
  return (
    value === 'care_user' || value === 'group_topic' || value === 'self_explore' || value === 'rest'
  );
}

function isDelivery(value: string): value is DeliveryMode {
  return value === 'immediate_push' || value === 'staged_merge' || value === 'silent_only';
}

function formatWhen(ts: number): string {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString();
}

function formatSeconds(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 10) return seconds.toFixed(1);
  return String(Math.round(seconds));
}

export function AutonomyFilters(props: AutonomyPanelProps) {
  const { t } = useLanguage();
  const { personaName, onPersonaNameChange, personaNames, onRefresh } = props;
  const known = personaName === AUTONOMY_PERSONA_ALL || personaNames.includes(personaName);

  return (
    // 窄屏整行铺满：下拉 flex-1 吃掉剩余宽度，和「刷新」同排占满一行；
    // ≥768 回到原样（下拉固定 200px，行右对齐）。
    <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 md:w-auto md:min-w-auto md:justify-end">
      <Select value={personaName} onValueChange={onPersonaNameChange}>
        <SelectTrigger className={cn(tabToolbarControlClass, 'w-full min-w-0 flex-1 md:w-[200px] md:flex-none')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={AUTONOMY_PERSONA_ALL}>{t('aiAutonomy.filters.personaAll')}</SelectItem>
          {personaNames.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
          {known ? null : <SelectItem value={personaName}>{personaName}</SelectItem>}
        </SelectContent>
      </Select>
      <Button
        className={cn(tabToolbarControlClass, 'shrink-0')}
        variant="outline"
        onClick={onRefresh}
      >
        <RefreshCw className="h-4 w-4" />
        {t('aiAutonomy.filters.refresh')}
      </Button>
    </div>
  );
}

export function AutonomyPanel(props: AutonomyPanelProps) {
  const { t } = useLanguage();
  const { personaName, onPersonaNames, offset, onOffsetChange, refreshKey } = props;
  const copy = useRef(t);
  copy.current = t;
  const [items, setItems] = useState<AutonomyActivity[]>([]);
  const [latest, setLatest] = useState<AutonomyActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AutonomyActivity | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await autonomyApi.feed({
          personaName: personaName === AUTONOMY_PERSONA_ALL ? '' : personaName,
          limit: PAGE_SIZE,
          offset,
        });
        if (cancelled) return;
        // 后端字段缺失时兜底成空数组：personas 缺失会让下拉 .map 直接崩掉整个页面
        setItems(data?.items ?? []);
        setLatest(data?.latest ?? []);
        setTotal(data?.total ?? 0);
        onPersonaNames(data?.personas ?? []);
      } catch (err: unknown) {
        if (!cancelled) toast.error(getApiErrorMessage(err, copy.current('aiAutonomy.loadFailed')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaName, offset, refreshKey, onPersonaNames]);

  const driveLabel = (kind: string) => (isDrive(kind) ? t(`aiAutonomy.drive.${kind}`) : kind);
  const deliveryLabel = (mode: string) =>
    isDelivery(mode) ? t(`aiAutonomy.delivery.${mode}`) : mode;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + items.length, total);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">{t('aiAutonomy.latestTitle')}</h2>
        {loading && latest.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : latest.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Compass className="mx-auto mb-2 h-8 w-8 opacity-60" />
              <p className="font-medium text-foreground">{t('aiAutonomy.empty')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('aiAutonomy.emptyHint')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="glass-card-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {latest.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row)}
                className="glass-card rounded-lg border p-3.5 text-left transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{row.persona_name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatWhen(row.created_at)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{driveLabel(row.drive_kind)}</Badge>
                  <Badge variant="outline">{deliveryLabel(row.delivery_mode)}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {row.summary || t('aiAutonomy.noSummary')}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t('aiAutonomy.historyTitle')}
        </h2>
        <Card className="glass-card min-h-0 flex-1 flex flex-col">
          <CardContent className="p-0 min-h-0 flex-1 flex flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
              {/* ≥lg：6 列表格；窄屏表格被挤成单字竖排，改走下方卡片列表 */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('aiAutonomy.table.when')}</TableHead>
                      <TableHead>{t('aiAutonomy.table.persona')}</TableHead>
                      <TableHead>{t('aiAutonomy.table.drive')}</TableHead>
                      <TableHead>{t('aiAutonomy.table.delivery')}</TableHead>
                      <TableHead>{t('aiAutonomy.table.summary')}</TableHead>
                      <TableHead className="text-right">{t('aiAutonomy.table.steps')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          <Skeleton className="h-8" />
                        </TableCell>
                      </TableRow>
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          {t('aiAutonomy.empty')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelected(row)}
                        >
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatWhen(row.created_at)}
                          </TableCell>
                          <TableCell>
                            <TruncatedText text={row.persona_name} className="max-w-[20ch]" />
                          </TableCell>
                          <TableCell>{driveLabel(row.drive_kind)}</TableCell>
                          <TableCell>{deliveryLabel(row.delivery_mode)}</TableCell>
                          <TableCell className="max-w-[360px]">
                            <TruncatedText text={row.summary || t('aiAutonomy.noSummary')} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.step_count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* <lg：与上方「最近在做什么」卡片同构的信息卡，点开同一详情 */}
              <div className="space-y-2.5 p-3 lg:hidden">
                {loading && items.length === 0 ? (
                  <Skeleton className="h-24" />
                ) : items.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t('aiAutonomy.empty')}
                  </p>
                ) : (
                  items.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelected(row)}
                      className="w-full rounded-xl border border-border/50 bg-muted/30 p-3 text-left transition-colors hover:bg-accent/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{row.persona_name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {formatWhen(row.created_at)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Badge variant="secondary">{driveLabel(row.drive_kind)}</Badge>
                        <Badge variant="outline">{deliveryLabel(row.delivery_mode)}</Badge>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                          {t('aiAutonomy.table.steps')} {row.step_count}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                        {row.summary || t('aiAutonomy.noSummary')}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
            {total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 p-3 text-sm">
                <span className="text-muted-foreground text-xs sm:text-sm">
                  {t('aiAutonomy.pagination.label', { from, to, total })}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0 || loading}
                    onClick={() => onOffsetChange(Math.max(0, offset - PAGE_SIZE))}
                  >
                    {t('aiAutonomy.pagination.prev')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + PAGE_SIZE >= total || loading}
                    onClick={() => onOffsetChange(offset + PAGE_SIZE)}
                  >
                    {t('aiAutonomy.pagination.next')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <ActivityDialog
        row={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        driveLabel={driveLabel}
        deliveryLabel={deliveryLabel}
      />
    </div>
  );
}

function ActivityDialog({
  row,
  onOpenChange,
  driveLabel,
  deliveryLabel,
}: {
  row: AutonomyActivity | null;
  onOpenChange: (open: boolean) => void;
  driveLabel: (kind: string) => string;
  deliveryLabel: (mode: string) => string;
}) {
  const { t } = useLanguage();
  const observations = row?.fact_pack.factual_observations ?? [];
  const trails = row?.open_trails ?? [];
  const steps = row?.steps ?? [];

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {row.persona_name} · {t('aiAutonomy.detail.title')}
              </DialogTitle>
              <DialogDescription>{formatWhen(row.created_at)}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{driveLabel(row.drive_kind)}</Badge>
              <Badge variant="outline">{deliveryLabel(row.delivery_mode)}</Badge>
              {row.duration_ms > 0 ? (
                <Badge variant="outline">
                  {t('aiAutonomy.detail.duration', { seconds: formatSeconds(row.duration_ms) })}
                </Badge>
              ) : null}
            </div>
            {row.target_user_id ? (
              <p className="text-sm">
                <span className="text-muted-foreground">{t('aiAutonomy.detail.target')}</span>{' '}
                {row.target_user_id}
              </p>
            ) : null}
            <div>
              <h3 className="mb-1 text-sm font-medium">{t('aiAutonomy.detail.summary')}</h3>
              <p className="whitespace-pre-wrap text-sm">
                {row.summary || t('aiAutonomy.noSummary')}
              </p>
            </div>
            {observations.length > 0 ? (
              <div>
                <h3 className="mb-1 text-sm font-medium">{t('aiAutonomy.detail.observations')}</h3>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {observations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {trails.length > 0 ? (
              <div>
                <h3 className="mb-1 text-sm font-medium">{t('aiAutonomy.detail.trails')}</h3>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {trails.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <h3 className="mb-1 text-sm font-medium">{t('aiAutonomy.detail.steps')}</h3>
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('aiAutonomy.detail.noSteps')}</p>
              ) : (
                <ul className="space-y-2">
                  {steps.map((step) => (
                    <li
                      key={`${step.step_index}-${step.tool_name}`}
                      className="rounded-md border p-2"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="font-mono">{step.tool_name || '—'}</span>
                        {step.is_error ? (
                          <Badge variant="destructive">{t('aiAutonomy.detail.stepError')}</Badge>
                        ) : null}
                      </div>
                      {step.output_text ? (
                        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                          {step.output_text}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {row.session_id ? (
              <Button asChild variant="outline" className="w-fit">
                <Link to={`/ai-history?create_by=Autonomy&q=${encodeURIComponent(row.session_id)}`}>
                  {t('aiAutonomy.detail.sessionLog')}
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t('aiAutonomy.detail.noSessionLog')}</p>
            )}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
