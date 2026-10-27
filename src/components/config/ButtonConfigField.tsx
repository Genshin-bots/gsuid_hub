import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ConfigButtonState, ConfigFieldDefinition } from './ConfigField';

function readState(value: ConfigFieldDefinition['value']): ConfigButtonState {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'phase' in value) {
    const raw = value;
    const fields =
      raw.fields && typeof raw.fields === 'object' && !Array.isArray(raw.fields) ? raw.fields : {};
    return {
      phase: typeof raw.phase === 'string' ? raw.phase : 'idle',
      progress: typeof raw.progress === 'number' ? raw.progress : 0,
      message: typeof raw.message === 'string' ? raw.message : '',
      fields,
    };
  }
  return { phase: 'idle', progress: 0, message: '', fields: {} };
}

function phaseLabel(phase: string, t: (key: string) => string): string {
  if (phase === 'running') return t('plugins.buttonRunning');
  if (phase === 'success') return t('plugins.buttonSuccess');
  if (phase === 'error') return t('plugins.buttonError');
  return t('plugins.buttonIdle');
}

function phaseClass(phase: string): string {
  if (phase === 'running') return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
  if (phase === 'success') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  if (phase === 'error') return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-muted-foreground';
}

// tooltip 状态行的文字色，和按钮内状态图标（index.css 的 data-state-icon）用同一套色值，
// 保证「绿勾 + 绿字」是同一个绿，不会出现图标和文字对不上。
function phaseTextClass(phase: string): string {
  if (phase === 'running') return 'text-[hsl(199_89%_48%)] dark:text-[hsl(199_89%_62%)]';
  if (phase === 'success') return 'text-[hsl(152_76%_45%)] dark:text-[hsl(152_69%_58%)]';
  if (phase === 'error') return 'text-destructive';
  return 'text-muted-foreground';
}

function buttonClass(level: string): string {
  if (level === 'success') return 'bg-emerald-600 text-white hover:bg-emerald-700';
  if (level === 'warning') return 'bg-amber-500 text-white hover:bg-amber-600';
  if (level === 'info') return 'bg-sky-600 text-white hover:bg-sky-700';
  return '';
}

function wideStatus(value: string): boolean {
  return value.length > 40 || value.includes('\\') || value.includes('/');
}

// tooltip 里的长值（通常是安装路径）不换行，溢出时在末尾补 "...."。
// 用「测量是否溢出」而不是写死字符数：标签宽度、字体、主题都不同，写死长度会截早或截晚。
function TruncatedValue({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <>
      <span
        ref={ref}
        className="min-w-0 flex-1 overflow-hidden whitespace-nowrap font-semibold"
        title={value}
      >
        {value}
      </span>
      {clipped ? <span className="shrink-0 font-semibold">....</span> : null}
    </>
  );
}

function PhaseIcon({ phase, className }: { phase: string; className?: string }) {
  // data-state-icon 由 index.css 提权着色：全局图标色规则会把按钮内图标压成继承色。
  if (phase === 'running')
    return <Loader2 className={cn('h-4 w-4 animate-spin', className)} data-state-icon="running" />;
  if (phase === 'success')
    return <CircleCheck className={cn('h-4 w-4', className)} data-state-icon="success" />;
  if (phase === 'error')
    return <CircleAlert className={cn('h-4 w-4', className)} data-state-icon="error" />;
  return <Download className={cn('h-4 w-4', className)} data-state-icon="idle" />;
}

