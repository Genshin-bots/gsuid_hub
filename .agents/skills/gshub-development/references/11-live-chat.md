# 十一、Live Chat（实时聊天 / 控制台内嵌适配器）

> 返回 [SKILL 主入口](../SKILL.md)。
>
> 源码入口：
> - 页面：`src/pages/LiveChatPage.tsx`（路由 `/live-chat`）
> - 协议与客户端：`src/lib/liveChat/`
> - UI 组件：`src/components/live-chat/`
> - REST：`liveChatApi`（`src/lib/api.ts` → `/api/live-chat/*`）
> - WS：`/ws/webconsole_livechat`（二进制 JSON 帧）

Live Chat 不是「Session 管理」的聊天 UI，而是**控制台内嵌的 GsCore 适配器**：浏览器扮演一个
平台适配器，通过 WebSocket 完整上报 `MessageReceive`、接收 `MessageSend`，用于调试 AI /
插件 / 按钮 / 戳一戳 / 撤回等早柚协议行为。

---

## 11.1 模块分层（禁止把协议逻辑塞进页面）

```
src/lib/liveChat/
├── types.ts      # MessageReceive/Send、ChatBlock、Conversation、身份与常量
├── media.ts      # base64:// / link:// 双形态 ↔ 浏览器 src；File → base64
├── protocol.ts   # 段解析、上报构造、下发抽取、按钮归一化、echo 回执
├── wsClient.ts   # LiveChatWsClient：建连 / 断线重连 / 二进制帧 / 日志包分流
├── storage.ts    # 后端多文件状态 + localStorage 兜底与一次性迁移
└── index.ts      # 统一 re-export

src/components/live-chat/
├── ConnectionBadge.tsx      # 连接态徽章
├── ConversationSidebar.tsx  # 左侧会话列表 / 搜索 / 新建 / 设置入口
├── MessageBubble.tsx        # 气泡 + 段渲染（图/音/视/文件/MD/按钮/node/meta）
└── MessageComposer.tsx      # 输入框 + 附件 + @机器人 + 戳一戳 + 引用条

src/pages/LiveChatPage.tsx   # 编排：状态 / WS 生命周期 / 发送与等待 / 会话 CRUD
```

**约定**：

| 职责 | 放哪里 |
|------|--------|
| 协议字段、段类型、后端拼写兼容 | `types.ts` / `protocol.ts` |
| 媒体编解码 | `media.ts` |
| 传输层（URL、token、重连、队列） | `wsClient.ts` |
| 持久化 | `storage.ts` + `liveChatApi` |
| 纯展示 / 交互控件 | `components/live-chat/*` |
| 业务编排（会话路由、等待锁、身份） | **仅** `LiveChatPage.tsx` |

新增段类型时：**先**在 `protocol.segmentsToBlocks` 与 `messageToResendContent` 补齐，再改
`MessageBubble` 渲染；不要在页面里 `switch (seg.type)`。

---

## 11.2 协议常量与双 bot_id

```ts
// types.ts
export const WS_BOT_ID = 'webconsole_livechat';       // 路由级：/ws/{bot_id}
export const PLATFORM_BOT_ID = 'webconsole_livechat'; // 消息级：MessageReceive/Send.bot_id
export const DEFAULT_BOT_SELF_ID = 'webconsole_bot';  // 默认 bot_self_id（is_tome / 戳一戳目标）
```

- **WS 路径 bot_id** 与 **消息 `bot_id`** 当前同值，但语义不同：路径决定 core 把哪个适配器
  注册进连接表；消息 `bot_id` 参与插件/AI 路由。
- **`bot_self_id`** 是「机器人在该平台的账号 ID」，群聊 `@机器人`（`at` 段 data）与戳一戳
  `target_id` 都应对它，**不要**和扮演用户的 `user_id` 混用。

### 后端拼写兼容（故意保留）

早柚协议历史字段存在拼写错误，**前端必须原样对齐**，不要「纠正」：

| 字段 / 段 type | 正确拼写应是 | 说明 |
|----------------|--------------|------|
| `ButtonData.permisson` | permission | 按钮权限位 |
| `excute_delete_message` | execute_… | 撤回控制包 |
| `excute_ban_user` | execute_… | 禁言控制包 |

---

## 11.3 上报 / 下发数据流

```
用户输入 / 按钮 / 戳一戳
        │
        ▼
 buildMessageReceive / buildButtonClickReceive / buildPokeReceive
        │  MessageReceive (JSON)
        ▼
 LiveChatWsClient.sendReceive  ──二进制帧──►  GsCore  /ws/webconsole_livechat
                                                    │
                                                    ▼  插件 / AI / 命令
 GsCore  ──MessageSend 二进制帧──►  onMessage
        │
        ├─ log_* 段 + bot_id===routeBotId → onRawLog（不进会话）
        ├─ excute_delete_message → 标记 recalled
        ├─ excute_ban_user → 系统气泡
        └─ 普通 content → segmentsToBlocks → ChatMessage 追加到 target 会话
              └─ 若带 echo → 立即 buildRecallReceipt 回执
```

