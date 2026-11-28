import {
  AI_TASK_LEVEL_REFS,
  type AITaskGraphData,
  type AITaskGraphHubNode,
  type AITaskGraphPos,
  type AITaskGraphSavePayload,
  type AITaskKindInfo,
  type AITaskModelsData,
} from '@/lib/api';
import { CAPABILITY_AGENT_TASK_ID, resolveHierarchyParentTaskId } from '@/lib/aiTaskKinds';

export type StarUsageMetric = 'tokens' | 'requests';

export interface TaskUsageBucket {
  tokens: number;
  requests: number;
}

export const MIN_SATELLITE_RADIUS = 29;
export const MAX_SATELLITE_RADIUS = 44;
export const MIN_CHILD_SATELLITE_RADIUS = 23;
export const MAX_CHILD_SATELLITE_RADIUS = 33;

/**
 * 将近 30 天使用量按温和幂次（ratio^0.45）缩放并钳制到 [minR, maxR]。
 * 相比对数映射，低占比任务不会虚胖成与主任务接近的大小，尺寸层级与环绕进度条保持一致；
 * 零用量任务保持最小保底半径，非零任务至少比零用量大 1px。
 */
export function computeSatelliteRadius(
  value: number,
  maxValue: number,
  minR: number = MIN_SATELLITE_RADIUS,
  maxR: number = MAX_SATELLITE_RADIUS,
): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maxValue) || maxValue <= 0) {
    return minR;
  }
  const linearRatio = Math.min(1, Math.max(0, value / maxValue));
  const scaled = Math.round(minR + linearRatio ** 0.45 * (maxR - minR));
  return Math.min(maxR, Math.max(minR + 1, scaled));
}

/**
 * 将全局占比 [0, 1] 映射为环绕进度条的弧长百分比（对应 SVG pathLength=100）：
 * - 0 → 0（不绘制进度弧）
 * - ≥99.95% → 100（完整闭合光环）
 * - 其余非零占比严格线性映射到 [0.8, 97.5]，既保证极小占比可见，也避免非 100% 时圆角端点粘连闭合。
 */
export function computeRingFillPercent(share: number, hasValue: boolean): number {
  if (!hasValue || !Number.isFinite(share) || share <= 0) return 0;
  if (share >= 0.9995) return 100;
  return Math.min(97.5, Math.max(0.8, share * 100));
}

/** 格式化用量占比文案（如 98%、1.8%、<0.1%、0%）。 */
export function formatUsageShare(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return '0%';
  if (share < 0.001) return '<0.1%';
  if (share >= 0.9995) return '100%';
  if (share >= 0.995) return '99.9%';
  const pct = share * 100;
  if (pct < 10) {
    return `${Number(pct.toFixed(1))}%`;
  }
  return `${Math.round(pct)}%`;
}

/**
 * 生成从 12 点钟方向（顶部中点）出发、顺时针绕完一圈的圆角正方形 SVG path。
 * 兼容直角（cornerRadius=0）、圆角矩形及正圆（cornerRadius>=innerSize/2）。
 */
export function buildRoundedRectRingPath(
  svgSize: number,
  inset: number,
  cornerRadius: number,
): string {
  const inner = Math.max(1, svgSize - inset * 2);
  const x0 = inset;
  const y0 = inset;
  const x1 = x0 + inner;
  const y1 = y0 + inner;
  const cx = x0 + inner / 2;
  const r = Math.max(0, Math.min(cornerRadius, inner / 2));

  const f = (n: number) => Number(n.toFixed(2));
  if (r <= 0.01) {
    return `M ${f(cx)} ${f(y0)} H ${f(x1)} V ${f(y1)} H ${f(x0)} V ${f(y0)} Z`;
  }
  return [
    `M ${f(cx)} ${f(y0)}`,
    `H ${f(x1 - r)}`,
    `A ${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}`,
    `V ${f(y1 - r)}`,
    `A ${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}`,
    `H ${f(x0 + r)}`,
    `A ${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}`,
    `V ${f(y0 + r)}`,
    `A ${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}`,
    'Z',
  ].join(' ');
}

/** 任务节点的语义强调色：用于环绕进度条与顶部用量占比条，确保节点与分布条颜色一一对应。 */
export function resolveSatelliteAccentColor(
  kind: Pick<AITaskKindInfo, 'id' | 'group'>,
  isDetachedChild = false,
): string {
  if (kind.id === 'chat') return 'hsl(var(--primary))';
  if (kind.id === 'autonomy') return '#f59e0b';
  if (isDetachedChild) return '#0ea5e9';
  switch (kind.group) {
    case 'conversation':
      return '#0ea5e9';
    case 'agent':
      return '#14b8a6';
    case 'memory':
      return '#a855f7';
    case 'proactive':
      return '#f43f5e';
    case 'plugin':
      return '#6366f1';
    default:
      return 'hsl(var(--primary))';
  }
}

/** 按 stats_keys 汇总单个任务的近 30 天 Token 与调用次数（可叠加当前折叠归属的子任务用量）。 */
export function resolveTaskUsage(
  kind: AITaskKindInfo,
  usageByStatKey: ReadonlyMap<string, TaskUsageBucket>,
  foldedChildren?: readonly AITaskKindInfo[],
): TaskUsageBucket {
  let tokens = 0;
  let requests = 0;
  for (const rawKey of kind.stats_keys ?? []) {
    const bucket = usageByStatKey.get(rawKey.toLowerCase());
    if (bucket) {
      tokens += bucket.tokens;
      requests += bucket.requests;
    }
  }
  if (foldedChildren && foldedChildren.length > 0) {
    for (const child of foldedChildren) {
      for (const rawKey of child.stats_keys ?? []) {
        const bucket = usageByStatKey.get(rawKey.toLowerCase());
        if (bucket) {
          tokens += bucket.tokens;
          requests += bucket.requests;
        }
      }
    }
  }
  return { tokens, requests };
}

/**
 * 当旧版后端未下发 data.graph 时，在前端合成一致的默认星型拓扑：
 * - 始终创建 slot_high 与 slot_low 双星核（即使 high === low 也保持双星核，对应确认方案 4-A）
 * - 新用户 high="" & low="" 时同样生成两颗空 primary 的 '+' 占位星核并连好默认连线
 */
