import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '@/components/ui/label-with-help';

export interface SettingRowProps {
  /** 行首图标，调用方传 `w-4 h-4 text-muted-foreground` */
  icon?: ReactNode;
  title: ReactNode;
  /** 标题下的一行 muted 说明 */
  description?: ReactNode;
  /** 标题右侧 `?` tooltip；string 按 Markdown 渲染 */
  help?: ReactNode;
  /** 右侧控件：Switch / Select / Button */
  control: ReactNode;
  className?: string;
}

/** 供 `divide-y` 列表使用：负 margin 让首尾行对齐卡片内边距 */
export const settingListClass = 'divide-y divide-border/40 -my-3';

/**
 * 卡片内的「标题 + 说明 + 右侧控件」行；放进 divide-y 列表，
 * 用分隔线而非嵌套边框盒表达结构。
 */
export function SettingRow({
  icon,
  title,
  description,
  help,
  control,
  className,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {icon != null && <span className="mt-0.5 flex shrink-0 items-center">{icon}</span>}
        <div className="min-w-0">
          <LabelWithHelp
            label={title}
            description={help}
            className="min-w-0 truncate text-sm font-medium"
          />
          {description != null && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
        </div>
      </div>
      <div className="shrink-0 sm:pl-4">{control}</div>
    </div>
  );
}
