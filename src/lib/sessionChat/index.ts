// ============================================================================
// 会话管理（消息记录）· 类型、渲染辅助、WebSocket 客户端
//
// 段结构由后端 `gsuid_core/message_history/segments.py` 生成，两边必须同步改。
// ============================================================================

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { getAuthToken, getCustomApiHost, resolveApiAssetUrl } from '@/lib/api';

type SegType =
  | 'text'
  | 'at'
  | 'reply'
  | 'image'
  | 'record'
  | 'video'
  | 'file'
  | 'face'
  | 'forward'
  | 'markdown'
  | 'button'
  | 'ark'
  | 'unknown';

export interface BtnItem {
  text?: string;
  /** 按钮携带的原始数据：命令按钮是命令文本，跳转按钮是 URL */
  data?: string;
  callback?: string;
  input?: string;
  link?: string;
  prefix?: string;
  pressed_text?: string;
  content?: string;
  confirm_text?: string;
  cancel_text?: string;
  /**
   * 线框/底色，和 QQ 客户端一致：
   * `0`/`2` 灰线框、`1` 蓝线框、`3` 灰线框红字、`4` 蓝底白字
   */
  style?: number;
  /** `0` 跳转链接、`1` 回调、`2` 命令、`-1` 自适应 */
  action?: number;
  permission?: number;
  limited?: boolean;
  enter?: boolean;
}

export interface MsgSeg {
  type: SegType;
  text?: string;
  qq?: string;
  name?: string;
  id?: string;
  url?: string;
  error?: string;
  count?: number;
  items?: MsgSeg[][];
  content?: string;
  template?: Record<string, unknown>;
  rows?: BtnItem[][];
  raw?: string;
  templateId?: number;
  kv?: Array<{ key: string; value: string }>;
  kind?: string;
}

export interface MsgSender {
  user_id?: string;
  nickname?: string;
  card?: string;
  avatar?: string;
  role?: string;
  title?: string;
  openid?: string;
  unionid?: string;
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  self: boolean;
  user_id: string;
  user_name?: string | null;
  user_avatar?: string | null;
  timestamp: number;
  content: string;
  segments: MsgSeg[];
  sender: MsgSender;
  msg_id?: string;
  /** WS 实时帧才有：后端算好的列表摘要，前端不再自己压一遍 */
  preview?: string;
}

export interface SessionItem {
  session_id: string;
  type: 'group' | 'private';
  WS_BOT_ID?: string;
  bot_id?: string;
  bot_self_id?: string;
  group_id?: string | null;
  user_id?: string;
  title: string;
  avatar: string;
  message_count: number;
  last_access?: number;
  created_at?: number;
  last_preview: string;
  last_role: string;
  last_time: number;
  pinned: boolean;
  blacklisted: boolean;
  note: string;
}

export interface SessionPrefs {
  session_id: string;
  pinned: boolean;
  blacklisted: boolean;
  note: string;
}

export interface TargetInfo {
  type: 'group' | 'user';
  key: string;
  id: string;
  name: string;
  avatar: string;
  member_count?: number;
  card?: string;
  role?: string;
  title?: string;
  openid?: string;
  unionid?: string;
}

export interface SendPayload {
  mode: 'plain' | 'markdown' | 'card' | 'rich';
  text?: string;
  markdown?: string;
  /** `{type, content}` 的 JSON，服务端包成 card 段 */
  card?: string;
  at?: string;
  reply?: string;
  images?: File[];
  records?: File[];
  videos?: File[];
  files?: File[];
}

/** Bot 的唯一键：一个适配器下可能挂多个号，WS_BOT_ID 也要算进去 */
export function botKeyOf(session: SessionItem): string {
  return `${session.WS_BOT_ID ?? ''}:${session.bot_self_id ?? ''}`;
}

/** 群身份 → i18n key。认不出就原样显示 role 原文 */
export const ROLE_KEY: Record<string, string> = {
  owner: 'sessionManagement.roleOwner',
  admin: 'sessionManagement.roleAdmin',
};

const pad = (n: number) => String(n).padStart(2, '0');

