import type { AITaskKindInfo, AITaskModelsData, SessionLogCategoriesResponse } from '@/lib/api';
import {
  CAPABILITY_AGENT_TASK_ID,
  CAPABILITY_AGENT_TASK_PREFIX,
  resolveKindTitle,
  resolveNodeSourceBadge,
  shortKindCode,
  type TrFn,
} from '@/lib/aiTaskKinds';

export { CAPABILITY_AGENT_TASK_ID, CAPABILITY_AGENT_TASK_PREFIX, type TrFn };

export const DEFAULT_ALL_FILTER = '__all__';
export const DEFAULT_MAIN_CHAT_FILTER = 'task:chat';

export type ParsedTaskFilter =
  | { mode: 'all' }
  | { mode: 'task'; taskKind: string }
  | { mode: 'unmapped'; createBy: string }
  | { mode: 'create_by'; createBy: string };

export interface TaskFilterOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  group: string;
  count: number;
  pinned?: boolean;
  isParent?: boolean;
  isChild?: boolean;
  parentValue?: string;
  keywords: string[];
}

export interface TaskFilterSection {
  id: string;
  label: string;
  items: TaskFilterOption[];
}

export interface TaskKindDisplayInfo {
  title: string;
  group: string;
  parentTitle?: string;
}

export interface TaskFilterModel {
  allOption: TaskFilterOption;
  sections: TaskFilterSection[];
  optionByValue: Map<string, TaskFilterOption>;
  taskKindInfoById: Map<string, TaskKindDisplayInfo>;
  emptyTotalCount: number;
}

// 与后端 _CAPAGENT_SUFFIX_RE 同构：避免贪婪匹配吞掉含关键字的 node_id
const CAPAGENT_SUFFIX_RE =
  /_(?:adhoc|kanban(?:_[0-9a-f]+(?:_[0-9a-f]+)?)?|transient_[^_]+|present_[^_]+)$/;

/** 从 capagent_<node_id>_<suffix> 提取 node_id，覆盖 adhoc / kanban / transient / present。 */
export function extractCapabilityNodeId(sessionId: string): string {
  if (!sessionId.startsWith('capagent_')) return sessionId;
  const rest = sessionId.slice('capagent_'.length);
  return rest.replace(CAPAGENT_SUFFIX_RE, '') || sessionId;
}

/** 统一解析单条会话日志的 task_kind（优先后端字段，旧后端仅对 capagent_ 做前缀回退）。 */
export function resolveSessionTaskKind(log: {
  session_id: string;
  task_kind?: string | null;
}): string {
  if (log.task_kind) return log.task_kind;
  if (log.session_id.startsWith('capagent_')) {
    return `${CAPABILITY_AGENT_TASK_PREFIX}${extractCapabilityNodeId(log.session_id)}`;
  }
  return '';
}

export function parseTaskFilterValue(value: string): ParsedTaskFilter {
  if (!value || value === DEFAULT_ALL_FILTER) return { mode: 'all' };
  if (value.startsWith('task:')) {
    const taskKind = value.slice('task:'.length).trim();
    return taskKind ? { mode: 'task', taskKind } : { mode: 'all' };
  }
  if (value.startsWith('unmapped:')) {
    const createBy = value.slice('unmapped:'.length).trim();
    return createBy ? { mode: 'unmapped', createBy } : { mode: 'all' };
  }
  if (value.startsWith('cb:')) {
    const createBy = value.slice('cb:'.length).trim();
    return createBy ? { mode: 'create_by', createBy } : { mode: 'all' };
  }
  return { mode: 'create_by', createBy: value };
}

/** 从 URL 查询参数计算初始筛选值：优先 ?task_kind=，其次 ?create_by=，默认主对话 task:chat。 */
export function initialFilterFromSearchParams(params: URLSearchParams): string {
  const tk = params.get('task_kind')?.trim();
  if (tk) return tk === DEFAULT_ALL_FILTER ? DEFAULT_ALL_FILTER : `task:${tk}`;
  const cb = params.get('create_by')?.trim();
  if (cb) {
    if (cb === DEFAULT_ALL_FILTER) return DEFAULT_ALL_FILTER;
    if (cb.toLowerCase() === 'chat') return DEFAULT_MAIN_CHAT_FILTER;
    return `cb:${cb}`;
  }
  return DEFAULT_MAIN_CHAT_FILTER;
}

/** 将 1:1 对应某已登记 task_kind 的 URL ?create_by=（如 Autonomy）归一化为 task: 前缀。 */
export function upgradeCreateByFilterToTaskKind(
  filterValue: string,
  taskKinds: AITaskKindInfo[],
): string {
  if (!filterValue.startsWith('cb:')) return filterValue;
  const raw = filterValue.slice('cb:'.length).trim();
  if (!raw) return DEFAULT_ALL_FILTER;
  const low = raw.toLowerCase();
  if (low === 'chat') return DEFAULT_MAIN_CHAT_FILTER;
  const matched = taskKinds.find(
    (k) =>
      !k.parent_id && (k.stats_keys?.length ?? 0) === 1 && k.stats_keys[0].toLowerCase() === low,
  );
  return matched ? `task:${matched.id}` : filterValue;
}