export function synthesizeGraphFromTaskModels(data: AITaskModelsData): AITaskGraphSavePayload {
  if (data.graph && data.graph.nodes.length > 0) {
    return {
      nodes: data.graph.nodes.map((n) => ({
        id: n.id,
        primary: n.primary ?? '',
        secondary: n.secondary ?? '',
        role: n.role ?? 'custom',
        pos: n.pos ? { x: n.pos.x, y: n.pos.y } : null,
      })),
      edges: { ...data.graph.edges },
      split_subagents: [...(data.graph.split_subagents ?? [])],
      task_positions: Object.fromEntries(
        Object.entries(data.graph.task_positions ?? {}).map(([k, p]) => [k, { x: p.x, y: p.y }]),
      ),
    };
  }

  const highP = data.levels?.high?.primary ?? '';
  const highS = highP ? (data.levels?.high?.secondary ?? '') : '';
  const lowP = data.levels?.low?.primary ?? '';
  const lowS = lowP ? (data.levels?.low?.secondary ?? '') : '';

  const nodes: AITaskGraphSavePayload['nodes'] = [
    {
      id: 'slot_high',
      primary: highP,
      secondary: highS === highP ? '' : highS,
      role: 'high',
      pos: null,
    },
    {
      id: 'slot_low',
      primary: lowP,
      secondary: lowS === lowP ? '' : lowS,
      role: 'low',
      pos: null,
    },
  ];

  const routableTop = data.kinds.filter((k) => !k.parent_id && !k.follows_caller);
  const validSubIds = new Set(
    data.kinds.filter((k) => k.parent_id === CAPABILITY_AGENT_TASK_ID).map((k) => k.id),
  );
  const edges: Record<string, string> = {};
  for (const k of routableTop) {
    edges[k.id] = k.default_level === 'high' ? 'slot_high' : 'slot_low';
  }

  const splitSubagents: string[] = [];
  let customSeq = 1;

  for (const k of data.kinds) {
    if (k.follows_caller || !k.override?.primary) continue;
    const isSub = validSubIds.has(k.id);
    if (k.parent_id && !isSub) continue;
    if (isSub && !splitSubagents.includes(k.id)) {
      splitSubagents.push(k.id);
    }
    const ovPrimary = k.override.primary;
    const ovSecondary = k.override.secondary === ovPrimary ? '' : (k.override.secondary ?? '');
    if (ovPrimary === AI_TASK_LEVEL_REFS.high) {
      edges[k.id] = 'slot_high';
      continue;
    }
    if (ovPrimary === AI_TASK_LEVEL_REFS.low) {
      edges[k.id] = 'slot_low';
      continue;
    }
    let matched = nodes.find((n) => n.primary === ovPrimary && n.secondary === ovSecondary);
    if (!matched) {
      matched = {
        id: `hub_${customSeq}`,
        primary: ovPrimary,
        secondary: ovSecondary,
        role: 'custom',
        pos: null,
      };
      customSeq += 1;
      nodes.push(matched);
    }
    edges[k.id] = matched.id;
  }

  return {
    nodes,
    edges,
    split_subagents: splitSubagents,
    task_positions: {},
  };
}

/** 构造「恢复默认双星核连线」的草稿快照（保留当前高/低槽位已选模型，清除自定义拆分与多余星核）。 */
export function buildDefaultTwoHubDraft(
  currentDraft: AITaskGraphSavePayload,
  kinds: readonly AITaskKindInfo[],
): AITaskGraphSavePayload {
  const highNode =
    currentDraft.nodes.find((n) => n.role === 'high') ?? currentDraft.nodes[0] ?? null;
  const lowNode =
    currentDraft.nodes.find((n) => n.role === 'low' && n.id !== highNode?.id) ??
    currentDraft.nodes[1] ??
    highNode;

  const highPrimary = highNode?.primary ?? '';
  const highSecondary = highPrimary ? (highNode?.secondary ?? '') : '';
  const lowPrimary = lowNode?.primary ?? highPrimary;
  const lowSecondary = lowPrimary ? (lowNode?.secondary ?? '') : '';

  const edges: Record<string, string> = {};
  for (const k of kinds) {
    if (k.parent_id || k.follows_caller) continue;
    edges[k.id] = k.default_level === 'high' ? 'slot_high' : 'slot_low';
  }

  return {
    nodes: [
      {
        id: 'slot_high',
        primary: highPrimary,
        secondary: highSecondary === highPrimary ? '' : highSecondary,
        role: 'high',
        pos: null,
      },
      {
        id: 'slot_low',
        primary: lowPrimary,
        secondary: lowSecondary === lowPrimary ? '' : lowSecondary,
        role: 'low',
        pos: null,
      },
    ],
    edges,
    split_subagents: [],
    task_positions: {},
  };
}

/** 规范化签名，供 AIConfigPage dirty 检查稳定比对。 */
export function serializeGraphSignature(graph: AITaskGraphSavePayload | null): string {
  if (!graph) return '';
  const sortedEdges = Object.keys(graph.edges)
    .sort()
    .map((k) => [k, graph.edges[k]]);
  const sortedSubagents = [...graph.split_subagents].sort();
  const sortedTaskPos = Object.keys(graph.task_positions)
    .sort()
    .map((k) => [k, Math.round(graph.task_positions[k].x), Math.round(graph.task_positions[k].y)]);
  return JSON.stringify({
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      primary: n.primary,
      secondary: n.secondary,
      role: n.role,
      pos: n.pos ? [Math.round(n.pos.x), Math.round(n.pos.y)] : null,
    })),
    edges: sortedEdges,
    split_subagents: sortedSubagents,
    task_positions: sortedTaskPos,
  });
}

/** 找出所有「已有任务连入，但尚未选择模型配置（primary 为空）」的 '+' 占位星核 ID。 */
export function findUnconfiguredConnectedHubIds(
  graph: AITaskGraphSavePayload,
  kinds: readonly AITaskKindInfo[],
): string[] {
  const activeTaskIds = new Set<string>();
  for (const k of kinds) {
    if (!k.parent_id && !k.follows_caller) activeTaskIds.add(k.id);
  }
  for (const subId of graph.split_subagents) {
    activeTaskIds.add(subId);
  }

  const usedNodeIds = new Set<string>();
  const highDefault = graph.nodes.find((n) => n.role === 'high')?.id ?? graph.nodes[0]?.id ?? '';
  const lowDefault = graph.nodes.find((n) => n.role === 'low')?.id ?? graph.nodes[0]?.id ?? '';

  for (const k of kinds) {
    if (!activeTaskIds.has(k.id)) continue;
    const target = graph.edges[k.id] || (k.default_level === 'high' ? highDefault : lowDefault);
    if (target) usedNodeIds.add(target);
  }

  return graph.nodes.filter((n) => usedNodeIds.has(n.id) && !n.primary.trim()).map((n) => n.id);
}

