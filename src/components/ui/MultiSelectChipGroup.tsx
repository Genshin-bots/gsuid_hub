import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChipOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  /**
   * 禁用「新选中」。多选模式下若该项已选中，仍允许点掉取消
   * （用于「主用源出现在备用列表中」：可见、标冲突，但不能再勾选上）。
   */
  disabled?: boolean;
  /** 冲突态（如主用又在备用里）— 红色边框提示 */
  conflict?: boolean;
}

export interface ChipGroupProps {
  options: ChipOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  className?: string;
  chipClassName?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  /** 
   * Selection mode: 'multiple' allows multiple selections (default),
   * 'single' allows only one selection at a time
   */
  selectMode?: 'multiple' | 'single';
  /** Show radio-like indicator for single selection mode */
  showRadioIndicator?: boolean;
  /**
   * Multi-select only: show 1-based order index on selected chips
   * (selection order = priority, e.g. fallback lists).
   */
  showOrderIndex?: boolean;
}

/**
 * ChipGroup - A reusable chip selection component
 * 
 * Supports both single and multi-select modes, with customizable styling.
 * 
 * @example Multi-select (default)
 * ```tsx
 * <ChipGroup
 *   options={[
 *     { value: 'mention', label: '提及应答' },
 *     { value: 'schedule', label: '定时巡检' },
 *     { value: 'capture', label: '趣向捕捉', disabled: true },
 *   ]}
 *   value={['mention', 'schedule']}
 *   onValueChange={(newValue) => setSelectedModes(newValue)}
 * />
 * ```
 * 
 * @example Single-select
 * ```tsx
 * <ChipGroup
 *   options={[
 *     { value: 'openai', label: 'OpenAI' },
 *     { value: 'claude', label: 'Claude' },
 *   ]}
 *   value={['openai']}
 *   onValueChange={(newValue) => setProvider(newValue[0])}
 *   selectMode="single"
 *   showRadioIndicator
 * />
 * ```
 */
export function ChipGroup({
  options,
  value,
  onValueChange,
  className,
  chipClassName,
  disabled = false,
  allowEmpty = false,
  selectMode = 'multiple',
  showRadioIndicator = false,
  showOrderIndex = false,
}: ChipGroupProps) {
  const toggleOption = React.useCallback((optionValue: string) => {
    if (disabled) return;

    const option = options.find((o) => o.value === optionValue);
    const isSelected = value.includes(optionValue);

    // option.disabled：禁止未选中时勾选；已选中仍可取消
    if (option?.disabled && !isSelected) return;

    if (selectMode === 'single') {
      if (option?.disabled) return;
      onValueChange([optionValue]);
    } else {
      if (isSelected) {
        if (!allowEmpty && value.length === 1) {
          return;
        }
        onValueChange(value.filter((v) => v !== optionValue));
      } else {
        onValueChange([...value, optionValue]);
      }
    }
  }, [value, onValueChange, disabled, allowEmpty, selectMode, options]);

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value.includes(option.value);
        // 未选中且 disabled → 不可点；已选中的 disabled 仍可点掉
        const lockSelect = option.disabled && !isSelected;
        const isHardDisabled = disabled || lockSelect;
        // 仅显式 conflict 走冲突样式；disabled+selected 用于「主用可见不可勾选」等场景，不应误标红
        const isConflict = Boolean(option.conflict);
        const orderIndex =
          showOrderIndex && selectMode === 'multiple' && isSelected
            ? value.indexOf(option.value) + 1
            : 0;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => toggleOption(option.value)}
            disabled={isHardDisabled}
            aria-disabled={option.disabled || disabled || undefined}
            title={
              option.disabled && !isSelected
                ? option.label
                : option.conflict || isConflict
                  ? option.label
                  : orderIndex > 0
                    ? `#${orderIndex}`
                    : undefined
            }
            className={cn(
              "p-2.5 rounded-lg border-2 transition-all flex items-center gap-2",
              "active:scale-[0.98]",
              isSelected
                ? isConflict
                  ? "border-destructive bg-destructive/10"
                  : "border-primary bg-primary/10"
                : "border-border hover:border-primary/50",
              isHardDisabled && "opacity-50 cursor-not-allowed hover:border-border",
              isConflict && isSelected && "opacity-100",
              chipClassName
            )}
          >
            {orderIndex > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded text-[10px] font-semibold tabular-nums",
                  isConflict
                    ? "bg-destructive/20 text-destructive"
                    : "bg-primary/20 text-primary",
                )}
              >
                {orderIndex}
              </span>
            )}
            {option.color && (
              <div 
                className={cn(
                  "w-3 h-3 rounded-full flex-shrink-0 transition-opacity",
                  option.color,
                  !isSelected && "opacity-30"
                )} 
              />
            )}
            {option.icon && (
              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center opacity-80">
                {option.icon}
              </span>
            )}
            <span className={cn(
              "text-sm font-medium",
              isSelected && (isConflict ? "text-destructive" : "text-primary")
            )}>
              {option.label}
            </span>
            {/* Multi-select indicator (hidden when order index already shows priority) */}
            {selectMode === 'multiple' && isSelected && !showOrderIndex && (
              <span className={cn(
                "ml-1 w-4 h-4 rounded-full flex items-center justify-center",
                isConflict ? "bg-destructive/20" : "bg-primary/20",
              )}>
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isConflict ? "bg-destructive" : "bg-primary",
                )} />
              </span>
            )}
            {/* Single-select radio indicator */}
            {selectMode === 'single' && (
              <span className={cn(
                "ml-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                isSelected 
                  ? "border-primary bg-primary" 
                  : "border-muted-foreground/30"
              )}>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Alias for backward compatibility
export { ChipGroup as MultiSelectChipGroup };
