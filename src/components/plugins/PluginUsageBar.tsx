import { useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PluginIcon } from '@/components/ui/plugin-icon';
import { SearchableMenu } from '@/components/ui/searchable-menu';
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
 * 插件页头的插件下拉。常用插件排在前面。
 * 按钮是 outline，不带 combobox 角色，避免被全局输入框样式染成另一种底色。
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

  return (
    <SearchableMenu
      appearance="outline"
      width="trigger"
      align="end"
      disabled={plugins.length === 0}
      className={cn(className)}
      placeholder={t('plugins.selectPlugin')}
      placeholderIcon={<LayoutGrid className="h-4 w-4" />}
      searchPlaceholder={t('plugins.searchPlugin')}
      emptyText={t('plugins.noMatchingPlugin')}
      value={value}
      onValueChange={onValueChange}
      items={ordered.map((plugin) => ({
        value: plugin.id,
        label: plugin.name,
        keywords: [plugin.name, plugin.id],
        icon: <PluginIcon pluginName={plugin.name} className="h-4 w-4" />,
      }))}
    />
  );
}