export interface InvalidConfigHubEntry {
  nodeId: string;
  primary: string;
  secondary: string;
  connectedTaskCount: number;
}

export interface InvalidConfigHubsResult {
  missingPrimary: InvalidConfigHubEntry[];
  missingSecondary: InvalidConfigHubEntry[];
}

/**
 * 找出引用了磁盘上已不存在配置文件的配置节点（分别统计主配置缺失与备用配置缺失）。
 * 调用方须确保 `validConfigNames` 来自已加载完成的 `allConfigsList`，加载中不可调用以免误判。
 */
export function findInvalidConfigHubs(
  graph: AITaskGraphSavePayload,
  kinds: readonly AITaskKindInfo[],
  validConfigNames: ReadonlySet<string>,
): InvalidConfigHubsResult {
  const connectedCountByNodeId = new Map<string, number>();
  const highDefault = graph.nodes.find((n) => n.role === 'high')?.id ?? graph.nodes[0]?.id ?? '';
  const lowDefault = graph.nodes.find((n) => n.role === 'low')?.id ?? graph.nodes[0]?.id ?? '';
  const splitSet = new Set(graph.split_subagents);

  for (const k of kinds) {
    if (k.follows_caller) continue;
    if (k.parent_id && !splitSet.has(k.id)) continue;
    const target = graph.edges[k.id] || (k.default_level === 'high' ? highDefault : lowDefault);
    if (target) {
      connectedCountByNodeId.set(target, (connectedCountByNodeId.get(target) ?? 0) + 1);
    }
  }

  const missingPrimary: InvalidConfigHubEntry[] = [];
  const missingSecondary: InvalidConfigHubEntry[] = [];

  for (const node of graph.nodes) {
    const primary = node.primary.trim();
    const secondary = node.secondary.trim();
    const connectedTaskCount = connectedCountByNodeId.get(node.id) ?? 0;
    if (primary && !validConfigNames.has(primary)) {
      missingPrimary.push({ nodeId: node.id, primary, secondary, connectedTaskCount });
    }
    if (secondary && !validConfigNames.has(secondary)) {
      missingSecondary.push({ nodeId: node.id, primary, secondary, connectedTaskCount });
    }
  }

  return { missingPrimary, missingSecondary };
}

/**
 * 剥离图谱中指向已不存在配置文件的备用配置（secondary）。
 * 运行时后端本就会忽略失效备用，保存前自动清理可避免因历史残留死锁整个保存流。
 */
export function stripMissingSecondaryConfigs(
  graph: AITaskGraphSavePayload,
  validConfigNames: ReadonlySet<string>,
): {
  nextGraph: AITaskGraphSavePayload;
  stripped: Array<{ nodeId: string; primary: string; secondary: string }>;
} {
  const stripped: Array<{ nodeId: string; primary: string; secondary: string }> = [];
  const nextNodes = graph.nodes.map((node) => {
    const secondary = node.secondary.trim();
    if (secondary && !validConfigNames.has(secondary)) {
      stripped.push({ nodeId: node.id, primary: node.primary, secondary });
      return { ...node, secondary: '' };
    }
    return node;
  });

  if (stripped.length === 0) {
    return { nextGraph: graph, stripped };
  }

  return {
    nextGraph: {
      ...graph,
      nodes: nextNodes,
    },
    stripped,
  };
}

export interface StarSatelliteItem {
  id: string;
  hubId: string;
  kind: AITaskKindInfo;
  /** 'core' 为一级核心任务；'child' 为二级低频任务或能力代理子节点 */
  tier: 'core' | 'child';
  /** 逻辑归属的一级父任务 ID（一级核心任务为 null） */
  parentTaskId: string | null;
  /**
   * 视觉连线锚定的一级父任务 ID：
   * - 非 null：当前跟随父任务同一配置，画「父任务 ──▶ 子节点」树状虚线分支；
   * - null：一级核心任务，或已被单独改绑到其它配置星核的子节点，画直连目标星核的实线。
   */
  visualParentTaskId: string | null;
  /** 一级核心任务所挂载的全部二级子任务列表（叶子核心任务为空数组） */
  childKinds: AITaskKindInfo[];
  /** 当前已在画布上展开该一级节点的子任务层 */
  isExpandedParent: boolean;
  /** 展开子节点时选定的侧边空位中心角（弧度），供详情卡片反向避让 */
  expandedFanAngle?: number | null;
  /** 二级节点是否已脱离母节点独立绑定了配置（能力代理已 split，或低频任务连向不同于母节点的星核） */
  isDetachedChild: boolean;
  metricValue: number;
  /** 占当前图谱总用量的比例 [0, 1] */
  usageShare: number;
  /** 占所属配置星核总用量的比例 [0, 1] */
  hubUsageShare: number;
  /** 当前可见任务中按用量降序的名次（1 起；零用量为 null） */
  usageRank: number | null;
  tokens: number;
  requests: number;
  radius: number;
  x: number;
  y: number;
}

export interface StarHubLayoutItem {
  node: AITaskGraphHubNode;
  x: number;
  y: number;
  connectedTaskCount: number;
  totalTokens: number;
  totalRequests: number;
  /** 当前指标下的总用量 */
  metricValue: number;
  /** 该配置星核承载的用量占全局总用量的比例 [0, 1] */
  usageShare: number;
}

export interface StarGraphLayoutResult {
  hubs: StarHubLayoutItem[];
  satellites: StarSatelliteItem[];
  /** 当前指标下的全局总用量（与各星核之和一致） */
  totalMetric: number;
  /** 当前可见任务中的最大单项用量 */
  maxSatelliteMetric: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** 当前视口与已存坐标横纵方向不一致时已做自动方向重映射（PC 横向 ↔ 移动端纵向） */
  isOrientationProjected?: boolean;
}

