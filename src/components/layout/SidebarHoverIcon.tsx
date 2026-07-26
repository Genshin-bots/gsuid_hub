import React from 'react';
import { cn } from '@/lib/utils';

/** 图标 hover 动效类型 */
export type SidebarIconMotion =
  | 'pop'
  | 'bounce'
  | 'wiggle'
  | 'spin'
  | 'pulse'
  | 'tilt'
  | 'nudge';

/**
 * 完整 class 字符串必须静态写出，供 Tailwind JIT 扫描。
 * 父级容器需带 `group/hovericon`（见 `hoverIconGroupClass`）。
 */
const GROUP_HOVER_CLASS: Record<SidebarIconMotion, string> = {
  pop: 'group-hover/hovericon:animate-sidebar-icon-pop',
  bounce: 'group-hover/hovericon:animate-sidebar-icon-bounce',
  wiggle: 'group-hover/hovericon:animate-sidebar-icon-wiggle',
  spin: 'group-hover/hovericon:animate-sidebar-icon-spin',
  pulse: 'group-hover/hovericon:animate-sidebar-icon-pulse',
  tilt: 'group-hover/hovericon:animate-sidebar-icon-tilt',
  nudge: 'group-hover/hovericon:animate-sidebar-icon-nudge',
};

/** 仅图标自身 hover（独立小按钮等） */
const SELF_HOVER_CLASS: Record<SidebarIconMotion, string> = {
  pop: 'hover:animate-sidebar-icon-pop',
  bounce: 'hover:animate-sidebar-icon-bounce',
  wiggle: 'hover:animate-sidebar-icon-wiggle',
  spin: 'hover:animate-sidebar-icon-spin',
  pulse: 'hover:animate-sidebar-icon-pulse',
  tilt: 'hover:animate-sidebar-icon-tilt',
  nudge: 'hover:animate-sidebar-icon-nudge',
};

/**
 * 按 lucide displayName 分配动效。未命中回落 pop。
 * 覆盖侧边栏 + 全站 TabButtonGroup 常见图标。
 */
