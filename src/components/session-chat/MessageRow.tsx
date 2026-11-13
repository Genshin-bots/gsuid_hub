/**
 * 消息流里的一条。
 *
 * 机器人自己发的靠右，别人靠左。消息头（头像 + 昵称 + 群身份 + 时间）在气泡上方，
 * 操作收敛到右键菜单：@提及 / 复制 / 查看原始消息 / 引用回复。点头像弹出这个人的信息卡。
 */
import { useState } from 'react';
import {
  AlertCircle,
  AtSign,
  Bot,
  ChevronDown,
  ClipboardPaste,
  Code2,
  Copy,
  Loader2,
  Quote,
  Repeat,
  RotateCcw,
  User,
} from 'lucide-react';
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
import { sessionChatApi } from '@/lib/api';
import {
  ROLE_KEY,
  assetUrl,
  formatClock,
  messageToText,
  type BtnItem,
  type ChatMsg,
  type EvidenceObservation,
  type MsgSender,
} from '@/lib/sessionChat';
import { SegmentView } from './SegmentView';

interface MessageRowProps {
  msg: ChatMsg;
  /** 右键「引用回复」：把这条塞进输入框的引用位 */
  onReply: (msg: ChatMsg) => void;
  /** 右键「@提及」：把发送者塞进输入框的 @ 列表 */
  onAt: (msg: ChatMsg) => void;
  /**
   * 虚拟会话视角反转：
   * - false（默认）：右侧为机器人（assistant），左侧为用户（user）
   * - true（虚拟会话）：右侧为自己（user），左侧为 Agent（assistant）
   */
  invertPerspective?: boolean;
  /** 虚拟会话：失败重发 */
  onRetry?: (msg: ChatMsg) => void;
  /** 虚拟会话：+1 再发一次 */
  onPlusOne?: (msg: ChatMsg) => void;
  /** 虚拟会话：复制文本到输入框 */
  onCopyToInput?: (msg: ChatMsg) => void;
  /** 虚拟会话：点击消息内交互按钮 */
  onButtonClick?: (btn: BtnItem) => void;
  /** 真实会话 ID：出站消息展开「依据」时按它拉取证据观测 */
  sessionId?: string;
  /** uid → 显示名（证据行「替谁查」用） */
  resolveName?: (uid: string) => string | undefined;
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

/** 出站消息的证据观测明细：点「依据」才请求接口，空结果说明观测已被逐出缓存。 */
function EvidenceDetails({
  sessionId,
  obsIds,
  resolveName,
}: {
  sessionId: string;
  obsIds: string[];
  resolveName?: (uid: string) => string | undefined;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<EvidenceObservation[] | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || items !== null || loading) return;
    setLoading(true);
    try {
      const res = await sessionChatApi.getEvidence(sessionId, obsIds);
      setItems(res.observations);
    } catch {
      toast.error(t('sessionManagement.evidenceFailed'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const nameOf = (uid: string) => resolveName?.(uid) || uid;
  const credLabel = (obs: EvidenceObservation): string => {
    if (obs.credential_owner === 'shared') return t('sessionManagement.evidenceCredShared');
    if (obs.credential_owner)
      return t('sessionManagement.evidenceCredPersonal', { name: nameOf(obs.credential_owner) });
    return '';
  };

  return (
    <div className="mt-0.5 text-left">
      <button
        type="button"
        onClick={() => void toggle()}
        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', !open && '-rotate-90')} />
        {t('sessionManagement.evidenceBasis', { count: obsIds.length })}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 rounded-md border border-border/50 bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
          {loading && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {t('sessionManagement.evidenceLoading')}
            </span>
          )}
          {!loading && items !== null && items.length === 0 && (
            <span>{t('sessionManagement.evidenceEmpty')}</span>
          )}
          {!loading &&
            items?.map((obs) => {
              const cred = credLabel(obs);
              return (
                <div key={obs.obs_id} className="break-all">
                  {t('sessionManagement.evidenceFor', { name: nameOf(obs.requested_by) })}
                  {cred ? ` · ${cred}` : ''} · {obs.outcome_label} · {formatClock(obs.observed_at)}
                  <span className="block text-[10px] opacity-70">
                    {obs.obs_id} · {obs.service} · {obs.summary}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function MessageRow({
  msg,
  onReply,
  onAt,
  invertPerspective = false,
  onRetry,
  onPlusOne,
  onCopyToInput,
  onButtonClick,
  sessionId,
  resolveName,
}: MessageRowProps) {
  const { t } = useLanguage();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const name = displayName(msg, t('sessionManagement.unknown'));
  const avatar = avatarOf(msg);
  const identity = identityOf(msg, t);
  const isBotSender = msg.role === 'assistant';
  const isSelf = invertPerspective ? msg.role === 'user' : msg.self || msg.role === 'assistant';
  // reply_id 渲染时丢掉
  const segments = (msg.segments ?? []).filter(
    (seg) => !(seg.type === 'unknown' && seg.kind === 'reply_id'),
  );
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

  if (msg.isSystem) {
    return (
      <div className="my-2 flex justify-center">
        <div className="max-w-[85%] rounded-full border border-border/50 bg-muted/60 px-3 py-1 text-center text-xs text-muted-foreground">
          {msg.content || messageToText(msg)}
        </div>
      </div>
    );
  }

  const userRows: Array<{ label: string; value: string }> = [];
  const sender = msg.sender ?? {};
  if (isBotSender)
    userRows.push({
      label: t('sessionManagement.senderSource'),
      value: t('sessionManagement.senderBot'),
    });
  if (sender.card && sender.card !== sender.nickname) {
    userRows.push({ label: t('sessionManagement.senderCard'), value: sender.card });
  }
  if (sender.role) {
    userRows.push({
      label: t('sessionManagement.senderRole'),
      value: ROLE_KEY[sender.role] ? t(ROLE_KEY[sender.role]) : sender.role,
    });
  }
  if (sender.title)
    userRows.push({ label: t('sessionManagement.senderTitle'), value: sender.title });
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
            className={cn(
              'mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted',
              invertPerspective &&
                (isSelf
                  ? 'ring-2 ring-emerald-500/35 bg-emerald-500/10'
                  : 'ring-2 ring-violet-500/35 bg-violet-500/10'),
            )}
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
              <span
                className={cn(
                  'flex h-full w-full items-center justify-center text-xs text-muted-foreground',
                  invertPerspective &&
                    (isSelf
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-violet-600 dark:text-violet-400'),
                )}
              >
                {isBotSender ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  name.slice(0, 1) || <User className="h-4 w-4" />
                )}
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
        <div
          className={cn(
            'mb-0.5 flex items-baseline gap-1.5 text-[11px] text-muted-foreground',
            isSelf && 'flex-row-reverse',
          )}
        >
          <span className="max-w-[160px] truncate">{name}</span>
          {invertPerspective && (
            <span
              className={cn(
                'rounded px-1.5 py-0.2 text-[10px] font-medium shrink-0',
                isSelf
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                  : 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/25',
              )}
            >
              {isSelf ? t('sessionManagement.roleSelfUser') : t('sessionManagement.roleAgentBot')}
            </span>
          )}
          {identity && (
            <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
              {identity}
            </span>
          )}
          {msg.link?.seq != null && (
            <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              #{msg.link.seq}
            </span>
          )}
          {msg.link?.reply_to_seq != null && (
            <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              ↩#{msg.link.reply_to_seq}
            </span>
          )}
          <span>{formatClock(msg.timestamp)}</span>
          {msg.status === 'sending' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {t('liveChat.sending')}
            </span>
          )}
          {msg.status === 'failed' && (
            <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
              <AlertCircle className="h-2.5 w-2.5" />
              {t('liveChat.sendFailed')}
            </span>
          )}
          {msg.recalled && (
            <span className="rounded bg-amber-500/15 px-1 text-[10px] text-amber-600">
              {t('liveChat.messageRecalled')}
            </span>
          )}
        </div>

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'inline-block max-w-full cursor-default whitespace-normal break-words rounded-lg border p-2.5 text-left text-sm leading-relaxed shadow-sm',
                invertPerspective
                  ? isSelf
                    ? 'rounded-tr-none border-emerald-500/30 bg-emerald-500/10 dark:border-emerald-400/25 dark:bg-emerald-500/15'
                    : 'rounded-tl-none border-violet-500/25 bg-card'
                  : isSelf
                    ? 'rounded-tr-none border-primary/25 bg-primary/10'
                    : 'rounded-tl-none border-border/60 bg-card',
                msg.status === 'failed' && 'border-destructive/50',
                msg.recalled && 'opacity-55 line-through',
              )}
            >
              {quoteSegs.length > 0 && (
                <div className="mb-1">
                  {quoteSegs.map((seg, idx) => (
                    <SegmentView key={`q${idx}`} seg={seg} compact onButtonClick={onButtonClick} />
                  ))}
                </div>
              )}
              {bodySegs.length > 0
                ? bodySegs.map((seg, idx) => (
                    <SegmentView key={`b${idx}`} seg={seg} onButtonClick={onButtonClick} />
                  ))
                : quoteSegs.length === 0 && (
                    <span className="text-muted-foreground">
                      {t('sessionManagement.emptyMessage')}
                    </span>
                  )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onSelect={() => onAt(msg)}>
              <AtSign className="mr-2 h-3.5 w-3.5" />
              {t('sessionManagement.mention')}
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void copyMessage()}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              {t('sessionManagement.copy')}
            </ContextMenuItem>
            {invertPerspective && onCopyToInput && (
              <ContextMenuItem onSelect={() => onCopyToInput(msg)}>
                <ClipboardPaste className="mr-2 h-3.5 w-3.5" />
                {t('liveChat.copyToInput')}
              </ContextMenuItem>
            )}
            {invertPerspective && isSelf && onPlusOne && (
              <ContextMenuItem onSelect={() => onPlusOne(msg)}>
                <Repeat className="mr-2 h-3.5 w-3.5" />
                {t('liveChat.plusOne')}
              </ContextMenuItem>
            )}
            {invertPerspective && isSelf && msg.status === 'failed' && onRetry && (
              <ContextMenuItem onSelect={() => onRetry(msg)}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                {t('liveChat.retrySend')}
              </ContextMenuItem>
            )}
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

        {msg.link?.evidence && msg.link.evidence.length > 0 && sessionId && (
          <div className={cn(isSelf && 'flex justify-end')}>
            <EvidenceDetails
              sessionId={sessionId}
              obsIds={msg.link.evidence}
              resolveName={resolveName}
            />
          </div>
        )}

        {invertPerspective && (
          <div
            className={cn(
              'mt-0.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100',
              isSelf && 'justify-end',
              msg.status === 'failed' && 'opacity-100',
            )}
          >
            {isSelf && msg.status === 'failed' && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(msg)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/10"
              >
                <RotateCcw className="h-3 w-3" />
                <span>{t('liveChat.retrySend')}</span>
              </button>
            )}
            {isSelf && onPlusOne && (
              <button
                type="button"
                onClick={() => onPlusOne(msg)}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                <Repeat className="h-3 w-3" />
                <span>+1</span>
              </button>
            )}
            {onCopyToInput && (
              <button
                type="button"
                onClick={() => onCopyToInput(msg)}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              >
                <ClipboardPaste className="h-3 w-3" />
                <span>{t('liveChat.copyToInput')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onReply(msg)}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <Quote className="h-3 w-3" />
              <span>{t('liveChat.reply')}</span>
            </button>
          </div>
        )}
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
