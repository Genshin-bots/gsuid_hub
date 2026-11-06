import { useLayoutEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * 标签只占一行。放不下的收成 +N。
 * expandOnHover=true 时悬停展开全部；false 时 +N 徽标悬停出 tooltip（卡片布局不抖动）。
 * 宽度记在 ref 里：收起后被拿掉的标签不再参与布局，不能靠当次 offsetWidth 重算。
 */
export function OverflowTags({
  tags,
  className,
  expandOnHover = true,
}: {
  tags: string[];
  className?: string;
  expandOnHover?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(tags.length);
  const tagKey = tags.join('\u0001');

  useLayoutEffect(() => {
    setVisible(tags.length);
  }, [tagKey, tags.length]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[data-tag-item]'));
    if (expanded || visible === tags.length) {
      widthsRef.current = items.map((el) => el.offsetWidth);
    }
    if (expanded) return;
    const widths = widthsRef.current;
    if (widths.length !== tags.length) return;
    const limit = root.clientWidth;
    if (limit <= 0) return;
    const gap = 4;
    const moreWidth = 40;
    let used = 0;
    let fit = widths.length;
    for (let i = 0; i < widths.length; i += 1) {
      const reserve = i < widths.length - 1 ? gap + moreWidth : 0;
      const next = used + widths[i] + (i > 0 ? gap : 0);
      if (next + reserve > limit) {
        fit = Math.max(0, i);
        break;
      }
      used = next;
    }
    if (fit !== visible) setVisible(fit);
  }, [tagKey, tags.length, visible, expanded]);

  if (tags.length === 0) return <span className="text-muted-foreground">-</span>;

  const hidden = expanded ? 0 : Math.max(0, tags.length - visible);
  const shown = expanded ? tags : tags.slice(0, visible);
  const hiddenTags = tags.slice(visible);

  const moreBadge =
    hidden > 0 ? (
      expandOnHover ? (
        <Badge variant="secondary" className="text-xs">
          +{hidden}
        </Badge>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="cursor-default text-xs">
              +{hidden}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="flex flex-wrap gap-1">
              {hiddenTags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )
    ) : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex w-full max-w-[16rem] items-center gap-1',
        expanded ? 'flex-wrap' : 'overflow-hidden',
        className,
      )}
      onMouseEnter={expandOnHover ? () => setExpanded(true) : undefined}
      onMouseLeave={expandOnHover ? () => setExpanded(false) : undefined}
    >
      {shown.map((tag, index) => (
        <Badge key={`${tag}-${index}`} data-tag-item variant="outline" className="text-xs">
          {tag}
        </Badge>
      ))}
      {moreBadge}
    </div>
  );
}
