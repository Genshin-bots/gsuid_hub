import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  CalendarClock,
  Clock,
  Compass,
  Copy,
  FileText,
  Loader2,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { GlassAlert } from '@/components/ui/glass-alert';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ActivePromptGroupNotice } from '@/components/persona/ActivePromptGroupNotice';
import type { ActivePromptGroupLine } from '@/components/persona/activePromptGroups';
import { PlaceholderEditor, PlaceholderText } from '@/components/persona/PlaceholderEditor';
import { PlaceholderPreviewProvider } from '@/components/persona/PlaceholderResolved';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  getApiErrorMessage,
  personaApi,
  promptGroupApi,
  type PlaceholderPreviewData,
  type PromptField,
  type PromptGroupSummary,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const SHEET_OVERLAY_MOTION =
  'data-[state=open]:animate-sheet-overlay-in data-[state=closed]:animate-sheet-overlay-out';

function eventTargetInPlaceholderMenu(target: EventTarget | null): boolean {
  const node = target instanceof Node ? target : null;
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest('[data-placeholder-menu]') != null;
}

const SECTION_ICON: Record<string, LucideIcon> = {
  system_constraints: MessageSquare,
  soft_trigger: MessagesSquare,
  heartbeat_decision: Clock,
  scheduled_executor: CalendarClock,
  aside_comment: MessageCircle,
  autonomy_system_guide: Compass,
};

function sectionIcon(fields: PromptField[]): LucideIcon | null {
  for (const field of fields) {
    const icon = SECTION_ICON[field.key];
    if (icon) return icon;
  }
  return null;
}

function promptCharCount(body: string, suffix: string | undefined): number {
  const tail = suffix ?? '';
  if (!body || !tail) return body.length + tail.length;
  // 发送时正文和固定尾句之间有一个空行。
  return body.length + tail.length + 2;
}

export type PromptGroupPanelHandle = {
  openCreate: () => void;
};

export const PromptGroupPanel = forwardRef<
  PromptGroupPanelHandle,
  {
    activeByGroup: Record<string, string[]>;
    activeLines: ActivePromptGroupLine[];
    activeReady: boolean;
  }
