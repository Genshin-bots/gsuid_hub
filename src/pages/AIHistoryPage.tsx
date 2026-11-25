import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  History,
  Loader2,
  RefreshCw,
  Search,
  FileText,
  User,
  Bot,
  ChevronLeft,
  HardDrive,
  Cpu,
  Download,
  Users,
  Layers,
  Wrench,
  ChevronsUpDown,
  ChevronsDownUp,
  type LucideIcon,
} from 'lucide-react';
import {
  aiSessionLogsApi,
  aiTaskModelsApi,
  personaApi,
  type AITaskModelsData,
  type SessionLogSummary,
  type SessionLogDetail,
  type SessionLogEntry,
  type SegmentMeta,
  type SessionLogStatsOverview,
  type SessionLogCategoriesResponse,
  type SessionChainUsage,
} from '@/lib/api';
import { TASK_GROUP_ICON } from '@/lib/aiTaskKinds';
import { toast } from 'sonner';
import TraceWaterfall, { type TraceWaterfallHandle } from '@/components/ai-history/TraceWaterfall';
import { TokenBadges } from '@/components/ai-history/TokenBadges';
import { extractSessionUsage, type SessionUsage } from '@/components/ai-history/usage';
import { TaskKindFilterMenu } from '@/components/ai-history/TaskKindFilterMenu';
import {
  CAPABILITY_AGENT_TASK_PREFIX,
  DEFAULT_ALL_FILTER,
  buildTaskFilterModel,
  initialFilterFromSearchParams,
  parseTaskFilterValue,
  resolveSessionTaskKind,
  upgradeCreateByFilterToTaskKind,
  type TaskKindDisplayInfo,
} from '@/components/ai-history/taskFilter';

const DEFAULT_SELECT_VALUE = DEFAULT_ALL_FILTER;
const LIST_SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'];

// ============================================================================
// 工具函数
// ============================================================================

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// 解析 session_id → 展示名 + 聊天类型（web:web:client:group:xxx / :private:xxx）
function parseSessionId(sessionId: string | null | undefined): {
  displayName: string;
  chatType: 'group' | 'private' | null;
} {
  if (!sessionId) return { displayName: '', chatType: null };
  const parts = sessionId.split(':');
  if (parts.length >= 5) {
    const type = parts[3];
    const name = parts[4];
    if (type === 'group') return { displayName: name, chatType: 'group' };
    if (type === 'private') return { displayName: name, chatType: 'private' };
  }
  return { displayName: sessionId, chatType: null };
}

// create_by → 分组：后端分类目录（_CREATE_BY_CATALOG）没收录的来源（插件产出 / 新增核心来源，
// 如 Reactive_Gate / MemPreferenceExtraction）也能按命名规律落到合适图标，而不是一律 other。
// 后端已给出非 other 的 group 时优先用后端，这里只做兜底推断。
function inferGroup(createBy: string): string {
  const cb = createBy.toLowerCase();
  if (cb.startsWith('heartbeat') || cb.startsWith('reactive')) return 'heartbeat';
  // 'Meme'(表情包) 与 'Mem'(记忆) 大小写敏感区分：MemE…会被 lower 后误判，故用原串判 Meme
  if (createBy.startsWith('Meme') || cb.startsWith('sticker')) return 'meme';
  if (cb.startsWith('mem')) return 'memory';
  if (cb.startsWith('image') || cb.startsWith('img') || cb.startsWith('vision')) return 'image';
  if (cb.includes('persona')) return 'persona';
  if (cb.startsWith('kanban')) return 'kanban';
  if (cb.startsWith('schedul')) return 'scheduled';
  if (cb.startsWith('proactive')) return 'proactive';
  if (
    cb.startsWith('capagent') ||
    cb.includes('capability') ||
    cb.includes('planner') ||
    cb.endsWith('agent')
  )
    return 'capability';
  return 'other';
}

// 定向后台会话（心跳决策/输出、续聊闸门）：session_id = <prefix>_<persona>_<target>_<ts>，
// target = group_id 或 user_id。取倒数第二段（末段是时间戳）——正是"这条针对哪个群/私聊"的关键信息，
// 不能被折叠进类别标签里（否则每条都只剩「心跳决策」四个字）。
const TARGETED_PREFIXES = ['heartbeat_decision_', 'heartbeat_output_', 'reactive_gate_'];
function targetedTarget(sessionId: string): string | null {
  if (!TARGETED_PREFIXES.some((p) => sessionId.startsWith(p))) return null;
  const parts = sessionId.split('_');
  return parts.length >= 2 ? parts[parts.length - 2] || null : null;
}

// 未收录来源的兜底展示名：下划线转空格（Reactive_Gate → Reactive Gate）
function humanizeCreateBy(createBy: string): string {
  return createBy.replace(/_/g, ' ').trim();
}

