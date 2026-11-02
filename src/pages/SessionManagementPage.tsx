/**
 * 会话管理（消息记录）
 *
 * 数据全部来自 `/api/history/chat/*`，新消息由 `/api/history/chat/ws` 实时推送。
 * 消息段是**收发原始数据**：入站是适配器上报的段，出站是转换与 markdown 之后实际下发的那条。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  ArrowDown,
  ChevronLeft,
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

// 首屏只加载一页，列表滚到底 / 消息划到顶再各自往后拉
const SESSION_PAGE_SIZE = 30;
// 搜索要遍历全部会话才找得全，按大页补
const SESSION_SEARCH_PAGE_SIZE = 200;
const MESSAGE_PAGE_SIZE = 20;
// 离顶部这么近就预取更早的消息
const LOAD_OLDER_THRESHOLD = 60;

/** 列表顺序：置顶优先，其次按最后一条消息时间倒序。 */
const sortSessions = (a: SessionItem, b: SessionItem) =>
  Number(b.pinned) - Number(a.pinned) || (b.last_time || 0) - (a.last_time || 0);

/**
 * 同一条消息的指纹：翻页和 WS 推送可能把同一条给两次。
 * 也当 React key 用 —— 往前插入历史时下标会整体后移，用下标会让整列重挂载。
 */
const messageKey = (msg: ChatMsg) =>
  msg.key || `${msg.role}|${msg.timestamp}|${msg.user_id}|${msg.content}`;

/**
 * WS 帧和库里那条其实是同一条消息，但 key 对不上（实时没有 key，落库后是 `c{id}`）。
 * 只在「列表里那条来自库、角色 / 内容 / 时间戳完全一致」时才认定重复：
 * 机器人连发两条一样的话，key 不同、时间戳通常也不同，不会被误伤。
 */
const sameAsCached = (item: ChatMsg, incoming: ChatMsg) =>
  Boolean(item.key?.startsWith('c')) &&
  item.role === incoming.role &&
  item.content === incoming.content &&
  item.timestamp === incoming.timestamp;

