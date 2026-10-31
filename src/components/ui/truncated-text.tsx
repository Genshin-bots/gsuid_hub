import { useEffect, useRef, useState } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string;
  className?: string;
}

// 单行截断 + 悬停 Tooltip 回显全文。TooltipProvider 已在 App.tsx 全局挂载。
// 只有真的被截断时才弹 Tooltip（scrollWidth > clientWidth），短文本不打扰。
export function TruncatedText({ text, className }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn('block min-w-0 max-w-full truncate', className)}>
          {text}
        </span>
      </TooltipTrigger>
      {truncated && <TooltipContent className="max-w-sm break-all">{text}</TooltipContent>}
    </Tooltip>
  );
}
