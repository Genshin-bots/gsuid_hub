import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
  forwardRef,
  createContext,
  useContext,
  Fragment,
} from 'react';
import { cn, formatTokens } from '@/lib/utils';
import type { SessionLogEntry, HistoryResetReason, AITool } from '@/lib/api';
import { aiToolsApi } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronRight,
  ChevronDown,
  Play,
  MessageSquare,
  Wrench,
  Bot,
  User,
  CheckCircle2,
  Shield,
  Lightbulb,
  Radio,
  AlertTriangle,
  Eraser,
  UserCog,
  Scissors,
  Loader2,
  AlignLeft,
  Sparkles,
} from 'lucide-react';

// 工具名 → 元数据（description/plugin/category）。由顶层 TraceWaterfall 拉一次 /api/ai/tools/list
// 注入，供 tools_list 芯片 hover 弹 tooltip 展示工具基本信息；拉取失败则为空、tooltip 退化只显名字。
const ToolInfoContext = createContext<Record<string, AITool>>({});

// 行缩进步长（须与下方 paddingLeft: depth*INDENT / marginLeft 对齐）
const INDENT = 14;
// 层级竖线基准：时间列 64 + gap 8 + 展开控件（w-4）半宽 8
const RAIL_LEFT = 80;
// 时间列宽 64 + gap 8：内容面板/子 trace 的左缩进要越过时间列
const TIME_COL = 72;

// ============================================================================
// Trace 模型：把扁平 entries 重建为 span 树（run → chat / tool / subagent 子 span）
// ============================================================================

export type SpanKind =
  | 'run'
  | 'chat'
  | 'tool'
  | 'subagent'
  | 'user'
  | 'result'
  | 'event' // error / history_reset 分隔条
  | 'system' // system_prompt / tools_list / session 生命周期
  | 'proactive'
  | 'generic';

export interface TraceSpan {
  id: string;
  kind: SpanKind;
  start: number; // 秒
  end: number; // 秒
  children: TraceSpan[];
  entry?: SessionLogEntry; // 主 entry（内容来源）
  contentEntries?: SessionLogEntry[]; // 附属 entry（chat 下的 thinking/text/token，tool 的 return）
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  cacheRead?: number;
  toolName?: string;
  isError?: boolean;
  resetReason?: HistoryResetReason;
  // 交互模式切换分隔条：主动发言(proactive) ↔ 被动聊天(用户触发的 run) 的边界
  modeChange?: 'to_proactive' | 'to_reactive';
  agentData?: Record<string, unknown>; // subagent span 的 agent_linked data
  sumTokensIn?: number;
  sumTokensOut?: number;
}

function asNum(v: unknown): number {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}
function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * 把一段（可能跨分段拼接后的）扁平 entries 重建为 span 树。
 *
 * 规则：run_start→run_end 括出一个「agent run」span；其内 ModelRequestNode = 一个「chat」
 * span（其后的 thinking/text/token 归其内容与徽章），tool_call+tool_return（按 tool_call_id
 * 配对）= tool span，sub_agent 的 agent_linked = 可展开的 subagent span。history_reset / error /
 * proactive / system_prompt 等作顶层行。开放 span 的 end 由子/内容时间戳兜底推断。
 */