function defaultHubCenters(count: number, isNarrow: boolean): AITaskGraphPos[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: 0 }];
  if (count === 2) {
    return isNarrow
      ? [
          { x: 0, y: -245 },
          { x: 0, y: 245 },
        ]
      : [
          { x: -310, y: 0 },
          { x: 310, y: 0 },
        ];
  }
  if (count === 3 && !isNarrow) {
    return [
      { x: -315, y: -140 },
      { x: 315, y: -140 },
      { x: 0, y: 245 },
    ];
  }
  if (isNarrow) {
    const stepY = 465;
    const offset = ((count - 1) * stepY) / 2;
    return Array.from({ length: count }, (_, idx) => ({
      x: 0,
      y: Math.round(idx * stepY - offset),
    }));
  }
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const gapX = 600;
  const gapY = 480;
  return Array.from({ length: count }, (_, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const itemsInRow = row === rows - 1 ? count - row * cols : cols;
    const x = (col - (itemsInRow - 1) / 2) * gapX;
    const y = (row - (rows - 1) / 2) * gapY;
    return { x, y };
  });
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function placeCoreOrbitSatellites(
  hubX: number,
  hubY: number,
  items: Omit<StarSatelliteItem, 'x' | 'y'>[],
  taskPositions: Readonly<Record<string, AITaskGraphPos>>,
  hubIndex: number,
  hubCount: number,
  isNarrow: boolean,
): StarSatelliteItem[] {
  if (items.length === 0) return [];

  const placeRing = (
    ringItems: Omit<StarSatelliteItem, 'x' | 'y'>[],
    minRadius: number,
    phaseOffset: number,
  ): StarSatelliteItem[] => {
    const pad = isNarrow ? 38 : 54;
    const minArc = isNarrow ? 90 : 108;
    const weights = ringItems.map((it) => Math.max(it.radius * 2 + pad, minArc));
    const totalCircumference = weights.reduce((s, w) => s + w, 0);
    const orbitR = Math.max(minRadius, totalCircumference / (2 * Math.PI));
    let cursorAngle = phaseOffset;
    return ringItems.map((it, idx) => {
      const manual = taskPositions[it.id];
      const span = (weights[idx] / totalCircumference) * Math.PI * 2;
      const baseTheta = cursorAngle + span / 2;
      cursorAngle += span;
      if (manual) {
        return { ...it, x: manual.x, y: manual.y };
      }
      const seed = hashString(it.id);
      const radialStagger = (idx % 2 === 0 ? -10 : 14) + ((seed % 13) - 6) * (isNarrow ? 0.7 : 1);
      const angleJitter = (((seed >> 5) % 17) - 8) * 0.011;
      const finalR = Math.max(isNarrow ? 142 : 182, orbitR + radialStagger);
      const finalAngle = baseTheta + angleJitter;
      return {
        ...it,
        x: Math.round(hubX + finalR * Math.cos(finalAngle)),
        y: Math.round(hubY + finalR * Math.sin(finalAngle)),
      };
    });
  };

  // 窄屏上下排布时首颗核心节点朝上/朝下外侧错开，宽屏左右排布时朝左上/右上展开
  const baseAngle = isNarrow
    ? hubIndex === 0
      ? -Math.PI * 0.65
      : Math.PI * 0.35
    : hubCount === 2
      ? hubIndex === 0
        ? -Math.PI * 0.72
        : -Math.PI * 0.28
      : -Math.PI / 2;

  if (items.length <= 8) {
    return placeRing(items, isNarrow ? 154 : 206, baseAngle);
  }

  const innerCount = Math.min(7, Math.ceil(items.length * 0.5));
  const inner = items.slice(0, innerCount);
  const outer = items.slice(innerCount);
  return [
    ...placeRing(inner, isNarrow ? 148 : 196, baseAngle),
    ...placeRing(outer, isNarrow ? 246 : 306, baseAngle + Math.PI / Math.max(outer.length, 4)),
  ];
}

interface LayoutObstacle {
  kind: 'rect' | 'circle';
  x: number;
  y: number;
  r: number;
  halfW?: number;
  halfH?: number;
}

function pointObstacleClearance(px: number, py: number, pr: number, obs: LayoutObstacle): number {
  if (obs.kind === 'rect') {
    const hw = (obs.halfW ?? 112) + pr;
    const hh = (obs.halfH ?? 50) + pr;
    const dx = Math.max(0, Math.abs(px - obs.x) - hw);
    const dy = Math.max(0, Math.abs(py - obs.y) - hh);
    if (dx === 0 && dy === 0) {
      const penX = hw - Math.abs(px - obs.x);
      const penY = hh - Math.abs(py - obs.y);
      return -Math.min(penX, penY);
    }
    return Math.hypot(dx, dy);
  }
  return Math.hypot(px - obs.x, py - obs.y) - (obs.r + pr);
}

/**
 * 扫描母节点四周 24 个候选扇区，找出最开阔、不压星核且不撞邻近节点的侧边空位方向；
 * 未脱离母节点的子节点始终紧靠母节点该侧空位成团排布（忽略历史遗留的旧散落坐标）。
 */
