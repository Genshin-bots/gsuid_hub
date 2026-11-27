import {
  Activity,
  AlarmClock,
  BookOpen,
  Bot,
  Brain,
  ClipboardCheck,
  Clock,
  Compass,
  Cpu,
  FileImage,
  GitFork,
  HeartHandshake,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  MessageCircleQuestion,
  MessageSquare,
  PlugZap,
  Puzzle,
  Radar,
  Radio,
  Scale,
  ScanEye,
  Smile,
  Tags,
  UserCog,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AITaskKindInfo } from '@/lib/api';

export const CAPABILITY_AGENT_TASK_ID = 'capability_agent';
export const CAPABILITY_AGENT_TASK_PREFIX = 'capability_agent:';

/** 首屏星型图谱常驻的一级核心任务 ID（低频任务与能力代理子项默认归属在对应一级核心节点下，点击即展开）。 */
export const CORE_STAR_TASK_IDS: readonly string[] = [
  'chat',
  'autonomy',
  'capability_agent',
  'scheduled_task',
  'subagent',
  'heartbeat_decision',
  'heartbeat_output',
  'turn_router',
  'memory_algebra',
  'memory_window_router',
  'capability_eval',
];

const CORE_STAR_TASK_ID_SET = new Set<string>(CORE_STAR_TASK_IDS);

/** 内置低频任务 → 所属一级核心任务映射（保持同默认档位与业务域归属一致）。 */
export const BUILTIN_LOW_FREQ_PARENT_MAP: Readonly<Record<string, string>> = {
  temp_assistant: 'chat',
  relationship_distill: 'chat',
  build_persona: 'subagent',
  mcp_profile: 'subagent',
  journal_compact: 'autonomy',
  eval_judge: 'turn_router',
  image_desc_summary: 'turn_router',
  meme_tagger: 'turn_router',
};

/**
 * 解析任务在前端星型图谱中的父级核心任务 ID：
 * - 一级核心任务、插件任务与跟随调用方任务返回 null；
 * - `capability_agent:<node_id>` 归属 `capability_agent`；
 * - 其余内置低频任务归属对应一级核心任务（未知新任务按默认高低档兜底归入 chat / turn_router）。
 */
export function resolveHierarchyParentTaskId(kind: AITaskKindInfo): string | null {
  if (kind.follows_caller) return null;
  if (kind.parent_id === CAPABILITY_AGENT_TASK_ID) return CAPABILITY_AGENT_TASK_ID;
  if (CORE_STAR_TASK_ID_SET.has(kind.id) || kind.group === 'plugin') return null;
  const mapped = BUILTIN_LOW_FREQ_PARENT_MAP[kind.id];
  if (mapped) return mapped;
  return kind.default_level === 'high' ? 'chat' : 'turn_router';
}

export type TrFn = (
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) => string;

/** 任务分组与旧来源分组共享图标映射（配置/统计/历史页统一收口）。 */
export const TASK_GROUP_ICON: Record<string, LucideIcon> = {
  all: Layers,
  conversation: MessageSquare,
  chat: MessageSquare,
  agent: Bot,
  capability: Wrench,
  proactive: Radio,
  heartbeat: Activity,
  memory: Brain,
  multimodal: ImageIcon,
  image: ImageIcon,
  meme: Smile,
  persona: UserCog,
  kanban: LayoutGrid,
  scheduled: Clock,
  plugin: Puzzle,
  other: Cpu,
};

/** 逐内置任务类型的精确图标映射（用于星型模型图谱卫星节点展示）。 */
export const TASK_KIND_ICON: Record<string, LucideIcon> = {
  chat: MessageSquare,
  turn_router: GitFork,
  temp_assistant: MessageCircleQuestion,
  eval_judge: Scale,
  subagent: Workflow,
  capability_agent: Bot,
  capability_eval: ClipboardCheck,
  scheduled_task: AlarmClock,
  autonomy: Compass,
  build_persona: UserCog,
  mcp_profile: PlugZap,
  heartbeat_decision: Radar,
  heartbeat_output: Radio,
  memory_algebra: Brain,
  memory_window_router: Tags,
  journal_compact: BookOpen,
  relationship_distill: HeartHandshake,
  image_understand: ScanEye,
  image_desc_summary: FileImage,
  meme_tagger: Smile,
};

export function resolveTaskKindIcon(kind: AITaskKindInfo): LucideIcon {
  if (kind.id in TASK_KIND_ICON) {
    return TASK_KIND_ICON[kind.id];
  }
  if (kind.parent_id === CAPABILITY_AGENT_TASK_ID) {
    return Wrench;
  }
  return TASK_GROUP_ICON[kind.group] ?? Cpu;
}

export function shortKindCode(kind: AITaskKindInfo): string {
  if (kind.parent_id && kind.id.startsWith(`${kind.parent_id}:`)) {
    return kind.id.slice(kind.parent_id.length + 1);
  }
  return kind.id;
}

export function resolveKindTitle(kind: AITaskKindInfo, tr: TrFn): string {
  return tr(`aiConfig.taskModels.kinds.${kind.id}.title`, kind.title);
}

export function resolveNodeSourceBadge(kind: AITaskKindInfo, tr: TrFn): string {
  if (!kind.node_source) return '';
  const base = tr(`aiConfig.taskModels.nodeSources.${kind.node_source}`, kind.node_source);
  if (kind.node_source === 'plugin' && kind.plugin && kind.plugin !== 'core') {
    return `${base} · ${kind.plugin}`;
  }
  return base;
}
