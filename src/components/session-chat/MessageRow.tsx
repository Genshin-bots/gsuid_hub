/**
 * 消息流里的一条。
 *
 * 机器人自己发的靠右，别人靠左。消息头（头像 + 昵称 + 群身份 + 时间）在气泡上方，
 * 操作收敛到右键菜单：@提及 / 复制 / 查看原始消息 / 引用回复。点头像弹出这个人的信息卡。
 */
import { useState } from 'react';
import { Bot, AtSign, Copy, Code2, Quote, User } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  ROLE_KEY,
  assetUrl,
  formatClock,
  messageToText,
  type ChatMsg,
  type MsgSender,
} from '@/lib/sessionChat';
import { SegmentView } from './SegmentView';

interface MessageRowProps {
  msg: ChatMsg;
  /** 右键「引用回复」：把这条塞进输入框的引用位 */
  onReply: (msg: ChatMsg) => void;
  /** 右键「@提及」：把发送者塞进输入框的 @ 列表 */
  onAt: (msg: ChatMsg) => void;
}

/** 头像 / 昵称取值的兜底链：群名片 → 昵称 → id */
function displayName(msg: ChatMsg, fallback: string): string {
  const sender: MsgSender = msg.sender ?? {};
  return sender.card || sender.nickname || msg.user_name || msg.user_id || fallback;
}

function avatarOf(msg: ChatMsg): string {
  const direct = assetUrl(msg.sender?.avatar || msg.user_avatar || '');
  if (direct) return direct;
  // 机器人自己发的：库里没有头像，用 QQ 号拼一个
  if (msg.role === 'assistant' && /^\d{5,12}$/.test(msg.user_id || '')) {
    return `https://q1.qlogo.cn/g?b=qq&nk=${msg.user_id}&s=100`;
  }
  return '';
}

function identityOf(msg: ChatMsg, t: (key: string) => string): string {
  const sender = msg.sender ?? {};
  if (sender.title) return sender.title;
  // 只给群主 / 管理员挂标签，普通成员不显示，免得每条消息都顶个「群成员」
  const key = sender.role ? ROLE_KEY[sender.role] : '';
  return key ? t(key) : '';
}

export function MessageRow({ msg, onReply, onAt }: MessageRowProps) {
  const { t } = useLanguage();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const name = displayName(msg, t('sessionManagement.unknown'));
  const avatar = avatarOf(msg);
  const identity = identityOf(msg, t);
  const isSelf = msg.self || msg.role === 'assistant';
  // reply_id 渲染时丢掉
  const segments = (msg.segments ?? []).filter((seg) => !(seg.type === 'unknown' && seg.kind === 'reply_id'));
  // 引用内容都在 reply 段自己身上，正文是其余段
  const quoteSegs = segments.filter((seg) => seg.type === 'reply');
  const bodySegs = segments.filter((seg) => seg.type !== 'reply');

  const copyMessage = async () => {
    const text = messageToText(msg);
    if (!text) {
      toast.info(t('sessionManagement.noCopyableText'));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('sessionManagement.copied'));
    } catch {
      toast.error(t('sessionManagement.copyFailed'));
    }
  };

  const userRows: Array<{ label: string; value: string }> = [];
  const sender = msg.sender ?? {};
  if (isSelf) userRows.push({ label: t('sessionManagement.senderSource'), value: t('sessionManagement.senderBot') });
  if (sender.card && sender.card !== sender.nickname) {
    userRows.push({ label: t('sessionManagement.senderCard'), value: sender.card });
  }
  if (sender.role) {
    userRows.push({
      label: t('sessionManagement.senderRole'),
      value: ROLE_KEY[sender.role] ? t(ROLE_KEY[sender.role]) : sender.role,
    });
  }
  if (sender.title) userRows.push({ label: t('sessionManagement.senderTitle'), value: sender.title });
  if (sender.openid) userRows.push({ label: 'openid', value: sender.openid });
  userRows.push({
    label: t('sessionManagement.senderAccount'),
    value: msg.user_id || t('sessionManagement.unknown'),
  });
  if (sender.unionid) userRows.push({ label: 'unionid', value: sender.unionid });

  return (
    <div className={cn('group mb-3 flex gap-2', isSelf && 'flex-row-reverse')}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted"
            title={t('sessionManagement.clickForUserInfo')}
          >
            {avatar && !avatarFailed ? (
              <img
                src={avatar}
                alt={name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {isSelf ? <Bot className="h-4 w-4" /> : name.slice(0, 1) || <User className="h-4 w-4" />}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align={isSelf ? 'end' : 'start'} className="w-72 p-3">
          <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-2">
            <Avatar className="h-9 w-9">
              {avatar && !avatarFailed && <AvatarImage src={avatar} alt={name} />}
              <AvatarFallback className="text-xs">{name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 break-all text-sm font-semibold">{name}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {userRows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="whitespace-nowrap text-muted-foreground">{row.label}</dt>
                <dd className="break-all text-foreground/80">{row.value}</dd>
              </div>
            ))}
          </dl>
        </PopoverContent>
      </Popover>

      <div className={cn('min-w-0 max-w-[78%]', isSelf && 'text-right')}>
        <div className={cn('mb-0.5 flex items-baseline gap-1.5 text-[11px] text-muted-foreground', isSelf && 'flex-row-reverse')}>
          <span className="max-w-[160px] truncate">{name}</span>
          {identity && (
            <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{identity}</span>
          )}
          <span>{formatClock(msg.timestamp)}</span>
        </div>

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'inline-block max-w-full cursor-default whitespace-normal break-words rounded-lg border p-2.5 text-left text-sm leading-relaxed shadow-sm',
                isSelf
                  ? 'rounded-tr-none border-primary/25 bg-primary/10'
                  : 'rounded-tl-none border-border/60 bg-card',
              )}
            >
              {quoteSegs.length > 0 && (
                <div className="mb-1">
                  {quoteSegs.map((seg, idx) => (
                    <SegmentView key={`q${idx}`} seg={seg} compact />
                  ))}
                </div>
              )}
              {bodySegs.length > 0
                ? bodySegs.map((seg, idx) => <SegmentView key={`b${idx}`} seg={seg} />)
                : quoteSegs.length === 0 && (
                    <span className="text-muted-foreground">{t('sessionManagement.emptyMessage')}</span>
                  )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem onSelect={() => onAt(msg)}>
              <AtSign className="mr-2 h-3.5 w-3.5" />
              {t('sessionManagement.mention')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void copyMessage()}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              {t('sessionManagement.copy')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => setRawOpen(true)}>
              <Code2 className="mr-2 h-3.5 w-3.5" />
              {t('sessionManagement.viewRaw')}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => onReply(msg)}>
              <Quote className="mr-2 h-3.5 w-3.5" />
              {t('sessionManagement.reply')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>

      <Dialog open={rawOpen} onOpenChange={setRawOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('sessionManagement.rawTitle')}</DialogTitle>
            <DialogDescription>{t('sessionManagement.rawDesc')}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted/50 p-3 text-xs">
            {JSON.stringify(msg, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
