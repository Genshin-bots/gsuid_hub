import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock,
  Edit3,
  History,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { personaApi } from '@/lib/api';

interface PersonaJournalTabProps {
  personaName: string;
}

interface GroupShardView {
  group_id: string;
  content: string;
  persistent: string[];
  monthly: string[];
  yesterday: string[];
  month_label: string;
  yesterday_label: string;
  timeline: string[];
  timeline_count: number;
}

interface ParsedTimelineEntry {
  raw: string;
  time: string;
  tag: string;
  text: string;
  groupId: string;
  handleId: string;
  requestedBy: string;
  count: string;
}

interface ParsedBulletItem {
  text: string;
  archiveHandle: string;
}

const LINE_RE =
  /^- \[(?<time>[^\]|]+)(?: \| (?<tag>[^\]]+))?\] (?<text>.*?)(?: \(群:(?<gid>[^)]+)\))?(?: \(句柄: (?<hid>[^)]+)\))?(?: \(替:(?<who>[^)]+)\))?(?: \((?<cnt>×\d+)\))?$/;

const BULLET_ARCHIVE_RE =
  /^(?<body>.*?)(?:（归档:\s*(?<ah1>[^）]+)）|\(归档:\s*(?<ah2>[^)]+)\))[。.]?$/;

function parseTimelineLine(line: string): ParsedTimelineEntry {
  const m = line.match(LINE_RE);
  if (!m?.groups) {
    return {
      raw: line,
      time: '',
      tag: '',
      text: line.replace(/^- /, ''),
      groupId: '',
      handleId: '',
      requestedBy: '',
      count: '',
    };
  }
  return {
    raw: line,
    time: m.groups.time || '',
    tag: m.groups.tag || '',
    text: m.groups.text || '',
    groupId: m.groups.gid || '',
    handleId: m.groups.hid || '',
    requestedBy: m.groups.who || '',
    count: m.groups.cnt || '',
  };
}

function parseBulletItem(raw: string): ParsedBulletItem {
  const stripped = raw.replace(/^[-*•]\s*/, '').trim();
  const m = stripped.match(BULLET_ARCHIVE_RE);
  if (!m?.groups) {
    return { text: stripped, archiveHandle: '' };
  }
  return {
    text: (m.groups.body || '').trim(),
    archiveHandle: (m.groups.ah1 || m.groups.ah2 || '').trim(),
  };
}

function splitBulletsFallback(summary?: string): string[] {
  if (!summary) return [];
  return summary
    .split('\n')
    .map((ln) => ln.trim())
    .filter(
      (ln) =>
        ln.length > 0 &&
        !ln.includes('暂无新增自主探索专题') &&
        !ln.includes('昨日无额外独立探索记录'),
    );
}

function getTagVariant(tag: string): 'default' | 'secondary' | 'outline' {
  if (!tag) return 'outline';
  if (tag.includes('巡检') || tag.includes('定时') || tag.includes('汇总')) return 'secondary';
  return 'default';
}