/**
 * 复用 /api/ai_task_models 的分组与能力代理层级 + /api/ai/session_logs/categories 的实时计数，
 * 构建 /ai-history 任务类型筛选模型；兼容旧后端降级展示。
 */
export function buildTaskFilterModel(
  taskModels: AITaskModelsData | null,
  categoriesData: SessionLogCategoriesResponse | null,
  totalCount: number,
  tr: TrFn,
): TaskFilterModel {
  const allOption: TaskFilterOption = {
    value: DEFAULT_ALL_FILTER,
    label: tr('aiHistory.filterAll', '全部'),
    group: 'all',
    count: totalCount,
    pinned: true,
    keywords: ['all', '全部'],
  };
  const optionByValue = new Map<string, TaskFilterOption>([[allOption.value, allOption]]);
  const taskKindInfoById = new Map<string, TaskKindDisplayInfo>();
  const sections: TaskFilterSection[] = [];
  const register = (items: TaskFilterOption[], id: string, label: string) => {
    if (items.length === 0) return;
    for (const opt of items) optionByValue.set(opt.value, opt);
    sections.push({ id, label, items });
  };

  const tkCounts = categoriesData?.task_kinds;
  if (taskModels && taskModels.kinds.length > 0 && tkCounts) {
    const kindById = new Map<string, AITaskKindInfo>();
    const childrenByParent = new Map<string, AITaskKindInfo[]>();
    for (const k of taskModels.kinds) {
      kindById.set(k.id, k);
      if (k.parent_id) {
        const list = childrenByParent.get(k.parent_id) ?? [];
        list.push(k);
        childrenByParent.set(k.parent_id, list);
      }
    }

    for (const k of taskModels.kinds) {
      const parent = k.parent_id ? kindById.get(k.parent_id) : undefined;
      taskKindInfoById.set(k.id, {
        title: resolveKindTitle(k, tr),
        group: k.group,
        parentTitle: parent ? resolveKindTitle(parent, tr) : undefined,
      });
    }

    const orphanBadge = tr('aiHistory.orphanNodeBadge', '历史');
    const capParent = kindById.get(CAPABILITY_AGENT_TASK_ID);
    const capParentTitle = capParent ? resolveKindTitle(capParent, tr) : undefined;
    const orphanCaps: Array<{ id: string; nodeId: string; count: number }> = [];
    const orphanOthers: Array<{ id: string; count: number }> = [];

    for (const [tkId, stat] of Object.entries(tkCounts)) {
      if (kindById.has(tkId) || stat.count <= 0) continue;
      if (tkId.startsWith(CAPABILITY_AGENT_TASK_PREFIX)) {
        const nodeId = tkId.slice(CAPABILITY_AGENT_TASK_PREFIX.length);
        if (!nodeId) continue;
        orphanCaps.push({ id: tkId, nodeId, count: stat.count });
        taskKindInfoById.set(tkId, { title: nodeId, group: 'agent', parentTitle: capParentTitle });
      } else {
        orphanOthers.push({ id: tkId, count: stat.count });
        taskKindInfoById.set(tkId, { title: tkId, group: 'other' });
      }
    }
    orphanCaps.sort((a, b) => b.count - a.count);
    orphanOthers.sort((a, b) => b.count - a.count);

    for (const group of taskModels.groups) {
      const items: TaskFilterOption[] = [];
      for (const kind of taskModels.kinds) {
        if (kind.group !== group || (kind.parent_id && kindById.has(kind.parent_id))) continue;
        const title = resolveKindTitle(kind, tr);
        const registeredChildren = childrenByParent.get(kind.id) ?? [];
        const isCapParent = kind.id === CAPABILITY_AGENT_TASK_ID;
        const ownCount = tkCounts[kind.id]?.count ?? 0;

        if (!isCapParent && registeredChildren.length === 0) {
          items.push({
            value: `task:${kind.id}`,
            label: title,
            group: kind.group,
            count: ownCount,
            pinned: kind.id === 'chat',
            keywords: [kind.id, kind.title, title, kind.desc, ...(kind.stats_keys ?? [])],
          });
          continue;
        }

        const childOptions: TaskFilterOption[] = registeredChildren.map((child) => {
          const childTitle = resolveKindTitle(child, tr);
          const code = shortKindCode(child);
          const badge = resolveNodeSourceBadge(child, tr);
          return {
            value: `task:${child.id}`,
            label: childTitle,
            sublabel: code !== childTitle ? code : undefined,
            badge: badge || undefined,
            group: child.group,
            count: tkCounts[child.id]?.count ?? 0,
            isChild: true,
            parentValue: `task:${kind.id}`,
            keywords: [
              child.id,
              code,
              child.title,
              childTitle,
              child.desc,
              child.plugin ?? '',
              child.node_source ?? '',
              badge,
              title,
            ],
          };
        });

        if (isCapParent) {
          for (const orphan of orphanCaps) {
            childOptions.push({
              value: `task:${orphan.id}`,
              label: orphan.nodeId,
              badge: orphanBadge,
              group: 'agent',
              count: orphan.count,
              isChild: true,
              parentValue: `task:${kind.id}`,
              keywords: [orphan.id, orphan.nodeId, orphanBadge, title],
            });
          }
        }

        items.push({
          value: `task:${kind.id}`,
          label: title,
          sublabel: isCapParent ? tr('aiHistory.allCapabilityAgents', '全部能力代理') : undefined,
          group: kind.group,
          count: ownCount + childOptions.reduce((sum, c) => sum + c.count, 0),
          isParent: true,
          keywords: [kind.id, kind.title, title, kind.desc, ...(kind.stats_keys ?? [])],
        });
        items.push(...childOptions);
      }
      register(items, group, tr(`aiConfig.taskModels.groups.${group}`, group));
    }

    const unmapped = (categoriesData?.unmapped ?? []).filter((c) => c.count > 0);
    register(
      [
        ...unmapped.map((cat) => ({
          value: `unmapped:${cat.create_by}`,
          label: cat.label,
          sublabel: cat.label !== cat.create_by ? cat.create_by : undefined,
          group: cat.group || 'other',
          count: cat.count,
          keywords: [cat.create_by, cat.label, cat.description],
        })),
        ...orphanOthers.map((orphan) => {
          const title = tr(`aiConfig.taskModels.kinds.${orphan.id}.title`, orphan.id);
          return {
            value: `task:${orphan.id}`,
            label: title,
            badge: orphanBadge,
            group: 'other',
            count: orphan.count,
            keywords: [orphan.id, title, orphanBadge],
          };
        }),
      ],
      'other',
      tr('aiHistory.otherSourcesGroup', '其他来源'),
    );
  } else {
    // 降级路径：旧后端无 task_kinds 或 /api/ai_task_models 不可用时回退 categories
    register(
      (categoriesData?.categories ?? []).map((cat) => ({
        value:
          cat.create_by.toLowerCase() === 'chat' ? DEFAULT_MAIN_CHAT_FILTER : `cb:${cat.create_by}`,
        label: cat.label,
        sublabel: cat.label !== cat.create_by ? cat.create_by : undefined,
        group: cat.group || 'other',
        count: cat.count,
        pinned: cat.create_by.toLowerCase() === 'chat',
        keywords: [cat.create_by, cat.label, cat.description],
      })),
      'categories',
      tr('aiHistory.filterCreateBy', '来源筛选'),
    );
  }

  let emptyTotalCount = 0;
  for (const sec of sections) {
    for (const item of sec.items) {
      if (item.count === 0 && !item.pinned) emptyTotalCount += 1;
    }
  }
  return { allOption, sections, optionByValue, taskKindInfoById, emptyTotalCount };
}

