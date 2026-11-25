import {
  Activity,
  Bot,
  Brain,
  Clock,
  Cpu,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  MessageSquare,
  Puzzle,
  Radio,
  Smile,
  UserCog,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AITaskKindInfo } from '@/lib/api';

export const CAPABILITY_AGENT_TASK_ID = 'capability_agent';
export const CAPABILITY_AGENT_TASK_PREFIX = 'capability_agent:';

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
