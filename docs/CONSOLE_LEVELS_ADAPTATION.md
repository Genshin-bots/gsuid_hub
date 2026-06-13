# `/console` 日志级别 - 前端优化与后端适配文档

> 适用版本：`gsuid_hub` 前端 v1.x  
> 文档版本：v1.0  
> 最后更新：2026-06-13

## 一、背景与目标

`/console`（[`src/pages/ConsolePage.tsx`](../src/pages/ConsolePage.tsx)）页面提供实时日志流与命令行交互。日志级别过滤是该页面的核心操作之一，但旧实现存在两个问题：

1. **视觉与主题脱节**：级别 Badge 使用了硬编码的 Tailwind 颜色（`bg-purple-600` / `bg-emerald-600` / `bg-red-600` 等），无法跟随用户切换的 6 套主题色（`red` / `orchid` / `blue` / `green` / `orange` / `pink`）和玻璃/实体两种风格。
2. **选择不持久化**：用户的多选状态只存在 React 内存，刷新页面或重新打开控制台后会丢失，需要重新勾选。

本次优化的目标：

- 视觉上与现有主题系统（[`ThemeContext`](../src/contexts/ThemeContext.tsx)）深度联动；
- 用户选择持久化，跨刷新/跨会话保持；
- 对后端保持最小侵入，必要时可平滑升级为"跨设备同步"。

---

## 二、前端改动概览

### 2.1 文件清单

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| [`src/pages/ConsolePage.tsx`](../src/pages/ConsolePage.tsx) | 重构 | 主题化 Badge 样式 + localStorage 持久化 + 全选/全不选 |
| [`src/i18n/locales/zh-CN/console.json`](../src/i18n/locales/zh-CN/console.json) | 新增键 | `selectAll` / `deselectAll` |
| [`src/i18n/locales/en-US/console.json`](../src/i18n/locales/en-US/console.json) | 新增键 | `selectAll` / `deselectAll` |
| [`src/i18n/locales/ja-JP/console.json`](../src/i18n/locales/ja-JP/console.json) | 新增键 | `selectAll` / `deselectAll` |

### 2.2 视觉优化要点

- **不再硬编码颜色**：删除了 `bg-purple-600` / `text-emerald-300` 等 14 套 Tailwind 颜色组合。
- **使用主题 CSS 变量**：所有 Badge 颜色通过 `hsl(var(--primary))` / `hsl(var(--primary-foreground))` 注入 `inline style`，与 `ThemeContext` 计算出的主色直接联动。
- **明暗自适应**：
  - 激活态：`hsl(var(--primary) / 0.95)` 背景 + `hsl(var(--primary-foreground))` 前景 + 主题色阴影。
  - 非激活态：`hsl(var(--primary) / 0.06~0.08)` 背景 + `hsl(var(--primary) / 0.25)` 边框 + `hsl(var(--primary) / 0.75~0.85)` 文字。
- **玻璃风格联动**：`style === 'glassmorphism'` 时自动叠加 `backdrop-blur-sm`。
- **整体过滤器容器**：使用 `linear-gradient(90deg, hsl(var(--primary) / 0.04), transparent 60%)` 作为底色，让整个区域也带主题色微光。
- **新增交互**：
  - 圆形勾选指示器（激活显示 `Check`，未激活显示淡淡的 `Minus` 在 hover 时浮现）。
  - "全选 / 全不选"按钮（位于过滤器右侧），根据当前状态自动切换文案与图标。
  - Badge 在 hover 时微微上浮（`hover:-translate-y-px`），符合现代交互规范。

### 2.3 持久化方案

- **存储位置**：`localStorage`（key: `console_visible_levels`）
- **存储格式**：`JSON.stringify(string[])`，例如 `["debug","info","error"]`
- **加载优先级**：
  1. 进入页面 → 调用 `GET /api/logs/levels` 获取后端支持的级别列表；
  2. 尝试读取 `localStorage` 中的选择；
  3. 用后端返回的合法值集合**过滤**持久化数据，剔除已下线的级别；
  4. 若过滤后非空 → 应用持久化选择；否则使用默认 `['debug','info','error']`；
  5. 任何后续切换都即时写回 `localStorage`。
- **异常处理**：JSON 解析失败 / 读取异常时降级到默认集合，不影响页面渲染。

> 当前阶段刻意不引入后端持久化接口，原因见 §三。

---

## 三、后端现状与适配建议

### 3.1 现状

后端目前只需提供：

- `GET /api/logs/levels` → `[{ label: string, value: string }, ...]`

前端 [`src/lib/api.ts:1220`](../src/lib/api.ts) 已实现：

```ts
getLevels: () =>
  api.get<Array<{ label: string; value: string }>>('/api/logs/levels'),
```

> 该接口的响应结构、状态码、鉴权方式保持现状即可，**本次前端改动不需要后端任何变更**。

### 3.2 适配建议（可选 · 跨设备同步场景）

如果未来产品需要"同一账号在不同设备打开控制台时，级别选择保持一致"，可参考主题配置的同步模式（[`ThemeContext`](../src/contexts/ThemeContext.tsx) 中的 `themeApi.getConfig` / `themeApi.saveConfig`），新增以下两个端点：

#### 3.2.1 `GET /api/logs/config`

**用途**：读取用户保存的日志级别偏好。

**请求**：
- 鉴权：与现有 `auth_token` 一致
- Query/Body：无

**响应**（建议结构）：