const ICON_MOTION_BY_NAME: Record<string, SidebarIconMotion> = {
  // ── 侧边栏 ──
  Home: 'bounce',
  // lucide-react ≥0.447：Home 的 displayName 实际是 House
  House: 'bounce',
  LayoutDashboard: 'pop',
  Database: 'pop',
  Cog: 'spin',
  Settings: 'spin',
  Cpu: 'pulse',
  HardDrive: 'pop',
  Calendar: 'wiggle',
  CalendarDays: 'wiggle',
  CalendarClock: 'spin',
  FileText: 'tilt',
  Route: 'nudge',
  Bookmark: 'tilt',
  Image: 'pop',
  Terminal: 'pulse',
  Brain: 'pulse',
  Store: 'bounce',
  Palette: 'wiggle',
  User: 'pop',
  Server: 'pop',
  GitBranch: 'wiggle',
  Wallet: 'bounce',
  MessageCircle: 'wiggle',
  Layers: 'pop',
  Wrench: 'wiggle',
  Sparkles: 'pulse',
  TrendingUp: 'bounce',
  TrendingDown: 'bounce',
  Clock: 'spin',
  BookOpen: 'tilt',
  ScrollText: 'tilt',
  ClipboardList: 'pop',
  Users: 'pop',
  ShieldCheck: 'pop',
  Bug: 'wiggle',
  Activity: 'pulse',
  PackageOpen: 'pop',
  Package: 'pop',
  Send: 'nudge',
  History: 'spin',
  Power: 'pulse',
  RotateCw: 'spin',
  RefreshCw: 'spin',
  LogOut: 'nudge',
  PanelLeftClose: 'nudge',
  ChevronDown: 'bounce',
  ChevronRight: 'nudge',

  // ── TabButtonGroup / 页面 Tab 常用 ──
  Gauge: 'pulse',
  Shield: 'pop',
  ShieldAlert: 'wiggle',
  Eye: 'pulse',
  ListChecks: 'pop',
  Network: 'pulse',
  Search: 'pop',
  Pencil: 'tilt',
  PenLine: 'tilt',
  Edit: 'tilt',
  CheckCircle2: 'bounce',
  CheckCircle: 'bounce',
  AlertCircle: 'wiggle',
  AlertTriangle: 'wiggle',
  X: 'wiggle',
  XCircle: 'wiggle',
  Boxes: 'pop',
  Box: 'pop',
  Archive: 'tilt',
  FileCode2: 'tilt',
  FileCode: 'tilt',
  Smile: 'bounce',
  MemoryStick: 'pulse',
  SlidersHorizontal: 'wiggle',
  BarChart2: 'bounce',
  BarChart3: 'bounce',
  LineChart: 'bounce',
  PieChart: 'spin',
  Filter: 'wiggle',
  Tag: 'tilt',
  Tags: 'tilt',
  Folder: 'tilt',
  FolderOpen: 'tilt',
  Download: 'bounce',
  Upload: 'bounce',
  Play: 'nudge',
  Pause: 'pulse',
  Zap: 'pulse',
  Star: 'bounce',
  Heart: 'pulse',
  Bell: 'wiggle',
  Info: 'pop',
  HelpCircle: 'wiggle',
  Plus: 'pop',
  Minus: 'pop',
  Trash2: 'wiggle',
  Copy: 'pop',
  Link: 'nudge',
  ExternalLink: 'nudge',
  Globe: 'spin',
  Lock: 'pop',
  Unlock: 'pop',
  Key: 'wiggle',
  Bot: 'pulse',
  Code: 'tilt',
  Code2: 'tilt',
  LayoutGrid: 'pop',
  LayoutList: 'pop',
  Table: 'pop',
  Timer: 'spin',
  Hourglass: 'spin',
  UserCog: 'spin',
  UserCheck: 'pop',
  Building: 'pop',
  Building2: 'pop',
  CreditCard: 'tilt',
  Receipt: 'tilt',
  Coins: 'bounce',
  CircleDollarSign: 'bounce',
  BadgeCheck: 'bounce',
  MessageSquare: 'wiggle',
  MessagesSquare: 'wiggle',
  Mail: 'tilt',
  Inbox: 'tilt',
  Rocket: 'nudge',
  Flame: 'pulse',
  Lightbulb: 'pulse',
  Puzzle: 'wiggle',
  Blocks: 'pop',
  Workflow: 'pulse',
  Target: 'pulse',
  Compass: 'spin',
  Sun: 'spin',
  Moon: 'tilt',
  Monitor: 'pop',
  Smartphone: 'pop',
  Cloud: 'bounce',
  Save: 'pop',
  Flag: 'wiggle',
  Hash: 'pop',
  Type: 'tilt',
  Camera: 'pop',
  Mic: 'pulse',
  Volume2: 'pulse',
  SquareTerminal: 'pulse',
  Scroll: 'tilt',
  Notebook: 'tilt',
  Library: 'tilt',
  GraduationCap: 'bounce',
  Award: 'bounce',
  Trophy: 'bounce',
  Infinity: 'spin',
  Atom: 'spin',
  FlaskConical: 'wiggle',
  Beaker: 'wiggle',
  HeartPulse: 'pulse',
  ArrowUpRight: 'nudge',
  ArrowLeftRight: 'nudge',
  Menu: 'wiggle',
  MoreHorizontal: 'wiggle',
  MoreVertical: 'wiggle',
  ShoppingBag: 'bounce',
  ShoppingCart: 'bounce',
  Gift: 'bounce',
  Coffee: 'pulse',
};

function resolveMotion(
  icon: React.ElementType,
  override?: SidebarIconMotion,
): SidebarIconMotion {
  if (override) return override;
  const name =
    (icon as { displayName?: string; name?: string }).displayName ||
    (icon as { name?: string }).name ||
    '';
  return ICON_MOTION_BY_NAME[name] ?? 'pop';
}

