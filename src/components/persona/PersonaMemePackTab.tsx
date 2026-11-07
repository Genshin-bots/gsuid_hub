import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Flame, ImageOff, Loader2, Smile } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { Switch } from '@/components/ui/switch';
import { getAuthToken, memeApi, personaApi, type MemePackSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

const MAX_PACKS = 16;
const PREVIEW_COUNT = 4;

type TabSnapshot = {
  packs: MemePackSummary[];
  selected: string[];
  previews: Record<string, string[]>;
};

const tabCache = new Map<string, TabSnapshot>();
const thumbBlobUrls = new Map<string, string>();
const thumbInflight = new Map<string, Promise<string | null>>();

function loadThumb(memeId: string): Promise<string | null> {
  const cached = thumbBlobUrls.get(memeId);
  if (cached) return Promise.resolve(cached);
  const pending = thumbInflight.get(memeId);
  if (pending) return pending;
  const job = (async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(memeApi.getThumbUrl(memeId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      thumbBlobUrls.set(memeId, url);
      return url;
    } catch {
      return null;
    } finally {
      thumbInflight.delete(memeId);
    }
  })();
  thumbInflight.set(memeId, job);
  return job;
}

function getDerivedCooldown(frequency: number): number {
  if (frequency <= 0) return 0;
  if (frequency < 20) return 180;
  if (frequency < 40) return 120;
  if (frequency < 65) return 60;
  if (frequency < 85) return 30;
  return 15;
}

function getTierLabel(frequency: number): string {
  if (frequency <= 0) return '0 · 禁用表情';
  if (frequency < 20) return '1-19 · 极少使用 (约10%)';
  if (frequency < 40) return '20-39 · 低频点缀 (约25%)';
  if (frequency < 65) return '40-64 · 自然适中 (约50% 默认)';
  if (frequency < 85) return '65-84 · 高频活跃 (约75%)';
  return '85-100 · 极高频必配 (约90%)';
}

export function PersonaMemePackTab({
  personaName,
  allowReply,
  onAllowReplyChange,
  frequency = 50,
  onFrequencyChange,
  cooldownSec = 0,
  onCooldownSecChange,
  readOnly = false,
}: {
  personaName: string;
  allowReply: boolean;
  onAllowReplyChange: (value: boolean) => void;
  frequency?: number;
  onFrequencyChange?: (value: number) => void;
  cooldownSec?: number;
  onCooldownSecChange?: (value: number) => void;
  /** git 市场人格：包绑定由仓库拥有，只允许预览/导出，不允许改挂载或导入 */
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const cached = tabCache.get(personaName);
  const [packs, setPacks] = useState<MemePackSummary[]>(cached?.packs ?? []);
  const [selected, setSelected] = useState<string[]>(cached?.selected ?? []);
  const [previews, setPreviews] = useState<Record<string, string[]>>(cached?.previews ?? {});
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [savingAllow, setSavingAllow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentFreq, setCurrentFreq] = useState(frequency);
  const [currentCd, setCurrentCd] = useState(cooldownSec);

  useEffect(() => {
    setCurrentFreq(frequency);
  }, [frequency]);

  useEffect(() => {
    setCurrentCd(cooldownSec);
  }, [cooldownSec]);

  const load = useCallback(async () => {
    const snap = tabCache.get(personaName);
    if (snap) {
      setPacks(snap.packs);
      setSelected(snap.selected);
      setPreviews(snap.previews);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const [all, bound] = await Promise.all([
        memeApi.getPacks(),
        memeApi.getPersonaPacks(personaName),
      ]);
      const next = Array.isArray(all) ? all : [];
      setPacks(next);
      setSelected(bound?.pack_ids ?? []);
      const thumbs = await Promise.all(
        next.map(async (pack) => {
          if (pack.member_count <= 0) return [pack.pack_id, [] as string[]] as const;
          const page = await memeApi.listPackMembers(pack.pack_id, {
            page: 1,
            page_size: PREVIEW_COUNT,
          });
          const ids = (page?.records ?? []).map((row) => row.meme_id).filter(Boolean);
          return [pack.pack_id, ids] as const;
        }),
      );
      const previewMap = Object.fromEntries(thumbs);
      setPreviews(previewMap);
      tabCache.set(personaName, {
        packs: next,
        selected: bound?.pack_ids ?? [],
        previews: previewMap,
      });
    } catch {
      toast.error('表情包列表加载失败');
      setPacks([]);
      setSelected([]);
    } finally {
      setLoading(false);
    }
  }, [personaName]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (packId: string) => {
    if (readOnly) return;
    setSelected((current) => {
      if (current.includes(packId)) return current.filter((id) => id !== packId);
      if (current.length >= MAX_PACKS) {
        toast.error(`一个人格最多挂载 ${MAX_PACKS} 个表情包`);
        return current;
      }
      return [...current, packId];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await memeApi.setPersonaPacks(personaName, selected);
      const prev = tabCache.get(personaName);
      if (prev) tabCache.set(personaName, { ...prev, selected });
      toast.success('已保存表情包挂载');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const exportBundle = async () => {
    try {
      const blob = await memeApi.exportPersonaBundle(personaName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${personaName}.persona.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败');
    }
  };

  const importBundle = async (file: File) => {
    try {
      await memeApi.importPersonaBundle(file);
      toast.success('已导入人格整包');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败');
    }
  };

  const changeAllow = async (value: boolean) => {
    const previous = allowReply;
    onAllowReplyChange(value);
    setSavingAllow(true);
    try {
      await personaApi.updatePersonaConfig(personaName, { allow_meme_reply: value });
    } catch (error) {
      onAllowReplyChange(previous);
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSavingAllow(false);
    }
  };

  const handleFreqChange = async (nextVal: number) => {
    const clamped = Math.max(0, Math.min(100, nextVal));
    setCurrentFreq(clamped);
    onFrequencyChange?.(clamped);
    try {
      await personaApi.updatePersonaConfig(personaName, { meme_frequency: clamped });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '表情频率保存失败');
    }
  };

  const handleCooldownChange = async (nextVal: number) => {
    const clamped = Math.max(0, Math.min(3600, nextVal));
    setCurrentCd(clamped);
    onCooldownSecChange?.(clamped);
    try {
      await personaApi.updatePersonaConfig(personaName, { meme_send_cooldown_sec: clamped });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '发图冷却保存失败');
    }
  };

  const derivedCd = getDerivedCooldown(currentFreq);
  const tierLabel = getTierLabel(currentFreq);

  return (
    <div className="space-y-4">
      {/* 表情回复总开关 */}
      <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
        <LabelWithHelp
          htmlFor="allow-meme-reply"
          icon={<Smile className="h-4 w-4" />}
          label={t('personaConfig.allowMemeReply')}
          description={t('personaConfig.allowMemeReplyHint')}
          className="text-base font-medium"
        />
        <Switch
          id="allow-meme-reply"
          checked={allowReply}
          disabled={savingAllow || readOnly}
          onCheckedChange={(value) => void changeAllow(value)}
          aria-label={t('personaConfig.allowMemeReply')}
        />
      </div>

      {/* 表情频率与冷却配置块（仅在允许回复时展示） */}
      {allowReply && (
        <div className="space-y-4 rounded-xl border p-4 bg-muted/20">
          {/* 表情发送倾向 / 频率 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <LabelWithHelp
                htmlFor="meme-frequency"
                icon={<Flame className="h-4 w-4" />}
                label={t('personaConfig.memeFrequency')}
                description={t('personaConfig.memeFrequencyHint')}
                className="text-sm font-medium"
              />
              <span className="shrink-0 text-xs font-semibold text-primary">{tierLabel}</span>
            </div>
            <div className="flex items-center gap-3">
              <Input
                id="meme-frequency"
                inputMode="numeric"
                aria-label={t('personaConfig.memeFrequency')}
                disabled={readOnly}
                min={0}
                max={100}
                value={currentFreq}
                onChange={(e) => {
                  const num = Math.min(
                    100,
                    Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)),
                  );
                  void handleFreqChange(num);
                }}
                className="h-9 w-20 shrink-0 px-2 text-center text-sm tabular-nums"
              />
              <div className="flex flex-wrap gap-1.5 flex-1 items-center">
                {[
                  { val: 0, tag: '0 禁用' },
                  { val: 10, tag: '10 极少' },
                  { val: 25, tag: '25 低频' },
                  { val: 50, tag: '50 适中' },
                  { val: 75, tag: '75 活跃' },
                  { val: 100, tag: '100 必配' },
                ].map(({ val, tag }) => (
                  <button
                    key={val}
                    type="button"
                    disabled={readOnly}
                    onClick={() => void handleFreqChange(val)}
                    className={cn(
                      'h-9 rounded-md px-2.5 sm:px-3 text-xs transition-colors inline-flex items-center justify-center',
                      (val === 0 && currentFreq === 0) ||
                        (val === 10 && currentFreq > 0 && currentFreq < 20) ||
                        (val === 25 && currentFreq >= 20 && currentFreq < 40) ||
                        (val === 50 && currentFreq >= 40 && currentFreq < 65) ||
                        (val === 75 && currentFreq >= 65 && currentFreq < 85) ||
                        (val === 100 && currentFreq >= 85)
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 表情发送冷却 */}
          <div className="space-y-2 pt-3 border-t">
            <div className="flex items-center justify-between gap-2">
              <LabelWithHelp
                htmlFor="meme-cooldown"
                icon={<Clock className="h-4 w-4" />}
                label={t('personaConfig.memeCooldownSec')}
                description={t('personaConfig.memeCooldownSecHint', { sec: derivedCd })}
                className="text-sm font-medium"
              />
              <span className="shrink-0 text-xs text-muted-foreground">
                {currentCd === 0 ? `自适应 (${derivedCd} 秒)` : `固定 ${currentCd} 秒`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Input
                id="meme-cooldown"
                inputMode="numeric"
                aria-label={t('personaConfig.memeCooldownSec')}
                disabled={readOnly}
                min={0}
                max={3600}
                value={currentCd}
                onChange={(e) => {
                  const num = Math.min(
                    3600,
                    Math.max(0, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)),
                  );
                  void handleCooldownChange(num);
                }}
                className="h-9 w-20 shrink-0 px-2 text-center text-sm tabular-nums"
              />
              <div className="flex flex-wrap gap-1.5 flex-1 items-center">
                {[
                  { val: 0, tag: '0 自适应' },
                  { val: 15, tag: '15秒' },
                  { val: 30, tag: '30秒' },
                  { val: 60, tag: '60秒' },
                  { val: 120, tag: '120秒' },
                  { val: 300, tag: '300秒' },
                ].map(({ val, tag }) => (
                  <button
                    key={val}
                    type="button"
                    disabled={readOnly}
                    onClick={() => void handleCooldownChange(val)}
                    className={cn(
                      'h-9 rounded-md px-2.5 sm:px-3 text-xs transition-colors inline-flex items-center justify-center',
                      currentCd === val
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 表情包挂载选择 */}
      <div className="flex items-center justify-between gap-3">
        <LabelWithHelp
          label={t('personaConfig.memePacks')}
          description={t('personaConfig.memePackSelectHint', { max: MAX_PACKS })}
          className="text-sm font-medium"
        />
        <span className="shrink-0 text-xs text-muted-foreground">
          已选 {selected.length} / {MAX_PACKS}
        </span>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">正在加载表情包</span>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-xl border p-3">
              <div className="mb-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
              <div className="flex gap-2">
                {Array.from({ length: PREVIEW_COUNT }, (_, thumb) => (
                  <div key={thumb} className="h-16 w-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : packs.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          还没有表情包。
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {packs.map((pack) => {
            const on = selected.includes(pack.pack_id);
            const ids = pack.pack_id in previews ? previews[pack.pack_id] : undefined;
            return (
              <div
                key={pack.pack_id}
                role="button"
                tabIndex={0}
                onClick={() => toggle(pack.pack_id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggle(pack.pack_id);
                  }
                }}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  on ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      checked={on}
                      disabled={readOnly}
                      onCheckedChange={() => toggle(pack.pack_id)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      aria-label={pack.name}
                    />
                    <span className="truncate font-medium">{pack.name}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {pack.member_count} 张
                  </span>
                </div>
                <div className="flex gap-2">
                  {pack.member_count === 0 ? (
                    <span className="text-xs text-muted-foreground">这个包还没有图</span>
                  ) : ids === undefined ? (
                    Array.from({ length: PREVIEW_COUNT }, (_, thumb) => (
                      <div key={thumb} className="h-16 w-16 animate-pulse rounded-lg bg-muted" />
                    ))
                  ) : ids.length === 0 ? (
                    <span className="text-xs text-muted-foreground">暂时没有可预览的图</span>
                  ) : (
                    ids.map((memeId) => <PackThumb key={memeId} memeId={memeId} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving || loading || readOnly}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          保存挂载
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void exportBundle()}
          disabled={loading}
        >
          导出整包
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={loading || readOnly}
        >
          导入整包
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void importBundle(file);
          }}
        />
      </div>
    </div>
  );
}

function PackThumb({ memeId }: { memeId: string }) {
  const [url, setUrl] = useState<string | null>(thumbBlobUrls.get(memeId) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    void loadThumb(memeId).then((next) => {
      if (revoked) return;
      if (next) setUrl(next);
      else setFailed(true);
    });
    return () => {
      revoked = true;
    };
  }, [memeId]);

  return (
    <div className="h-16 w-16 overflow-hidden rounded-lg bg-muted">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : failed ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-4 w-4" />
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-muted" />
      )}
    </div>
  );
}
