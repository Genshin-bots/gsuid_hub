import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChipOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  disabled?: boolean;
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
}: ChipGroupProps) {
  const toggleOption = React.useCallback((optionValue: string) => {
    if (disabled) return;
    
    const isSelected = value.includes(optionValue);
    
    if (selectMode === 'single') {
      // Single selection mode - always replace with new value
      onValueChange([optionValue]);
    } else {
      // Multi selection mode (default)
      if (isSelected) {
        // Don't allow deselecting if allowEmpty is false and this is the last selected item
        if (!allowEmpty && value.length === 1) {
          return;
        }
        onValueChange(value.filter(v => v !== optionValue));
      } else {
        onValueChange([...value, optionValue]);
      }
    }
  }, [value, onValueChange, disabled, allowEmpty, selectMode]);

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = value.includes(option.value);
        const isDisabled = disabled || option.disabled;
        
        return (
          <button
            key={option.value}
            onClick={() => toggleOption(option.value)}
            disabled={isDisabled}
            className={cn(
              "p-2.5 rounded-lg border-2 transition-all flex items-center gap-2",
              "active:scale-[0.98]",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50",
              isDisabled && "opacity-50 cursor-not-allowed hover:border-border",
              chipClassName
            )}
          >
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
              isSelected && "text-primary"
            )}>
              {option.label}
            </span>
            {/* Multi-select indicator */}
            {selectMode === 'multiple' && isSelected && (
              <span className="ml-1 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
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
