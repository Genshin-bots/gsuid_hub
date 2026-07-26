import * as React from 'react';
import { cn } from '@/lib/utils';
import { asHoverIcon, hoverIconGroupClass } from '@/components/layout/SidebarHoverIcon';

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

/**
 * 与默认高度的 TabButtonGroup 同行对齐用。
 * 默认 group 外壳 ≈ 44–46px（p-1 + 内钮 py-2 + 22px 图标），
 * 同行 Input / Select / Button 统一 `h-11`（44px），icon 按钮 `h-11 w-11`。
 * **禁止** 再把 TabButtonGroup 压成 h-8 / h-9 的矮版。
 */
export const tabToolbarControlClass = 'h-11';
export const tabToolbarIconButtonClass = 'h-11 w-11';

/** 压掉 shadow-safe 竖直 bleed，便于与同行控件 items-center 齐平 */
export const tabToolbarGroupWrapClass =
  'flex shrink-0 items-center [&_.shadow-safe]:!my-0 [&_.shadow-safe]:!py-0';

export function TabButtonGroup({
  options,
  value,
  onValueChange,
  className,
  buttonClassName,
  disabled = false,
}: TabButtonGroupProps) {
  // className 作用在按钮容器（内层）上——调用方会传 grid/w-full 等布局类改写整条布局。
  // 外层只负责阴影安全区（shadow-safe 竖直负边距），并按内层是否铺满/禁缩镜像自身尺寸行为。
  const fullWidth = typeof className === 'string' && /\b(?:w-full|grid)\b/.test(className);
  const noShrink = typeof className === 'string' && /\bshrink-0\b/.test(className);

  return (
    <div className={cn(fullWidth ? 'flex w-full' : 'inline-flex', noShrink && 'shrink-0', 'max-w-full shadow-safe')}>
      <div
        className={cn(
          'inline-flex min-w-0 flex-wrap gap-1 rounded-lg p-1 glass-card',
          className,
        )}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
            disabled={disabled || option.disabled}
            className={cn(
              hoverIconGroupClass,
              'relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 whitespace-nowrap',
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80',
              (disabled || option.disabled) && 'opacity-40 cursor-not-allowed pointer-events-none hover:text-muted-foreground hover:bg-transparent',
              buttonClassName
            )}
          >
            <span className="w-[22px] h-[22px] flex-shrink-0 flex items-center justify-center">
              {asHoverIcon(option.icon)}
            </span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
