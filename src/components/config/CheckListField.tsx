import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { SearchableMenu } from '@/components/ui/searchable-menu';

type TFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * 控件统一高度。Input 默认 h-10、SelectTrigger 默认 h-7，直接并排会出现高度参差，
 * 这里两边都显式覆盖成同一档。
 */
const CONTROL_H = 'h-9';
/** 超过这个数量就分批渲染，避免一次性铺开几百行导致打开即卡顿。 */
const PAGE_SIZE = 30;
/**
 * Radix Popper writes the real collision variables on its wrapper
 * (--radix-popper-available-height / -available-width). The old
 * --radix-popover-content-available-height does not exist, and an unresolvable
 * custom property invalidates the whole `max-height` declaration at
 * computed-value time: the list never overflowed, so the wheel had nothing to
 * scroll and the popover grew past the viewport. The 5rem reserve covers the
 * search row (and the plugin filter) rendered above the list.
 */
const LIST_MAX_H =
  'max-h-[min(420px,max(180px,calc(var(--radix-popper-available-height,70vh)_-_5rem)))]';
/** 收起态徽标间距，与容器上的 gap-1.5 对齐；量不到时兜底。 */
const BADGE_GAP = 6;

export interface CheckListItem {
  value: string;
  label: string;
  /**
   * 右侧元信息。传字符串会渲染成 outline 徽标（工具列表用这个，避免为
   * 几百个条目预先分配 JSX 元素）；需要自定义节点时传 ReactNode。
   */
  meta?: string | React.ReactNode;
  /** 次要说明，单行省略 */
  description?: string;
  icon?: React.ReactNode;
  /** 强调标记（如「默认常驻」），行内独立徽标 */
  tone?: 'default' | 'always';
  /** 预拼的检索文本：避免每次过滤都对长 docstring 做 join + toLowerCase */
  searchText?: string;
}

export interface CheckListGroup {
  key: string;
  label: string;
  count?: number;
  items: CheckListItem[];
}

/**
 * - `include`：勾 = 选中。适合「挑几个出来」。
 * - `exclude`：勾 = 排除。默认全开、只管例外——几百项全勾的画面会让人误以为
 *   这份清单归自己维护，实际 99% 的人从不改它。
 * - `add`：搜索**或直接浏览**都能加。适合默认空、只需挑 1~3 个的白名单。
 *
 * 三种模式都走 Popover 浮层：不挤动页面、空间不够自动向上翻。
 */
export type SelectionMode = 'include' | 'exclude' | 'add';

interface CheckListFieldProps {
  label: string;
  icon?: React.ReactNode;
  /** `value` 始终是「被选中的项」；`exclude` 模式下语义为「被排除的项」，由调用方换算 */
  value: string[];
  items: CheckListItem[];
  onChange: (value: string[]) => void;
  mode?: SelectionMode;
  groups?: CheckListGroup[];
  filter?: {
    options: { value: string; label: string; icon?: React.ReactNode }[];
    allLabel: string;
  };
  searchPlaceholder?: string;
  emptyText?: string;
  /**
   * 标题右侧「?」里的字段级说明（string 走轻量 Markdown）。
   * exclude / add 的操作提示会自动接在后面，调用方不用重复写。
   */
  help?: string;
  /** 常驻摘要行：渲染在收起态触发器下方（收起/展开都在原位） */
  summary?: React.ReactNode;
  alwaysLabel?: string;
  showSelectAll?: boolean;
  popoverWidth?: string;
  t: TFn;
}

type Row =
  | { kind: 'header'; key: string; label: string; count: number; total: number }
  | { kind: 'item'; key: string; item: CheckListItem };

