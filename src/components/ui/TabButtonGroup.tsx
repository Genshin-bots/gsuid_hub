import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { asHoverIcon, hoverIconGroupClass } from '@/components/layout/SidebarHoverIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** 下拉子项：用于某一主 Tab 的二级筛选 */
export interface TabButtonDropdownItem {
  value: string;
  label: string;
  /** 子项前缀图标（如插件 ICON） */
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabButtonOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /**
   * 可选：将此按钮升级为「主 Tab + 下拉二级筛选」。
   * - 点击主按钮：选中该 Tab，并将二级筛选重置为「全部」（`allValue` 或首项）
   * - 点击右侧箭头：仅展开下拉，选中子项后才切换二级筛选
   * - 不传时保持普通分段按钮，既有调用方零改动
   */
  dropdown?: {
    items: TabButtonDropdownItem[];
    value: string;
    onValueChange: (value: string) => void;
    /**
     * 点击主按钮时写入的二级值（表示「全部」）。
     * 默认取 `items[0].value`。
     */
    allValue?: string;
    align?: 'start' | 'center' | 'end';
    /** 下拉内容附加 class（如 max-h / min-w） */
    contentClassName?: string;
  };
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

function tabSegmentClassName(
  isActive: boolean,
  isDisabled: boolean,
  buttonClassName?: string,
) {
  return cn(
    hoverIconGroupClass,
    'relative text-sm font-medium transition-all duration-200 flex items-center gap-2 whitespace-nowrap',
    isActive
      ? 'bg-primary text-primary-foreground [&_svg]:text-current'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/80 [&_svg]:text-current',
    isDisabled &&
      'opacity-40 cursor-not-allowed pointer-events-none hover:text-muted-foreground hover:bg-transparent',
    buttonClassName,
  );
}

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
        {options.map((option) => {
          const isActive = value === option.value;
          const isDisabled = disabled || !!option.disabled;
          const dropdown = option.dropdown;

          if (dropdown && dropdown.items.length > 0) {
            const allValue = dropdown.allValue ?? dropdown.items[0]?.value;
            const dividerClass = isActive
              ? 'bg-primary-foreground/25'
              : 'bg-border/70';

            return (
              <div
                key={option.value}
                className={cn(
                  'inline-flex min-w-0 items-stretch overflow-hidden rounded-md',
                  tabSegmentClassName(isActive, isDisabled, buttonClassName),
                  // 外层负责底色，内层按钮去掉独立圆角/底色
                  'gap-0 p-0',
                )}
              >
                {/* 主按钮：选中该 Tab + 二级筛选回到「全部」 */}
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onValueChange(option.value);
                    if (allValue !== undefined) {
                      dropdown.onValueChange(allValue);
                    }
                  }}
                  className={cn(
                    'flex min-w-0 items-center gap-2 pl-4 pr-2 py-2 rounded-none bg-transparent',
                    'hover:bg-transparent focus-visible:outline-none',
                    isDisabled && 'cursor-not-allowed',
                  )}
                >
                  {option.icon != null && (
                    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                      {asHoverIcon(option.icon)}
                    </span>
                  )}
                  <span className="truncate">{option.label}</span>
                </button>

                <span className={cn('my-1.5 w-px shrink-0 self-stretch', dividerClass)} aria-hidden />

                {/* 仅箭头触发下拉 */}
                <DropdownMenu
                  onOpenChange={(open) => {
                    // 展开菜单时切到该主 Tab，但保留当前二级筛选
                    if (open && !isDisabled) {
                      onValueChange(option.value);
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild disabled={isDisabled}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      aria-label="Open filter menu"
                      className={cn(
                        'group flex items-center justify-center rounded-none border-0 bg-transparent px-2.5 py-2',
                        'hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none',
                        'data-[state=open]:bg-black/5 dark:data-[state=open]:bg-white/10',
                        isDisabled && 'cursor-not-allowed',
                      )}
                    >
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align={dropdown.align ?? 'end'}
                    className={cn('min-w-[12rem] max-h-72 overflow-y-auto', dropdown.contentClassName)}
                  >
                    {dropdown.items.map((item) => {
                      const selected = dropdown.value === item.value;
                      return (
                        <DropdownMenuItem
                          key={item.value}
                          disabled={item.disabled}
                          onSelect={() => {
                            onValueChange(option.value);
                            dropdown.onValueChange(item.value);
                          }}
                          className="cursor-pointer gap-2"
                        >
                          {/* 固定宽度图标槽，避免无图标项错位；img 用 block 才能稳定占位 */}
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center [&>img]:h-4 [&>img]:w-4 [&>svg]:h-4 [&>svg]:w-4">
                            {item.icon ?? null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          <Check
                            className={cn(
                              'h-4 w-4 shrink-0 text-primary',
                              selected ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          }

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onValueChange(option.value)}
              disabled={isDisabled}
              className={cn(
                tabSegmentClassName(isActive, isDisabled, buttonClassName),
                'rounded-md px-4 py-2',
              )}
            >
              {option.icon != null && (
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                  {asHoverIcon(option.icon)}
                </span>
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
