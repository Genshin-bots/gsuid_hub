import { AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface SidebarItemProps {
  id: string;
  activeSection: string;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  alert?: boolean;
  collapsed?: boolean;
  onClick: (id: string) => void;
}

/**
 * AIConfig 页面侧边栏中的单个条目。
 * - 折叠态（移动端）：仅图标 + Tooltip 悬浮显示标题
 * - 展开态（桌面端）：图标 + 标题 + 警告标记
 */
export function SidebarItem({
  id,
  activeSection,
  icon,
  title,
  disabled,
  alert,
  collapsed,
  onClick,
}: SidebarItemProps) {
  const isActive = activeSection === id;

  const button = (
    <button
      onClick={() => !disabled && onClick(id)}
      disabled={disabled}
      title={collapsed ? title : undefined}
      className={cn(
        'w-full flex items-center rounded-lg text-sm transition-all duration-200 text-left',
        collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-2',
        isActive
          ? 'bg-primary/10 text-primary shadow-sm'
          : disabled
            ? 'text-muted-foreground/40 cursor-not-allowed'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center flex-shrink-0 transition-colors relative',
          isActive ? 'text-primary' : 'text-muted-foreground/60',
        )}
      >
        {icon}
        {collapsed && alert && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
        )}
      </div>
      {!collapsed && (
        <>
          <span className={cn('font-medium', isActive && 'text-primary')}>
            {title}
          </span>
          {alert && (
            <span className="shrink-0 ml-auto text-red-500" data-alert-icon>
              <AlertTriangle className="w-3.5 h-3.5" data-alert-icon />
            </span>
          )}
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right">
            <p>{title}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
