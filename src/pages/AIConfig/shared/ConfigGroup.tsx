import { useContext, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { inConfigGroupListContext } from './configGroupListContext';

export interface ConfigGroupProps {
  /** 组标签前图标，调用方传 `w-4 h-4 text-muted-foreground` */
  icon?: ReactNode;
  /** 组标签 */
  label: ReactNode;
  /** 标签右侧 `?` tooltip；string 按 Markdown 渲染 */
  description?: ReactNode;
  /** 标签行右侧操作区 */
  actions?: ReactNode;
  /**
   * `inline`：sm+ 标签与内容同行（标签列宽自适应内容、单行不换行，
   * 上限 14rem 截断），适合「短标签 + 一行控件（Chip 行等）」；
   * 放进 `ConfigGroupList` 时多个组的标签共享同一列宽；窄屏退回 stacked。
   */
  layout?: 'stacked' | 'inline';
  children: ReactNode;
  className?: string;
}

/**
 * 卡片内的字段分组：小号标签（LabelWithHelp）+ 内容区。
 * 替代散落的 `LabelWithHelp className="text-xs ..."` 组标签用法。
 */
export function ConfigGroup({
  icon,
  label,
  description,
  actions,
  layout = 'stacked',
  children,
  className,
}: ConfigGroupProps) {
  const inline = layout === 'inline';
  const inList = useContext(inConfigGroupListContext);
  return (
    <div
      className={cn(
        inline &&
          !inList &&
          'sm:grid sm:grid-cols-[max-content_minmax(0,1fr)] sm:items-start sm:gap-x-4',
        inline && inList && 'sm:contents',
        className,
      )}
    >
      <div
        className={cn(
          'flex min-w-0 items-center justify-between gap-3',
          inline && 'sm:max-w-[14rem] sm:pt-2',
        )}
      >
        <LabelWithHelp
          icon={icon}
          label={label}
          description={description}
          className="min-w-0 truncate text-sm font-medium"
        />
        {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn('mt-2 min-w-0 space-y-3', inline && 'sm:mt-0 sm:space-y-2')}>
        {children}
      </div>
    </div>
  );
}
