import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  GitMerge,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Save,
  Scissors,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CognitionAttachments } from '@/components/cognition/CognitionAttachments';
import type {
  CognitionNode,
  MemoryEntity,
  MemoryEntityDetail,
  MemoryEntityEdge,
  MemoryEntityPatchRequest,
  MemoryEntitySplitRequest,
  MemoryEntitySplitResponse,
} from '@/lib/api';

interface EntityCurationDrawerProps {
  entity: MemoryEntityDetail;
  sameScopeEntities: MemoryEntity[];
  worldHub?: CognitionNode | null;
  formatDate: (s: string | null | undefined) => string;
  onOpenEntity: (entityId: string) => void;
  onOpenWorldHub: (hub: CognitionNode) => void;
  onInvalidateEdge: (edge: MemoryEntityEdge) => void;
  onPatchEntity: (
    entityId: string,
    payload: MemoryEntityPatchRequest,
  ) => Promise<MemoryEntityDetail | null>;
  onMergeEntity: (sourceId: string, targetId: string) => Promise<MemoryEntityDetail | null>;
  onSplitEntity: (
    sourceId: string,
    payload: MemoryEntitySplitRequest,
  ) => Promise<MemoryEntitySplitResponse | null>;
}

const ENTITY_KINDS = [
  'speaker',
  'person',
  'project',
  'item',
  'location',
  'org',
  'concept',
  'event',
] as const;