// 记忆等后台抽取子 agent 的 session_id：auto_{create_by}_{scope}_{uuid}，scope 段由后端
// _scope_id_segment 写入（group-<gid> / uglobal-<uid> / uingroup-<uid>@<gid> / self-<x>），
// 解出「针对哪个群/用户」。旧日志（无 scope 段）返回 null，回退到只显类别标签。
// 中文前缀与后端类别标签（记忆实体抽取…）同为中文，保持整名风格一致。
function parseAutoScope(sessionId: string, createBy: string): string | null {
  const prefix = `auto_${createBy}_`;
  if (!sessionId.startsWith(prefix)) return null;
  const m = sessionId
    .slice(prefix.length)
    .match(/^(group|uglobal|uingroup|self)-(.+)_[0-9a-f]{6,}$/);
  if (!m) return null;
  const [, code, id] = m;
  if (code === 'group') return `群 ${id}`;
  if (code === 'uglobal') return `用户 ${id}`;
  if (code === 'uingroup') {
    const [uid, gid] = id.split('@');
    return gid ? `用户 ${uid} · 群 ${gid}` : `用户 ${uid}`;
  }
  return '自身'; // self
}

interface SessionDisplay {
  name: string; // 简短、可辨识的展示名
  Icon: LucideIcon; // 无人格时的头像图标
}

// 把冗长的 session_id 归一为「简短名 + 类型图标」：常规聊天取会话名；能力 Agent 优先取中文代理名；
// 心跳/续聊等定向会话保留目标；其余优先取 task_kind 标题，再回退后端分类标签与 create_by。
function describeSession(
  log: { session_id: string; create_by: string; task_kind?: string | null },
  catMap: Map<string, { label: string; group: string }>,
  taskKindInfoById: Map<string, TaskKindDisplayInfo>,
): SessionDisplay {
  const cat = catMap.get(log.create_by);
  const inferredTk = resolveSessionTaskKind(log);
  const tkInfo = inferredTk ? taskKindInfoById.get(inferredTk) : undefined;
  const isCapAgent = inferredTk.startsWith(CAPABILITY_AGENT_TASK_PREFIX);

  const group =
    tkInfo?.group && tkInfo.group !== 'other'
      ? tkInfo.group
      : cat?.group && cat.group !== 'other'
        ? cat.group
        : inferGroup(log.create_by);
  const Icon = isCapAgent ? Wrench : (TASK_GROUP_ICON[group] ?? Bot);
  const parsed = parseSessionId(log.session_id);
  const resolvedLabel = tkInfo?.title ?? cat?.label ?? humanizeCreateBy(log.create_by);

  // 1) 常规聊天：session_id 形如 platform:...:group/private:xxx → 会话名（群名/私聊名）
  if (parsed.chatType) return { name: parsed.displayName, Icon };
  // 2) 能力 Agent：优先展示代理中文 display_name，未登记则回退 node_id
  if (isCapAgent) {
    const fallbackNode = inferredTk.slice(CAPABILITY_AGENT_TASK_PREFIX.length);
    return { name: tkInfo?.title || fallbackNode || resolvedLabel, Icon };
  }
  // 3) 定向后台会话（心跳/续聊）：类别标签 + 目标（群号/用户），别把不同目标折叠成同一个名字
  const target = targetedTarget(log.session_id);
  if (target) return { name: `${resolvedLabel} · ${target}`, Icon };
  // 3.5) 记忆等后台抽取子 agent：auto_ id 里编了 scope → 显示"针对哪个群/用户"
  const autoScope = parseAutoScope(log.session_id, log.create_by);
  if (autoScope) return { name: `${resolvedLabel} · ${autoScope}`, Icon };
  // 4) 其它系统/子任务：优先 task_kind 标题 → 后端归类标签 → create_by 兜底
  if (tkInfo) return { name: tkInfo.title, Icon };
  if (cat) return { name: cat.label, Icon };
  return { name: humanizeCreateBy(log.create_by) || parsed.displayName, Icon };
}

function ChatTypeBadge({ sessionId, t }: { sessionId: string; t: (k: string) => string }) {
  const { chatType } = parseSessionId(sessionId);
  if (chatType === 'group') {
    return (
      <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
        <Users className="w-2.5 h-2.5 mr-0.5" />
        {t('aiHistory.chatTypeGroup')}
      </Badge>
    );
  }
  if (chatType === 'private') {
    return (
      <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
        <User className="w-2.5 h-2.5 mr-0.5" />
        {t('aiHistory.chatTypePrivate')}
      </Badge>
    );
  }
  return null;
}