>(function PromptGroupPanel({ activeByGroup, activeLines, activeReady }, ref) {
  const { t } = useLanguage();
  const { mode } = useTheme();
  const sheetOverlay = mode === 'dark' ? 'bg-black/80' : 'bg-white/80';
  const [groups, setGroups] = useState<PromptGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [fields, setFields] = useState<PromptField[]>([]);
  const [section, setSection] = useState('');
  const [builtin, setBuiltin] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [copySource, setCopySource] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PlaceholderPreviewData | null | undefined>(undefined);
  const sheetBodyRef = useRef<HTMLDivElement>(null);

  const openCreate = useCallback(() => {
    setCopySource(null);
    setNewName('');
    setCreateOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({ openCreate }), [openCreate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await promptGroupApi.list());
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaConfig.promptLoadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (activeName === null) {
      setPreview(undefined);
      return;
    }
    let cancelled = false;
    setPreview(undefined);
    void personaApi.getPlaceholderPreview().then(
      (data) => {
        if (!cancelled) setPreview(data);
      },
      () => {
        if (!cancelled) setPreview(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [activeName]);

  const sections = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, PromptField[]>();
    for (const field of fields) {
      if (!map.has(field.section)) {
        order.push(field.section);
        map.set(field.section, []);
      }
      map.get(field.section)?.push(field);
    }
    return order.map((section) => ({ section, fields: map.get(section) ?? [] }));
  }, [fields]);

  const selectSection = (next: string) => {
    setSection(next);
    sheetBodyRef.current?.scrollTo({ top: 0 });
  };

  const openGroup = async (name: string) => {
    setOpening(true);
    setActiveName(name);
    try {
      const detail = await promptGroupApi.get(name);
      setFields(detail.fields);
      setSection(detail.fields[0]?.section ?? '');
      setBuiltin(detail.builtin);
      const next: Record<string, string> = {};
      for (const field of detail.fields) next[field.key] = field.text;
      setDraft(next);
    } catch (error) {
      setActiveName(null);
      toast.error(getApiErrorMessage(error, t('personaConfig.promptLoadFailed')));
    } finally {
      setOpening(false);
    }
  };

  const save = async () => {
    if (!activeName || builtin) return;
    setSaving(true);
    try {
      const detail = await promptGroupApi.save(activeName, draft);
      setFields(detail.fields);
      toast.success(t('personaConfig.promptSaved'));
      setActiveName(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaConfig.promptSaveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const submitCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      if (copySource) {
        await promptGroupApi.copy(copySource, name);
      } else {
        await promptGroupApi.create(name);
      }
      toast.success(t('personaConfig.promptCreated'));
      setCreateOpen(false);
      setCopySource(null);
      setNewName('');
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaConfig.promptCreateFailed')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (name: string) => {
    setBusy(true);
    try {
      await promptGroupApi.remove(name);
      toast.success(t('personaConfig.promptDeleted'));
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('personaConfig.promptDeleteFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="-mt-3">
      <div className="mb-3 space-y-3">
        <GlassAlert tone="warning">{t('personaConfig.promptBuiltinWarning')}</GlassAlert>
        <ActivePromptGroupNotice lines={activeLines} ready={activeReady} />
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="glass-card-grid grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.name}
              className={cn(
                'relative min-w-0 cursor-pointer transition-all duration-300 hover:scale-[1.02]',
                'glass-card border hover:border-primary/40',
                (activeByGroup[group.name]?.length ?? 0) > 0
                  ? 'border-primary/60'
                  : 'border-primary/20',
              )}
              onClick={() => void openGroup(group.name)}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  {group.name}
                </CardTitle>
                <div className="flex shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title={t('personaConfig.promptCopy')}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCopySource(group.name);
                      setNewName('');
                      setCreateOpen(true);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!group.builtin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title={t('personaConfig.promptDelete')}
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        void remove(group.name);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1 pt-0 text-sm text-muted-foreground">
                <p>
                  {group.builtin
                    ? t('personaConfig.promptBuiltinBadge')
                    : t('personaConfig.promptFieldCount', { count: group.field_count })}
                </p>
                {(activeByGroup[group.name]?.length ?? 0) > 0 && (
                  <p className="break-words text-foreground">
                    {t('personaConfig.promptActiveOnCard', {
                      names: (activeByGroup[group.name] ?? []).join(
                        t('personaConfig.activePromptGroupSep'),
                      ),
                    })}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={activeName !== null} onOpenChange={(open) => !open && setActiveName(null)}>
        <SheetContent
          side="right"
          overlayClassName={cn(sheetOverlay, SHEET_OVERLAY_MOTION)}
          className="glass-card !fixed !inset-y-0 !right-0 !left-auto !top-0 flex h-full w-full !max-w-full flex-col gap-0 !rounded-none !border-l bg-background/95 p-0 data-[state=open]:animate-sheet-slide-in-right data-[state=closed]:animate-sheet-slide-out-right sm:!max-w-[60vw]"
          onPointerDownOutside={(event) => {
            if (eventTargetInPlaceholderMenu(event.target)) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (eventTargetInPlaceholderMenu(event.target)) event.preventDefault();
          }}
        >
          <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
            <SheetTitle>
              {t('personaConfig.promptEdit')}: {activeName}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('personaConfig.promptEditHint')}
            </SheetDescription>
          </SheetHeader>
          {!opening && sections.length > 0 && (
            <div className="shrink-0 px-6 pt-4">
              <TabButtonGroup
                value={section || sections[0]?.section || ''}
                onValueChange={selectSection}
                options={sections.map((block) => {
                  const Icon = sectionIcon(block.fields);
                  return {
                    value: block.section,
                    label: block.section,
                    icon: Icon ? <Icon className="h-4 w-4" /> : undefined,
                  };
                })}
              />
            </div>
          )}
          <div ref={sheetBodyRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {builtin && (
              <GlassAlert tone="warning" className="mb-6">
                {t('personaConfig.promptBuiltinWarning')}
              </GlassAlert>
            )}
            {opening ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <PlaceholderPreviewProvider
                preview={preview}
                groupName={activeName ?? ''}
                answerContractDraft={draft.answer_contract}
              >
                <div className="space-y-6">
                  {(sections.find((block) => block.section === section) ?? sections[0])?.fields.map(
                    (field) => (
                      <div key={field.key} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <LabelWithHelp
                            htmlFor={`prompt-${field.key}`}
                            label={field.title}
                            description={
                              field.description ? (
                                <PlaceholderText text={field.description} />
                              ) : undefined
                            }
                            className="text-base font-bold leading-snug text-foreground"
                          />
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {promptCharCount(draft[field.key] ?? '', field.frozen_suffix)} 字
                          </span>
                        </div>
                        <PlaceholderEditor
                          id={`prompt-${field.key}`}
                          value={draft[field.key] ?? ''}
                          placeholders={field.placeholders}
                          readOnly={builtin}
                          onChange={(text) => setDraft((prev) => ({ ...prev, [field.key]: text }))}
                        />
                        {field.frozen_suffix ? (
                          <div className="cursor-not-allowed select-text whitespace-pre-wrap rounded-lg border-2 border-primary/35 bg-muted/40 px-3 py-2 text-sm leading-7 opacity-80">
                            {field.frozen_suffix}
                          </div>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              </PlaceholderPreviewProvider>
            )}
          </div>
          <SheetFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setActiveName(null)}>
              {t('common.cancel')}
            </Button>
            {!builtin && (
              <Button
                className="button-solid"
                onClick={() => void save()}
                disabled={saving || opening}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCopySource(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {copySource ? t('personaConfig.promptCopy') : t('personaConfig.promptCreate')}
            </DialogTitle>
            <DialogDescription>
              {copySource
                ? t('personaConfig.promptCopyDesc', { name: copySource })
                : t('personaConfig.promptCreateDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="prompt-group-name">{t('personaConfig.promptName')}</Label>
            <Input
              id="prompt-group-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t('personaConfig.promptNamePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button
              className="button-solid"
              onClick={() => void submitCreate()}
              disabled={busy || !newName.trim()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