function buildTrace(entries: SessionLogEntry[]): TraceSpan[] {
  const roots: TraceSpan[] = [];
  let run: TraceSpan | null = null;
  let chat: TraceSpan | null = null;
  const openTools: Record<string, TraceSpan> = {};
  let seq = 0;
  const nid = () => `sp${seq++}`;
  // 后端是否落了权威 mode_change 标记；有则用它，无则末尾按 kind 兜底推断（兼容旧日志）
  let sawExplicitMode = false;

  const pushTop = (sp: TraceSpan) => roots.push(sp);
  const addToRun = (sp: TraceSpan) => (run ? run.children.push(sp) : roots.push(sp));

  for (const e of entries) {
    const ts = e.timestamp;
    const d = (e.data || {}) as Record<string, unknown>;
    switch (e.type) {
      case 'run_start': {
        run = { id: nid(), kind: 'run', start: ts, end: ts, children: [], sumTokensIn: 0, sumTokensOut: 0 };
        chat = null;
        pushTop(run);
        break;
      }
      case 'run_end': {
        if (run) run.end = Math.max(run.end, ts);
        run = null;
        chat = null;
        break;
      }
      case 'node_transition': {
        const nt = asStr(d.node_type);
        if (nt === 'ModelRequestNode') {
          // 新的模型轮次：收尾上一轮 chat，另开一个（本轮 thinking/text 归其名下）
          if (chat) chat.end = Math.max(chat.end, ts);
          chat = { id: nid(), kind: 'chat', start: ts, end: ts, children: [], contentEntries: [] };
          addToRun(chat);
        } else if (nt === 'End') {
          if (chat) chat.end = Math.max(chat.end, ts);
          chat = null;
        }
        // CallToolsNode：不关闭 chat——模型响应（thinking / text_output / tool_call）在此节点产出，
        // thinking/text 应嵌套到本轮「对话」之下（工具调用仍作为 run 级独立 span，见 tool_call）。
        break;
      }
      case 'user_input': {
        addToRun({ id: nid(), kind: 'user', start: ts, end: ts, entry: e, children: [] });
        break;
      }
      case 'thinking':
      case 'text_output': {
        if (chat) {
          // 嵌套为「对话」的子 span（对话 → 思考过程 / 文本输出），而非与对话同级
          chat.children.push({ id: nid(), kind: 'generic', start: ts, end: ts, entry: e, children: [] });
          chat.end = Math.max(chat.end, ts);
        } else {
          addToRun({ id: nid(), kind: 'generic', start: ts, end: ts, entry: e, children: [] });
        }
        break;
      }
      case 'token_usage': {
        const inp = asNum(d.input_tokens);
        const out = asNum(d.output_tokens);
        if (chat) {
          chat.tokensIn = inp;
          chat.tokensOut = out;
          chat.model = asStr(d.model_name);
          chat.cacheRead = asNum(d.cache_read_tokens);
          chat.end = Math.max(chat.end, ts);
          chat.contentEntries!.push(e);
        }
        if (run) {
          run.sumTokensIn = (run.sumTokensIn || 0) + inp;
          run.sumTokensOut = (run.sumTokensOut || 0) + out;
          if (!run.model) run.model = asStr(d.model_name);
        }
        break;
      }
      case 'tool_call': {
        const tcid = asStr(d.tool_call_id);
        const sp: TraceSpan = {
          id: nid(),
          kind: 'tool',
          start: ts,
          end: ts,
          entry: e,
          toolName: asStr(d.tool_name),
          contentEntries: [],
          children: [],
        };
        addToRun(sp);
        if (tcid) openTools[tcid] = sp;
        break;
      }
      case 'tool_return': {
        const tcid = asStr(d.tool_call_id);
        const sp = tcid ? openTools[tcid] : undefined;
        if (sp) {
          sp.end = Math.max(sp.end, ts);
          sp.contentEntries = [...(sp.contentEntries || []), e];
          delete openTools[tcid];
        } else {
          addToRun({
            id: nid(),
            kind: 'tool',
            start: ts,
            end: ts,
            entry: e,
            toolName: asStr(d.tool_name),
            contentEntries: [e],
            children: [],
          });
        }
        break;
      }
      case 'agent_linked': {
        // sub_agent：主 Agent 派生的子 Agent；proactive_generator：主动消息的决策/生成子 Agent，
        // 其日志即「主动发言」背后的思考来源——两者都作可展开的 subagent span 暴露出来
        // （proactive_generator 之前被过滤掉，导致主动发言看起来"只有输出没有思考"）。
        const at = asStr(d.agent_type);
        if (at !== 'sub_agent' && at !== 'proactive_generator') break;
        addToRun({ id: nid(), kind: 'subagent', start: ts, end: ts, entry: e, agentData: d, children: [] });
        break;
      }
      case 'result': {
        // 作为 run 的最后一个子行（保持时间顺序：结果在各步骤之后）
        addToRun({ id: nid(), kind: 'result', start: ts, end: ts, entry: e, children: [] });
        break;
      }
      case 'error': {
        addToRun({ id: nid(), kind: 'event', start: ts, end: ts, entry: e, isError: true, children: [] });
        break;
      }
      case 'history_reset': {
        // 分隔条：即便发生在 run 内也提升到顶层，画醒目独立色块
        pushTop({
          id: nid(),
          kind: 'event',
          start: ts,
          end: ts,
          entry: e,
          resetReason: asStr(d.reason) as HistoryResetReason,
          children: [],
        });
        break;
      }
      case 'mode_change': {
        // 后端权威模式标记：主动↔被动翻转处的 tag（优先于末尾的前端兜底推断）
        sawExplicitMode = true;
        pushTop({
          id: nid(),
          kind: 'event',
          start: ts,
          end: ts,
          entry: e,
          modeChange: asStr(d.mode) === 'proactive' ? 'to_proactive' : 'to_reactive',
          children: [],
        });
        break;
      }
      case 'proactive_emission': {
        pushTop({ id: nid(), kind: 'proactive', start: ts, end: ts, entry: e, children: [] });
        break;
      }
      case 'system_prompt': {
        pushTop({ id: nid(), kind: 'system', start: ts, end: ts, entry: e, children: [] });
        break;
      }
      case 'tools_list': {
        addToRun({ id: nid(), kind: 'system', start: ts, end: ts, entry: e, children: [] });
        break;
      }
      case 'session_created':
      case 'session_resumed':
      case 'session_ended': {
        pushTop({ id: nid(), kind: 'system', start: ts, end: ts, entry: e, children: [] });
        break;
      }
      default:
        break;
    }
  }

  // 兜底推断开放 span 的 end（run/chat/tool 未收尾时用子/内容最大时间戳）
  const finalizeEnds = (sp: TraceSpan): number => {
    let end = sp.end;
    for (const c of sp.children) end = Math.max(end, finalizeEnds(c));
    for (const ce of sp.contentEntries || []) end = Math.max(end, ce.timestamp);
    sp.end = end;
    return end;
  };
  roots.forEach(finalizeEnds);

  // 后端已落权威 mode_change 标记 → 直接用（已在流中按位置 pushTop 到顶层），不再前端推断。
  if (sawExplicitMode) return roots;

  // 兜底（旧日志无 mode_change）：按顶层项 kind 推断交互模式，在主动(proactive)↔被动(用户触发的
  // run) 的边界处插一条 tag，直观标出"用户此时发话进入被动聊天"或"AI 转为主动发言"。
  // run=被动、proactive=主动，其余中性不改模式。
  const withModes: TraceSpan[] = [];
  let lastMode: 'proactive' | 'reactive' | null = null;
  for (const r of roots) {
    const mode: 'proactive' | 'reactive' | null =
      r.kind === 'proactive' ? 'proactive' : r.kind === 'run' ? 'reactive' : null;
    if (mode && lastMode && mode !== lastMode) {
      withModes.push({
        id: nid(),
        kind: 'event',
        start: r.start,
        end: r.start,
        children: [],
        modeChange: mode === 'proactive' ? 'to_proactive' : 'to_reactive',
      });
    }
    if (mode) lastMode = mode;
    withModes.push(r);
  }
  return withModes;
}

// ============================================================================
// 顶层分块：logfire 式「堆叠卡片」——每个 run 一张卡（局部时间窗），
// 主动发言/重置/模式切换/会话生命周期各自成独立分隔块，散落行归并为无头卡片。
// ============================================================================

type Block =
  | { key: string; type: 'run' | 'proactive' | 'reset' | 'mode' | 'lifecycle'; sp: TraceSpan }
  | { key: string; type: 'loose'; spans: TraceSpan[] };

const LIFECYCLE_TYPES = new Set(['session_created', 'session_resumed', 'session_ended']);

function groupBlocks(roots: TraceSpan[]): Block[] {
  const blocks: Block[] = [];
  let loose: TraceSpan[] = [];
  const flush = () => {
    if (loose.length > 0) blocks.push({ key: `loose-${loose[0].id}`, type: 'loose', spans: loose });
    loose = [];
  };
  for (const sp of roots) {
    if (sp.kind === 'run') {
      flush();
      blocks.push({ key: sp.id, type: 'run', sp });
    } else if (sp.kind === 'proactive') {
      flush();
      blocks.push({ key: sp.id, type: 'proactive', sp });
    } else if (sp.kind === 'event' && sp.resetReason) {
      flush();
      blocks.push({ key: sp.id, type: 'reset', sp });
    } else if (sp.kind === 'event' && sp.modeChange) {
      flush();
      blocks.push({ key: sp.id, type: 'mode', sp });
    } else if (sp.kind === 'system' && LIFECYCLE_TYPES.has(sp.entry?.type || '')) {
      flush();
      blocks.push({ key: sp.id, type: 'lifecycle', sp });
    } else {
      loose.push(sp);
    }
  }
  flush();
  return blocks;
}

