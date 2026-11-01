/**
 * 会话管理（消息记录）
 *
 * 数据全部来自 `/api/history/chat/*`，新消息由 `/api/history/chat/ws` 实时推送。
 * 消息段是**收发原始数据**：入站是适配器上报的段，出站是转换与 markdown 之后实际下发的那条。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Database,
  FileText,
  MessageCircle,
  Pin,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Composer, type MentionItem } from '@/components/session-chat/Composer';
import { SessionList, type ChatType } from '@/components/session-chat/SessionList';
import { SessionAvatar } from '@/components/session-chat/SessionAvatar';
import { MessageRow } from '@/components/session-chat/MessageRow';
import { TargetInfoCard } from '@/components/session-chat/TargetInfoCard';
import { CacheSettingsDialog } from '@/components/session-chat/CacheSettingsDialog';
import {
  getApiErrorMessage,
  historyApi,
  sessionChatApi,
  type SessionHistoryTextResponse,
} from '@/lib/api';
import {
  botKeyOf,
  formatDay,
  needDayDivider,
  SessionChatWs,
  type ChatMsg,
  type SendPayload,
  type SessionItem,
  type TargetInfo,
  type WsFrame,
} from '@/lib/sessionChat';
import { cn } from '@/lib/utils';

export default function SessionManagementPage() {
  const { t } = useLanguage();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [activeId, setActiveId] = useState('');
  // Bot 与群/私聊分组：只影响列表的可见范围，会话本身不区分
  const [botKey, setBotKey] = useState('all');
  const [chatType, setChatType] = useState<ChatType>('all');

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // 聊天模式看缓存表里的分段消息，文本模式直接看内存里那份历史原文（HistoryManager）
  const [viewMode, setViewMode] = useState<'chat' | 'text'>('chat');
  const [historyText, setHistoryText] = useState('');
  const [historyTextLoading, setHistoryTextLoading] = useState(false);

  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [mention, setMention] = useState<MentionItem | null>(null);

  const [wsState, setWsState] = useState<'connecting' | 'open' | 'closed'>('closed');

  const [infoOpen, setInfoOpen] = useState(false);
  const [info, setInfo] = useState<TargetInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  const [clearOpen, setClearOpen] = useState(false);
  const [cacheOpen, setCacheOpen] = useState(false);
  // 发送失败的原始报错
  const [sendError, setSendError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef('');
  activeIdRef.current = activeId;
  const viewModeRef = useRef<'chat' | 'text'>('chat');
  viewModeRef.current = viewMode;
  const sessionsRef = useRef<SessionItem[]>([]);
  sessionsRef.current = sessions;

  const activeSession = useMemo(
    () => sessions.find((item) => item.session_id === activeId) ?? null,
    [sessions, activeId],
  );

  const scrollToBottom = useCallback((smooth = false) => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // 会话列表
  const loadSessions = useCallback(async () => {
    try {
      const data = await sessionChatApi.getSessions();
      setSessions(data.sessions ?? []);
      return data.sessions ?? [];
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.loadFailed')));
      return [];
    } finally {
      setSessionsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSessions().then((list) => {
      if (list.length > 0) setActiveId((prev) => prev || list[0].session_id);
    });
  }, [loadSessions]);

  // 消息
  const loadMessages = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      setMessagesLoading(true);
      try {
        const data = await sessionChatApi.getMessages(sessionId);
        setMessages(data.messages ?? []);
        requestAnimationFrame(() => scrollToBottom());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('sessionManagement.loadDetailFailed')));
      } finally {
        setMessagesLoading(false);
      }
    },
    [t, scrollToBottom],
  );

  // 文本模式：/api/history/{id}?format_type=text 读的是内存里的 HistoryManager，
  // 和聊天模式用的消息缓存表不是同一份数据，所以单独拉一次
  const loadHistoryText = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      setHistoryTextLoading(true);
      try {
        const data = (await historyApi.getSessionHistory(
          sessionId,
          'text',
        )) as SessionHistoryTextResponse;
        // 请求在路上时可能已经切走了，别把旧会话的原文贴上去
        if (activeIdRef.current !== sessionId) return;
        setHistoryText(data?.content ?? '');
        requestAnimationFrame(() => scrollToBottom());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('sessionManagement.loadDetailFailed')));
      } finally {
        setHistoryTextLoading(false);
      }
    },
    [t, scrollToBottom],
  );

  useEffect(() => {
    setReplyTo(null);
    setMessages([]);
    setHistoryText('');
    if (!activeId) return;
    if (viewMode === 'text') void loadHistoryText(activeId);
    else void loadMessages(activeId);
  }, [activeId, viewMode, loadMessages, loadHistoryText]);

  // WebSocket
  useEffect(() => {
    const client = new SessionChatWs({
      onState: setWsState,
      onFrame: (frame: WsFrame) => {
        if (frame.type === 'ping') return;

        if (frame.type === 'message') {
          const incoming = frame.message;
          // 之前没见过的会话（新群第一次说话）：整表重拉，不然它不会出现在列表里
          if (!sessionsRef.current.some((item) => item.session_id === frame.session_id)) {
            void loadSessions();
          }
          // 会话列表：更新预览与时间并重排（置顶优先）
          setSessions((prev) => {
            const next = prev.map((item) =>
              item.session_id === frame.session_id
                ? {
                    ...item,
                    last_preview: incoming.preview ?? '',
                    last_role: incoming.role,
                    last_time: incoming.timestamp,
                    last_access: incoming.timestamp,
                    message_count: item.message_count + 1,
                  }
                : item,
            );
            next.sort(
              (a, b) =>
                Number(b.pinned) - Number(a.pinned) || (b.last_time || 0) - (a.last_time || 0),
            );
            return next;
          });

          if (frame.session_id !== activeIdRef.current) return;
          // 文本模式渲染的是内存历史的一份快照，来新消息只能整段重取
          if (viewModeRef.current === 'text') {
            void loadHistoryText(frame.session_id);
            return;
          }
          setMessages((prev) => {
            // 发完消息后本地也会重拉一次，这里按「同一秒同一角色同一内容」去重
            const last = prev[prev.length - 1];
            if (
              last &&
              last.role === incoming.role &&
              Math.abs((last.timestamp || 0) - (incoming.timestamp || 0)) < 0.001 &&
              last.content === incoming.content
            ) {
              return prev;
            }
            return [...prev, incoming];
          });
          requestAnimationFrame(() => scrollToBottom(true));
          return;
        }

        if (frame.type === 'cleared' || frame.type === 'deleted') {
          if (frame.session_id === activeIdRef.current) {
            setMessages([]);
            setHistoryText('');
          }
          void loadSessions();
        }
      },
    });
    client.connect();
    return () => client.disconnect();
  }, [loadSessions, loadHistoryText, scrollToBottom]);

  // 操作
  const patchSession = useCallback((sessionId: string, patch: Partial<SessionItem>) => {
    setSessions((prev) =>
      prev.map((item) => (item.session_id === sessionId ? { ...item, ...patch } : item)),
    );
  }, []);

  const handleSelect = (session: SessionItem) => {
    setActiveId(session.session_id);
  };

  // 切 Bot 或群/私聊后，当前打开的会话可能已经不在可见范围里，右侧跟着清空
  useEffect(() => {
    if (!activeId) return;
    const current = sessions.find((item) => item.session_id === activeId);
    if (!current) return;
    const hiddenByType = chatType !== 'all' && current.type !== chatType;
    const hiddenByBot = botKey !== 'all' && botKeyOf(current) !== botKey;
    if (!hiddenByType && !hiddenByBot) return;
    setActiveId('');
    setMessages([]);
    setHistoryText('');
  }, [activeId, sessions, botKey, chatType]);

  const handleTogglePin = async (session: SessionItem) => {
    try {
      const result = await sessionChatApi.updatePrefs(session.session_id, {
        pinned: !session.pinned,
      });
      // 改完置顶要立刻重排，和 patch 合成一次 setState，别渲染两遍
      setSessions((prev) =>
        prev
          .map((item) => (item.session_id === session.session_id ? { ...item, pinned: result.pinned } : item))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.last_time || 0) - (a.last_time || 0)),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.saveFailed')));
    }
  };

  const handleEditNote = async (session: SessionItem, note: string) => {
    try {
      const result = await sessionChatApi.updatePrefs(session.session_id, { note });
      patchSession(session.session_id, { note: result.note });
      toast.success(t('sessionManagement.noteSaved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.saveFailed')));
    }
  };

  const handleToggleBlacklist = async (session: SessionItem) => {
    try {
      const result = await sessionChatApi.updatePrefs(session.session_id, {
        blacklisted: !session.blacklisted,
      });
      patchSession(session.session_id, { blacklisted: result.blacklisted });
      toast.success(
        result.blacklisted ? t('sessionManagement.blacklistedOn') : t('sessionManagement.blacklistedOff'),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.saveFailed')));
    }
  };

  const openInfo = useCallback(
    async (session: SessionItem, userId = '') => {
      setInfo(null);
      setInfoOpen(true);
      setInfoLoading(true);
      try {
        const data = await sessionChatApi.getInfo(session.session_id, { userId });
        setInfo(data);
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('sessionManagement.loadDetailFailed')));
      } finally {
        setInfoLoading(false);
      }
    },
    [t],
  );

  const handleSend = async (payload: SendPayload): Promise<boolean> => {
    if (!activeId) return false;
    setSending(true);
    try {
      await sessionChatApi.send(activeId, payload);
      toast.success(t('sessionManagement.sendSuccess'));
      // WS 断着的时候推不过来，补一次拉取
      if (wsState !== 'open') await loadMessages(activeId);
      return true;
    } catch (error) {
      setSendError(getApiErrorMessage(error, t('sessionManagement.sendFailed')));
      // 告诉输入框别清空，用户还能改了再发
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    if (!activeId) return;
    try {
      await historyApi.clearSessionHistory(activeId, false);
      setMessages([]);
      setHistoryText('');
      toast.success(t('sessionManagement.clearSuccess', { id: activeId }));
      void loadSessions();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.clearFailed')));
    } finally {
      setClearOpen(false);
    }
  };

  // 渲染
  return (
    <div className="page-fill flex glass-card">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]">
        <SessionList
          sessions={sessions}
          activeId={activeId}
          keyword={keyword}
          onKeywordChange={setKeyword}
          botKey={botKey}
          onBotChange={setBotKey}
          chatType={chatType}
          onChatTypeChange={setChatType}
          onSelect={handleSelect}
          onTogglePin={handleTogglePin}
          onEditNote={handleEditNote}
          onViewInfo={(session) => void openInfo(session)}
          onToggleBlacklist={handleToggleBlacklist}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 头部：点头像就是看群/用户信息，不再单独放一个信息按钮 */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
            <button
              type="button"
              disabled={!activeSession}
              onClick={() => activeSession && void openInfo(activeSession)}
              title={activeSession ? t('sessionManagement.viewInfo') : undefined}
              className="shrink-0 rounded-full transition-opacity hover:opacity-80 disabled:cursor-default"
            >
              <SessionAvatar
                src={activeSession?.avatar}
                name={activeSession?.note || activeSession?.title}
                type={activeSession?.type}
                className="h-8 w-8"
              />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">
                  {activeSession?.note || activeSession?.title || t('sessionManagement.title')}
                </span>
                {activeSession?.pinned && <Pin className="h-3 w-3 text-primary" />}
                {activeSession?.blacklisted && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                    <Ban className="mr-0.5 h-2.5 w-2.5" />
                    {t('sessionManagement.blacklisted')}
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {activeSession
                  ? activeSession.type === 'group'
                    ? t('sessionManagement.groupChat')
                    : t('sessionManagement.privateChat')
                  : t('sessionManagement.selectSession')}
                {activeSession && ` · ${activeSession.message_count} ${t('sessionManagement.messages')}`}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1">
              {/* 聊天模式 / 文本模式：文本模式直接看内存里的历史原文，不发消息 */}
              <div className="mr-1 inline-flex items-center rounded-lg bg-muted/60 p-0.5">
                {(
                  [
                    { value: 'chat', label: t('sessionManagement.chatMode'), icon: MessageCircle },
                    { value: 'text', label: t('sessionManagement.textMode'), icon: FileText },
                  ] as const
                ).map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      disabled={!activeSession}
                      onClick={() => setViewMode(mode.value)}
                      title={mode.label}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all disabled:cursor-default disabled:opacity-40',
                        viewMode === mode.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
              <span
                className={cn(
                  'mr-1 inline-flex items-center gap-1 text-[11px]',
                  wsState === 'open' ? 'text-emerald-600' : 'text-muted-foreground',
                )}
                title={wsState === 'open' ? t('sessionManagement.wsConnected') : t('sessionManagement.wsDisconnected')}
              >
                {wsState === 'open' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setCacheOpen(true)}
                title={t('sessionManagement.cacheSettings')}
              >
                <Database className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => void loadSessions()}
                title={t('sessionManagement.refresh')}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', sessionsLoading && 'animate-spin')} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive"
                disabled={!activeSession}
                onClick={() => setClearOpen(true)}
                title={t('sessionManagement.confirmClear')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 消息流 */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {!activeSession ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
                <p>{t('sessionManagement.selectSession')}</p>
                <p className="text-xs">{t('sessionManagement.selectSessionDesc')}</p>
              </div>
            ) : viewMode === 'text' ? (
              historyTextLoading && !historyText ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  {t('sessionManagement.loading')}
                </p>
              ) : historyText ? (
                <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
                  {historyText}
                </pre>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  {t('sessionManagement.noHistory')}
                </p>
              )
            ) : messagesLoading && messages.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {t('sessionManagement.loading')}
              </p>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {t('sessionManagement.emptyMessages')}
              </p>
            ) : (
              messages.map((msg, idx) => {
                const prev = idx > 0 ? messages[idx - 1] : undefined;
                return (
                  <div key={`${msg.timestamp}-${idx}`}>
                    {needDayDivider(prev?.timestamp, msg.timestamp) && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {formatDay(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <MessageRow
                      msg={msg}
                      onReply={(target) => {
                        if (!target.msg_id) {
                          toast.info(t('sessionManagement.noMessageId'));
                          return;
                        }
                        setReplyTo(target);
                      }}
                      onAt={(target) =>
                        setMention({
                          userId: target.user_id,
                          name: target.sender?.card || target.sender?.nickname || target.user_id,
                        })
                      }
                    />
                  </div>
                );
              })
            )}
          </div>

          {viewMode === 'chat' && (
            <Composer
              disabled={!activeSession}
              sending={sending}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
              mention={mention}
              onClearMention={() => setMention(null)}
              onSend={handleSend}
            />
          )}
        </div>
      </div>

      <TargetInfoCard open={infoOpen} onOpenChange={setInfoOpen} info={info} loading={infoLoading} />

      <CacheSettingsDialog open={cacheOpen} onOpenChange={setCacheOpen} />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessionManagement.confirmClear')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sessionManagement.confirmClearMessage', { id: activeId })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sessionManagement.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleClear()}>
              {t('sessionManagement.confirmClear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sendError !== null} onOpenChange={(open) => !open && setSendError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessionManagement.sendFailed')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-2 text-left font-mono text-xs text-foreground/80">
                {sendError}
              </pre>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSendError(null)}>
              {t('sessionManagement.close')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
