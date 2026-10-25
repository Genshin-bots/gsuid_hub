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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from '@/components/ui/popover';
import { SearchableMenuContent } from '@/components/ui/searchable-menu';
import { LiquidSegmentThumb } from '@/components/ui/LiquidSegmentThumb';
import { needsFullWidthWrapper, pickWidthTokens } from '@/components/ui/tabGroupWidth';

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
  /**
   * 文案右侧的数量徽标。调用方自己配色。
   * 选中分段的文字会被主题强制成 primary-foreground，徽标底要能衬住浅色字。
   */
  badge?: React.ReactNode;
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
    /** 下拉宽度模式：'trigger'（与分段项等宽，默认）或 'content'（按内容自适应） */
    width?: 'trigger' | 'content';
  };
}

interface TabButtonGroupProps {
  options: TabButtonOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  /**
   * 窄屏（&lt;768px）收成「当前项 + ▾」下拉，避免一长串分段撑破边距。
   * 形态对齐 /ai-capability-agents 的 DropdownMenu 列表（图标槽 + 文案 + ✓）。
   * 桌面仍是分段按钮。有二级 `dropdown` 的项在收起态只切主 Tab。
   */
  collapseOnMobile?: boolean;
  /**
   * 窄屏（<768px）保持全部分段同行：等分铺满、隐藏图标、缩小字号、超长文案省略号。
   * 与 `collapseOnMobile` 互斥。用于「分区必须一眼可见、可直接点到」的场景
   * （/plugins 卡片头的 参数 / Plugin / SV 三分区）。
   * 调用方需同时传 `w-full`，窄屏用 grid 等分（2–6 段，超出范围退回 flex 自适应）。
   */
  singleRowOnMobile?: boolean;
  /**
   * `sm`：外壳 h-9，只留左右内边距，纵向贴齐外框。
   * 这样分段的可视高度和同行的 h-9 输入框 / 按钮一致。
   * `line`：外壳 h-10，纵向贴齐外框，和 outline 按钮外框齐平。
   * 默认不传。不要用 className 把默认高度硬压矮。
   */
  size?: 'default' | 'sm' | 'line';
  /**
   * 分段在这个断点之前按文案长短撑满所在行（放不下再换行）。
   * 默认 `md`：侧栏出现前（&lt;768px）撑满。
   * 分组要到 `lg` / `xl` 才和别的控件并排时，把断点放到并排那一档。
   * `collapseOnMobile` / `singleRowOnMobile` 有自己的窄屏形态，忽略此参数。
   */
  fillUntil?: 'md' | 'lg' | 'xl';
}

/**
 * 页面上方操作区（标题栏按钮、分段、搜索、筛选）共用的外框高度。
 * 默认 TabButtonGroup 外壳 = 内钮 h-10 + p-1 + 1px 边框，即 `h-[calc(3rem+2px)]`。
 * 同行 Input / Select / Button 用这个高度，才能和分段外框顶底对齐。
 * icon 按钮同高，宽度在纯图标时保持正方形。
 */
export const tabToolbarControlClass = 'h-[calc(3rem+2px)]';
export const tabToolbarIconButtonClass = 'h-[calc(3rem+2px)] w-[calc(3rem+2px)]';

/** 与 `tabToolbarControlClass` 同一高度。旧名保留，避免已引用外壳高度的页面分叉。 */
export const tabToolbarShellControlClass = tabToolbarControlClass;

/** `size="sm"` 的外壳高度，与 outline Button / Input 的 h-9 对齐。 */
export const tabSmShellClass = 'h-9';

/** 压掉 shadow-safe 竖直 bleed，便于与同行控件 items-center 齐平 */
export const tabToolbarGroupWrapClass =
  'flex shrink-0 items-center [&_.shadow-safe]:!my-0 [&_.shadow-safe]:!py-0';

/** `singleRowOnMobile` 的等分列数。必须写成字面量类名，JIT 扫不到模板拼出来的类。 */
const GRID_COLS_CLASS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

