// ============================================================================
// Live Chat · GsCore 早柚协议类型（对齐 gsuid_core/models.py）
// ============================================================================

/** 消息段（最小单元） */
export interface MessageSegment {
  type?: string | null;
  data?: unknown;
}

/** 上报包：平台 → core */
export interface MessageReceive {
  bot_id: string;
  bot_self_id: string;
  msg_id: string;
  user_type: 'group' | 'direct' | 'channel' | 'sub_channel';
  group_id: string | null;
  user_id: string;
  sender: Record<string, unknown>;
  user_pm: number;
  content: MessageSegment[];
}

/** 下发包：core → 平台 */
export interface MessageSend {
  bot_id: string;
  bot_self_id: string;
  msg_id: string;
  target_type?: string | null;
  target_id?: string | null;
  content?: MessageSegment[] | null;
  /** 非空时适配器发完后必须回执 recall_message_id */
  echo?: string | null;
}

/** 按钮字段（注意 permisson 拼写） */
export interface ButtonData {
  text: string;
  data: string;
  pressed_text?: string | null;
  style?: 0 | 1;
  action?: -1 | 0 | 1 | 2;
  permisson?: 0 | 1 | 2 | 3;
  specify_role_ids?: string[];
  specify_user_ids?: string[];
  unsupport_tips?: string;
  prefix?: string;
}

// ============================================================================
// UI 层模型
// ============================================================================

export type ConversationType = 'group' | 'direct';

export type ChatMsgRole = 'user' | 'bot' | 'system';

/** 已解析、可直接渲染的消息块 */
export type ChatBlock =
  | { kind: 'text'; text: string }
  | { kind: 'image'; src: string; raw: string }
  | { kind: 'record'; src: string; raw: string }
  | { kind: 'video'; src: string; raw: string }
  | { kind: 'file'; name: string; src: string; raw: string }
  | { kind: 'at'; userId: string }
  | { kind: 'reply'; msgId: string }
  | { kind: 'markdown'; text: string }
  | { kind: 'buttons'; rows: ButtonData[][] }
  | { kind: 'node'; items: ChatBlock[][] }
  | { kind: 'meta'; event: string; data: Record<string, unknown> }
  | { kind: 'control'; type: string; data: unknown }
  | { kind: 'unknown'; type: string; data: unknown };

export interface ChatMessage {
  id: string;
  role: ChatMsgRole;
  blocks: ChatBlock[];
  /** 原始段，调试用 */
  rawContent?: MessageSegment[];
  /** 平台侧 msg_id（上报/下发） */
  msgId?: string;
  /** 引用回复的目标 msg_id */
  replyTo?: string;
  /** 发送者展示 */
  senderName?: string;
  senderAvatar?: string;
  timestamp: number;
  /** 本地 pending 状态 */
  status?: 'sending' | 'sent' | 'failed';
  /** 是否已被撤回 */
  recalled?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  /** group_id 或 private peer 展示 id */
  targetId: string;
  name: string;
  messages: ChatMessage[];
  updatedAt: number;
  /** 最后一条预览 */
  lastPreview?: string;
}

export interface LiveChatIdentity {
  /** 当前扮演的用户 ID（默认主人） */
  userId: string;
  nickname: string;
  avatar: string;
  /** 机器人账号 ID（bot_self_id） */
  botSelfId: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/** 路由级 WS bot_id（连接路径 /ws/{bot_id}） */
export const WS_BOT_ID = 'webconsole_livechat';

/** 消息级平台 bot_id（MessageReceive / MessageSend.bot_id） */
export const PLATFORM_BOT_ID = 'webconsole_livechat';

export const LIVE_CHAT_STORAGE_KEY = 'gshub_live_chat_v1';
export const LIVE_CHAT_IDENTITY_KEY = 'gshub_live_chat_identity_v1';
export const DEFAULT_BOT_SELF_ID = 'webconsole_bot';
