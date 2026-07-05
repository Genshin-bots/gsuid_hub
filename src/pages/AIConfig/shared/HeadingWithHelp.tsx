import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * 复用组件：带「?」帮助图标的区块大标题。
 *
 * 设计要点：
 *  - 标题与说明**解耦**：标题始终可见，长说明只在悬停 `?` 图标时出现。
 *  - 完全沿用项目内已有风格 —— 圆形小按钮 + `HelpCircle` 图标 + `cursor-help`
 *    （同 VectorDbSection / MemorySettingsSection 内的 `?` 按钮）。
 *  - `description` 可为字符串或 ReactNode，向下兼容。
 *  - `align` 让标题块独占一行时不至于过分占宽。
 */
export interface HeadingWithHelpProps {
  /** 标题前的图标 */
  icon: ReactNode;
  /** 标题文案 */
  title: ReactNode;
  /** 悬停 `?` 时显示的说明文字；为空则不渲染 `?` 按钮 */
  description?: ReactNode;
  /** 额外 class，用于偶尔需要覆盖排版 */
  className?: string;
  /** 标题字重覆盖，默认 `font-bold` */
  weightClass?: string;
}

export function HeadingWithHelp({
  icon,
  title,
  description,
  className,
  weightClass = 'font-bold',
}: HeadingWithHelpProps) {
  return (
    <div className={`flex items-center gap-2 mb-1 ${className ?? ''}`}>
      {icon}
      <h2 className={`text-lg ${weightClass}`}>{title}</h2>
      {description !== undefined && description !== null && description !== '' && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-primary/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => e.preventDefault()}
                aria-label="help"
              >
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="leading-relaxed">{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