export function EntityCurationDrawer({
  entity,
  sameScopeEntities,
  worldHub,
  formatDate,
  onOpenEntity,
  onOpenWorldHub,
  onInvalidateEdge,
  onPatchEntity,
  onMergeEntity,
  onSplitEntity,
}: EntityCurationDrawerProps) {
  const { t } = useLanguage();
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState(entity.name);
  const [draftSummary, setDraftSummary] = useState(entity.summary || '');
  const [draftKind, setDraftKind] = useState(
    entity.entity_kind || (entity.is_speaker ? 'speaker' : 'person'),
  );
  const [newAlias, setNewAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Merge panel
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeQuery, setMergeQuery] = useState('');

  // Lossless split panel
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  const [splitNewName, setSplitNewName] = useState('');
  const [splitKind, setSplitKind] = useState<string>('person');
  const [splitSummary, setSplitSummary] = useState('');

  useEffect(() => {
    setEditingProfile(false);
    setDraftName(entity.name);
    setDraftSummary(entity.summary || '');
    setDraftKind(entity.entity_kind || (entity.is_speaker ? 'speaker' : 'person'));
    setNewAlias('');
    setAvatarFailed(false);
    setMergeOpen(false);
    setMergeTargetId('');
    setMergeQuery('');
    setSelectedEdgeIds(new Set());
    setSplitNewName('');
    setSplitKind('person');
    setSplitSummary('');
  }, [
    entity.id,
    entity.name,
    entity.summary,
    entity.entity_kind,
    entity.is_speaker,
    entity.avatar_url,
  ]);

  const selfAttrs = entity.self_attributes ?? [];
  const relations = entity.relations ?? [];
  const rumorsAndConflicts = entity.rumors_and_conflicts ?? [];
  const historyEdges = entity.history_edges ?? [];
  const aliases = entity.aliases ?? [];
  const pendingAliases = entity.pending_aliases ?? [];
  const entityEpisodes = entity.episodes ?? [];

  const hasMergePeers = useMemo(
    () =>
      sameScopeEntities.some(
        (item) => item.id !== entity.id && item.scope_key === entity.scope_key,
      ),
    [sameScopeEntities, entity.id, entity.scope_key],
  );

  const mergeCandidates = useMemo(() => {
    const q = mergeQuery.trim().toLowerCase();
    return sameScopeEntities
      .filter((item) => item.id !== entity.id && item.scope_key === entity.scope_key)
      .filter(
        (item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          (item.user_id ?? '').toLowerCase().includes(q),
      )
      .slice(0, 120);
  }, [sameScopeEntities, entity.id, entity.scope_key, mergeQuery]);

  const toggleEdgeSelection = (edgeId: string) => {
    setSelectedEdgeIds((prev) => {
      const next = new Set(prev);
      if (next.has(edgeId)) next.delete(edgeId);
      else next.add(edgeId);
      return next;
    });
  };

  const initialKind = entity.entity_kind || (entity.is_speaker ? 'speaker' : 'person');
  const hasBoundUid = Boolean((entity.user_id || '').trim());

  const handleSaveProfile = async () => {
    const cleanName = draftName.trim();
    if (!cleanName) return;
    setBusy(true);
    try {
      const payload: MemoryEntityPatchRequest = {
        summary: draftSummary.trim(),
      };
      if (cleanName !== entity.name) payload.name = cleanName;
      if (draftKind !== initialKind) payload.entity_kind = draftKind;
      const updated = await onPatchEntity(entity.id, payload);
      if (updated) {
        toast.success(t('aiMemory.entityUpdated'));
        setEditingProfile(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAddAlias = async () => {
    const clean = newAlias.trim();
    if (!clean || aliases.includes(clean) || clean === entity.name) return;
    setBusy(true);
    try {
      const updated = await onPatchEntity(entity.id, { aliases: [...aliases, clean] });
      if (updated) {
        setNewAlias('');
        toast.success(t('aiMemory.entityUpdated'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveAlias = async (target: string) => {
    setBusy(true);
    try {
      const updated = await onPatchEntity(entity.id, {
        aliases: aliases.filter((a) => a !== target),
      });
      if (updated) toast.success(t('aiMemory.entityUpdated'));
    } finally {
      setBusy(false);
    }
  };

  const handlePromotePending = async (alias: string) => {
    setBusy(true);
    try {
      const updated = await onPatchEntity(entity.id, { promote_pending_alias: alias });
      if (updated) toast.success(t('aiMemory.entityUpdated'));
    } finally {
      setBusy(false);
    }
  };

  const handleDismissPending = async (alias: string) => {
    setBusy(true);
    try {
      const updated = await onPatchEntity(entity.id, { dismiss_pending_alias: alias });
      if (updated) toast.success(t('aiMemory.entityUpdated'));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergeTargetId) return;
    setBusy(true);
    try {
      const merged = await onMergeEntity(entity.id, mergeTargetId);
      if (merged) {
        toast.success(t('aiMemory.entityMerged'));
        setMergeOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSplit = async () => {
    const edgeIds = Array.from(selectedEdgeIds);
    if (edgeIds.length === 0 || !splitNewName.trim()) return;
    setBusy(true);
    try {
      const res = await onSplitEntity(entity.id, {
        edge_ids: edgeIds,
        new_name: splitNewName.trim(),
        entity_kind: splitKind,
        summary: splitSummary.trim(),
      });
      if (res) {
        toast.success(t('aiMemory.entitySplitDone', { count: res.moved_edges }));
        setSelectedEdgeIds(new Set());
        setSplitNewName('');
        setSplitSummary('');
      }
    } finally {
      setBusy(false);
    }
  };

  const renderEdgeRow = (edge: MemoryEntityEdge, showPeer: boolean) => {
    const isSelected = selectedEdgeIds.has(edge.id);
    const peerId =
      edge.source_entity_id === entity.id ? edge.target_entity_id : edge.source_entity_id;
    const peerName =
      edge.source_entity_id === entity.id
        ? edge.target_entity_name || peerId
        : edge.source_entity_name || peerId;
    const state = edge.resolution_state || 'active';

    return (
      <div
        key={edge.id}
        className={cn(
          'rounded-lg border p-3 transition-colors',
          isSelected ? 'border-primary bg-primary/5' : 'border-border/50',
          edge.invalid_at && 'opacity-65',
        )}
      >
        <div className="flex items-start gap-2.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleEdgeSelection(edge.id)}
            className="mt-1 shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={
                  state === 'contradicted'
                    ? 'destructive'
                    : state === 'active'
                      ? 'default'
                      : 'outline'
                }
                className="text-[11px]"
              >
                {t(`aiMemory.edgeState_${state}`)}
              </Badge>
              {edge.edge_kind && (
                <Badge variant="outline" className="text-[11px]">
                  {t(`aiMemory.edgeKind_${edge.edge_kind}`)}
                </Badge>
              )}
              {edge.slot_key && (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {edge.slot_key}
                </Badge>
              )}
              {showPeer && peerId !== entity.id && (
                <button
                  type="button"
                  onClick={() => onOpenEntity(peerId)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ChevronRight
                    className={cn('h-3 w-3', edge.direction === 'incoming' && 'rotate-180')}
                  />
                  {peerName}
                </button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{edge.fact}</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span>
                {t('aiMemory.validAt')}: {formatDate(edge.event_at || edge.valid_at)}
              </span>
              {edge.mention_count !== undefined && <span>×{edge.mention_count}</span>}
              {typeof edge.decay_score === 'number' && (
                <span>
                  {t('aiMemory.entityEdgeScore')} {edge.decay_score.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-destructive hover:text-destructive h-7 px-2"
            disabled={!!edge.invalid_at || state === 'retracted' || state === 'superseded'}
            onClick={() => onInvalidateEdge(edge)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  const initials = (entity.name || '?').slice(0, 2).toUpperCase();
  const showAvatarImg = !!entity.avatar_url && !avatarFailed;

  return (
    <div className="space-y-4">
      {/* Header Profile Card */}
      <div className="rounded-lg p-4 glass-card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden border border-primary/40 bg-primary/15 flex items-center justify-center font-semibold text-sm text-primary">
              {showAvatarImg ? (
                <img
                  src={entity.avatar_url}
                  alt={entity.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="font-semibold text-base truncate">{entity.name}</h3>
                <Badge
                  variant={entity.is_speaker ? 'default' : 'secondary'}
                  className="text-[11px]"
                >
                  {entity.entity_kind || (entity.is_speaker ? 'speaker' : 'entity')}
                </Badge>
              </div>
              <p className="text-xs font-mono text-muted-foreground truncate">
                {entity.user_id ? `UID: ${entity.user_id} · ` : ''}
                {entity.scope_key}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setEditingProfile((v) => !v)}
            >
              <Pencil className="w-3.5 h-3.5 mr-1" />
              {t('aiMemory.entityEditInfo')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setMergeOpen((v) => !v);
                setMergeQuery('');
                setMergeTargetId('');
              }}
              disabled={!hasMergePeers}
            >
              <GitMerge className="w-3.5 h-3.5 mr-1" />
              {t('aiMemory.entityMerge')}
            </Button>
          </div>
        </div>

        {editingProfile ? (
          <div className="space-y-2.5 rounded-md border border-border/50 bg-muted/20 p-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">{t('aiMemory.name')}</Label>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('aiMemory.entityKind')}</Label>
                <Select value={draftKind} onValueChange={setDraftKind}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_KINDS.map((k) => {
                      const nonHumanBlocked = hasBoundUid && k !== 'speaker' && k !== 'person';
                      return (
                        <SelectItem key={k} value={k} disabled={nonHumanBlocked}>
                          {k}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('aiMemory.summary')}</Label>
              <Textarea
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditingProfile(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={busy || !draftName.trim()}
                onClick={handleSaveProfile}
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1" />
                )}
                {t('common.save')}
              </Button>
            </div>
          </div>
        ) : (
          entity.summary && (
            <p className="text-sm bg-muted/40 rounded-md p-2.5 whitespace-pre-wrap">
              {entity.summary}
            </p>
          )
        )}

        {mergeOpen && (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="text-xs text-muted-foreground">{t('aiMemory.entityMergeDesc')}</p>
            <Input
              value={mergeQuery}
              onChange={(e) => setMergeQuery(e.target.value)}
              placeholder={t('aiMemory.entityMergeSearchPlaceholder')}
              className="h-8 text-xs"
            />
            <div className="flex items-center gap-2">
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder={t('aiMemory.targetEntity')} />
                </SelectTrigger>
                <SelectContent>
                  {mergeCandidates.map((cand) => (
                    <SelectItem key={cand.id} value={cand.id}>
                      {cand.name}
                      {cand.user_id ? ` (${cand.user_id})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs shrink-0"
                disabled={busy || !mergeTargetId}
                onClick={handleConfirmMerge}
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <GitMerge className="w-3.5 h-3.5 mr-1" />
                )}
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        )}

        {worldHub && (
          <div className="pt-1 space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md border border-border/50 p-2.5 text-left hover:bg-accent/40 text-xs"
              onClick={() => onOpenWorldHub(worldHub)}
            >
              <span className="flex items-center gap-2 font-medium truncate">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{worldHub.title || worldHub.ref}</span>
              </span>
              <Badge variant="secondary" className="shrink-0 text-[11px]">
                {t('aiMemory.articleCount', { count: worldHub.attachments?.length ?? 0 })}
              </Badge>
            </button>
            {(worldHub.attachments?.length ?? 0) > 0 && (
              <CognitionAttachments
                attachments={worldHub.attachments ?? []}
                openLabel={t('aiMemory.openArticle')}
                writableLabel={t('aiMemory.articleWritable')}
                readonlyLabel={t('aiMemory.articleReadonly')}
              />
            )}
          </div>
        )}
      </div>

      {/* Lossless Split Action Bar (visible when >= 1 edge checked) */}
      {selectedEdgeIds.size > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium flex items-center gap-1.5 text-primary">
              <Scissors className="w-3.5 h-3.5" />
              {t('aiMemory.entitySplitDesc', { count: selectedEdgeIds.size })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setSelectedEdgeIds(new Set())}
            >
              <X className="w-3 h-3 mr-1" />
              {t('common.cancel')}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              value={splitNewName}
              onChange={(e) => setSplitNewName(e.target.value)}
              placeholder={t('aiMemory.entitySplitNewName')}
              className="h-8 text-xs sm:col-span-2"
            />
            <Select value={splitKind} onValueChange={setSplitKind}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={splitSummary}
              onChange={(e) => setSplitSummary(e.target.value)}
              placeholder={t('aiMemory.summary')}
              className="h-8 text-xs flex-1"
            />
            <Button
              size="sm"
              className="h-8 text-xs shrink-0"
              disabled={busy || !splitNewName.trim()}
              onClick={handleConfirmSplit}
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Scissors className="w-3.5 h-3.5 mr-1" />
              )}
              {t('aiMemory.entitySplit')}
            </Button>
          </div>
        </div>
      )}

      {/* 5-Panel Curation Tabs */}
      <Tabs defaultValue="aliases" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-9">
          <TabsTrigger value="aliases" className="text-xs px-1.5">
            {t('aiMemory.entityTabAliases')} ({aliases.length + pendingAliases.length})
          </TabsTrigger>
          <TabsTrigger value="self" className="text-xs px-1.5">
            {t('aiMemory.entityTabSelfAttrs')} ({selfAttrs.length})
          </TabsTrigger>
          <TabsTrigger value="relations" className="text-xs px-1.5">
            {t('aiMemory.entityTabRelations')} ({relations.length})
          </TabsTrigger>
          <TabsTrigger value="rumors" className="text-xs px-1.5">
            {t('aiMemory.entityTabRumors')} ({rumorsAndConflicts.length})
          </TabsTrigger>
          <TabsTrigger value="episodes" className="text-xs px-1.5">
            {t('aiMemory.tabEpisodes')} ({entityEpisodes.length})
          </TabsTrigger>
        </TabsList>

        {/* Panel 1: Aliases & Pending Aliases */}
        <TabsContent value="aliases" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <Input
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAddAlias();
                }
              }}
              placeholder={t('aiMemory.entityAddAliasPlaceholder')}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs shrink-0"
              disabled={busy || !newAlias.trim()}
              onClick={handleAddAlias}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t('common.add')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aliases.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">—</p>
            ) : (
              aliases.map((al) => (
                <Badge key={al} variant="secondary" className="gap-1 pr-1 text-xs">
                  {al}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    onClick={() => void handleRemoveAlias(al)}
                    disabled={busy}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          {pendingAliases.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <Label className="text-xs text-muted-foreground">
                {t('aiMemory.entityPendingAliases')}
              </Label>
              <div className="space-y-1.5">
                {pendingAliases.map((p) => (
                  <div
                    key={p.alias}
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate">
                      <span className="font-medium">{p.alias}</span>
                      <span className="ml-2 text-muted-foreground">×{p.hits}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-emerald-500 hover:text-emerald-600"
                        disabled={busy}
                        onClick={() => void handlePromotePending(p.alias)}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        {t('aiMemory.entityPromoteAlias')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => void handleDismissPending(p.alias)}
                      >
                        <X className="w-3 h-3 mr-1" />
                        {t('aiMemory.entityDismissAlias')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Panel 2: Self-Loop Attributes (recovers 54% self-loop edges) */}
        <TabsContent value="self" className="space-y-2 mt-3 max-h-[340px] overflow-y-auto pr-1">
          {selfAttrs.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t('aiMemory.noEdges')}
            </p>
          ) : (
            selfAttrs.map((edge) => renderEdgeRow(edge, false))
          )}
        </TabsContent>

        {/* Panel 3: Cross-Entity Relations */}
        <TabsContent
          value="relations"
          className="space-y-2 mt-3 max-h-[340px] overflow-y-auto pr-1"
        >
          {relations.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t('aiMemory.noEdges')}
            </p>
          ) : (
            relations.map((edge) => renderEdgeRow(edge, true))
          )}
        </TabsContent>

        {/* Panel 4: Staging Rumors, Conflicts & History */}
        <TabsContent value="rumors" className="space-y-2.5 mt-3 max-h-[340px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t('aiMemory.entityTabHistory')} ({historyEdges.length})
            </span>
            <Switch checked={showHistory} onCheckedChange={setShowHistory} />
          </div>
          {rumorsAndConflicts.length === 0 && (!showHistory || historyEdges.length === 0) ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t('aiMemory.noEdges')}
            </p>
          ) : (
            <div className="space-y-2">
              {rumorsAndConflicts.map((edge) => renderEdgeRow(edge, true))}
              {showHistory && historyEdges.map((edge) => renderEdgeRow(edge, true))}
            </div>
          )}
        </TabsContent>

        {/* Panel 5: Mentioning episode excerpts (truncated to 240 chars by backend) */}
        <TabsContent value="episodes" className="space-y-2 mt-3 max-h-[340px] overflow-y-auto pr-1">
          {entityEpisodes.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t('aiMemory.noEpisodes')}
            </p>
          ) : (
            entityEpisodes.map((ep) => (
              <div key={ep.id} className="rounded-lg border border-border/50 p-3 space-y-1.5">
                <p className="text-sm whitespace-pre-wrap break-words">{ep.content}</p>
                <p className="text-[11px] text-muted-foreground">{formatDate(ep.valid_at)}</p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
