// ============================================================================
// Live Chat · 段解析 / 上报构造 / 下发抽取
// ============================================================================

import {
  type ButtonData,
  type ChatBlock,
  type ChatMessage,
  type MessageReceive,
  type MessageSegment,
  type MessageSend,
  PLATFORM_BOT_ID,
  DEFAULT_BOT_SELF_ID,
} from './types';
import { fileContentToSrc, mediaDataToSrc, parseFileSegment } from './media';

// ----------------------------------------------------------------------------
// 工具
// ----------------------------------------------------------------------------

export function uid(prefix = 'm'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function asString(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'number' || typeof data === 'boolean') return String(data);
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

// ----------------------------------------------------------------------------
// 按钮布局 A（扁平）/ B（嵌套行）归一化
// ----------------------------------------------------------------------------

export function normalizeButtonRows(raw: unknown): ButtonData[][] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  // 布局 B：首项是数组
  if (Array.isArray(raw[0])) {
    return (raw as unknown[][]).map((row) =>
      (Array.isArray(row) ? row : []).filter(isButtonLike).map(toButtonData),
    );
  }

  // 布局 A：扁平 list，默认每行 2 个
  const flat = (raw as unknown[]).filter(isButtonLike).map(toButtonData);
  const rows: ButtonData[][] = [];
  for (let i = 0; i < flat.length; i += 2) {
    rows.push(flat.slice(i, i + 2));
  }
  return rows;
}

function isButtonLike(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'text' in (v as object);
}

function toButtonData(v: Record<string, unknown>): ButtonData {
  return {
    text: String(v.text ?? ''),
    data: String(v.data ?? ''),
    pressed_text: v.pressed_text != null ? String(v.pressed_text) : null,
    style: (v.style === 0 || v.style === 1 ? v.style : 1) as 0 | 1,
    action: ([-1, 0, 1, 2].includes(Number(v.action)) ? Number(v.action) : -1) as -1 | 0 | 1 | 2,
    permisson: (v.permisson as ButtonData['permisson']) ?? 2,
    specify_role_ids: Array.isArray(v.specify_role_ids) ? v.specify_role_ids.map(String) : [],
    specify_user_ids: Array.isArray(v.specify_user_ids) ? v.specify_user_ids.map(String) : [],
    unsupport_tips: v.unsupport_tips != null ? String(v.unsupport_tips) : undefined,
    prefix: v.prefix != null ? String(v.prefix) : '',
  };
}

// ----------------------------------------------------------------------------
// MessageSend content → ChatBlock[]
// ----------------------------------------------------------------------------

export function segmentsToBlocks(segments: MessageSegment[] | null | undefined): ChatBlock[] {
  if (!segments?.length) return [];
  const blocks: ChatBlock[] = [];

  for (const seg of segments) {
    const type = seg.type || '';
    const data = seg.data;

    if (type.startsWith('log_')) {
      // 日志包在更高层拦截，这里不应出现
      continue;
    }

    if (type === 'excute_delete_message' || type === 'excute_ban_user') {
      blocks.push({ kind: 'control', type, data });
      continue;
    }

    if (type.startsWith('meta-')) {
      const event = type.slice('meta-'.length);
      const metaData =
        data && typeof data === 'object' && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : { value: data };
      blocks.push({ kind: 'meta', event, data: metaData });
      continue;
    }

    switch (type) {
      case 'text':
        blocks.push({ kind: 'text', text: asString(data) });
        break;
      case 'image': {
        const raw = asString(data);
        blocks.push({ kind: 'image', src: mediaDataToSrc(raw, 'image/png'), raw });
        break;
      }
      case 'record': {
        const raw = asString(data);
        blocks.push({ kind: 'record', src: mediaDataToSrc(raw, 'audio/mpeg'), raw });
        break;
      }
      case 'video': {
        const raw = asString(data);
        blocks.push({ kind: 'video', src: mediaDataToSrc(raw, 'video/mp4'), raw });
        break;
      }
      case 'file': {
        const raw = asString(data);
        const { name, content } = parseFileSegment(raw);
        blocks.push({ kind: 'file', name, src: fileContentToSrc(content), raw });
        break;
      }
      case 'at':
        blocks.push({ kind: 'at', userId: asString(data) });
        break;
      case 'reply':
        blocks.push({ kind: 'reply', msgId: asString(data) });
        break;
      case 'markdown':
        blocks.push({
          kind: 'markdown',
          text: asString(data).replace(/link:\/\//g, ''),
        });
        break;
      case 'template_markdown': {
        // 仅 QQ 官方：降级成可读文本
        const obj = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
        const tid = String(obj.template_id ?? '');
        const para = obj.para && typeof obj.para === 'object' ? JSON.stringify(obj.para) : '';
        blocks.push({
          kind: 'markdown',
          text: `**[template_markdown]** \`${tid}\`\n\n\`\`\`\n${para}\n\`\`\``,
        });
        break;
      }
      case 'buttons':
        blocks.push({ kind: 'buttons', rows: normalizeButtonRows(data) });
        break;
      case 'template_buttons':
        blocks.push({
          kind: 'text',
          text: `[template_buttons] ${asString(data)}`,
        });
        break;
      case 'node': {
        // data = List[Message] 或 已是 list of dict
        const items: ChatBlock[][] = [];
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item && typeof item === 'object' && 'type' in (item as object)) {
              items.push(segmentsToBlocks([item as MessageSegment]));
            } else if (Array.isArray(item)) {
              items.push(segmentsToBlocks(item as MessageSegment[]));
            }
          }
        }
        blocks.push({ kind: 'node', items });
        break;
      }
      case 'image_size':
      case 'group':
        // 渲染辅助 / 双 ID 定位，UI 可忽略
        break;
      case 'recall_message_id':
        // 上行回执，不应出现在下发 content 里
        break;
      default:
        if (type) {
          blocks.push({ kind: 'unknown', type, data });
        }
        break;
    }
  }

  return blocks;
}