export default function SessionManagementPage() {
  const { t } = useLanguage();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  // 列表滚到底再往后拉，首屏只拿一页
  const [sessionsHasMore, setSessionsHasMore] = useState(false);
  const [sessionsLoadingMore, setSessionsLoadingMore] = useState(false);
  // 服务端统计的会话总数
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [activeId, setActiveId] = useState('');
  // Bot 与群/私聊分组：只影响列表的可见范围，会话本身不区分
  const [botKey, setBotKey] = useState('all');
  const [chatType, setChatType] = useState<ChatType>('all');

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  // 消息划到顶再往前接，首屏只拿最新一页
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false);
  // 往上翻历史时来了新消息：不把人拽回底部，只在右下角挂个提醒
  const [hasNewWhileAway, setHasNewWhileAway] = useState(false);
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
  const messagesRef = useRef<ChatMsg[]>([]);
  messagesRef.current = messages;
  // 列表下一页的游标，空串表示到底；刷新时清空
  const sessionsCursorRef = useRef('');
  // 正在为「列表里还没有的会话」补数据的，别同一条帧来两次就查两次
  const pendingSessionRef = useRef<Set<string>>(new Set());
  // 往上翻的请求在飞的时候别再发一次，滚动事件触发得太密
  const loadingOlderRef = useRef(false);

  const activeSession = useMemo(
    () => sessions.find((item) => item.session_id === activeId) ?? null,
    [sessions, activeId],
  );

  /**
   * React key。库主键（`c{id}`）本身唯一；内存记录没有 key，退回内容指纹后
   * 给重复的加个序号，免得 React 报 key 冲突、翻页时又把同内容的两条当成一条吃掉。
   */
  const messageKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return messages.map((msg) => {
      const base = messageKey(msg);
      const nth = seen.get(base) ?? 0;
      seen.set(base, nth + 1);
      return nth === 0 ? base : `${base}#${nth}`;
    });
  }, [messages]);

  const scrollToBottom = useCallback((smooth = false) => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // 用户是不是就在底部附近。翻历史的时候来新消息不该把人拽走
  const nearBottom = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return true;
    return node.scrollHeight - node.scrollTop - node.clientHeight < 80;
  }, []);

  // 会话列表：append=false 是重拉第一页，append=true 是滚到底接下一页
  const loadSessions = useCallback(
    async (append = false, size = SESSION_PAGE_SIZE) => {
      if (append) setSessionsLoadingMore(true);
      else setSessionsLoading(true);
      try {
        // 游标分页：新消息插进来导致排序变化也不会漏项
        const cursor = append ? sessionsCursorRef.current : '';
        const data = await sessionChatApi.getSessions(size, cursor);
        const list = data.sessions ?? [];
        sessionsCursorRef.current = data.next_cursor ?? '';
        setSessionsHasMore(Boolean(data.has_more));
        // 总数只在重拉第一页时更新
        if (!append) setSessionsTotal(Number(data.total ?? list.length));
        setSessions((prev) => {
          if (append) {
            const seen = new Set(prev.map((item) => item.session_id));
            return [...prev, ...list.filter((item) => !seen.has(item.session_id))];
          }
          // 刷新只回第一页：正在看的会话可能落在后面几页，留着它，别让右侧突然空掉
          const keep = prev.find((item) => item.session_id === activeIdRef.current);
          if (!keep || list.some((item) => item.session_id === keep.session_id)) return list;
          // 按「置顶优先 + 最后时间倒序」插回它该在的位置，别一律丢到末尾
          const merged = [...list];
          const at = merged.findIndex((item) => sortSessions(keep, item) < 0);
          merged.splice(at < 0 ? merged.length : at, 0, keep);
          return merged;
        });
        return list;
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('sessionManagement.loadFailed')));
        return [];
      } finally {
        setSessionsLoading(false);
        setSessionsLoadingMore(false);
      }
    },
    [t],
  );

  const handleLoadMoreSessions = useCallback(() => {
    if (!sessionsHasMore || sessionsLoading || sessionsLoadingMore) return;
    void loadSessions(true, keyword.trim() ? SESSION_SEARCH_PAGE_SIZE : SESSION_PAGE_SIZE);
  }, [sessionsHasMore, sessionsLoading, sessionsLoadingMore, keyword, loadSessions]);

  useEffect(() => {
    void loadSessions().then((list) => {
      const wide = window.matchMedia('(min-width: 640px)').matches;
      if (list.length > 0 && wide) setActiveId((prev) => prev || list[0].session_id);
    });
  }, [loadSessions]);

  // 消息：首屏只拿最新一页
  const loadMessages = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      setMessagesLoading(true);
      try {
        const data = await sessionChatApi.getMessages(sessionId, MESSAGE_PAGE_SIZE);
        // 请求在路上时可能已经切走了，别把旧会话的消息贴上去
        if (activeIdRef.current !== sessionId) return;
        setMessages(data.messages ?? []);
        setMessagesHasMore(Boolean(data.has_more));
        requestAnimationFrame(() => scrollToBottom());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('sessionManagement.loadDetailFailed')));
      } finally {
        setMessagesLoading(false);
      }
    },
    [t, scrollToBottom],
  );

  // 消息划到顶：以当前最早一条的时间为游标往前接一页，接完把视野按新增高度补回来
  const loadOlderMessages = useCallback(async () => {
    const sessionId = activeIdRef.current;
    if (!sessionId || loadingOlderRef.current || !messagesHasMore) return;
    const first = messagesRef.current[0];
    if (!first) return;

    loadingOlderRef.current = true;
    setMessagesLoadingMore(true);
    const node = scrollRef.current;
    const prevHeight = node?.scrollHeight ?? 0;
    const prevTop = node?.scrollTop ?? 0;
    try {
      const data = await sessionChatApi.getMessages(sessionId, MESSAGE_PAGE_SIZE, first.timestamp);
      if (activeIdRef.current !== sessionId) return;
      setMessagesHasMore(Boolean(data.has_more));
      const older = data.messages ?? [];
      if (older.length === 0) return;
      setMessages((prev) => {
        const seen = new Set(prev.map(messageKey));
        const head = older.filter((item) => !seen.has(messageKey(item)));
        return head.length > 0 ? [...head, ...prev] : prev;
      });
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.loadDetailFailed')));
    } finally {
      loadingOlderRef.current = false;
      setMessagesLoadingMore(false);
    }
  }, [messagesHasMore, t]);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (nearBottom()) setHasNewWhileAway(false);
    if (!messagesHasMore) return;
    if (node.scrollTop > LOAD_OLDER_THRESHOLD) return;
    void loadOlderMessages();
  }, [messagesHasMore, loadOlderMessages, nearBottom]);

  useEffect(() => {
    if (viewMode !== 'chat' || !messagesHasMore || messagesLoading || messagesLoadingMore) return;
    const node = scrollRef.current;
    if (!node || node.scrollHeight > node.clientHeight + 4) return;
    void loadOlderMessages();
  }, [messages, messagesHasMore, messagesLoading, messagesLoadingMore, viewMode, loadOlderMessages]);

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

  /** 右下角「有新消息」：回到最新位置，并收掉提醒 */
  const jumpToLatest = useCallback(() => {
    setHasNewWhileAway(false);
    if (viewModeRef.current === 'text') {
      void loadHistoryText(activeIdRef.current);
      return;
    }
    scrollToBottom(true);
  }, [loadHistoryText, scrollToBottom]);

  useEffect(() => {
    setReplyTo(null);
    setMessages([]);
    setMessagesHasMore(false);
    setHasNewWhileAway(false);
    setHistoryText('');
    messagesRef.current = [];
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
          // 之前没见过的会话（新群第一次说话）：只把这一个取回来插进列表。
          if (
            !sessionsRef.current.some((item) => item.session_id === frame.session_id) &&
            !pendingSessionRef.current.has(frame.session_id)
          ) {
            const newId = frame.session_id;
            pendingSessionRef.current.add(newId);
            void sessionChatApi
              .getSessionsByIds([newId])
              .then((data) => {
                const item = data.sessions?.[0];
                // 会话元数据慢半拍（消息刚落地还没登记）：退回整表刷新兜底
                if (!item) {
                  void loadSessions();
                  return;
                }
                setSessions((prev) =>
                  prev.some((row) => row.session_id === item.session_id)
                    ? prev
                    : [...prev, item].sort(sortSessions),
                );
              })
              .catch(() => {
              })
              .finally(() => pendingSessionRef.current.delete(newId));
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
            next.sort(sortSessions);
            return next;
          });

          if (frame.session_id !== activeIdRef.current) return;
          const stick = nearBottom();
          // 文本模式渲染的是内存历史的一份快照，来新消息只能整段重取；
          // 正在上面看历史就别重取（会把人拽回底部），等点提醒再取
          if (viewModeRef.current === 'text') {
            if (stick) void loadHistoryText(frame.session_id);
            else setHasNewWhileAway(true);
            return;
          }
          setMessages((prev) =>
            prev.some(
              (item) => (incoming.key && item.key === incoming.key) || sameAsCached(item, incoming),
            )
              ? prev
              : [...prev, incoming],
          );
          if (stick) requestAnimationFrame(() => scrollToBottom(true));
          else setHasNewWhileAway(true);
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
  }, [loadSessions, loadHistoryText, scrollToBottom, nearBottom]);

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
          .sort(sortSessions),
      );
      // 置顶会改变排序，已翻过的页边界跟着失效；后面还有页就从头重拉
      if (sessionsHasMore) void loadSessions();
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
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]">
        {/* 移动端：列表与聊天各占一屏，选中会话后列表收起（返回按钮清空 activeId） */}
        <div
          className={cn(
            'absolute inset-0 z-10 flex min-h-0 w-full sm:relative sm:inset-auto sm:z-auto sm:w-72 sm:shrink-0',
            activeId && 'hidden sm:flex',
          )}
        >
          <SessionList
            sessions={sessions}
            activeId={activeId}
            keyword={keyword}
            onKeywordChange={setKeyword}
            botKey={botKey}
            onBotChange={setBotKey}
            chatType={chatType}
            onChatTypeChange={setChatType}
            hasMore={sessionsHasMore}
            loadingMore={sessionsLoadingMore}
            total={sessionsTotal}
            onLoadMore={handleLoadMoreSessions}
            onSelect={handleSelect}
            onTogglePin={handleTogglePin}
            onEditNote={handleEditNote}
            onViewInfo={(session) => void openInfo(session)}
            onToggleBlacklist={handleToggleBlacklist}
          />
        </div>

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            !activeId && 'hidden sm:flex',
          )}
        >
          {/* 头部：点头像就是看群/用户信息，不再单独放一个信息按钮 */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
            {/* 移动端返回列表：清空 activeId 即回到列表屏 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 sm:hidden"
              onClick={() => setActiveId('')}
              title={t('sessionManagement.title')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
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
              <div className="truncate text-[11px] text-muted-foreground">
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
                        'flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-all disabled:cursor-default disabled:opacity-40 sm:px-2 sm:py-1',
                        viewMode === mode.value
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
                {wsState === 'open' ? (
                  <Wifi className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                ) : (
                  <WifiOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 sm:h-7 sm:px-2"
                onClick={() => setCacheOpen(true)}
                title={t('sessionManagement.cacheSettings')}
              >
                <Database className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 sm:h-7 sm:px-2"
                onClick={() => void loadSessions()}
                title={t('sessionManagement.refresh')}
              >
                <RefreshCw className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', sessionsLoading && 'animate-spin')} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-destructive sm:h-7 sm:px-2"
                disabled={!activeSession}
                onClick={() => setClearOpen(true)}
                title={t('sessionManagement.confirmClear')}
              >
                <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Button>
            </div>
          </div>

          {/* 消息流 */}
          <div className="relative flex min-h-0 min-w-0 flex-1">
            <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
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
                <>
                  {(messagesLoadingMore ||
                    (messages.length > MESSAGE_PAGE_SIZE && !messagesHasMore)) && (
                    <div className="pb-1 text-center text-[10px] text-muted-foreground">
                      {messagesLoadingMore
                        ? t('sessionManagement.loadingMore')
                        : t('sessionManagement.noMoreMessages')}
                    </div>
                  )}
                  {messages.map((msg, idx) => {
                    const prev = idx > 0 ? messages[idx - 1] : undefined;
                    return (
                      <div key={messageKeys[idx]}>
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
                  })}
                </>
              )}
            </div>
            {hasNewWhileAway && (
              <button
                type="button"
                onClick={jumpToLatest}
                className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur transition-colors hover:bg-accent"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                {t('sessionManagement.newMessages')}
              </button>
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
