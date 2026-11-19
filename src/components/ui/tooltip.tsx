import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';
import {
  isLikelyNonInteractiveTriggerElement,
  resolveClickToggleAction,
  shouldToggleTooltipOnClick,
} from './tooltipUtils';

const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipClickContextValue {
  open: boolean;
  isControlled: boolean;
  openOnClick?: boolean;
  openByClick: () => void;
  closeByClick: () => void;
  hadPointerDownRef: React.MutableRefObject<boolean>;
  wasOpenOnPointerDownRef: React.MutableRefObject<boolean>;
}

const TooltipClickContext = React.createContext<TooltipClickContextValue | null>(null);

export interface TooltipProps extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root> {
  /**
   * 点击/轻触触发器时切换提示框显隐（移动端无 hover，问号等纯说明按钮需靠轻触展开）。
   * - `true`：点击/轻触均切换
   * - `false`：仅跟随 Radix 默认悬停 / 键盘聚焦
   * - 省略（默认）：对裸 `<HelpCircle>` / `<Info>` / 纯 `<span>` / `<Badge>` 等非交互触发器自动开启，
   *   不干扰 `<Button>` / `<Switch>` / `<a>` / 带独立 `onClick` 的交互控件。
   */
  openOnClick?: boolean;
}

const Tooltip = ({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  openOnClick,
  children,
  ...props
}: TooltipProps) => {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? openProp : uncontrolledOpen;
  const hadPointerDownRef = React.useRef(false);
  const wasOpenOnPointerDownRef = React.useRef(false);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const openByClick = React.useCallback(() => {
    if (typeof document !== 'undefined') {
      // 受控改变 open prop 不会触发 Radix 内部 onChange，需主动通知其他已打开的 Tooltip 关闭
      document.dispatchEvent(new CustomEvent('tooltip.open'));
    }
    handleOpenChange(true);
  }, [handleOpenChange]);

  const closeByClick = React.useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const contextValue = React.useMemo<TooltipClickContextValue>(
    () => ({
      open,
      isControlled,
      openOnClick,
      openByClick,
      closeByClick,
      hadPointerDownRef,
      wasOpenOnPointerDownRef,
    }),
    [open, isControlled, openOnClick, openByClick, closeByClick],
  );

  return (
    <TooltipClickContext.Provider value={contextValue}>
      <TooltipPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </TooltipPrimitive.Root>
    </TooltipClickContext.Provider>
  );
};

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onPointerDown, onPointerCancel, onClick, children, ...props }, ref) => {
  const ctx = React.useContext(TooltipClickContext);
  const childElement = props.asChild && React.isValidElement(children) ? children : undefined;
  const childProps = childElement?.props as Record<string, unknown> | undefined;
  const hasChildOnClick = typeof childProps?.onClick === 'function';

  const isLikelyTapTrigger =
    ctx !== null &&
    (ctx.openOnClick === true ||
      (ctx.openOnClick !== false &&
        !ctx.isControlled &&
        !hasChildOnClick &&
        Boolean(childElement) &&
        isLikelyNonInteractiveTriggerElement(childElement?.type, childProps)));

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      if (ctx) {
        ctx.hadPointerDownRef.current = true;
        ctx.wasOpenOnPointerDownRef.current = ctx.open;
      }
    },
    [onPointerDown, ctx],
  );

  const handlePointerCancel = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerCancel?.(event);
      if (ctx) {
        ctx.hadPointerDownRef.current = false;
        ctx.wasOpenOnPointerDownRef.current = false;
      }
    },
    [onPointerCancel, ctx],
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!ctx || (ctx.isControlled && ctx.openOnClick !== true)) return;
      if (!shouldToggleTooltipOnClick(ctx.openOnClick, event.currentTarget, hasChildOnClick)) {
        return;
      }
      // 阻止默认行为：1) 跳过 Radix TooltipTrigger 内置的 onClick -> onClose；
      // 2) 避免嵌在 <Label> 内时聚焦/切换关联表单控件；并阻止冒泡到外层卡片/折叠栏。
      event.preventDefault();
      event.stopPropagation();

      const action = resolveClickToggleAction({
        hadPointerDown: ctx.hadPointerDownRef.current,
        wasOpenOnPointerDown: ctx.wasOpenOnPointerDownRef.current,
        currentOpen: ctx.open,
      });
      ctx.hadPointerDownRef.current = false;
      ctx.wasOpenOnPointerDownRef.current = false;

      if (action === 'open') {
        ctx.openByClick();
      } else {
        ctx.closeByClick();
      }
    },
    [onClick, ctx, hasChildOnClick],
  );

  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      data-tooltip-tap={isLikelyTapTrigger ? '' : undefined}
      onPointerDown={handlePointerDown}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      {...props}
    >
      {children}
    </TooltipPrimitive.Trigger>
  );
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        // tooltip 走 .tooltip-surface 画自己的底板（见 index.css）：
        // 保留底色（要压住身后文字），但不带 bg-popover / border ——
        // 那会命中 `[class*="popover"]` 浮层玻璃规则，套上一圈白色描边 + 白色高光。
        'tooltip-surface z-[60] overflow-hidden rounded-md px-3 py-1.5 text-sm animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
