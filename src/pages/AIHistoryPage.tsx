import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn, formatTokens } from '@/lib/utils';
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
  MessageSquare,
  Wrench,
  Image as ImageIcon,
  UserCog,
  Activity,
  Smile,
  Brain,
  LayoutGrid,
  Clock,
  Radio,
  ChevronsUpDown,
  ChevronsDownUp,
  type LucideIcon,
} from 'lucide-react';
import {
  aiSessionLogsApi,
  personaApi,
  type LinkedAgent,
  SessionLogSummary,
  SessionLogDetail,
  SessionLogEntry,
  SegmentMeta,
  SessionLogStatsOverview,
  SessionLogCategory,
} from '@/lib/api';
import { toast } from 'sonner';
import TraceWaterfall, { type TraceWaterfallHandle } from '@/components/ai-history/TraceWaterfall';

const DEFAULT_SELECT_VALUE = '__all__';

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

// 会话来源分组 → 图标：无人格参与的系统/子任务用任务类型图标，替代千篇一律的空机器人。
// 分组值取自后端分类目录（_CREATE_BY_CATALOG 的 group 字段，随 categories 接口下发）。
const GROUP_ICON: Record<string, LucideIcon> = {
  chat: MessageSquare,
  agent: Bot,
  capability: Wrench,
  image: ImageIcon,
  persona: UserCog,
  heartbeat: Activity,
  meme: Smile,
  memory: Brain,
  kanban: LayoutGrid,
  scheduled: Clock,
  proactive: Radio,
  other: Cpu,
};