/** 提取纯文本（text + markdown），供复制 / 展示 */
export function blocksToPlainText(blocks: ChatBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'text' || b.kind === 'markdown') {
      if (b.text.trim()) parts.push(b.text);
    }
  }
  return parts.join('\n').trim();
}

/** 是否含可操作的文本段 */
export function messageHasText(msg: { blocks: ChatBlock[] }): boolean {
  return msg.blocks.some(
    (b) => (b.kind === 'text' || b.kind === 'markdown') && b.text.trim().length > 0,
  );
}

/**
 * 构造可再次上报的 content。
 * 优先用 rawContent；否则从 blocks 回拼（媒体用 raw 载荷）。
 * skipReply: +1 时通常不要再带引用段。
 */
export function messageToResendContent(
  msg: { blocks: ChatBlock[]; rawContent?: MessageSegment[] },
  opts: { skipReply?: boolean } = {},
): MessageSegment[] {
  if (msg.rawContent?.length) {
    return msg.rawContent.filter((s) => {
      if (opts.skipReply && s.type === 'reply') return false;
      return !!s.type;
    });
  }
  const segs: MessageSegment[] = [];
  for (const b of msg.blocks) {
    switch (b.kind) {
      case 'text':
        if (b.text) segs.push({ type: 'text', data: b.text });
        break;
      case 'markdown':
        if (b.text) segs.push({ type: 'text', data: b.text });
        break;
      case 'image':
        if (b.raw) segs.push({ type: 'image', data: b.raw });
        break;
      case 'record':
        if (b.raw) segs.push({ type: 'record', data: b.raw });
        break;
      case 'video':
        if (b.raw) segs.push({ type: 'video', data: b.raw });
        break;
      case 'file':
        if (b.raw) segs.push({ type: 'file', data: b.raw });
        break;
      case 'at':
        segs.push({ type: 'at', data: b.userId });
        break;
      case 'reply':
        if (!opts.skipReply) segs.push({ type: 'reply', data: b.msgId });
        break;
      default:
        break;
    }
  }
  return segs;
}

/** 从 blocks 抽一段预览文案 */
export function blocksPreview(blocks: ChatBlock[], maxLen = 80): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case 'text':
      case 'markdown':
        parts.push(b.text);
        break;
      case 'image':
        parts.push('[image]');
        break;
      case 'record':
        parts.push('[audio]');
        break;
      case 'video':
        parts.push('[video]');
        break;
      case 'file':
        parts.push(`[file:${b.name}]`);
        break;
      case 'at':
        parts.push(`@${b.userId}`);
        break;
      case 'buttons':
        parts.push('[buttons]');
        break;
      case 'node':
        parts.push('[forward]');
        break;
      case 'meta':
        parts.push(`[meta:${b.event}]`);
        break;
      case 'reply':
        parts.push(`[reply:${b.msgId}]`);
        break;
      default:
        break;
    }
  }
  const s = parts.join(' ').replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}

// ----------------------------------------------------------------------------
// 构造上报 MessageReceive
// ----------------------------------------------------------------------------

export interface BuildReceiveOptions {
  userType: 'group' | 'direct';
  groupId?: string | null;
  userId: string;
  content: MessageSegment[];
  msgId?: string;
  sender?: Record<string, unknown>;
  userPm?: number;
  botSelfId?: string;
  botId?: string;
}

