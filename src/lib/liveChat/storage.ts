// ============================================================================
// Live Chat · 状态持久化
// 后端多文件：data/webconsole_live_chat/{identity,index,conversations/*}
// 前端经 /api/live-chat/* 读写；localStorage 仅作请求失败时的临时兜底
// ============================================================================

import { liveChatApi, type LiveChatStateDto } from '@/lib/api';
import {
  type Conversation,
  type LiveChatIdentity,
  DEFAULT_BOT_SELF_ID,
  LIVE_CHAT_IDENTITY_KEY,
  LIVE_CHAT_STORAGE_KEY,
} from './types';

const MAX_MESSAGES_PER_CONV = 200;

export interface LiveChatPersistedState {
  identity: LiveChatIdentity;
  conversations: Conversation[];
  activeId: string | null;
}

// ============================================================================
// 本地（仅用于首次迁移 / 后端不可用时的兜底读）
// ============================================================================

export function loadConversationsLocal(): Conversation[] {
  try {
    const raw = localStorage.getItem(LIVE_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => ({
      ...c,
      messages: Array.isArray(c.messages) ? c.messages : [],
    }));
  } catch {
    return [];
  }
}

export function loadIdentityLocal(): LiveChatIdentity | null {
  try {
    const raw = localStorage.getItem(LIVE_CHAT_IDENTITY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LiveChatIdentity;
  } catch {
    return null;
  }
}

/** @deprecated 使用 loadLiveChatState / saveLiveChatState */
export function loadConversations(): Conversation[] {
  return loadConversationsLocal();
}

/** @deprecated */
export function saveConversations(list: Conversation[]) {
  try {
    const trimmed = list.map((c) => ({
      ...c,
      messages:
        c.messages.length > MAX_MESSAGES_PER_CONV
          ? c.messages.slice(-MAX_MESSAGES_PER_CONV)
          : c.messages,
    }));
    localStorage.setItem(LIVE_CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[live-chat] local save conversations failed', e);
  }
}

/** @deprecated */
export function loadIdentity(): LiveChatIdentity | null {
  return loadIdentityLocal();
}

/** @deprecated */
export function saveIdentity(identity: LiveChatIdentity) {
  try {
    localStorage.setItem(LIVE_CHAT_IDENTITY_KEY, JSON.stringify(identity));
  } catch (e) {
    console.warn('[live-chat] local save identity failed', e);
  }
}

export function defaultIdentity(masterId?: string): LiveChatIdentity {
  return {
    userId: masterId || 'master',
    nickname: masterId ? 'Master' : 'Web User',
    avatar: '',
    botSelfId: DEFAULT_BOT_SELF_ID,
  };
}

export function createConversation(
  type: Conversation['type'],
  targetId: string,
  name?: string,
): Conversation {
  const now = Date.now();
  return {
    id: `${type}:${targetId}`,
    type,
    targetId,
    name: name || targetId,
    messages: [],
    updatedAt: now,
  };
}

function trimConversations(list: Conversation[]): Conversation[] {
  return list.map((c) => ({
    ...c,
    messages:
      c.messages.length > MAX_MESSAGES_PER_CONV
        ? c.messages.slice(-MAX_MESSAGES_PER_CONV)
        : c.messages,
  }));
}

function toDto(state: LiveChatPersistedState): LiveChatStateDto {
  return {
    identity: state.identity,
    conversations: trimConversations(state.conversations).map((c) => ({
      id: c.id,
      type: c.type,
      targetId: c.targetId,
      name: c.name,
      messages: c.messages as unknown[],
      updatedAt: c.updatedAt,
      lastPreview: c.lastPreview ?? null,
    })),
    activeId: state.activeId,
  };
}

function fromDto(data: LiveChatStateDto | null | undefined): LiveChatPersistedState | null {
  if (!data || !data.identity) return null;
  const identity: LiveChatIdentity = {
    userId: data.identity.userId || 'master',
    nickname: data.identity.nickname || 'Master',
    avatar: data.identity.avatar || '',
    botSelfId: data.identity.botSelfId || DEFAULT_BOT_SELF_ID,
  };
  const conversations: Conversation[] = Array.isArray(data.conversations)
    ? data.conversations.map((c) => ({
        id: c.id,
        type: c.type === 'group' ? 'group' : 'direct',
        targetId: c.targetId || '',
        name: c.name || c.targetId || '',
        messages: Array.isArray(c.messages) ? (c.messages as Conversation['messages']) : [],
        updatedAt: c.updatedAt || 0,
        lastPreview: c.lastPreview ?? undefined,
      }))
    : [];
  return {
    identity,
    conversations,
    activeId: data.activeId ?? null,
  };
}

/**
 * 从后端加载状态；若后端为空且本地有数据，则上传迁移一次。
 */
export async function loadLiveChatState(): Promise<LiveChatPersistedState> {
  try {
    const data = await liveChatApi.getState();
    const remote = fromDto(data);
    const hasRemote =
      !!remote &&
      (remote.conversations.length > 0 ||
        (remote.identity.userId && remote.identity.userId !== 'master') ||
        remote.identity.nickname !== 'Master');

    if (remote && (remote.conversations.length > 0 || hasRemote)) {
      // 同步一份到 local 作离线兜底缓存
      try {
        localStorage.setItem(LIVE_CHAT_STORAGE_KEY, JSON.stringify(remote.conversations));
        localStorage.setItem(LIVE_CHAT_IDENTITY_KEY, JSON.stringify(remote.identity));
      } catch {
        /* ignore */
      }
      return remote;
    }

    // 后端空：尝试迁移 localStorage
    const localConvs = loadConversationsLocal();
    const localIdent = loadIdentityLocal();
    if (localConvs.length > 0 || localIdent) {
      const migrated: LiveChatPersistedState = {
        identity: localIdent || defaultIdentity(),
        conversations: localConvs,
        activeId: localConvs[0]?.id ?? null,
      };
      try {
        await liveChatApi.putState(toDto(migrated));
      } catch (e) {
        console.warn('[live-chat] migrate to backend failed', e);
      }
      return migrated;
    }

    return remote || {
      identity: defaultIdentity(),
      conversations: [],
      activeId: null,
    };
  } catch (e) {
    console.warn('[live-chat] load from backend failed, fallback local', e);
    const localConvs = loadConversationsLocal();
    const localIdent = loadIdentityLocal();
    return {
      identity: localIdent || defaultIdentity(),
      conversations: localConvs,
      activeId: localConvs[0]?.id ?? null,
    };
  }
}

/** 保存到后端；失败时仍写 localStorage */
export async function saveLiveChatState(state: LiveChatPersistedState): Promise<void> {
  const trimmed = {
    ...state,
    conversations: trimConversations(state.conversations),
  };
  try {
    localStorage.setItem(LIVE_CHAT_STORAGE_KEY, JSON.stringify(trimmed.conversations));
    localStorage.setItem(LIVE_CHAT_IDENTITY_KEY, JSON.stringify(trimmed.identity));
  } catch {
    /* ignore */
  }
  try {
    await liveChatApi.putState(toDto(trimmed));
  } catch (e) {
    console.warn('[live-chat] save to backend failed', e);
    throw e;
  }
}
