import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  Workflow,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { cn, formatTokens } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { GlassAlert } from '@/components/ui/glass-alert';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { ConfigSelectDropdown } from '@/components/config';
import {
  AI_TASK_LEVEL_REFS,
  aiStatisticsApi,
  aiTaskModelsApi,
  type AITaskGroup,
  type AITaskKindInfo,
  type AITaskModelsData,
  type AllConfigItem,
} from '@/lib/api';

type TFn = (key: string, params?: Record<string, string | number>) => string;
type TaskMode = 'default' | 'high' | 'low' | 'config';
type SortMode = 'group' | 'usage';

// 面板固定展示「近 90 天」各任务 token 消耗（token-by-range 一次跨天聚合）
const USAGE_RANGE_DAYS = 90;

export interface TaskModelOverridesPanelProps {
  t: TFn;
  allConfigsList: AllConfigItem[];
  /** 档位主/备配置的签名：变化时重新拉取「实际生效」 */
  refreshKey: string;
}

function modeOf(kind: AITaskKindInfo): TaskMode {
  const primary = kind.override?.primary ?? '';
  if (!primary) return 'default';
  if (primary === AI_TASK_LEVEL_REFS.high) return 'high';
  if (primary === AI_TASK_LEVEL_REFS.low) return 'low';
  return 'config';
}

/**
 * 「任务配置」页的高级面板（默认折叠）：为单个任务类型覆盖高级 / 低级默认配置。
 *
 * 每次改动立即调用 `/api/ai_task_models` 落库，不参与页面的「保存配置」按钮；
 * 因此 AIConfigPage 必须把 `task_model_overrides` 排除在整包回写之外。
 */
