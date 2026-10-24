import React, { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Image as ImageIcon, Copy, Check, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  HAS_STRUCTURE_REGEX,
  TRIMMED_EMPTY_REGEX,
  HAS_BASE64_REGEX,
  SPLIT_BASE64_REGEX,
  retainStructuredDataPreview,
  extractBase64Payload,
  parseBase64ImageMeta,
  buildBase64DataUrl,
  tryParseStructuredData,
} from '@/lib/structuredDataPreview';
import { cn } from '@/lib/utils';

interface StructuredDataViewerProps {
  data: string;
  className?: string;
}

// 缓存颜色配置
const colors = {
  key: 'text-red-600 dark:text-red-400 font-semibold',
  string: 'text-green-600 dark:text-green-400',
  number: 'text-blue-600 dark:text-blue-400',
  boolean: 'text-purple-600 dark:text-purple-400',
  null: 'text-gray-500',
  bracket: 'text-gray-500',
  className: 'text-cyan-600 dark:text-cyan-400 font-semibold',
  normal: 'text-gray-700 dark:text-gray-300',
  text: 'text-sky-500 dark:text-sky-400 font-medium',
};

/**
 * 复制文本到剪贴板：优先使用现代 Clipboard API，
 * 在非安全上下文（如内网 HTTP IP 访问）或权限受限时降级为 execCommand('copy')。
 */
async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!success) {
    throw new Error('execCommand copy failed');
  }
}

interface Base64ImageBadgeProps {
  rawValue: string;
}

/**
 * 单张 Base64 图片的内联 Badge 组件：
 * - 在日志行内显示为精致紧凑的「图片」胶囊（避免撑高单行）
 * - 悬浮或点击弹出 Portal HoverCard，展示图片预览、格式大小、复制纯 Base64 按钮
 * - 打开期间锁定 ConsolePanel 自动滚底，且若用户主动滚动列表则立即收起
 */
