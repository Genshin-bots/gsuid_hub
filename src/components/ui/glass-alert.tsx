import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type GlassAlertTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';

const TONE_STYLES: Record<GlassAlertTone, { shell: string; tint: string; icon: string }> = {
  primary: {
    shell: 'border border-primary/35 text-foreground',
    tint: 'glass-alert-tint glass-alert-tint-primary',
    icon: 'text-primary',
  },
  neutral: {
    shell: 'border border-border/40 text-muted-foreground',
    tint: '',
    icon: '',
  },
  success: {
    shell: 'border border-green-500/35 text-green-700 dark:border-green-400/35 dark:text-green-300',
    tint: 'glass-alert-tint glass-alert-tint-success',
    icon: '',
  },
  info: {
    shell: 'border border-blue-500/35 text-blue-700 dark:border-blue-400/35 dark:text-blue-300',
    tint: 'glass-alert-tint glass-alert-tint-info',
    icon: '',
  },
  accent: {
    shell:
      'border border-violet-500/35 text-violet-700 dark:border-violet-400/35 dark:text-violet-300',
    tint: 'glass-alert-tint glass-alert-tint-accent',
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

interface GlassAlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: GlassAlertTone;
  icon?: LucideIcon;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * 语义提醒条：glass-card 提供主题玻璃，色调通过 CSS 变量画进玻璃的 ::before，
 * 这样毛玻璃/光感/液态下都是“带色的玻璃”，而不是覆盖一层平涂色块。
 */
export const GlassAlert = forwardRef<HTMLDivElement, GlassAlertProps>(function GlassAlert(
  { tone = 'warning', icon: Icon = AlertCircle, className, contentClassName, children, ...props },
  ref,
) {
  const toneStyle = TONE_STYLES[tone];
  return (
    <div
      ref={ref}
      className={cn(
        'relative flex min-w-0 items-start gap-2 rounded-lg p-3 text-sm glass-card glass-alert',
        toneStyle.shell,
        toneStyle.tint,
        className,
      )}
      {...props}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', toneStyle.icon)} />
      <div className={cn('min-w-0 break-words', contentClassName)}>{children}</div>
    </div>
  );
});
