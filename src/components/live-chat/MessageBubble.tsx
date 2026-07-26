import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { ButtonData, ChatBlock, ChatMessage } from '@/lib/liveChat';
import { messageHasText } from '@/lib/liveChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Bot,
  User,
  FileText,
  Download,
  Reply,
  AtSign,
  Image as ImageIcon,
  CornerDownRight,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { format } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
  /** 解析 reply 引用目标的预览文案 */
  resolveReplyPreview?: (msgId: string) => string | undefined;
  onReply?: (message: ChatMessage) => void;
  onButtonClick?: (button: ButtonData) => void;
  /** 发送失败后重试（仅 failed） */
  onRetry?: (message: ChatMessage) => void;
  /** +1：再发一遍相同内容 */
  onPlusOne?: (message: ChatMessage) => void;
  /** 复制文本到输入框 */
  onCopyToInput?: (message: ChatMessage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Block renderers
// ============================================================================

function ImageBlock({ src, alt }: { src: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <ImageIcon className="w-4 h-4" />
        <span>{alt || 'image'}</span>
      </div>
    );
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block max-w-full">
      <img
        src={src}
        alt={alt || 'image'}
        className="max-w-full max-h-72 rounded-lg object-contain cursor-zoom-in"
        onError={() => setFailed(true)}
      />
    </a>
  );
}

function BlockContent({
  block,
  onButtonClick,
  resolveReplyPreview,
  t,
}: {
  block: ChatBlock;
  onButtonClick?: (button: ButtonData) => void;
  resolveReplyPreview?: (msgId: string) => string | undefined;
  t: MessageBubbleProps['t'];
}) {
  switch (block.kind) {
    case 'text':
      return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{block.text}</p>;

    case 'markdown':
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
        </div>
      );

    case 'image':
      return <ImageBlock src={block.src} />;

    case 'record':
      return (
        <audio controls className="max-w-full h-10" preload="metadata" src={block.src}>
          <track kind="captions" />
        </audio>
      );

    case 'video':
      return (
        <video controls className="max-w-full max-h-72 rounded-lg" preload="metadata" src={block.src}>
          <track kind="captions" />
        </video>
      );

    case 'file':
      return (
        <a
          href={block.src}
          download={block.name}
          className="inline-flex items-center gap-2 text-sm underline-offset-2 hover:underline"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-[14rem]">{block.name}</span>
          <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />
        </a>
      );

    case 'at':
      return (
        <span className="inline-flex items-center gap-0.5 text-sm text-primary font-medium mx-0.5">
          <AtSign className="w-3.5 h-3.5" />
          {block.userId}
        </span>
      );

    case 'reply': {
      const preview = resolveReplyPreview?.(block.msgId);
      return (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 mb-1">
          <CornerDownRight className="w-3 h-3 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium opacity-80">{t('liveChat.replyTo')}</div>
            <div className="truncate">{preview || block.msgId}</div>
          </div>
        </div>
      );
    }

    case 'buttons':
      return (
        <div className="flex flex-col gap-1.5 mt-1 w-full">
          {block.rows.map((row, ri) => (
            <div key={ri} className="flex flex-wrap gap-1.5">
              {row.map((btn, bi) => (
                <Button
                  key={`${ri}-${bi}-${btn.text}`}
                  type="button"
                  size="sm"
                  variant={btn.style === 0 ? 'outline' : 'default'}
                  className="h-8 text-xs"
                  onClick={() => onButtonClick?.(btn)}
                  title={btn.data}
                >
                  {btn.text}
                </Button>
              ))}
            </div>
          ))}
        </div>
      );

    case 'node':
      return (
        <div className="space-y-2 border border-border/50 rounded-lg p-2 bg-background/40">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            {t('liveChat.forwardMessage')}
          </div>
          {block.items.map((itemBlocks, i) => (
            <div key={i} className="rounded-md bg-muted/40 px-2 py-1.5 space-y-1">
              {itemBlocks.map((b, j) => (
                <BlockContent
                  key={j}
                  block={b}
                  onButtonClick={onButtonClick}
                  resolveReplyPreview={resolveReplyPreview}
                  t={t}
                />
              ))}
            </div>
          ))}
        </div>
      );

    case 'meta':
      return (
        <div className="text-xs text-muted-foreground italic">
          {t('liveChat.metaEvent', { event: block.event })}
          {block.data && Object.keys(block.data).length > 0 && (
            <span className="ml-1 not-italic opacity-70">
              {Object.entries(block.data)
                .map(([k, v]) => `${k}=${String(v)}`)
                .join(' · ')}
            </span>
          )}
        </div>
      );

    case 'unknown':
      return (
        <div className="text-xs text-muted-foreground font-mono break-all">
          [{block.type}] {typeof block.data === 'string' ? block.data : JSON.stringify(block.data)}
        </div>
      );

    case 'control':
      return null;

    default:
      return null;
  }
}

// ============================================================================
// 气泡正左侧操作：与气泡同一水平行，紧贴左侧
// 失败重试 + +1 + 复制 全部 flex-row 横排
// ============================================================================

const ACTION_BTN =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/80 hover:text-foreground';

