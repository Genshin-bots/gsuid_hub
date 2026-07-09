import { useMemo, useState, useCallback, useEffect, createContext, useContext, Fragment } from 'react';
import { cn } from '@/lib/utils';
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
  CornerDownRight,
  AlignLeft,
} from 'lucide-react';

// 工具名 → 元数据（description/plugin/category）。由顶层 TraceWaterfall 拉一次 /api/ai/tools/list
// 注入，供 tools_list 芯片 hover 弹 tooltip 展示工具基本信息；拉取失败则为空、tooltip 退化只显名字。
const ToolInfoContext = createContext<Record<string, AITool>>({});

// 行缩进步长（须与下方 paddingLeft: depth*INDENT / marginLeft 对齐）
const INDENT = 14;
// 首层层级竖线的水平位置：时间列 64 + gap 8 + 图标半宽 ~8
const RAIL_LEFT = 80;

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
        if (asStr(d.agent_type) !== 'sub_agent') break; // 仅可见 sub_agent
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

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(2)}K`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
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
      return <Bot className="w-3.5 h-3.5" />;
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
      return sp.model ? `${t('aiHistory.waterfall.chat')} ${sp.model}` : t('aiHistory.waterfall.chat');
    case 'tool':
      return sp.toolName || t('aiHistory.waterfall.tool');
    case 'subagent':
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
    <div className="space-y-2">
      {parts.map((e, i) => (
        <EntryBlock key={i} entry={e} t={t} showLabel={showLabel} />
      ))}
    </div>
  );
}

function EntryBlock({ entry, t, showLabel = true }: { entry: SessionLogEntry; t: TFunc; showLabel?: boolean }) {
  const d = (entry.data || {}) as Record<string, unknown>;
  const toolInfo = useContext(ToolInfoContext);
  const label = (key: string) =>
    showLabel ? <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1">{t(key)}</div> : null;

  if (entry.type === 'tool_call') {
    return (
      <div>
        {label('aiHistory.entryType.toolCall')}
        <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto font-mono whitespace-pre-wrap [overflow-wrap:anywhere]">
          {asStr(d.args)}
        </pre>
      </div>
    );
  }
  if (entry.type === 'tool_return') {
    return (
      <div>
        {label('aiHistory.entryType.toolReturn')}
        <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto font-mono whitespace-pre-wrap [overflow-wrap:anywhere]">
          {asStr(d.content)}
        </pre>
      </div>
    );
  }
  if (entry.type === 'thinking') {
    return (
      <div>
        {label('aiHistory.entryType.thinking')}
        <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap font-mono italic text-muted-foreground max-h-64 overflow-y-auto">
          {asStr(d.content)}
        </pre>
      </div>
    );
  }
  if (entry.type === 'system_prompt') {
    return (
      <div>
        {label('aiHistory.entryType.systemPrompt')}
        <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
          {asStr(d.content)}
        </pre>
      </div>
    );
  }
  if (entry.type === 'token_usage') {
    return null; // token 已作徽章展示，内容面板不重复
  }
  if (entry.type === 'error') {
    return (
      <div>
        <p className="text-sm font-medium text-red-500">{asStr(d.error_type)}</p>
        <p className="text-sm text-red-500/80 whitespace-pre-wrap">{asStr(d.message)}</p>
      </div>
    );
  }
  if (entry.type === 'tools_list') {
    const tools = Array.isArray(d.tools) ? (d.tools as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1">
        {tools.map((tool, i) => {
          const info = toolInfo[tool];
          const meta = [info?.plugin, info?.category].filter(Boolean).join(' · ');
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 cursor-help text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50 hover:bg-accent hover:text-foreground transition-colors">
                  <Wrench className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  {tool}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-xs font-mono font-medium">{tool}</p>
                {info?.description ? (
                  <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{info.description}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground/70 italic">{t('aiHistory.waterfall.toolNoInfo')}</p>
                )}
                {meta && <p className="mt-1 text-[10px] text-muted-foreground/70">{meta}</p>}
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
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div>{t(RESET_STYLE[reason]?.key || 'aiHistory.waterfall.reset.title')}</div>
        {typeof before === 'number' && typeof after === 'number' && (
          <div className="font-mono">{before} → {after}</div>
        )}
        {typeof d.persona_name === 'string' && <div className="font-mono">→ {d.persona_name}</div>}
      </div>
    );
  }
  if (entry.type === 'proactive_emission') {
    // 主动消息：标出来源(heartbeat/scheduled/kanban/tool) 与触发原因，再显示正文，
    // 让它与「被动回复」在展开态也一眼可辨（对应控制台里主动/被动的显示差别）。
    const source = asStr(d.source);
    const trigger = asStr(d.trigger_reason);
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/30">
            <Radio className="w-2.5 h-2.5" />
            {t('aiHistory.waterfall.proactive')}
            {source && <span className="font-mono opacity-80">· {source}</span>}
          </span>
          {trigger && <span className="text-[11px] text-muted-foreground truncate">{trigger}</span>}
        </div>
        {asStr(d.content) && (
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed break-words [overflow-wrap:anywhere]">
            {asStr(d.content)}
          </pre>
        )}
      </div>
    );
  }
  // user_input / text_output / result → 纯文本
  const content = asStr(d.content) || asStr(d.output) || asStr(d.user_message);
  if (!content) return null;
  return (
    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed break-words [overflow-wrap:anywhere]">{content}</pre>
  );
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
// 行渲染
// ============================================================================

interface RowProps {
  sp: TraceSpan;
  depth: number;
  windowStart: number;
  windowSpan: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  t: TFunc;
  loadSubAgent?: (agentData: Record<string, unknown>) => Promise<SessionLogEntry[] | null>;
  subCache: Record<string, SessionLogEntry[] | 'loading' | 'error'>;
  requestSub: (id: string, agentData: Record<string, unknown>) => void;
}

function SpanRow(props: RowProps) {
  const { sp, depth, windowStart, windowSpan, expanded, toggle, t, subCache, requestSub, loadSubAgent } = props;
  const isOpen = expanded.has(sp.id);
  const expandable = spanExpandable(sp);
  const color = kindColor(sp);
  const dur = sp.end - sp.start;
  const childCount = sp.children.length;

  // 甘特条位置（相对全局时间窗）
  const leftPct = windowSpan > 0 ? ((sp.start - windowStart) / windowSpan) * 100 : 0;
  const widthPct = windowSpan > 0 ? Math.max((dur / windowSpan) * 100, 0.6) : 0;

  // history_reset：整行渲染成醒目分隔色块
  if (sp.kind === 'event' && sp.resetReason) {
    const style = RESET_STYLE[sp.resetReason] || RESET_STYLE.auto_compact;
    return (
      <div className="flex items-stretch gap-2 py-0.5">
        <span className="w-16 shrink-0 text-[11px] text-muted-foreground/60 font-mono tabular-nums pt-1.5">
          {formatTimeOnly(sp.start)}
        </span>
        <div style={{ marginLeft: depth * INDENT }} className="flex-1 min-w-0">
          <div className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium', style.border, style.bg, style.text)}>
            {style.icon}
            <span>{t(style.key)}</span>
            {typeof sp.entry?.data?.before === 'number' && typeof sp.entry?.data?.after === 'number' && (
              <span className="font-mono opacity-70">
                {sp.entry?.data?.before as number} → {sp.entry?.data?.after as number}
              </span>
            )}
            {typeof sp.entry?.data?.persona_name === 'string' && (
              <span className="font-mono opacity-70">→ {sp.entry?.data?.persona_name as string}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 交互模式变化：主动发言 ↔ 被动聊天 的分隔 tag（居中细条，比 reset 更轻）
  if (sp.kind === 'event' && sp.modeChange) {
    const style = MODE_STYLE[sp.modeChange];
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="w-16 shrink-0 text-[11px] text-muted-foreground/60 font-mono tabular-nums">
          {formatTimeOnly(sp.start)}
        </span>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className={cn('h-px flex-1', style.border, 'border-t border-dashed')} />
          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0', style.border, style.bg, style.text)}>
            {style.icon}
            {t(style.key)}
          </span>
          <span className={cn('h-px flex-1', style.border, 'border-t border-dashed')} />
        </div>
      </div>
    );
  }

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

        {/* 时间 */}
        <span className="w-16 shrink-0 text-[11px] text-muted-foreground/60 font-mono tabular-nums">
          {formatTimeOnly(sp.start)}
        </span>

        {/* 缩进 + 展开控件 + 图标 + 标签 */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1" style={{ paddingLeft: depth * INDENT }}>
          <span className="w-4 shrink-0 flex items-center justify-center text-muted-foreground/50">
            {expandable ? (
              isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <CornerDownRight className="w-3 h-3 opacity-30" />
            )}
          </span>
          <span className={cn('shrink-0', color.icon)}>{kindIcon(sp)}</span>
          <span className={cn('truncate text-[13px]', color.text, sp.kind === 'run' ? 'font-semibold' : 'font-medium')}>
            {spanLabel(sp, t)}
          </span>
          {childCount > 0 && (
            <span className="shrink-0 text-[10px] font-mono px-1 rounded bg-primary/10 text-primary">{childCount}</span>
          )}
          {sp.kind === 'chat' && sp.model && (
            <span className="hidden lg:inline-flex shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
              pydantic-ai
            </span>
          )}
        </div>

        {/* token 徽章 */}
        <TokenBadges sp={sp} />

        {/* 甘特条 */}
        <div className="hidden sm:block w-28 lg:w-40 shrink-0 h-4 relative">
          <div className="absolute inset-y-0 inset-x-0 my-auto h-1.5 rounded-full bg-muted/40" />
          <div
            className={cn('absolute inset-y-0 my-auto h-1.5 rounded-full', color.bar)}
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          />
        </div>

        {/* 时长 */}
        <span className="w-14 shrink-0 text-right text-[11px] text-muted-foreground font-mono tabular-nums">
          {dur > 0 ? formatDuration(dur) : ''}
        </span>
      </div>

      {/* 展开：内容面板 + 子 span */}
      {isOpen && expandable && (
        <div>
          {(sp.entry || (sp.contentEntries && sp.contentEntries.length > 0)) && (
            <div style={{ marginLeft: 64 + depth * INDENT + 22 }} className="mr-2 mb-1 rounded-lg bg-muted/30 p-2.5">
              <SpanContent sp={sp} t={t} />
            </div>
          )}

          {/* 子 span */}
          {sp.children.map((c) => (
            <SpanRow key={c.id} {...props} sp={c} depth={depth + 1} />
          ))}

          {/* subagent 子 trace */}
          {sp.kind === 'subagent' && (
            <div style={{ marginLeft: 64 + depth * INDENT + 22 }} className="mr-2 mb-1">
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
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.03] p-1.5">
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
// 组件
// ============================================================================

interface TraceWaterfallProps {
  entries: SessionLogEntry[];
  t: TFunc;
  loadSubAgent?: (agentData: Record<string, unknown>) => Promise<SessionLogEntry[] | null>;
}

function TraceWaterfallInner({ entries, t, loadSubAgent }: TraceWaterfallProps) {
  const roots = useMemo(() => buildTrace(entries), [entries]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [subCache, setSubCache] = useState<Record<string, SessionLogEntry[] | 'loading' | 'error'>>({});

  // 数据变化时默认展开所有 run 与 chat，让「对话 → 思考过程/文本输出」的层级一进来就可见；
  // 子 Agent（subagent）不自动展开——其 trace 是点击时才懒加载的，避免一次性打一堆请求。
  useEffect(() => {
    const ids = new Set<string>();
    const walk = (sp: TraceSpan) => {
      if (sp.kind === 'run' || sp.kind === 'chat') ids.add(sp.id);
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

  const { windowStart, windowSpan } = useMemo(() => {
    if (roots.length === 0) return { windowStart: 0, windowSpan: 0 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of roots) {
      lo = Math.min(lo, r.start);
      hi = Math.max(hi, r.end);
    }
    return { windowStart: lo, windowSpan: Math.max(hi - lo, 0.001) };
  }, [roots]);

  if (roots.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      {roots.map((r) => (
        <SpanRow
          key={r.id}
          sp={r}
          depth={0}
          windowStart={windowStart}
          windowSpan={windowSpan}
          expanded={expanded}
          toggle={toggle}
          t={t}
          loadSubAgent={loadSubAgent}
          subCache={subCache}
          requestSub={requestSub}
        />
      ))}
    </div>
  );
}

export default function TraceWaterfall(props: TraceWaterfallProps) {
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
        <TraceWaterfallInner {...props} />
      </TooltipProvider>
    </ToolInfoContext.Provider>
  );
}
