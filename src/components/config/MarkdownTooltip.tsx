import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * 用于在 TooltipContent 中渲染 markdown 文本的样式。
 * - 让 p/ul/ol/code/em/strong/a 等元素在 tooltip 紧凑空间内合理排版
 * - 不影响没有 markdown 标记的纯文本（仍按原文本渲染）
 */
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="leading-relaxed [&:not(:last-child)]:mb-1.5 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  code: ({
    inline,
    className,
    children,
    ...props
  }: {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  } & React.HTMLAttributes<HTMLElement>) => {
    if (inline) {
      return (
        <code
          className="px-1 py-0.5 rounded bg-muted text-[0.85em] font-mono break-all"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn('block bg-muted px-2 py-1 rounded text-[0.85em] font-mono whitespace-pre-wrap break-all', className)}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted p-2 rounded my-1 text-[0.85em] font-mono overflow-x-auto">
      {children}
    </pre>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-semibold mt-1 mb-1">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-semibold mt-1 mb-1">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold mt-1 mb-0.5">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="text-sm font-medium mt-0.5 mb-0.5">{children}</h4>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-border pl-2 my-1 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-1.5 border-border" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-1">
      <table className="min-w-full text-xs border border-border">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-2 py-1 text-left font-semibold border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-2 py-1 border-b border-border/50">{children}</td>
  ),
};

/**
 * MarkdownTooltip
 * 一个支持 Markdown 渲染的 Tooltip 组件。
 *
 * 行为：
 * - 当传入的 content 中包含 markdown 语法（如 **bold**、`code`、换行、列表等）时，
 *   会以 markdown 形式渲染。
 * - 当 content 不包含 markdown 标记时，也会正常显示纯文本。
 *
 * Props：
 * - content: tooltip 内显示的文本（支持 markdown 语法）
 * - side: 浮层位置（默认 top）
 * - className: 透传给 TooltipContent
 * - iconClassName: 透传给触发按钮内部的 HelpCircle 图标
 * - delayDuration: 浮层显示延时（毫秒，默认 100）
 * - asChild: 是否将触发器作为子节点透传
 * - children: 自定义触发节点（仅在 asChild=true 时使用）
 */
export interface MarkdownTooltipProps {
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  iconClassName?: string;
  delayDuration?: number;
  /**
   * 透传 TooltipContent 的其他参数
   */
  tooltipContentProps?: Omit<
    React.ComponentProps<typeof TooltipContent>,
    'children' | 'className' | 'side' | 'align'
  >;
  /**
   * 默认触发器是 HelpCircle 问号按钮。设为 false 时需通过 children 自定义。
   */
  useDefaultTrigger?: boolean;
  children?: React.ReactNode;
}

/**
 * 简单判断一段文本是否包含 markdown 标记。
 * 用于决定是否走 ReactMarkdown 渲染分支。
 * （为了避免对完全纯文本进行无谓的 markdown 解析开销与样式变化）
 */
function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  // 匹配常见 markdown 元素（行内加粗/行内代码/链接/标题/列表/引用/水平线/表格）
  return /(\*\*[^*]+\*\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|^#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|^>\s|^---$|\|.*\|)/m.test(
    text,
  );
}

/**
 * TooltipContent 的内容渲染：
 * - 如果 content 是字符串且包含 markdown 标记，用 ReactMarkdown 渲染
 * - 其他情况保持原样渲染（向后兼容）
 */
function MarkdownTooltipBody({ content }: { content: React.ReactNode }) {
  if (typeof content !== 'string') {
    return <>{content}</>;
  }
  if (!looksLikeMarkdown(content)) {
    return <p className="leading-relaxed">{content}</p>;
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents as React.ComponentProps<typeof ReactMarkdown>['components']}
    >
      {content}
    </ReactMarkdown>
  );
}

export function MarkdownTooltip({
  content,
  side = 'top',
  align = 'center',
  className,
  iconClassName,
  delayDuration = 100,
  tooltipContentProps,
  useDefaultTrigger = true,
  children,
}: MarkdownTooltipProps) {
  if (content == null || content === '') return null;

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          {useDefaultTrigger ? (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-primary/10 transition-colors focus:outline-none"
              onClick={(e) => e.preventDefault()}
            >
              <HelpCircle
                className={cn(
                  'w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary cursor-help',
                  iconClassName,
                )}
              />
            </button>
          ) : (
            children
          )}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className={cn('max-w-xs', className)}
          {...tooltipContentProps}
        >
          <MarkdownTooltipBody content={content} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default MarkdownTooltip;