// 后端整链用量 → 前端 SessionUsage 展示结构（costUnits 即按模型归并的计价单元）
function chainUsageToSessionUsage(u: SessionChainUsage): SessionUsage {
  return {
    inp: u.input_tokens,
    out: u.output_tokens,
    cr: u.cache_read_tokens,
    cw: u.cache_write_tokens,
    runs: u.runs,
    pct: u.input_tokens > 0 ? Math.round((u.cache_read_tokens / u.input_tokens) * 100) : null,
    costUnits: u.models.map((m) => ({
      model: m.model,
      inp: m.input_tokens,
      out: m.output_tokens,
      cr: m.cache_read_tokens,
      cw: m.cache_write_tokens,
    })),
  };
}

// 从卡片派生分段列表（旧卡片无 segments 时回退为单分段）
function cardSegments(card: SessionLogSummary): SegmentMeta[] {
  if (card.segments && card.segments.length > 0) {
    return [...card.segments].sort((a, b) => a.segment_index - b.segment_index);
  }
  return [
    {
      segment_index: card.segment_index ?? 0,
      session_uuid: card.session_uuid,
      session_id: card.session_id,
      file_name: card.file_name,
      entry_count: card.entry_count,
      created_at: card.created_at,
      updated_at: card.updated_at,
      ended_at: card.ended_at,
      is_active: card.is_active,
      source: card.source,
    },
  ];
}

// ============================================================================
// 主组件
// ============================================================================

