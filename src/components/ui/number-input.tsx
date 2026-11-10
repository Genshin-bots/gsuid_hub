import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface NumberInputProps
  extends Omit<React.ComponentProps<'input'>, 'type' | 'value' | 'onChange' | 'step'> {
  value: number | string;
  onValueChange: (value: number | string) => void;
  min?: number;
  max?: number;
  step?: number;
  allowFloat?: boolean;
  suffix?: React.ReactNode;
  compact?: boolean;
  containerClassName?: string;
}

function getDecimalPlaces(num: number): number {
  const s = String(num);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

function clampNumber(val: number, min?: number, max?: number): number {
  let next = val;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return next;
}

/**
 * 主题自适应数值输入框：
 * 屏蔽浏览器原生白色微调箭头，提供与毛玻璃/纯色/光感/液态主题一致的 − / + 步进器与可选内联单位后缀。
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onValueChange,
      min,
      max,
      step = 1,
      allowFloat = false,
      suffix,
      compact = false,
      disabled,
      className,
      containerClassName,
      onBlur,
      onKeyDown,
      onWheel,
      ...props
    },
    ref,
  ) => {
    const parsedCurrent =
      typeof value === 'number'
        ? value
        : allowFloat
          ? Number.parseFloat(String(value))
          : Number.parseInt(String(value), 10);
    const hasNumeric = !Number.isNaN(parsedCurrent) && Number.isFinite(parsedCurrent);

    const applyStep = (direction: 1 | -1) => {
      if (disabled) return;
      const base = hasNumeric ? parsedCurrent : min !== undefined && min > 0 ? min : 0;
      const decimals = Math.max(getDecimalPlaces(base), getDecimalPlaces(step));
      const rawNext = base + direction * step;
      const rounded =
        decimals > 0 ? Number.parseFloat(rawNext.toFixed(decimals)) : Math.round(rawNext);
      onValueChange(clampNumber(rounded, min, max));
    };

    const atMin = hasNumeric && min !== undefined && parsedCurrent <= min;
    const atMax = hasNumeric && max !== undefined && parsedCurrent >= max;

    const rightPadClass = compact
      ? suffix
        ? 'pr-[5.25rem]'
        : 'pr-[3.5rem]'
      : suffix
        ? 'pr-[6.5rem]'
        : 'pr-[4.5rem]';

    return (
      <div className={cn('relative min-w-0', containerClassName)}>
        <Input
          ref={ref}
          type="number"
          step="any"
          inputMode={allowFloat ? 'decimal' : 'numeric'}
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '' || raw === '-' || (allowFloat && /^-?\d*\.$/.test(raw))) {
              onValueChange(raw);
              return;
            }
            const parsed = allowFloat ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
            onValueChange(Number.isNaN(parsed) ? raw : parsed);
          }}
          onBlur={(e) => {
            if (hasNumeric) {
              const clamped = clampNumber(parsedCurrent, min, max);
              if (clamped !== parsedCurrent) {
                onValueChange(clamped);
              }
            }
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              applyStep(1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              applyStep(-1);
            }
            onKeyDown?.(e);
          }}
          onWheel={(e) => {
            e.currentTarget.blur();
            onWheel?.(e);
          }}
          className={cn(
            'bg-background/60 font-mono tabular-nums',
            compact ? 'h-9 text-xs' : 'h-10 text-sm',
            rightPadClass,
            className,
          )}
          {...props}
        />

        <div className="absolute inset-y-[1px] right-[1px] flex items-center">
          {suffix !== undefined && suffix !== null && (
            <span className="pointer-events-none select-none pr-2 text-xs text-muted-foreground">
              {suffix}
            </span>
          )}
          <div className="flex h-full items-stretch border-l border-border/45">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || atMin}
              onClick={() => applyStep(-1)}
              aria-label="Decrease"
              className={cn(
                'inline-flex items-center justify-center border-r border-border/45 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground active:bg-primary/15 disabled:pointer-events-none disabled:opacity-35',
                compact ? 'w-6' : 'w-8',
              )}
            >
              <Minus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled || atMax}
              onClick={() => applyStep(1)}
              aria-label="Increase"
              className={cn(
                'inline-flex items-center justify-center rounded-r-[calc(var(--radius)-3px)] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground active:bg-primary/15 disabled:pointer-events-none disabled:opacity-35',
                compact ? 'w-6' : 'w-8',
              )}
            >
              <Plus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </button>
          </div>
        </div>
      </div>
    );
  },
);

NumberInput.displayName = 'NumberInput';
