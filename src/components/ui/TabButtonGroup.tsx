import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabButtonOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface TabButtonGroupProps {
  options: TabButtonOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
}

export function TabButtonGroup({
  options,
  value,
  onValueChange,
  className,
  buttonClassName,
  disabled = false,
}: TabButtonGroupProps) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap gap-1 p-1 rounded-lg glass-card',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          disabled={disabled || option.disabled}
          className={cn(
            'relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 whitespace-nowrap',
            value === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/80',
            (disabled || option.disabled) && 'opacity-40 cursor-not-allowed pointer-events-none hover:text-muted-foreground hover:bg-transparent',
            buttonClassName
          )}
        >
          <span className="w-[22px] h-[22px] flex-shrink-0 flex items-center justify-center">
            {option.icon}
          </span>
          {option.label}
        </button>
      ))}
    </div>
  );
}
