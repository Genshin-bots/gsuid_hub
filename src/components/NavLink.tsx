import { NavLink as RouterNavLink, type NavLinkProps, useLocation } from 'react-router-dom';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface NavLinkCompatProps extends Omit<NavLinkProps, 'className'> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  /** 额外视为「已激活」的路径前缀（如子页面 /persona-store 归属 /persona-config） */
  activePaths?: string[];
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, activePaths, ...props }, ref) => {
    const location = useLocation();
    const extraActive =
      !!activePaths &&
      activePaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, (isActive || extraActive) && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = 'NavLink';

export { NavLink };