function tabSegmentClassName(isActive: boolean, isDisabled: boolean, buttonClassName?: string) {
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

/** twMerge 不能用无前缀 `p-0` 覆盖 `sm:px-*`；拆分外层不能吃到调用方的 padding。 */
const PADDING_CLASS = /^(?:[\w-]+:)*!?p(?:[xyltrbse])?-/;

function omitPaddingClasses(className?: string) {
  if (!className) return className;
  return (
    className
      .split(/\s+/)
      .filter(Boolean)
      .filter((token) => !PADDING_CLASS.test(token))
      .join(' ') || undefined
  );
}


interface TabSegmentDropdownItemProps {
  option: TabButtonOption;
  isActive: boolean;
  isDisabled: boolean;
  buttonClassName?: string;
  segmentYClass: string;
  hug: boolean;
  singleRowOnMobile?: boolean;
  iconSlotClass: string;
  onValueChange: (value: string) => void;
}

function TabSegmentDropdownItem({
  option,
  isActive,
  isDisabled,
  buttonClassName,
  segmentYClass,
  hug,
  singleRowOnMobile,
  iconSlotClass,
  onValueChange,
}: TabSegmentDropdownItemProps) {
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const dropdown = option.dropdown!;
  const allValue = dropdown.allValue ?? dropdown.items[0]?.value;
  const dividerClass = isActive ? 'bg-primary-foreground/25' : 'bg-border/70';
  const widthMode = dropdown.width ?? 'trigger';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          data-segment-active={isActive ? 'true' : undefined}
          className={cn(
            tabSegmentClassName(isActive, isDisabled, omitPaddingClasses(buttonClassName)),
            // 外层只负责底色/对齐；padding 由内层主区 / ▾ 自己带。
            // 必须写在 buttonClassName 之后：无前缀 p-0 盖不住 sm:px-*。
            'inline-flex min-w-0 items-stretch overflow-hidden rounded-md gap-0 p-0',
            singleRowOnMobile && 'flex-1 text-xs sm:flex-none sm:text-sm',
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
              setOpen(false);
            }}
            className={cn(
              'flex min-w-0 items-center gap-1.5 sm:gap-2 px-2.5 sm:pl-4 sm:pr-2 rounded-none bg-transparent',
              segmentYClass,
              hug && 'h-full',
              'hover:bg-transparent focus-visible:outline-none',
              singleRowOnMobile && 'flex-1 justify-center px-2 sm:flex-none sm:justify-start',
              isDisabled && 'cursor-not-allowed',
            )}
          >
            {option.icon != null && (
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center',
                  iconSlotClass,
                  singleRowOnMobile && 'hidden sm:flex',
                )}
              >
                {asHoverIcon(option.icon)}
              </span>
            )}
            <span className="min-w-0 truncate">{option.label}</span>
            {option.badge}
          </button>

          <span
            className={cn('my-1.5 w-px shrink-0 self-stretch', dividerClass)}
            aria-hidden
          />

          {/* 仅箭头触发下拉 */}
          <PopoverTrigger asChild disabled={isDisabled}>
            <button
              type="button"
              disabled={isDisabled}
              aria-label="Open filter menu"
              className={cn(
                'group flex items-center justify-center rounded-none border-0 bg-transparent px-2.5',
                segmentYClass,
                hug && 'h-full',
                singleRowOnMobile && 'px-1.5 sm:px-2.5',
                'hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none',
                'data-[state=open]:bg-black/5 dark:data-[state=open]:bg-white/10',
                isDisabled && 'cursor-not-allowed',
              )}
            >
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>

      <PopoverContent
        ref={panelRef}
        align={dropdown.align ?? 'start'}
        sideOffset={4}
        className={cn(
          'glass-float searchable-menu-panel box-border overflow-hidden bg-transparent p-0 shadow-none',
          widthMode === 'trigger'
            ? 'w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)]'
            : 'w-max min-w-[14rem] max-w-[24rem]',
          dropdown.contentClassName,
        )}
        style={widthMode === 'trigger' ? { width: 'var(--radix-popover-trigger-width)' } : undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => panelRef.current?.querySelector('input')?.focus());
        }}
        onWheel={(event) => event.stopPropagation()}
      >
        <SearchableMenuContent
          items={dropdown.items}
          value={dropdown.value}
          onSelect={(next) => {
            onValueChange(option.value);
            dropdown.onValueChange(next);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function TabButtonGroup({
  options,
  value,
  onValueChange,
  className,
  buttonClassName,
  disabled = false,
  collapseOnMobile = false,
  singleRowOnMobile = false,
  size = 'default',
  fillUntil = 'md',
}: TabButtonGroupProps) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const sm = size === 'sm';
  const line = size === 'line';
  const hug = sm || line;
  const iconSlotClass = sm ? 'h-4 w-4' : 'h-[22px] w-[22px]';
  // 默认可视高度：内钮 h-10。外壳另有 p-1 和 1px 边框。
  // 页面上方操作区对齐的是外壳，用 tabToolbarControlClass（h-[calc(3rem+2px)]），不要只对齐内钮。
  // line 把外壳本身锁成 h-10，内钮贴齐外框，用来和 outline 下拉并排。
  const segmentYClass = hug ? 'h-full py-0' : 'h-10';
  const shellClass = sm
    ? cn(tabSmShellClass, 'items-stretch px-0.5 py-0')
    : line
      ? 'h-10 items-stretch overflow-hidden px-0.5 py-0'
      : 'p-1';
  // className 作用在按钮容器（内层）上——调用方会传 grid/w-full 等布局类改写整条布局。
  // 外壳跟主题底色/描边，阴影由 .tab-segment-row 统一跟随 --shadow-strength 阴影强度配置。
  const fullWidth = needsFullWidthWrapper(className);
  const noShrink = typeof className === 'string' && /\bshrink-0\b/.test(className);
  // 外壳宽度必须跟着调用方的宽度类一起换挡。
  // 只认「有没有 w-full」会让外壳永久通栏：`w-full sm:w-max` 的本意是窄屏铺满、桌面自适应，
  // 外壳却钉死在 w-full → 它在 flex-wrap 容器里占满整行，兄弟元素被挤到下一行
  // （/plugins 卡片头的「插件自带页面」按钮就是这么掉到第二行的）。
  const widthTokens = pickWidthTokens(className);
  const current = options.find((option) => option.value === value) ?? options[0];
  const fillClass =
    collapseOnMobile || singleRowOnMobile
      ? undefined
      : fillUntil === 'xl'
        ? 'tab-segment-fill tab-segment-fill-xl'
        : fillUntil === 'lg'
          ? 'tab-segment-fill tab-segment-fill-lg'
          : 'tab-segment-fill';

  const expanded = (
    <div
      className={cn(
        fullWidth ? 'flex w-full' : 'inline-flex',
        widthTokens,
        noShrink && 'shrink-0',
        'max-w-full',
        collapseOnMobile && 'hidden md:inline-flex',
        fillClass,
      )}
    >
      <div
        ref={rowRef}
        className={cn(
          'tab-segment-row inline-flex min-w-0 flex-wrap gap-1 rounded-lg glass-card-flat',
          shellClass,
          // 窄屏等分成 N 列不换行，好过收成下拉丢掉「分区一眼可见」。
          // 用 grid 而非 flex：flex 下「主区 + ▾」拆分按钮里的 nowrap 文本会把整段
          // 撑到 min-content，flex-1 等分直接失效（实测 82/98/98，grid 才是 93/93/93）。
          singleRowOnMobile && cn('grid sm:inline-flex', GRID_COLS_CLASS[options.length]),
          className,
        )}
      >
        <LiquidSegmentThumb containerRef={rowRef} activeSelector="[data-segment-active='true']" />
        {options.map((option) => {
          const isActive = value === option.value;
          const isDisabled = disabled || !!option.disabled;
          const dropdown = option.dropdown;

          if (dropdown && dropdown.items.length > 0) {
            return (
              <TabSegmentDropdownItem
                key={option.value}
                option={option}
                isActive={isActive}
                isDisabled={isDisabled}
                buttonClassName={buttonClassName}
                segmentYClass={segmentYClass}
                hug={hug}
                singleRowOnMobile={singleRowOnMobile}
                iconSlotClass={iconSlotClass}
                onValueChange={onValueChange}
              />
            );
          }

          return (
            <button
              key={option.value}
              type="button"
              data-segment-active={isActive ? 'true' : undefined}
              onClick={() => onValueChange(option.value)}
              disabled={isDisabled}
              className={cn(
                tabSegmentClassName(isActive, isDisabled, buttonClassName),
                'rounded-md px-2.5 sm:px-4',
                segmentYClass,
                hug && 'h-full',
                singleRowOnMobile &&
                  'min-w-0 flex-1 justify-center px-2 text-xs sm:flex-none sm:px-4 sm:text-sm',
              )}
            >
              {option.icon != null && (
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center',
                    iconSlotClass,
                    singleRowOnMobile && 'hidden sm:flex',
                  )}
                >
                  {asHoverIcon(option.icon)}
                </span>
              )}
              <span className={cn(singleRowOnMobile && 'min-w-0 truncate')}>{option.label}</span>
              {option.badge}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!collapseOnMobile) return expanded;

  return (
    <>
      <div className="inline-flex max-w-full md:hidden">
        <div
          className={cn(
            'tab-segment-row inline-flex min-w-0 max-w-full gap-1 rounded-lg glass-card-flat',
            shellClass,
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  tabSegmentClassName(true, disabled, buttonClassName),
                  'max-w-full rounded-md px-4',
                  segmentYClass,
                  hug && 'h-full',
                )}
              >
                {current?.icon != null && (
                  <span className={cn('flex shrink-0 items-center justify-center', iconSlotClass)}>
                    {asHoverIcon(current.icon)}
                  </span>
                )}
                <span className="min-w-0 truncate">{current?.label}</span>
                {current?.badge}
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem] max-h-72 overflow-y-auto">
              {options.map((option) => {
                const selected = value === option.value;
                const isDisabled = disabled || !!option.disabled;
                const dropdown = option.dropdown;
                const hasSubItems = !!dropdown && dropdown.items.length > 0;
                return (
                  <React.Fragment key={option.value}>
                    <DropdownMenuItem
                      disabled={isDisabled}
                      onSelect={() => {
                        onValueChange(option.value);
                        if (dropdown) {
                          dropdown.onValueChange(dropdown.allValue ?? dropdown.items[0]?.value);
                        }
                      }}
                      className="cursor-pointer gap-2"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center [&>img]:h-4 [&>img]:w-4 [&>svg]:h-4 [&>svg]:w-4">
                        {option.icon ?? null}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="min-w-0 truncate">{option.label}</span>
                        {option.badge}
                      </span>
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0 text-primary',
                          selected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </DropdownMenuItem>
                    {/* 二级筛选摊平进同一张菜单：收起态只有一个菜单可点，
                        不摊平会让带 dropdown 的主 Tab 在窄屏丢掉切换能力 */}
                    {hasSubItems &&
                      dropdown.items.map((item) => {
                        const subSelected = dropdown.value === item.value;
                        return (
                          <DropdownMenuItem
                            key={`${option.value}:${item.value}`}
                            disabled={item.disabled}
                            onSelect={() => {
                              onValueChange(option.value);
                              dropdown.onValueChange(item.value);
                            }}
                            className="cursor-pointer gap-2 pl-8"
                          >
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center [&>img]:h-4 [&>img]:w-4 [&>svg]:h-4 [&>svg]:w-4">
                              {item.icon ?? null}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            <Check
                              className={cn(
                                'h-4 w-4 shrink-0 text-primary',
                                subSelected ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                          </DropdownMenuItem>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {expanded}
    </>
  );
}
