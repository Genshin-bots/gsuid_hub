import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { asHoverIcon, hoverIconGroupClass } from '@/components/layout/SidebarHoverIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PluginListItem } from '@/lib/api';

interface PluginUsageBarProps {
  plugins: PluginListItem[];
  /** 按触发次数从高到低的插件名。没有统计的插件不在这里。 */
  usageNames: string[];
  value: string;
  onValueChange: (pluginId: string) => void;
}

function pluginRank(plugin: PluginListItem, rank: Map<string, number>) {
  const byName = rank.get(plugin.name.toLowerCase());
  if (byName !== undefined) return byName;
  return rank.get(plugin.id.toLowerCase());
}

/**
 * 常用插件排在前面，凑满一行后最后一个是其余插件的下拉。
 * 宽度随工具栏变化，不写死个数。
 */
export function PluginUsageBar({ plugins, usageNames, value, onValueChange }: PluginUsageBarProps) {
  const { t } = useLanguage();
  const barRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pinnedCount, setPinnedCount] = useState(0);

  const ordered = useMemo(() => {
    const rank = new Map(usageNames.map((name, index) => [name.toLowerCase(), index]));
    return [...plugins].sort((a, b) => {
      const ra = pluginRank(a, rank);
      const rb = pluginRank(b, rank);
      if (ra !== undefined && rb !== undefined && ra !== rb) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [plugins, usageNames]);

  const pinned = ordered.slice(0, pinnedCount);
  const overflow = ordered.slice(pinnedCount);
  const selected = ordered.find((plugin) => plugin.id === value);
  const overflowSelected = overflow.find((plugin) => plugin.id === value);
  const moreLabel = overflowSelected?.name || t('plugins.morePlugins');

  useLayoutEffect(() => {
    const bar = barRef.current;
    const measure = measureRef.current;
    if (!bar || !measure) return;

    const measureRow = () => {
      const style = getComputedStyle(bar);
      const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const gap = parseFloat(style.columnGap || style.gap) || 0;
      const available = bar.clientWidth - pad;
      const buttons = [...measure.querySelectorAll<HTMLElement>('[data-plugin-measure]')];
      const more = measure.querySelector<HTMLElement>('[data-more-measure]');
      const moreWidth = more?.offsetWidth ?? 0;
      let used = moreWidth;
      let count = 0;
      for (const button of buttons) {
        const next = used + (count > 0 || moreWidth > 0 ? gap : 0) + button.offsetWidth;
        if (next > available + 0.5) break;
        used = next;
        count += 1;
      }
      setPinnedCount((prev) => (prev === count ? prev : count));
    };

    measureRow();
    const observer = new ResizeObserver(measureRow);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [ordered, moreLabel]);

  if (plugins.length === 0) return null;

  const buttonClass = (active: boolean) =>
    cn(
      hoverIconGroupClass,
      'relative flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-all duration-200 sm:px-4',
      active
        ? 'bg-primary text-primary-foreground [&_svg]:text-current'
        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground [&_svg]:text-current',
    );

  const renderMeasure = (
    <div
      ref={measureRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 -z-10 flex opacity-0"
    >
      {ordered.map((plugin) => (
        <button key={plugin.id} type="button" data-plugin-measure className={buttonClass(false)}>
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
            <PluginIcon pluginName={plugin.name} />
          </span>
          {plugin.name}
        </button>
      ))}
      <button type="button" data-more-measure className={cn(buttonClass(false), 'gap-0 p-0')}>
        <span className="flex items-center gap-2 px-2.5 py-2 sm:pl-4 sm:pr-2">
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
            {overflowSelected ? (
              <PluginIcon pluginName={overflowSelected.name} />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </span>
          {moreLabel}
        </span>
        <span className="px-2.5">
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  );

  return (
    <div className="min-w-0 max-w-full">
      {renderMeasure}
      {/* 移动端：整行铺满的「当前插件 ▾」，比左对齐的窄胶囊更像一个可点的控件 */}
      <div className="w-full max-w-full shadow-safe md:hidden">
        <div className="flex w-full min-w-0 max-w-full rounded-lg p-1 glass-card">
          <PluginMenu
            plugins={ordered}
            value={value}
            onValueChange={onValueChange}
            label={selected?.name || t('plugins.selectPlugin')}
            fullWidth
            icon={
              selected ? (
                <PluginIcon pluginName={selected.name} />
              ) : (
                <LayoutGrid className="h-4 w-4" />
              )
            }
          />
        </div>
      </div>
      <div
        ref={barRef}
        className="hidden w-full min-w-0 flex-nowrap items-center gap-1 rounded-lg p-1 glass-card md:flex"
      >
        {pinned.map((plugin) => {
          const active = plugin.id === value;
          return (
            <button
              key={plugin.id}
              type="button"
              onClick={() => onValueChange(plugin.id)}
              className={buttonClass(active)}
            >
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                {asHoverIcon(<PluginIcon pluginName={plugin.name} />)}
              </span>
              {plugin.name}
            </button>
          );
        })}
        <PluginMenu
          plugins={overflow}
          value={value}
          onValueChange={onValueChange}
          label={moreLabel}
          icon={
            overflowSelected ? (
              <PluginIcon pluginName={overflowSelected.name} />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )
          }
          active={!!overflowSelected}
          emptyLabel={t('plugins.allPluginsShown')}
        />
      </div>
    </div>
  );
}

function PluginMenu({
  plugins,
  value,
  onValueChange,
  label,
  icon,
  active = true,
  emptyLabel,
  fullWidth = false,
}: {
  plugins: PluginListItem[];
  value: string;
  onValueChange: (pluginId: string) => void;
  label: string;
  icon?: ReactNode;
  active?: boolean;
  emptyLabel?: string;
  /** 移动端整行铺满：行内 flex 只拉伸高度，宽度要显式给 */
  fullWidth?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            hoverIconGroupClass,
            'inline-flex min-w-0 max-w-full items-stretch overflow-hidden rounded-md p-0 text-sm font-medium',
            fullWidth && 'w-full',
            active
              ? 'bg-primary text-primary-foreground [&_svg]:text-current'
              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground [&_svg]:text-current',
          )}
        >
          {/* 铺满时让标签区吃掉剩余宽度，箭头才会被推到右缘；
              否则内容全挤在左侧，右侧留一整条空白。 */}
          <span
            className={cn(
              'flex min-w-0 items-center gap-2 px-2.5 py-2 sm:pl-4 sm:pr-2',
              fullWidth && 'flex-1',
            )}
          >
            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
              {icon != null ? asHoverIcon(icon) : null}
            </span>
            <span className="truncate">{label}</span>
          </span>
          <span
            className={cn(
              'my-1.5 w-px shrink-0 self-stretch',
              active ? 'bg-primary-foreground/25' : 'bg-border/70',
            )}
            aria-hidden
          />
          <span className="flex shrink-0 items-center px-2.5">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem] max-h-72 overflow-y-auto">
        {plugins.length === 0 ? (
          <DropdownMenuItem disabled>{emptyLabel}</DropdownMenuItem>
        ) : (
          plugins.map((plugin) => {
            const selected = plugin.id === value;
            return (
              <DropdownMenuItem
                key={plugin.id}
                onSelect={() => onValueChange(plugin.id)}
                className="cursor-pointer gap-2"
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center [&>img]:h-4 [&>img]:w-4 [&>svg]:h-4 [&>svg]:w-4">
                  <PluginIcon pluginName={plugin.name} />
                </span>
                <span className="min-w-0 flex-1 truncate">{plugin.name}</span>
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0 text-primary',
                    selected ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
