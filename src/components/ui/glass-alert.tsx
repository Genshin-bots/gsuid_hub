import type { ReactNode } from 'react';
import { AlertCircle, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type GlassAlertTone = 'primary' | 'info' | 'warning' | 'danger';

const TONE_STYLES: Record<GlassAlertTone, { shell: string; tint: string; icon: string }> = {
  primary: {
    shell: 'border border-primary/35 text-foreground',
    tint: 'glass-alert-tint glass-alert-tint-primary',
    icon: 'text-primary',
  },
  info: {
    shell: 'border border-blue-500/35 text-blue-700 dark:border-blue-400/35 dark:text-blue-300',
    tint: 'glass-alert-tint glass-alert-tint-info',
    icon: '',
  },
  warning: {
    shell: 'border border-amber-500/40 text-amber-700 dark:border-amber-400/40 dark:text-amber-300',
    tint: 'glass-alert-tint glass-alert-tint-warning',
    icon: '',
  },
  danger: {
    shell: 'border border-destructive/40 text-destructive',
    tint: 'glass-alert-tint glass-alert-tint-danger',
    icon: '',
  },
};

/**
 * 语义提醒条：glass-card 提供主题玻璃，色调通过 CSS 变量画进玻璃的 ::before，
 * 这样毛玻璃/光感/液态下都是“带色的玻璃”，而不是覆盖一层平涂色块。
 */
export function GlassAlert({
  tone = 'warning',
  icon: Icon = AlertCircle,
  className,
  contentClassName,
  children,
}: {
  tone?: GlassAlertTone;
  icon?: LucideIcon;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const toneStyle = TONE_STYLES[tone];
  return (
    <div
      className={cn(
        'relative flex min-w-0 items-start gap-2 rounded-lg p-3 text-sm glass-card glass-alert',
        toneStyle.shell,
        toneStyle.tint,
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', toneStyle.icon)} />
      <div className={cn('min-w-0 break-words', contentClassName)}>{children}</div>
    </div>
  );
}
