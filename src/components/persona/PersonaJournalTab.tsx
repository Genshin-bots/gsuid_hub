import { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  Clock,
  Edit3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Tag,
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

interface ParsedTimelineEntry {
  raw: string;
  time: string;
  tag: string;
  text: string;
  groupId: string;
  handleId: string;
  count: string;
}

const LINE_RE =
  /^- \[(?<time>[^\]|]+)(?: \| (?<tag>[^\]]+))?\] (?<text>.*?)(?: \(群:(?<gid>\d+)\))?(?: \(句柄: (?<hid>[^)]+)\))?(?: \((?<cnt>×\d+)\))?$/;

function parseTimelineLine(line: string): ParsedTimelineEntry {
  const m = line.match(LINE_RE);
  if (!m || !m.groups) {
    return {
      raw: line,
      time: '',
      tag: '',
      text: line.replace(/^- /, ''),
      groupId: '',
      handleId: '',
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
    count: m.groups.cnt || '',
  };
}

function getTagVariant(tag: string): 'default' | 'secondary' | 'outline' {
  if (!tag) return 'outline';
  if (tag.includes('巡检') || tag.includes('定时')) return 'secondary';
  return 'default';
}

export function PersonaJournalTab({ personaName }: PersonaJournalTabProps) {
  const { t } = useLanguage();
  const [content, setContent] = useState('');
  const [standingSummary, setStandingSummary] = useState('');
  const [timeline, setTimeline] = useState<string[]>([]);
  const [rawEditing, setRawEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compacting, setCompacting] = useState(false);

  const fetchJournal = useCallback(async () => {
    try {
      setLoading(true);
      const res = await personaApi.getPersonaJournal(personaName);
      if (res) {
        setContent(res.content || '');
        setStandingSummary(res.standing_summary || '');
        setTimeline(res.timeline || []);
        setEditContent(res.content || '');
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

  const handleSaveRaw = async () => {
    try {
      setSaving(true);
      await personaApi.updatePersonaJournal(personaName, editContent);
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
      const res = await personaApi.compactPersonaJournal(personaName);
      if (res && res.compacted) {
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* 头部操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{t('personaConfig.journal')}</h3>
            <Badge variant="outline" className="text-xs">
              {t('personaConfig.journalTotalEntries', { count: timeline.length })}
            </Badge>
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
                disabled={compacting || timeline.length === 0}
                className="gap-1.5 text-xs"
              >
                {compacting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                )}
                {t('personaConfig.journalCompact')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditContent(content);
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

      {rawEditing ? (
        <Card className="border border-border/80">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Markdown 编辑</CardTitle>
            <CardDescription className="text-xs">
              手账文件按 Markdown 格式持久化于 data/ai_core/journals/{personaName}.md
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
          {/* 常驻状态与近期小结 */}
          <Card className="border border-border/70 bg-card/60 shadow-xs">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>{t('personaConfig.journalSummaryTitle')}</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/30 p-2.5 border border-border/40">
                {standingSummary || '暂无小结，运转正常。'}
              </div>
            </CardContent>
          </Card>

          {/* 今日行动流水 */}
          <Card className="border border-border/70 shadow-xs">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4 text-primary" />
                <span>{t('personaConfig.journalTimelineTitle')}</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              {timeline.length === 0 ? (
                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
                  {t('personaConfig.journalEmptyTimeline')}
                </div>
              ) : (
                <div className="relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/60 space-y-2.5">
                  {timeline.map((line, index) => {
                    const entry = parseTimelineLine(line);
                    return (
                      <div key={index} className="relative group text-xs">
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
                                群:{entry.groupId}
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
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