export function buildMessageReceive(opts: BuildReceiveOptions): MessageReceive {
  return {
    bot_id: opts.botId ?? PLATFORM_BOT_ID,
    bot_self_id: opts.botSelfId ?? DEFAULT_BOT_SELF_ID,
    msg_id: opts.msgId ?? uid('out'),
    user_type: opts.userType,
    group_id: opts.userType === 'direct' ? null : (opts.groupId ?? null),
    user_id: opts.userId,
    sender: opts.sender ?? {},
    user_pm: opts.userPm ?? 6,
    content: opts.content,
  };
}

/** 按钮点击 → 当用户发 text 上报 */
export function buildButtonClickReceive(
  base: Omit<BuildReceiveOptions, 'content'>,
  buttonData: string,
): MessageReceive {
  return buildMessageReceive({
    ...base,
    content: [{ type: 'text', data: buttonData }],
  });
}

/** 戳一戳元事件 */
export function buildPokeReceive(opts: {
  userId: string;
  targetId: string;
  groupId?: string | null;
  botSelfId?: string;
}): MessageReceive {
  const isGroup = !!opts.groupId;
  return buildMessageReceive({
    userType: isGroup ? 'group' : 'direct',
    groupId: opts.groupId ?? null,
    userId: opts.userId,
    botSelfId: opts.botSelfId,
    content: [
      {
        type: 'meta-poke',
        data: {
          user_id: String(opts.userId),
          target_id: String(opts.targetId),
          ...(isGroup ? { group_id: String(opts.groupId) } : {}),
        },
      },
    ],
  });
}

/** echo 回执 */
export function buildRecallReceipt(
  msg: MessageSend,
  platformMsgId: string | string[] | null,
): MessageReceive {
  return {
    bot_id: msg.bot_id || PLATFORM_BOT_ID,
    bot_self_id: msg.bot_self_id || DEFAULT_BOT_SELF_ID,
    msg_id: '',
    user_type: 'direct',
    group_id: null,
    user_id: '',
    sender: {},
    user_pm: 6,
    content: [
      {
        type: 'recall_message_id',
        data: {
          echo: msg.echo,
          id: platformMsgId,
        },
      },
    ],
  };
}

// ----------------------------------------------------------------------------
// 下发 MessageSend → 本地 ChatMessage
// ----------------------------------------------------------------------------

export function messageSendToChatMessage(msg: MessageSend, localId?: string): ChatMessage {
  const segments = msg.content ?? [];
  const blocks = segmentsToBlocks(segments);
  const replyBlock = blocks.find((b) => b.kind === 'reply');
  return {
    id: localId ?? uid('in'),
    role: 'bot',
    blocks,
    // 保留原始段，便于 +1 / 复制时还原
    rawContent: segments,
    msgId: msg.msg_id || undefined,
    replyTo: replyBlock && replyBlock.kind === 'reply' ? replyBlock.msgId : undefined,
    senderName: 'Bot',
    timestamp: Date.now(),
    status: 'sent',
  };
}

export function isLogPacket(msg: MessageSend, routeBotId: string): boolean {
  if (msg.bot_id !== routeBotId) return false;
  const t = msg.content?.[0]?.type;
  return !!t && t.startsWith('log_');
}

export function isControlPacket(msg: MessageSend): {
  kind: 'delete' | 'ban' | null;
  data: Record<string, unknown> | null;
} {
  if (!msg.content || msg.content.length !== 1) return { kind: null, data: null };
  const seg = msg.content[0];
  if (seg.type === 'excute_delete_message') {
    const d =
      seg.data && typeof seg.data === 'object' && !Array.isArray(seg.data)
        ? (seg.data as Record<string, unknown>)
        : null;
    return { kind: 'delete', data: d };
  }
  if (seg.type === 'excute_ban_user') {
    const d =
      seg.data && typeof seg.data === 'object' && !Array.isArray(seg.data)
        ? (seg.data as Record<string, unknown>)
        : null;
    return { kind: 'ban', data: d };
  }
  return { kind: null, data: null };
}

/** 会话匹配键 */
export function conversationKey(type: 'group' | 'direct', targetId: string): string {
  return `${type}:${targetId}`;
}

export function targetFromSend(msg: MessageSend): {
  type: 'group' | 'direct';
  targetId: string;
} | null {
  const t = msg.target_type;
  const id = msg.target_id;
  if (!t || !id) return null;
  if (t === 'group' || t === 'channel' || t === 'sub_channel') {
    return { type: 'group', targetId: String(id) };
  }
  if (t === 'direct') {
    return { type: 'direct', targetId: String(id) };
  }
  return { type: 'direct', targetId: String(id) };
}