// capagent_<node_id>_<suffix> → 抠出 node_id（就是这个能力任务本身，如 papertrade_decision_agent）。
// node_id 自身可能含下划线，故只削尾部已知的运行后缀（adhoc / kanban[_...]）。
function capabilityNodeName(sessionId: string): string {
  const rest = sessionId.slice('capagent_'.length);
  return rest.replace(/_(?:adhoc|kanban(?:_.*)?)$/, '') || sessionId;
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
  if (cb.startsWith('capagent') || cb.includes('capability') || cb.includes('planner') || cb.endsWith('agent'))
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
  const m = sessionId.slice(prefix.length).match(/^(group|uglobal|uingroup|self)-(.+)_[0-9a-f]{6,}$/);
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

// 把冗长的 session_id 归一为「简短名 + 类型图标」：常规聊天取会话名；能力 Agent 取 node_id；
// 心跳/续聊等定向会话保留目标；其余取后端短标签，未收录则按 create_by 兜底（仍带类型图标）。
function describeSession(
  log: { session_id: string; create_by: string },
  catMap: Map<string, { label: string; group: string }>,
): SessionDisplay {
  const cat = catMap.get(log.create_by);
  // 后端 group 优先（除非它也只归到 other）；否则按 create_by 命名规律推断，保证插件来源也有像样图标
  const group = cat?.group && cat.group !== 'other' ? cat.group : inferGroup(log.create_by);
  const Icon = GROUP_ICON[group] ?? Bot;
  const parsed = parseSessionId(log.session_id);

  // 1) 常规聊天：session_id 形如 platform:...:group/private:xxx → 会话名（群名/私聊名）
  if (parsed.chatType) return { name: parsed.displayName, Icon };
  // 2) 能力 Agent：展示 node_id（任务本身），比泛化的「能力 Agent」更有信息量
  if (log.session_id.startsWith('capagent_')) return { name: capabilityNodeName(log.session_id), Icon };
  // 3) 定向后台会话（心跳/续聊）：类别标签 + 目标（群号/用户），别把不同目标折叠成同一个名字
  const target = targetedTarget(log.session_id);
  if (target) return { name: `${cat?.label ?? humanizeCreateBy(log.create_by)} · ${target}`, Icon };
  // 3.5) 记忆等后台抽取子 agent：auto_ id 里编了 scope → 显示"针对哪个群/用户"
  const autoScope = parseAutoScope(log.session_id, log.create_by);
  if (autoScope) return { name: `${cat?.label ?? humanizeCreateBy(log.create_by)} · ${autoScope}`, Icon };
  // 4) 其它系统/子任务：后端归类的简短标签（记忆实体抽取…）；未收录则按 create_by 兜底
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

  // 数据
  const [logs, setLogs] = useState<SessionLogSummary[]>([]);
  const [stats, setStats] = useState<SessionLogStatsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<SessionLogCategory[]>([]);

  // 选中链
  const [selectedCard, setSelectedCard] = useState<SessionLogSummary | null>(null);
  const [mainDetail, setMainDetail] = useState<SessionLogDetail | null>(null);
  // 已加载分段：segment_index -> entries（按 index 升序拼接成完整时间线）
  const [segEntries, setSegEntries] = useState<Record<number, SessionLogEntry[]>>({});
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [linkedAgents, setLinkedAgents] = useState<LinkedAgent[]>([]);
  const [linkedAgentsLoading, setLinkedAgentsLoading] = useState(false);

  // 筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterCreateBy, setFilterCreateBy] = useState<string>('Chat');
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
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch session log categories:', err);
    }
  }, []);

  const fetchLogs = useCallback(
    async (currentOffset = 0) => {
      try {
        setIsLoading(true);
        const data = await aiSessionLogsApi.getLogs({
          search: debouncedSearch || undefined,
          create_by: filterCreateBy !== DEFAULT_SELECT_VALUE ? filterCreateBy : undefined,
          persona_name: filterPersona !== DEFAULT_SELECT_VALUE ? filterPersona : undefined,
          date_from: filterDateFrom || undefined,
          date_to: filterDateTo || undefined,
          limit,
          offset: currentOffset,
        });
        setLogs(data.items || []);
        setTotal(data.total || 0);
        setOffset(currentOffset);
      } catch (err) {
        console.error('Failed to fetch session logs:', err);
        toast.error(t('aiHistory.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedSearch, filterCreateBy, filterPersona, filterDateFrom, filterDateTo, t],
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
      setLinkedAgents([]);
      setIsLoadingDetail(true);
      setLinkedAgentsLoading(true);
      try {
        const segs = cardSegments(card);
        const latest = segs[segs.length - 1];
        const [d, linked] = await Promise.all([
          fetchSegment(latest),
          aiSessionLogsApi.getLinkedAgents(card.session_id).catch(() => null),
        ]);
        if (d) {
          setMainDetail(d);
          setSegEntries({ [latest.segment_index]: d.entries || [] });
        }
        setLinkedAgents(linked?.linked_agents ?? []);
      } catch (err) {
        console.error('Failed to fetch chain detail:', err);
        toast.error(t('aiHistory.loadDetailFailed'));
      } finally {
        setIsLoadingDetail(false);
        setLinkedAgentsLoading(false);
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
      const results = await Promise.all(missing.map((s) => fetchSegment(s).then((d) => [s.segment_index, d] as const)));
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
  const loadSubAgent = useCallback(async (agentData: Record<string, unknown>): Promise<SessionLogEntry[] | null> => {
    const logFile = typeof agentData.log_file === 'string' ? agentData.log_file : '';
    const sid = logFile
      ? logFile.replace(/^.*[\\/]/, '').replace(/\.json$/, '')
      : (agentData.session_id as string) || '';
    if (!sid) return null;
    const uuid = typeof agentData.session_uuid === 'string' ? agentData.session_uuid : undefined;
    const d = await aiSessionLogsApi.getLogDetail(sid, uuid);
    return d?.entries ?? null;
  }, []);

  // ── effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    fetchStats();
    fetchCategories();
  }, [fetchStats, fetchCategories]);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  // ── 操作 ──────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    fetchStats();
    fetchCategories();
    fetchLogs(0);
    if (selectedCard) selectCard(selectedCard);
  }, [fetchStats, fetchCategories, fetchLogs, selectedCard, selectCard]);

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

  // create_by → {label, group}：供 describeSession 归一化展示名 + 选类型图标
  const categoryMap = useMemo(() => {
    const m = new Map<string, { label: string; group: string }>();
    for (const c of categories) m.set(c.create_by, { label: c.label, group: c.group });
    return m;
  }, [categories]);

  const personaOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.persona_name && set.add(l.persona_name));
    return Array.from(set);
  }, [logs]);

  // 会话 token 总量（Σ 输入/输出）：从已加载 entries 的 token_usage 汇总，显示在详情头部
  const sessionTokens = useMemo(() => {
    let tin = 0;
    let tout = 0;
    for (const e of mainEntries) {
      if (e.type !== 'token_usage') continue;
      const d = (e.data || {}) as Record<string, unknown>;
      if (typeof d.input_tokens === 'number') tin += d.input_tokens;
      if (typeof d.output_tokens === 'number') tout += d.output_tokens;
    }
    return { tin, tout };
  }, [mainEntries]);

  const personaName = mainDetail?.persona_name || selectedCard?.persona_name || '';
  const avatarUrl = personaName ? personaApi.getAvatarUrl(personaName) : '';
  const totalSegCount = selectedCard ? cardSegments(selectedCard).length : 0;
  // 详情副标题里的来源：用后端分类的短标签（记忆实体抽取…），比原始 create_by 可读
  const createByLabel = selectedCard
    ? (categoryMap.get(selectedCard.create_by)?.label ?? selectedCard.create_by)
    : '';
  const hasEarlier = selectedCard ? loadedSegCount < totalSegCount : false;
  // 详情头部：与列表一致地展示简短名 + 类型图标（selectedCard 在分类未随详情返回时兜底）
  const detailDesc = mainDetail
    ? describeSession(mainDetail, categoryMap)
    : selectedCard
      ? describeSession(selectedCard, categoryMap)
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
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading} className="h-8 w-8">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>

            {/* 统计概览：一行轻量文本，不做卡片盒子 */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground min-w-0">
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <HardDrive className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('aiHistory.statsTotalFiles')}</span>
                <span className="font-semibold text-foreground tabular-nums shrink-0">{stats?.total ?? '-'}</span>
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

            {/* 筛选：来源 + 人格（选择即生效，无需额外按钮） */}
            <div className="flex items-center gap-2">
              <Select value={filterCreateBy} onValueChange={setFilterCreateBy}>
                <SelectTrigger className="flex-1 min-w-0 h-9 text-xs">
                  <SelectValue placeholder={t('aiHistory.filterCreateBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_SELECT_VALUE}>{t('aiHistory.filterAll')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.create_by} value={cat.create_by}>
                      {cat.label} ({cat.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPersona} onValueChange={setFilterPersona}>
                <SelectTrigger className="flex-1 min-w-0 h-9 text-xs">
                  <SelectValue placeholder={t('aiHistory.filterPersona')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_SELECT_VALUE}>{t('aiHistory.filterAll')}</SelectItem>
                  {personaOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 列表 */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="space-y-3 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
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
                    const { name: displayName, Icon: TypeIcon } = describeSession(log, categoryMap);
                    // created_at_str 形如 "2026-07-09 09:44:51" → 取 "07-09 09:44"
                    const shortTime = log.created_at_str ? log.created_at_str.slice(5, 16) : '';
                    return (
                      <button
                        key={log.chain_id || log.session_uuid}
                        onClick={() => selectCard(log)}
                        className={cn(
                          'w-full p-2.5 rounded-lg text-left transition-colors',
                          isSelected ? 'bg-primary/10 ring-1 ring-inset ring-primary/25' : 'hover:bg-accent/60',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {/* persona 头像 + 活跃绿点（脉冲） */}
                          <div className="relative shrink-0">
                            <Avatar className="w-10 h-10 rounded-xl">
                              <AvatarImage
                                src={log.persona_name ? personaApi.getAvatarUrl(log.persona_name) : undefined}
                                alt={log.persona_name || ''}
                              />
                              <AvatarFallback className="rounded-xl bg-muted text-muted-foreground text-xs">
                                {/* 有人格 → 人格首字（配合上面的头像图）；无人格 → 按任务类型给图标 */}
                                {log.persona_name ? log.persona_name.slice(0, 2) : <TypeIcon className="w-4 h-4" />}
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
                              <span className="text-sm font-medium truncate min-w-0" title={log.session_id}>
                                {displayName}
                              </span>
                              <ChatTypeBadge sessionId={log.session_id} t={t} />
                              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                                {shortTime}
                              </span>
                            </div>
                            {/* 行2：人格 · 条数（+ 分段/子Agent 紧凑徽章） */}
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground min-w-0">
                              <span className="truncate min-w-0">{log.persona_name}</span>
                              <span className="shrink-0 opacity-40">·</span>
                              <span className="shrink-0 tabular-nums">
                                {log.entry_count} {t('aiHistory.entries')}
                              </span>
                              {segCount > 1 && (
                                <Badge variant="secondary" className="ml-1 shrink-0 h-4 px-1 gap-0.5 text-[10px]">
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
              <Button variant="ghost" size="sm" onClick={handlePrevPage} disabled={offset === 0 || isLoading} className="h-7 px-2">
                {t('common.previousPage')}
              </Button>
              <span className="text-muted-foreground">
                {t('common.pageInfo', { current: Math.floor(offset / limit) + 1, total: Math.ceil(total / limit) })}
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
              <div className="h-14 border-b border-border/40 px-3 sm:px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8 shrink-0" onClick={handleBackToList}>
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
                      <h2 className="font-semibold text-sm truncate min-w-0" title={mainDetail.session_id}>
                        {detailDesc?.name || parseSessionId(mainDetail.session_id).displayName}
                      </h2>
                      <ChatTypeBadge sessionId={mainDetail.session_id} t={t} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {personaName} · {createByLabel} · {selectedCard.entry_count} {t('aiHistory.entries')}
                      {totalSegCount > 1 && ` · ${t('aiHistory.segmentsCount', { count: totalSegCount })}`}
                    </p>
                    {(linkedAgentsLoading || linkedAgents.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1 mt-0.5 min-w-0">
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {t('aiHistory.linkedAgents')}:
                        </span>
                        {linkedAgentsLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                        ) : (
                          linkedAgents.slice(0, 6).map((agent) => (
                            <Badge
                              key={`${agent.agent_type}-${agent.session_id}`}
                              variant="outline"
                              className="text-[10px] h-5 px-1.5 font-mono max-w-[140px] truncate"
                              title={`${agent.agent_type} · ${agent.session_id}`}
                            >
                              {agent.persona_name || agent.agent_type}
                              {agent.entry_count > 0 ? ` · ${agent.entry_count}` : ''}
                            </Badge>
                          ))
                        )}
                        {!linkedAgentsLoading && linkedAgents.length > 6 && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                            +{linkedAgents.length - 6}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(sessionTokens.tin > 0 || sessionTokens.tout > 0) && (
                    <span
                      className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border/40 text-muted-foreground"
                      title={`${t('aiHistory.inputTokens')} / ${t('aiHistory.outputTokens')}`}
                    >
                      <span className="opacity-70">Σ</span>
                      <span className="text-sky-500">↗{formatTokens(sessionTokens.tin)}</span>
                      <span className="text-emerald-500">↙{formatTokens(sessionTokens.tout)}</span>
                    </span>
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
                  <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoadingDetail} className="h-8 w-8">
                    {isLoadingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleDownloadSession} className="h-8 w-8">
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
              <ScrollArea className="flex-1 min-w-0">
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
                        {t('aiHistory.loadEarlierSegments', { count: totalSegCount - loadedSegCount })}
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
                    <TraceWaterfall ref={waterfallRef} entries={mainEntries} t={t} loadSubAgent={loadSubAgent} />
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
              <p className="text-xs text-muted-foreground/60 mt-1">{t('aiHistory.selectSessionHint')}</p>
            </div>
          )}
        </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
