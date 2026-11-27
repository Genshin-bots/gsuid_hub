import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  Eye,
  Grid3x3,
  ImageOff,
  LayoutGrid,
  Link2,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { pageGapClass, PinnedPage } from '@/components/layout/PinnedPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapShrinkClass,
} from '@/components/ui/TabButtonGroup';
import {
  getApiErrorMessage,
  getAuthToken,
  memeStoreApi,
  personaApi,
  type MemeStoreListResponse,
  type MemeStorePackDetail,
  type MemeStoreTagItem,
  type PersonaListItem,
  type StoreMemePack,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const PACK_PAGE_SIZE = 24;
const ALL_SERIES_VALUE = '__all__';

const ASSET_CACHE_LIMIT = 200;
const assetBlobCache = new Map<string, string>();
const assetInflight = new Map<string, Promise<string | null>>();

function cacheAssetBlob(url: string, objectUrl: string): void {
  assetBlobCache.set(url, objectUrl);
  while (assetBlobCache.size > ASSET_CACHE_LIMIT) {
    const oldestKey = assetBlobCache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldestUrl = assetBlobCache.get(oldestKey);
    assetBlobCache.delete(oldestKey);
    if (oldestUrl) URL.revokeObjectURL(oldestUrl);
  }
}

function fetchAuthAsset(url: string): Promise<string | null> {
  const cached = assetBlobCache.get(url);
  if (cached) {
    // 重插到 Map 尾部维持 LRU 热度
    assetBlobCache.delete(url);
    assetBlobCache.set(url, cached);
    return Promise.resolve(cached);
  }
  const pending = assetInflight.get(url);
  if (pending) return pending;

  const job = (async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      cacheAssetBlob(url, objectUrl);
      return objectUrl;
    } catch {
      return null;
    } finally {
      assetInflight.delete(url);
    }
  })();

  assetInflight.set(url, job);
  return job;
}

function formatSizeKb(sizeKb: number): string {
  if (sizeKb < 1024) return `${sizeKb} KB`;
  return `${(sizeKb / 1024).toFixed(2)} MB`;
}

function storeTabCount(text: string, alert = false) {
  return (
    <span className={cn('tab-segment-count', alert && 'tab-segment-count-alert')}>{text}</span>
  );
}

const LazyAuthImage = memo(function LazyAuthImage({
  url,
  alt,
  className,
  placeholderClassName,
}: {
  url: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => assetBlobCache.has(url));
  const [src, setSrc] = useState<string | null>(() => assetBlobCache.get(url) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(assetBlobCache.get(url) ?? null);
    setFailed(false);
    if (assetBlobCache.has(url)) {
      setVisible(true);
    }
  }, [url]);

  useEffect(() => {
    if (visible) return;
    const node = holderRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || src || failed) return;
    let cancelled = false;
    void fetchAuthAsset(url).then((loaded) => {
      if (cancelled) return;
      if (loaded) setSrc(loaded);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, url, src, failed]);

  return (
    <div
      ref={holderRef}
      className={cn('relative overflow-hidden bg-muted/40', placeholderClassName)}
    >
      {src ? (
        <img src={src} alt={alt} className={cn('h-full w-full object-contain', className)} />
      ) : failed ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
          <ImageOff className="h-6 w-6" />
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-muted/60" />
      )}
    </div>
  );
});

