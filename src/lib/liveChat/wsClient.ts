// ============================================================================
// Live Chat · WebSocket 客户端（二进制帧 + 断线重连）
// ============================================================================

import { getCustomApiHost } from '@/lib/api';
import {
  type ConnectionState,
  type MessageReceive,
  type MessageSend,
  WS_BOT_ID,
} from './types';

export type LiveChatWsHandlers = {
  onState?: (state: ConnectionState, detail?: string) => void;
  onMessage?: (msg: MessageSend, raw: Uint8Array) => void;
  onRawLog?: (level: string, text: string) => void;
  onError?: (err: Error) => void;
};

export interface LiveChatWsOptions {
  /** 覆盖路由 bot_id，默认 webconsole_livechat */
  routeBotId?: string;
  /** 控制台登录会话 token（query `?token=`）；空则不带 query */
  token?: string;
  /** 最大重连次数，0 = 无限 */
  maxRetries?: number;
  /** 重连基础间隔 ms */
  retryBaseMs?: number;
}

function buildWsUrl(routeBotId: string, token?: string): string {
  const custom = getCustomApiHost()?.trim();
  let base: string;

  if (custom) {
    // custom_api_host 可能是 http(s)://host:port 或 host:port
    let httpUrl = custom;
    if (!/^https?:\/\//i.test(httpUrl)) {
      httpUrl = `http://${httpUrl}`;
    }
    const u = new URL(httpUrl);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    base = `${wsProto}//${u.host}`;
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    base = `${proto}//${window.location.host}`;
  }

  let url = `${base}/ws/${encodeURIComponent(routeBotId)}`;
  if (token) {
    url += `?token=${encodeURIComponent(token)}`;
  }
  return url;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class LiveChatWsClient {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private handlers: LiveChatWsHandlers = {};
  private opts: Required<LiveChatWsOptions>;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private sendQueue: Uint8Array[] = [];

  constructor(options: LiveChatWsOptions = {}) {
    this.opts = {
      routeBotId: options.routeBotId ?? WS_BOT_ID,
      token: options.token ?? '',
      maxRetries: options.maxRetries ?? 0,
      retryBaseMs: options.retryBaseMs ?? 3000,
    };
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  get routeBotId(): string {
    return this.opts.routeBotId;
  }

  setHandlers(handlers: LiveChatWsHandlers) {
    this.handlers = handlers;
  }

  setToken(token: string) {
    this.opts.token = token || '';
  }

  connect() {
    this.intentionalClose = false;
    this.clearRetry();
    this.openSocket();
  }

  disconnect() {
    this.intentionalClose = true;
    this.clearRetry();
    if (this.ws) {
      try {
        this.ws.close(1000, 'client disconnect');
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.setState('disconnected');
  }

  /** 上报 MessageReceive（二进制 JSON 帧） */
  sendReceive(msg: MessageReceive): boolean {
    const bytes = textEncoder.encode(JSON.stringify(msg));
    return this.sendBytes(bytes);
  }

  sendBytes(bytes: Uint8Array): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(bytes);
      return true;
    }
    // 断线时暂存，重连后冲刷
    this.sendQueue.push(bytes);
    return false;
  }

  // --------------------------------------------------------------------------
  private openSocket() {
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }

    const url = buildWsUrl(this.opts.routeBotId, this.opts.token || undefined);
    this.setState(this.retryCount > 0 ? 'reconnecting' : 'connecting', url);

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (e) {
      this.handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
      this.scheduleRetry();
      return;
    }

    socket.binaryType = 'arraybuffer';
    this.ws = socket;

    socket.onopen = () => {
      this.retryCount = 0;
      this.setState('connected', url);
      // 冲刷队列
      const q = this.sendQueue.splice(0);
      for (const b of q) {
        try {
          socket.send(b);
        } catch {
          /* ignore */
        }
      }
    };

    socket.onmessage = (ev) => {
      try {
        let bytes: Uint8Array;
        if (ev.data instanceof ArrayBuffer) {
          bytes = new Uint8Array(ev.data);
        } else if (typeof ev.data === 'string') {
          // 兼容误发文本帧
          bytes = textEncoder.encode(ev.data);
        } else if (ev.data instanceof Blob) {
          // 异步读 blob
          void (ev.data as Blob).arrayBuffer().then((buf) => {
            this.handleRaw(new Uint8Array(buf));
          });
          return;
        } else {
          return;
        }
        this.handleRaw(bytes);
      } catch (e) {
        this.handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
      }
    };

    socket.onerror = () => {
      this.handlers.onError?.(new Error('WebSocket error'));
    };

    socket.onclose = () => {
      this.ws = null;
      if (this.intentionalClose) {
        this.setState('disconnected');
        return;
      }
      this.setState('disconnected');
      this.scheduleRetry();
    };
  }

  private handleRaw(bytes: Uint8Array) {
    const text = textDecoder.decode(bytes);
    let msg: MessageSend;
    try {
      msg = JSON.parse(text) as MessageSend;
    } catch (e) {
      this.handlers.onError?.(e instanceof Error ? e : new Error('invalid JSON frame'));
      return;
    }

    // 日志包
    const firstType = msg.content?.[0]?.type;
    if (msg.bot_id === this.opts.routeBotId && firstType?.startsWith('log_')) {
      const level = firstType.split('_').pop()?.toLowerCase() || 'info';
      const data = msg.content?.[0]?.data;
      const logText = typeof data === 'string' ? data : JSON.stringify(data);
      this.handlers.onRawLog?.(level, logText);
      return;
    }

    this.handlers.onMessage?.(msg, bytes);
  }

  private scheduleRetry() {
    if (this.intentionalClose) return;
    if (this.opts.maxRetries > 0 && this.retryCount >= this.opts.maxRetries) {
      this.setState('error', 'max retries');
      return;
    }
    this.retryCount += 1;
    // 指数退避，上限 30s
    const delay = Math.min(this.opts.retryBaseMs * Math.pow(1.5, this.retryCount - 1), 30000);
    this.setState('reconnecting', `retry #${this.retryCount} in ${Math.round(delay)}ms`);
    this.clearRetry();
    this.retryTimer = setTimeout(() => this.openSocket(), delay);
  }

  private clearRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private setState(state: ConnectionState, detail?: string) {
    this.state = state;
    this.handlers.onState?.(state, detail);
  }
}
