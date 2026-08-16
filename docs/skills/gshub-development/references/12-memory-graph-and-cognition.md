# 十二、记忆图谱与世界知识

> 返回 [SKILL 主入口](../SKILL.md)。后端契约见 gsuid_core `gscore-development` §9.14 与 `agent_kits_api.py`。

`/ai-memory` 的图谱不是「把所有能想起来的东西画成一张图」。2026-08-16 的 Write 层之后，前端必须同时表达两层，而且**不能把它们揉进同一张记忆表**：

| 层 | 住哪 | 前端怎么认 | 放什么 |
|----|------|------------|--------|
| 记忆图 | `aimem*`，按 `scope_key` 隔离 | `/ai-memory` 的 Entity / Edge / Sigma 蓝紫点 | 本群事实、说话人、关系边 |
| 世界知识 | `aicognode` 公共行，`ref` 以 `world:` 开头、`scope_key=""` | 青绿枢纽节点 + `/ai-runtime?tab=cognition` | 百科/手册正式名；**正文不在节点里** |
| 挂文 | `aicogattachment`，挂在枢纽 `node_id` 上 | 节点详情里的文章列表 | 标题 / slot / 句柄 / 是否可写；正文仍在 `_ENTITIES` / `aichunk` / FileOS |

群聊抽取**不新建** `world:`。本群实体完整匹配到恰好一颗已有枢纽时，环境镜像 `ref=ent:{entity_id}` 打 `canon=world:…`，图谱上画一条青绿 RELATED。说话人（`is_speaker` / Speaker）不连公共层。

## 12.1 前端该改哪几处

| 页面 | 必须表达的事实 |
|------|----------------|
| `/ai-memory` 图谱 Tab | 只画本 scope 的 Entity / Edge，**不要**把公共 world 枢纽叠进每张群图 |
| `/ai-memory` 世界枢纽 Tab | 单独列出公共 `world:` 枢纽与挂文；点枢纽看详情，点「打开文章」就地预览正文 |
| `/ai-memory` 实体卡片 / 详情 | 有 `canon` 或唯一 title 命中时出示世界枢纽 + 挂文 |
| `/ai-runtime?tab=cognition` | 列表带 `attachments` / `canon`；world 徽章；重建挂载（**不碰记忆图**） |
| `/ai-config` 认知分区 | 文案指向「世界枢纽 + 节点挂文」，入口仍跳运行时索引 |

禁止：

- 把知识正文复制进 `aimementity`，或把 Episode 画成知识节点。
- 跨 `scope_key` merge 同名实体。
- 把 `rebuild_cognition_mount` 做成「清空记忆」。
- 属主留空时展示 `tool_output` / `artifact`（与 `search_cognition` 同一条 ACL）。

## 12.2 API（`cognitionApi`）

全部走 `src/lib/api.ts`，封套兼容 `{status:0,data}` 与 `{status_code:200,data}`。

| 方法 | 端点 | 用途 |
|------|------|------|
| `getNodes({ keyword, scope_key, owner_user_id, limit })` | `GET /api/cognition/nodes` | 列表。`scope_key` 留空 = 只看公共枢纽；填了则公共 + 该 scope。每条带 `canon` 与 `attachments[]` |
| `getNode(id, { scope_key, owner_user_id })` | `GET /api/cognition/nodes/{id}` | 详情补齐挂件。不可见当 404 |
| `readArticle(handle)` | `GET /api/cognition/articles` | 就地预览挂文。插件/手动/Agent 是 `kb_plugin:` / `kb_kbdoc:`，网页落盘是 `to_` / `sa_` |
| `rebuildMount()` | `POST /api/cognition/rebuild_mount` | 清挂件 / world·ent 镜像后再挂。返回 `hubs` / `attachments` / `linked_env` / `skipped_*` / `last_error` |

类型：`CognitionNode.canon`、`CognitionAttachment`（`slot` / `writable` / `handle` / `source`）。旧后端没有这些字段时当空数组 / 空字符串，不要崩。

共享判断在 `src/lib/cognition.ts`：`isWorldHub`、`worldGraphId`、`hubForEntity`、`attachmentHref`、`isCognitionBackendMissing`。挂文列表复用 `src/components/cognition/CognitionAttachments.tsx`，不要在记忆页和运行时页各写一套。

## 12.3 世界枢纽页签

公共枢纽**单独一页**（`/ai-memory` 的「世界枢纽」Tab），不要画进每张群图谱。这一页本身也是 Sigma 图谱：青绿枢纽 + 琥珀挂文，点枢纽看详情、点挂文预览。

- 节点只展示 `isWorldHub`（`ref` 以 `world:` 开头且 `scope_key=""`）及其 `attachments`。
- 挂文预览走 `cognitionApi.readArticle(handle)`（`GET /api/cognition/articles`）。网页弱挂是 `to_` 落盘，不要只认 `kb_*`。
- 实体详情仍可出示它连上的枢纽，但不要为此把枢纽节点塞回群记忆图。
- Badge 里的 lucide 必须吃 `color: inherit`（`data-slot="badge"`），否则会被全局 `data-icon-color=black` 涂成死黑。

`GET /api/cognition/nodes` 上限 100。世界页签拉公共列表即可。

## 12.4 句柄跳转

挂文 `handle` 只是原库指针：

| handle / kind | 去哪 |
|---------------|------|
| `kb_plugin:` / `kb_kbdoc:` / `kb_*` | `/ai-knowledge` |
| `to_` / `sa_` | `/ai-tool-outputs` |
| `res_` / `artifact` | `/ai-artifacts` |
| episode / entity / preference / self_note | `/ai-memory` |

知识页目前没有按 `doc_id` 深链，跳到知识库首页即可。`writable=true` 的是 Agent / 网页补文，只读的是插件篇——UI 必须能分清，避免运维把只读篇当成可改。

## 12.5 Demo

`mockServer.ts` 的 `/api/cognition/nodes` 必须带至少一颗 `world:` 枢纽、两篇挂文（plugin 只读 + agent 可写）、一条 `ent:` 镜像的 `canon`。演示图谱（`group:114514` 的 `ent-4` 钟离等）才能画出青绿叠层。`POST /api/cognition/rebuild_mount` 要有独立路由，不要落到「写操作一律成功、回显 body」的兜底。
