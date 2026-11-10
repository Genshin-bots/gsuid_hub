/**
 * 会话管理（消息记录 & 持久化虚拟会话）
 *
 * - 真实会话：数据来自 `/api/history/chat/*`，新消息由 `/api/history/chat/ws` 实时推送（右侧为机器人，左侧为用户）。
 * - 自主创建（持久化虚拟会话）：通过 `/ws/webconsole_livechat` 完整对接早柚协议，状态持久化在 `/api/live-chat/*`
 *   （视角反转：右侧为自己扮演的用户，左侧为 Agent / 机器人）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  Ban,
  Bot,
  ChevronLeft,
  Database,
  Eraser,
  FileText,
  Hash,
  Loader2,
  MessageCircle,
  Pin,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  User,
  UserCog,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ConnectionBadge } from '@/components/session-chat/ConnectionBadge';
import { SessionList, type ChatType } from '@/components/session-chat/SessionList';
import { SessionAvatar } from '@/components/session-chat/SessionAvatar';
import { MessageRow } from '@/components/session-chat/MessageRow';
import { TargetInfoCard } from '@/components/session-chat/TargetInfoCard';
import { CacheSettingsDialog } from '@/components/session-chat/CacheSettingsDialog';
import {
  getApiErrorMessage,
  getAuthToken,
  historyApi,
  liveChatApi,
  personaApi,
  sessionChatApi,
  type PersonaListItem,
  type SessionHistoryTextResponse,
} from '@/lib/api';
import {
  botKeyOf,
  conversationToSessionItem,
  formatClock,
  formatDay,
  isVirtualSessionId,
  liveChatMessageToChatMsg,
  messageToText,
  needDayDivider,
  SessionChatWs,
  VIRTUAL_SESSION_PREFIX,
  type BtnItem,
  type ChatMsg,
  type SendPayload,
  type SessionItem,
  type TargetInfo,
  type WsFrame,
} from '@/lib/sessionChat';
import {
  type ChatMessage,
  type ConnectionState,
  type Conversation,
  type ConversationType,
  type LiveChatIdentity,
  LiveChatWsClient,
  type MessageSegment,
  type MessageSend,
  blocksPreview,
  buildButtonClickReceive,
  buildMessageReceive,
  buildPokeReceive,
  buildRecallReceipt,
  conversationKey,
  createConversation,
  defaultIdentity,
  fileToBase64Payload,
  isControlPacket,
  loadLiveChatState,
  messageSendToChatMessage,
  saveLiveChatState,
  segmentsToBlocks,
  targetFromSend,
  uid,
} from '@/lib/liveChat';
import { cn } from '@/lib/utils';

function appendToConversation(
  list: Conversation[],
  convId: string,
  msg: ChatMessage,
): Conversation[] {
  const preview = blocksPreview(msg.blocks);
  return list.map((c) => {
    if (c.id !== convId) return c;
    return {
      ...c,
      messages: [...c.messages, msg],
      updatedAt: msg.timestamp,
      lastPreview: preview || c.lastPreview,
    };
  });
}

// 首屏只加载一页，列表滚到底 / 消息划到顶再各自往后拉
const SESSION_PAGE_SIZE = 30;
// 搜索要遍历全部会话才找得全，按大页补
const SESSION_SEARCH_PAGE_SIZE = 200;
const MESSAGE_PAGE_SIZE = 20;
// 离顶部这么近就预取更早的消息
const LOAD_OLDER_THRESHOLD = 60;

const VIRTUAL_META_STORAGE_KEY = 'gshub_virtual_session_meta_v1';

type VirtualMetaMap = Record<string, { pinned?: boolean; note?: string }>;

function loadVirtualMeta(): VirtualMetaMap {
  try {
    const raw = localStorage.getItem(VIRTUAL_META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as VirtualMetaMap) : {};
  } catch {
    return {};
  }
}

function saveVirtualMeta(meta: VirtualMetaMap) {
  try {
    localStorage.setItem(VIRTUAL_META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

function statusLabel(state: ConnectionState, t: (k: string) => string): string {
  switch (state) {
    case 'connected':
      return t('liveChat.status.connected');
    case 'connecting':
      return t('liveChat.status.connecting');
    case 'reconnecting':
      return t('liveChat.status.reconnecting');
    case 'error':
      return t('liveChat.status.error');
    default:
      return t('liveChat.status.disconnected');
  }
}

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
  // Bot 与群/私聊/虚拟分组：只影响列表的可见范围，会话本身不区分
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

  // =========================================================================
  // 自主创建（持久化虚拟会话 / webconsole_livechat）状态
  // =========================================================================
  const [identity, setIdentity] = useState<LiveChatIdentity>(() => defaultIdentity());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [virtualMeta, setVirtualMeta] = useState<VirtualMetaMap>(() => loadVirtualMeta());
  const [coreLoaded, setCoreLoaded] = useState(false);
  const [masters, setMasters] = useState<string[]>([]);
  const [liveConnState, setLiveConnState] = useState<ConnectionState>('disconnected');
  const [awaitingByConv, setAwaitingByConv] = useState<Record<string, boolean>>({});
  const awaitingTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [atBot, setAtBot] = useState(false);
  const [externalDraft, setExternalDraft] = useState<{ text: string; seq: number }>({
    text: '',
    seq: 0,
  });

  const personaAvatarMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of personas) {
      map[p.name] = p.has_avatar ? personaApi.getAvatarUrl(p.name) : '';
    }
    return map;
  }, [personas]);

  const personaNameSet = useMemo(() => new Set(personas.map((p) => p.name)), [personas]);

  const convBotSelfId = useCallback(
    (conv: Conversation) => {
      if (conv.type === 'direct') {
        if (personaNameSet.has(conv.targetId)) return conv.targetId;
        if (personaNameSet.has(conv.name)) return conv.name;
      }
      return identity.botSelfId;
    },
    [personaNameSet, identity.botSelfId],
  );

  // 新建虚拟会话弹窗
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newType, setNewType] = useState<ConversationType>('group');
  const [newTargetId, setNewTargetId] = useState('');
  const [newName, setNewName] = useState('');

  // 虚拟身份设置弹窗
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [idDraft, setIdDraft] = useState<LiveChatIdentity>(() => defaultIdentity());

  // 删除虚拟会话确认弹窗
  const [deleteVirtualTarget, setDeleteVirtualTarget] = useState<Conversation | null>(null);

  const liveClientRef = useRef<LiveChatWsClient | null>(null);

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
  // 向上翻页接历史消息时，记录 DOM 变更前的高度和位置，在 useLayoutEffect 里精准补齐偏移
  const scrollAnchorRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);

  // 虚拟会话转换为 SessionItem 列表（为每个 Persona 绑定其名称与头像）
  const virtualSessions = useMemo(
    () =>
      conversations.map((conv) => {
        const personaName =
          conv.type === 'direct' && personaNameSet.has(conv.targetId)
            ? conv.targetId
            : conv.type === 'direct' && personaNameSet.has(conv.name)
              ? conv.name
              : undefined;
        const avatar = personaName ? personaAvatarMap[personaName] || '' : '';
        return conversationToSessionItem(conv, identity, {
          ...virtualMeta[conv.id],
          personaName,
          avatar,
        });
      }),
    [conversations, identity, virtualMeta, personaNameSet, personaAvatarMap],
  );

  const activeSession = useMemo(
    () =>
      virtualSessions.find((item) => item.session_id === activeId) ??
      sessions.find((item) => item.session_id === activeId) ??
      null,
    [virtualSessions, sessions, activeId],
  );

  const activeVirtualConv = useMemo(
    () =>
      activeSession?.virtual && activeSession.virtualConvId
        ? (conversations.find((c) => c.id === activeSession.virtualConvId) ?? null)
        : null,
    [activeSession, conversations],
  );

  const activeVirtualAgentProfile = useMemo(() => {
    if (!activeVirtualConv) return undefined;
    const pName =
      activeVirtualConv.type === 'direct' && personaNameSet.has(activeVirtualConv.targetId)
        ? activeVirtualConv.targetId
        : activeVirtualConv.type === 'direct' && personaNameSet.has(activeVirtualConv.name)
          ? activeVirtualConv.name
          : undefined;
    if (!pName) return undefined;
    return {
      name: pName,
      avatar: personaAvatarMap[pName] || '',
    };
  }, [activeVirtualConv, personaNameSet, personaAvatarMap]);

  const virtualMessages = useMemo(
    () =>
      activeVirtualConv
        ? activeVirtualConv.messages.map((m) =>
            liveChatMessageToChatMsg(
              m,
              activeVirtualConv.messages,
              identity,
              activeVirtualAgentProfile,
            ),
          )
        : [],
    [activeVirtualConv, identity, activeVirtualAgentProfile],
  );

  const displayedMessages = activeSession?.virtual ? virtualMessages : messages;

  /**
   * React key。库主键（`c{id}`）本身唯一；内存记录没有 key，退回内容指纹后
   * 给重复的加个序号，免得 React 报 key 冲突、翻页时又把同内容的两条当成一条吃掉。
   */
  const messageKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return displayedMessages.map((msg) => {
      const base = messageKey(msg);
      const nth = seen.get(base) ?? 0;
      seen.set(base, nth + 1);
      return nth === 0 ? base : `${base}#${nth}`;
    });
  }, [displayedMessages]);

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

  // =========================================================================
  // 虚拟会话状态加载与持久化
  // =========================================================================
  const clearConvAwaiting = useCallback((convId: string) => {
    const timer = awaitingTimerRef.current[convId];
    if (timer) {
      clearTimeout(timer);
      delete awaitingTimerRef.current[convId];
    }
    setAwaitingByConv((prev) => {
      if (!prev[convId]) return prev;
      const next = { ...prev };
      delete next[convId];
      return next;
    });
  }, []);

  const markConvAwaiting = useCallback(
    (convId: string) => {
      const prevTimer = awaitingTimerRef.current[convId];
      if (prevTimer) clearTimeout(prevTimer);
      setAwaitingByConv((prev) => ({ ...prev, [convId]: true }));
      awaitingTimerRef.current[convId] = setTimeout(() => {
        clearConvAwaiting(convId);
      }, 120_000);
    },
    [clearConvAwaiting],
  );

  useEffect(() => {
    const timers = awaitingTimerRef.current;
    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer);
      }
    };
  }, []);

  // 启动时从后端拉持久化虚拟会话状态 + master 列表 + Persona 列表
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [persistedRes, bootRes, personaRes] = await Promise.allSettled([
        loadLiveChatState(),
        liveChatApi.getBootstrap(),
        personaApi.getPersonaList(),
      ]);
      if (cancelled) return;

      const fallbackIdentity = defaultIdentity();
      const persisted =
        persistedRes.status === 'fulfilled'
          ? persistedRes.value
          : { identity: fallbackIdentity, conversations: [], activeId: null };

      const masterList =
        bootRes.status === 'fulfilled' && Array.isArray(bootRes.value?.masters)
          ? bootRes.value.masters.filter((x): x is string => Boolean(x && String(x).trim()))
          : [];
      setMasters(masterList);

      const personaList =
        personaRes.status === 'fulfilled' && Array.isArray(personaRes.value)
          ? personaRes.value.filter((p): p is PersonaListItem => Boolean(p?.name?.trim()))
          : [];
      setPersonas(personaList);

      const firstMaster = masterList[0] || fallbackIdentity.userId;
      let loadedIdentity = persisted.identity;
      if (
        (!loadedIdentity.userId || loadedIdentity.userId === fallbackIdentity.userId) &&
        firstMaster
      ) {
        loadedIdentity = { ...loadedIdentity, userId: firstMaster };
      }

      // 为每个 Persona 确保存在对应的虚拟私聊会话，并清理旧版空默认「与主人私聊」占位会话
      let nextConversations = [...persisted.conversations];
      if (personaList.length > 0) {
        const pNames = new Set(personaList.map((p) => p.name));
        const legacyNames = new Set(['与主人私聊', 'DM with Master', '主人とのDM']);
        nextConversations = nextConversations.filter((c) => {
          if (c.messages.length > 0) return true;
          if (pNames.has(c.targetId) || pNames.has(c.name)) return true;
          if (
            c.type === 'direct' &&
            (legacyNames.has(c.name) ||
              c.targetId === 'master' ||
              c.targetId === firstMaster ||
              c.targetId === loadedIdentity.userId)
          ) {
            return false;
          }
          return true;
        });

        const existingIds = new Set(nextConversations.map((c) => c.id));
        const now = Date.now();
        const ensuredPersonaConvs: Conversation[] = [];
        personaList.forEach((p, idx) => {
          const cid = conversationKey('direct', p.name);
          if (!existingIds.has(cid)) {
            ensuredPersonaConvs.push({
              id: cid,
              type: 'direct',
              targetId: p.name,
              name: p.name,
              messages: [],
              updatedAt: now - idx,
            });
          }
        });
        if (ensuredPersonaConvs.length > 0) {
          nextConversations = [...nextConversations, ...ensuredPersonaConvs];
        }
      }

      setIdentity(loadedIdentity);
      setIdDraft(loadedIdentity);
      setConversations(nextConversations);
      setCoreLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 虚拟会话与身份变更写回后端
  useEffect(() => {
    if (!coreLoaded) return;
    void saveLiveChatState({
      identity,
      conversations,
      activeId: activeVirtualConv?.id ?? conversations[0]?.id ?? null,
    }).catch(() => {});
  }, [coreLoaded, identity, conversations, activeVirtualConv?.id]);

  // 虚拟会话置顶/备注写回本地存储
  useEffect(() => {
    saveVirtualMeta(virtualMeta);
  }, [virtualMeta]);

  // 入站 MessageSend 处理（挂在 ref 上，遵守 P-30 红线：严禁让 WS useEffect 依赖 identity/conversations/t）
  const handleLiveIncoming = useCallback(
    (msg: MessageSend) => {
      const client = liveClientRef.current;

      // 1) 控制指令（撤回 / 禁言）
      const ctrl = isControlPacket(msg);
      if (ctrl.kind === 'delete' && ctrl.data) {
        const recallTargetId = String(ctrl.data.message_id ?? '');
        if (recallTargetId) {
          setConversations((prev) =>
            prev.map((c) => {
              const has = c.messages.some(
                (m) => m.id === recallTargetId || m.msgId === recallTargetId,
              );
              if (!has) return c;
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === recallTargetId || m.msgId === recallTargetId
                    ? { ...m, recalled: true }
                    : m,
                ),
              };
            }),
          );
        }
        return;
      }

      if (ctrl.kind === 'ban' && ctrl.data && msg.target_id) {
        const sysMsg: ChatMessage = {
          id: uid('sys'),
          role: 'system',
          timestamp: Date.now(),
          blocks: [
            {
              kind: 'text',
              text: t('liveChat.banNotice', {
                user: String(ctrl.data.user_id ?? ''),
                group: String(ctrl.data.group_id ?? msg.target_id),
                duration: String(ctrl.data.ban_duration ?? 0),
              }),
            },
          ],
          rawContent: msg.content || [],
        };
        const convId = conversationKey('group', msg.target_id);
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === convId);
          const list = exists
            ? prev
            : [createConversation('group', msg.target_id!, msg.target_id!), ...prev];
          return appendToConversation(list, convId, sysMsg);
        });
        return;
      }

      // 2) 普通/复合出站消息
      if (!msg.content || msg.content.length === 0) {
        if (msg.echo && client) {
          client.sendReceive(buildRecallReceipt(msg, null));
        }
        return;
      }

      const localId = uid('in');
      const chatMsg = messageSendToChatMessage(msg, localId);
      if (chatMsg.blocks.length === 0) {
        if (msg.echo && client) {
          client.sendReceive(buildRecallReceipt(msg, localId));
        }
        return;
      }

      const inferred = targetFromSend(msg);
      const targetType: ConversationType = inferred?.type ?? 'direct';
      const rawTargetId = inferred?.targetId || identity.userId || 'default';
      const botSelfCandidate =
        targetType === 'direct' && msg.bot_self_id ? String(msg.bot_self_id).trim() : '';

      let resolvedConvId = conversationKey(targetType, rawTargetId);
      setConversations((prev) => {
        let targetId = rawTargetId;
        let convId = conversationKey(targetType, targetId);
        if (targetType === 'direct') {
          const personaConvId = botSelfCandidate ? conversationKey('direct', botSelfCandidate) : '';
          if (
            personaConvId &&
            (prev.some((c) => c.id === personaConvId) || personaNameSet.has(botSelfCandidate))
          ) {
            targetId = botSelfCandidate;
            convId = personaConvId;
          } else if (!prev.some((c) => c.id === convId)) {
            const awaitingDirect = prev.find(
              (c) => c.type === 'direct' && Boolean(awaitingTimerRef.current[c.id]),
            );
            if (awaitingDirect) {
              targetId = awaitingDirect.targetId;
              convId = awaitingDirect.id;
            }
          }
        }
        resolvedConvId = convId;
        const msgWithProfile: ChatMessage =
          chatMsg.role === 'bot' && personaNameSet.has(targetId)
            ? {
                ...chatMsg,
                senderName: targetId,
                senderAvatar: personaAvatarMap[targetId] || undefined,
              }
            : chatMsg;

        const exists = prev.some((c) => c.id === convId);
        const baseList: Conversation[] = exists
          ? prev
          : [
              createConversation(
                targetType,
                targetId,
                personaNameSet.has(targetId)
                  ? targetId
                  : targetType === 'group'
                    ? `${t('liveChat.group')} ${targetId}`
                    : `${t('liveChat.direct')} ${targetId}`,
              ),
              ...prev,
            ];
        return appendToConversation(baseList, convId, msgWithProfile);
      });

      if (chatMsg.role === 'bot') {
        clearConvAwaiting(resolvedConvId);
      }

      if (activeIdRef.current === `${VIRTUAL_SESSION_PREFIX}${resolvedConvId}`) {
        requestAnimationFrame(() => scrollToBottom(true));
      }

      if (msg.echo && client) {
        client.sendReceive(buildRecallReceipt(msg, chatMsg.id));
      }
    },
    [identity, personaNameSet, personaAvatarMap, t, clearConvAwaiting, scrollToBottom],
  );

  const handleLiveIncomingRef = useRef(handleLiveIncoming);
  useEffect(() => {
    handleLiveIncomingRef.current = handleLiveIncoming;
  }, [handleLiveIncoming]);

  // 建立 `/ws/webconsole_livechat` 连接（仅依赖 coreLoaded，遵守 P-30）
  useEffect(() => {
    if (!coreLoaded) return;
    const token = getAuthToken() || '';
    const client = new LiveChatWsClient({
      token,
    });
    liveClientRef.current = client;

    client.setHandlers({
      onState: (st) => setLiveConnState(st),
      onMessage: (msg) => handleLiveIncomingRef.current(msg),
    });

    client.connect();
    return () => {
      client.disconnect();
      liveClientRef.current = null;
    };
  }, [coreLoaded]);

  // 虚拟消息变化且处于当前虚拟会话时，自动滚到底部
  useEffect(() => {
    if (!activeSession?.virtual) return;
    requestAnimationFrame(() => scrollToBottom(true));
  }, [activeSession?.virtual, virtualMessages.length, scrollToBottom]);

  // =========================================================================
  // 真实会话列表与消息加载
  // =========================================================================
  const loadSessions = useCallback(
    async (append = false, size = SESSION_PAGE_SIZE) => {
      if (append) setSessionsLoadingMore(true);
      else setSessionsLoading(true);
      try {
        const cursor = append ? sessionsCursorRef.current : '';
        const data = await sessionChatApi.getSessions(size, cursor);
        const list = data.sessions ?? [];
        sessionsCursorRef.current = data.next_cursor ?? '';
        setSessionsHasMore(Boolean(data.has_more));
        if (!append) setSessionsTotal(Number(data.total ?? list.length));
        setSessions((prev) => {
          if (append) {
            const seen = new Set(prev.map((item) => item.session_id));
            return [...prev, ...list.filter((item) => !seen.has(item.session_id))];
          }
          const keep = prev.find((item) => item.session_id === activeIdRef.current);
          if (!keep || list.some((item) => item.session_id === keep.session_id)) return list;
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

  // 消息：首屏只拿最新一页（仅针对真实会话）
  const loadMessages = useCallback(
    async (sessionId: string) => {
      if (!sessionId || isVirtualSessionId(sessionId)) return;
      setMessagesLoading(true);
      try {
        const data = await sessionChatApi.getMessages(sessionId, MESSAGE_PAGE_SIZE);
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

  // 消息划到顶：以当前最早一条的时间为游标往前接一页
  const loadOlderMessages = useCallback(async () => {
    const sessionId = activeIdRef.current;
    if (
      !sessionId ||
      isVirtualSessionId(sessionId) ||
      loadingOlderRef.current ||
      !messagesHasMore
    ) {
      return;
    }
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
      scrollAnchorRef.current = { prevHeight, prevTop };
      setMessages((prev) => {
        const seen = new Set(prev.map(messageKey));
        const head = older.filter((item) => !seen.has(messageKey(item)));
        if (head.length === 0) {
          scrollAnchorRef.current = null;
          return prev;
        }
        return [...head, ...prev];
      });
    } catch (error) {
      scrollAnchorRef.current = null;
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
    if (isVirtualSessionId(activeIdRef.current) || !messagesHasMore) return;
    if (node.scrollTop > LOAD_OLDER_THRESHOLD) return;
    void loadOlderMessages();
  }, [messagesHasMore, loadOlderMessages, nearBottom]);

  useLayoutEffect(() => {
    if (!scrollAnchorRef.current) return;
    const { prevHeight, prevTop } = scrollAnchorRef.current;
    scrollAnchorRef.current = null;
    const el = scrollRef.current;
    if (!el) return;
    const heightDiff = el.scrollHeight - prevHeight;
    if (heightDiff > 0) {
      el.scrollTop = prevTop + heightDiff;
    }
  }, [messages]);

  useEffect(() => {
    if (
      activeSession?.virtual ||
      viewMode !== 'chat' ||
      !messagesHasMore ||
      messagesLoading ||
      messagesLoadingMore
    ) {
      return;
    }
    const node = scrollRef.current;
    if (!node || node.scrollHeight > node.clientHeight + 4) return;
    void loadOlderMessages();
  }, [
    activeSession?.virtual,
    messages,
    messagesHasMore,
    messagesLoading,
    messagesLoadingMore,
    viewMode,
    loadOlderMessages,
  ]);

  // 文本模式：真实会话从 `/api/history/{id}?format_type=text` 读取，虚拟会话直接格式化消息流
  const loadHistoryText = useCallback(
    async (sessionId: string) => {
      if (!sessionId || isVirtualSessionId(sessionId)) return;
      setHistoryTextLoading(true);
      try {
        const data = (await historyApi.getSessionHistory(
          sessionId,
          'text',
        )) as SessionHistoryTextResponse;
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

  const virtualHistoryText = useMemo(() => {
    if (!activeVirtualConv || activeVirtualConv.messages.length === 0) return '';
    const agentLabel = activeVirtualAgentProfile?.name || 'Agent';
    return activeVirtualConv.messages
      .map((m) => {
        const tsSec = Math.floor((m.timestamp || Date.now()) / 1000);
        const roleLabel =
          m.role === 'user'
            ? m.senderName || identity.nickname || identity.userId
            : m.role === 'system'
              ? 'System'
              : m.senderName || agentLabel;
        return `[${formatDay(tsSec)} ${formatClock(tsSec)}] ${roleLabel}: ${blocksPreview(m.blocks)}`;
      })
      .join('\n');
  }, [activeVirtualConv, activeVirtualAgentProfile, identity]);

  const displayedHistoryText = activeSession?.virtual ? virtualHistoryText : historyText;

  const jumpToLatest = useCallback(() => {
    setHasNewWhileAway(false);
    if (viewModeRef.current === 'text' && !isVirtualSessionId(activeIdRef.current)) {
      void loadHistoryText(activeIdRef.current);
      return;
    }
    scrollToBottom(true);
  }, [loadHistoryText, scrollToBottom]);

  useEffect(() => {
    setReplyTo(null);
    scrollAnchorRef.current = null;
    setMessages([]);
    setMessagesHasMore(false);
    setHasNewWhileAway(false);
    setHistoryText('');
    messagesRef.current = [];
    if (!activeId) return;
    if (isVirtualSessionId(activeId)) {
      requestAnimationFrame(() => scrollToBottom());
      return;
    }
    if (viewMode === 'text') void loadHistoryText(activeId);
    else void loadMessages(activeId);
  }, [activeId, viewMode, loadMessages, loadHistoryText, scrollToBottom]);

  // 真实会话 WebSocket
  useEffect(() => {
    const client = new SessionChatWs({
      onState: setWsState,
      onFrame: (frame: WsFrame) => {
        if (frame.type === 'ping') return;

        if (frame.type === 'message') {
          const incoming = frame.message;
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
              .catch(() => {})
              .finally(() => pendingSessionRef.current.delete(newId));
          }
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
    if (session.virtual) {
      setAtBot(session.type === 'group');
    }
  };

  // 切 Bot 或群/私聊/自主创建后，当前打开的会话若不在可见范围，右侧跟着清空
  useEffect(() => {
    if (!activeId) return;
    const current =
      virtualSessions.find((item) => item.session_id === activeId) ??
      sessions.find((item) => item.session_id === activeId);
    if (!current) return;
    const hiddenByType =
      (chatType === 'virtual' && !current.virtual) ||
      (chatType === 'group' && (current.virtual || current.type !== 'group')) ||
      (chatType === 'private' && (current.virtual || current.type !== 'private'));
    const hiddenByBot = chatType !== 'virtual' && botKey !== 'all' && botKeyOf(current) !== botKey;
    if (!hiddenByType && !hiddenByBot) return;
    setActiveId('');
    setMessages([]);
    setHistoryText('');
  }, [activeId, sessions, virtualSessions, botKey, chatType]);

  const handleTogglePin = async (session: SessionItem) => {
    if (session.virtual && session.virtualConvId) {
      const convId = session.virtualConvId;
      setVirtualMeta((prev) => ({
        ...prev,
        [convId]: { ...prev[convId], pinned: !session.pinned },
      }));
      return;
    }
    try {
      const result = await sessionChatApi.updatePrefs(session.session_id, {
        pinned: !session.pinned,
      });
      setSessions((prev) =>
        prev
          .map((item) =>
            item.session_id === session.session_id ? { ...item, pinned: result.pinned } : item,
          )
          .sort(sortSessions),
      );
      if (sessionsHasMore) void loadSessions();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.saveFailed')));
    }
  };

  const handleEditNote = async (session: SessionItem, note: string) => {
    if (session.virtual && session.virtualConvId) {
      const convId = session.virtualConvId;
      setVirtualMeta((prev) => ({
        ...prev,
        [convId]: { ...prev[convId], note },
      }));
      toast.success(t('sessionManagement.noteSaved'));
      return;
    }
    try {
      const result = await sessionChatApi.updatePrefs(session.session_id, { note });
      patchSession(session.session_id, { note: result.note });
      toast.success(t('sessionManagement.noteSaved'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.saveFailed')));
    }
  };

  const handleToggleBlacklist = async (session: SessionItem) => {
    if (session.virtual) return;
    try {
      const result = await sessionChatApi.updatePrefs(session.session_id, {
        blacklisted: !session.blacklisted,
      });
      patchSession(session.session_id, { blacklisted: result.blacklisted });
      toast.success(
        result.blacklisted
          ? t('sessionManagement.blacklistedOn')
          : t('sessionManagement.blacklistedOff'),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('sessionManagement.saveFailed')));
    }
  };

  const openInfo = useCallback(
    async (session: SessionItem, userId = '') => {
      if (session.virtual) {
        setIdDraft(identity);
        setSettingsOpen(true);
        return;
      }
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
    [identity, t],
  );

  // =========================================================================
  // 虚拟会话发送 / 重发 / +1 / 按钮交互 / 戳一戳
  // =========================================================================
  const sendSegmentsToConv = useCallback(
    (conv: Conversation, segments: MessageSegment[], replyMsgId?: string): boolean => {
      const client = liveClientRef.current;
      if (!client) {
        toast.error(t('liveChat.notConnected'));
        return false;
      }

      // GsCore 内部队列约 8s TTL（P-31）：当前会话仍在等待 Agent 回复时禁止连发
      if (awaitingByConv[conv.id]) {
        toast.message(t('liveChat.waitForReply'));
        return false;
      }

      const localMsgId = uid('out');
      const packet = buildMessageReceive({
        userType: conv.type,
        groupId: conv.type === 'group' ? conv.targetId : null,
        userId: identity.userId,
        botSelfId: convBotSelfId(conv),
        msgId: localMsgId,
        sender: {
          nickname: identity.nickname || identity.userId,
          ...(identity.avatar ? { avater: identity.avatar, avatar: identity.avatar } : {}),
        },
        content: segments,
      });
      const sent = client.sendReceive(packet);

      const blocks = segmentsToBlocks(segments);
      const userChatMsg: ChatMessage = {
        id: localMsgId,
        msgId: localMsgId,
        role: 'user',
        senderName: identity.nickname || identity.userId,
        senderAvatar: identity.avatar || undefined,
        timestamp: Date.now(),
        blocks,
        rawContent: segments,
        status: sent ? 'sent' : 'sending',
        replyTo: replyMsgId,
      };

      setConversations((prev) => appendToConversation(prev, conv.id, userChatMsg));
      markConvAwaiting(conv.id);
      return true;
    },
    [awaitingByConv, convBotSelfId, identity, markConvAwaiting, t],
  );

  const handleSend = async (payload: SendPayload): Promise<boolean> => {
    if (!activeId) return false;

    // 虚拟会话：通过 LiveChatWsClient 发送 MessageReceive（视角反转：作为用户发送给 Agent）
    if (activeSession?.virtual && activeVirtualConv) {
      setSending(true);
      try {
        const segs: MessageSegment[] = [];
        if (payload.reply) {
          segs.push({ type: 'reply', data: payload.reply });
        }
        if (activeVirtualConv.type === 'group' && atBot) {
          segs.push({ type: 'at', data: identity.botSelfId });
        }
        if (payload.at) {
          for (const target of payload.at
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)) {
            if (!(activeVirtualConv.type === 'group' && atBot && target === identity.botSelfId)) {
              segs.push({ type: 'at', data: target });
            }
          }
        }
        if (payload.mode === 'markdown' && payload.markdown?.trim()) {
          segs.push({ type: 'markdown', data: payload.markdown });
        } else if (payload.text?.trim()) {
          segs.push({ type: 'text', data: payload.text });
        }

        for (const img of payload.images ?? []) {
          const b64 = await fileToBase64Payload(img);
          segs.push({ type: 'image', data: b64 });
        }
        for (const rec of payload.records ?? []) {
          const b64 = await fileToBase64Payload(rec);
          segs.push({ type: 'record', data: b64 });
        }
        for (const vid of payload.videos ?? []) {
          const b64 = await fileToBase64Payload(vid);
          segs.push({ type: 'video', data: b64 });
        }
        for (const f of payload.files ?? []) {
          const b64 = await fileToBase64Payload(f);
          segs.push({ type: 'file', data: `${f.name}|${b64}` });
        }

        if (segs.length === 0) return false;
        const ok = sendSegmentsToConv(activeVirtualConv, segs, payload.reply || undefined);
        if (ok && atBot) setAtBot(false);
        return ok;
      } catch (e) {
        toast.error(getApiErrorMessage(e, t('liveChat.sendFailed')));
        return false;
      } finally {
        setSending(false);
      }
    }

    // 真实会话：保持原逻辑
    setSending(true);
    try {
      await sessionChatApi.send(activeId, payload);
      toast.success(t('sessionManagement.sendSuccess'));
      if (wsState !== 'open') await loadMessages(activeId);
      return true;
    } catch (error) {
      setSendError(getApiErrorMessage(error, t('sessionManagement.sendFailed')));
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleVirtualRetry = useCallback(
    (msg: ChatMsg) => {
      if (!activeVirtualConv || !msg.rawSegments?.length) return;
      const client = liveClientRef.current;
      if (!client) {
        toast.error(t('liveChat.notConnected'));
        return;
      }
      const packet = buildMessageReceive({
        userType: activeVirtualConv.type,
        groupId: activeVirtualConv.type === 'group' ? activeVirtualConv.targetId : null,
        userId: identity.userId,
        botSelfId: convBotSelfId(activeVirtualConv),
        msgId: msg.msg_id || uid('out'),
        sender: {
          nickname: identity.nickname || identity.userId,
          ...(identity.avatar ? { avater: identity.avatar, avatar: identity.avatar } : {}),
        },
        content: msg.rawSegments,
      });
      const ok = client.sendReceive(packet);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeVirtualConv.id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msg.key || m.id === msg.msg_id
                    ? { ...m, status: ok ? 'sent' : 'failed' }
                    : m,
                ),
              }
            : c,
        ),
      );
      if (ok) markConvAwaiting(activeVirtualConv.id);
    },
    [activeVirtualConv, convBotSelfId, identity, markConvAwaiting, t],
  );

  const handleVirtualPlusOne = useCallback(
    (msg: ChatMsg) => {
      if (!activeVirtualConv) return;
      const segs: MessageSegment[] =
        msg.rawSegments && msg.rawSegments.length > 0
          ? msg.rawSegments.filter((s) => s.type !== 'reply')
          : msg.content.trim()
            ? [{ type: 'text', data: msg.content.trim() }]
            : [];
      if (segs.length === 0) {
        toast.message(t('liveChat.nothingToResend'));
        return;
      }
      sendSegmentsToConv(activeVirtualConv, segs);
    },
    [activeVirtualConv, sendSegmentsToConv, t],
  );

  const handleVirtualCopyToInput = useCallback(
    (msg: ChatMsg) => {
      const text = messageToText(msg).trim();
      if (!text) {
        toast.message(t('liveChat.nothingToCopy'));
        return;
      }
      setExternalDraft((prev) => ({ text, seq: prev.seq + 1 }));
      toast.success(t('liveChat.copiedToInput'));
    },
    [t],
  );

  const handleVirtualButtonClick = useCallback(
    (btn: BtnItem) => {
      if (!activeVirtualConv) return;
      const value = btn.data || btn.callback || btn.input || btn.link || btn.text || '';
      if (btn.action === 0 && /^https?:\/\//i.test(value)) {
        window.open(value, '_blank', 'noopener,noreferrer');
        return;
      }
      if (btn.action === 2 && btn.enter !== true) {
        setExternalDraft((prev) => ({ text: value, seq: prev.seq + 1 }));
        toast.success(t('liveChat.copiedToInput'));
        return;
      }
      const client = liveClientRef.current;
      if (!client) {
        toast.error(t('liveChat.notConnected'));
        return;
      }
      if (awaitingByConv[activeVirtualConv.id]) {
        toast.message(t('liveChat.waitForReply'));
        return;
      }
      const localId = uid('btn');
      const packet = buildButtonClickReceive(
        {
          userType: activeVirtualConv.type,
          groupId: activeVirtualConv.type === 'group' ? activeVirtualConv.targetId : null,
          userId: identity.userId,
          botSelfId: convBotSelfId(activeVirtualConv),
          msgId: localId,
          sender: {
            nickname: identity.nickname || identity.userId,
            ...(identity.avatar ? { avater: identity.avatar, avatar: identity.avatar } : {}),
          },
        },
        value,
      );
      const ok = client.sendReceive(packet);

      const displayText = btn.pressed_text || value || btn.text || '';
      const userMsg: ChatMessage = {
        id: localId,
        msgId: localId,
        role: 'user',
        senderName: identity.nickname || identity.userId,
        senderAvatar: identity.avatar || undefined,
        timestamp: Date.now(),
        blocks: [{ kind: 'text', text: displayText }],
        rawContent: packet.content,
        status: ok ? 'sent' : 'sending',
      };
      setConversations((prev) => appendToConversation(prev, activeVirtualConv.id, userMsg));
      markConvAwaiting(activeVirtualConv.id);
    },
    [activeVirtualConv, awaitingByConv, convBotSelfId, identity, markConvAwaiting, t],
  );

  const handleVirtualPoke = useCallback(() => {
    if (!activeVirtualConv) return;
    const client = liveClientRef.current;
    if (!client) {
      toast.error(t('liveChat.notConnected'));
      return;
    }
    const targetBotId = convBotSelfId(activeVirtualConv);
    const packet = buildPokeReceive({
      userId: identity.userId,
      targetId: targetBotId,
      groupId: activeVirtualConv.type === 'group' ? activeVirtualConv.targetId : null,
      botSelfId: targetBotId,
    });
    client.sendReceive(packet);
    const sysMsg: ChatMessage = {
      id: uid('poke'),
      role: 'user',
      senderName: identity.nickname || identity.userId,
      timestamp: Date.now(),
      blocks: [{ kind: 'text', text: `👉 ${t('liveChat.poke')} @${targetBotId}` }],
      rawContent: packet.content,
      status: 'sent',
    };
    setConversations((prev) => appendToConversation(prev, activeVirtualConv.id, sysMsg));
  }, [activeVirtualConv, convBotSelfId, identity, t]);

  // 新建持久化虚拟会话
  const openCreateVirtualDialog = useCallback((defaultType?: ConversationType) => {
    const nextType = defaultType ?? 'group';
    setNewType(nextType);
    setNewTargetId(
      nextType === 'group' ? `web_group_${Math.floor(100 + Math.random() * 900)}` : '10001',
    );
    setNewName('');
    setNewChatOpen(true);
  }, []);

  const handleCreateVirtualConversation = () => {
    const tid = newTargetId.trim();
    if (!tid) {
      toast.error(t('liveChat.targetIdRequired'));
      return;
    }
    const id = conversationKey(newType, tid);
    const existing = conversations.find((c) => c.id === id);
    if (existing) {
      setActiveId(`${VIRTUAL_SESSION_PREFIX}${id}`);
      setNewChatOpen(false);
      toast.message(t('liveChat.conversationExists'));
      return;
    }
    const conv = createConversation(newType, tid, newName.trim() || tid);
    setConversations((prev) => [conv, ...prev]);
    if (chatType === 'group' || chatType === 'private') {
      setChatType('virtual');
    }
    setActiveId(`${VIRTUAL_SESSION_PREFIX}${id}`);
    setAtBot(newType === 'group');
    setNewChatOpen(false);
    toast.success(t('sessionManagement.virtualCreated'));
  };

  const handleClearVirtualConv = useCallback(
    (convId: string) => {
      clearConvAwaiting(convId);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, messages: [], lastPreview: '' } : c)),
      );
      setReplyTo(null);
      toast.success(t('sessionManagement.virtualCleared'));
    },
    [clearConvAwaiting, t],
  );

  const handleConfirmDeleteVirtual = () => {
    if (!deleteVirtualTarget) return;
    const targetId = deleteVirtualTarget.id;
    clearConvAwaiting(targetId);
    setConversations((prev) => prev.filter((c) => c.id !== targetId));
    if (activeId === `${VIRTUAL_SESSION_PREFIX}${targetId}`) {
      setActiveId('');
    }
    setDeleteVirtualTarget(null);
    toast.success(t('sessionManagement.virtualDeleted'));
  };

  const handleSaveIdentitySettings = () => {
    const fallback = defaultIdentity();
    const cleaned: LiveChatIdentity = {
      userId: idDraft.userId.trim() || fallback.userId,
      nickname: idDraft.nickname.trim() || fallback.nickname,
      avatar: idDraft.avatar.trim(),
      botSelfId: idDraft.botSelfId.trim() || fallback.botSelfId,
    };
    setIdentity(cleaned);
    setSettingsOpen(false);
    toast.success(t('liveChat.settingsSaved'));
  };

  const handleClear = async () => {
    if (!activeId) return;
    if (activeSession?.virtual && activeSession.virtualConvId) {
      handleClearVirtualConv(activeSession.virtualConvId);
      setClearOpen(false);
      return;
    }
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

  const isVirtualActive = Boolean(activeSession?.virtual);
  const isActiveVirtualAwaiting = Boolean(
    activeVirtualConv && awaitingByConv[activeVirtualConv.id],
  );

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
            virtualSessions={virtualSessions}
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
            onCreateVirtual={openCreateVirtualDialog}
            onOpenIdentitySettings={() => {
              setIdDraft(identity);
              setSettingsOpen(true);
            }}
            onClearVirtualMessages={(session) => {
              if (session.virtualConvId) handleClearVirtualConv(session.virtualConvId);
            }}
            onDeleteVirtualSession={(session) => {
              const conv = conversations.find((c) => c.id === session.virtualConvId);
              if (conv) setDeleteVirtualTarget(conv);
            }}
          />
        </div>

        <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !activeId && 'hidden sm:flex')}>
          {/* 头部 */}
          <div
            className={cn(
              'flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2',
              isVirtualActive && 'border-violet-500/25 bg-violet-500/[0.04]',
            )}
          >
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
              title={
                activeSession
                  ? isVirtualActive
                    ? t('sessionManagement.identitySettings')
                    : t('sessionManagement.viewInfo')
                  : undefined
              }
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
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-semibold">
                  {activeSession?.note || activeSession?.title || t('sessionManagement.title')}
                </span>
                {activeSession?.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                {isVirtualActive && (
                  <>
                    <Badge
                      variant="outline"
                      className="h-4 shrink-0 border-violet-500/35 bg-violet-500/10 px-1.5 py-0 text-[10px] font-medium text-violet-600 dark:text-violet-400"
                    >
                      <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                      {t('sessionManagement.virtualSessionTag')}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="h-4 shrink-0 border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
                    >
                      <ArrowLeftRight className="mr-0.5 h-2.5 w-2.5" />
                      {t('sessionManagement.perspectiveReversedBadge')}
                    </Badge>
                  </>
                )}
                {activeSession?.blacklisted && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                    <Ban className="mr-0.5 h-2.5 w-2.5" />
                    {t('sessionManagement.blacklisted')}
                  </Badge>
                )}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {activeSession
                  ? isVirtualActive && activeVirtualConv
                    ? `${
                        activeVirtualConv.type === 'group'
                          ? t('liveChat.groupId', { id: activeVirtualConv.targetId })
                          : t('liveChat.userId', { id: activeVirtualConv.targetId })
                      } · ${activeSession.message_count} ${t('sessionManagement.messages')}`
                    : `${
                        activeSession.type === 'group'
                          ? t('sessionManagement.groupChat')
                          : t('sessionManagement.privateChat')
                      } · ${activeSession.message_count} ${t('sessionManagement.messages')}`
                  : t('sessionManagement.selectSession')}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1">
              {/* 聊天模式 / 文本模式 */}
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

              {isVirtualActive ? (
                <>
                  <ConnectionBadge
                    state={liveConnState}
                    label={statusLabel(liveConnState, t)}
                    className="hidden md:inline-flex text-[11px] h-6"
                  />
                  {liveConnState !== 'connected' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 sm:h-7 sm:px-2"
                      onClick={() => liveClientRef.current?.connect()}
                      title={t('liveChat.reconnect')}
                    >
                      <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 sm:h-7 sm:px-2 gap-1 text-xs"
                    onClick={() => {
                      setIdDraft(identity);
                      setSettingsOpen(true);
                    }}
                    title={t('sessionManagement.identitySettings')}
                  >
                    <UserCog className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden lg:inline max-w-[96px] truncate">
                      {identity.nickname || identity.userId}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 sm:h-7 sm:px-2"
                    disabled={!activeVirtualConv || activeVirtualConv.messages.length === 0}
                    onClick={() =>
                      activeVirtualConv && handleClearVirtualConv(activeVirtualConv.id)
                    }
                    title={t('sessionManagement.clearVirtualMessages')}
                  >
                    <Eraser className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-destructive sm:h-7 sm:px-2"
                    disabled={!activeVirtualConv}
                    onClick={() => activeVirtualConv && setDeleteVirtualTarget(activeVirtualConv)}
                    title={t('sessionManagement.deleteVirtualSession')}
                  >
                    <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      'mr-1 inline-flex items-center gap-1 text-[11px]',
                      wsState === 'open' ? 'text-emerald-600' : 'text-muted-foreground',
                    )}
                    title={
                      wsState === 'open'
                        ? t('sessionManagement.wsConnected')
                        : t('sessionManagement.wsDisconnected')
                    }
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
                    <RefreshCw
                      className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', sessionsLoading && 'animate-spin')}
                    />
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
                </>
              )}
            </div>
          </div>

          {/* 虚拟会话：显式标注语义反转横幅（左侧为 Agent，右侧为自己） */}
          {isVirtualActive && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-background/60 to-emerald-500/10 px-3 py-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-medium text-violet-600 dark:text-violet-400">
                {activeVirtualAgentProfile ? (
                  <SessionAvatar
                    src={activeVirtualAgentProfile.avatar}
                    name={activeVirtualAgentProfile.name}
                    type="private"
                    className="h-4 w-4 text-[9px]"
                  />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-500/20">
                    <Bot className="h-3 w-3" />
                  </span>
                )}
                <span>
                  {t('sessionManagement.perspectiveLeftAgent')}
                  {activeVirtualAgentProfile?.name ? ` · ${activeVirtualAgentProfile.name}` : ''}
                </span>
              </span>

              <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                <ArrowLeftRight className="h-3 w-3 text-primary" />
                <span>{t('sessionManagement.perspectiveReversedBanner')}</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  setIdDraft(identity);
                  setSettingsOpen(true);
                }}
                className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                title={t('sessionManagement.identitySettings')}
              >
                <span>
                  {t('sessionManagement.perspectiveRightSelf', {
                    name: identity.nickname || identity.userId,
                  })}
                </span>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20">
                  <User className="h-3 w-3" />
                </span>
              </button>
            </div>
          )}

          {/* 消息流 */}
          <div className="relative flex min-h-0 min-w-0 flex-1">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
            >
              {!activeSession ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <p>{t('sessionManagement.selectSession')}</p>
                  <p className="text-xs">{t('sessionManagement.selectSessionDesc')}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-1.5"
                    onClick={() => openCreateVirtualDialog()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('sessionManagement.createVirtualSession')}
                  </Button>
                </div>
              ) : viewMode === 'text' ? (
                !isVirtualActive && historyTextLoading && !displayedHistoryText ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    {t('sessionManagement.loading')}
                  </p>
                ) : displayedHistoryText ? (
                  <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]">
                    {displayedHistoryText}
                  </pre>
                ) : (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    {t('sessionManagement.noHistory')}
                  </p>
                )
              ) : !isVirtualActive && messagesLoading && displayedMessages.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  {t('sessionManagement.loading')}
                </p>
              ) : displayedMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 py-8 text-center text-xs text-muted-foreground">
                  <p>
                    {isVirtualActive
                      ? t('liveChat.emptyChat')
                      : t('sessionManagement.emptyMessages')}
                  </p>
                  {isVirtualActive && (
                    <p className="max-w-sm text-[11px] opacity-80">{t('liveChat.emptyChatHint')}</p>
                  )}
                </div>
              ) : (
                <>
                  {!isVirtualActive &&
                    (messagesLoadingMore ||
                      (displayedMessages.length > MESSAGE_PAGE_SIZE && !messagesHasMore)) && (
                      <div className="pb-1 text-center text-[10px] text-muted-foreground">
                        {messagesLoadingMore
                          ? t('sessionManagement.loadingMore')
                          : t('sessionManagement.noMoreMessages')}
                      </div>
                    )}
                  {displayedMessages.map((msg, idx) => {
                    const prev = idx > 0 ? displayedMessages[idx - 1] : undefined;
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
                          invertPerspective={isVirtualActive}
                          onRetry={isVirtualActive ? handleVirtualRetry : undefined}
                          onPlusOne={isVirtualActive ? handleVirtualPlusOne : undefined}
                          onCopyToInput={isVirtualActive ? handleVirtualCopyToInput : undefined}
                          onButtonClick={isVirtualActive ? handleVirtualButtonClick : undefined}
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
                              name:
                                target.sender?.card || target.sender?.nickname || target.user_id,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                  {isVirtualActive && isActiveVirtualAwaiting && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-violet-600 dark:text-violet-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>{t('liveChat.waitingReply')}</span>
                      </div>
                    </div>
                  )}
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
              disabled={!activeSession || (isVirtualActive && isActiveVirtualAwaiting)}
              sending={sending || (isVirtualActive && isActiveVirtualAwaiting)}
              replyTo={replyTo}
              onClearReply={() => setReplyTo(null)}
              mention={mention}
              onClearMention={() => setMention(null)}
              onSend={handleSend}
              isVirtual={isVirtualActive}
              isGroup={activeSession?.type === 'group'}
              atBot={atBot}
              onToggleAtBot={() => setAtBot((v) => !v)}
              onPoke={isVirtualActive ? handleVirtualPoke : undefined}
              externalDraft={externalDraft}
              virtualIdentityName={identity.nickname || identity.userId}
            />
          )}
        </div>
      </div>

      <TargetInfoCard
        open={infoOpen}
        onOpenChange={setInfoOpen}
        info={info}
        loading={infoLoading}
      />

      <CacheSettingsDialog open={cacheOpen} onOpenChange={setCacheOpen} />

      {/* 创建持久化虚拟会话弹窗 */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              {t('sessionManagement.createVirtualSession')}
            </DialogTitle>
            <DialogDescription>{t('liveChat.newChatDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('liveChat.chatType')}</Label>
              <TabButtonGroup
                options={[
                  {
                    value: 'group',
                    label: t('liveChat.group'),
                    icon: <Hash className="h-4 w-4" />,
                  },
                  {
                    value: 'direct',
                    label: t('liveChat.direct'),
                    icon: <User className="h-4 w-4" />,
                  },
                ]}
                value={newType}
                onValueChange={(v) => {
                  const next = v as ConversationType;
                  setNewType(next);
                  setNewTargetId(
                    next === 'group'
                      ? `web_group_${Math.floor(100 + Math.random() * 900)}`
                      : '10001',
                  );
                }}
                className="w-full grid grid-cols-2"
                buttonClassName="flex-1 justify-center"
              />
            </div>
            <div className="space-y-2">
              <Label>
                {newType === 'group' ? t('liveChat.groupIdLabel') : t('liveChat.peerIdLabel')}
              </Label>
              <Input
                value={newTargetId}
                onChange={(e) => setNewTargetId(e.target.value)}
                placeholder={newType === 'group' ? 'web_group_01' : '10001'}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('liveChat.displayName')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('liveChat.displayNamePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewChatOpen(false)}>
              {t('sessionManagement.cancel')}
            </Button>
            <Button onClick={handleCreateVirtualConversation}>{t('liveChat.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 虚拟身份设置弹窗 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" />
              {t('liveChat.settings')}
            </DialogTitle>
            <DialogDescription>{t('liveChat.settingsDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('liveChat.userIdLabel')}</Label>
              {masters.length > 0 && (
                <Select
                  value={masters.includes(idDraft.userId) ? idDraft.userId : '__custom__'}
                  onValueChange={(v) => {
                    if (v !== '__custom__') {
                      setIdDraft((d) => ({ ...d, userId: v }));
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {masters.map((m) => (
                      <SelectItem key={m} value={m}>
                        {t('liveChat.masterOption', { id: m })}
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">{t('liveChat.customUserId')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Input
                value={idDraft.userId}
                onChange={(e) => setIdDraft((d) => ({ ...d, userId: e.target.value }))}
                placeholder="master_01"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('liveChat.nicknameLabel')}</Label>
              <Input
                value={idDraft.nickname}
                onChange={(e) => setIdDraft((d) => ({ ...d, nickname: e.target.value }))}
                placeholder="Master"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('liveChat.avatarLabel')}</Label>
              <Input
                value={idDraft.avatar}
                onChange={(e) => setIdDraft((d) => ({ ...d, avatar: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t('liveChat.botSelfIdLabel')}</Label>
              <Input
                value={idDraft.botSelfId}
                onChange={(e) => setIdDraft((d) => ({ ...d, botSelfId: e.target.value }))}
                placeholder="gscore_bot"
              />
              <p className="text-xs text-muted-foreground">{t('liveChat.botSelfIdHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              {t('sessionManagement.cancel')}
            </Button>
            <Button onClick={handleSaveIdentitySettings}>{t('sessionManagement.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除虚拟会话确认弹窗 */}
      <AlertDialog
        open={Boolean(deleteVirtualTarget)}
        onOpenChange={(open) => !open && setDeleteVirtualTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessionManagement.deleteVirtualSession')}</AlertDialogTitle>
            <AlertDialogDescription>{t('liveChat.deleteChatConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sessionManagement.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteVirtual}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('sessionManagement.deleteVirtualSession')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
