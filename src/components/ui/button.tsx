import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import {
  asHoverIcon,
  hoverIconGroupClass,
  SidebarHoverIcon,
} from "@/components/layout/SidebarHoverIcon";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 [&_svg]:text-primary-foreground [&_svg]:!text-primary-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 [&_svg]:text-destructive-foreground [&_svg]:!text-destructive-foreground",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground [&_svg]:text-foreground [&_svg]:!text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 [&_svg]:text-secondary-foreground [&_svg]:!text-secondary-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground [&_svg]:text-foreground [&_svg]:!text-foreground",
        link: "text-primary underline-offset-4 hover:underline [&_svg]:text-primary [&_svg]:!text-primary",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * 是否给 lucide 子图标加 hover 微动效。默认 true。
   */
  iconMotion?: boolean;
}

const REACT_FORWARD_REF =
  typeof Symbol === "function" && Symbol.for
    ? Symbol.for("react.forward_ref")
    : 0xead0;

/**
 * 只把 lucide-react 图标（forwardRef + PascalCase displayName）当图标。
 * LanguageFlag 等普通 function 组件绝不匹配——避免 asHoverIcon 丢掉 code 白屏。
 */
function isLucideIconElement(child: React.ReactElement): boolean {
  if (child.type === SidebarHoverIcon) return true;

  const props = child.props as { className?: string; children?: React.ReactNode };
  const className = typeof props.className === "string" ? props.className : "";
  if (className.includes("lucide")) return true;

  if (typeof child.type === "string") return child.type === "svg";

  const type = child.type as {
    $$typeof?: symbol | number;
    displayName?: string;
    name?: string;
  };

  if (type.$$typeof !== REACT_FORWARD_REF) return false;

  const name = type.displayName || "";
  if (!name || !/^[A-Z][A-Za-z0-9]*$/.test(name)) return false;
  if (/Flag|Avatar|Badge|Language|Provider|Context|Trigger|Content|Portal/i.test(name)) {
    return false;
  }
  if (props.children != null && props.children !== false) return false;
  return true;
}

function hasContinuousAnimation(className?: string): boolean {
  if (!className) return false;
  return /\banimate-(spin|pulse|bounce|ping)\b/.test(className);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, iconMotion = true, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    /**
     * 处理单个 React 元素（图标动效 / 递归进 DOM·Fragment 子树）。
     * 必须返回「单个元素」而不是数组——asChild 时 Slot 只接受单一 React element。
     */
    const processElement = (child: React.ReactElement): React.ReactNode => {
      const childProps = child.props as {
        className?: string;
        style?: React.CSSProperties;
        children?: React.ReactNode;
      };

      if (isLucideIconElement(child)) {
        const nextStyle: React.CSSProperties = {
          ...childProps.style,
          color: "inherit",
        };

        // 已包装 / 持续动画 / 关闭动效：只补颜色
        if (
          !iconMotion ||
          hasContinuousAnimation(childProps.className) ||
          child.type === SidebarHoverIcon
        ) {
          return React.cloneElement(
            child as React.ReactElement<{ style?: React.CSSProperties }>,
            { style: nextStyle },
          );
        }

        // asHoverIcon：给图标挂上 group-hover/hovericon:animate-*（经验证有效的路径）
        const withColor = React.cloneElement(
          child as React.ReactElement<{ style?: React.CSSProperties }>,
          { style: nextStyle },
        );
        return asHoverIcon(withColor);
      }

      // 只对 DOM / Fragment 递归；不进 LanguageFlag 等业务组件内部
      if (
        childProps.children != null &&
        (typeof child.type === "string" || child.type === React.Fragment)
      ) {
        return React.cloneElement(
          child as React.ReactElement<{ children?: React.ReactNode }>,
          { children: processChildren(childProps.children) },
        );
      }

      return child;
    };

    const processChildren = (nodes: React.ReactNode): React.ReactNode => {
      return React.Children.map(nodes, (child) => {
        if (!React.isValidElement(child)) return child;
        return processElement(child);
      });
    };

    // Slot (asChild) 要求 children 是「单个 React 元素」。
    // React.Children.map 即便只有一个子节点也会返回数组，导致 Slot 抛：
    // "Slot failed to slot onto its children. Expected a single React element child or `Slottable`."
    // 因此 asChild 时直接处理唯一子元素，禁止包一层 map 数组。
    let content: React.ReactNode;
    if (asChild) {
      content = React.isValidElement(children) ? processElement(children) : children;
    } else {
      content = processChildren(children);
    }

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          iconMotion && hoverIconGroupClass,
        )}
        ref={ref}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