export function PersonaJournalTab({ personaName }: PersonaJournalTabProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevScopeRef = useRef<string>('all');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [content, setContent] = useState('');
  const [selfContent, setSelfContent] = useState('');
  const [selfPersistent, setSelfPersistent] = useState<string[]>([]);
  const [selfMonthly, setSelfMonthly] = useState<string[]>([]);
  const [selfYesterday, setSelfYesterday] = useState<string[]>([]);
  const [selfYesterdayLabel, setSelfYesterdayLabel] = useState('');
  const [selfTimeline, setSelfTimeline] = useState<string[]>([]);
  const [standingSummary, setStandingSummary] = useState('');
  const [hasStructured, setHasStructured] = useState(false);
  const [groupShards, setGroupShards] = useState<GroupShardView[]>([]);
  const [archiveMonths, setArchiveMonths] = useState<string[]>([]);
  const [timeline, setTimeline] = useState<string[]>([]);

  const [rawEditing, setRawEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compacting, setCompacting] = useState(false);

  useEffect(() => {
    setSelectedScope('all');
    setRawEditing(false);
  }, [personaName]);

  const fetchJournal = useCallback(async () => {
    try {
      setLoading(true);
      const res = await personaApi.getPersonaJournal(personaName);
      if (res) {
        setContent(res.content || '');
        setSelfContent(res.self_content || '');
        setStandingSummary(res.standing_summary || '');
        setTimeline(res.timeline || []);

        const structuredPresent =
          Array.isArray(res.self_persistent) ||
          typeof res.persistent_summary === 'string' ||
          Array.isArray(res.group_shards);
        setHasStructured(structuredPresent);
        setSelfPersistent(res.self_persistent ?? splitBulletsFallback(res.persistent_summary));
        setSelfMonthly(res.self_monthly ?? splitBulletsFallback(res.monthly_summary));
        setSelfYesterday(res.self_yesterday ?? splitBulletsFallback(res.yesterday_summary));
        setSelfYesterdayLabel(res.self_yesterday_label || '');
        setSelfTimeline(res.self_timeline || []);
        setGroupShards(res.group_shards || []);
        setArchiveMonths(res.archive_months || []);
      }
    } catch {
      toast.error(t('personaConfig.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [personaName, t]);

  useEffect(() => {
    fetchJournal();
  }, [fetchJournal]);

  const activeGroupShard = useMemo(
    () =>
      selectedScope !== 'all' && selectedScope !== '__self__'
        ? (groupShards.find((g) => g.group_id === selectedScope) ?? null)
        : null,
    [groupShards, selectedScope],
  );

  useEffect(() => {
    if (selectedScope !== 'all' && selectedScope !== '__self__' && !activeGroupShard) {
      setSelectedScope('all');
    }
  }, [activeGroupShard, selectedScope]);

  useEffect(() => {
    if (prevScopeRef.current !== selectedScope) {
      prevScopeRef.current = selectedScope;
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedScope]);

  const activeTimeline = useMemo(() => {
    if (selectedScope === '__self__') return selfTimeline;
    if (activeGroupShard) return activeGroupShard.timeline || [];
    return timeline;
  }, [activeGroupShard, selectedScope, selfTimeline, timeline]);

  const activeMarkdownForEdit = useMemo(() => {
    if (selectedScope === '__self__') return selfContent || content;
    if (activeGroupShard) return activeGroupShard.content || '';
    return content;
  }, [activeGroupShard, content, selectedScope, selfContent]);

  const activeMarkdownPath = useMemo(() => {
    if (selectedScope === '__self__') {
      return `data/ai_core/journals/personas/${personaName}/self.md`;
    }
    if (activeGroupShard) {
      return `data/ai_core/journals/personas/${personaName}/groups/${activeGroupShard.group_id}.md`;
    }
    return `data/ai_core/journals/personas/${personaName}/ (self.md + groups/*.md)`;
  }, [activeGroupShard, personaName, selectedScope]);

  const handleSaveRaw = async () => {
    try {
      setSaving(true);
      const targetShard = selectedScope === 'all' ? undefined : selectedScope;
      await personaApi.updatePersonaJournal(personaName, editContent, targetShard);
      toast.success(t('personaConfig.journalSaveSuccess'));
      setRawEditing(false);
      await fetchJournal();
    } catch {
      toast.error(t('personaConfig.journalSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCompact = async () => {
    try {
      setCompacting(true);
      const targetShard = selectedScope === 'all' ? undefined : selectedScope;
      const res = await personaApi.compactPersonaJournal(personaName, targetShard);
      if (res?.compacted) {
        toast.success(t('personaConfig.journalCompactSuccess'));
      } else {
        toast.info(t('personaConfig.journalCompactSuccess'));
      }
      await fetchJournal();
    } catch {
      toast.error(t('personaConfig.journalCompactFailed'));
    } finally {
      setCompacting(false);
    }
  };

  const renderSlotBullets = (items: string[]) => {
    if (items.length === 0) {
      return (
        <p className="text-xs text-muted-foreground/70">{t('personaConfig.journalSlotEmpty')}</p>
      );
    }
    return (
      <ul className="space-y-1.5 text-xs leading-relaxed text-foreground/90">
        {items.map((raw) => {
          const parsed = parseBulletItem(raw);
          return (
            <li
              key={raw}
              className="flex flex-col gap-1 rounded-md bg-muted/30 px-2.5 py-1.5 border border-border/40"
            >
              <span className="break-words">{parsed.text}</span>
              {parsed.archiveHandle && (
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  {parsed.archiveHandle}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isGroupScope = Boolean(activeGroupShard);
  const slotPersistent = isGroupScope ? (activeGroupShard?.persistent ?? []) : selfPersistent;
  const slotMonthly = isGroupScope ? (activeGroupShard?.monthly ?? []) : selfMonthly;
  const slotYesterday = isGroupScope ? (activeGroupShard?.yesterday ?? []) : selfYesterday;
  const monthLabel = isGroupScope ? activeGroupShard?.month_label || '' : '';
  const yesterdayLabel = isGroupScope
    ? activeGroupShard?.yesterday_label || ''
    : selfYesterdayLabel;

  return (
    <div ref={containerRef} className="space-y-4 pb-6">
      {/* 头部操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{t('personaConfig.journal')}</h3>
            <Badge variant="outline" className="text-xs">
              {t('personaConfig.journalTotalEntries', { count: activeTimeline.length })}
            </Badge>
            {archiveMonths.length > 0 && (
              <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
                <Archive className="h-3 w-3" />
                {t('personaConfig.journalArchivesLabel')}: {archiveMonths.slice(0, 3).join(', ')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('personaConfig.journalDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          {!rawEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchJournal}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t('common.refresh')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompact}
                disabled={compacting || activeTimeline.length === 0}
                className="gap-1.5 text-xs"
              >
                {compacting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                )}
                {selectedScope === 'all'
                  ? t('personaConfig.journalCompact')
                  : t('personaConfig.journalCompactShard')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditContent(activeMarkdownForEdit);
                  setRawEditing(true);
                }}
                className="gap-1.5 text-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                {t('personaConfig.journalEditMarkdown')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRawEditing(false)}
                className="gap-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRaw}
                disabled={saving}
                className="gap-1.5 text-xs"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {t('common.save')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 分片范围切换胶囊栏（高对比主色选中态，避免浅色玻璃主题下失去选中反馈） */}
      {hasStructured && !rawEditing && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-1.5">
            <Button
              variant={selectedScope === 'all' ? 'default' : 'ghost'}
              size="sm"
              aria-pressed={selectedScope === 'all'}
              onClick={() => setSelectedScope('all')}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <Layers className="h-3.5 w-3.5" />
              {t('personaConfig.journalScopeAll')}
              <Badge
                variant={selectedScope === 'all' ? 'secondary' : 'outline'}
                className="ml-0.5 px-1 py-0 text-[10px]"
              >
                {timeline.length}
              </Badge>
            </Button>
            <Button
              variant={selectedScope === '__self__' ? 'default' : 'ghost'}
              size="sm"
              aria-pressed={selectedScope === '__self__'}
              onClick={() => setSelectedScope('__self__')}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {t('personaConfig.journalScopeSelf')}
              <Badge
                variant={selectedScope === '__self__' ? 'secondary' : 'outline'}
                className="ml-0.5 px-1 py-0 text-[10px]"
              >
                {selfTimeline.length}
              </Badge>
            </Button>
            {groupShards.map((gs) => {
              const isSelected = selectedScope === gs.group_id;
              return (
                <Button
                  key={gs.group_id}
                  variant={isSelected ? 'default' : 'ghost'}
                  size="sm"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedScope(gs.group_id)}
                  className="h-7 gap-1.5 px-2.5 text-xs"
                >
                  <Users className="h-3.5 w-3.5" />
                  {t('personaConfig.journalScopeGroup', { id: gs.group_id })}
                  <Badge
                    variant={isSelected ? 'secondary' : 'outline'}
                    className="ml-0.5 px-1 py-0 text-[10px]"
                  >
                    {gs.timeline_count}
                  </Badge>
                </Button>
              );
            })}
          </div>

          {selectedScope !== 'all' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedScope('all')}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {t('personaConfig.journalScopeAll')}
                </Button>
                <span className="font-medium text-foreground">
                  {isGroupScope && activeGroupShard
                    ? t('personaConfig.journalScopeGroup', { id: activeGroupShard.group_id })
                    : t('personaConfig.journalScopeSelf')}
                </span>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {activeMarkdownPath}
              </span>
            </div>
          )}
        </div>
      )}

      {rawEditing ? (
        <Card className="border border-border/80">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              {t('personaConfig.journalMarkdownTitle')}
            </CardTitle>
            <CardDescription className="text-xs font-mono">
              {t('personaConfig.journalMarkdownPathHint', { path: activeMarkdownPath })}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="font-mono min-h-[360px] text-xs leading-relaxed resize-y"
              placeholder="# 手账内容..."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 多尺度记忆层卡片（持久 / 当月 / 昨日） */}
          {hasStructured ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="border border-border/70 bg-card/60 shadow-xs">
                <CardHeader className="pb-2 pt-3 px-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {isGroupScope
                        ? t('personaConfig.journalSlotPersistentGroup')
                        : t('personaConfig.journalSlotPersistentSelf')}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-3.5 pb-3 pt-0">
                  {renderSlotBullets(slotPersistent)}
                </CardContent>
              </Card>

              <Card className="border border-border/70 bg-card/60 shadow-xs">
                <CardHeader className="pb-2 pt-3 px-3.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <span>
                        {isGroupScope
                          ? t('personaConfig.journalSlotMonthlyGroup')
                          : t('personaConfig.journalSlotMonthlySelf')}
                      </span>
                    </div>
                    {monthLabel && (
                      <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px]">
                        {monthLabel}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3.5 pb-3 pt-0">
                  {renderSlotBullets(slotMonthly)}
                </CardContent>
              </Card>

              <Card className="border border-border/70 bg-card/60 shadow-xs">
                <CardHeader className="pb-2 pt-3 px-3.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <History className="h-3.5 w-3.5 text-primary" />
                      <span>
                        {isGroupScope
                          ? t('personaConfig.journalSlotYesterdayGroup')
                          : t('personaConfig.journalSlotYesterdaySelf')}
                      </span>
                    </div>
                    {yesterdayLabel && (
                      <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px]">
                        {yesterdayLabel}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3.5 pb-3 pt-0">
                  {renderSlotBullets(slotYesterday)}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border border-border/70 bg-card/60 shadow-xs">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span>{t('personaConfig.journalSummaryTitle')}</span>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/30 p-2.5 border border-border/40">
                  {standingSummary || t('personaConfig.journalSlotEmpty')}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 全景模式下展示各驻群分片近况速览卡，点击可切入单群分片 */}
          {selectedScope === 'all' && groupShards.length > 0 && (
            <Card className="border border-border/70 bg-card/40 shadow-xs">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>{t('personaConfig.journalGroupOverviewTitle')}</span>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2.5 px-4 pb-3 pt-0 sm:grid-cols-2">
                {groupShards.map((gs) => {
                  const previewLine =
                    gs.yesterday[0] ||
                    gs.monthly[0] ||
                    gs.persistent[0] ||
                    t('personaConfig.journalSlotEmpty');
                  return (
                    <button
                      key={gs.group_id}
                      type="button"
                      onClick={() => setSelectedScope(gs.group_id)}
                      className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/60 p-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {t('personaConfig.journalScopeGroup', { id: gs.group_id })}
                        </span>
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {t('personaConfig.journalTotalEntries', { count: gs.timeline_count })}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {parseBulletItem(previewLine).text}
                      </p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* 今日行动流水 */}
          <Card className="border border-border/70 shadow-xs">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>{t('personaConfig.journalTimelineTitle')}</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {activeTimeline.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                  {t('personaConfig.journalEmptyTimeline')}
                </div>
              ) : (
                <div className="relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/60 space-y-2.5">
                  {(() => {
                    const seenCounts = new Map<string, number>();
                    return activeTimeline.map((line) => {
                      const prev = seenCounts.get(line) ?? 0;
                      seenCounts.set(line, prev + 1);
                      const stableKey = prev === 0 ? line : `${line}__${prev}`;
                      const entry = parseTimelineLine(line);
                      return (
                        <div key={stableKey} className="relative group text-xs">
                          <div className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full border-2 border-background bg-primary" />
                          <div className="rounded-lg border border-border/50 bg-background/60 p-2.5 transition-colors hover:bg-muted/40 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {entry.time && (
                                <span className="font-mono text-[11px] font-medium text-muted-foreground">
                                  {entry.time}
                                </span>
                              )}
                              {entry.tag && (
                                <Badge
                                  variant={getTagVariant(entry.tag)}
                                  className="px-1.5 py-0 text-[10px] font-normal"
                                >
                                  {entry.tag}
                                </Badge>
                              )}
                              {entry.groupId && (
                                <Badge
                                  variant="outline"
                                  className="px-1.5 py-0 text-[10px] text-muted-foreground"
                                >
                                  {t('personaConfig.journalScopeGroup', { id: entry.groupId })}
                                </Badge>
                              )}
                              {entry.requestedBy && (
                                <Badge
                                  variant="outline"
                                  className="px-1.5 py-0 font-mono text-[10px] text-muted-foreground/80"
                                >
                                  {t('personaConfig.journalRequestedBy', {
                                    uid: entry.requestedBy,
                                  })}
                                </Badge>
                              )}
                              {entry.count && (
                                <Badge
                                  variant="secondary"
                                  className="px-1 py-0 text-[10px] text-amber-500 font-mono"
                                >
                                  {entry.count}
                                </Badge>
                              )}
                              {entry.handleId && (
                                <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
                                  句柄: {entry.handleId}
                                </span>
                              )}
                            </div>
                            <div className="text-foreground/90 leading-relaxed break-words">
                              {entry.text}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