// ============================================================================
// 展示辅助
// ============================================================================

function formatTimeOnly(ts: number): string {
  const dt = new Date(ts * 1000);
  return dt.toLocaleTimeString('zh-CN', { hour12: false });
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '';
  const ms = seconds * 1000;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m${s > 0 ? ` ${s}s` : ''}`;
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

const RESET_STYLE: Record<string, { border: string; bg: string; text: string; icon: JSX.Element; key: string }> = {
  user_clear: {
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    icon: <Eraser className="w-3.5 h-3.5" />,
    key: 'aiHistory.waterfall.reset.userClear',
  },
  persona_switch: {
    border: 'border-violet-500/40',
    bg: 'bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-400',
    icon: <UserCog className="w-3.5 h-3.5" />,
    key: 'aiHistory.waterfall.reset.personaSwitch',
  },
  auto_compact: {
    border: 'border-border',
    bg: 'bg-muted/60',
    text: 'text-muted-foreground',
    icon: <Scissors className="w-3.5 h-3.5" />,
    key: 'aiHistory.waterfall.reset.autoCompact',
  },
};

// 交互模式变化分隔条样式：被动(用户发话) 用中性蓝、主动(AI 发言) 用粉色，与 proactive span 同色系
const MODE_STYLE: Record<string, { border: string; bg: string; text: string; icon: JSX.Element; key: string }> = {
  to_reactive: {
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
    text: 'text-sky-600 dark:text-sky-400',
    icon: <User className="w-3.5 h-3.5" />,
    key: 'aiHistory.waterfall.mode.toReactive',
  },
  to_proactive: {
    border: 'border-pink-500/40',
    bg: 'bg-pink-500/10',
    text: 'text-pink-600 dark:text-pink-400',
    icon: <Radio className="w-3.5 h-3.5" />,
    key: 'aiHistory.waterfall.mode.toProactive',
  },
};

function kindIcon(sp: TraceSpan) {
  switch (sp.kind) {
    case 'run':
      return <Play className="w-3.5 h-3.5" />;
    case 'chat':
      return <MessageSquare className="w-3.5 h-3.5" />;
    case 'tool':
      return <Wrench className="w-3.5 h-3.5" />;
    case 'subagent':
      return sp.agentData?.agent_type === 'proactive_generator' ? (
        <Sparkles className="w-3.5 h-3.5" />
      ) : (
        <Bot className="w-3.5 h-3.5" />
      );
    case 'user':
      return <User className="w-3.5 h-3.5" />;
    case 'result':
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'proactive':
      return <Radio className="w-3.5 h-3.5" />;
    case 'event':
      return sp.isError ? <AlertTriangle className="w-3.5 h-3.5" /> : <Scissors className="w-3.5 h-3.5" />;
    case 'system':
      return <Shield className="w-3.5 h-3.5" />;
    default: {
      // generic：按 entry 类型细分（thinking / text_output 用不同图标，避免全是灯泡）
      const et = sp.entry?.type;
      if (et === 'text_output') return <AlignLeft className="w-3.5 h-3.5" />;
      return <Lightbulb className="w-3.5 h-3.5" />;
    }
  }
}

// span 主题色（图标色 icon + 标签文字色 text + 甘特条色 bar），亮/暗两套都可读。
// text 与 icon 同色系但更深/更浅一档，保证长标签在正文里仍清晰、又能一眼区分类型。
function kindColor(sp: TraceSpan): { icon: string; bar: string; text: string } {
  if (sp.isError) return { icon: 'text-red-500', bar: 'bg-red-400/70', text: 'text-red-600 dark:text-red-400' };
  switch (sp.kind) {
    case 'run':
      return { icon: 'text-primary', bar: 'bg-primary/60', text: 'text-foreground' };
    case 'chat':
      return { icon: 'text-sky-500', bar: 'bg-sky-400/70', text: 'text-sky-700 dark:text-sky-300' };
    case 'tool':
      return { icon: 'text-amber-500', bar: 'bg-amber-400/70', text: 'text-amber-700 dark:text-amber-300' };
    case 'subagent':
      // 主动消息的生成子 Agent 用 proactive 同色系（粉），与普通子 Agent（紫）区分
      if (sp.agentData?.agent_type === 'proactive_generator')
        return { icon: 'text-pink-500', bar: 'bg-pink-400/70', text: 'text-pink-700 dark:text-pink-300' };
      return { icon: 'text-violet-500', bar: 'bg-violet-400/70', text: 'text-violet-700 dark:text-violet-300' };
    case 'user':
      return { icon: 'text-blue-500', bar: 'bg-blue-400/60', text: 'text-blue-700 dark:text-blue-300' };
    case 'result':
      return { icon: 'text-emerald-500', bar: 'bg-emerald-400/70', text: 'text-emerald-700 dark:text-emerald-300' };
    case 'proactive':
      return { icon: 'text-pink-500', bar: 'bg-pink-400/70', text: 'text-pink-700 dark:text-pink-300' };
    case 'generic': {
      // thinking / text_output 各给一套可辨识的低饱和色，其余 generic 保持中性灰
      const et = sp.entry?.type;
      if (et === 'thinking')
        return { icon: 'text-indigo-400', bar: 'bg-indigo-400/60', text: 'text-indigo-600 dark:text-indigo-300' };
      if (et === 'text_output')
        return { icon: 'text-teal-500', bar: 'bg-teal-400/60', text: 'text-teal-700 dark:text-teal-300' };
      return { icon: 'text-muted-foreground', bar: 'bg-muted-foreground/40', text: 'text-muted-foreground' };
    }
    default:
      // system（生命周期 / system_prompt / tools_list）：中性但比正文淡一档
      return { icon: 'text-muted-foreground', bar: 'bg-muted-foreground/40', text: 'text-foreground/70' };
  }
}

function spanLabel(sp: TraceSpan, t: TFunc): string {
  switch (sp.kind) {
    case 'run':
      return t('aiHistory.waterfall.agentRun');
    case 'chat':
      // 模型名不并入标签（由行内独立的 model 芯片展示），保持标签短而可扫读
      return t('aiHistory.waterfall.chat');
    case 'tool':
      return sp.toolName || t('aiHistory.waterfall.tool');
    case 'subagent':
      if (sp.agentData?.agent_type === 'proactive_generator') {
        // 主动消息的决策/生成子 Agent：标为「生成过程」，点开即这条主动发言的思考轨迹
        return asStr(sp.agentData?.persona_name)
          ? `${t('aiHistory.waterfall.proactiveGenerator')} · ${asStr(sp.agentData?.persona_name)}`
          : t('aiHistory.waterfall.proactiveGenerator');
      }
      return asStr(sp.agentData?.persona_name) || t('aiHistory.waterfall.subAgent');
    case 'user':
      return t('aiHistory.waterfall.userInput');
    case 'result':
      return t('aiHistory.waterfall.result');
    case 'proactive':
      return t('aiHistory.waterfall.proactive');
    case 'event':
      if (sp.isError) return asStr(sp.entry?.data?.error_type) || t('aiHistory.entryType.error');
      if (sp.resetReason) return t(RESET_STYLE[sp.resetReason]?.key || 'aiHistory.waterfall.reset.title');
      return sp.entry?.type || '';
    case 'system': {
      const et = sp.entry?.type || '';
      const map: Record<string, string> = {
        system_prompt: 'aiHistory.entryType.systemPrompt',
        tools_list: 'aiHistory.entryType.toolsList',
        session_created: 'aiHistory.entryType.sessionCreated',
        session_resumed: 'aiHistory.entryType.sessionResumed',
        session_ended: 'aiHistory.entryType.sessionEnded',
      };
      return map[et] ? t(map[et]) : et;
    }
    default: {
      // generic：thinking / text_output 等散落行也走 i18n，避免直接显示英文原始类型
      const et = sp.entry?.type || '';
      const map: Record<string, string> = {
        thinking: 'aiHistory.entryType.thinking',
        text_output: 'aiHistory.entryType.textOutput',
        token_usage: 'aiHistory.entryType.tokenUsage',
        node_transition: 'aiHistory.entryType.nodeTransition',
      };
      return map[et] ? t(map[et]) : et;
    }
  }
}

// 用户输入整段 prompt 很长（说话人标注 / 记忆 / 口吻…），缩略时只取「--- 消息 ---」后的
// 真正用户正文那一行，避免行上灰字从「[用户发言]…」起截到 200 字却看不到说了什么。
// 仅影响 spanPreview；展开面板仍展示完整 content。
const USER_MESSAGE_BODY_RE = /---\s*消息\s*---\s*\r?\n([^\r\n]+)/;
function userInputPreview(raw: string): string {
  const m = raw.match(USER_MESSAGE_BODY_RE);
  const body = m?.[1]?.trim();
  return body || raw;
}

// 行内单行内容预览：不展开也能扫读「用户说了什么 / AI 回了什么 / 工具传了什么」。
// 展开后行下方会有完整内容面板，预览随之隐藏（避免同屏重复）。
function spanPreview(sp: TraceSpan): string {
  const e = sp.entry;
  if (!e) return '';
  const d = (e.data || {}) as Record<string, unknown>;
  let s = '';
  switch (e.type) {
    case 'tool_call':
      s = asStr(d.args);
      break;
    case 'tool_return':
      s = asStr(d.content);
      break;
    case 'thinking':
    case 'text_output':
    case 'system_prompt':
    case 'proactive_emission':
      s = asStr(d.content);
      break;
    case 'user_input':
      s = userInputPreview(asStr(d.content) || asStr(d.user_message));
      break;
    case 'result':
      s = asStr(d.output);
      break;
    case 'error':
      s = asStr(d.message) || asStr(d.error_type);
      break;
    case 'tools_list': {
      const tools = Array.isArray(d.tools) ? (d.tools as string[]) : [];
      s = tools.join(' · ');
      break;
    }
    default:
      s = '';
  }
  return s.replace(/\s+/g, ' ').trim().slice(0, 200);
}

// span 是否可展开（有子 span、有附属内容、或有可读主内容）
function spanExpandable(sp: TraceSpan): boolean {
  if (sp.children.length > 0) return true;
  if (sp.contentEntries && sp.contentEntries.length > 0) return true;
  if (sp.kind === 'subagent') return true;
  const et = sp.entry?.type;
  if (!et) return false;
  const d = (sp.entry?.data || {}) as Record<string, unknown>;
  if (et === 'user_input' || et === 'text_output') return !!(d.content || d.output);
  if (et === 'system_prompt' || et === 'thinking' || et === 'proactive_emission') return !!d.content;
  if (et === 'result') return !!d.output;
  if (et === 'error') return !!(d.message || d.error_type);
  if (et === 'history_reset') return true;
  if (et === 'tools_list') return Array.isArray(d.tools) && (d.tools as unknown[]).length > 0;
  if (et === 'tool_call' || et === 'tool_return') return true;
  return false;
}

// 展开后的内容面板（把该 span 的主 entry + 附属 entries 逐条渲染）
function SpanContent({ sp, t }: { sp: TraceSpan; t: TFunc }) {
  const parts: SessionLogEntry[] = [];
  if (sp.entry) parts.push(sp.entry);
  for (const ce of sp.contentEntries || []) parts.push(ce);
  if (parts.length === 0) return null;
  // 单 entry 的 span（如 thinking / system_prompt）：所在行的标签已说明类型，内部小标题会重复冗余
  // → 隐藏；多 entry 的 span（tool 的 call+return）才保留小标题以区分。
  const showLabel = parts.length > 1;
  return (
    <div className="min-w-0 max-w-full space-y-2">
      {parts.map((e, i) => (
        <EntryBlock key={i} entry={e} t={t} showLabel={showLabel} />
      ))}
    </div>
  );
}

// 长无空格串（URL / base64 / JSON）必须在容器宽度内硬换行，避免撑破瀑布布局
const WRAP_TEXT = 'min-w-0 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]';
const CODE_BLOCK = cn(
  'text-xs bg-muted/50 rounded-md p-2 font-mono',
  WRAP_TEXT,
);
const PLAIN_BLOCK = cn('text-sm font-sans leading-relaxed', WRAP_TEXT);

function EntryBlock({ entry, t, showLabel = true }: { entry: SessionLogEntry; t: TFunc; showLabel?: boolean }) {
  const d = (entry.data || {}) as Record<string, unknown>;
  const toolInfo = useContext(ToolInfoContext);
  const label = (key: string) =>
    showLabel ? <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1">{t(key)}</div> : null;

  if (entry.type === 'tool_call') {
    return (
      <div className="min-w-0 max-w-full">
        {label('aiHistory.entryType.toolCall')}
        <pre className={CODE_BLOCK}>{asStr(d.args)}</pre>
      </div>
    );
  }
  if (entry.type === 'tool_return') {
    return (
      <div className="min-w-0 max-w-full">
        {label('aiHistory.entryType.toolReturn')}
        <pre className={CODE_BLOCK}>{asStr(d.content)}</pre>
      </div>
    );
  }
  if (entry.type === 'thinking') {
    return (
      <div className="min-w-0 max-w-full">
        {label('aiHistory.entryType.thinking')}
        <pre className={cn(CODE_BLOCK, 'italic text-muted-foreground max-h-64 overflow-y-auto')}>
          {asStr(d.content)}
        </pre>
      </div>
    );
  }
  if (entry.type === 'system_prompt') {
    return (
      <div className="min-w-0 max-w-full">
        {label('aiHistory.entryType.systemPrompt')}
        <pre className={cn(CODE_BLOCK, 'max-h-64 overflow-y-auto')}>{asStr(d.content)}</pre>
      </div>
    );
  }
  if (entry.type === 'token_usage') {
    return null; // token 已作徽章展示，内容面板不重复
  }
  if (entry.type === 'error') {
    return (
      <div className="min-w-0 max-w-full">
        <p className={cn('text-sm font-medium text-red-500', WRAP_TEXT)}>{asStr(d.error_type)}</p>
        <p className={cn('text-sm text-red-500/80', WRAP_TEXT)}>{asStr(d.message)}</p>
      </div>
    );
  }
  if (entry.type === 'tools_list') {
    const tools = Array.isArray(d.tools) ? (d.tools as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1 min-w-0 max-w-full">
        {tools.map((tool, i) => {
          const info = toolInfo[tool];
          const meta = [info?.plugin, info?.category].filter(Boolean).join(' · ');
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span className="inline-flex max-w-full items-center gap-1 cursor-help text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50 hover:bg-accent hover:text-foreground transition-colors [overflow-wrap:anywhere]">
                  <Wrench className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  <span className="min-w-0 break-all">{tool}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-xs font-mono font-medium break-all">{tool}</p>
                {info?.description ? (
                  <p className={cn('mt-1 text-xs text-muted-foreground', WRAP_TEXT)}>{info.description}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground/70 italic">{t('aiHistory.waterfall.toolNoInfo')}</p>
                )}
                {meta && <p className="mt-1 text-[10px] text-muted-foreground/70 break-all">{meta}</p>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }
  if (entry.type === 'history_reset') {
    const reason = asStr(d.reason);
    const before = d.before as number | undefined;
    const after = d.after as number | undefined;
    return (
      <div className="text-xs text-muted-foreground space-y-0.5 min-w-0 max-w-full">
        <div className={WRAP_TEXT}>{t(RESET_STYLE[reason]?.key || 'aiHistory.waterfall.reset.title')}</div>
        {typeof before === 'number' && typeof after === 'number' && (
          <div className="font-mono">{before} → {after}</div>
        )}
        {typeof d.persona_name === 'string' && (
          <div className={cn('font-mono', WRAP_TEXT)}>→ {d.persona_name}</div>
        )}
      </div>
    );
  }
  if (entry.type === 'proactive_emission') {
    // 主动消息：标出来源(heartbeat/scheduled/kanban/tool) 与触发原因，再显示正文，
    // 让它与「被动回复」在展开态也一眼可辨（对应控制台里主动/被动的显示差别）。
    const source = asStr(d.source);
    const trigger = asStr(d.trigger_reason);
    return (
      <div className="space-y-1.5 min-w-0 max-w-full">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/30">
            <Radio className="w-2.5 h-2.5" />
            {t('aiHistory.waterfall.proactive')}
            {source && <span className="font-mono opacity-80 break-all">· {source}</span>}
          </span>
        </div>
        {trigger && (
          // 起因（触发原因）：整段换行展示，别一行截断——它是「AI 为什么此刻主动发言」的关键
          <div className={cn('text-xs text-muted-foreground', WRAP_TEXT)}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mr-1">
              {t('aiHistory.waterfall.triggerReason')}
            </span>
            {trigger}
          </div>
        )}
        {asStr(d.content) && <pre className={PLAIN_BLOCK}>{asStr(d.content)}</pre>}
      </div>
    );
  }
  // user_input / text_output / result → 纯文本
  const content = asStr(d.content) || asStr(d.output) || asStr(d.user_message);
  if (!content) return null;
  return <pre className={PLAIN_BLOCK}>{content}</pre>;
}

// token 徽章（chat：↗in ↙out；run：Σ 合计）
function TokenBadges({ sp }: { sp: TraceSpan }) {
  const inTok = sp.kind === 'run' ? sp.sumTokensIn : sp.tokensIn;
  const outTok = sp.kind === 'run' ? sp.sumTokensOut : sp.tokensOut;
  if (!inTok && !outTok) return null;
  return (
    <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/40 shrink-0">
      {sp.kind === 'run' && <span className="opacity-70">Σ</span>}
      <span className="text-sky-500">↗{formatTokens(inTok || 0)}</span>
      <span className="text-emerald-500">↙{formatTokens(outTok || 0)}</span>
    </span>
  );
}

// ============================================================================
// 行渲染（块内：树行 + 局部时间轴）
// ============================================================================

// 一个块内所有行共享的上下文：局部时间窗（甘特条相对块起点定位）+ 展开态 + 子 Agent 懒加载
interface RowCtx {
  windowStart: number;
  windowSpan: number;
  showTimeline: boolean;
  expanded: Set<string>;
  toggle: (id: string) => void;
  t: TFunc;
  loadSubAgent?: (agentData: Record<string, unknown>) => Promise<SessionLogEntry[] | null>;
  subCache: Record<string, SessionLogEntry[] | 'loading' | 'error'>;
  requestSub: (id: string, agentData: Record<string, unknown>) => void;
}

type RowBase = Omit<RowCtx, 'windowStart' | 'windowSpan' | 'showTimeline'>;

// 局部时间轴单元格：条的位置/宽度相对所在块的时间窗，hover 显示墙钟时刻 + 相对偏移 + 时长
function TimelineCell({ sp, ctx, strong }: { sp: TraceSpan; ctx: RowCtx; strong?: boolean }) {
  if (!ctx.showTimeline) return null;
  const dur = sp.end - sp.start;
  const rawLeft = ctx.windowSpan > 0 ? ((sp.start - ctx.windowStart) / ctx.windowSpan) * 100 : 0;
  const leftPct = Math.min(Math.max(rawLeft, 0), 98.5);
  const rawWidth = ctx.windowSpan > 0 ? (dur / ctx.windowSpan) * 100 : 0;
  const widthPct = Math.min(Math.max(rawWidth, 1.5), 100 - leftPct);
  const offset = sp.start - ctx.windowStart;
  const color = kindColor(sp);
  return (
    <div
      className="hidden md:block relative h-5 w-40 lg:w-56 xl:w-72 shrink-0"
      title={`${formatTimeOnly(sp.start)} · +${formatDuration(offset) || '0ms'}${dur > 0 ? ` · ${formatDuration(dur)}` : ''}`}
    >
      {/* 四分位参考线：给"条在窗口内的位置"提供刻度感 */}
      {[25, 50, 75].map((p) => (
        <span key={p} aria-hidden className="absolute inset-y-1 w-px bg-border/50" style={{ left: `${p}%` }} />
      ))}
      <span
        className={cn('absolute top-1/2 -translate-y-1/2 rounded-full', strong ? 'h-2' : 'h-[5px]', color.bar)}
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      />
    </div>
  );
}

function SpanRow({ sp, depth, ctx }: { sp: TraceSpan; depth: number; ctx: RowCtx }) {
  const { expanded, toggle, t, subCache, requestSub, loadSubAgent } = ctx;
  const isOpen = expanded.has(sp.id);
  const expandable = spanExpandable(sp);
  const color = kindColor(sp);
  const dur = sp.end - sp.start;
  const childCount = sp.children.length;
  // 展开后完整内容就在行下方，预览隐藏避免重复
  const preview = isOpen ? '' : spanPreview(sp);

  const handleClick = () => {
    if (!expandable) return;
    toggle(sp.id);
    if (sp.kind === 'subagent' && sp.agentData && !subCache[sp.id]) {
      requestSub(sp.id, sp.agentData);
    }
  };

  const subState = sp.kind === 'subagent' ? subCache[sp.id] : undefined;

  return (
    <Fragment>
      <div
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (expandable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick();
          }
        }}
        className={cn(
          'relative group flex items-center gap-2 py-1 rounded-md',
          expandable && 'cursor-pointer hover:bg-accent/50',
        )}
      >
        {/* 层级竖线：每个祖先层一条浅色竖线贯穿全行，直观标出缩进层级 */}
        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-border/70 dark:bg-border"
            style={{ left: RAIL_LEFT + i * INDENT }}
          />
        ))}

        {/* 墙钟时间：每行发生时刻（局部时间轴表达相对位置，这里补绝对时间） */}
        <span className="w-16 shrink-0 text-[11px] text-muted-foreground/50 font-mono tabular-nums">
          {formatTimeOnly(sp.start)}
        </span>

        {/* 缩进 + 展开控件 + 图标 + 标签 + 预览 */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1" style={{ paddingLeft: depth * INDENT }}>
          <span className="w-4 shrink-0 flex items-center justify-center text-muted-foreground/50">
            {expandable ? (
              isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            )}
          </span>
          <span className={cn('shrink-0', color.icon)}>{kindIcon(sp)}</span>
          <span className={cn('shrink-0 truncate max-w-[45%] text-sm font-semibold', color.text)}>
            {spanLabel(sp, t)}
          </span>
          {childCount > 0 && (
            <span className="shrink-0 text-[10px] font-mono px-1 rounded bg-primary/10 text-primary">{childCount}</span>
          )}
          {sp.kind === 'chat' && sp.model && (
            <span className="hidden lg:inline-block shrink-0 max-w-44 truncate text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted/70 text-muted-foreground border border-border/40">
              {sp.model}
            </span>
          )}
          {preview && (
            <span className="flex-1 min-w-0 truncate text-xs text-muted-foreground/60">{preview}</span>
          )}
          <span className="ml-auto shrink-0">
            <TokenBadges sp={sp} />
          </span>
        </div>

        {/* 局部时间轴（相对所在 run 块的时间窗） */}
        <TimelineCell sp={sp} ctx={ctx} />

        {/* 时长 */}
        <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground/70 font-mono tabular-nums">
          {dur > 0 ? formatDuration(dur) : ''}
        </span>
      </div>

      {/* 展开：内容面板 + 子 span */}
      {isOpen && expandable && (
        <div>
          {(sp.entry || (sp.contentEntries && sp.contentEntries.length > 0)) && (
            <div
              // marginLeft 缩进后宽度必须扣掉缩进，否则 max-w-full 仍按父宽 100% 计算，总宽会溢出
              style={{
                marginLeft: TIME_COL + depth * INDENT + 22,
                maxWidth: `calc(100% - ${TIME_COL + depth * INDENT + 22}px - 0.25rem)`,
              }}
              className="mr-1 my-1 min-w-0 overflow-hidden rounded-lg border border-border/30 bg-muted/30 p-2.5"
            >
              <SpanContent sp={sp} t={t} />
            </div>
          )}

          {/* 子 span */}
          {sp.children.map((c) => (
            <SpanRow key={c.id} sp={c} depth={depth + 1} ctx={ctx} />
          ))}

          {/* subagent 子 trace */}
          {sp.kind === 'subagent' && (
            <div
              style={{
                marginLeft: TIME_COL + depth * INDENT + 22,
                maxWidth: `calc(100% - ${TIME_COL + depth * INDENT + 22}px - 0.25rem)`,
              }}
              className="mr-1 my-1 min-w-0"
            >
              {subState === 'loading' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('aiHistory.waterfall.loadingSubAgent')}
                </div>
              )}
              {subState === 'error' && (
                <div className="text-xs text-red-500 py-2">{t('aiHistory.loadDetailFailed')}</div>
              )}
              {Array.isArray(subState) && subState.length > 0 && loadSubAgent && (
                <div>
                  <TraceWaterfallInner entries={subState} t={t} loadSubAgent={loadSubAgent} />
                </div>
              )}
              {Array.isArray(subState) && subState.length === 0 && (
                <div className="text-xs text-muted-foreground py-2">{t('aiHistory.noEntries')}</div>
              )}
            </div>
          )}
        </div>
      )}
    </Fragment>
  );
}

// ============================================================================
// 块渲染：run 卡片 / 主动发言卡片 / 各类分隔条 / 散落行卡片
// ============================================================================

// 一次 Agent 运行 = 一段可折叠块：头部是主题色浅底着色条带（醒目、不靠边框盒子 / 左竖线）。
// 头部：起始墙钟 + 模型 + Σtoken + 全宽主条 + 总时长；
// 内部行的甘特条都相对本 run 的时间窗定位——这正是 logfire 里"单个 trace"的尺度。
function RunBlock({ sp, base }: { sp: TraceSpan; base: RowBase }) {
  const { expanded, toggle, t } = base;
  const isOpen = expanded.has(sp.id);
  const ctx: RowCtx = { ...base, windowStart: sp.start, windowSpan: Math.max(sp.end - sp.start, 0.001), showTimeline: true };
  const dur = sp.end - sp.start;
  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => toggle(sp.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle(sp.id);
          }
        }}
        className="flex items-center gap-2 rounded-lg bg-primary/5 hover:bg-primary/10 px-2.5 py-1.5 cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="w-4 shrink-0 flex items-center justify-center text-muted-foreground/50">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <Play className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-sm font-bold truncate">{t('aiHistory.waterfall.agentRun')}</span>
          {sp.children.length > 0 && (
            <span className="shrink-0 text-[10px] font-mono px-1 rounded bg-primary/10 text-primary">
              {sp.children.length}
            </span>
          )}
          {sp.model && (
            <span className="hidden lg:inline-block shrink-0 max-w-44 truncate text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-muted/70 text-muted-foreground border border-border/40">
              {sp.model}
            </span>
          )}
          <TokenBadges sp={sp} />
          <span className="ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground/60 font-mono tabular-nums">
            {formatTimeOnly(sp.start)}
          </span>
        </div>
        <TimelineCell sp={sp} ctx={ctx} strong />
        <span className="w-14 shrink-0 text-right text-xs font-medium text-foreground/80 font-mono tabular-nums">
          {dur > 0 ? formatDuration(dur) : ''}
        </span>
      </div>
      {isOpen && sp.children.length > 0 && (
        <div className="mt-1 min-w-0 max-w-full">
          {sp.children.map((c) => (
            <SpanRow key={c.id} sp={c} depth={0} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}

// 主动发言：AI 主动产出的消息本体，直接完整展示（来源 + 触发原因 + 正文），不需要点开。
// 与 run 块同构：粉色浅底着色条带头 + 下方内容体（无左竖线）。
function ProactiveBlock({ sp, t }: { sp: TraceSpan; t: TFunc }) {
  const d = (sp.entry?.data || {}) as Record<string, unknown>;
  const source = asStr(d.source);
  const trigger = asStr(d.trigger_reason);
  const content = asStr(d.content);
  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg bg-pink-500/[0.06] px-2.5 py-1.5">
        <Radio className="w-3.5 h-3.5 text-pink-500 shrink-0" />
        <span className="text-sm font-bold text-pink-700 dark:text-pink-300">
          {t('aiHistory.waterfall.proactive')}
        </span>
        {source && (
          <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/30">
            {source}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/60 font-mono tabular-nums">
          {formatTimeOnly(sp.start)}
        </span>
      </div>
      <div className="mt-1 min-w-0 max-w-full py-0.5 space-y-1.5">
        {trigger && (
          <div className={cn('text-xs text-muted-foreground', WRAP_TEXT)}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mr-1">
              {t('aiHistory.waterfall.triggerReason')}
            </span>
            {trigger}
          </div>
        )}
        {content && <pre className={PLAIN_BLOCK}>{content}</pre>}
      </div>
    </div>
  );
}

// 历史重置分隔条（清空 / 人格切换 / 压缩）：全宽醒目色条 + 时刻
function ResetDivider({ sp, t }: { sp: TraceSpan; t: TFunc }) {
  const style = RESET_STYLE[sp.resetReason || 'auto_compact'] || RESET_STYLE.auto_compact;
  const d = (sp.entry?.data || {}) as Record<string, unknown>;
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium', style.border, style.bg, style.text)}>
      {style.icon}
      <span>{t(style.key)}</span>
      {typeof d.before === 'number' && typeof d.after === 'number' && (
        <span className="font-mono opacity-70">
          {d.before} → {d.after}
        </span>
      )}
      {typeof d.persona_name === 'string' && <span className="font-mono opacity-70">→ {d.persona_name}</span>}
      <span className="ml-auto font-mono opacity-50 tabular-nums">{formatTimeOnly(sp.start)}</span>
    </div>
  );
}

// 交互模式切换分隔条：主动发言 ↔ 被动聊天 边界的居中 tag（带时刻）
function ModeDivider({ sp, t }: { sp: TraceSpan; t: TFunc }) {
  const style = MODE_STYLE[sp.modeChange || 'to_reactive'];
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={cn('h-px flex-1 border-t border-dashed', style.border)} />
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium shrink-0',
          style.border,
          style.bg,
          style.text,
        )}
      >
        {style.icon}
        {t(style.key)}
        <span className="font-mono opacity-60 tabular-nums">{formatTimeOnly(sp.start)}</span>
      </span>
      <span className={cn('h-px flex-1 border-t border-dashed', style.border)} />
    </div>
  );
}

// 会话生命周期（创建/续写/结束）：极轻量的居中分隔文本
function LifecycleDivider({ sp, t }: { sp: TraceSpan; t: TFunc }) {
  const et = sp.entry?.type || '';
  const map: Record<string, string> = {
    session_created: 'aiHistory.entryType.sessionCreated',
    session_resumed: 'aiHistory.entryType.sessionResumed',
    session_ended: 'aiHistory.entryType.sessionEnded',
  };
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-px flex-1 bg-border/50" />
      <span className="shrink-0 text-[10px] text-muted-foreground/60 font-medium tabular-nums">
        {map[et] ? t(map[et]) : et} · {formatTimeOnly(sp.start)}
      </span>
      <span className="h-px flex-1 bg-border/50" />
    </div>
  );
}

// 散落在 run 之外的顶层行（system_prompt / 无 run 包裹的残留 entry）：直接平铺为行，
// 不加盒子。这类行彼此间没有有意义的时间跨度，不画时间轴。
function LooseBlock({ spans, base }: { spans: TraceSpan[]; base: RowBase }) {
  const lo = Math.min(...spans.map((s) => s.start));
  const hi = Math.max(...spans.map((s) => s.end));
  const ctx: RowCtx = { ...base, windowStart: lo, windowSpan: Math.max(hi - lo, 0.001), showTimeline: false };
  return (
    <div>
      {spans.map((sp) => (
        <SpanRow key={sp.id} sp={sp} depth={0} ctx={ctx} />
      ))}
    </div>
  );
}

// ============================================================================
// 组件
// ============================================================================

interface TraceWaterfallProps {
  entries: SessionLogEntry[];
  t: TFunc;
  loadSubAgent?: (agentData: Record<string, unknown>) => Promise<SessionLogEntry[] | null>;
}

// 供页面头部的「全部展开 / 全部收起」按钮调用（控件常驻详情头部，不随内容滚走）
export interface TraceWaterfallHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

const TraceWaterfallInner = forwardRef<TraceWaterfallHandle, TraceWaterfallProps>(function TraceWaterfallInner(
  { entries, t, loadSubAgent },
  ref,
) {
  const roots = useMemo(() => buildTrace(entries), [entries]);
  const blocks = useMemo(() => groupBlocks(roots), [roots]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [subCache, setSubCache] = useState<Record<string, SessionLogEntry[] | 'loading' | 'error'>>({});

  // 数据变化时默认展开：容器 run/chat（用于抵达文本输出）+ 每条「文本输出(text_output)」自身，
  // 让 AI 的文本回复一进来就完整可读；思考(thinking)/工具/系统等其余节点保持折叠（仅显示为行，不展开内容）。
  // 子 Agent（subagent）不自动展开——其 trace 是点击时才懒加载的，避免一次性打一堆请求。
  useEffect(() => {
    const ids = new Set<string>();
    const walk = (sp: TraceSpan) => {
      if (sp.kind === 'run' || sp.kind === 'chat') ids.add(sp.id);
      if (sp.kind === 'generic' && sp.entry?.type === 'text_output') ids.add(sp.id);
      sp.children.forEach(walk);
    };
    roots.forEach(walk);
    setExpanded(ids);
  }, [roots]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const requestSub = useCallback(
    (id: string, agentData: Record<string, unknown>) => {
      if (!loadSubAgent) return;
      setSubCache((prev) => ({ ...prev, [id]: 'loading' }));
      loadSubAgent(agentData)
        .then((res) => setSubCache((prev) => ({ ...prev, [id]: res ?? [] })))
        .catch(() => setSubCache((prev) => ({ ...prev, [id]: 'error' })));
    },
    [loadSubAgent],
  );

  // 全部展开：除 subagent 外的所有可展开节点（subagent 的子 trace 是点击时才懒加载的，
  // 批量展开会一次性打一堆请求且面板为空，故跳过）。全部收起 = 只留 run 卡片头，一行一次运行，
  // 正好是整个会话的时间线总览。
  const expandAll = useCallback(() => {
    const ids = new Set<string>();
    const walk = (sp: TraceSpan) => {
      if (sp.kind !== 'subagent' && (sp.kind === 'run' || spanExpandable(sp))) ids.add(sp.id);
      sp.children.forEach(walk);
    };
    roots.forEach(walk);
    setExpanded(ids);
  }, [roots]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  useImperativeHandle(ref, () => ({ expandAll, collapseAll }), [expandAll, collapseAll]);

  if (roots.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3">
      {blocks.map((b) => {
        if (b.type === 'run')
          return <RunBlock key={b.key} sp={b.sp} base={{ expanded, toggle, t, loadSubAgent, subCache, requestSub }} />;
        if (b.type === 'proactive') return <ProactiveBlock key={b.key} sp={b.sp} t={t} />;
        if (b.type === 'reset') return <ResetDivider key={b.key} sp={b.sp} t={t} />;
        if (b.type === 'mode') return <ModeDivider key={b.key} sp={b.sp} t={t} />;
        if (b.type === 'lifecycle') return <LifecycleDivider key={b.key} sp={b.sp} t={t} />;
        // 显式收窄到 'loose'，避免联合类型上访问 spans 报错
        if (b.type === 'loose') {
          return (
            <LooseBlock
              key={b.key}
              spans={b.spans}
              base={{ expanded, toggle, t, loadSubAgent, subCache, requestSub }}
            />
          );
        }
        return null;
      })}
    </div>
  );
});

const TraceWaterfall = forwardRef<TraceWaterfallHandle, TraceWaterfallProps>(function TraceWaterfall(props, ref) {
  // 顶层拉一次全量工具元数据（含子 Agent 的嵌套瀑布：其 TraceWaterfallInner 在本 Provider 之内，
  // 共用同一份 map，不重复请求）。失败静默——tooltip 退化为只显工具名。
  const [toolInfo, setToolInfo] = useState<Record<string, AITool>>({});
  useEffect(() => {
    let cancelled = false;
    aiToolsApi
      .getToolsList()
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, AITool> = {};
        for (const item of res?.tools || []) map[item.name] = item;
        setToolInfo(map);
      })
      .catch(() => {
        /* 工具信息拉取失败不影响瀑布渲染 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ToolInfoContext.Provider value={toolInfo}>
      <TooltipProvider delayDuration={150}>
        <TraceWaterfallInner {...props} ref={ref} />
      </TooltipProvider>
    </ToolInfoContext.Provider>
  );
});

export default TraceWaterfall;