function placeExpandedChildFan(
  parentSat: StarSatelliteItem,
  hubX: number,
  hubY: number,
  childDrafts: Omit<StarSatelliteItem, 'x' | 'y'>[],
  taskPositions: Readonly<Record<string, AITaskGraphPos>>,
  obstacles: readonly LayoutObstacle[],
  activeOverrideIds: ReadonlySet<string>,
): { placed: StarSatelliteItem[]; chosenAngle: number | null } {
  if (childDrafts.length === 0) return { placed: [], chosenAngle: null };

  const outwardAngle =
    Math.abs(parentSat.x - hubX) < 1 && Math.abs(parentSat.y - hubY) < 1
      ? -Math.PI / 2
      : Math.atan2(parentSat.y - hubY, parentSat.x - hubX);

  const attachedDrafts = childDrafts.filter(
    (d) => !d.isDetachedChild && !activeOverrideIds.has(d.id),
  );

  let bestAngle = outwardAngle;
  if (attachedDrafts.length > 0) {
    const sampleDistances =
      attachedDrafts.length > 5
        ? [parentSat.radius + 94, parentSat.radius + 184]
        : [parentSat.radius + 94];
    const spreadProbe = attachedDrafts.length > 1 ? [-0.36, 0, 0.36] : [0];
    let bestScore = Number.NEGATIVE_INFINITY;
    const candidateCount = 24;

    for (let i = 0; i < candidateCount; i += 1) {
      const cand = -Math.PI + (i / candidateCount) * Math.PI * 2;
      let minClear = 260;
      for (const dist of sampleDistances) {
        for (const delta of spreadProbe) {
          const sx = parentSat.x + Math.cos(cand + delta) * dist;
          const sy = parentSat.y + Math.sin(cand + delta) * dist;
          for (const obs of obstacles) {
            const clr = pointObstacleClearance(sx, sy, 32, obs);
            if (clr < minClear) minClear = clr;
          }
        }
      }
      const alignBonus = Math.cos(cand - outwardAngle) * 18;
      const score = Math.min(minClear, 140) * 2.4 + alignBonus;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = cand;
      }
    }
  }

  const maxPerRow = 5;
  const attachedCoords = new Map<string, AITaskGraphPos>();
  const localObstacles: LayoutObstacle[] = [...obstacles];

  for (let i = 0; i < attachedDrafts.length; i += 1) {
    const item = attachedDrafts[i];
    const row = Math.floor(i / maxPerRow);
    const indexInRow = i % maxPerRow;
    const itemsInThisRow = Math.min(maxPerRow, attachedDrafts.length - row * maxPerRow);
    const stepRad = itemsInThisRow <= 3 ? 0.56 : 0.45;
    const rowSpan = (itemsInThisRow - 1) * stepRad;
    const baseDist = parentSat.radius + 94 + row * 94;
    const rowPhase = row % 2 === 1 && itemsInThisRow < maxPerRow ? 0.12 : 0;
    const baseTheta =
      itemsInThisRow === 1 ? bestAngle : bestAngle - rowSpan / 2 + indexInRow * stepRad + rowPhase;

    let chosenX = Math.round(parentSat.x + Math.cos(baseTheta) * baseDist);
    let chosenY = Math.round(parentSat.y + Math.sin(baseTheta) * baseDist);

    const hasCollision = (tx: number, ty: number) =>
      localObstacles.some((obs) => pointObstacleClearance(tx, ty, item.radius + 16, obs) < 0);

    if (hasCollision(chosenX, chosenY)) {
      let resolved = false;
      for (const extraR of [0, 26, 52]) {
        for (const extraA of [-0.22, 0.22, -0.44, 0.44]) {
          const tx = Math.round(parentSat.x + Math.cos(baseTheta + extraA) * (baseDist + extraR));
          const ty = Math.round(parentSat.y + Math.sin(baseTheta + extraA) * (baseDist + extraR));
          if (!hasCollision(tx, ty)) {
            chosenX = tx;
            chosenY = ty;
            resolved = true;
            break;
          }
        }
        if (resolved) break;
      }
    }

    attachedCoords.set(item.id, { x: chosenX, y: chosenY });
    localObstacles.push({ kind: 'circle', x: chosenX, y: chosenY, r: item.radius });
  }

  const placed = childDrafts.map((item) => {
    if (item.isDetachedChild || activeOverrideIds.has(item.id)) {
      const savedPos = taskPositions[item.id];
      if (savedPos) {
        return { ...item, x: savedPos.x, y: savedPos.y };
      }
    }
    const localPos = attachedCoords.get(item.id);
    if (localPos) {
      return { ...item, x: localPos.x, y: localPos.y };
    }
    return {
      ...item,
      x: Math.round(parentSat.x + Math.cos(bestAngle) * (parentSat.radius + 82)),
      y: Math.round(parentSat.y + Math.sin(bestAngle) * (parentSat.radius + 82)),
    };
  });

  return {
    placed,
    chosenAngle: attachedDrafts.length > 0 ? bestAngle : null,
  };
}

const EMPTY_EXPANDED_SET: ReadonlySet<string> = new Set();

/**
 * 计算三层星型层级布局：
 * 第 0 层：中心配置星核（Hub）
 * 第 1 层：一级核心任务节点（Core Task，带 +N 子任务角标）
 * 第 2 层：点击展开或独立改绑后的二级子任务节点（低频任务 & 能力代理子项）
 */