export interface SidebarHoverIconProps {
  icon: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  /** 强制指定动效，覆盖按图标名的默认映射 */
  motion?: SidebarIconMotion;
  /**
   * 为 true 时仅监听自身 hover（适合独立按钮）。
   * 为 false（默认）时由父级 `group/hovericon` 的 hover 触发。
   */
  selfHover?: boolean;
}

/**
 * 「静态 + 动态」图标：默认静止，父级/自身 hover 时播放一次微动画后还原。
 * 尊重 `prefers-reduced-motion`（`motion-reduce:animate-none`）。
 */
export function SidebarHoverIcon({
  icon: Icon,
  className,
  style,
  motion: motionOverride,
  selfHover = false,
}: SidebarHoverIconProps) {
  const motion = resolveMotion(Icon, motionOverride);
  const hoverClass = selfHover ? SELF_HOVER_CLASS[motion] : GROUP_HOVER_CLASS[motion];

  return (
    <Icon
      className={cn(
        className,
        'origin-center shrink-0',
        hoverClass,
        'motion-reduce:animate-none',
      )}
      style={style}
      aria-hidden
    />
  );
}

/**
 * 把已写成 `<Clock className="w-4 h-4" />` 的 ReactNode 图标包装成带 hover 动效的节点。
 * TabButtonGroup 等接收 `icon?: ReactNode` 的组件用这个，无需改各页面写法。
 *
 * 安全约束：只包装 lucide（forwardRef + displayName）或原生 svg；
 * 业务组件（LanguageFlag 等）原样返回，避免丢掉必需 props。
 */
export function asHoverIcon(
  icon: React.ReactNode,
  options?: { selfHover?: boolean; motion?: SidebarIconMotion },
): React.ReactNode {
  if (icon == null || icon === false || icon === true) return null;
  if (!React.isValidElement(icon)) return icon;

  const type = icon.type;
  if (type === SidebarHoverIcon) return icon;

  const props = icon.props as {
    className?: string;
    style?: React.CSSProperties;
  };

  // 原生 DOM（如 <svg> / <img>）：直接挂动效 class
  if (typeof type === 'string') {
    if (type !== 'svg' && type !== 'img') return icon;
    const motion = options?.motion ?? 'pop';
    const hoverClass = options?.selfHover
      ? SELF_HOVER_CLASS[motion]
      : GROUP_HOVER_CLASS[motion];
    return React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
      className: cn(
        props.className,
        'origin-center shrink-0',
        hoverClass,
        'motion-reduce:animate-none',
      ),
    });
  }

  // 只接受 lucide-react 风格的 forwardRef 图标，拒绝普通 function 组件
  const typeMeta = type as {
    $$typeof?: symbol;
    displayName?: string;
    name?: string;
  };
  const REACT_FORWARD_REF =
    typeof Symbol === 'function' && Symbol.for
      ? Symbol.for('react.forward_ref')
      : undefined;
  const name = typeMeta.displayName || typeMeta.name || '';
  const isLucideForwardRef =
    !!REACT_FORWARD_REF &&
    typeMeta.$$typeof === REACT_FORWARD_REF &&
    !!name &&
    /^[A-Z][A-Za-z0-9]*$/.test(name) &&
    !/Flag|Avatar|Badge|Language|Provider|Context/i.test(name);

  if (!isLucideForwardRef) {
    return icon;
  }

  return (
    <SidebarHoverIcon
      icon={type as React.ElementType}
      className={props.className}
      style={props.style}
      motion={options?.motion}
      selfHover={options?.selfHover}
    />
  );
}

/** 可交互行/按钮容器 class：子图标随整行 hover 播放动效 */
export const hoverIconGroupClass = 'group/hovericon';

/** @deprecated 使用 hoverIconGroupClass；保留别名避免侧边栏引用断裂 */
export const sidebarNavItemGroupClass = hoverIconGroupClass;