```json
{
  "status": 0,
  "msg": "ok",
  "data": {
    "visible_levels": ["debug", "info", "error", "warning"]
  }
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `visible_levels` | `string[]` | 否 | 用户希望显示的日志级别 `value` 列表。空数组/缺省时由前端使用默认集合。值需落在 `GET /api/logs/levels` 返回的 `value` 集合中。 |

#### 3.2.2 `PUT /api/logs/config`

**用途**：保存用户日志级别偏好。

**请求体**：

```json
{
  "visible_levels": ["debug", "info", "warning"]
}
```

**字段约束**：

- `visible_levels` 必须是 `string[]`，且每个元素应是 `GET /api/logs/levels` 返回过的 `value`；
- 后端应做合法性校验，剔除无效值；
- 数组可以为空（表示用户主动全不选）；
- 不允许出现 `all` 这个特殊值（它是前端 UI 标志，非真实级别）。

**响应**（建议结构）：

```json
{
  "status": 0,
  "msg": "saved",
  "data": {
    "visible_levels": ["debug", "info", "warning"]
  }
}
```

**错误码建议**：

| `status` | `msg` | 场景 |
| --- | --- | --- |
| `0` | `ok` / `saved` | 成功 |
| `401` | `unauthorized` | 未登录或 token 失效 |
| `500` | `internal error` | 服务端异常 |

#### 3.2.3 与主题配置的统一（可选）

如果希望进一步统一管理用户偏好，可考虑把 `console.visible_levels` 作为 `theme_config` 的子字段一并存储，复用现有 `GET/PUT /api/theme/config` 端点。这种方案需要：

- 后端 `theme_config` 表/存储新增 `console_visible_levels` JSON 列；
- `GET /api/theme/config` 返回结构中追加 `console_visible_levels: string[]`；
- `PUT /api/theme/config` 接受并校验该字段；
- 前端 `ThemeContext` 的 `saveToBackend` 透传该字段（需要新增 setter）。

> 此方案属于"二阶段优化"，本 PR 不要求落地。

### 3.3 与 SSE 流的兼容

`GET /api/logs/stream?token=...&level=all` 接口未做修改，**前端的过滤逻辑没有变化**：流仍然发送所有级别的日志，前端用 `visibleLevels` 做客户端过滤。**请勿**根据 `visible_levels` 在流端做丢弃，否则切换过滤级别时会出现"老日志立即被裁掉、新日志才开始按新级别过滤"的撕裂感。

---

## 四、验证步骤

1. **视觉验证**
   - 打开 `/console` 页面；
   - 进入"主题"页面，分别切换 `red` / `orchid` / `blue` / `green` / `orange` / `pink`；
   - 确认级别 Badge 的颜色跟随主题色变化，且玻璃/实体风格下表现不同。
2. **持久化验证**
   - 勾选/取消若干级别后，刷新页面，确认选择被保留；
   - 关闭浏览器再打开，确认选择仍然存在；
   - 在 DevTools 中 `localStorage.removeItem('console_visible_levels')` 后刷新，确认回到默认 `[debug, info, error]`。
3. **i18n 验证**
   - 切换语言到 en-US / ja-JP / zh-CN，确认新增的"全选"/"全不选"按钮文案正确。
4. **异常路径验证**
   - 在 Network 面板拦截 `GET /api/logs/levels` 返回 500，确认页面仍可渲染级别 Badge（使用 fallback 列表）。
5. **数据契约验证**（仅当实现 §3.2 时）
   - 用 `curl` 验证 `GET /api/logs/config` / `PUT /api/logs/config` 的响应结构与本文件一致；
   - 上送非法级别（如 `"foo"`）后，响应中的 `visible_levels` 不应包含 `"foo"`。

---

## 五、回滚方案

若上线后发现问题，可通过以下方式回滚而不影响后端：

- 前端直接 `git revert` 涉及 `src/pages/ConsolePage.tsx` 与 3 个 i18n JSON 的提交；
- `localStorage` 中残留的 `console_visible_levels` 不会影响旧版本（被忽略），无需清理；
- 若已实现 §3.2 的后端接口，可保留端点不删除，前端不调用即可。

---

## 六、FAQ

**Q1：为什么不用后端持久化？**  
A：用户偏好属于"本地操作"性质，类比 `autoScroll` 开关（未持久化）、命令历史（仅 session 内有效）。若引入后端字段，会涉及用户表迁移、鉴权链路、跨设备一致性等多方面成本，**与收益不匹配**。当前 localStorage 方案以零成本满足"刷新不丢"的核心诉求。

**Q2：能不能在切换主题时让 Badge 有平滑过渡动画？**  
A：当前 `transition-all duration-200` 已提供基础过渡。如果希望更细腻的"颜色补间"，可在 Badge 外层容器添加主题色 CSS 变量，并让 `hsl()` 字符串随主题切换通过 `transition: color, background-color, border-color, box-shadow 200ms` 过渡（已在 `levelBadgeStyle` 中体现）。

**Q3：新增级别时是否需要修改前端？**  
A：不需要。Badge 列表来自 `GET /api/logs/levels` 动态渲染。`LEVEL_ORDER` 仅用于排序，未知级别会按字母序排在尾部。

**Q4：未来若要把所有日志级别默认全部显示，是否要改前端默认值？**  
A：是。默认值在 `applyLevels()` 的 `defaults` 集合中。如果产品希望"首次进入全选"，把 `defaults` 改为 `new Set(levels.map(lv => lv.value))` 即可（注意：会覆盖 `localStorage`，用户保存的选择照旧被尊重——首次进入时 localStorage 为空才会走默认值）。
