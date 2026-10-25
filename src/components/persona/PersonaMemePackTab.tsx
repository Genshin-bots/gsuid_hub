import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageOff, Loader2, Smile } from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

export function PersonaMemePackTab({
  personaName,
  allowReply,
  onAllowReplyChange,
}: {
  personaName: string;
  allowReply: boolean;
  onAllowReplyChange: (value: boolean) => void;
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

  return (
    <div className="space-y-4">
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
          disabled={savingAllow}
          onCheckedChange={(value) => void changeAllow(value)}
          aria-label={t('personaConfig.allowMemeReply')}
        />
      </div>
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
        <Button type="button" onClick={() => void save()} disabled={saving || loading}>
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
          disabled={loading}
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
