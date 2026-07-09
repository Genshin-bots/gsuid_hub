import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
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
  Filter,
  ChevronLeft,
  HardDrive,
  Cpu,
  Download,
  Users,
  Layers,
} from 'lucide-react';
import {
  aiSessionLogsApi,
  personaApi,
  SessionLogSummary,
  SessionLogDetail,
  SessionLogEntry,
  SegmentMeta,
  SessionLogStatsOverview,
  SessionLogCategory,
} from '@/lib/api';
import { toast } from 'sonner';
import TraceWaterfall from '@/components/ai-history/TraceWaterfall';

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
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

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
      setIsLoadingDetail(true);
      try {
        const segs = cardSegments(card);
        const latest = segs[segs.length - 1];
        const d = await fetchSegment(latest);
        if (d) {
          setMainDetail(d);
          setSegEntries({ [latest.segment_index]: d.entries || [] });
        }
      } catch (err) {
        console.error('Failed to fetch chain detail:', err);
        toast.error(t('aiHistory.loadDetailFailed'));
      } finally {
        setIsLoadingDetail(false);
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

  const personaOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.persona_name && set.add(l.persona_name));
    return Array.from(set);
  }, [logs]);

  const personaName = mainDetail?.persona_name || selectedCard?.persona_name || '';
  const avatarUrl = personaName ? personaApi.getAvatarUrl(personaName) : '';
  const totalSegCount = selectedCard ? cardSegments(selectedCard).length : 0;
  const hasEarlier = selectedCard ? loadedSegCount < totalSegCount : false;

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-hidden h-full flex">
        {/* ── 左侧：链列表 ── */}
        <div
          className={cn(
            'border-r flex flex-col shrink-0',
            'w-full absolute inset-0 z-10 sm:relative sm:w-80 lg:w-96',
            isGlass ? 'border-white/10 glass-card' : 'border-border bg-card',
            selectedCard ? 'hidden sm:flex' : 'flex',
          )}
        >
          <div className="p-4 border-b border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                {t('aiHistory.title')}
              </h1>
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading} className="h-8 w-8">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>

            {/* 统计概览 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-card/50 border border-border/30 rounded-2xl p-3 flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground shrink-0">
                  <HardDrive className="w-[18px] h-[18px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground leading-tight">{t('aiHistory.statsTotalFiles')}</p>
                  <p className="text-lg font-bold leading-tight mt-0.5">{stats?.total ?? '-'}</p>
                </div>
              </div>
              <div className="bg-card/50 border border-border/30 rounded-2xl p-3 flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground shrink-0">
                  <Cpu className="w-[18px] h-[18px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground leading-tight">{t('aiHistory.statsActiveSessions')}</p>
                  <p className="text-lg font-bold leading-tight mt-0.5">{stats?.active_count ?? '-'}</p>
                </div>
              </div>
            </div>

            {/* 搜索 */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder={t('aiHistory.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
                className={cn(
                  'pl-9 h-9 text-sm border-border/40 bg-card/50 focus-visible:ring-1 focus-visible:ring-primary/30',
                  isGlass && 'glass-card',
                )}
              />
            </div>

            {/* 筛选 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Select value={filterCreateBy} onValueChange={setFilterCreateBy}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
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
                <SelectTrigger className="w-[100px] h-9 text-xs">
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
              <Button size="sm" onClick={handleApplyFilter} className="h-9 gap-1 text-xs ml-auto">
                <Filter className="w-3 h-3" />
                {t('common.filter')}
              </Button>
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
              <div className="p-2 space-y-0.5">
                {logs
                  .filter((log) => log.session_id)
                  .map((log) => {
                    const isSelected = selectedCard?.chain_id === log.chain_id;
                    const segCount = log.segment_count ?? 1;
                    const displayName = parseSessionId(log.session_id).displayName;
                    // created_at_str 形如 "2026-07-09 09:44:51" → 取 "07-09 09:44"
                    const shortTime = log.created_at_str ? log.created_at_str.slice(5, 16) : '';
                    return (
                      <button
                        key={log.chain_id || log.session_uuid}
                        onClick={() => selectCard(log)}
                        className={cn(
                          'w-full p-2.5 rounded-xl text-left transition-colors',
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
                                {log.is_subagent ? (
                                  <Bot className="w-4 h-4" />
                                ) : (
                                  log.persona_name?.slice(0, 2) || <User className="w-4 h-4" />
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
                              <span className="text-sm font-medium truncate">{displayName}</span>
                              <ChatTypeBadge sessionId={log.session_id} t={t} />
                              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70 font-mono tabular-nums">
                                {shortTime}
                              </span>
                            </div>
                            {/* 行2：人格 · 条数（+ 分段/子Agent 紧凑徽章） */}
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground min-w-0">
                              <span className="truncate">{log.persona_name}</span>
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
            isGlass ? 'bg-background/50 backdrop-blur-md' : 'bg-background',
            selectedCard ? 'flex' : 'hidden sm:flex',
          )}
        >
          {selectedCard && mainDetail ? (
            <>
              {/* 详情头部 */}
              <div
                className={cn(
                  'h-14 border-b px-4 flex items-center justify-between shrink-0',
                  isGlass ? 'border-white/10 bg-background/50' : 'border-border bg-card',
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Button variant="ghost" size="icon" className="sm:hidden h-8 w-8 shrink-0" onClick={handleBackToList}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarImage src={avatarUrl} alt={personaName} />
                    <AvatarFallback className="bg-indigo-500/10 text-indigo-600">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="font-semibold text-sm truncate">
                        {parseSessionId(mainDetail.session_id).displayName}
                      </h2>
                      <ChatTypeBadge sessionId={mainDetail.session_id} t={t} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {personaName} · {selectedCard.create_by} · {selectedCard.entry_count} {t('aiHistory.entries')}
                      {totalSegCount > 1 && ` · ${t('aiHistory.segmentsCount', { count: totalSegCount })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {formatTimestamp(selectedCard.created_at)}
                  </span>
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
              <ScrollArea className="flex-1">
                <div className="p-3 sm:p-4">
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
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Skeleton className="w-16 h-4 shrink-0" />
                          <Skeleton className="h-5 flex-1" />
                        </div>
                      ))}
                    </div>
                  ) : mainEntries.length > 0 ? (
                    <TraceWaterfall entries={mainEntries} t={t} loadSubAgent={loadSubAgent} />
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
    </TooltipProvider>
  );
}
