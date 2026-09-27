import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * 复用组件：带「?」帮助图标的字段标签。
 *
 * Label 右侧紧跟一个圆形 `?` 按钮，悬停弹出说明。字段的补充说明统一走这里，
 * 不要另起一行正文（省空间、减视觉噪音）。
 *
 * `description` 为 **string** 时按轻量 Markdown 渲染（支持 `**加粗**`、段落、列表）；
 * 为 ReactNode 时原样展示。
 */
export interface LabelWithHelpProps {
  /** 标签前的图标，可选 */
  icon?: ReactNode;
  /** 标签文案 */
  label: ReactNode;
  /** 悬停 `?` 时显示的说明（string 支持 Markdown） */
  description?: ReactNode;
  /** 沿用 `<Label>` 的 `htmlFor` 语义 */
  htmlFor?: string;
  /** 默认与字段 `<Label>` 一致；可按需覆盖 */
  className?: string;
}

function HelpMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        ul: ({ children }) => (
          <ul className="mb-1.5 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-1.5 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        // 避免 tooltip 里出现大标题，把 heading 压成加粗段落
        h1: ({ children }) => <p className="mb-1.5 font-semibold last:mb-0">{children}</p>,
        h2: ({ children }) => <p className="mb-1.5 font-semibold last:mb-0">{children}</p>,
        h3: ({ children }) => <p className="mb-1.5 font-semibold last:mb-0">{children}</p>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export function LabelWithHelp({
  icon,
  label,
  description,
  htmlFor,
  className,
}: LabelWithHelpProps) {
  const resolvedClassName = className ?? 'text-sm font-semibold';
  return (
    <div className="flex items-center gap-2">
      {icon}
      <Label htmlFor={htmlFor} className={resolvedClassName}>
        {label}
      </Label>
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
            <TooltipContent side="top" className="max-w-sm text-left">
              {typeof description === 'string' ? (
                <HelpMarkdown text={description} />
              ) : (
                <div className="leading-relaxed">{description}</div>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