export function TaskModelOverridesPanel({
  t,
  allConfigsList,
  refreshKey,
}: TaskModelOverridesPanelProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AITaskModelsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('group');
  // chat_type → 近 90 天 token 总量；拉不到时为空 Map，行内不显示用量
  const [usageByKey, setUsageByKey] = useState<Map<string, number>>(new Map());
  // 选了「指定配置」但还没挑配置文件的任务：此时不落库
  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const tr = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => {
      const value = t(key, params);
      return value === key ? fallback : value;
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await aiTaskModelsApi.list());
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    void aiStatisticsApi
      .getTokenByRange(
        format(subDays(today, USAGE_RANGE_DAYS - 1), 'yyyy-MM-dd'),
        format(today, 'yyyy-MM-dd'),
      )
      .then((res) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const row of res.by_type ?? []) {
          map.set(row.type, (map.get(row.type) ?? 0) + (row.total_tokens ?? 0));
        }
        setUsageByKey(map);
      })
      .catch(() => {
        // 统计接口不可用时只隐藏用量行，不影响配置功能
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const configByName = useMemo(() => {
    const map = new Map<string, AllConfigItem>();
    for (const item of allConfigsList) map.set(item.name, item);
    return map;
  }, [allConfigsList]);

  const overriddenCount = data ? data.kinds.filter((k) => k.override).length : 0;

  const kindTitle = (kind: AITaskKindInfo) =>
    tr(`aiConfig.taskModels.kinds.${kind.id}.title`, kind.title);
  const kindDesc = (kind: AITaskKindInfo) =>
    tr(`aiConfig.taskModels.kinds.${kind.id}.desc`, kind.desc);
  const levelLabel = (level: 'high' | 'low') =>
    level === 'high' ? t('aiConfig.taskModels.levelHigh') : t('aiConfig.taskModels.levelLow');

  const kindTokens = useCallback(
    (kind: AITaskKindInfo) =>
      (kind.stats_keys ?? []).reduce((sum, key) => sum + (usageByKey.get(key) ?? 0), 0),
    [usageByKey],
  );

  const matchesFilter = useCallback(
    (k: AITaskKindInfo) => {
      if (onlyOverridden && !k.override) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        k.id,
        k.title,
        k.desc,
        t(`aiConfig.taskModels.kinds.${k.id}.title`),
        t(`aiConfig.taskModels.kinds.${k.id}.desc`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    },
    [onlyOverridden, query, t],
  );

  const grouped = useMemo(() => {
    if (!data || sortMode !== 'group')
      return [] as { group: AITaskGroup; kinds: AITaskKindInfo[] }[];
    return data.groups
      .map((group) => ({
        group,
        kinds: data.kinds.filter((k) => k.group === group && matchesFilter(k)),
      }))
      .filter((g) => g.kinds.length > 0);
  }, [data, sortMode, matchesFilter]);

  const usageSorted = useMemo(() => {
    if (!data || sortMode !== 'usage') return [] as AITaskKindInfo[];
    return data.kinds.filter(matchesFilter).sort((a, b) => kindTokens(b) - kindTokens(a));
  }, [data, sortMode, matchesFilter, kindTokens]);

  // 占比基准固定用全量任务总量：搜索 / 筛选只影响显示哪些行，不让条子跟着重缩放
  const totalKindTokens = useMemo(
    () => (data ? data.kinds.reduce((sum, k) => sum + kindTokens(k), 0) : 0),
    [data, kindTokens],
  );

  const run = async (kind: AITaskKindInfo, action: () => Promise<AITaskModelsData>) => {
    setPendingId(kind.id);
    try {
      setData(await action());
      toast.success(t('aiConfig.taskModels.updated', { name: kindTitle(kind) }));
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setPendingId(null);
    }
  };

  const dropDraft = (id: string) =>
    setDrafts((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const handleMode = async (kind: AITaskKindInfo, mode: TaskMode) => {
    if (mode === 'config') {
      if (modeOf(kind) !== 'config') setDrafts((prev) => new Set(prev).add(kind.id));
      return;
    }
    dropDraft(kind.id);
    if (mode === 'default') {
      if (kind.override) await run(kind, () => aiTaskModelsApi.clear(kind.id));
      return;
    }
    if (modeOf(kind) === mode) return;
    await run(kind, () => aiTaskModelsApi.set(kind.id, AI_TASK_LEVEL_REFS[mode]));
  };

  const handlePrimary = async (kind: AITaskKindInfo, name: string) => {
    const keepSecondary = modeOf(kind) === 'config' ? (kind.override?.secondary ?? '') : '';
    const ok = await run(kind, () =>
      aiTaskModelsApi.set(kind.id, name, keepSecondary === name ? '' : keepSecondary),
    );
    if (ok) dropDraft(kind.id);
  };

  const handleSecondary = async (kind: AITaskKindInfo, name: string) => {
    const primary = kind.override?.primary ?? '';
    if (!primary) return;
    await run(kind, () => aiTaskModelsApi.set(kind.id, primary, name));
  };

  const handleResetAll = async () => {
    setConfirmResetOpen(false);
    try {
      setData(await aiTaskModelsApi.clearAll());
      setDrafts(new Set());
      toast.success(t('aiConfig.taskModels.resetAllDone'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleClearOrphans = async () => {
    if (!data) return;
    try {
      let latest = data;
      for (const id of data.orphans) latest = await aiTaskModelsApi.clear(id);
      setData(latest);
      toast.success(t('aiConfig.taskModels.orphansCleared'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const renderConfigChip = (fullName: string) => {
    if (!fullName) {
      return (
        <span className="text-red-600 dark:text-red-400">
          {t('aiConfig.taskModels.notConfigured')}
        </span>
      );
    }
    const item = configByName.get(fullName);
    return (
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className="font-medium text-foreground truncate">
          {item?.config_name ?? fullName}
        </span>
        {item?.model_name && <span className="truncate opacity-70">({item.model_name})</span>}
      </span>
    );
  };

  const renderKind = (kind: AITaskKindInfo) => {
    const isLocked = kind.follows_caller;
    const isDraft = !isLocked && drafts.has(kind.id);
    const mode: TaskMode = isLocked ? 'default' : isDraft ? 'config' : modeOf(kind);
    const pending = pendingId === kind.id;
    const overridden = !isLocked && Boolean(kind.override);
    const defaultLabel = kind.follows_caller
      ? t('aiConfig.taskModels.followsCaller')
      : levelLabel(kind.default_level);
    const primary = mode === 'config' && !isDraft ? (kind.override?.primary ?? '') : '';
    const secondary = mode === 'config' && !isDraft ? (kind.override?.secondary ?? '') : '';
    const secondaryItems = allConfigsList.filter((c) => c.name !== primary);
    const showUsage = usageByKey.size > 0 && (kind.stats_keys?.length ?? 0) > 0;
    const tokens = kindTokens(kind);
    const sharePct = totalKindTokens > 0 ? (tokens / totalKindTokens) * 100 : 0;
    const shareLabel = tokens > 0 && sharePct < 0.1 ? '<0.1' : sharePct.toFixed(1);

    return (
      <div
        key={kind.id}
        className={cn(
          'rounded-2xl border p-3 md:p-4 transition-colors',
          overridden ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-card/30',
        )}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{kindTitle(kind)}</span>
              <code className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {kind.id}
              </code>
              {kind.fast && (
                <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-normal">
                  <Zap className="h-3 w-3" />
                  {t('aiConfig.taskModels.fastBadge')}
                </Badge>
              )}
              {overridden && (
                <Badge className="h-5 px-1.5 text-[10px]">
                  {t('aiConfig.taskModels.overriddenBadge')}
                </Badge>
              )}
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{kindDesc(kind)}</p>
          </div>
          {isLocked ? (
            <div
              className="inline-flex h-9 w-full shrink-0 cursor-not-allowed select-none items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-3 text-xs font-medium text-muted-foreground sm:w-max"
              aria-disabled="true"
              title={t('aiConfig.taskModels.lockedDefaultTooltip')}
            >
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>{t('aiConfig.taskModels.modeDefault', { level: defaultLabel })}</span>
              <span className="opacity-70">· {t('aiConfig.taskModels.lockedBadge')}</span>
            </div>
          ) : (
            <TabButtonGroup
              size="sm"
              className="w-full shrink-0 sm:w-max"
              singleRowOnMobile
              disabled={pending}
              value={mode}
              onValueChange={(v) => void handleMode(kind, v as TaskMode)}
              options={[
                {
                  value: 'default',
                  label: t('aiConfig.taskModels.modeDefault', { level: defaultLabel }),
                },
                { value: 'high', label: levelLabel('high') },
                { value: 'low', label: levelLabel('low') },
                { value: 'config', label: t('aiConfig.taskModels.modeConfig') },
              ]}
            />
          )}
        </div>

        {mode === 'config' && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t('aiConfig.taskModels.primaryLabel')}
              </p>
              <ConfigSelectDropdown
                items={allConfigsList}
                selectedName={primary}
                onSelect={(name) => void handlePrimary(kind, name)}
                placeholder={t('aiConfig.taskModels.pickConfig')}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('aiConfig.taskModels.secondaryLabel')}
                </p>
                {secondary && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    disabled={pending}
                    onClick={() => void handleSecondary(kind, '')}
                  >
                    {t('aiConfig.taskModels.clearSecondary')}
                  </button>
                )}
              </div>
              <div className={cn(!primary && 'pointer-events-none opacity-50')}>
                <ConfigSelectDropdown
                  items={secondaryItems}
                  selectedName={secondary}
                  onSelect={(name) => void handleSecondary(kind, name)}
                  placeholder={t('aiConfig.taskModels.noSecondary')}
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span>{t('aiConfig.taskModels.effective')}</span>
          {renderConfigChip(kind.effective.primary)}
          {kind.effective.secondary && (
            <>
              <span className="opacity-60">·</span>
              <span>{t('aiConfig.taskModels.effectiveSecondary')}</span>
              {renderConfigChip(kind.effective.secondary)}
            </>
          )}
          {kind.follows_caller && kind.effective.source === 'default' && (
            <span className="opacity-70">{t('aiConfig.taskModels.followsCallerHint')}</span>
          )}
          {showUsage && (
            <span className="tabular-nums">
              · {t('aiConfig.taskModels.usage90d', { count: formatTokens(tokens) })} · {shareLabel}%
            </span>
          )}
        </div>
        {showUsage && (
          <div
            className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted/40"
            title={`${shareLabel}%`}
          >
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${Math.max(Math.min(sharePct, 100), tokens > 0 ? 0.5 : 0)}%` }}
            />
          </div>
        )}
        {kind.override && !kind.override.valid && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {t('aiConfig.taskModels.invalidOverride')}
          </p>
        )}
      </div>
    );
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-muted/20 md:p-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Workflow className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {t('aiConfig.taskModels.title')}
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                    {t('aiConfig.taskModels.advancedBadge')}
                  </Badge>
                  {overriddenCount > 0 && (
                    <Badge className="h-5 px-1.5 text-[10px]">
                      {t('aiConfig.taskModels.overriddenCount', { count: overriddenCount })}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('aiConfig.taskModels.description')}
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-border/50 p-3 md:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('aiConfig.taskModels.searchPlaceholder')}
                  className="h-9 pl-9"
                />
              </div>
              <div className="flex items-center gap-3">
                <TabButtonGroup
                  size="sm"
                  value={sortMode}
                  onValueChange={(v) => setSortMode(v as SortMode)}
                  options={[
                    { value: 'group', label: t('aiConfig.taskModels.sortGroup') },
                    { value: 'usage', label: t('aiConfig.taskModels.sortUsage') },
                  ]}
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={onlyOverridden} onCheckedChange={setOnlyOverridden} />
                  {t('aiConfig.taskModels.onlyOverridden')}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={overriddenCount === 0}
                  onClick={() => setConfirmResetOpen(true)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t('aiConfig.taskModels.resetAll')}
                </Button>
              </div>
            </div>

            {data && data.orphans.length > 0 && (
              <GlassAlert tone="warning" icon={AlertTriangle} className="p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs">
                    {t('aiConfig.taskModels.orphans', { ids: data.orphans.join(', ') })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    onClick={() => void handleClearOrphans()}
                  >
                    {t('aiConfig.taskModels.clearOrphans')}
                  </Button>
                </div>
              </GlassAlert>
            )}

            {loading && !data && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {loadError && !data && (
              <GlassAlert tone="danger" icon={AlertTriangle} className="p-3">
                <p className="text-xs">
                  {t('aiConfig.taskModels.loadFailed')}: {loadError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs"
                  onClick={() => void load()}
                >
                  {t('aiConfig.taskModels.retry')}
                </Button>
              </GlassAlert>
            )}

            {data && grouped.length === 0 && usageSorted.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('aiConfig.taskModels.empty')}
              </p>
            )}

            {sortMode === 'usage' ? (
              <div className="space-y-2">{usageSorted.map(renderKind)}</div>
            ) : (
              grouped.map(({ group, kinds }) => (
                <section key={group} className="space-y-2">
                  <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {tr(`aiConfig.taskModels.groups.${group}`, group)}
                  </h4>
                  <div className="space-y-2">{kinds.map(renderKind)}</div>
                </section>
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiConfig.taskModels.resetAllTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiConfig.taskModels.resetAllDesc', { count: overriddenCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleResetAll()}>
              {t('aiConfig.taskModels.resetAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