export function ButtonConfigField({
  field,
  compact = false,
}: {
  field: ConfigFieldDefinition;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const endpoint = field.endpoint || '';
  const [state, setState] = useState<ConfigButtonState>(() => readState(field.value));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pollMs = Math.max(300, field.pollMs || 800);
  const showProgress = field.showProgress !== false;

  useEffect(() => {
    setState(readState(field.value));
  }, [field.value]);

  useEffect(() => {
    if (state.phase !== 'running' || !endpoint) return;
    let stopped = false;
    const timer = window.setInterval(() => {
      void api
        .get<ConfigButtonState>(endpoint)
        .then((next) => {
          if (!stopped) setState(readState(next));
        })
        .catch((error: unknown) => {
          if (stopped) return;
          const message = error instanceof Error ? error.message : String(error);
          setState((prev) => ({ ...prev, phase: 'error', message }));
        });
    }, pollMs);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [endpoint, pollMs, state.phase]);

  const run = async () => {
    if (!endpoint) return;
    setState((prev) => ({
      ...prev,
      phase: 'running',
      progress: 0,
      message: t('plugins.buttonWorking'),
    }));
    try {
      const next = await api.post<ConfigButtonState>(endpoint);
      setState(readState(next));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, phase: 'error', message }));
      toast.error(message);
    }
  };

  const onClick = () => {
    if (field.confirmText) {
      setConfirmOpen(true);
      return;
    }
    void run();
  };

  const rows = (field.statusFields || []).flatMap((row) => {
    const value = state.fields[row.key];
    if (!value) return [];
    return [{ label: row.label, value }];
  });

  const dialog = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('plugins.buttonConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{field.confirmText}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void run();
            }}
          >
            {field.buttonLabel || field.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (compact) {
    return (
      <>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  variant="default"
                  className={cn(
                    tabToolbarControlClass,
                    // 不加 button-solid：主色按钮跟随当前主题（毛玻璃 / 光感 / 液态 / 纯色）
                    'gap-2 whitespace-nowrap px-4',
                  )}
                  disabled={!endpoint || state.phase === 'running'}
                  onClick={onClick}
                >
                  <PhaseIcon phase={state.phase} />
                  {field.buttonLabel || field.label}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm space-y-1 text-left">
              {/* 状态行：图标 + 状态文字按状态变色（成功=绿勾绿字），补充信息保持中性色 */}
              <div className={cn('flex items-center gap-1.5', phaseTextClass(state.phase))}>
                <PhaseIcon phase={state.phase} className="h-3.5 w-3.5 shrink-0" />
                <p className="min-w-0 break-words font-medium">
                  {phaseLabel(state.phase, t)}
                  {state.message ? (
                    <span className="text-muted-foreground"> · {state.message}</span>
                  ) : null}
                </p>
              </div>
              {showProgress && state.phase === 'running' ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, state.progress))}%` }}
                  />
                </div>
              ) : null}
              {rows.map((row) => (
                // 路径这类长值在 tooltip 里会撑破容器被裁掉，这里截断成省略号，完整值走 title 悬浮显示
                <div key={row.label} className="flex items-baseline text-xs">
                  <span className="shrink-0 text-muted-foreground">{row.label}</span>
                  <span className="ml-2 flex min-w-0 flex-1 items-baseline">
                    <TruncatedValue value={row.value} />
                  </span>
                </div>
              ))}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {dialog}
      </>
    );
  }

  const compactRows = rows.filter((row) => !wideStatus(row.value));
  const wideRows = rows.filter((row) => wideStatus(row.value));

  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2">
        <span className={cn('rounded-full px-2 py-0.5 text-xs', phaseClass(state.phase))}>
          {phaseLabel(state.phase, t)}
        </span>
        {state.message ? <span className="text-sm">{state.message}</span> : null}
      </div>
      {showProgress && state.phase === 'running' ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.max(0, Math.min(100, state.progress))}%` }}
          />
        </div>
      ) : null}
      {compactRows.length > 0 ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {compactRows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-xs leading-4 text-muted-foreground">{row.label}</dt>
              <dd className="truncate text-sm font-semibold leading-5" title={row.value}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className={cn('flex items-end justify-end gap-4', rows.length > 0 && 'mt-2')}>
        {wideRows.length > 0 ? (
          <dl className="min-w-0 flex-1 space-y-2">
            {wideRows.map((row) => (
              <div key={row.label}>
                <dt className="text-xs leading-4 text-muted-foreground">{row.label}</dt>
                <dd className="break-all text-sm font-semibold leading-5">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant={field.level === 'danger' ? 'destructive' : 'default'}
          className={cn('shrink-0', buttonClass(field.level || 'primary'))}
          disabled={!endpoint || state.phase === 'running'}
          onClick={onClick}
        >
          {state.phase === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {field.buttonLabel || field.label}
        </Button>
      </div>
      {dialog}
    </div>
  );
}