export function formatClock(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDay(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 列表里的时间：今天只给时分，更早的给月日 */
export function formatListTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? formatClock(ts) : `${d.getMonth() + 1}-${pad(d.getDate())}`;
}

/** 消息流里的日期分隔：与上一条不同天就插一条 */
export function needDayDivider(prev?: number, current?: number): boolean {
  if (!current) return false;
  if (!prev) return true;
  return formatDay(prev) !== formatDay(current);
}

// ---------------------------------------------------------------------------
// Markdown：marked(breaks) + DOMPurify
// ---------------------------------------------------------------------------

let purifyHooked = false;
function purifier() {
  if (!purifyHooked) {
    // 面板是单页应用，链接在原标签页打开会把整个面板顶掉
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        // 内联指令按钮不是真链接，点击由 SegmentView 接管，别给它开新标签页
        const href = node.getAttribute('href') ?? '';
        if (!href.startsWith(INLINE_CMD_PREFIX)) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      }
      if (node.tagName === 'IMG') {
        // markdown 里的图片不走 SegmentView，host 只能在这里补
        const src = node.getAttribute('src');
        if (src) node.setAttribute('src', assetUrl(src));
        // QQ 的 multimedia 直链只要带 Referer 就 400，浏览器跨域取图默认会带，这里统一关掉
        node.setAttribute('referrerpolicy', 'no-referrer');
      }
    });
    purifyHooked = true;
  }
  return DOMPurify;
}

/** 内联指令按钮在锚点里的前缀，点击由 SegmentView 事件委托接管 */
export const INLINE_CMD_PREFIX = '#inlinecmd:';

/**
 * QQ 的 `[文字](mqqapi://aio/inlinecmd?command=xxx)` 是「点了就发这句话」的按钮。
 * DOMPurify 会把这个私有协议整个剥掉，所以先换成锚点，渲染后再接管点击。
 */
function rewriteInlineCmd(content: string): string {
  return content.replace(
    /\[([^\]\n]+)\]\(mqqapi:\/\/aio\/inlinecmd\?([^)\n]+)\)/g,
    (_all, text: string, query: string) => {
      let command = '';
      try {
        command = new URLSearchParams(query).get('command') ?? '';
      } catch {
        command = '';
      }
      return command ? `[${text}](${INLINE_CMD_PREFIX}${encodeURIComponent(command)})` : text;
    },
  );
}

/**
 * 渲染后的收尾：
 * 1. `![图片 #36px #36px](src)` 的 alt 里带着插件的尺寸约定，落到 style 上才生效；
 * 2. 整段只有一个或多个内联指令链接时，排成一行等宽大按钮。
 */
function layoutInline(html: string): string {
  const holder = document.createElement('div');
  holder.innerHTML = html;

  holder.querySelectorAll('img').forEach((img) => {
    const alt = img.getAttribute('alt') ?? '';
    const size = alt.match(/#(\d+)(?:px)?(?:\s+#(\d+)(?:px)?)?/);
    if (!size) return;
    const width = Number(size[1]);
    const height = Number(size[2] ?? size[1]);
    if (!width || !height) return;
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    img.classList.add('seg-inline-img');
    img.setAttribute('alt', '');
  });

  holder.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith(INLINE_CMD_PREFIX)) return;
    if (/^https?:/i.test(href)) a.setAttribute('rel', 'noopener noreferrer');
  });

  holder.querySelectorAll('p').forEach((p) => {
    const anchors = Array.from(p.querySelectorAll<HTMLAnchorElement>(`a[href^="${INLINE_CMD_PREFIX}"]`));
    if (!anchors.length) return;
    // 段落里除了这些链接没有别的文字，才算纯按钮行；混着正文就保持内联小标签
    const bare = (p.textContent ?? '').replace(/\s+/g, '');
    const labels = anchors.map((a) => (a.textContent ?? '').replace(/\s+/g, '')).join('');
    if (!labels || bare !== labels) return;

    // 按原 markdown 的换行分组
    const groups: HTMLAnchorElement[][] = [];
    let current: HTMLAnchorElement[] = [];
    for (const node of Array.from(p.childNodes)) {
      if (node.nodeName === 'BR') {
        if (current.length) groups.push(current);
        current = [];
      } else if (node.nodeName === 'A') {
        current.push(node as HTMLAnchorElement);
      }
    }
    if (current.length) groups.push(current);

    if (groups.length <= 1) {
      p.classList.add('seg-btn-row');
      anchors.forEach((a) => a.classList.add('seg-btn', 'seg-btn--primary'));
      return;
    }

    const frag = document.createDocumentFragment();
    for (const group of groups) {
      const row = document.createElement('div');
      row.className = 'seg-btn-row';
      group.forEach((a) => {
        a.classList.add('seg-btn', 'seg-btn--primary');
        row.appendChild(a);
      });
      frag.appendChild(row);
    }
    p.replaceWith(frag);
  });

  return holder.innerHTML;
}

