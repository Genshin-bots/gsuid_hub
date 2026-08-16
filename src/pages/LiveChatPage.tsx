/**
 * Live Chat — 控制台内嵌 GsCore 适配器
 *
 * 通过 WebSocket `/ws/webconsole_livechat` 完整对接早柚协议：
 * 上报 MessageReceive / 下发 MessageSend，支持 text/image/record/video/file/
 * at/reply/markdown/buttons/node/meta(poke)/echo 回执/撤回控制包。
 *
 * 布局：page-fill 全高单卡片（与 session-management 同骨架）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { getApiErrorMessage, liveChatApi, getAuthToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  ChevronLeft,
  Eraser,
  Hash,
  MessageCircle,
  RefreshCw,
  Tag,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { ConversationSidebar } from '@/components/live-chat/ConversationSidebar';
import { MessageBubble } from '@/components/live-chat/MessageBubble';
import {
  MessageComposer,
  type PendingMedia,
} from '@/components/live-chat/MessageComposer';
import {
  type ButtonData,
  type ChatMessage,
  type ConnectionState,
  type Conversation,
  type LiveChatIdentity,
  type MessageSegment,
  type MessageSend,
  LiveChatWsClient,
  PLATFORM_BOT_ID,
  WS_BOT_ID,
  blocksPreview,
  blocksToPlainText,
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
  messageToResendContent,
  saveLiveChatState,
  segmentsToBlocks,
  targetFromSend,
  uid,
} from '@/lib/liveChat';

// ============================================================================
// Helpers
// ============================================================================

function connectionLabel(
  state: ConnectionState,
  t: (k: string) => string,
): string {
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

// ============================================================================
// Page
// ============================================================================

export default function LiveChatPage() {
  const { t } = useLanguage();

  // —— 身份 & 会话（后端持久化，见 /api/live-chat/state）——
  const [identity, setIdentity] = useState<LiveChatIdentity>(() => defaultIdentity());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stateReady, setStateReady] = useState(false);
  const [search, setSearch] = useState('');
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);

  // —— 连接 ——
  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  const [masters, setMasters] = useState<string[]>([]);
  const [coreLoaded, setCoreLoaded] = useState(false);
  const clientRef = useRef<LiveChatWsClient | null>(null);

  // —— 输入 ——
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingMedia[]>([]);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [atBot, setAtBot] = useState(false);

  // —— Dialogs ——
  const [createOpen, setCreateOpen] = useState(false);
  const [newType, setNewType] = useState<'group' | 'direct'>('group');
  const [newTargetId, setNewTargetId] = useState('');
  const [newName, setNewName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<LiveChatIdentity>(identity);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(pending);
  const conversationsRef = useRef(conversations);
  const identityRef = useRef(identity);
  const activeIdRef = useRef(activeId);
  /** 按会话等待 AI 回复，避免连发导致后端 8s TTL 丢弃 */
  const [awaitingByConv, setAwaitingByConv] = useState<Record<string, boolean>>({});
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // 清理 object URL
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
  }, []);

  // --------------------------------------------------------------------------
  // 加载后端状态 + bootstrap（masters；WS 用登录会话 token）
  // --------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [boot, remote] = await Promise.all([
          liveChatApi.getBootstrap().catch((e) => {
            console.warn('[live-chat] load bootstrap failed', getApiErrorMessage(e));
            return { masters: [] as string[] };
          }),
          loadLiveChatState(),
        ]);
        if (cancelled) return;

        const masterList = Array.isArray(boot.masters)
          ? boot.masters.map(String).filter(Boolean)
          : [];
        setMasters(masterList);

        let nextIdentity = remote.identity || defaultIdentity();
        let nextConvs = remote.conversations || [];
        let nextActive = remote.activeId;

        // 占位身份 → 主人
        if (masterList.length > 0 && (nextIdentity.userId === 'master' || !nextIdentity.userId)) {
          nextIdentity = {
            ...nextIdentity,
            userId: masterList[0],
            nickname:
              nextIdentity.nickname === 'Web User' || nextIdentity.nickname === 'Master'
                ? 'Master'
                : nextIdentity.nickname,
          };
        }

        // 无会话时默认一条与主人私聊
        if (nextConvs.length === 0) {
          const uid0 = nextIdentity.userId || masterList[0] || 'master';
          const conv = createConversation('direct', uid0, t('liveChat.defaultDirectName'));
          nextConvs = [conv];
          nextActive = conv.id;
        } else if (!nextActive || !nextConvs.some((c) => c.id === nextActive)) {
          nextActive = nextConvs[0].id;
        }

        // 若仅有默认私聊且 target 还是占位 master，对齐到真实主人 id
        if (
          masterList.length > 0 &&
          nextConvs.length === 1 &&
          nextConvs[0].type === 'direct' &&
          (nextConvs[0].targetId === 'master' || nextConvs[0].targetId === 'Web User')
        ) {
          const updated = {
            ...nextConvs[0],
            id: `direct:${masterList[0]}`,
            targetId: masterList[0],
            name: t('liveChat.defaultDirectName'),
          };
          nextConvs = [updated];
          nextActive = updated.id;
        }

        setIdentity(nextIdentity);
        setConversations(nextConvs);
        setActiveId(nextActive);
        setStateReady(true);
      } catch (e) {
        console.warn('[live-chat] bootstrap failed', e);
        if (!cancelled) {
          const fallback = defaultIdentity();
          const conv = createConversation('direct', fallback.userId, t('liveChat.defaultDirectName'));
          setIdentity(fallback);
          setConversations([conv]);
          setActiveId(conv.id);
          setStateReady(true);
        }
      } finally {
        if (!cancelled) setCoreLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // 防抖写回后端（身份 / 会话 / 当前选中）
  useEffect(() => {
    if (!stateReady) return;
    const timer = window.setTimeout(() => {
      void saveLiveChatState({
        identity,
        conversations,
        activeId,
      }).catch(() => {
        /* 已在 storage 内 warn */
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [stateReady, identity, conversations, activeId]);

  // --------------------------------------------------------------------------
  // WebSocket 生命周期
  // --------------------------------------------------------------------------
  const appendMessage = useCallback((convId: string, msg: ChatMessage) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === convId);
      if (idx < 0) return prev;
      const c = prev[idx];
      const next: Conversation = {
        ...c,
        messages: [...c.messages, msg],
        updatedAt: Date.now(),
        lastPreview: blocksPreview(msg.blocks) || c.lastPreview,
      };
      const copy = prev.slice();
      copy[idx] = next;
      return copy;
    });
  }, []);

  const ensureConversation = useCallback(
    (type: 'group' | 'direct', targetId: string, name?: string): string => {
      const key = conversationKey(type, targetId);
      setConversations((prev) => {
        if (prev.some((c) => c.id === key)) return prev;
        return [
          ...prev,
          createConversation(type, targetId, name || targetId),
        ];
      });
      return key;
    },
    [],
  );

  // 用 ref 挂下发处理，避免 handleIncoming 身份变化导致 WS 反复断连重连
  // （断连风暴会让 AI 请求在队列里等到超过 STALE_CHAT_REQUEST_TTL=8s 被丢弃）
  const handleIncomingRef = useRef<(msg: MessageSend) => void>(() => {});

  handleIncomingRef.current = (msg: MessageSend) => {
    const tt = tRef.current;
    const control = isControlPacket(msg);
    if (control.kind === 'delete') {
      const mid = control.data?.message_id != null ? String(control.data.message_id) : null;
      if (mid) {
        setConversations((prev) =>
          prev.map((c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.msgId === mid || m.id === mid ? { ...m, recalled: true } : m,
            ),
          })),
        );
      }
      return;
    }
    if (control.kind === 'ban') {
      const uid_ = control.data?.user_id != null ? String(control.data.user_id) : '?';
      const gid = control.data?.group_id != null ? String(control.data.group_id) : '?';
      const duration = control.data?.duration;
      const text = tt('liveChat.banNotice', {
        user: uid_,
        group: gid,
        duration: String(duration ?? ''),
      });
      const convId = gid !== '?' ? ensureConversation('group', gid) : activeIdRef.current;
      if (convId) {
        appendMessage(convId, {
          id: uid('sys'),
          role: 'system',
          blocks: [{ kind: 'text', text }],
          timestamp: Date.now(),
        });
      }
      return;
    }

    const target = targetFromSend(msg);
    let convId: string | null = null;
    if (target) {
      convId = ensureConversation(target.type, target.targetId);
    } else if (activeIdRef.current) {
      convId = activeIdRef.current;
    }
    if (!convId) return;

    // 空包（TTL 丢弃 / 空回复）不展示气泡，但仍要回执 echo
    const segs = msg.content ?? [];
    const hasPayload = segs.some((s) => {
      if (!s?.type) return false;
      if (s.type.startsWith('log_')) return false;
      if (s.data == null || s.data === '') return false;
      return true;
    });

    const chatMsg = hasPayload ? messageSendToChatMessage(msg) : null;
    if (msg.echo) {
      const client = clientRef.current;
      if (client) {
        client.sendReceive(buildRecallReceipt(msg, chatMsg?.id ?? null));
      }
    }

    if (!chatMsg) return;

    if (chatMsg.blocks.length === 1 && chatMsg.blocks[0].kind === 'meta') {
      chatMsg.role = 'system';
    }

    appendMessage(convId, chatMsg);
    // 收到 bot 回复，解除该会话等待
    if (chatMsg.role === 'bot') {
      setAwaitingByConv((prev) => (prev[convId!] ? { ...prev, [convId!]: false } : prev));
    }
  };

  useEffect(() => {
    if (!coreLoaded) return;
    if (import.meta.env.VITE_DEMO) {
      setConnState('disconnected');
      return;
    }

    const client = new LiveChatWsClient({
      routeBotId: WS_BOT_ID,
      token: getAuthToken() || '',
      maxRetries: 0,
      retryBaseMs: 3000,
    });
    client.setHandlers({
      onState: (s) => setConnState(s),
      onMessage: (m) => handleIncomingRef.current(m),
      onRawLog: (level, text) => {
        const fn =
          level === 'error'
            ? console.error
            : level === 'warning'
              ? console.warn
              : console.log;
        fn(`[GsCore ${level}]`, text);
      },
      onError: (err) => {
        console.warn('[live-chat] ws error', err.message);
      },
    });
    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
    // 仅在 bootstrap 完成后建连；禁止把 handler 放进依赖
  }, [coreLoaded]);

  // --------------------------------------------------------------------------
  // 滚动到底
  // --------------------------------------------------------------------------
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      return;
    }
    const viewport = chatScrollRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]',
    );
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, []);

  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );

  useEffect(() => {
    if (!activeConv) return;
    const timer = window.setTimeout(() => scrollToBottom('auto'), 30);
    return () => window.clearTimeout(timer);
  }, [activeConv?.id, activeConv?.messages.length, scrollToBottom]);

  // --------------------------------------------------------------------------
  // 发送
  // --------------------------------------------------------------------------
  const resolveReplyPreview = useCallback(
    (msgId: string) => {
      if (!activeConv) return undefined;
      const m = activeConv.messages.find((x) => x.msgId === msgId || x.id === msgId);
      return m ? blocksPreview(m.blocks) : undefined;
    },
    [activeConv],
  );

  const addFiles = useCallback((files: FileList | File[], kind?: PendingMedia['kind']) => {
    const list = Array.from(files);
    if (!list.length) return;
    setPending((prev) => [
      ...prev,
      ...list.map((file) => {
        let k: PendingMedia['kind'] = kind || 'file';
        if (!kind) {
          if (file.type.startsWith('image/')) k = 'image';
          else if (file.type.startsWith('audio/')) k = 'record';
          else if (file.type.startsWith('video/')) k = 'video';
          else k = 'file';
        }
        return {
          id: uid('file'),
          file,
          kind: k,
          previewUrl: k === 'image' ? URL.createObjectURL(file) : undefined,
        };
      }),
    ]);
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const clearPending = useCallback(() => {
    setPending((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
  }, []);

  /** 当前会话上报用的 user_id：群聊用全局身份；私聊用会话 targetId（便于模拟多用户） */
  const resolveSendUserId = useCallback((conv: Conversation, ident: LiveChatIdentity) => {
    return conv.type === 'direct' ? conv.targetId : ident.userId;
  }, []);

  const sendToCore = useCallback(
    (
      content: MessageSegment[],
      opts?: {
        /** 重试失败消息：更新原气泡状态，不再追加一条 */
        replaceMessageId?: string;
      },
    ) => {
      const conv = conversationsRef.current.find((c) => c.id === activeIdRef.current);
      const ident = identityRef.current;
      if (!conv) return false;

      const client = clientRef.current;
      const msgId = opts?.replaceMessageId || uid('out');
      const sendUserId = resolveSendUserId(conv, ident);
      const receive = buildMessageReceive({
        userType: conv.type === 'group' ? 'group' : 'direct',
        groupId: conv.type === 'group' ? conv.targetId : null,
        userId: sendUserId,
        botSelfId: ident.botSelfId,
        botId: PLATFORM_BOT_ID,
        msgId,
        userPm: masters.includes(sendUserId) ? 1 : 6,
        sender: {
          nickname:
            conv.type === 'direct' && sendUserId !== ident.userId
              ? sendUserId
              : ident.nickname || sendUserId,
          ...(ident.avatar && sendUserId === ident.userId ? { avatar: ident.avatar } : {}),
        },
        content,
      });

      if (opts?.replaceMessageId) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id !== conv.id
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === opts.replaceMessageId
                      ? {
                          ...m,
                          status: 'sending' as const,
                          rawContent: content,
                          msgId,
                          timestamp: Date.now(),
                        }
                      : m,
                  ),
                  updatedAt: Date.now(),
                },
          ),
        );
      } else {
        const local: ChatMessage = {
          id: msgId,
          role: 'user',
          blocks: segmentsToBlocks(content),
          rawContent: content,
          msgId,
          replyTo: content.find((s) => s.type === 'reply')
            ? String(content.find((s) => s.type === 'reply')!.data)
            : undefined,
          senderName:
            conv.type === 'direct' && sendUserId !== ident.userId
              ? sendUserId
              : ident.nickname || sendUserId,
          senderAvatar: sendUserId === ident.userId ? ident.avatar || undefined : undefined,
          timestamp: Date.now(),
          status: 'sending',
        };
        appendMessage(conv.id, local);
      }

      const markStatus = (status: 'sent' | 'failed') => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id !== conv.id
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, status, rawContent: content } : m,
                  ),
                },
          ),
        );
      };

      if (!client || client.connectionState !== 'connected') {
        markStatus('failed');
        toast.error(t('liveChat.notConnected'));
        return false;
      }

      const ok = client.sendReceive(receive);
      markStatus(ok ? 'sent' : 'failed');
      return ok;
    },
    [appendMessage, masters, resolveSendUserId, t],
  );

  const markAwaiting = useCallback((convId: string) => {
    setAwaitingByConv((prev) => ({ ...prev, [convId]: true }));
    window.setTimeout(() => {
      setAwaitingByConv((prev) => (prev[convId] ? { ...prev, [convId]: false } : prev));
    }, 120_000);
  }, []);

  /** 失败重试：用原 rawContent 再发，不新建气泡 */
  const handleRetry = useCallback(
    (message: ChatMessage) => {
      const conv = conversationsRef.current.find((c) => c.id === activeIdRef.current);
      if (!conv) return;
      if (awaitingByConv[conv.id]) {
        toast.message(t('liveChat.waitForReply'));
        return;
      }
      const content = messageToResendContent(message, { skipReply: false });
      if (!content.length) {
        toast.error(t('liveChat.nothingToResend'));
        return;
      }
      const ok = sendToCore(content, { replaceMessageId: message.id });
      if (ok) markAwaiting(conv.id);
    },
    [awaitingByConv, markAwaiting, sendToCore, t],
  );

  /** +1：再发一遍相同文本/内容 */
  const handlePlusOne = useCallback(
    (message: ChatMessage) => {
      const conv = conversationsRef.current.find((c) => c.id === activeIdRef.current);
      if (!conv) return;
      if (awaitingByConv[conv.id]) {
        toast.message(t('liveChat.waitForReply'));
        return;
      }
      // 优先纯文本；无文本时回退完整 media 重发
      const plain = blocksToPlainText(message.blocks);
      const content: MessageSegment[] = plain
        ? [{ type: 'text', data: plain }]
        : messageToResendContent(message, { skipReply: true });
      if (!content.length) {
        toast.error(t('liveChat.nothingToResend'));
        return;
      }
      const ok = sendToCore(content);
      if (ok) markAwaiting(conv.id);
    },
    [awaitingByConv, markAwaiting, sendToCore, t],
  );

  /** 复制文本到输入框 */
  const handleCopyToInput = useCallback(
    (message: ChatMessage) => {
      const plain = blocksToPlainText(message.blocks);
      if (!plain) {
        toast.message(t('liveChat.nothingToCopy'));
        return;
      }
      setDraft(plain);
      toast.success(t('liveChat.copiedToInput'));
    },
    [t],
  );

  const handleSend = async () => {
    if (!activeConv) return;
    if (!draft.trim() && pending.length === 0) return;

    // 同一会话上一轮 AI 还在跑时，连发会在 core 的 8s 队列 TTL 里被丢掉
    if (awaitingByConv[activeConv.id]) {
      toast.message(t('liveChat.waitForReply'));
      return;
    }

    setSending(true);
    try {
      const content: MessageSegment[] = [];

      if (replyTo) {
        content.push({ type: 'reply', data: replyTo.msgId || replyTo.id });
      }
      if (atBot && activeConv.type === 'group') {
        content.push({ type: 'at', data: identity.botSelfId });
      }
      if (draft.trim()) {
        content.push({ type: 'text', data: draft.trim() });
      }

      for (const p of pending) {
        const payload = await fileToBase64Payload(p.file);
        if (p.kind === 'image') {
          content.push({ type: 'image', data: payload });
        } else if (p.kind === 'record') {
          content.push({ type: 'record', data: payload });
        } else if (p.kind === 'video') {
          content.push({ type: 'video', data: payload });
        } else {
          content.push({ type: 'file', data: `${p.file.name}|${payload}` });
        }
      }

      const ok = sendToCore(content);
      if (ok) markAwaiting(activeConv.id);
      setDraft('');
      clearPending();
      setReplyTo(null);
      setAtBot(false);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('liveChat.sendFailed')));
    } finally {
      setSending(false);
    }
  };

  const handleButtonClick = (button: ButtonData) => {
    // action 0 = 跳转链接
    if (button.action === 0 && /^https?:\/\//i.test(button.data)) {
      window.open(button.data, '_blank', 'noopener,noreferrer');
      return;
    }
    const conv = conversationsRef.current.find((c) => c.id === activeIdRef.current);
    const ident = identityRef.current;
    if (!conv) return;

    const sendUserId = resolveSendUserId(conv, ident);
    const receive = buildButtonClickReceive(
      {
        userType: conv.type === 'group' ? 'group' : 'direct',
        groupId: conv.type === 'group' ? conv.targetId : null,
        userId: sendUserId,
        botSelfId: ident.botSelfId,
        botId: PLATFORM_BOT_ID,
        userPm: masters.includes(sendUserId) ? 1 : 6,
        sender: { nickname: ident.nickname || sendUserId },
      },
      button.data,
    );

    const btnContent: MessageSegment[] = [{ type: 'text', data: button.data }];
    const local: ChatMessage = {
      id: receive.msg_id,
      role: 'user',
      blocks: [{ kind: 'text', text: button.data }],
      rawContent: btnContent,
      msgId: receive.msg_id,
      senderName: ident.nickname || sendUserId,
      timestamp: Date.now(),
      status: 'sending',
    };
    appendMessage(conv.id, local);

    const client = clientRef.current;
    if (!client || client.connectionState !== 'connected') {
      toast.error(t('liveChat.notConnected'));
      return;
    }
    const ok = client.sendReceive(receive);
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== conv.id
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.id === local.id ? { ...m, status: ok ? 'sent' : 'failed' } : m,
              ),
            },
      ),
    );
  };

  const handlePoke = () => {
    const conv = conversationsRef.current.find((c) => c.id === activeIdRef.current);
    const ident = identityRef.current;
    if (!conv) return;

    const sendUserId = resolveSendUserId(conv, ident);
    // 戳机器人自身
    const pokeTarget = ident.botSelfId;
    const receive = buildPokeReceive({
      userId: sendUserId,
      targetId: pokeTarget,
      groupId: conv.type === 'group' ? conv.targetId : null,
      botSelfId: ident.botSelfId,
    });

    const sysMsg: ChatMessage = {
      id: uid('sys'),
      role: 'system',
      blocks: [
        {
          kind: 'meta',
          event: 'poke',
          data: {
            user_id: sendUserId,
            target_id: pokeTarget,
            ...(conv.type === 'group' ? { group_id: conv.targetId } : {}),
          },
        },
      ],
      timestamp: Date.now(),
    };
    appendMessage(conv.id, sysMsg);

    const client = clientRef.current;
    if (!client || client.connectionState !== 'connected') {
      toast.error(t('liveChat.notConnected'));
      return;
    }
    client.sendReceive(receive);
  };

  // --------------------------------------------------------------------------
  // 会话 CRUD
  // --------------------------------------------------------------------------
  const handleCreate = () => {
    const tid = newTargetId.trim();
    if (!tid) {
      toast.error(t('liveChat.targetIdRequired'));
      return;
    }
    const conv = createConversation(newType, tid, newName.trim() || tid);
    setConversations((prev) => {
      if (prev.some((c) => c.id === conv.id)) {
        toast.message(t('liveChat.conversationExists'));
        return prev;
      }
      return [...prev, conv];
    });
    setActiveId(conv.id);
    setShowChatOnMobile(true);
    setCreateOpen(false);
    setNewTargetId('');
    setNewName('');
  };

  const handleDeleteConv = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setShowChatOnMobile(false);
    }
    setDeleteId(null);
  };

  const handleClearMessages = () => {
    if (!activeId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, messages: [], lastPreview: undefined, updatedAt: Date.now() } : c,
      ),
    );
  };

  const handleSaveSettings = () => {
    const next = {
      ...settingsDraft,
      userId: settingsDraft.userId.trim() || identity.userId,
      nickname: settingsDraft.nickname.trim() || settingsDraft.userId.trim(),
      botSelfId: settingsDraft.botSelfId.trim() || identity.botSelfId,
    };
    setIdentity(next);
    setSettingsOpen(false);
    toast.success(t('liveChat.settingsSaved'));
  };

  const reconnect = () => {
    const old = clientRef.current;
    old?.disconnect();
    const client = new LiveChatWsClient({
      routeBotId: WS_BOT_ID,
      token: getAuthToken() || '',
      maxRetries: 0,
    });
    client.setHandlers({
      onState: (s) => setConnState(s),
      onMessage: (m) => handleIncomingRef.current(m),
      onRawLog: (level, text) => {
        const fn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
        fn(`[GsCore ${level}]`, text);
      },
    });
    clientRef.current = client;
    client.connect();
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="page-fill flex glass-card">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]">
        {/* 左侧会话列表 */}
        <div
          className={cn(
            'border-r border-border/40 flex flex-col shrink-0',
            'w-full absolute inset-0 z-10 sm:relative sm:w-72 md:w-80 lg:w-[340px]',
            showChatOnMobile && activeConv ? 'hidden sm:flex' : 'flex',
          )}
        >
          <ConversationSidebar
            conversations={conversations}
            activeId={activeId}
            search={search}
            onSearchChange={setSearch}
            onSelect={(id) => {
              setActiveId(id);
              setShowChatOnMobile(true);
              setReplyTo(null);
              setAtBot(false);
            }}
            onCreate={() => {
              setNewType('group');
              setNewTargetId('');
              setNewName('');
              setCreateOpen(true);
            }}
            onDelete={(id) => setDeleteId(id)}
            onOpenSettings={() => {
              setSettingsDraft(identity);
              setSettingsOpen(true);
            }}
            connectionState={connState}
            connectionLabel={connectionLabel(connState, t)}
            identityLabel={`${identity.nickname || identity.userId} (${identity.userId})`}
            t={t}
          />
        </div>

        {/* 右侧聊天区 */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 min-h-0',
            !showChatOnMobile || !activeConv ? 'hidden sm:flex' : 'flex',
          )}
        >
          {activeConv ? (
            <>
              {/* Header */}
              <div className="h-14 sm:h-16 border-b border-border/50 px-3 sm:px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden h-8 w-8 shrink-0"
                    onClick={() => setShowChatOnMobile(false)}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>

                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarFallback
                      className={cn(
                        activeConv.type === 'group' ? 'bg-green-500/20' : 'bg-blue-500/20',
                      )}
                    >
                      {activeConv.type === 'group' ? (
                        <Users className="w-4 h-4 text-green-500" />
                      ) : (
                        <User className="w-4 h-4 text-blue-500" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="font-semibold text-sm sm:text-base truncate">{activeConv.name}</h2>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[10px] px-1.5 py-0 h-4 shrink-0 whitespace-normal max-w-full',
                          activeConv.type === 'group'
                            ? 'bg-green-500/20 text-green-600'
                            : 'bg-primary/20 text-primary',
                        )}
                      >
                        {activeConv.type === 'group' ? t('liveChat.group') : t('liveChat.direct')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activeConv.type === 'group'
                        ? t('liveChat.groupId', { id: activeConv.targetId })
                        : t('liveChat.userId', { id: activeConv.targetId })}
                      {' · '}
                      ws:{WS_BOT_ID}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={reconnect}
                    title={t('liveChat.reconnect')}
                  >
                    <RefreshCw className={cn('w-4 h-4', connState === 'connecting' && 'animate-spin')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleClearMessages}
                    title={t('liveChat.clearMessages')}
                  >
                    <Eraser className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(activeConv.id)}
                    title={t('liveChat.deleteChat')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 min-h-0" ref={chatScrollRef}>
                <div className="py-3 sm:py-4 px-2 sm:px-3">
                  {activeConv.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                      <MessageCircle className="w-10 h-10 opacity-40" />
                      <p className="text-sm text-center max-w-xs">{t('liveChat.emptyChat')}</p>
                      <p className="text-xs text-center max-w-sm opacity-70">{t('liveChat.emptyChatHint')}</p>
                    </div>
                  ) : (
                    activeConv.messages.map((m) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        resolveReplyPreview={resolveReplyPreview}
                        onReply={(msg) => setReplyTo(msg)}
                        onButtonClick={handleButtonClick}
                        onRetry={handleRetry}
                        onPlusOne={handlePlusOne}
                        onCopyToInput={handleCopyToInput}
                        t={t}
                      />
                    ))
                  )}
                  {awaitingByConv[activeConv.id] && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <Bot className="h-4 w-4 shrink-0" />
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                      </span>
                      <span>{t('liveChat.waitingReply')}</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Composer */}
              <MessageComposer
                value={draft}
                onChange={setDraft}
                pending={pending}
                onAddFiles={addFiles}
                onRemovePending={removePending}
                onSend={handleSend}
                onPoke={handlePoke}
                onAtBot={() => setAtBot((v) => !v)}
                sending={sending}
                replyPreview={
                  replyTo
                    ? blocksPreview(replyTo.blocks) || replyTo.msgId || replyTo.id
                    : null
                }
                onClearReply={() => setReplyTo(null)}
                isGroup={activeConv.type === 'group'}
                t={t}
              />
              {atBot && activeConv.type === 'group' && (
                <div className="px-3 pb-2 -mt-1">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Bot className="w-3 h-3" />
                    {t('liveChat.atBotActive')}
                    <button type="button" className="ml-1 opacity-70 hover:opacity-100" onClick={() => setAtBot(false)}>
                      ×
                    </button>
                  </Badge>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-6">
              <MessageCircle className="w-12 h-12 opacity-30" />
              <p className="text-sm">{t('liveChat.selectOrCreate')}</p>
              <Button variant="outline" className="h-9" onClick={() => setCreateOpen(true)}>
                {t('liveChat.newChat')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 新建会话 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              {t('liveChat.newChat')}
            </DialogTitle>
            <DialogDescription>{t('liveChat.newChatDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-0 pb-2">
            {/* 会话类型：无标题；轻量分段，避免 glass-card 深阴影 */}
            <div className="inline-flex gap-1 rounded-lg border border-border/40 bg-muted/40 p-1">
              {(
                [
                  { value: 'group' as const, label: t('liveChat.group'), icon: Users },
                  { value: 'direct' as const, label: t('liveChat.direct'), icon: User },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = newType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewType(opt.value)}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground shadow-none'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {newType === 'group' ? (
                  <Hash className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
                {newType === 'group' ? t('liveChat.groupIdLabel') : t('liveChat.peerIdLabel')}
              </Label>
              <Input
                className="h-9"
                value={newTargetId}
                onChange={(e) => setNewTargetId(e.target.value)}
                placeholder={newType === 'group' ? 'group_123' : 'user_456'}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {t('liveChat.displayName')}
              </Label>
              <Input
                className="h-9"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('liveChat.displayNamePlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="h-9" onClick={handleCreate}>
              {t('liveChat.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 身份设置 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="glass-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('liveChat.settings')}
            </DialogTitle>
            <DialogDescription>{t('liveChat.settingsDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('liveChat.userIdLabel')}</Label>
              {masters.length > 0 ? (
                <Select
                  value={masters.includes(settingsDraft.userId) ? settingsDraft.userId : '__custom__'}
                  onValueChange={(v) => {
                    if (v === '__custom__') return;
                    setSettingsDraft((s) => ({ ...s, userId: v, nickname: s.nickname || 'Master' }));
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
              ) : null}
              <Input
                className="h-9"
                value={settingsDraft.userId}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, userId: e.target.value }))}
                placeholder="user_id"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('liveChat.nicknameLabel')}</Label>
              <Input
                className="h-9"
                value={settingsDraft.nickname}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, nickname: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('liveChat.avatarLabel')}</Label>
              <Input
                className="h-9"
                value={settingsDraft.avatar}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, avatar: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t('liveChat.botSelfIdLabel')}</Label>
              <Input
                className="h-9"
                value={settingsDraft.botSelfId}
                onChange={(e) => setSettingsDraft((s) => ({ ...s, botSelfId: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{t('liveChat.botSelfIdHint')}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <div>ws_bot_id: <code className="text-foreground">{WS_BOT_ID}</code></div>
              <div>bot_id: <code className="text-foreground">{PLATFORM_BOT_ID}</code></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setSettingsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button className="h-9" onClick={handleSaveSettings}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="glass-card sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {t('liveChat.deleteChat')}
            </DialogTitle>
            <DialogDescription>{t('liveChat.deleteChatConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="h-9" onClick={() => setDeleteId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="h-9"
              onClick={() => deleteId && handleDeleteConv(deleteId)}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