export default function AIHistoryPage() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const linkedQuery = searchParams.get('q') ?? '';
  const initialFilter = initialFilterFromSearchParams(searchParams);

  const tr = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => {
      const value = t(key, params);
      return value === key ? fallback : value;
    },
    [t],
  );

  // 数据
  const [logs, setLogs] = useState<SessionLogSummary[]>([]);
  const [stats, setStats] = useState<SessionLogStatsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false);
  const [categoriesData, setCategoriesData] = useState<SessionLogCategoriesResponse | null>(null);
  const [taskModels, setTaskModels] = useState<AITaskModelsData | null>(null);

  // 选中链
  const [selectedCard, setSelectedCard] = useState<SessionLogSummary | null>(null);
  const [mainDetail, setMainDetail] = useState<SessionLogDetail | null>(null);
  // 已加载分段：segment_index -> entries（按 index 升序拼接成完整时间线）
  const [segEntries, setSegEntries] = useState<Record<number, SessionLogEntry[]>>({});
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  // 整链 token 用量（后端 /usage 接口，覆盖未懒加载分段）；取不到时回退已加载 entries 统计
  const [chainUsage, setChainUsage] = useState<SessionUsage | null>(null);

  // 详情滚动：打开会话定位到最新；「加载更早」前置内容时锚定视口不跳动
  const detailViewportRef = useRef<HTMLDivElement>(null);
  const pendingScrollBottomRef = useRef(false);
  const scrollAnchorRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  // 列表 / 详情 / 整链用量竞态守卫：快速切换筛选或卡片时只允许最后一次请求落地
  const logsSeqRef = useRef(0);
  const detailSeqRef = useRef(0);
  const usageSeqRef = useRef(0);

  // 筛选（默认选中主对话 task:chat）
  const [searchQuery, setSearchQuery] = useState(linkedQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(linkedQuery);
  const [filterTask, setFilterTask] = useState<string>(initialFilter);
  const [filterPersona, setFilterPersona] = useState<string>(DEFAULT_SELECT_VALUE);
  const [filterDateFrom] = useState('');
  const [filterDateTo] = useState('');

  // 分页
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // 瀑布「全部展开/收起」句柄：按钮常驻详情头部，不随内容滚走
  const waterfallRef = useRef<TraceWaterfallHandle>(null);

  // 拼接后的完整时间线 entries（按 segment_index 升序）
  const mainEntries = useMemo(() => {
    return Object.keys(segEntries)
      .map(Number)
      .sort((a, b) => a - b)
      .flatMap((i) => segEntries[i]);
  }, [segEntries]);

  const loadedSegCount = Object.keys(segEntries).length;
  const legacyCreateByOnly = categoriesData !== null && !categoriesData.task_kinds;

  // ── 数据拉取 ──────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      setStats(await aiSessionLogsApi.getStatsOverview());
    } catch (err) {
      console.error('Failed to fetch session log stats:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await aiSessionLogsApi.getCategories();
      setCategoriesData(data);
    } catch (err) {
      console.error('Failed to fetch session log categories:', err);
    }
  }, []);

  const fetchTaskModels = useCallback(async () => {
    try {
      const data = await aiTaskModelsApi.list();
      setTaskModels(data);
    } catch {
      // 旧后端无 /api/ai_task_models 时降级为仅展示 categories
    }
  }, []);

  const fetchLogs = useCallback(
    async (currentOffset = 0) => {
      const seq = ++logsSeqRef.current;
      try {
        setIsLoading(true);
        const parsed = parseTaskFilterValue(filterTask);
        let taskKindParam: string | undefined;
        let createByParam: string | undefined;
        let unmappedOnlyParam: boolean | undefined;
        if (parsed.mode === 'task') {
          if (legacyCreateByOnly && parsed.taskKind === 'chat') {
            createByParam = 'Chat';
          } else {
            taskKindParam = parsed.taskKind;
          }
        } else if (parsed.mode === 'unmapped') {
          createByParam = parsed.createBy;
          unmappedOnlyParam = true;
        } else if (parsed.mode === 'create_by') {
          createByParam = parsed.createBy;
        }
        const data = await aiSessionLogsApi.getLogs({
          search: debouncedSearch || undefined,
          task_kind: taskKindParam,
          create_by: createByParam,
          unmapped_only: unmappedOnlyParam,
          persona_name: filterPersona !== DEFAULT_SELECT_VALUE ? filterPersona : undefined,
          date_from: filterDateFrom || undefined,
          date_to: filterDateTo || undefined,
          limit,
          offset: currentOffset,
        });
        if (seq !== logsSeqRef.current) return;
        setLogs(data.items || []);
        setTotal(data.total || 0);
        setOffset(currentOffset);
        setHasLoadedLogs(true);
      } catch (err) {
        if (seq !== logsSeqRef.current) return;
        console.error('Failed to fetch session logs:', err);
        toast.error(t('aiHistory.loadFailed'));
      } finally {
        if (seq === logsSeqRef.current) setIsLoading(false);
      }
    },
    [
      debouncedSearch,
      filterTask,
      legacyCreateByOnly,
      filterPersona,
      filterDateFrom,
      filterDateTo,
      t,
    ],
  );

  // 拉取单个分段详情：内存活跃分段按真实 session_id 取实时数据，磁盘分段按文件名 stem O(1) 取
  const fetchSegment = useCallback(async (seg: SegmentMeta): Promise<SessionLogDetail | null> => {
    const uuid = seg.session_uuid || undefined;
    if (seg.source === 'memory') {
      return aiSessionLogsApi.getLogDetail(seg.session_id, uuid);
    }
    const stem = seg.file_name ? seg.file_name.replace(/\.json$/, '') : seg.session_id;
    return aiSessionLogsApi.getLogDetail(stem, uuid);
  }, []);

  // 选中一条链：先加载最新分段（懒加载——更早分段按需再取）
  const selectCard = useCallback(
    async (card: SessionLogSummary) => {
      setSelectedCard(card);
      setMainDetail(null);
      setSegEntries({});
      setChainUsage(null);
      setIsLoadingDetail(true);
      pendingScrollBottomRef.current = true;
      scrollAnchorRef.current = null;
      // 整链用量实时重取（活跃链卡片 usage 可能滞后）；旧后端无此接口 → 回退已加载统计
      const usageSeq = ++usageSeqRef.current;
      void aiSessionLogsApi
        .getChainUsage(card.chain_id)
        .then((u) => {
          if (usageSeq === usageSeqRef.current) setChainUsage(chainUsageToSessionUsage(u));
        })
        .catch((err) => {
          console.warn('Failed to fetch chain usage, fallback to loaded entries:', err);
          if (usageSeq === usageSeqRef.current && card.usage) {
            setChainUsage(chainUsageToSessionUsage(card.usage));
          }
        });
      const detailSeq = ++detailSeqRef.current;
      try {
        const segs = cardSegments(card);
        const latest = segs[segs.length - 1];
        const d = await fetchSegment(latest);
        if (detailSeq !== detailSeqRef.current) return;
        if (d) {
          setMainDetail(d);
          setSegEntries({ [latest.segment_index]: d.entries || [] });
        }
      } catch (err) {
        if (detailSeq !== detailSeqRef.current) return;
        console.error('Failed to fetch chain detail:', err);
        toast.error(t('aiHistory.loadDetailFailed'));
      } finally {
        if (detailSeq === detailSeqRef.current) setIsLoadingDetail(false);
      }
    },
    [fetchSegment, t],
  );

  // 加载更早分段（把未加载的分段并发取回、并入时间线）
  const loadEarlierSegments = useCallback(async () => {
    if (!selectedCard) return;
    const segs = cardSegments(selectedCard);
    const missing = segs.filter((s) => !(s.segment_index in segEntries));
    if (missing.length === 0) return;
    setIsLoadingEarlier(true);
    try {
      const results = await Promise.all(
        missing.map((s) => fetchSegment(s).then((d) => [s.segment_index, d] as const)),
      );
      const vp = detailViewportRef.current;
      if (vp) {
        scrollAnchorRef.current = { prevHeight: vp.scrollHeight, prevTop: vp.scrollTop };
      }
      setSegEntries((prev) => {
        const next = { ...prev };
        for (const [idx, d] of results) {
          if (d) next[idx] = d.entries || [];
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to load earlier segments:', err);
      toast.error(t('aiHistory.loadDetailFailed'));
    } finally {
      setIsLoadingEarlier(false);
    }
  }, [selectedCard, segEntries, fetchSegment, t]);

  // 供 waterfall 展开子 Agent 时懒加载其 trace（用 log_file 的 stem 作 session_id）
  const loadSubAgent = useCallback(
    async (agentData: Record<string, unknown>): Promise<SessionLogEntry[] | null> => {
      const logFile = typeof agentData.log_file === 'string' ? agentData.log_file : '';
      const sid = logFile
        ? logFile.replace(/^.*[\\/]/, '').replace(/\.json$/, '')
        : (agentData.session_id as string) || '';
      if (!sid) return null;
      const uuid = typeof agentData.session_uuid === 'string' ? agentData.session_uuid : undefined;
      const d = await aiSessionLogsApi.getLogDetail(sid, uuid);
      return d?.entries ?? null;
    },
    [],
  );

  // ── effects ───────────────────────────────────────────────────────────
  // 产出物页用 ?create_by=&q= 或 ?task_kind=&q= 跳过来。页已经开着时也要跟上这次查询。
  useEffect(() => {
    const q = searchParams.get('q');
    const createBy = searchParams.get('create_by');
    const taskKind = searchParams.get('task_kind');
    if (q === null && !createBy && !taskKind) return;
    if (q !== null) {
      setSearchQuery(q);
      setDebouncedSearch(q);
    }
    if (taskKind || createBy) {
      setFilterTask(initialFilterFromSearchParams(searchParams));
    }
  }, [searchParams]);

  // 任务注册表就绪后，把 1:1 对应的 ?create_by=（如 Autonomy）归一化为对应 task_kind 选中态
  useEffect(() => {
    if (!taskModels || !categoriesData?.task_kinds) return;
    setFilterTask((prev) => upgradeCreateByFilterToTaskKind(prev, taskModels.kinds));
  }, [taskModels, categoriesData]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    fetchStats();
    fetchCategories();
    fetchTaskModels();
  }, [fetchStats, fetchCategories, fetchTaskModels]);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  // 打开会话定位到最新消息；「加载更早」把内容前置时按高度差锚定视口不跳动
  useLayoutEffect(() => {
    const vp = detailViewportRef.current;
    if (!vp) return;
    const anchor = scrollAnchorRef.current;
    if (anchor) {
      scrollAnchorRef.current = null;
      const diff = vp.scrollHeight - anchor.prevHeight;
      if (diff > 0) vp.scrollTop = anchor.prevTop + diff;
      return;
    }
    if (pendingScrollBottomRef.current && !isLoadingDetail) {
      pendingScrollBottomRef.current = false;
      vp.scrollTop = vp.scrollHeight;
    }
  }, [segEntries, isLoadingDetail]);

  // ── 操作 ──────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    fetchStats();
    fetchCategories();
    fetchTaskModels();
    fetchLogs(0);
    if (selectedCard) selectCard(selectedCard);
  }, [fetchStats, fetchCategories, fetchTaskModels, fetchLogs, selectedCard, selectCard]);

  const handleDownloadSession = useCallback(() => {
    if (!mainDetail) return;
    const jsonStr = JSON.stringify({ ...mainDetail, entries: mainEntries }, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${mainDetail.session_id}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('aiHistory.downloadSuccess'));
  }, [mainDetail, mainEntries, t]);

  const handleApplyFilter = useCallback(() => setDebouncedSearch(searchQuery), [searchQuery]);
  const handlePrevPage = useCallback(() => {
    if (offset >= limit) fetchLogs(offset - limit);
  }, [offset, fetchLogs]);
  const handleNextPage = useCallback(() => {
    if (offset + limit < total) fetchLogs(offset + limit);
  }, [offset, total, fetchLogs]);

  const handleBackToList = () => {
    setSelectedCard(null);
    setMainDetail(null);
    setSegEntries({});
  };

  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData]);

  // create_by → {label, group}：供 describeSession 兜底归一化展示名 + 选类型图标
  const categoryMap = useMemo(() => {
    const m = new Map<string, { label: string; group: string }>();
    for (const c of categories) m.set(c.create_by, { label: c.label, group: c.group });
    return m;
  }, [categories]);

  const totalSessionCount = useMemo(() => {
    if (stats?.total !== undefined) return stats.total;
    return categories.reduce((sum, c) => sum + c.count, 0);
  }, [stats, categories]);

  const taskFilterModel = useMemo(
    () => buildTaskFilterModel(taskModels, categoriesData, totalSessionCount, tr),
    [taskModels, categoriesData, totalSessionCount, tr],
  );

  // 优先用后端全量 personas（不受当前 50 条分页限制）；旧后端降级从当前页提取
  const personaOptions = useMemo(() => {
    const items: Array<{ name: string; count?: number }> = [];
    const seen = new Set<string>();
    if (categoriesData?.personas) {
      for (const p of categoriesData.personas) {
        if (!p.persona_name || seen.has(p.persona_name)) continue;
        seen.add(p.persona_name);
        items.push({ name: p.persona_name, count: p.count });
      }
    } else {
      for (const l of logs) {
        if (!l.persona_name || seen.has(l.persona_name)) continue;
        seen.add(l.persona_name);
        items.push({ name: l.persona_name });
      }
    }
    if (filterPersona !== DEFAULT_SELECT_VALUE && !seen.has(filterPersona)) {
      items.push({ name: filterPersona });
    }
    return items;
  }, [categoriesData, logs, filterPersona]);

  // 会话 token 总量与计费单元：整链接口优先（含未加载分段），取不到时回退已加载 entries 汇总
  const sessionUsage = useMemo(
    () => chainUsage ?? extractSessionUsage(mainEntries),
    [chainUsage, mainEntries],
  );

  const personaName = mainDetail?.persona_name || selectedCard?.persona_name || '';
  const avatarUrl = personaName ? personaApi.getAvatarUrl(personaName) : '';
  const totalSegCount = selectedCard ? cardSegments(selectedCard).length : 0;
  // 详情副标题里的来源：优先展示 task_kind 本地化标题（能力代理带父级前缀），再回退分类短标签
  const createByLabel = useMemo(() => {
    const target = mainDetail ?? selectedCard;
    if (!target) return '';
    const inferredTk = resolveSessionTaskKind(target);
    const tkInfo = inferredTk ? taskFilterModel.taskKindInfoById.get(inferredTk) : undefined;
    if (tkInfo) {
      return tkInfo.parentTitle ? `${tkInfo.parentTitle} · ${tkInfo.title}` : tkInfo.title;
    }
    return categoryMap.get(target.create_by)?.label ?? target.create_by;
  }, [mainDetail, selectedCard, taskFilterModel, categoryMap]);
  const hasEarlier = selectedCard ? loadedSegCount < totalSegCount : false;
  const linkedAgentCount = selectedCard?.linked_agent_count ?? 0;
  const linkedEntryCount = (selectedCard?.linked_agents ?? []).reduce(
    (sum, agent) => sum + (agent.entry_count || 0),
    0,
  );
  // 详情头部：与列表一致地展示简短名 + 类型图标（selectedCard 在分类未随详情返回时兜底）
  const detailDesc = mainDetail
    ? describeSession(mainDetail, categoryMap, taskFilterModel.taskKindInfoById)
    : selectedCard
      ? describeSession(selectedCard, categoryMap, taskFilterModel.taskKindInfoById)
      : null;
  const DetailIcon = detailDesc?.Icon ?? Bot;

  return (
    <TooltipProvider>
      {/* 页面唯一的表面层：glass-card 按 [data-style] 自动适配（毛玻璃=模糊半透明卡底、
          纯色=不透明卡片），保证内容在任意壁纸/暗色下可读；内部不再嵌套盒子 */}
      {/* overflow 必须在阴影宿主内部：宿主 glass-card 保持 overflow:visible，阴影才能贴合圆角 */}
      <div className="page-fill flex glass-card">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]">
          {/* ── 左侧：链列表 ── */}
          <div
            className={cn(
              'border-r border-border/40 flex flex-col shrink-0',
              'w-full absolute inset-0 z-10 sm:relative sm:w-80 lg:w-96',
              selectedCard ? 'hidden sm:flex' : 'flex',
            )}
          >
            <div className="p-4 border-b border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  {t('aiHistory.title')}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="h-8 w-8"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* 统计概览：一行轻量文本，不做卡片盒子 */}
              <div className="flex items-center gap-3 md:gap-4 text-xs text-muted-foreground min-w-0">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <HardDrive className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('aiHistory.statsTotalFiles')}</span>
                  <span className="font-semibold text-foreground tabular-nums shrink-0">
                    {stats?.total ?? '-'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <Cpu className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('aiHistory.statsActiveSessions')}</span>
                  <span
                    className={cn(
                      'font-semibold text-foreground tabular-nums shrink-0',
                      (stats?.active_count ?? 0) > 0 && 'text-green-600 dark:text-green-400',
                    )}
                  >
                    {stats?.active_count ?? '-'}
                  </span>
                </span>
              </div>

              {/* 搜索（输入即筛，Enter 立即生效） */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('aiHistory.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                  className="pl-9 h-9 text-sm border-border/40 bg-card/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              {/* 筛选：任务类型 + 人格（选择即生效，无需额外按钮） */}
              <div className="flex items-center gap-2">
                <TaskKindFilterMenu
                  model={taskFilterModel}
                  value={filterTask}
                  onValueChange={setFilterTask}
                  tr={tr}
                />
                <Select value={filterPersona} onValueChange={setFilterPersona}>
                  <SelectTrigger className="flex-1 min-w-0 h-9 text-xs">
                    <SelectValue placeholder={t('aiHistory.filterPersona')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_SELECT_VALUE}>{t('aiHistory.filterAll')}</SelectItem>
                    {personaOptions.map((opt) => (
                      <SelectItem key={opt.name} value={opt.name}>
                        {opt.count !== undefined ? `${opt.name} (${opt.count})` : opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 列表 */}
            <ScrollArea className="flex-1">
              {isLoading && !hasLoadedLogs ? (
                <div className="space-y-3 p-3">
                  {LIST_SKELETON_KEYS.map((key) => (
                    <Skeleton key={key} className="h-16 w-full" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">{t('aiHistory.noLogs')}</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {logs
                    .filter((log) => log.session_id)
                    .map((log) => {
                      const isSelected = selectedCard?.chain_id === log.chain_id;
                      const segCount = log.segment_count ?? 1;
                      const { name: displayName, Icon: TypeIcon } = describeSession(
                        log,
                        categoryMap,
                        taskFilterModel.taskKindInfoById,
                      );
                      // created_at_str 形如 "2026-07-09 09:44:51" → 取 "07-09 09:44"
                      const shortTime = log.created_at_str ? log.created_at_str.slice(5, 16) : '';
                      return (
                        <button
                          key={log.chain_id || log.session_uuid}
                          type="button"
                          onClick={() => selectCard(log)}
                          className={cn(
                            'w-full p-2.5 rounded-lg text-left transition-colors',
                            isSelected
                              ? 'bg-primary/10 ring-1 ring-inset ring-primary/25'
                              : 'hover:bg-accent/60',
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* persona 头像 + 活跃绿点（脉冲） */}
                            <div className="relative shrink-0">
                              <Avatar className="w-10 h-10 rounded-xl">
                                <AvatarImage
                                  src={
                                    log.persona_name
                                      ? personaApi.getAvatarUrl(log.persona_name)
                                      : undefined
                                  }
                                  alt={log.persona_name || ''}
                                />
                                <AvatarFallback className="rounded-xl bg-muted text-muted-foreground text-xs">
                                  {/* 有人格 → 人格首字（配合上面的头像图）；无人格 → 按任务类型给图标 */}
                                  {log.persona_name ? (
                                    log.persona_name.slice(0, 2)
                                  ) : (
                                    <TypeIcon className="w-4 h-4" />
                                  )}
                                </AvatarFallback>
                              </Avatar>
                              {log.is_active && (
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500 ring-2 ring-card" />
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* 行1：名称 + 类型徽章 ……… 时间（右对齐） */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                {/* min-w-0 必不可少：flex 子项默认 min-width:auto 会让长 session_id
                                  撑破容器（无省略号、把时间挤出视口）；加上后才真正省略截断。
                                  title 原生 tooltip 让超长的子/看板 Agent 名可 hover 看全。 */}
                                <span
                                  className="text-sm font-medium truncate min-w-0"
                                  title={log.session_id}
                                >
                                  {displayName}
                                </span>
                                <ChatTypeBadge sessionId={log.session_id} t={t} />
                                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                                  {shortTime}
                                </span>
                              </div>
                              {/* 行2：人格 · 条数（+ 分段/子Agent 紧凑徽章） */}
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground min-w-0">
                                {log.persona_name && (
                                  <>
                                    <span className="truncate min-w-0">{log.persona_name}</span>
                                    <span className="shrink-0 opacity-40">·</span>
                                  </>
                                )}
                                <span className="shrink-0 tabular-nums">
                                  {log.entry_count} {t('aiHistory.entries')}
                                </span>
                                {segCount > 1 && (
                                  <Badge
                                    variant="secondary"
                                    className="ml-1 shrink-0 h-4 px-1 gap-0.5 text-[10px]"
                                  >
                                    <Layers className="w-2.5 h-2.5" />
                                    {segCount}
                                  </Badge>
                                )}
                                {log.linked_agent_count > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 h-4 px-1 gap-0.5 text-[10px] text-violet-500 border-violet-500/30"
                                  >
                                    <Bot className="w-2.5 h-2.5" />
                                    {log.linked_agent_count}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </ScrollArea>

            {/* 分页 */}
            {total > 0 && (
              <div className="p-3 border-t border-border/50 flex items-center justify-between text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={offset === 0 || isLoading}
                  className="h-7 px-2"
                >
                  {t('common.previousPage')}
                </Button>
                <span className="text-muted-foreground">
                  {t('common.pageInfo', {
                    current: Math.floor(offset / limit) + 1,
                    total: Math.ceil(total / limit),
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={offset + limit >= total || isLoading}
                  className="h-7 px-2"
                >
                  {t('common.nextPage')}
                </Button>
              </div>
            )}
          </div>

          {/* ── 右侧：Trace 瀑布 ── */}
          <div
            className={cn(
              'flex-1 flex flex-col min-w-0 overflow-hidden',
              selectedCard ? 'flex' : 'hidden sm:flex',
            )}
          >
            {selectedCard && mainDetail ? (
              <>
                {/* 详情头部 */}
                <div className="h-auto min-h-14 py-2 sm:h-14 sm:py-0 border-b border-border/40 px-3 sm:px-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="sm:hidden h-8 w-8 shrink-0"
                      onClick={handleBackToList}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarImage src={avatarUrl} alt={personaName} />
                      <AvatarFallback className="bg-indigo-500/10 text-indigo-600">
                        {personaName ? personaName.slice(0, 2) : <DetailIcon className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h2
                          className="font-semibold text-sm truncate min-w-0"
                          title={mainDetail.session_id}
                        >
                          {detailDesc?.name || parseSessionId(mainDetail.session_id).displayName}
                        </h2>
                        <ChatTypeBadge sessionId={mainDetail.session_id} t={t} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {personaName ? `${personaName} · ` : ''}
                        {createByLabel} · {selectedCard.entry_count} {t('aiHistory.entries')}
                        {linkedAgentCount > 0 &&
                          ` · ${t('aiHistory.linkedAgentsSummary', {
                            count: linkedAgentCount,
                            entries: linkedEntryCount,
                          })}`}
                        {totalSegCount > 1 &&
                          ` · ${t('aiHistory.segmentsCount', { count: totalSegCount })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(sessionUsage.inp > 0 || sessionUsage.out > 0) && (
                      <TokenBadges
                        inTok={sessionUsage.inp}
                        outTok={sessionUsage.out}
                        cacheR={sessionUsage.cr}
                        cacheW={sessionUsage.cw}
                        costUnits={sessionUsage.costUnits}
                        showSigma
                        className="hidden lg:inline-flex"
                        t={t}
                      />
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {formatTimestamp(selectedCard.created_at)}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => waterfallRef.current?.expandAll()}
                          className="h-8 w-8 hidden sm:inline-flex"
                        >
                          <ChevronsUpDown className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('aiHistory.waterfall.expandAll')}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => waterfallRef.current?.collapseAll()}
                          className="h-8 w-8 hidden sm:inline-flex"
                        >
                          <ChevronsDownUp className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('aiHistory.waterfall.collapseAll')}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefresh}
                      disabled={isLoadingDetail}
                      className="h-8 w-8"
                    >
                      {isLoadingDetail ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleDownloadSession}
                          className="h-8 w-8"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('aiHistory.downloadSession')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* 瀑布内容 */}
                <ScrollArea className="flex-1 min-w-0" viewportRef={detailViewportRef}>
                  <div className="min-w-0 max-w-full px-3 sm:px-5 pt-3 pb-8">
                    {/* 加载更早分段 */}
                    {hasEarlier && (
                      <div className="mb-2 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadEarlierSegments}
                          disabled={isLoadingEarlier}
                          className="h-7 gap-1.5 text-xs"
                        >
                          {isLoadingEarlier ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Layers className="w-3.5 h-3.5" />
                          )}
                          {t('aiHistory.loadEarlierSegments', {
                            count: totalSegCount - loadedSegCount,
                          })}
                        </Button>
                      </div>
                    )}

                    {isLoadingDetail ? (
                      <div className="space-y-2">
                        {/* 骨架形状贴近真实内容：run 块卡片（头 + 体）交替 */}
                        <Skeleton className="h-9 w-full rounded-xl" />
                        <Skeleton className="h-44 w-full rounded-xl" />
                        <Skeleton className="h-9 w-full rounded-xl" />
                        <Skeleton className="h-28 w-full rounded-xl" />
                        <Skeleton className="h-9 w-full rounded-xl" />
                      </div>
                    ) : mainEntries.length > 0 ? (
                      <TraceWaterfall
                        ref={waterfallRef}
                        entries={mainEntries}
                        t={t}
                        loadSubAgent={loadSubAgent}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileText className="w-10 h-10 mb-3 opacity-40" />
                        <p className="text-sm">{t('aiHistory.noEntries')}</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <History className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm">{t('aiHistory.selectSession')}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t('aiHistory.selectSessionHint')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