function optionMatchesQuery(item: TaskFilterOption, q: string): boolean {
  return [item.label, item.sublabel ?? '', item.badge ?? '', item.value, ...item.keywords]
    .join(' ')
    .toLowerCase()
    .includes(q);
}

export interface FilteredTaskSectionsResult {
  sections: TaskFilterSection[];
  hiddenEmptyCount: number;
  hasAnyVisible: boolean;
}

/**
 * 过滤任务类型分组：
 * - 搜索时跨全部任务与能力代理（含 0 条）匹配；
 * - 未搜索且未开启 showEmpty 时保留「主对话」、当前选中项及 count > 0 的项，折叠其余空项。
 */
export function filterTaskSections(
  sections: TaskFilterSection[],
  selectedValue: string,
  query: string,
  showEmpty: boolean,
): FilteredTaskSectionsResult {
  const q = query.trim().toLowerCase();
  let hiddenEmptyCount = 0;
  const visibleSections: TaskFilterSection[] = [];

  for (const section of sections) {
    const keptItems: TaskFilterOption[] = [];
    if (q) {
      for (const item of section.items) {
        if (optionMatchesQuery(item, q)) keptItems.push(item);
      }
    } else {
      const activeParents = new Set<string>();
      for (const item of section.items) {
        if (item.isChild && item.parentValue && (item.count > 0 || item.value === selectedValue)) {
          activeParents.add(item.parentValue);
        }
      }
      for (const item of section.items) {
        const keep =
          showEmpty ||
          Boolean(item.pinned) ||
          item.count > 0 ||
          item.value === selectedValue ||
          (Boolean(item.isParent) && activeParents.has(item.value));
        if (keep) keptItems.push(item);
        else if (item.count === 0) hiddenEmptyCount += 1;
      }
    }
    if (keptItems.length > 0) visibleSections.push({ ...section, items: keptItems });
  }

  return { sections: visibleSections, hiddenEmptyCount, hasAnyVisible: visibleSections.length > 0 };
}
