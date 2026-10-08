import { useMemo } from 'react';
import { Check, ChevronDown, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  className?: string;
}

function pluginRank(plugin: PluginListItem, rank: Map<string, number>) {
  const byName = rank.get(plugin.name.toLowerCase());
  if (byName !== undefined) return byName;
  return rank.get(plugin.id.toLowerCase());
}

/**
 * 单个插件下拉。常用插件排在前面。
 * 触发器与页头 outline `size="sm"` 按钮同高（h-9）。
 */
export function PluginUsageBar({
  plugins,
  usageNames,
  value,
  onValueChange,
  className,
}: PluginUsageBarProps) {
  const { t } = useLanguage();

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

  const selected = ordered.find((plugin) => plugin.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={plugins.length === 0}
          className={cn('min-w-0 justify-between gap-2 px-3', className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {selected ? (
                <PluginIcon pluginName={selected.name} className="h-4 w-4" />
              ) : (
                <LayoutGrid className="h-4 w-4" />
              )}
            </span>
            <span className="truncate">{selected?.name || t('plugins.selectPlugin')}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem] max-h-72 overflow-y-auto">
        {ordered.map((plugin) => {
          const isSelected = plugin.id === value;
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
                  isSelected ? 'opacity-100' : 'opacity-0',
                )}
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