### 媒体双形态（`media.ts`）

| 协议 data | 浏览器展示 |
|-----------|------------|
| `link://https://…` | 去掉前缀后的 URL |
| `base64://AAAA…` | `data:{mime};base64,AAAA…`（按 magic 猜 mime） |
| 裸 `https://` / `data:` | 原样 |
| 其它疑似 base64 | 当 base64 包一层 |

上传：`fileToBase64Payload(file)` → `base64://…`。文件段格式：`文件名|base64://…` 或
`文件名|link://…`（`parseFileSegment`）。

### 按钮布局归一化

`normalizeButtonRows` 同时吃：

- **布局 B**：`Button[][]`（首项是数组）→ 原样按行；
- **布局 A**：扁平 `Button[]` → 默认每行 2 个。

`action === 0` 且 `data` 是 `http(s)` 时前端直接 `window.open`，不再上报。

### echo 回执

下发 `MessageSend.echo` 非空时，适配器**必须**在处理完后上报：

```ts
content: [{ type: 'recall_message_id', data: { echo, id: platformMsgId } }]
```

空包（TTL 丢弃 / 无有效段）**仍要回执**，但不要画气泡。

---

## 11.4 WebSocket 客户端契约

`LiveChatWsClient`（`wsClient.ts`）：

| 能力 | 行为 |
|------|------|
| URL | `getCustomApiHost()` → `ws(s)://host/ws/{routeBotId}?token=`；无自定义 host 用 `window.location` |
| 帧 | `binaryType = 'arraybuffer'`；发送 `TextEncoder` JSON；兼容误发的 text / Blob |
| 重连 | 指数退避 `base * 1.5^n`，上限 30s；`maxRetries: 0` = 无限 |
| 离线队列 | `sendBytes` 在未 OPEN 时入队，`onopen` 冲刷 |
| 日志包 | `bot_id === routeBotId` 且首段 `type` 以 `log_` 开头 → `onRawLog`，不进 `onMessage` |
| demo | 页面侧 `import.meta.env.VITE_DEMO` 时**不建连** |

Token 来自 `getAuthToken()`（控制台登录会话），经 `?token=` 传给 `/ws/webconsole_livechat`。
**不要**再用 `configApi.getCoreConfig().WS_TOKEN`：该接口已管理员专用，且 `WS_TOKEN` 会打码。
`masters` 走 `liveChatApi.getBootstrap()`（`require_auth`）。其它适配器 bot 仍用核心 `WS_TOKEN`。

### ★★ 禁止把 handler 放进 connect 的 useEffect 依赖（P-30）

```tsx
// ✅ 用 ref 挂最新处理函数；effect 仅依赖 bootstrap 完成（coreLoaded）
const handleIncomingRef = useRef<(msg: MessageSend) => void>(() => {});
handleIncomingRef.current = (msg) => { /* 用 identityRef / activeIdRef / tRef */ };

useEffect(() => {
  if (!coreLoaded || import.meta.env.VITE_DEMO) return;
  const client = new LiveChatWsClient({
    routeBotId: WS_BOT_ID,
    token: getAuthToken() || '',
    …
  });
  client.setHandlers({
    onMessage: (m) => handleIncomingRef.current(m),
    …
  });
  client.connect();
  return () => client.disconnect();
}, [coreLoaded]); // 禁止把 identity / conversations / t 放进来
```

否则每次身份/会话更新都会断连重连，AI 请求在 core 队列里等到超过 **STALE_CHAT_REQUEST_TTL = 8s**
被丢弃，表现为「发了没回」。

---

## 11.5 状态持久化

后端目录（由 gsuid_core 维护）：`data/webconsole_live_chat/{identity,index,conversations/*}`。

| API | 用途 |
|-----|------|
| `GET /api/live-chat/bootstrap` | `masters`（登录即可；不含 `WS_TOKEN`） |
| `GET/PUT /api/live-chat/state` | 整包读写（页面主路径） |
| `PUT /api/live-chat/identity` | 仅身份 |
| `PUT /api/live-chat/index` | 索引 + activeId（无 messages） |
| `PUT/DELETE /api/live-chat/conversations/:id` | 单会话 |

前端 `storage.ts`：

1. `loadLiveChatState`：优先后端；后端空且 localStorage 有数据 → **上传迁移一次**；后端失败 → 本地兜底。
2. `saveLiveChatState`：先写 local，再 `putState`；每会话消息 **截断至 200** 条（`MAX_MESSAGES_PER_CONV`）。
3. 页面侧对 identity / conversations / activeId **防抖 600ms** 写回。