export function CheckListField({
  label,
  icon,
  value,
  items,
  onChange,
  mode = 'include',
  groups,
  filter,
  searchPlaceholder,
  emptyText,
  help,
  summary,
  alwaysLabel,
  showSelectAll = true,
  popoverWidth = 'min-w-[420px]',
  t,
}: CheckListFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterValue, setFilterValue] = useState('__all__');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // 输入即时反馈、过滤延后一帧，400+ 行时打字不再卡
  const deferredQuery = useDeferredValue(query);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const badgeBoxRef = useRef<HTMLSpanElement | null>(null);
  const badgeGaugeRef = useRef<HTMLSpanElement | null>(null);
  const [visibleBadgeCount, setVisibleBadgeCount] = useState<number | null>(null);

  const isExclude = mode === 'exclude';
  const isAdd = mode === 'add';
  const selectedSet = useMemo(() => new Set(value), [value]);
  // 说明文字全部收进标题右侧的「?」，正文里不再堆段落
  const modeHint = isExclude
    ? t('personaConfig.listExcludeHint')
    : isAdd
      ? t('personaConfig.addModePrompt')
      : '';
  const helpText = [help, modeHint].filter(Boolean).join('\n\n');

  /** 已选项的展示名：目录里查不到（配置早于目录）时回落原值，不能整项消失。 */
  const selectedLabels = useMemo(() => {
    const byValue = new Map(items.map((item) => [item.value, item.label]));
    return value.map((v) => ({ key: v, label: byValue.get(v) ?? v }));
  }, [items, value]);

  /**
   * 收起态徽标溢出：CSS 猜不出「几个徽标 + 一个 +N 徽标」能不能塞进 trigger，
   * 这里用隐藏 gauge 实测每个徽标的右边界，宁可少放一个也不许横向溢出。
   * gauge 里额外放一个「+{总数}」徽标预留溢出位，宽度按最大位数算，避免震荡。
   */
  useLayoutEffect(() => {
    const box = badgeBoxRef.current;
    const gauge = badgeGaugeRef.current;
    const total = selectedLabels.length;
    if (!box || !gauge || total === 0) {
      setVisibleBadgeCount(null);
      return;
    }
    const measure = () => {
      const badges = Array.from(gauge.children) as HTMLElement[];
      if (badges.length === 0) return;
      const edges = badges.map((badge) => badge.offsetLeft + badge.offsetWidth);
      const available = box.clientWidth;
      if (edges[total - 1] <= available) {
        setVisibleBadgeCount(total);
        return;
      }
      const gap = Number.parseFloat(getComputedStyle(gauge).columnGap) || BADGE_GAP;
      const overflowWidth = badges[badges.length - 1].offsetWidth;
      let fit = 0;
      while (fit < total) {
        const prefix = fit === 0 ? 0 : edges[fit - 1];
        if (prefix + gap + overflowWidth > available) break;
        fit += 1;
      }
      setVisibleBadgeCount(fit);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [selectedLabels]);

  const shownBadgeCount =
    visibleBadgeCount === null
      ? selectedLabels.length
      : Math.min(visibleBadgeCount, selectedLabels.length);
  const hiddenBadgeCount = selectedLabels.length - shownBadgeCount;

  const visibleGroups = useMemo(() => {
    if (!groups) return null;
    if (filterValue === '__all__') return groups;
    return groups.filter((g) => g.key === filterValue);
  }, [groups, filterValue]);

  const matches = (item: CheckListItem, keyword: string) => {
    if (!keyword) return true;
    const hay = item.searchText ?? `${item.label}\n${item.description ?? ''}`.toLowerCase();
    return hay.includes(keyword);
  };

  const rows = useMemo<Row[]>(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    if (!groups) {
      return items
        .filter((item) => matches(item, keyword))
        .map((item) => ({
          kind: 'item' as const,
          key: item.value,
          item,
        }));
    }
    const out: Row[] = [];
    for (const group of visibleGroups ?? []) {
      const hit = group.items.filter((item) => matches(item, keyword));
      if (hit.length === 0) continue;
      out.push({
        kind: 'header',
        key: `h:${group.key}`,
        label: group.label,
        count: hit.length,
        total: group.count ?? group.items.length,
      });
      for (const item of hit) out.push({ kind: 'item', key: `${group.key}:${item.value}`, item });
    }
    return out;
  }, [deferredQuery, groups, items, visibleGroups]);

  // 搜索 / 筛选变化后收起分页游标
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery, filterValue, open]);

  // 打开时清掉上次的搜索词，并把焦点交给搜索框（否则「浏览」也要先点一下）
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery('');
      setVisibleCount(PAGE_SIZE);
    }
  };

  /**
   * 滚到底部继续渲染下一批。
   *
   * 不用 IntersectionObserver：浮层经 `PopoverPrimitive.Portal` 挂到 body，而 Radix 的
   * `Portal` 首帧渲染 `null`、到 layout effect 才真正挂载。`open` 翻 true 的那次 commit
   * 里 `scrollRef` / `sentinelRef` 都还是 null，effect 直接 return，之后依赖项再也不变，
   * observer 就永远建不起来——症状是无论怎么滚都停在第一页 30 行、底部一直转「加载中」。
   * `onScroll` 绑在 JSX 上，没有这个时序问题。
   */
  const handleListScroll = () => {
    const el = scrollRef.current;
    if (!el || visibleCount >= rows.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, rows.length));
    }
  };

  const shown = rows.slice(0, visibleCount);
  const selectableItems = useMemo(
    () => (groups ? (visibleGroups ?? []).flatMap((g) => g.items) : items),
    [groups, items, visibleGroups],
  );
  const allSelected =
    selectableItems.length > 0 && selectableItems.every((i) => selectedSet.has(i.value));
  const selectedTotal = items.filter((i) => selectedSet.has(i.value)).length;

  const toggle = (itemValue: string) => {
    onChange(
      selectedSet.has(itemValue) ? value.filter((n) => n !== itemValue) : [...value, itemValue],
    );
  };

  const setAll = (on: boolean) => {
    const scope = new Set(selectableItems.map((i) => i.value));
    if (on) onChange(Array.from(new Set([...value, ...scope])));
    else onChange(value.filter((n) => !scope.has(n)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <LabelWithHelp
            icon={icon}
            label={label}
            description={helpText || undefined}
            className="text-base font-medium"
          />
        </div>
        {mode === 'include' && (
          <div className="flex shrink-0 items-center gap-1">
            {showSelectAll && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setAll(true)}
                disabled={allSelected}
              >
                {t('personaConfig.listSelectAll')}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setAll(false)}
              disabled={selectedTotal === 0}
            >
              {t('personaConfig.listSelectNone')}
            </Button>
          </div>
        )}
      </div>

      {/* 收起态：已选项以徽标铺在 trigger 里，放不下就折成 +N */}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn('w-full justify-between gap-2 font-normal', isExclude && 'border-dashed')}
          >
            <span
              ref={badgeBoxRef}
              className="relative flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
            >
              {selectedLabels.length === 0 ? (
                <span className="truncate text-left text-sm text-muted-foreground">
                  {isExclude
                    ? t('personaConfig.listExcludeAction')
                    : isAdd
                      ? t('personaConfig.addModeAction')
                      : t('personaConfig.listExpand', { count: 0 })}
                </span>
              ) : (
                <>
                  {selectedLabels.slice(0, shownBadgeCount).map(({ key, label }) => (
                    <Badge
                      key={key}
                      variant="secondary"
                      className="max-w-[10rem] shrink-0 truncate px-2 py-0 text-[11px] font-normal"
                    >
                      {label}
                    </Badge>
                  ))}
                  {hiddenBadgeCount > 0 && (
                    <Badge
                      variant="outline"
                      className="shrink-0 px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                    >
                      +{hiddenBadgeCount}
                    </Badge>
                  )}
                </>
              )}
              {/* 量宽用：不参与布局，只测原始徽标宽度 */}
              <span
                ref={badgeGaugeRef}
                aria-hidden
                className="invisible pointer-events-none absolute left-0 top-0 flex w-max gap-1.5 whitespace-nowrap"
              >
                {selectedLabels.map(({ key, label }) => (
                  <Badge
                    key={`gauge-${key}`}
                    variant="secondary"
                    className="shrink-0 whitespace-nowrap px-2 py-0 text-[11px] font-normal"
                  >
                    {label}
                  </Badge>
                ))}
                {selectedLabels.length > 0 && (
                  <Badge
                    variant="outline"
                    className="shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] font-normal"
                  >
                    +{selectedLabels.length}
                  </Badge>
                )}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 opacity-60 transition-transform',
                open && 'rotate-180',
              )}
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn('p-2', popoverWidth)}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchRef.current?.focus();
          }}
        >
          <div className="space-y-2">
            {/* 搜索与二级筛选：同一行、同一高度档 */}
            <div className={cn('grid gap-2', filter ? 'grid-cols-[1fr_150px]' : 'grid-cols-1')}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className={cn(CONTROL_H, 'pl-9 text-sm')}
                />
              </div>
              {filter && (
                <SearchableMenu
                  appearance="field"
                  width="trigger"
                  align="end"
                  className={cn(CONTROL_H, 'text-sm')}
                  placeholder={filter.allLabel}
                  value={filterValue}
                  onValueChange={setFilterValue}
                  items={[
                    { value: '__all__', label: filter.allLabel },
                    ...filter.options.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                      icon: opt.icon,
                    })),
                  ]}
                />
              )}
            </div>

            {/*
              滚轮必须在冒泡期拦：persona Sheet（Radix Dialog）开着时 react-remove-scroll
              在 document 上挂了非 passive 的 wheel 监听，本浮层 portal 到 body、不在它的
              shards 里，事件一冒泡到 document 就被 preventDefault，列表明明能滚也滚不动。
              在这里 stopPropagation 只断传播、不动默认行为，原生滚动照旧发生。
              不能用捕获期：容器是各行的祖先，拦下来事件到不了 target，Chromium 同样不滚。
            */}
            <div
              ref={scrollRef}
              onWheel={(event) => event.stopPropagation()}
              onScroll={handleListScroll}
              className={cn(
                LIST_MAX_H,
                'overflow-y-auto overscroll-contain rounded-lg border border-border/60',
              )}
            >
              {shown.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">{emptyText}</div>
              ) : (
                <div className="p-1.5">
                  {shown.map((row) =>
                    row.kind === 'header' ? (
                      <div
                        key={row.key}
                        className="sticky top-0 z-10 flex items-center justify-between rounded-md bg-muted/95 px-2.5 py-1.5 backdrop-blur"
                      >
                        <span className="truncate text-xs font-semibold">{row.label}</span>
                        <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
                          {row.count === row.total
                            ? String(row.total)
                            : `${row.count}/${row.total}`}
                        </Badge>
                      </div>
                    ) : (
                      <CheckListRow
                        key={row.key}
                        item={row.item}
                        checked={selectedSet.has(row.item.value)}
                        onToggle={() => toggle(row.item.value)}
                        alwaysLabel={alwaysLabel}
                        tone={isExclude ? 'danger' : 'default'}
                      />
                    ),
                  )}
                  {visibleCount < rows.length && (
                    <div className="flex items-center justify-center gap-2 py-3">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {t('personaConfig.listLoadingMore', {
                          shown: shown.length,
                          total: rows.length,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isExclude && (
              <div className="flex items-center justify-end px-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2 text-xs"
                  onClick={() => onChange([])}
                  disabled={selectedTotal === 0}
                >
                  {t('personaConfig.listExcludeReset')}
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/*
        摘要行固定放在触发器下方，不要挪回标题和触发器之间：
        并排栅格里（能力档位 | 启用工具）它会把 trigger 推得比同行控件低一行。
        PopoverContent 走 portal 不占布局，收起/展开它都在原位。
      */}
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
    </div>
  );
}

function CheckListRow({
  item,
  checked,
  onToggle,
  alwaysLabel,
  tone = 'default',
}: {
  item: CheckListItem;
  checked: boolean;
  onToggle: () => void;
  alwaysLabel?: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        'flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-accent/50',
        checked && (tone === 'danger' ? 'bg-destructive/10' : 'bg-primary/10'),
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        className="mt-0.5"
      />
      {item.icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'truncate text-sm font-medium',
              tone === 'danger' && checked && 'line-through',
            )}
          >
            {item.label}
          </span>
          {item.tone === 'always' && alwaysLabel && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {alwaysLabel}
            </Badge>
          )}
          {typeof item.meta === 'string' ? (
            <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
              {item.meta}
            </Badge>
          ) : (
            item.meta
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
        )}
      </div>
    </div>
  );
}