export default function MemeStorePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('all');
  const [selectedSeries, setSelectedSeries] = useState(ALL_SERIES_VALUE);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [storePayload, setStorePayload] = useState<MemeStoreListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 预览弹框
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPack, setPreviewPack] = useState<StoreMemePack | null>(null);
  const [previewDetail, setPreviewDetail] = useState<MemeStorePackDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState<'grid' | 'sheet'>('grid');
  const [selectedItem, setSelectedItem] = useState<MemeStoreTagItem | null>(null);

  // 挂载到多个人格弹框
  const [mountOpen, setMountOpen] = useState(false);
  const [mountTarget, setMountTarget] = useState<{
    storeId: string;
    packId: string;
    packName: string;
  } | null>(null);
  const [personas, setPersonas] = useState<PersonaListItem[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [mountSaving, setMountSaving] = useState(false);

  // 从 URL 导入弹框
  const [installUrlOpen, setInstallUrlOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [branchInput, setBranchInput] = useState('');
  const [packNameInput, setPackNameInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);

  const fetchSeqRef = useRef(0);
  const fetchList = useCallback(
    async (opts?: { refresh?: boolean; checkUpdates?: boolean }) => {
      const seq = ++fetchSeqRef.current;
      try {
        setIsLoading(true);
        const data = await memeStoreApi.getList({
          tab: activeTab,
          series: selectedSeries === ALL_SERIES_VALUE ? undefined : selectedSeries,
          search: appliedSearch || undefined,
          limit: PACK_PAGE_SIZE,
          offset: (page - 1) * PACK_PAGE_SIZE,
          refresh: opts?.refresh,
          check_updates: opts?.checkUpdates,
        });
        // 快速连续切换筛选时丢弃先到的旧响应，避免陈旧的列表覆盖新条件的结果
        if (seq !== fetchSeqRef.current) return;
        setStorePayload(data);
      } catch (error) {
        if (seq !== fetchSeqRef.current) return;
        toast.error(getApiErrorMessage(error, t('memeStore.loadFailed')));
      } finally {
        if (seq === fetchSeqRef.current) setIsLoading(false);
      }
    },
    [activeTab, selectedSeries, appliedSearch, page, t],
  );

  useEffect(() => {
    const id = setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const patchPack = useCallback((storeId: string, patch: Partial<StoreMemePack>) => {
    setStorePayload((prev) => {
      if (!prev) return prev;
      const old = prev.packs.find((p) => p.id === storeId);
      if (!old) return prev;
      const next = { ...old, ...patch };
      const installedDelta = Number(next.installed) - Number(old.installed);
      const updatesDelta = Number(next.hasUpdate) - Number(old.hasUpdate);
      return {
        ...prev,
        packs: prev.packs.map((p) => (p.id === storeId ? next : p)),
        counts: {
          all: prev.counts.all,
          installed: Math.max(0, prev.counts.installed + installedDelta),
          updates: Math.max(0, prev.counts.updates + updatesDelta),
        },
      };
    });
    setPreviewPack((prev) => (prev && prev.id === storeId ? { ...prev, ...patch } : prev));
  }, []);

  const openMountDialog = useCallback(
    async (storeId: string, packId: string, packName: string, currentBound: string[]) => {
      setMountTarget({ storeId, packId, packName });
      setSelectedPersonas(currentBound);
      setMountOpen(true);
      setPersonasLoading(true);
      try {
        const list = await personaApi.getPersonaList();
        setPersonas(Array.isArray(list) ? list : []);
      } catch (error) {
        toast.error(getApiErrorMessage(error, t('memeStore.mountFailed')));
        setPersonas([]);
      } finally {
        setPersonasLoading(false);
      }
    },
    [t],
  );

  const handleInstall = async (pack: StoreMemePack) => {
    try {
      setActionLoading(pack.id);
      const res = await memeStoreApi.install(pack.id);
      patchPack(pack.id, {
        installed: true,
        local_pack_id: res.pack_id,
        local_pack_name: res.pack_name,
        bound_personas: res.bound_personas ?? [],
        hasUpdate: false,
        status: 'installed',
      });
      toast.success(
        t('memeStore.installSuccess', {
          name: res.pack_name,
          count: res.imported + res.reused,
        }),
        {
          action: {
            label: t('memeStore.installSuccessAction'),
            onClick: () =>
              void openMountDialog(pack.id, res.pack_id, res.pack_name, res.bound_personas ?? []),
          },
        },
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('memeStore.installFailed')));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdate = async (pack: StoreMemePack) => {
    try {
      setActionLoading(pack.id);
      const res = await memeStoreApi.update(pack.id);
      patchPack(pack.id, { hasUpdate: false, commit: res.commit });
      toast.success(
        t('memeStore.updateSuccess', {
          name: res.pack_name,
          added: res.added,
          removed: res.removed,
        }),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('memeStore.updateFailed')));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (pack: StoreMemePack) => {
    const displayName = pack.local_pack_name || pack.name;
    if (!confirm(t('memeStore.uninstallConfirm', { name: displayName }))) return;
    try {
      setActionLoading(pack.id);
      await memeStoreApi.uninstall(pack.id);
      patchPack(pack.id, {
        installed: false,
        local_pack_id: null,
        local_pack_name: null,
        bound_personas: [],
        hasUpdate: false,
        status: 'not_installed',
      });
      toast.success(t('memeStore.uninstallSuccess', { name: displayName }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('memeStore.uninstallFailed')));
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPreview = async (pack: StoreMemePack) => {
    setPreviewPack(pack);
    setPreviewDetail(null);
    setSelectedItem(null);
    setPreviewMode('grid');
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const detail = await memeStoreApi.getDetail(pack.id);
      setPreviewDetail(detail);
      if (detail.items.length > 0) {
        setSelectedItem(detail.items[0]);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('memeStore.detailLoadFailed')));
    } finally {
      setPreviewLoading(false);
    }
  };

  const togglePersonaSelection = (personaName: string) => {
    setSelectedPersonas((prev) =>
      prev.includes(personaName)
        ? prev.filter((name) => name !== personaName)
        : [...prev, personaName],
    );
  };

  const handleSaveMount = async () => {
    if (!mountTarget) return;
    try {
      setMountSaving(true);
      const editableSelected = selectedPersonas.filter((name) => {
        const meta = personas.find((p) => p.name === name);
        return !meta?.managed;
      });
      const res = await memeStoreApi.setPackPersonas(mountTarget.packId, editableSelected);
      patchPack(mountTarget.storeId, { bound_personas: res.bound_personas });
      toast.success(
        t('memeStore.mountSuccess', {
          name: res.pack_name,
          count: res.bound_personas.length,
        }),
      );
      setMountOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('memeStore.mountFailed')));
    } finally {
      setMountSaving(false);
    }
  };

  const handleInstallByUrl = async () => {
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      toast.error(t('memeStore.urlRequired'));
      return;
    }
    if (!/^(https?:\/\/|ssh:\/\/|git@)/i.test(cleanUrl)) {
      toast.error(t('memeStore.urlProtocolInvalid'));
      return;
    }
    try {
      setUrlLoading(true);
      const res = await memeStoreApi.installByUrl({
        url: cleanUrl,
        branch: branchInput.trim() || undefined,
        pack_name: packNameInput.trim() || undefined,
      });
      toast.success(
        t('memeStore.installSuccess', {
          name: res.pack_name,
          count: res.imported + res.reused,
        }),
        {
          action: {
            label: t('memeStore.installSuccessAction'),
            onClick: () =>
              void openMountDialog(res.store_id, res.pack_id, res.pack_name, res.bound_personas),
          },
        },
      );
      setInstallUrlOpen(false);
      setUrlInput('');
      setBranchInput('');
      setPackNameInput('');
      void fetchList({ refresh: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('memeStore.installFailed')));
    } finally {
      setUrlLoading(false);
    }
  };

  const visiblePacks = useMemo(() => storePayload?.packs ?? [], [storePayload]);
  const seriesList = useMemo(() => storePayload?.series_list ?? [], [storePayload]);
  const counts = useMemo(
    () => storePayload?.counts ?? { all: 0, installed: 0, updates: 0 },
    [storePayload],
  );
  const totalPages = Math.max(
    1,
    Math.ceil((storePayload?.count ?? visiblePacks.length) / PACK_PAGE_SIZE),
  );

  const countText = (value: number) => (isLoading ? '—' : String(value));
  const tabOptions = [
    {
      value: 'all',
      label: t('memeStore.allPacks'),
      icon: <Grid3x3 className="h-4 w-4" />,
      badge: storeTabCount(countText(counts.all)),
    },
    {
      value: 'installed',
      label: t('memeStore.installed'),
      icon: <Check className="h-4 w-4" />,
      badge: storeTabCount(countText(counts.installed)),
    },
    {
      value: 'updates',
      label: t('memeStore.updates'),
      icon: <RefreshCw className="h-4 w-4" />,
      badge: storeTabCount(countText(counts.updates), !isLoading && counts.updates > 0),
    },
  ];

  return (
    <PinnedPage
      header={
        <div className="flex items-start gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="mt-1.5 h-8 w-8 shrink-0"
            onClick={() => navigate('/ai-meme')}
            title={t('memeStore.back')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-3xl font-bold">
              <Store className="h-8 w-8 shrink-0" />
              {t('memeStore.title')}
            </h1>
            <p className="mt-1 text-muted-foreground">{t('memeStore.description')}</p>
          </div>
        </div>
      }
      toolbar={
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 lg:flex-nowrap">
          <div className={tabToolbarGroupWrapShrinkClass}>
            <TabButtonGroup
              options={tabOptions}
              value={activeTab}
              onValueChange={(value) => {
                setActiveTab(value);
                setPage(1);
              }}
              className="w-full flex-nowrap sm:w-auto"
              collapseOnMobile
            />
          </div>

          <Select
            value={selectedSeries}
            onValueChange={(value) => {
              setSelectedSeries(value);
              setPage(1);
            }}
          >
            <SelectTrigger
              className={cn(tabToolbarControlClass, 'w-full sm:w-44 shrink-0')}
              aria-label={t('memeStore.seriesFilter')}
            >
              <SelectValue placeholder={t('memeStore.allSeries')} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ALL_SERIES_VALUE}>{t('memeStore.allSeries')}</SelectItem>
              {seriesList.map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.name} ({s.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative col-span-2 min-w-0 sm:ml-auto sm:flex-1 sm:max-w-64 lg:max-w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('memeStore.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(tabToolbarControlClass, 'w-full pl-10')}
            />
          </div>

          <Button
            variant="outline"
            onClick={() => void fetchList({ refresh: true, checkUpdates: true })}
            className={cn(
              tabToolbarControlClass,
              'w-full gap-2 sm:w-auto sm:min-w-0 sm:overflow-hidden',
            )}
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{t('memeStore.checkUpdates')}</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setInstallUrlOpen(true)}
            className={cn(
              tabToolbarControlClass,
              'w-full gap-2 sm:w-auto sm:min-w-0 sm:overflow-hidden',
            )}
          >
            <Link2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{t('memeStore.installFromUrl')}</span>
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className={cn('grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', pageGapClass)}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="glass-card">
              <Skeleton className="aspect-square w-full rounded-none rounded-t-[inherit]" />
              <CardHeader className="p-4 pb-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-1.5 h-4 w-1/2" />
              </CardHeader>
              <CardFooter className="p-4 pt-2">
                <Skeleton className="h-9 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : visiblePacks.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="!py-12 text-center text-muted-foreground">
            <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p className="mb-2">
              {searchQuery || selectedSeries !== ALL_SERIES_VALUE
                ? t('memeStore.noMatchedPacks')
                : activeTab === 'installed'
                  ? t('memeStore.noInstalledPacks')
                  : activeTab === 'updates'
                    ? t('memeStore.allPacksUpdated')
                    : t('memeStore.noPacks')}
            </p>
            {(searchQuery || selectedSeries !== ALL_SERIES_VALUE) && (
              <p className="text-sm">{t('memeStore.adjustFilters')}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={cn('grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', pageGapClass)}>
          {visiblePacks.map((pack) => {
            const busy = actionLoading === pack.id;
            return (
              <Card
                key={pack.id}
                className={cn(
                  'glass-card flex flex-col cursor-pointer transition-all hover:ring-2 hover:ring-primary/50',
                  pack.installed && 'ring-1 ring-green-500/30',
                )}
                onClick={() => void handleOpenPreview(pack)}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-t-[inherit] border-b border-border/40 bg-muted/20 p-2">
                  <LazyAuthImage
                    url={memeStoreApi.getCoverUrl(pack.id, pack.commit)}
                    alt={pack.name}
                    placeholderClassName="h-full w-full rounded-lg bg-transparent"
                  />
                  <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1">
                    {pack.series && (
                      <Badge
                        variant="secondary"
                        className="bg-background/85 text-[11px] font-normal backdrop-blur-sm"
                      >
                        {pack.series}
                      </Badge>
                    )}
                    {pack.installed && (
                      <Badge
                        variant="outline"
                        className="bg-background/85 text-[11px] font-normal text-green-600 border-green-500/60 dark:text-green-400 backdrop-blur-sm"
                      >
                        {t('memeStore.installedBadge')}
                      </Badge>
                    )}
                    {pack.hasUpdate && (
                      <Badge
                        variant="outline"
                        className="bg-background/85 text-[11px] font-normal text-amber-600 border-amber-500/60 dark:text-amber-400 backdrop-blur-sm"
                      >
                        {t('memeStore.canUpdate')}
                      </Badge>
                    )}
                  </div>
                  <div className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-md bg-background/85 px-2 py-0.5 text-[11px] text-muted-foreground backdrop-blur-sm tabular-nums">
                    {pack.count} · {formatSizeKb(pack.size_kb)}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-3.5 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-base font-semibold" title={pack.name}>
                      {pack.name}
                    </h3>
                    {pack.has_tags && (
                      <span
                        className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-primary"
                        title={t('memeStore.previewPretagged')}
                      >
                        <Sparkles className="h-3 w-3" />
                      </span>
                    )}
                  </div>

                  {pack.installed ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      {pack.bound_personas.length > 0 ? (
                        <span className="truncate" title={pack.bound_personas.join(', ')}>
                          {pack.bound_personas.slice(0, 3).join(', ')}
                          {pack.bound_personas.length > 3
                            ? ` +${pack.bound_personas.length - 3}`
                            : ''}
                        </span>
                      ) : (
                        <span>{t('memeStore.unmountedHint')}</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {pack.alias.slice(0, 3).map((al) => (
                        <Badge
                          key={al}
                          variant="outline"
                          className="theme-chip px-1.5 py-0 text-[11px] font-normal"
                        >
                          {al}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <CardFooter className="mt-auto gap-1.5 p-3.5 pt-2 sm:p-3.5 sm:pt-2">
                  {pack.installed && pack.local_pack_id ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs text-primary hover:text-primary [&_svg]:!text-current"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!pack.local_pack_id) return;
                          void openMountDialog(
                            pack.id,
                            pack.local_pack_id,
                            pack.local_pack_name || pack.name,
                            pack.bound_personas,
                          );
                        }}
                        disabled={busy}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {t('memeStore.mountPersonas')}
                      </Button>
                      {pack.hasUpdate ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 px-2.5 text-xs text-amber-600 dark:text-amber-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleUpdate(pack);
                          }}
                          disabled={busy}
                          title={t('memeStore.update')}
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 px-2.5 text-xs text-destructive hover:text-destructive [&_svg]:!text-current"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUninstall(pack);
                        }}
                        disabled={busy}
                        title={t('memeStore.uninstall')}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-xs text-primary hover:text-primary [&_svg]:!text-current"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleInstall(pack);
                        }}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {busy ? t('memeStore.installing') : t('memeStore.install')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 px-2.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleOpenPreview(pack);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('memeStore.preview')}
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && !isLoading && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">
            {t('memeStore.pagination.label', { total: storePayload?.count ?? 0 })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t('memeStore.pagination.prev')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('memeStore.pagination.page', { current: page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t('memeStore.pagination.next')}
          </Button>
        </div>
      )}

      {/* 免克隆预览全包弹框 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col gap-3">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <span>{previewPack?.name}</span>
                  {previewPack?.series && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      {previewPack.series}
                    </Badge>
                  )}
                  {previewPack?.has_tags && (
                    <Badge variant="outline" className="gap-1 text-xs font-normal text-primary">
                      <Sparkles className="h-3 w-3" />
                      {t('memeStore.previewPretagged')}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {previewPack
                    ? `${t('memeStore.previewCount', { count: previewPack.count })} · ${formatSizeKb(previewPack.size_kb)} · ${previewPack.branch}`
                    : ''}
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-border p-0.5">
                  <Button
                    size="sm"
                    variant={previewMode === 'grid' ? 'secondary' : 'ghost'}
                    className="h-7 gap-1 px-2.5 text-xs"
                    onClick={() => setPreviewMode('grid')}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {t('memeStore.previewModeGrid')}
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === 'sheet' ? 'secondary' : 'ghost'}
                    className="h-7 gap-1 px-2.5 text-xs"
                    onClick={() => setPreviewMode('sheet')}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('memeStore.previewModeSheet')}
                  </Button>
                </div>

                {previewPack?.installed && previewPack.hasUpdate ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                    disabled={actionLoading === previewPack.id}
                    onClick={() => void handleUpdate(previewPack)}
                  >
                    {actionLoading === previewPack.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {t('memeStore.update')}
                  </Button>
                ) : null}

                {previewPack?.installed && previewPack.local_pack_id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      if (!previewPack.local_pack_id) return;
                      void openMountDialog(
                        previewPack.id,
                        previewPack.local_pack_id,
                        previewPack.local_pack_name || previewPack.name,
                        previewPack.bound_personas,
                      );
                    }}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {t('memeStore.mountPersonas')}
                  </Button>
                ) : previewPack ? (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={actionLoading === previewPack.id}
                    onClick={() => void handleInstall(previewPack)}
                  >
                    {actionLoading === previewPack.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {t('memeStore.install')}
                  </Button>
                ) : null}

                {previewPack?.repo && (
                  <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" asChild>
                    <a
                      href={`${previewPack.repo}/-/tree/${previewPack.branch}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('memeStore.openRepo')}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {previewMode === 'sheet' && previewPack ? (
            <ScrollArea className="flex-1 min-h-0 max-h-[64vh] rounded-lg border border-border/50 bg-muted/20 p-2">
              <LazyAuthImage
                url={memeStoreApi.getSheetUrl(
                  previewPack.id,
                  previewDetail?.commit ?? previewPack.commit,
                )}
                alt={previewPack.name}
                placeholderClassName="w-full min-h-[260px] rounded-md"
                className="mx-auto h-auto max-w-full object-contain"
              />
            </ScrollArea>
          ) : previewLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !previewDetail || previewDetail.items.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t('memeStore.previewEmpty')}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {selectedItem && (
                <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/25 p-3 sm:flex-row sm:items-center">
                  <LazyAuthImage
                    url={memeStoreApi.getItemUrl(
                      previewDetail.id,
                      selectedItem.file,
                      previewDetail.commit,
                    )}
                    alt={selectedItem.title || selectedItem.file}
                    placeholderClassName="h-20 w-20 shrink-0 rounded-lg border border-border/40 bg-background/60 p-1"
                  />
                  <div className="min-w-0 flex-1 space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">
                        {selectedItem.title || selectedItem.file}
                      </span>
                      {selectedItem.emotion_tags.map((emo) => (
                        <Badge key={emo} variant="secondary" className="px-1.5 py-0 text-[11px]">
                          {emo}
                        </Badge>
                      ))}
                    </div>
                    {selectedItem.description && (
                      <p className="text-muted-foreground">{selectedItem.description}</p>
                    )}
                    {selectedItem.usage_hint && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {t('memeStore.previewUsageHint')}：
                        </span>
                        {selectedItem.usage_hint}
                      </p>
                    )}
                    {selectedItem.ocr_text && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {t('memeStore.previewOcrText')}：
                        </span>
                        {selectedItem.ocr_text}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <ScrollArea className="h-[44vh] pr-2">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {previewDetail.items.map((item) => {
                    const active = selectedItem?.file === item.file;
                    return (
                      <button
                        key={item.file}
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border p-1.5 text-left transition-all hover:border-primary/60',
                          active
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                            : 'border-border/50 bg-background/40',
                        )}
                      >
                        <LazyAuthImage
                          url={memeStoreApi.getItemUrl(
                            previewDetail.id,
                            item.file,
                            previewDetail.commit,
                          )}
                          alt={item.title || item.file}
                          placeholderClassName="aspect-square w-full rounded-md bg-transparent"
                        />
                        <span
                          className="w-full truncate text-center text-[11px] text-muted-foreground"
                          title={item.title || item.file}
                        >
                          {item.title || item.file}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 批量挂载到多个人格弹框 */}
      <Dialog open={mountOpen} onOpenChange={setMountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('memeStore.mountDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {mountTarget ? t('memeStore.mountDialogDesc', { name: mountTarget.packName }) : ''}
            </DialogDescription>
          </DialogHeader>

          {personasLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('memeStore.mountLoading')}
            </div>
          ) : personas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('memeStore.mountEmpty')}
            </p>
          ) : (
            <ScrollArea className="max-h-72 pr-2">
              <div className="space-y-1.5">
                {personas.map((persona) => {
                  const locked = Boolean(persona.managed);
                  const checked = selectedPersonas.includes(persona.name);
                  return (
                    <label
                      key={persona.name}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                        locked
                          ? 'cursor-not-allowed border-border/40 bg-muted/30 opacity-60'
                          : 'cursor-pointer border-border/60 hover:border-primary/50',
                        checked && !locked && 'border-primary/60 bg-primary/5',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Checkbox
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={() => {
                            if (!locked) togglePersonaSelection(persona.name);
                          }}
                        />
                        <span className="truncate font-medium">{persona.name}</span>
                      </div>
                      {locked && (
                        <Badge variant="outline" className="shrink-0 text-[11px] font-normal">
                          {t('memeStore.mountGitManaged')}
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMountOpen(false)} disabled={mountSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleSaveMount()}
              disabled={mountSaving || personasLoading || personas.length === 0}
            >
              {mountSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('memeStore.mountSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 从 URL 导入弹框 */}
      <Dialog open={installUrlOpen} onOpenChange={setInstallUrlOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('memeStore.installFromUrlTitle')}</DialogTitle>
            <DialogDescription>{t('memeStore.installFromUrlDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meme-repo-url">{t('memeStore.repoUrl')}</Label>
              <Input
                id="meme-repo-url"
                placeholder="https://cnb.cool/gscore-meme/gscore-meme"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meme-repo-branch">{t('memeStore.repoBranch')}</Label>
              <Input
                id="meme-repo-branch"
                placeholder="pack/genshin-sayu"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meme-pack-name">{t('memeStore.packNameOptional')}</Label>
              <Input
                id="meme-pack-name"
                placeholder={t('memeStore.packNamePlaceholder')}
                value={packNameInput}
                onChange={(e) => setPackNameInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInstallUrlOpen(false)}
              disabled={urlLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleInstallByUrl()} disabled={urlLoading}>
              {urlLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('memeStore.install')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