export function computeStarGraphLayout(params: {
  graph: AITaskGraphData | AITaskGraphSavePayload;
  kinds: readonly AITaskKindInfo[];
  usageByStatKey: ReadonlyMap<string, TaskUsageBucket>;
  metric: StarUsageMetric;
  showAllLowFreq: boolean;
  expandedParentIds?: ReadonlySet<string>;
  /** 当前正被指针按住拖拽的节点 ID 集合（允许未脱离母节点的子节点在拖拽途中实时跟手移动） */
  activeDraggingIds?: ReadonlySet<string>;
  isNarrow?: boolean;
}): StarGraphLayoutResult {
  const {
    graph,
    kinds,
    usageByStatKey,
    metric,
    showAllLowFreq,
    expandedParentIds = EMPTY_EXPANDED_SET,
    activeDraggingIds = EMPTY_EXPANDED_SET,
    isNarrow = false,
  } = params;
  const nodes = graph.nodes;
  if (nodes.length === 0) {
    return {
      hubs: [],
      satellites: [],
      totalMetric: 0,
      maxSatelliteMetric: 0,
      bounds: { minX: -400, maxX: 400, minY: -260, maxY: 260 },
    };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const highRoleId = nodes.find((n) => n.role === 'high')?.id ?? nodes[0].id;
  const lowRoleId = nodes.find((n) => n.role === 'low')?.id ?? nodes[0].id;
  const splitSet = new Set(graph.split_subagents);

  const routableAll = kinds.filter((k) => !k.follows_caller);
  const coreKinds: AITaskKindInfo[] = [];
  const childrenByParent = new Map<string, AITaskKindInfo[]>();

  for (const k of routableAll) {
    const parentId = resolveHierarchyParentTaskId(k);
    if (!parentId) {
      coreKinds.push(k);
    } else {
      const list = childrenByParent.get(parentId) ?? [];
      list.push(k);
      childrenByParent.set(parentId, list);
    }
  }

  // 若某个父核心任务在极端精简 mock 下不存在，则将其子任务提回一级展示，绝不吞节点
  const coreIdSet = new Set(coreKinds.map((k) => k.id));
  for (const [pid, list] of childrenByParent.entries()) {
    if (!coreIdSet.has(pid)) {
      for (const orphanChild of list) {
        if (!orphanChild.parent_id || splitSet.has(orphanChild.id)) {
          coreKinds.push(orphanChild);
        }
      }
      childrenByParent.delete(pid);
    }
  }

  const effectiveHubOf = (k: AITaskKindInfo): string => {
    if (k.parent_id === CAPABILITY_AGENT_TASK_ID) {
      if (splitSet.has(k.id)) {
        const mappedSub = graph.edges[k.id];
        if (mappedSub && nodeIds.has(mappedSub)) return mappedSub;
      }
      const parentMapped = graph.edges[CAPABILITY_AGENT_TASK_ID];
      if (parentMapped && nodeIds.has(parentMapped)) return parentMapped;
      return highRoleId;
    }
    const mapped = graph.edges[k.id];
    if (mapped && nodeIds.has(mapped)) return mapped;
    return k.default_level === 'high' ? highRoleId : lowRoleId;
  };

  // 单项原始用量（不含折叠子项叠加）
  const ownUsageByKindId = new Map<string, TaskUsageBucket>();
  let maxSingleMetric = 0;
  for (const k of routableAll) {
    const u = resolveTaskUsage(k, usageByStatKey);
    ownUsageByKindId.set(k.id, u);
    const val = metric === 'tokens' ? u.tokens : u.requests;
    if (val > maxSingleMetric) maxSingleMetric = val;
  }

  // 计算每个一级核心任务的聚合用量（折叠且未脱离的子节点用量折算进母节点，展开后各自显示）
  const coreDisplayUsage = new Map<string, TaskUsageBucket>();
  for (const ck of coreKinds) {
    const children = childrenByParent.get(ck.id) ?? [];
    const parentExpanded = showAllLowFreq || expandedParentIds.has(ck.id);
    const parentHubId = effectiveHubOf(ck);
    const tuckedChildren = parentExpanded
      ? []
      : children.filter((ch) => {
          if (ch.parent_id === CAPABILITY_AGENT_TASK_ID) {
            return !splitSet.has(ch.id);
          }
          return effectiveHubOf(ch) === parentHubId;
        });
    const agg = resolveTaskUsage(ck, usageByStatKey, tuckedChildren);
    coreDisplayUsage.set(ck.id, agg);
    const val = metric === 'tokens' ? agg.tokens : agg.requests;
    if (val > maxSingleMetric) maxSingleMetric = val;
  }

  const centers = defaultHubCenters(nodes.length, isNarrow);
  const positionedHubs = nodes.filter((n): n is AITaskGraphHubNode & { pos: AITaskGraphPos } =>
    Boolean(n.pos),
  );

  // PC 横向坐标在移动端打开（或移动端纵向坐标在 PC 打开）时，按各自星核相对偏移做整团星系方向自适应重映射
  let isOrientationProjected = false;
  const projectedHubCenters = new Map<string, AITaskGraphPos>();
  const effectiveTaskPositions: Record<string, AITaskGraphPos> = { ...graph.task_positions };

  if (nodes.length >= 2 && positionedHubs.length === nodes.length) {
    const xs = positionedHubs.map((h) => h.pos.x);
    const ys = positionedHubs.map((h) => h.pos.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const savedIsHorizontal = spanX > spanY * 1.15 && spanX > 220;
    const savedIsVertical = spanY > spanX * 1.15 && spanY > 240 && spanX < 150;

    if ((isNarrow && savedIsHorizontal) || (!isNarrow && savedIsVertical)) {
      isOrientationProjected = true;
      const ordered = [...positionedHubs].sort((a, b) =>
        savedIsHorizontal
          ? a.pos.x - b.pos.x || a.pos.y - b.pos.y
          : a.pos.y - b.pos.y || a.pos.x - b.pos.x,
      );
      const targetCenters = defaultHubCenters(ordered.length, isNarrow);
      const scale = isNarrow ? 0.84 : 1.15;
      const oldPosById = new Map(ordered.map((h) => [h.id, h.pos]));
      ordered.forEach((h, idx) => {
        projectedHubCenters.set(h.id, targetCenters[idx] ?? { x: 0, y: 0 });
      });

      for (const k of routableAll) {
        const savedSatPos = graph.task_positions[k.id];
        if (!savedSatPos) continue;
        const ownerHubId = effectiveHubOf(k);
        const oldHubPos = oldPosById.get(ownerHubId);
        const newHubPos = projectedHubCenters.get(ownerHubId);
        if (oldHubPos && newHubPos) {
          effectiveTaskPositions[k.id] = {
            x: Math.round(newHubPos.x + (savedSatPos.x - oldHubPos.x) * scale),
            y: Math.round(newHubPos.y + (savedSatPos.y - oldHubPos.y) * scale),
          };
        }
      }
    }
  }

  const hubs: StarHubLayoutItem[] = [];
  const coreSatellites: StarSatelliteItem[] = [];
  let unpositionedSeq = 0;

  // 统计每个星核实际承载的生效任务数与总用量（所有路由到该星核的顶层任务 + 已独立拆分的子代理）
  const activeAccountedKinds = routableAll.filter((k) => !k.parent_id || splitSet.has(k.id));

  nodes.forEach((node, hubIdx) => {
    let center: AITaskGraphPos;
    const projectedCenter = projectedHubCenters.get(node.id);
    if (projectedCenter) {
      center = projectedCenter;
    } else if (node.pos) {
      center = node.pos;
    } else if (positionedHubs.length > 0) {
      const avgX =
        positionedHubs.reduce((sum, item) => sum + item.pos.x, 0) / positionedHubs.length;
      const maxY = Math.max(...positionedHubs.map((item) => item.pos.y));
      const offsetX = isNarrow
        ? 0
        : unpositionedSeq === 0
          ? 0
          : (unpositionedSeq % 2 === 1 ? 1 : -1) * 290;
      const offsetY = isNarrow
        ? 460 * (unpositionedSeq + 1)
        : 260 + Math.floor(unpositionedSeq / 2) * 220;
      unpositionedSeq += 1;
      center = { x: Math.round(avgX + offsetX), y: Math.round(maxY + offsetY) };
    } else {
      center = centers[hubIdx] ?? { x: 0, y: 0 };
    }

    let hubTokens = 0;
    let hubRequests = 0;
    let hubTaskCount = 0;
    for (const ak of activeAccountedKinds) {
      if (effectiveHubOf(ak) !== node.id) continue;
      hubTaskCount += 1;
      const u =
        ak.id === CAPABILITY_AGENT_TASK_ID
          ? resolveTaskUsage(
              ak,
              usageByStatKey,
              (childrenByParent.get(CAPABILITY_AGENT_TASK_ID) ?? []).filter(
                (ch) => !splitSet.has(ch.id),
              ),
            )
          : (ownUsageByKindId.get(ak.id) ?? { tokens: 0, requests: 0 });
      hubTokens += u.tokens;
      hubRequests += u.requests;
    }

    const assignedCore = coreKinds.filter((ck) => effectiveHubOf(ck) === node.id);
    assignedCore.sort((a, b) => {
      const rank = (id: string) => (id === 'chat' ? 2 : id === 'autonomy' ? 1 : 0);
      const rDiff = rank(b.id) - rank(a.id);
      if (rDiff !== 0) return rDiff;
      const ua = coreDisplayUsage.get(a.id) ?? { tokens: 0, requests: 0 };
      const ub = coreDisplayUsage.get(b.id) ?? { tokens: 0, requests: 0 };
      return metric === 'tokens' ? ub.tokens - ua.tokens : ub.requests - ua.requests;
    });

    const coreDrafts: Omit<StarSatelliteItem, 'x' | 'y'>[] = assignedCore.map((ck) => {
      const u = coreDisplayUsage.get(ck.id) ?? { tokens: 0, requests: 0 };
      const val = metric === 'tokens' ? u.tokens : u.requests;
      const children = childrenByParent.get(ck.id) ?? [];
      const isExpanded = children.length > 0 && (showAllLowFreq || expandedParentIds.has(ck.id));
      return {
        id: ck.id,
        hubId: node.id,
        kind: ck,
        tier: 'core',
        parentTaskId: null,
        visualParentTaskId: null,
        childKinds: children,
        isExpandedParent: isExpanded,
        isDetachedChild: false,
        metricValue: val,
        usageShare: 0,
        hubUsageShare: 0,
        usageRank: null,
        tokens: u.tokens,
        requests: u.requests,
        radius: computeSatelliteRadius(val, maxSingleMetric),
      };
    });

    hubs.push({
      node,
      x: center.x,
      y: center.y,
      connectedTaskCount: hubTaskCount,
      totalTokens: hubTokens,
      totalRequests: hubRequests,
      metricValue: metric === 'tokens' ? hubTokens : hubRequests,
      usageShare: 0,
    });

    coreSatellites.push(
      ...placeCoreOrbitSatellites(
        center.x,
        center.y,
        coreDrafts,
        effectiveTaskPositions,
        hubIdx,
        nodes.length,
        isNarrow,
      ),
    );
  });

  const hubCenterById = new Map<string, AITaskGraphPos>();
  for (const h of hubs) hubCenterById.set(h.node.id, { x: h.x, y: h.y });

  const baseObstacles: LayoutObstacle[] = [
    ...hubs.map((h) => ({
      kind: 'rect' as const,
      x: h.x,
      y: h.y,
      r: 0,
      halfW: 118,
      halfH: 54,
    })),
    ...coreSatellites.map((cs) => ({
      kind: 'circle' as const,
      x: cs.x,
      y: cs.y,
      r: cs.radius,
    })),
  ];

  const childSatellites: StarSatelliteItem[] = [];
  for (const parentSat of coreSatellites) {
    const children = parentSat.childKinds;
    if (children.length === 0) continue;
    const isExpanded = parentSat.isExpandedParent;
    const visibleChildren: Omit<StarSatelliteItem, 'x' | 'y'>[] = [];

    for (const ch of children) {
      const childHubId = effectiveHubOf(ch);
      const isCapSub = ch.parent_id === CAPABILITY_AGENT_TASK_ID;
      const isDetached = isCapSub ? splitSet.has(ch.id) : childHubId !== parentSat.hubId;
      if (!isExpanded && !isDetached) continue;

      const u = ownUsageByKindId.get(ch.id) ?? { tokens: 0, requests: 0 };
      const val = metric === 'tokens' ? u.tokens : u.requests;
      visibleChildren.push({
        id: ch.id,
        hubId: childHubId,
        kind: ch,
        tier: 'child',
        parentTaskId: parentSat.id,
        visualParentTaskId: isDetached ? null : parentSat.id,
        childKinds: [],
        isExpandedParent: false,
        isDetachedChild: isDetached,
        metricValue: val,
        usageShare: 0,
        hubUsageShare: 0,
        usageRank: null,
        tokens: u.tokens,
        requests: u.requests,
        radius: computeSatelliteRadius(
          val,
          maxSingleMetric,
          MIN_CHILD_SATELLITE_RADIUS,
          MAX_CHILD_SATELLITE_RADIUS,
        ),
      });
    }

    const pHub = hubCenterById.get(parentSat.hubId) ?? { x: 0, y: 0 };
    const obstaclesExcludingSelf = baseObstacles.filter(
      (obs) => !(obs.kind === 'circle' && obs.x === parentSat.x && obs.y === parentSat.y),
    );
    const { placed, chosenAngle } = placeExpandedChildFan(
      parentSat,
      pHub.x,
      pHub.y,
      visibleChildren,
      effectiveTaskPositions,
      obstaclesExcludingSelf,
      activeDraggingIds,
    );
    parentSat.expandedFanAngle = chosenAngle;
    childSatellites.push(...placed);
    for (const pSat of placed) {
      baseObstacles.push({ kind: 'circle', x: pSat.x, y: pSat.y, r: pSat.radius });
    }
  }

  const allSatellites = [...coreSatellites, ...childSatellites];

  const totalHubMetric = hubs.reduce((sum, h) => sum + h.metricValue, 0);
  const totalSatMetric = allSatellites.reduce((sum, s) => sum + s.metricValue, 0);
  const totalMetric = Math.max(totalHubMetric, totalSatMetric);

  const hubMetricById = new Map<string, number>();
  for (const h of hubs) {
    h.usageShare = totalMetric > 0 ? Math.min(1, h.metricValue / totalMetric) : 0;
    hubMetricById.set(h.node.id, h.metricValue);
  }

  let maxSatelliteMetric = 0;
  for (const s of allSatellites) {
    if (s.metricValue > maxSatelliteMetric) maxSatelliteMetric = s.metricValue;
    s.usageShare = totalMetric > 0 ? Math.min(1, s.metricValue / totalMetric) : 0;
    const hubTotal = hubMetricById.get(s.hubId) ?? 0;
    s.hubUsageShare = hubTotal > 0 ? Math.min(1, s.metricValue / hubTotal) : 0;
  }

  const rankedActive = allSatellites
    .filter((s) => s.metricValue > 0)
    .sort((a, b) => b.metricValue - a.metricValue);
  rankedActive.forEach((sat, idx) => {
    sat.usageRank = idx + 1;
  });

  let minX = isNarrow ? -210 : -360;
  let maxX = isNarrow ? 210 : 360;
  let minY = -240;
  let maxY = 240;

  for (const h of hubs) {
    minX = Math.min(minX, h.x - 140);
    maxX = Math.max(maxX, h.x + 140);
    minY = Math.min(minY, h.y - 112);
    maxY = Math.max(maxY, h.y + 112);
  }
  for (const s of allSatellites) {
    minX = Math.min(minX, s.x - s.radius - 60);
    maxX = Math.max(maxX, s.x + s.radius + 60);
    minY = Math.min(minY, s.y - s.radius - 46);
    maxY = Math.max(maxY, s.y + s.radius + 66);
  }

  return {
    hubs,
    satellites: allSatellites,
    totalMetric,
    maxSatelliteMetric,
    bounds: { minX, maxX, minY, maxY },
    isOrientationProjected,
  };
}

const EMPTY_USAGE_MAP: ReadonlyMap<string, TaskUsageBucket> = new Map();

/**
 * 将星核与当前一级核心节点（及已脱离母节点的子节点）坐标固化为具体 (x, y)：
 * 未脱离的二级子节点动态扇形跟随母节点外圈展开，既让点击展开/收起不污染保存脏状态，
 * 又保证连线切换时一级核心节点与已独立节点绝不闪现。
 */
export function materializeGraphPositions(params: {
  graph: AITaskGraphSavePayload;
  kinds: readonly AITaskKindInfo[];
  usageByStatKey?: ReadonlyMap<string, TaskUsageBucket>;
  metric?: StarUsageMetric;
  showAllLowFreq?: boolean;
  isNarrow?: boolean;
}): AITaskGraphSavePayload {
  const {
    graph,
    kinds,
    usageByStatKey = EMPTY_USAGE_MAP,
    metric = 'tokens',
    isNarrow = false,
  } = params;

  const currentLayout = computeStarGraphLayout({
    graph,
    kinds,
    usageByStatKey,
    metric,
    showAllLowFreq: false,
    expandedParentIds: EMPTY_EXPANDED_SET,
    isNarrow,
  });

  const hubPosMap = new Map<string, AITaskGraphPos>();
  for (const h of currentLayout.hubs) {
    hubPosMap.set(h.node.id, { x: Math.round(h.x), y: Math.round(h.y) });
  }

  const nextNodes = graph.nodes.map((n) => ({
    ...n,
    pos: n.pos
      ? { x: Math.round(n.pos.x), y: Math.round(n.pos.y) }
      : (hubPosMap.get(n.id) ?? { x: 0, y: 0 }),
  }));

  // 仅保留一级核心节点与真正脱离母节点独立绑定的子节点坐标；剔除历史遗留的未脱离二级节点旧坐标
  const keepTaskPosIds = new Set(currentLayout.satellites.map((s) => s.id));
  const nextTaskPositions: Record<string, AITaskGraphPos> = {};
  for (const [k, p] of Object.entries(graph.task_positions)) {
    if (keepTaskPosIds.has(k)) {
      nextTaskPositions[k] = { x: Math.round(p.x), y: Math.round(p.y) };
    }
  }
  for (const sat of currentLayout.satellites) {
    if (!nextTaskPositions[sat.id]) {
      nextTaskPositions[sat.id] = { x: Math.round(sat.x), y: Math.round(sat.y) };
    }
  }

  return {
    nodes: nextNodes,
    edges: { ...graph.edges },
    split_subagents: [...graph.split_subagents],
    task_positions: nextTaskPositions,
  };
}

/** 用户主动点击「重新排版」时清空旧坐标，让各一级节点及已独立子节点重新聚拢至所属星核周围。 */
export function rearrangeGraphPositions(params: {
  graph: AITaskGraphSavePayload;
  kinds: readonly AITaskKindInfo[];
  usageByStatKey?: ReadonlyMap<string, TaskUsageBucket>;
  metric?: StarUsageMetric;
  showAllLowFreq?: boolean;
  isNarrow?: boolean;
}): AITaskGraphSavePayload {
  const cleared: AITaskGraphSavePayload = {
    ...params.graph,
    nodes: params.graph.nodes.map((n) => ({ ...n, pos: null })),
    task_positions: {},
  };
  const materialized = materializeGraphPositions({
    ...params,
    graph: cleared,
  });

  // 对于已脱离母节点独立绑定到某配置星核的二级子节点，也将其重排到目标星核外围，避免孤悬在旧远处
  const splitSet = new Set(materialized.split_subagents);
  const detachedChildLayout = computeStarGraphLayout({
    graph: materialized,
    kinds: params.kinds,
    usageByStatKey: params.usageByStatKey ?? EMPTY_USAGE_MAP,
    metric: params.metric ?? 'tokens',
    showAllLowFreq: false,
    expandedParentIds: EMPTY_EXPANDED_SET,
    isNarrow: params.isNarrow ?? false,
  });
  const hubMap = new Map(detachedChildLayout.hubs.map((h) => [h.node.id, h]));
  let detachedIdx = 0;
  for (const sat of detachedChildLayout.satellites) {
    if (sat.tier !== 'child' || !sat.isDetachedChild) continue;
    const targetHub = hubMap.get(sat.hubId);
    if (!targetHub) continue;
    const seed = hashString(sat.id);
    const angle = -Math.PI * 0.4 + detachedIdx * 0.48 + ((seed % 11) - 5) * 0.02;
    detachedIdx += 1;
    const dist = splitSet.has(sat.id) ? 162 : 172;
    materialized.task_positions[sat.id] = {
      x: Math.round(targetHub.x + Math.cos(angle) * dist),
      y: Math.round(targetHub.y + Math.sin(angle) * dist),
    };
  }

  return materialized;
}