const Base64ImageBadge = memo(function Base64ImageBadge({ rawValue }: Base64ImageBadgeProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pointerTypeRef = useRef<string>('mouse');
  const copyTimerRef = useRef<number | null>(null);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setHasOpened(true);
      setImgError(false);
    }
  }, []);

  const { mime, format, sizeText, isDataUrl } = useMemo(
    () => parseBase64ImageMeta(rawValue),
    [rawValue],
  );
  // 仅在首次打开后生成并缓存 dataUrl：
  // 既避免未打开 Badge 的内存开销，又防止关闭退场动画期间 src 变为空串误触发 img onError
  const dataUrl = useMemo(
    () => (hasOpened ? buildBase64DataUrl(rawValue, mime, isDataUrl) : ''),
    [hasOpened, rawValue, mime, isDataUrl],
  );

  // 维护全局打开计数，供 ConsolePanel 在预览期间暂停 autoScroll
  useEffect(() => {
    if (!open) return;
    return retainStructuredDataPreview();
  }, [open]);

  // 只要包含该 Badge 的滚动容器发生了滚动，直接收起预览卡片
  useEffect(() => {
    if (!open) return;
    const handleScroll = (e: Event) => {
      if (e.target instanceof Node && e.target.contains(triggerRef.current)) {
        setOpen(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await copyTextToClipboard(extractBase64Payload(rawValue));
        setCopied(true);
        if (copyTimerRef.current != null) {
          window.clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = window.setTimeout(() => {
          setCopied(false);
          copyTimerRef.current = null;
        }, 1500);
      } catch (err) {
        console.error('Failed to copy base64:', err);
        toast.error(t('console.copyFailed'));
      }
    },
    [rawValue, t],
  );

  const badgeLabel = t('console.imageBadge');

  return (
    <HoverCard open={open} onOpenChange={handleOpenChange} openDelay={120} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${badgeLabel} (${format} · ${sizeText})`}
          onPointerDown={(e) => {
            pointerTypeRef.current = e.pointerType;
          }}
          onClick={() => {
            if (pointerTypeRef.current === 'mouse') {
              handleOpenChange(true);
            } else {
              handleOpenChange(!open);
            }
          }}
          className={cn(
            'mx-0.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 align-baseline',
            'font-mono text-[11px] leading-none font-medium select-none cursor-pointer',
            'border border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300',
            'hover:bg-sky-500/25 hover:border-sky-500/60 transition-colors',
          )}
        >
          <ImageIcon className="h-2.5 w-2.5 shrink-0" />
          <span>{badgeLabel}</span>
          <span className="text-[9px] font-normal opacity-75">{format}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={6}
        collisionPadding={12}
        onPointerDownOutside={(e) => {
          if (triggerRef.current?.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
        className="w-72 p-2.5 space-y-2 shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-xs font-semibold truncate">{badgeLabel}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shrink-0">
              {format} · {sizeText}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-6 px-2 text-xs gap-1 shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span>{t('console.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>{t('console.copyBase64')}</span>
              </>
            )}
          </Button>
        </div>

        <div
          className="flex min-h-[5rem] max-h-60 w-full items-center justify-center overflow-hidden rounded border border-border/50 p-2"
          style={{
            backgroundColor: 'hsl(var(--muted) / 0.3)',
            backgroundImage:
              'linear-gradient(45deg, hsl(var(--foreground) / 0.05) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--foreground) / 0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--foreground) / 0.05) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--foreground) / 0.05) 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
          }}
        >
          {!imgError && dataUrl ? (
            <img
              src={dataUrl}
              alt={badgeLabel}
              onError={() => setImgError(true)}
              className="max-h-52 w-auto max-w-full rounded object-contain shadow-sm"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 py-4 px-2 text-center text-xs text-muted-foreground">
              <ImageOff className="h-5 w-5 opacity-60" />
              <span>{t('console.imagePreviewFailed')}</span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

/**
 * 承接任意文本：若内部含有 base64 图片字符串，将其切分并原位替换为 Base64ImageBadge；
 * 若不含 base64，则直接返回纯文本，零额外 DOM 开销。
 */
const TextWithBase64 = memo(function TextWithBase64({ text }: { text: string }) {
  if (!text || TRIMMED_EMPTY_REGEX.test(text) || !HAS_BASE64_REGEX.test(text)) {
    return <>{text}</>;
  }

  const parts = text.split(SPLIT_BASE64_REGEX);

  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null;
        if (idx % 2 === 1) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: immutable tokens
            <Base64ImageBadge key={idx} rawValue={part} />
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: immutable tokens
          <React.Fragment key={idx}>{part}</React.Fragment>
        );
      })}
    </>
  );
});

// 简化的渲染器 - 避免递归创建太多DOM节点
const SimpleRenderer = memo(function SimpleRenderer({
  obj,
  depth = 0,
}: {
  obj: unknown;
  depth?: number;
}) {
  // 深度限制 - 防止过度嵌套
  if (depth > 3) {
    return <span className="text-gray-400">...</span>;
  }

  if (obj === null || obj === undefined) {
    return <span className={colors.null}>null</span>;
  }

  if (typeof obj === 'boolean') {
    return <span className={colors.boolean}>{String(obj)}</span>;
  }

  if (typeof obj === 'number') {
    return <span className={colors.number}>{obj}</span>;
  }

  if (typeof obj === 'string') {
    return (
      <span className={colors.string}>
        "<TextWithBase64 text={obj} />"
      </span>
    );
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return <span className={colors.bracket}>[]</span>;
    }
    // 限制数组显示前5项
    const displayItems = obj.slice(0, 5);
    const hasMore = obj.length > 5;

    return (
      <span className={colors.bracket}>
        [
        {displayItems.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: preview slice
          <React.Fragment key={i}>
            {i > 0 && <span className={colors.bracket}>, </span>}
            <SimpleRenderer obj={item} depth={depth + 1} />
          </React.Fragment>
        ))}
        {hasMore && <span className="text-gray-400">...+{obj.length - 5}</span>}
        <span className={colors.bracket}>]</span>
      </span>
    );
  }

  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 0) {
      return <span className={colors.bracket}>{'{}'}</span>;
    }

    // ClassWrapper格式
    if (keys.length === 2 && '__class__' in record && 'args' in record) {
      const className = record.__class__;
      const args = record.args;
      if (typeof args !== 'object' || args === null) {
        return (
          <span>
            <span className={colors.className}>{String(className)}</span>
            <span className={colors.bracket}>({String(args)})</span>
          </span>
        );
      }
      const argsRecord = args as Record<string, unknown>;
      const argKeys = Object.keys(argsRecord).slice(0, 3); // 只显示前3个参数
      const hasMore = Object.keys(argsRecord).length > 3;
      return (
        <span>
          <span className={colors.className}>{String(className)}</span>
          <span className={colors.bracket}>(</span>
          {argKeys.map((key, i) => (
            <React.Fragment key={key}>
              {i > 0 && <span className={colors.bracket}>, </span>}
              <span className={colors.key}>{key}</span>
              <span className={colors.bracket}>:</span>
              <SimpleRenderer obj={argsRecord[key]} depth={depth + 1} />
            </React.Fragment>
          ))}
          {hasMore && <span className="text-gray-400">...</span>}
          <span className={colors.bracket}>)</span>
        </span>
      );
    }

    // 普通对象 - 只显示前4个键
    const displayKeys = keys.slice(0, 4);
    const hasMore = keys.length > 4;

    return (
      <span className={colors.bracket}>
        {'{'}
        {displayKeys.map((key, i) => (
          <React.Fragment key={key}>
            {i > 0 && <span className={colors.bracket}>, </span>}
            <span className={colors.key}>"{key}"</span>
            <span className={colors.bracket}>:</span>
            <SimpleRenderer obj={record[key]} depth={depth + 1} />
          </React.Fragment>
        ))}
        {hasMore && <span className="text-gray-400">...</span>}
        {'}'}
      </span>
    );
  }

  return <span className={colors.normal}>{String(obj)}</span>;
});

const StructuredDataViewer = memo(function StructuredDataViewer({
  data,
  className = '',
}: StructuredDataViewerProps) {
  const hasStructure = Boolean(data && HAS_STRUCTURE_REGEX.test(data));
  const parsed = useMemo(
    () => (hasStructure ? tryParseStructuredData(data) : null),
    [data, hasStructure],
  );

  if (!hasStructure) {
    return (
      <span className={className}>
        <TextWithBase64 text={data} />
      </span>
    );
  }

  if (parsed) {
    return (
      <span className={className}>
        <SimpleRenderer obj={parsed} />
      </span>
    );
  }

  return (
    <span className={className}>
      <TextWithBase64 text={data} />
    </span>
  );
});

export { StructuredDataViewer };
