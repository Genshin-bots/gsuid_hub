/**
 * MemorySettingsDialog — AI 记忆子系统设置 + HierGraph 重建
 *
 * 来源：docs/skills/gshub-development/README.md §3.1「完全空缺」第 7 项
 *
 * 字段与 `gsuid_core/ai_core/memory/config.py` 对齐。当前只展示常用字段，
 * 未覆盖的字段通过 rawConfig 兜底保存（不丢数据）。
 *
 * 涉及的 SKILL 章节：
 * - [§07 配置页 dirty 检查](../../docs/skills/gshub-development/references/07-config-pages-and-state.md)
 * - [§10 错误 toast 回显后端 detail](../../docs/skills/gshub-development/references/10-pitfalls-and-performance.md) P-13
 */
import { useEffect, useState } from 'react';
import { Brain, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { TagsInput } from '@/components/config/TagsInput';
import { memoryApi, memorySettingsApi, getApiErrorMessage } from '@/lib/api';

interface MemoryConfig {
  observer_enabled?: boolean;
  observer_blacklist?: string[];
  ingestion_enabled?: boolean;
  enable_retrieval?: boolean;
  enable_system2?: boolean;
  enable_user_global_memory?: boolean;
  enable_heartbeat_memory?: boolean;
  retrieval_top_k?: number;
  batch_max_size?: number;
  batch_interval_seconds?: number;
  idle_flush_seconds?: number;
  llm_semaphore_limit?: number;
  dedup_similarity_threshold?: number;
  edge_conflict_threshold?: number;
  min_children_per_category?: number;
  max_layers?: number;
  hiergraph_rebuild_ratio?: number;
  hiergraph_rebuild_interval_seconds?: number;
  // read-only reflections from MEMORY_CONFIG
  enable_preference_memory?: boolean;
  enable_familiarity_routing?: boolean;
  enable_recollection_path?: boolean;
  preference_max_inject?: number;
  [k: string]: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeKey?: string;
  onAfterSave?: () => void;
  onRebuild?: () => void;
}

export default function MemorySettingsDialog({
  open,
  onOpenChange,
  scopeKey,
  onAfterSave,
  onRebuild,
}: Props) {
  const { t } = useLanguage();
  const [cfg, setCfg] = useState<MemoryConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const data = (await memorySettingsApi.getConfig()) as MemoryConfig;
        setCfg(data);
      } catch (e) {
        toast.error(getApiErrorMessage(e, t('memorySettings.loadFailed')));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, scopeKey, t]);

  const onSwitch = (k: keyof MemoryConfig, v: boolean) => {
    setCfg((prev) => (prev ? { ...prev, [k]: v } : prev));
  };
  const onNumber = (k: keyof MemoryConfig, v: number) => {
    setCfg((prev) => (prev ? { ...prev, [k]: Number.isFinite(v) ? v : undefined } : prev));
  };

  const onSave = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await memorySettingsApi.updateConfig(cfg as Record<string, unknown>);
      toast.success(t('memorySettings.saveSuccess'));
      onAfterSave?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('memorySettings.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const onRebuildHierGraph = async () => {
    setRebuilding(true);
    try {
      await memoryApi.rebuildHierGraph(scopeKey);
      toast.success(t('memorySettings.rebuildTriggered'));
      onRebuild?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('memorySettings.rebuildFailed')));
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {t('memorySettings.title')}
          </DialogTitle>
          <DialogDescription>
            {scopeKey ? `scope: ${scopeKey}` : t('memorySettings.scopeGlobal')}
          </DialogDescription>
        </DialogHeader>

        {loading || !cfg ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 py-2">
            <SwitchRow
              label={t('memorySettings.fields.observerEnabled')}
              value={!!cfg.observer_enabled}
              onChange={(v) => onSwitch('observer_enabled', v)}
            />
            <SwitchRow
              label={t('memorySettings.fields.ingestionEnabled')}
              value={!!cfg.ingestion_enabled}
              onChange={(v) => onSwitch('ingestion_enabled', v)}
            />
            <SwitchRow
              label={t('memorySettings.fields.enableRetrieval')}
              value={!!cfg.enable_retrieval}
              onChange={(v) => onSwitch('enable_retrieval', v)}
            />
            <SwitchRow
              label={t('memorySettings.fields.enableSystem2')}
              value={!!cfg.enable_system2}
              onChange={(v) => onSwitch('enable_system2', v)}
            />
            <SwitchRow
              label={t('memorySettings.fields.enableUserGlobalMemory')}
              value={!!cfg.enable_user_global_memory}
              onChange={(v) => onSwitch('enable_user_global_memory', v)}
            />
            <SwitchRow
              label={t('memorySettings.fields.enableHeartbeatMemory')}
              value={!!cfg.enable_heartbeat_memory}
              onChange={(v) => onSwitch('enable_heartbeat_memory', v)}
            />

            <NumberRow
              label={t('memorySettings.fields.retrievalTopK')}
              value={cfg.retrieval_top_k ?? 8}
              onChange={(v) => onNumber('retrieval_top_k', v)}
              min={1}
              max={64}
            />
            <NumberRow
              label={t('memorySettings.fields.batchMaxSize')}
              value={cfg.batch_max_size ?? 20}
              onChange={(v) => onNumber('batch_max_size', v)}
              min={1}
              max={500}
            />
            <NumberRow
              label={t('memorySettings.fields.batchIntervalSeconds')}
              value={cfg.batch_interval_seconds ?? 7200}
              onChange={(v) => onNumber('batch_interval_seconds', v)}
              min={60}
              max={86400}
            />
            <NumberRow
              label={t('memorySettings.fields.idleFlushSeconds')}
              value={cfg.idle_flush_seconds ?? 180}
              onChange={(v) => onNumber('idle_flush_seconds', v)}
              min={0}
              max={86400}
            />
            <NumberRow
              label={t('memorySettings.fields.llmSemaphoreLimit')}
              value={cfg.llm_semaphore_limit ?? 3}
              onChange={(v) => onNumber('llm_semaphore_limit', v)}
              min={1}
              max={10}
            />
            <NumberRow
              label={t('memorySettings.fields.dedupSimilarityThreshold')}
              value={cfg.dedup_similarity_threshold ?? 0.86}
              onChange={(v) => onNumber('dedup_similarity_threshold', v)}
              min={0}
              max={1}
              step={0.01}
            />
            <NumberRow
              label={t('memorySettings.fields.edgeConflictThreshold')}
              value={cfg.edge_conflict_threshold ?? 0.8}
              onChange={(v) => onNumber('edge_conflict_threshold', v)}
              min={0}
              max={1}
              step={0.01}
            />
            <NumberRow
              label={t('memorySettings.fields.minChildrenPerCategory')}
              value={cfg.min_children_per_category ?? 3}
              onChange={(v) => onNumber('min_children_per_category', v)}
              min={1}
              max={20}
            />
            <NumberRow
              label={t('memorySettings.fields.maxLayers')}
              value={cfg.max_layers ?? 3}
              onChange={(v) => onNumber('max_layers', v)}
              min={1}
              max={8}
            />
            <NumberRow
              label={t('memorySettings.fields.hiergraphRebuildRatio')}
              value={cfg.hiergraph_rebuild_ratio ?? 0.2}
              onChange={(v) => onNumber('hiergraph_rebuild_ratio', v)}
              min={0}
              max={1}
              step={0.05}
            />
            <NumberRow
              label={t('memorySettings.fields.hiergraphRebuildIntervalSeconds')}
              value={cfg.hiergraph_rebuild_interval_seconds ?? 3600}
              onChange={(v) => onNumber('hiergraph_rebuild_interval_seconds', v)}
              min={60}
              max={86400}
            />

            <div className="md:col-span-2 space-y-1.5">
              <Label>{t('memorySettings.fields.observerBlacklist')}</Label>
              <TagsInput
                value={cfg.observer_blacklist ?? []}
                onChange={(tags) =>
                  setCfg((prev) => (prev ? { ...prev, observer_blacklist: tags } : prev))
                }
                placeholder={t('memorySettings.fields.observerBlacklistPlaceholder')}
              />
            </div>

            <div className="md:col-span-2 rounded-md border border-border/50 p-3 space-y-2 bg-muted/20">
              <p className="text-xs text-muted-foreground">{t('memorySettings.readonlyHint')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    {t('memorySettings.fields.enablePreferenceMemory')}:{' '}
                  </span>
                  {cfg.enable_preference_memory ? 'ON' : 'OFF'}
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t('memorySettings.fields.enableFamiliarityRouting')}:{' '}
                  </span>
                  {cfg.enable_familiarity_routing ? 'ON' : 'OFF'}
                </div>
                <div>
                  <span className="text-muted-foreground">
                    {t('memorySettings.fields.enableRecollectionPath')}:{' '}
                  </span>
                  {cfg.enable_recollection_path ? 'ON' : 'OFF'}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="!justify-between">
          <Button
            variant="outline"
            className="h-9"
            onClick={onRebuildHierGraph}
            disabled={rebuilding || !cfg}
          >
            {rebuilding ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {t('memorySettings.rebuildHierGraph')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
              {t('memorySettings.cancel')}
            </Button>
            <Button className="h-9" onClick={onSave} disabled={saving || !cfg}>
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('memorySettings.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Input
        type="number"
        className="h-9 w-32"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
