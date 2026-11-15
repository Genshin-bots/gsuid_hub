import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LabelWithHelp } from '@/components/ui/label-with-help';

export interface ConfigCardCollapsible {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ConfigCardProps {
  /** 标题图标，调用方传 `w-5 h-5 text-primary` */
  icon: ReactNode;
  /** 卡片标题 */
  title: ReactNode;
  /** 标题右侧 `?` tooltip；string 按 Markdown 渲染（复用 LabelWithHelp） */
  description?: ReactNode;
  /** 标题行右侧操作区：Switch / Badge / Button；点击不触发折叠 */
  actions?: ReactNode;
  /** 卡片主体；不传时为纯头部卡片；折叠时不渲染 */
  children?: ReactNode;
  /** 可折叠：整个标题行可点击展开/收起，右侧自动渲染 chevron */
  collapsible?: ConfigCardCollapsible;
  className?: string;
  bodyClassName?: string;
}

/**
 * AI 配置页的卡片基元：glass-card 外壳 + 标题行（图标 + 标题 + ? 帮助 + 操作区）。
 * 替代各 section 散落的 h2 标题块；子区块用 ConfigGroup / SettingRow，
 * 卡片内不再叠嵌套面板（一块玻璃面 = 一张卡）。
 */
export function ConfigCard({
  icon,
  title,
  description,
  actions,
  children,
  collapsible,
  className,
  bodyClassName,
}: ConfigCardProps) {
  const titleCluster = (
    <div className="flex min-w-0 items-center gap-2">
      {icon}
      <LabelWithHelp
        label={title}
        description={description}
        className="min-w-0 truncate text-base font-semibold"
      />
    </div>
  );
  const chevron = collapsible ? (
    <ChevronDown
      className={cn(
        'w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200',
        collapsible.open && 'rotate-180',
      )}
    />
  ) : null;
  const actionsCluster = actions != null && (
    <div className="flex shrink-0 items-center gap-2">{actions}</div>
  );
  return (
    <section className={cn('glass-card rounded-xl p-4', className)}>
      {collapsible ? (
        // 整行可点；行内的 ?、操作按钮等交互元素自己处理点击，不触发折叠
        <div
          className="-m-2 flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-colors hover:bg-muted/30"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button, a, input, [role="switch"]')) return;
            collapsible.onOpenChange(!collapsible.open);
          }}
        >
          <div className="min-w-0 flex-1">{titleCluster}</div>
          {actionsCluster}
          <button
            type="button"
            aria-expanded={collapsible.open}
            aria-label={typeof title === 'string' ? title : undefined}
            onClick={() => collapsible.onOpenChange(!collapsible.open)}
            className="shrink-0 rounded-md p-1 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {chevron}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {titleCluster}
          {actionsCluster}
        </div>
      )}
      {children != null && (!collapsible || collapsible.open) && (
        <div className={cn('mt-3 space-y-4', bodyClassName)}>{children}</div>
      )}
    </section>
  );
}