localStorage key：`gshub_live_chat_v1` / `gshub_live_chat_identity_v1`（仅缓存，不是事实源）。

---

## 11.6 页面骨架与交互约定

### 布局

与 `/session-management`、`/ai-history` 同属 **`.page-fill` 全高单卡片**：

```tsx
<div className="page-fill flex glass-card">
  <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]">
    {/* 左：会话列表 | 右：消息 + Composer */}
  </div>
</div>
```

- **不要**用 `PinnedPage`（本页无全局 H1 流，内部自带顶栏）。
- glass-card 宿主禁止 `overflow-hidden`；裁切放**内层** `rounded-[inherit]`（[§04](./04-page-layout-spec.md)、[§10 P-19](./10-pitfalls-and-performance.md)）。
- 移动端：列表 / 聊天 **互斥全屏**（`showChatOnMobile` + `sm:` 断点），与 Session 管理一致。

### 身份与 user_id

| 场景 | 上报 `user_id` |
|------|----------------|
| 群聊 | 全局身份 `identity.userId`（默认 core `masters[0]`） |
| 私聊 | 会话 `targetId`（便于模拟多用户私聊） |

`user_pm`：`masters.includes(sendUserId) ? 1 : 6`。

### 会话键

`id = conversationKey(type, targetId)` → `group:123` / `direct:456`。下发用
`targetFromSend(msg)` 解析 `target_type` + `target_id`，没有目标时回落到当前 `activeId`。

### 发送等待锁（P-31）★★

Core 对适配器侧未完成请求有 **约 8s 的 STALE_CHAT_REQUEST_TTL**。同一会话连发会导致后发
请求在队列里过期被丢弃。

页面用 `awaitingByConv[convId]`：

- 发送成功 → `markAwaiting(convId)`（最长 120s 保险解除）；
- 收到 `role === 'bot'` 回复 → 清除该会话等待；
- 等待中：发送 / +1 / 重试 全部 toast `liveChat.waitForReply` 并 return。

### 消息操作

| 操作 | 行为 |
|------|------|
| 失败重试 | `messageToResendContent` + `replaceMessageId`，**不新建**气泡 |
| +1 | 优先纯文本；无文本则整包 media 重发（`skipReply`） |
| 复制到输入框 | `blocksToPlainText` |
| 引用回复 | content 前置 `{ type: 'reply', data: msgId }` |
| @ 机器人 | 群聊 content 前置 `{ type: 'at', data: botSelfId }` |
| 撤回控制包 | 按 `message_id` 标 `recalled`，气泡显示已撤回 |

---

## 11.7 新页面落地清单（Live Chat 专项）

在 [§10 总清单](./10-pitfalls-and-performance.md) 之外，改本功能时额外自检：

- [ ] 协议改动只动 `lib/liveChat`，页面只编排
- [ ] 后端 typo 字段（`permisson` / `excute_*`）保持兼容，不「修正」
- [ ] WS `useEffect` 依赖只有建连相关；handler 走 ref（P-30）
- [ ] 同会话有 awaiting 时禁止连发（P-31）
- [ ] `echo` 无论是否空包都回执
- [ ] 媒体走 `mediaDataToSrc` / `fileToBase64Payload`，不手写 data URL 拼接
- [ ] 持久化经 `loadLiveChatState` / `saveLiveChatState`，不直接只写 localStorage
- [ ] demo 模式不建 WS
- [ ] i18n 模块 `liveChat` 三语言 + 三个 `index.ts`；侧栏 `sidebar.liveChat` + 稳定 id `liveChat`
- [ ] 路由 `/live-chat` 在 `App.tsx`；图标 `MessageCircle` 已进 `ICON_MAP`

---

## 11.8 与相近页面的分工

| 页面 | 用途 |
|------|------|
| **Live Chat** `/live-chat` | 模拟平台适配器，完整早柚协议调试（本页） |
| Session 管理 `/session-management` | 已有 Session 的历史与发消息（HTTP history API） |
| AI 历史 `/ai-history` | Session 运行日志 / Trace 瀑布（只读诊断） |
| 实时控制台 `/console` | 系统日志 WS + 远程命令，**不是**聊天协议 |

---

## 11.9 关联：表情包「按条件清空」

同批改动里 `AIMemePage` 增加「清空表情」：

- API：`memeApi.purge({ confirm: true, purge_all? | status? | folder? | persona_hint? })`
- UI：`RadioGroup` 二选一——当前筛选结果 / 全部；筛选清空**必须**至少有 status、folder、persona 之一（不含语义搜索 q）
- 错误：`getApiErrorMessage`（[§01 §1.5](./01-architecture-and-conventions.md)）
- 危险操作：`AlertDialog` + destructive 按钮；执行中禁用关闭

i18n key 前缀：`aiMeme.purgeAll*` / `purgeScope*` / `purgeFilteredNoFilter`。