function MessageActions({
  message,
  onRetry,
  onPlusOne,
  onCopyToInput,
  t,
}: {
  message: ChatMessage;
  onRetry?: (message: ChatMessage) => void;
  onPlusOne?: (message: ChatMessage) => void;
  onCopyToInput?: (message: ChatMessage) => void;
  t: MessageBubbleProps['t'];
}) {
  const hasText = messageHasText(message);
  const showRetry = message.status === 'failed' && !!onRetry;
  const showPlusOne = hasText && !!onPlusOne;
  const showCopy = hasText && !!onCopyToInput;

  if (!showRetry && !showPlusOne && !showCopy) return null;

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={cn(
          // 与气泡同一行、紧贴左侧，gap 尽量小
          'flex shrink-0 flex-row items-center gap-0.5',
          // 失败重试始终可见；+1/复制悬停显示（有失败时整组常显）
          'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
          'transition-opacity',
          showRetry && 'sm:opacity-100',
        )}
      >
        {showRetry && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(ACTION_BTN, 'text-red-500 hover:bg-red-500/10 hover:text-red-600')}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry?.(message);
                }}
                aria-label={t('liveChat.retrySend')}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('liveChat.retrySend')}</TooltipContent>
          </Tooltip>
        )}
        {showPlusOne && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(ACTION_BTN, 'text-[11px] font-semibold leading-none')}
                onClick={(e) => {
                  e.stopPropagation();
                  onPlusOne?.(message);
                }}
                aria-label={t('liveChat.plusOne')}
              >
                +1
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('liveChat.plusOne')}</TooltipContent>
          </Tooltip>
        )}
        {showCopy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={ACTION_BTN}
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyToInput?.(message);
                }}
                aria-label={t('liveChat.copyToInput')}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{t('liveChat.copyToInput')}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Bubble
// ============================================================================

export function MessageBubble({
  message,
  resolveReplyPreview,
  onReply,
  onButtonClick,
  onRetry,
  onPlusOne,
  onCopyToInput,
  t,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const timeLabel = useMemo(() => {
    try {
      return format(new Date(message.timestamp), 'HH:mm:ss');
    } catch {
      return '';
    }
  }, [message.timestamp]);

  if (isSystem) {
    return (
      <div className="flex justify-center my-3 px-4">
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1 max-w-[90%] text-center">
          {message.blocks.map((b, i) =>
            b.kind === 'text' ? (
              <span key={i}>{b.text}</span>
            ) : b.kind === 'meta' ? (
              <span key={i}>
                {t('liveChat.metaEvent', { event: b.event })}
              </span>
            ) : null,
          )}
        </div>
      </div>
    );
  }

  if (message.recalled) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-muted-foreground italic">{t('liveChat.messageRecalled')}</span>
      </div>
    );
  }

  const replyBlocks = message.blocks.filter((b) => b.kind === 'reply');
  const bodyBlocks = message.blocks.filter((b) => b.kind !== 'reply' && b.kind !== 'control');

  const actions = (
    <MessageActions
      message={message}
      onRetry={onRetry}
      onPlusOne={onPlusOne}
      onCopyToInput={onCopyToInput}
      t={t}
    />
  );

  // 自己在右、Agent 在左；操作条与气泡同一水平行、紧贴气泡左侧
  return (
    <div
      className={cn(
        'group mb-3 flex gap-2 px-1 sm:mb-4 sm:gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-9 sm:w-9',
          isUser ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {isUser && message.senderAvatar ? (
          <Avatar className="h-full w-full">
            <AvatarImage src={message.senderAvatar} alt={message.senderName || 'user'} />
            <AvatarFallback className="bg-primary/15 text-xs text-primary">
              {(message.senderName || 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : isUser ? (
          message.senderName ? (
            <span className="text-xs font-medium">{message.senderName.charAt(0).toUpperCase()}</span>
          ) : (
            <User className="h-4 w-4" />
          )
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>

      <div className={cn('flex min-w-0 max-w-[82%] flex-col sm:max-w-[70%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'mb-0.5 flex items-center gap-2 text-[10px] text-muted-foreground sm:text-xs',
            isUser ? 'flex-row-reverse' : 'flex-row',
          )}
        >
          <span className="font-medium text-foreground/70">
            {isUser ? message.senderName || t('liveChat.you') : message.senderName || 'Bot'}
          </span>
          <span>{timeLabel}</span>
          {message.status === 'sending' && (
            <span className="opacity-70">{t('liveChat.sending')}</span>
          )}
          {message.status === 'failed' && (
            <span className="text-red-500">{t('liveChat.sendFailed')}</span>
          )}
        </div>

        {/* 操作与气泡同一水平行、紧贴：
            自己在右 → 按钮在气泡左侧；Agent 在左 → 按钮在气泡右侧 */}
        <div className="flex min-w-0 flex-row items-center gap-0.5">
          {isUser && actions}
          <div
            className={cn(
              'relative min-w-0 space-y-1.5 rounded-2xl px-3 py-2 text-sm sm:px-3.5 sm:py-2.5',
              isUser
                ? 'rounded-tr-md bg-primary text-primary-foreground'
                : 'rounded-tl-md bg-muted',
              message.status === 'failed' && 'ring-1 ring-red-500/40',
            )}
          >
            {replyBlocks.map((b, i) => (
              <BlockContent
                key={`r-${i}`}
                block={b}
                resolveReplyPreview={resolveReplyPreview}
                onButtonClick={onButtonClick}
                t={t}
              />
            ))}
            {bodyBlocks.length === 0 && replyBlocks.length === 0 ? (
              <p className="text-xs opacity-70">…</p>
            ) : (
              bodyBlocks.map((b, i) => (
                <BlockContent
                  key={i}
                  block={b}
                  resolveReplyPreview={resolveReplyPreview}
                  onButtonClick={onButtonClick}
                  t={t}
                />
              ))
            )}
          </div>
          {!isUser && actions}
        </div>

        {onReply && message.msgId && (
          <button
            type="button"
            onClick={() => onReply(message)}
            className={cn(
              'mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-opacity hover:text-foreground',
              'opacity-0 group-hover:opacity-100 focus:opacity-100',
            )}
          >
            <Reply className="h-3 w-3" />
            {t('liveChat.reply')}
          </button>
        )}
      </div>
    </div>
  );
}