/**
 * QQ 的 markdown 里一个换行就是一行，标准 markdown 会把单个换行折成空格，
 * 所以必须开 `breaks`，否则行会挤成一坨。
 */
export function markdownToHtml(content: string): string {
  if (!content) return '';
  const parsed = marked.parse(rewriteInlineCmd(content), { async: false, breaks: true }) as string;
  const sanitized = purifier().sanitize(parsed, {
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input'],
  });
  return layoutInline(sanitized);
}

/** markdown 压成纯文本，复制出去 / 列表预览用 */
function mdToText(content: string): string {
  return String(content ?? '')
    .replace(/!\[([^\]\n]*)\]\([^)]*\)/g, (_all, alt: string) =>
      alt && !alt.includes('#') ? alt : '[图片]',
    )
    .replace(/\[([^\]\n]*)\]\([^)]*\)/g, '$1')
    .replace(/^[>\s]+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_~]+/g, '');
}

/** 整条消息压成纯文本，右键「复制」用 */
export function messageToText(msg: ChatMsg): string {
  let out = '';
  for (const seg of msg.segments ?? []) {
    switch (seg.type) {
      case 'text':
        out += seg.text ?? '';
        break;
      case 'at':
        out += `@${seg.name || seg.qq || ''} `;
        break;
      case 'markdown':
        out += mdToText(seg.content ?? '');
        break;
      case 'image':
        out += '[图片] ';
        break;
      case 'record':
        out += '[语音] ';
        break;
      case 'video':
        out += '[视频] ';
        break;
      case 'file':
        out += '[文件] ';
        break;
      case 'face':
        out += '[表情] ';
        break;
      case 'forward':
        out += '[合并转发] ';
        break;
      default:
        break;
    }
  }
  return out.trim();
}

/** 资源地址：直链原样用，`/api/...` 在自定义后端时补 host（实现见 `lib/api`） */
export function assetUrl(url?: string): string {
  return resolveApiAssetUrl(url);
}

// ---------------------------------------------------------------------------
// WebSocket：新消息实时推送
// ---------------------------------------------------------------------------

export type WsFrame =
  | { type: 'message'; session_id: string; message: ChatMsg }
  | { type: 'cleared'; session_id: string }
  | { type: 'deleted'; session_id: string }
  | { type: 'ping' };

function buildWsUrl(): string {
  const custom = getCustomApiHost()?.trim();
  let base: string;
  if (custom) {
    const withProto = /^https?:\/\//i.test(custom) ? custom : `http://${custom}`;
    const u = new URL(withProto);
    base = `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
  } else {
    base = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  }
  const token = getAuthToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${base}/api/history/chat/ws${query}`;
}

type SessionWsHandlers = {
  onFrame?: (frame: WsFrame) => void;
  onState?: (state: 'connecting' | 'open' | 'closed') => void;
};

/** 断线自动重连（指数退避，上限 30s）。组件卸载时记得 disconnect。 */
export class SessionChatWs {
  private ws: WebSocket | null = null;
  private handlers: SessionWsHandlers;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(handlers: SessionWsHandlers) {
    this.handlers = handlers;
  }

  connect() {
    this.closed = false;
    this.open();
  }

  disconnect() {
    this.closed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      this.ws?.close(1000, 'client disconnect');
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.handlers.onState?.('closed');
  }

  private open() {
    if (this.closed) return;
    this.handlers.onState?.('connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(buildWsUrl());
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      this.retry = 0;
      this.handlers.onState?.('open');
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const frame = JSON.parse(event.data) as WsFrame;
        if (frame?.type) this.handlers.onFrame?.(frame);
      } catch {
        /* 非 JSON 帧直接忽略 */
      }
    };

    socket.onclose = () => {
      this.ws = null;
      this.handlers.onState?.('closed');
      this.scheduleRetry();
    };

    socket.onerror = () => {
      /* onclose 会跟着来，重连逻辑统一放在那里 */
    };
  }

  private scheduleRetry() {
    if (this.closed) return;
    this.retry += 1;
    const delay = Math.min(3000 * Math.pow(1.6, this.retry - 1), 30000);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.open(), delay);
  }
}
