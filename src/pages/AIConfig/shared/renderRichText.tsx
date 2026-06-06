import React from 'react';

/**
 * 将包含 `**bold**` 和 `[text](url)` 语法的字符串渲染为 JSX 元素。
 * 用于在 i18n 翻译文本中实现内联富文本效果。
 */
export function renderRichText(text: string): React.ReactNode[] {
  // 先按 **bold** 分割，再对普通文本按 [text](url) 分割
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((bp, bi) => {
    if (bp.startsWith('**') && bp.endsWith('**')) {
      return (
        <strong key={bi} className="font-semibold text-foreground">
          {bp.slice(2, -2)}
        </strong>
      );
    }
    // 对非加粗部分解析 [text](url) 链接
    const linkParts = bp.split(/(\[[^\]]+\]\([^)]+\))/g);
    return linkParts.map((lp, li) => {
      const linkMatch = lp.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={`${bi}-${li}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {linkMatch[1]}
          </a>
        );
      }
      return <span key={`${bi}-${li}`}>{lp}</span>;
    });
  });
}
