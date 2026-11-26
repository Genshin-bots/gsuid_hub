import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TagsInput } from '@/components/config/TagsInput';
import {
  TabButtonGroup,
  tabToolbarControlClass,
  tabToolbarGroupWrapClass,
} from '@/components/ui/TabButtonGroup';
import {
  Image as ImageIcon,
  Search,
  Upload,
  Trash2,
  RefreshCw,
  FolderPlus,
  Clock,
  Users,
  Sparkles,
  Loader2,
  X,
  Pencil,
  Lock,
  Ban,
  Eye,
  TrendingUp,
  Zap,
  AlertCircle,
  CheckCircle2,
  Layers,
  Download,
  FileUp,
  FileDown,
  Eraser,
  RotateCw,
} from 'lucide-react';
import {
  memeApi,
  getAuthToken,
  type MemeRecord,
  type MemeStatsData,
  type MemeListParams,
  type MemePersona,
  type MemePackSummary,
  getApiErrorMessage,
} from '@/lib/api';
import { headerActionRowClass, pageGapClass, PinnedPage } from '@/components/layout/PinnedPage';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ============================================================================
// Types
// ============================================================================

type SortOption = 'created_at_desc' | 'use_count_desc' | 'use_count_asc';

// ============================================================================
// Helper: format file size
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Derive a short, human-readable format label from a MIME type
// (e.g. "image/gif" -> "GIF", "image/jpeg" -> "JPG", "image/svg+xml" -> "SVG").
function formatImageType(mime: string): string {
  const sub = (mime.split('/')[1] || mime).toLowerCase();
  if (sub.includes('jpeg') || sub === 'jpg') return 'JPG';
  if (sub.includes('svg')) return 'SVG';
  return sub.toUpperCase();
}

// Per-format badge colors so the encoding is identifiable at a glance.
const formatTypeColorMap: Record<string, string> = {
  GIF: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  PNG: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  JPG: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  WEBP: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  SVG: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  AVIF: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30',
  BMP: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString();
  } catch {
    return dateStr;
  }
}

/** 把列表项 / 详情接口可能缺字段的记录补成安全渲染形状。 */
function normalizeMemeRecord(
  raw: Partial<MemeRecord> | null | undefined,
  fallback?: MemeRecord | null,
): MemeRecord | null {
  if (!raw || typeof raw !== 'object') return fallback ?? null;
  const base = fallback ?? null;
  const asStringArray = (v: unknown, fb: string[] = []): string[] =>
    Array.isArray(v) ? v.map(String) : fb;
  const memeId = typeof raw.meme_id === 'string' && raw.meme_id ? raw.meme_id : base?.meme_id;
  if (!memeId) return base;
  return {
    meme_id: memeId,
    file_path: typeof raw.file_path === 'string' ? raw.file_path : (base?.file_path ?? ''),
    file_size: typeof raw.file_size === 'number' ? raw.file_size : (base?.file_size ?? 0),
    file_mime: typeof raw.file_mime === 'string' ? raw.file_mime : (base?.file_mime ?? 'image/png'),
    width: typeof raw.width === 'number' ? raw.width : (base?.width ?? 0),
    height: typeof raw.height === 'number' ? raw.height : (base?.height ?? 0),
    source_group:
      typeof raw.source_group === 'string' ? raw.source_group : (base?.source_group ?? ''),
    folder: typeof raw.folder === 'string' ? raw.folder : (base?.folder ?? 'common'),
    persona_hint:
      typeof raw.persona_hint === 'string' ? raw.persona_hint : (base?.persona_hint ?? ''),
    title: typeof raw.title === 'string' ? raw.title : (base?.title ?? ''),
    ocr_text: typeof raw.ocr_text === 'string' ? raw.ocr_text : (base?.ocr_text ?? ''),
    usage_hint: typeof raw.usage_hint === 'string' ? raw.usage_hint : (base?.usage_hint ?? ''),
    emotion_tags: asStringArray(raw.emotion_tags, base?.emotion_tags ?? []),
    scene_tags: asStringArray(raw.scene_tags, base?.scene_tags ?? []),
    description: typeof raw.description === 'string' ? raw.description : (base?.description ?? ''),
    custom_tags: asStringArray(raw.custom_tags, base?.custom_tags ?? []),
    status: (raw.status as MemeRecord['status']) || base?.status || 'tagged',
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : (base?.enabled ?? true),
    pack_ids: asStringArray(raw.pack_ids, base?.pack_ids ?? []),
    nsfw_score: typeof raw.nsfw_score === 'number' ? raw.nsfw_score : (base?.nsfw_score ?? 0),
    use_count: typeof raw.use_count === 'number' ? raw.use_count : (base?.use_count ?? 0),
    last_used_at: (raw.last_used_at as string | null | undefined) ?? base?.last_used_at ?? null,
    last_used_group:
      typeof raw.last_used_group === 'string' ? raw.last_used_group : (base?.last_used_group ?? ''),
    created_at: typeof raw.created_at === 'string' ? raw.created_at : (base?.created_at ?? ''),
    tagged_at: (raw.tagged_at as string | null | undefined) ?? base?.tagged_at ?? null,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : (base?.updated_at ?? ''),
  };
}

function formatSourceLabel(
  sourceGroup: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const src = (sourceGroup || '').trim().toLowerCase();
  if (src === 'manual') return t('aiMeme.card.sourceManual');
  if (src === 'import') return t('aiMeme.card.sourceImport');
  if (src) return t('aiMeme.card.sourceCollected');
  return t('aiMeme.card.sourceUnknown');
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  icon,
  iconBgClass,
  iconClass,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBgClass: string;
  iconClass: string;
  label: string;
  value: number | string;
}) {
  return (
    <Card className={cn('transition-all duration-300 hover:shadow-md', 'glass-card')}>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            iconBgClass,
          )}
        >
          <div className={cn('w-5 h-5', iconClass)}>{icon}</div>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const MemeCard = memo(function MemeCard({
  meme,
  onClick,
  selected,
  onToggleSelect,
}: {
  meme: MemeRecord;
  onClick: (meme: MemeRecord) => void;
  selected?: boolean;
  onToggleSelect?: (memeId: string) => void;
}) {
  const { t } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Formats that may animate (gif / animated webp / apng). Their full-res <img>
  // is only mounted on hover so the grid plays at most one animation at a time.
  const maybeAnimated = /gif|webp|apng/i.test(meme.file_mime);

  // IntersectionObserver as a one-way latch: load the image once the card nears
  // the viewport and then keep it mounted. Never unmounting avoids the re-decode
  // "white flash" and DOM churn that happen when scrolling cards in and out.
  useEffect(() => {
    if (!cardRef.current || hasEntered) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px', threshold: 0 },
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [hasEntered]);

  useEffect(() => {
    if (!hasEntered || blob) return;
    let revoked = false;
    const controller = new AbortController();
    const fetchImage = async () => {
      try {
        const token = getAuthToken();
        const base = memeApi.getImageUrl(meme.meme_id);
        const resp = await fetch(base, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          signal: controller.signal,
        });
        if (!resp.ok || revoked) return;
        const b = await resp.blob();
        if (revoked) return;
        setBlob(b);
        setBlobUrl(URL.createObjectURL(b));
      } catch {
        if (!revoked) setImgError(true);
      }
    };
    fetchImage();
    return () => {
      revoked = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meme.meme_id, hasEntered]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Build a small downscaled thumbnail once and paint it onto the canvas. Cards
  // render tiny, so a ~400px thumbnail is plenty and is far cheaper to paint and
  // composite while scrolling than 24 full-resolution images. createImageBitmap
  // decodes off the main thread (no scroll/load jank); we fall back to <img> +
  // canvas where it (or its resize options) isn't available.
  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    let bmp: ImageBitmap | null = null;
    const MAX_DIM = 400;

    const paint = (src: CanvasImageSource, sw: number, sh: number) => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const scale = Math.min(1, MAX_DIM / Math.max(sw, sh, 1));
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(src, 0, 0, w, h);
      setSnapshotReady(true);
    };

    const run = async () => {
      if (typeof createImageBitmap === 'function') {
        try {
          bmp = await createImageBitmap(blob);
          if (cancelled) {
            bmp.close?.();
            return;
          }
          paint(bmp, bmp.width, bmp.height);
          bmp.close?.();
          return;
        } catch {
          // fall through to <img> decode
        }
      }
      const image = new Image();
      const tmpUrl = URL.createObjectURL(blob);
      image.onload = () => {
        if (!cancelled) paint(image, image.naturalWidth, image.naturalHeight);
        URL.revokeObjectURL(tmpUrl);
      };
      image.onerror = () => {
        if (!cancelled) setImgError(true);
        URL.revokeObjectURL(tmpUrl);
      };
      image.src = tmpUrl;
    };
    run();

    return () => {
      cancelled = true;
      if (bmp) bmp.close?.();
    };
  }, [blob]);

  // The grid shows the lightweight canvas thumbnail; the full-res animated <img>
  // (which actually plays the GIF) is mounted only while this card is hovered.
  const showLiveImg = maybeAnimated && isHovered;

  const statusColorMap: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    tagged: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20',
    manual: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    pending_manual: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
    rejected: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
  };

  const cardTitle = meme.title || meme.description || t('aiMeme.card.untitled');
  const cardSummary = meme.title
    ? meme.description || meme.ocr_text || t('aiMeme.card.noDescription')
    : meme.ocr_text || meme.usage_hint || (meme.description ? '' : t('aiMeme.card.noDescription'));
  const statusLabel = t(`aiMeme.status.${meme.status}`);
  const sourceLabel = formatSourceLabel(meme.source_group, t);

  return (
    <Card
      ref={cardRef}
      className={cn(
        'group cursor-pointer transition-[transform,box-shadow] duration-300 hover:shadow-lg hover:scale-[1.02]',
        'glass-card-flat',
        selected && 'ring-2 ring-primary shadow-lg',
        !meme.enabled && 'opacity-85',
      )}
      onClick={() => onClick(meme)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image - lazy render via IntersectionObserver for GIF performance */}
      <div className="relative aspect-square bg-muted/30 overflow-hidden rounded-t-[inherit]">
        {!hasEntered ? (
          <div className="absolute inset-0 bg-muted/30 flex items-center justify-center">
            <Skeleton className="w-full h-full absolute" />
            <ImageIcon className="w-8 h-8 text-muted-foreground/30 relative z-10" />
          </div>
        ) : imgError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground/50">加载失败</span>
          </div>
        ) : (
          <>
            {!snapshotReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Skeleton className="w-full h-full absolute" />
                <ImageIcon className="w-8 h-8 text-muted-foreground/30 relative z-10" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              aria-hidden
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-[transform,opacity] duration-300 group-hover:scale-105',
                snapshotReady ? (meme.enabled ? 'opacity-100' : 'opacity-60') : 'opacity-0',
              )}
            />
            {showLiveImg && (
              <img
                src={blobUrl || undefined}
                alt={cardTitle}
                className={cn(
                  'absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105',
                  !meme.enabled && 'opacity-65',
                )}
                onError={() => setImgError(true)}
                decoding="async"
              />
            )}
          </>
        )}
        {/* Top-left: format badge or non-ready status pill */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {meme.status !== 'tagged' && meme.status !== 'manual' ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0.5 backdrop-blur-sm',
                statusColorMap[meme.status] || 'bg-muted/80',
              )}
            >
              {statusLabel}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 h-5 font-mono font-medium backdrop-blur-sm',
                formatTypeColorMap[formatImageType(meme.file_mime)] ||
                  'bg-muted/80 text-muted-foreground border-border',
              )}
            >
              {formatImageType(meme.file_mime)}
            </Badge>
          )}
        </div>
        {/* Top-right: enable capsule + selection checkbox */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0 h-5 border backdrop-blur-sm',
              meme.enabled
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/35'
                : 'bg-zinc-600/70 text-zinc-100 border-zinc-400/35',
            )}
          >
            {meme.enabled ? t('aiMeme.card.enabled') : t('aiMeme.card.disabled')}
          </Badge>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.(meme.meme_id);
            }}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 cursor-pointer',
                selected
                  ? 'bg-primary border-primary shadow-sm'
                  : 'bg-white/80 dark:bg-black/60 border-white/50 dark:border-white/25 opacity-0 group-hover:opacity-100 hover:border-primary/60',
              )}
            >
              {selected && (
                <svg
                  className="w-3 h-3 text-primary-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        </div>
        {/* Use count overlay */}
        {meme.use_count > 0 && (
          <div className="absolute bottom-2 right-2">
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0.5 bg-black/60 text-white border-0"
            >
              <Zap className="w-3 h-3 mr-0.5" />
              {meme.use_count}
            </Badge>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center pointer-events-none">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center">
              <Eye className="w-5 h-5 text-foreground" />
            </div>
          </div>
        </div>
      </div>
      {/* Clean semantic info area */}
      <CardContent className="flex flex-col gap-1.5 p-3 sm:p-3">
        <p
          className="min-w-0 truncate text-xs font-semibold leading-4 text-foreground"
          title={cardTitle}
        >
          {cardTitle}
        </p>
        <p className="min-w-0 line-clamp-2 min-h-[2rem] text-[11px] leading-4 text-muted-foreground">
          {cardSummary}
        </p>
        <div className="flex items-center justify-between gap-2 pt-0.5 min-w-0">
          <span className="truncate text-[10px] text-muted-foreground/75">
            {sourceLabel} · {statusLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClick(meme);
            }}
            className="h-6 shrink-0 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-3 h-3" />
            {t('aiMeme.card.edit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Right-side Edit Sheet
// ============================================================================

function MemeEditSheet({
  meme,
  packs,
  open,
  onClose,
  onUpdate,
  onDelete,
}: {
  meme: MemeRecord | null;
  packs: MemePackSummary[];
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOcrText, setEditOcrText] = useState('');
  const [editCustomTags, setEditCustomTags] = useState<string[]>([]);
  const [editEmotionTags, setEditEmotionTags] = useState<string[]>([]);
  const [editUsageHint, setEditUsageHint] = useState('');
  const [editPackIds, setEditPackIds] = useState<string[]>([]);
  const [editEnabled, setEditEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetagging, setIsRetagging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRetagDialog, setShowRetagDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [detailBlobUrl, setDetailBlobUrl] = useState<string | null>(null);
  const [detailImgError, setDetailImgError] = useState(false);

  const memeId = meme?.meme_id ?? null;
  const loadedIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);

  const markDirty = () => {
    isDirtyRef.current = true;
  };

  useEffect(() => {
    if (!open || !meme) {
      setShowRetagDialog(false);
      setShowDeleteDialog(false);
      loadedIdRef.current = null;
      isDirtyRef.current = false;
      return;
    }
    const switchedMeme = loadedIdRef.current !== meme.meme_id;
    if (switchedMeme || !isDirtyRef.current) {
      loadedIdRef.current = meme.meme_id;
      isDirtyRef.current = false;
      setEditTitle(meme.title || '');
      setEditDescription(meme.description || '');
      setEditOcrText(meme.ocr_text || '');
      setEditCustomTags(Array.isArray(meme.custom_tags) ? [...meme.custom_tags] : []);
      setEditEmotionTags(Array.isArray(meme.emotion_tags) ? [...meme.emotion_tags] : []);
      setEditUsageHint(meme.usage_hint || '');
      setEditPackIds(Array.isArray(meme.pack_ids) ? [...meme.pack_ids] : []);
      setEditEnabled(meme.enabled !== false);
    }
    if (switchedMeme) {
      setShowRetagDialog(false);
      setShowDeleteDialog(false);
    }
  }, [meme, open]);

  useEffect(() => {
    if (!memeId || !open) {
      setDetailBlobUrl(null);
      setDetailImgError(false);
      return;
    }
    let revoked = false;
    const controller = new AbortController();
    setDetailBlobUrl(null);
    setDetailImgError(false);
    const fetchImage = async () => {
      try {
        const token = getAuthToken();
        const base = memeApi.getImageUrl(memeId);
        const resp = await fetch(base, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          signal: controller.signal,
        });
        if (!resp.ok) {
          if (!revoked) setDetailImgError(true);
          return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        if (!revoked) setDetailBlobUrl(url);
        else URL.revokeObjectURL(url);
      } catch {
        if (!revoked && !controller.signal.aborted) setDetailImgError(true);
      }
    };
    fetchImage();
    return () => {
      revoked = true;
      controller.abort();
    };
  }, [memeId, open]);

  useEffect(() => {
    return () => {
      if (detailBlobUrl) URL.revokeObjectURL(detailBlobUrl);
    };
  }, [detailBlobUrl]);

  const togglePack = (pack: MemePackSummary) => {
    if (pack.is_repo_pack) return;
    markDirty();
    setEditPackIds((prev) =>
      prev.includes(pack.pack_id)
        ? prev.filter((id) => id !== pack.pack_id)
        : [...prev, pack.pack_id],
    );
  };

  const handleSave = async () => {
    if (!meme) return;
    try {
      setIsSaving(true);
      const trimmedTitle = editTitle.trim();
      const trimmedDesc = editDescription.trim();
      const trimmedOcr = editOcrText.trim();
      const trimmedUsage = editUsageHint.trim();
      const hasSemanticInfo = Boolean(
        trimmedTitle || trimmedDesc || trimmedUsage || editEmotionTags.length > 0,
      );
      const promoteManual =
        (meme.status === 'pending_manual' || meme.status === 'pending') && hasSemanticInfo;

      await memeApi.update(meme.meme_id, {
        title: trimmedTitle,
        description: trimmedDesc,
        ocr_text: trimmedOcr,
        custom_tags: editCustomTags,
        emotion_tags: editEmotionTags,
        usage_hint: trimmedUsage,
        pack_ids: editPackIds,
        enabled: editEnabled,
        ...(promoteManual ? { status: 'manual' as const } : {}),
      });
      isDirtyRef.current = false;
      toast.success(t('aiMeme.detail.updateSuccess'));
      onUpdate();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.detail.updateFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetag = async () => {
    if (!meme) return;
    try {
      setIsRetagging(true);
      await memeApi.retag(meme.meme_id);
      isDirtyRef.current = false;
      toast.success(t('aiMeme.detail.retagSuccess'));
      setShowRetagDialog(false);
      onUpdate();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.detail.retagFailed')));
    } finally {
      setIsRetagging(false);
    }
  };

  const handleDelete = async () => {
    if (!meme) return;
    try {
      setIsDeleting(true);
      await memeApi.delete(meme.meme_id);
      toast.success(t('aiMeme.detail.deleteSuccess'));
      setShowDeleteDialog(false);
      onDelete();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.detail.deleteFailed')));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Sheet open={open && Boolean(meme)} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="glass-card flex h-full w-full flex-col gap-0 p-0 sm:max-w-lg"
        >
          {meme && (
            <>
              <SheetHeader className="shrink-0 space-y-1 px-6 pb-4 pr-12 pt-5">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="w-4 h-4 shrink-0 text-primary" />
                  <span className="truncate">{meme.title || t('aiMeme.detail.title')}</span>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {meme.width}×{meme.height} · {formatFileSize(meme.file_size)} ·{' '}
                  {formatImageType(meme.file_mime)} · {t(`aiMeme.status.${meme.status}`)}
                </SheetDescription>
              </SheetHeader>

              {/* Compact image preview */}
              <div className="shrink-0 flex h-40 items-center justify-center border-y border-border/30 bg-muted/30 px-6 py-3">
                {detailBlobUrl ? (
                  <img
                    src={detailBlobUrl}
                    alt={meme.title || meme.description || meme.meme_id}
                    className="max-h-full max-w-full rounded-lg object-contain"
                    onError={() => setDetailImgError(true)}
                  />
                ) : detailImgError ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground/60">
                    <AlertCircle className="w-7 h-7" />
                    <span className="text-xs">{t('aiMeme.loadFailed')}</span>
                  </div>
                ) : (
                  <Skeleton className="h-32 w-32 rounded-lg" />
                )}
              </div>

              <ScrollArea className="min-h-0 flex-1 px-6">
                <div className="space-y-4 py-4">
                  {/* 1. 名称 */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="meme-edit-title"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t('aiMeme.detail.name')}
                    </Label>
                    <Input
                      id="meme-edit-title"
                      value={editTitle}
                      onChange={(e) => {
                        markDirty();
                        setEditTitle(e.target.value);
                      }}
                      maxLength={64}
                      placeholder={t('aiMeme.detail.namePlaceholder')}
                      className="text-sm"
                    />
                  </div>

                  {/* 2. 画面与动作 */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="meme-edit-desc"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t('aiMeme.detail.description')}
                    </Label>
                    <Textarea
                      id="meme-edit-desc"
                      value={editDescription}
                      onChange={(e) => {
                        markDirty();
                        setEditDescription(e.target.value);
                      }}
                      maxLength={500}
                      placeholder={t('aiMeme.detail.descriptionPlaceholder')}
                      className="min-h-[84px] text-sm resize-y"
                    />
                  </div>

                  {/* 3. 可见文字 */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="meme-edit-ocr"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t('aiMeme.detail.ocrText')}
                    </Label>
                    <Input
                      id="meme-edit-ocr"
                      value={editOcrText}
                      onChange={(e) => {
                        markDirty();
                        setEditOcrText(e.target.value);
                      }}
                      maxLength={256}
                      placeholder={t('aiMeme.detail.ocrTextPlaceholder')}
                      className="text-sm"
                    />
                  </div>

                  {/* 4. 标签 (custom_tags) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t('aiMeme.detail.customTags')}
                    </Label>
                    <TagsInput
                      value={editCustomTags}
                      onChange={(next) => {
                        markDirty();
                        setEditCustomTags(next);
                      }}
                    />
                  </div>

                  {/* 5. 情绪 (emotion_tags) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t('aiMeme.detail.emotionTags')}
                    </Label>
                    <TagsInput
                      value={editEmotionTags}
                      onChange={(next) => {
                        markDirty();
                        setEditEmotionTags(next);
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground/80">
                      {t('aiMeme.detail.emotionTagsHint')}
                    </p>
                  </div>

                  {/* 6. 适用回应 (usage_hint) */}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="meme-edit-usage"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {t('aiMeme.detail.usageHint')}
                    </Label>
                    <Textarea
                      id="meme-edit-usage"
                      value={editUsageHint}
                      onChange={(e) => {
                        markDirty();
                        setEditUsageHint(e.target.value);
                      }}
                      maxLength={512}
                      placeholder={t('aiMeme.detail.usageHintPlaceholder')}
                      className="min-h-[68px] text-sm resize-y"
                    />
                  </div>

                  {/* 7. 所属表情包 */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {t('aiMeme.detail.packs')}
                    </Label>
                    {packs.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70">
                        {t('aiMeme.detail.packsEmpty')}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {packs.map((pack) => {
                          const checked = editPackIds.includes(pack.pack_id);
                          const locked = Boolean(pack.is_repo_pack);
                          return (
                            <label
                              key={pack.pack_id}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors select-none',
                                checked
                                  ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                                  : 'border-border/60 bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                                locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={locked}
                                onCheckedChange={() => togglePack(pack)}
                                className="h-3.5 w-3.5"
                              />
                              <span className="max-w-[140px] truncate">{pack.name}</span>
                              {locked && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <Lock className="w-2.5 h-2.5" />
                                  {t('aiMeme.detail.repoPackReadOnly')}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 8. 允许检索使用 */}
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/35 p-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <Label
                        htmlFor="meme-edit-enabled"
                        className="text-sm font-medium cursor-pointer"
                      >
                        {t('aiMeme.detail.enabled')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('aiMeme.detail.enabledDesc')}
                      </p>
                    </div>
                    <Switch
                      id="meme-edit-enabled"
                      checked={editEnabled}
                      onCheckedChange={(checked) => {
                        markDirty();
                        setEditEnabled(checked);
                      }}
                      className="shrink-0"
                    />
                  </div>

                  <Separator className="bg-border/30" />

                  {/* Compact Usage & Timestamps */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 shrink-0" />
                      <span>{t('aiMeme.detail.useCount')}:</span>
                      <span className="font-semibold text-foreground">{meme.use_count}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 truncate">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {meme.last_used_at
                          ? formatDateTime(meme.last_used_at)
                          : t('aiMeme.detail.never')}
                      </span>
                    </div>
                    <div>{t('aiMeme.detail.createdAt')}</div>
                    <div className="text-right">{formatDateTime(meme.created_at)}</div>
                    {meme.tagged_at && (
                      <>
                        <div>{t('aiMeme.detail.taggedAt')}</div>
                        <div className="text-right">{formatDateTime(meme.tagged_at)}</div>
                      </>
                    )}
                    <div>{t('aiMeme.detail.updatedAt')}</div>
                    <div className="text-right">{formatDateTime(meme.updated_at)}</div>
                  </div>
                </div>
              </ScrollArea>

              <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/40 px-6 py-4">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || isRetagging || isDeleting}
                  className="gap-1.5"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {t('common.save')}
                </Button>
                <Button
                  variant="outline"
                  disabled={isSaving || isRetagging || isDeleting}
                  onClick={() => setShowRetagDialog(true)}
                  className="gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('aiMeme.detail.retag')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={isSaving || isRetagging || isDeleting}
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-1.5 sm:ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('common.delete')}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Retag Confirm Dialog */}
      <AlertDialog
        open={showRetagDialog}
        onOpenChange={(next) => !isRetagging && setShowRetagDialog(next)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.detail.retagConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiMeme.detail.retagConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRetagging}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleRetag();
              }}
              disabled={isRetagging}
            >
              {isRetagging && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(next) => !isDeleting && setShowDeleteDialog(next)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.detail.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiMeme.detail.deleteConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// Upload Dialog (unified: supports images + .meme batch)
// ============================================================================

const CREATE_NEW_PACK = '__create_new__';

function UploadDialog({
  open,
  onClose,
  onSuccess,
  personas,
  onPackCreated,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  personas: MemePersona[];
  onPackCreated?: (pack: MemePersona) => void;
}) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  // Target pack for this upload: 'common', an existing pack_id, or CREATE_NEW_PACK.
  const [personaHint, setPersonaHint] = useState('common');
  const [newPackName, setNewPackName] = useState('');
  const [isCreatingPack, setIsCreatingPack] = useState(false);
  const [autoTag, setAutoTag] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newPackInputRef = useRef<HTMLInputElement>(null);

  const isCreatingNew = personaHint === CREATE_NEW_PACK;

  useEffect(() => {
    if (isCreatingNew) {
      // Wait one tick so the Select portal closes before focusing the input.
      const timer = setTimeout(() => newPackInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [isCreatingNew]);

  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  const isImage = (f: File) =>
    ACCEPTED_TYPES.includes(f.type) || /\.(jpe?g|png|gif|webp)$/i.test(f.name);
  const isMeme = (f: File) => f.name.endsWith('.meme');

  const imageFiles = files.filter(isImage);
  const memeFiles = files.filter(isMeme);

  const handleFilesSelect = (selectedFiles: FileList | File[]) => {
    const arr = Array.from(selectedFiles);
    const valid = arr.filter((f) => isImage(f) || isMeme(f));
    if (valid.length === 0) {
      toast.error(t('aiMeme.upload.dragDropHint'));
      return;
    }
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const handleCreatePackNow = async () => {
    const trimmed = newPackName.trim();
    if (!trimmed) {
      toast.error(t('aiMeme.upload.newPackNameRequired'));
      newPackInputRef.current?.focus();
      return;
    }
    try {
      setIsCreatingPack(true);
      const created = await memeApi.createPack(trimmed);
      onPackCreated?.({
        persona_hint: created.pack_id,
        count: 0,
        folder: created.name,
      });
      setPersonaHint(created.pack_id);
      setNewPackName('');
      toast.success(t('aiMeme.upload.createPackSuccess', { name: created.name }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.upload.createPackFailed')));
    } finally {
      setIsCreatingPack(false);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    let packId: string | undefined;
    if (isCreatingNew) {
      const trimmed = newPackName.trim();
      if (!trimmed) {
        toast.error(t('aiMeme.upload.newPackNameRequired'));
        newPackInputRef.current?.focus();
        return;
      }
      setIsUploading(true);
      try {
        const created = await memeApi.createPack(trimmed);
        packId = created.pack_id;
        onPackCreated?.({
          persona_hint: created.pack_id,
          count: 0,
          folder: created.name,
        });
      } catch (error) {
        setIsUploading(false);
        toast.error(getApiErrorMessage(error, t('aiMeme.upload.createPackFailed')));
        return;
      }
    } else {
      setIsUploading(true);
      const persona = personaHint.trim();
      packId = persona && persona !== 'common' ? persona : undefined;
    }

    let success = 0;
    let failed = 0;

    for (const f of imageFiles) {
      try {
        await memeApi.upload(f, 'common', autoTag, packId);
        success++;
      } catch {
        failed++;
      }
    }

    for (const f of memeFiles) {
      try {
        await memeApi.importMemes(f, skipExisting, autoTag, undefined, packId);
        success++;
      } catch {
        failed++;
      }
    }

    setIsUploading(false);

    if (failed === 0) {
      toast.success(t('aiMeme.upload.batchUploadAllSuccess', { count: success }));
    } else {
      toast.warning(t('aiMeme.upload.batchUploadSuccess', { success, failed }));
    }
    handleClose();
    onSuccess();
  };

  const handleClose = () => {
    setFiles([]);
    setPersonaHint('common');
    setNewPackName('');
    setAutoTag(true);
    setSkipExisting(true);
    onClose();
  };

  const fileCount = files.length;
  const hasFiles = fileCount > 0;
  const hasMeme = memeFiles.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="glass-card flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 shrink-0 text-primary" />
            <span className="truncate">{t('aiMeme.upload.title')}</span>
          </DialogTitle>
          <DialogDescription>{t('aiMeme.upload.dragDropHint')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto pr-1 space-y-3 md:space-y-4 py-2">
          {/* Drop Zone */}
          <div
            className={cn(
              'relative min-w-0 border-2 border-dashed rounded-xl text-center transition-colors duration-300 cursor-pointer',
              isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border/50 hover:border-primary/50 hover:bg-muted/30',
              hasFiles ? 'p-4' : 'p-8',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,.meme"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelect(e.target.files);
                e.target.value = '';
              }}
            />
            {hasFiles ? (
              <div className="space-y-2 min-w-0">
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1.5 min-w-0">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 text-left min-w-0"
                    >
                      {isImage(f) ? (
                        <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FileUp className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs truncate flex-1 min-w-0" title={f.name}>
                        {f.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 tabular-nums">
                        {formatFileSize(f.size)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {imageFiles.length > 0 && (
                  <p className="text-[10px] text-muted-foreground pt-1.5 border-t border-border/30">
                    {t('aiMeme.upload.dragDropHint')}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('aiMeme.upload.dragDrop')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('aiMeme.upload.dragDropHint')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {(imageFiles.length > 0 || hasMeme) && (
            <div className="space-y-2 min-w-0">
              <Label className="text-sm flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{t('aiMeme.upload.targetPersona')}</span>
              </Label>
              <div className="flex items-center gap-2 min-w-0">
                <Select value={personaHint} onValueChange={setPersonaHint}>
                  <SelectTrigger className="flex-1 min-w-0 h-9 text-sm [&>span]:min-w-0 [&>span]:truncate">
                    <SelectValue placeholder={t('aiMeme.upload.targetPersona')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">{t('aiMeme.filter.commonPersona')}</SelectItem>
                    {personas
                      .filter((p) => p.persona_hint !== 'common')
                      .map((p) => (
                        <SelectItem key={p.persona_hint} value={p.persona_hint}>
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="truncate max-w-[200px]">
                              {p.folder || p.persona_hint}
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                              {p.count}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    <SelectSeparator />
                    <SelectItem value={CREATE_NEW_PACK}>
                      <span className="flex items-center gap-1.5 text-primary font-medium">
                        <FolderPlus className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('aiMeme.upload.createNewPack')}</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={isCreatingNew ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 px-3"
                  disabled={isUploading}
                  onClick={() => setPersonaHint(isCreatingNew ? 'common' : CREATE_NEW_PACK)}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{t('aiMeme.upload.createNewPackBtn')}</span>
                </Button>
              </div>
              {isCreatingNew && (
                <div className="flex items-center gap-2 min-w-0 pt-0.5">
                  <Input
                    ref={newPackInputRef}
                    value={newPackName}
                    onChange={(e) => setNewPackName(e.target.value)}
                    maxLength={64}
                    disabled={isUploading || isCreatingPack}
                    placeholder={t('aiMeme.upload.newPackPlaceholder')}
                    className="h-9 flex-1 min-w-0 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleCreatePackNow();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 px-3"
                    disabled={!newPackName.trim() || isCreatingPack || isUploading}
                    onClick={() => void handleCreatePackNow()}
                  >
                    {isCreatingPack ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      t('aiMeme.upload.createPackNow')
                    )}
                  </Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                {isCreatingNew
                  ? t('aiMeme.upload.newPackHint')
                  : t('aiMeme.upload.targetPersonaDesc')}
              </p>
            </div>
          )}

          {/* Skip Existing Toggle (only for .meme) */}
          {hasMeme && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 min-w-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t('aiMeme.upload.skipExisting')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('aiMeme.upload.skipExistingDesc')}
                </p>
              </div>
              <Switch
                checked={skipExisting}
                onCheckedChange={setSkipExisting}
                className="shrink-0"
              />
            </div>
          )}

          {/* Auto Tag Toggle */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 min-w-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t('aiMeme.upload.autoTag')}</p>
                <p className="text-xs text-muted-foreground">{t('aiMeme.upload.autoTagDesc')}</p>
              </div>
            </div>
            <Switch checked={autoTag} onCheckedChange={setAutoTag} className="shrink-0" />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              !hasFiles || isUploading || isCreatingPack || (isCreatingNew && !newPackName.trim())
            }
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                {t('aiMeme.upload.uploading')}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1.5" />
                {t('aiMeme.upload.uploadNow')} ({fileCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIMemePage() {
  const { t } = useLanguage();

  // State
  const [memes, setMemes] = useState<MemeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<MemeStatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Pack / Persona filter
  const [packs, setPacks] = useState<MemePackSummary[]>([]);
  const [personas, setPersonas] = useState<MemePersona[]>([]);
  // Radix Select disallows empty-string values on <SelectItem>, so we use a
  // sentinel value and translate it back to '' (== "no persona filter") when
  // building the request.
  const PERSONA_ALL = '__all__';
  const [filterPersona, setFilterPersona] = useState<string>(PERSONA_ALL);

  // Filters
  const [filterFolder, _setFilterFolder] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('tagged');
  const [sortBy, setSortBy] = useState<SortOption>('created_at_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialogs & Edit Sheet
  const [selectedMeme, setSelectedMeme] = useState<MemeRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Selection & Batch actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [isBatchRetaggingSelected, setIsBatchRetaggingSelected] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  const [showRetagSelectedDialog, setShowRetagSelectedDialog] = useState(false);
  const [batchPackSelectKey, setBatchPackSelectKey] = useState(0);

  // Purge / Retag
  const [isPurging, setIsPurging] = useState(false);
  const [isRetaggingPending, setIsRetaggingPending] = useState(false);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [showRetagPendingDialog, setShowRetagPendingDialog] = useState(false);
  // 按条件清空（全部 / 当前筛选）
  const [showPurgeAllDialog, setShowPurgeAllDialog] = useState(false);
  const [purgeScope, setPurgeScope] = useState<'filtered' | 'all'>('filtered');
  const [isPurgingAll, setIsPurgingAll] = useState(false);
  // === .meme 导入对话框状态 ===
  const [showImportDotMemeDialog, setShowImportDotMemeDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportPackId, setExportPackId] = useState('');
  const [importDotMemeFile, setImportDotMemeFile] = useState<File | null>(null);
  const [importDotMemePersonaHint, setImportDotMemePersonaHint] = useState<string>('');
  const [importDotMemeSkip, setImportDotMemeSkip] = useState(true);
  const [importDotMemeAutoTag, setImportDotMemeAutoTag] = useState(false);
  const [importingDotMeme, setImportingDotMeme] = useState(false);

  // Search debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchMemes = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: MemeListParams = {
        page,
        page_size: pageSize,
        sort: sortBy,
      };
      if (filterFolder) params.folder = filterFolder;
      if (filterStatus) params.status = filterStatus;
      if (searchQuery) params.q = searchQuery;
      const selectedPack = filterPersona !== PERSONA_ALL ? filterPersona : '';
      const data = selectedPack
        ? await memeApi.listPackMembers(selectedPack, params)
        : await memeApi.getList(params);
      const records = Array.isArray(data?.records) ? data.records : [];
      setMemes(
        records.map((r) => normalizeMemeRecord(r)).filter((r): r is MemeRecord => r != null),
      );
      setTotal(typeof data?.total === 'number' ? data.total : records.length);
    } catch (error) {
      console.error('Failed to fetch memes:', error);
      toast.error(t('aiMeme.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortBy, filterFolder, filterStatus, searchQuery, filterPersona, t]);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoadingStats(true);
      const data = await memeApi.getStats();
      setStats(data);
    } catch (error) {
      // ⚠️ 注意：当前错误通常是 gsuid_core 后端版本不匹配导致的。
      // 旧版 backend 没有注册独立的 `/api/meme/stats` 端点，请求会被
      // `/api/meme/{meme_id}` 兜底匹配，又因 `stats` 是预保留的 meme_id
      // 而抛出 "预保留路径名" 错误。前端 URL（`/api/meme/stats`）本身
      // 是正确的，升级 gsuid_core 即可恢复正常。这里使用 warn 而非 error，
      // 因为这并非前端 bug，不应作为红色错误频繁刷出。
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('预保留路径名')) {
        console.warn(
          '[AIMemePage] /api/meme/stats 不可用：当前 gsuid_core 版本过旧，' +
            '缺少独立的统计端点。统计概览区域将保持为空，请升级 gsuid_core。',
          msg,
        );
      } else {
        console.warn('Failed to fetch meme stats:', msg);
      }
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  const fetchPersonas = useCallback(async () => {
    try {
      const data = await memeApi.getPacks();
      const list = Array.isArray(data) ? data : [];
      setPacks(list);
      setPersonas(
        list.map((pack) => ({
          persona_hint: pack.pack_id,
          count: pack.member_count,
          folder: pack.name,
        })),
      );
    } catch (error) {
      console.error('Failed to fetch meme packs:', error);
    }
  }, []);

  useEffect(() => {
    fetchMemes();
  }, [fetchMemes]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // If the currently selected persona disappears (deleted/moved), reset filter.
  useEffect(() => {
    if (
      filterPersona &&
      filterPersona !== PERSONA_ALL &&
      !personas.some((p) => p.persona_hint === filterPersona)
    ) {
      setFilterPersona(PERSONA_ALL);
    }
  }, [personas, filterPersona]);

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
      setPage(1);
    }, 500);
  };

  // Reset page & selection when filters change; clear debounce timer on unmount
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [filterFolder, filterStatus, filterPersona, sortBy]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const openExportDialog = () => {
    setExportPackId(filterPersona);
    setShowExportDialog(true);
  };

  const handleExportDotMeme = async () => {
    if (!exportPackId) {
      toast.warning(t('aiMeme.exportDotMemePackRequired'));
      return;
    }
    const exportAll = exportPackId === PERSONA_ALL;
    const pack = exportAll
      ? undefined
      : personas.find((item) => item.persona_hint === exportPackId);
    try {
      setIsExporting(true);
      const blob = exportAll
        ? await memeApi.exportMemes()
        : await memeApi.exportMemes(undefined, undefined, exportPackId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const rawName = exportAll ? t('aiMeme.filter.allPersonas') : pack?.folder || 'memes';
      const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_');
      a.download = `${safeName}.meme`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportDialog(false);
      toast.success(t('aiMeme.exportDotMemeSuccess'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('aiMeme.exportDotMemeFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportDotMeme = async () => {
    if (!importDotMemeFile) {
      toast.warning(t('aiMeme.importDotMemeFileRequired'));
      return;
    }
    try {
      setImportingDotMeme(true);
      const result = await memeApi.importMemes(
        importDotMemeFile,
        importDotMemeSkip,
        importDotMemeAutoTag,
        importDotMemePersonaHint || undefined,
      );
      toast.success(
        t('aiMeme.importDotMemeSuccess', {
          imported: result.imported_count,
          skipped: result.skipped_count,
        }),
      );
      setShowImportDotMemeDialog(false);
      setImportDotMemeFile(null);
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('aiMeme.importDotMemeFailed'));
    } finally {
      setImportingDotMeme(false);
    }
  };

  // ============================================================================
  // Handlers
  // ============================================================================

  const detailSeqRef = useRef(0);
  const detailOpenRef = useRef(false);

  const handleMemeClick = useCallback(async (meme: MemeRecord) => {
    const seq = ++detailSeqRef.current;
    detailOpenRef.current = true;
    const safeListItem = normalizeMemeRecord(meme);
    if (safeListItem) {
      setSelectedMeme(safeListItem);
      setDetailOpen(true);
    }
    try {
      const detail = await memeApi.getDetail(meme.meme_id);
      if (seq !== detailSeqRef.current || !detailOpenRef.current) return;
      const safe = normalizeMemeRecord(detail, safeListItem);
      if (safe) setSelectedMeme(safe);
    } catch {
      // 列表项已展示，详情失败时保持列表数据即可
    }
  }, []);

  const handleDetailUpdate = () => {
    fetchMemes();
    fetchStats();
    fetchPersonas();
    if (selectedMeme) {
      const seq = ++detailSeqRef.current;
      const current = selectedMeme;
      memeApi
        .getDetail(current.meme_id)
        .then((detail) => {
          if (seq !== detailSeqRef.current || !detailOpenRef.current) return;
          const safe = normalizeMemeRecord(detail, current);
          if (safe) setSelectedMeme(safe);
        })
        .catch(() => {});
    }
  };

  const handleDetailDelete = () => {
    detailSeqRef.current++;
    detailOpenRef.current = false;
    setDetailOpen(false);
    fetchMemes();
    fetchStats();
    fetchPersonas();
  };

  const handleUploadSuccess = () => {
    fetchMemes();
    fetchStats();
    fetchPersonas();
  };

  // Selection handlers
  const toggleSelectMeme = useCallback((memeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memeId)) next.delete(memeId);
      else next.add(memeId);
      return next;
    });
  }, []);

  const selectAllOnPage = () => {
    setSelectedIds(new Set(memes.map((m) => m.meme_id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Batch delete
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsBatchDeleting(true);
      const result = await memeApi.batchDelete(Array.from(selectedIds));
      if (result.failed.length === 0) {
        toast.success(t('aiMeme.batchDeleteSuccess', { count: result.success_count }));
      } else {
        toast.warning(
          t('aiMeme.batchDeletePartial', {
            success: result.success_count,
            failed: result.failed.length,
          }),
        );
      }
      setSelectedIds(new Set());
      setShowBatchDeleteDialog(false);
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (_error) {
      toast.error(t('aiMeme.batchDeleteFailed'));
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Batch export
  const handleBatchExport = async () => {
    if (selectedIds.size === 0) {
      toast.warning(t('aiMeme.batchExportNoSelection'));
      return;
    }
    try {
      setIsExporting(true);
      const blob = await memeApi.exportMemes(Array.from(selectedIds));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      a.download = `memes_${ts}.meme`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('aiMeme.batchExportSuccess'));
    } catch (_error) {
      toast.error(t('aiMeme.batchExportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  // Purge rejected
  const handlePurgeRejected = async () => {
    try {
      setIsPurging(true);
      const result = await memeApi.purgeRejected();
      if (result.purged_count === 0) {
        toast.info(t('aiMeme.purgeRejectedNone'));
      } else if (result.failed.length === 0) {
        toast.success(t('aiMeme.purgeRejectedSuccess', { count: result.purged_count }));
      } else {
        toast.warning(
          t('aiMeme.purgeRejectedPartial', {
            success: result.purged_count,
            failed: result.failed.length,
          }),
        );
      }
      setShowPurgeDialog(false);
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.purgeRejectedFailed')));
    } finally {
      setIsPurging(false);
    }
  };

  // 按条件清空：全部(purge_all) 或 当前筛选（status / folder / persona；不含语义搜索）
  const handlePurgeAll = async () => {
    try {
      setIsPurgingAll(true);

      const params: {
        confirm: true;
        purge_all?: boolean;
        status?: string;
        folder?: string;
        persona_hint?: string;
      } = { confirm: true };

      if (purgeScope === 'all') {
        params.purge_all = true;
      } else {
        if (filterStatus) params.status = filterStatus;
        if (filterFolder) {
          params.folder = filterFolder;
        } else if (filterPersona && filterPersona !== PERSONA_ALL) {
          params.persona_hint = filterPersona;
        }
        if (!params.status && !params.folder && !params.persona_hint) {
          toast.error(t('aiMeme.purgeFilteredNoFilter'));
          return;
        }
      }

      toast.info(t('aiMeme.purgeAllWorking'));
      const result = await memeApi.purge(params);
      if (result.purged_count === 0) {
        toast.info(t('aiMeme.purgeAllNone'));
      } else if (!result.failed?.length) {
        toast.success(t('aiMeme.purgeAllSuccess', { count: result.purged_count }));
      } else {
        toast.warning(
          t('aiMeme.purgeAllPartial', {
            success: result.purged_count,
            failed: result.failed.length,
          }),
        );
      }
      setShowPurgeAllDialog(false);
      setSelectedIds(new Set());
      setPage(1);
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.purgeAllFailed')));
    } finally {
      setIsPurgingAll(false);
    }
  };

  // Batch retag incomplete (active force mode)
  const handleBatchRetagIncomplete = async () => {
    try {
      setIsRetaggingPending(true);
      const selectedPack = filterPersona !== PERSONA_ALL ? filterPersona : undefined;
      const result = await memeApi.batchRetagIncomplete({
        mode: 'incomplete',
        pack_id: selectedPack,
      });
      const skipped = result.skipped_full ?? 0;
      if (skipped > 0) {
        toast.warning(t('aiMeme.batchRetagSkippedFull', { count: result.retag_count, skipped }));
      } else if (result.retag_count === 0) {
        toast.info(t('aiMeme.batchRetagIncompleteNone'));
      } else if (result.failed.length === 0) {
        toast.success(t('aiMeme.batchRetagIncompleteSuccess', { count: result.retag_count }));
      } else {
        toast.warning(
          t('aiMeme.batchRetagPendingPartial', {
            success: result.retag_count,
            failed: result.failed.length,
          }),
        );
      }
      setShowRetagPendingDialog(false);
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.batchRetagIncompleteFailed')));
    } finally {
      setIsRetaggingPending(false);
    }
  };

  // Batch retag selected
  const handleBatchRetagSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsBatchRetaggingSelected(true);
      const result = await memeApi.batchRetagIncomplete({
        mode: 'selected',
        meme_ids: Array.from(selectedIds),
      });
      const skipped = result.skipped_full ?? 0;
      if (skipped > 0) {
        toast.warning(t('aiMeme.batchRetagSkippedFull', { count: result.retag_count, skipped }));
      } else if (result.retag_count === 0) {
        toast.info(t('aiMeme.batchRetagIncompleteNone'));
      } else {
        toast.success(t('aiMeme.batchRetagIncompleteSuccess', { count: result.retag_count }));
      }
      setShowRetagSelectedDialog(false);
      setSelectedIds(new Set());
      fetchMemes();
      fetchStats();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.batchRetagIncompleteFailed')));
    } finally {
      setIsBatchRetaggingSelected(false);
    }
  };

  // Batch enable / disable
  const handleBatchSetEnabled = async (enabled: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      setIsBatchUpdating(true);
      const result = await memeApi.batchUpdate({
        meme_ids: Array.from(selectedIds),
        enabled,
      });
      toast.success(t('aiMeme.batchUpdateSuccess', { count: result.updated_count }));
      setSelectedIds(new Set());
      fetchMemes();
      fetchStats();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.batchUpdateFailed')));
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Batch add to pack
  const handleBatchAddToPack = async (packId: string) => {
    if (selectedIds.size === 0 || !packId) return;
    try {
      setIsBatchUpdating(true);
      const result = await memeApi.batchUpdate({
        meme_ids: Array.from(selectedIds),
        add_pack_id: packId,
      });
      toast.success(t('aiMeme.batchUpdateSuccess', { count: result.updated_count }));
      setSelectedIds(new Set());
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiMeme.batchUpdateFailed')));
    } finally {
      setIsBatchUpdating(false);
      setBatchPackSelectKey((k) => k + 1);
    }
  };

  const editablePacks = packs.filter((p) => !p.is_repo_pack);
  const editableUploadPersonas = editablePacks.map((pack) => ({
    persona_hint: pack.pack_id,
    count: pack.member_count,
    folder: pack.name,
  }));
  const activePackSummary =
    filterPersona !== PERSONA_ALL ? packs.find((p) => p.pack_id === filterPersona) : undefined;
  const incompleteCount = stats?.incomplete_count ?? 0;

  const totalPages = Math.ceil(total / pageSize);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <PinnedPage
      header={
        /* 标题与操作按钮底对齐。按钮行允许收缩换行，避免被裁出视口 */
        <div className="flex min-w-0 flex-col gap-3 md:gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 sm:overflow-x-auto">
            <h1 className="flex items-center gap-3 text-3xl font-bold sm:whitespace-nowrap">
              <ImageIcon className="h-8 w-8 shrink-0" />
              {t('aiMeme.title')}
            </h1>
            <p className="mt-1 text-muted-foreground sm:whitespace-nowrap">
              {t('aiMeme.description')}
            </p>
          </div>
          <div className={cn(headerActionRowClass, 'min-w-0 sm:flex-1')}>
            {filterStatus === 'rejected' && (
              <Button
                variant="destructive"
                onClick={() => setShowPurgeDialog(true)}
                className={cn(tabToolbarControlClass, 'gap-1.5 whitespace-nowrap')}
              >
                <Eraser className="w-4 h-4" />
                {t('aiMeme.purgeRejected')}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={isRetaggingPending}
              onClick={() => setShowRetagPendingDialog(true)}
              className={cn(tabToolbarControlClass, 'gap-1.5 whitespace-nowrap')}
            >
              <RotateCw className={cn('w-4 h-4', isRetaggingPending && 'animate-spin')} />
              <span>{t('aiMeme.batchRetagIncomplete')}</span>
              {!activePackSummary && incompleteCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-0.5 h-5 px-1.5 text-[10px] font-semibold tabular-nums bg-amber-500/15 text-amber-600 dark:text-amber-400"
                >
                  {incompleteCount}
                </Badge>
              )}
            </Button>
            {(stats?.total ?? total) > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setPurgeScope('filtered');
                  setShowPurgeAllDialog(true);
                }}
                disabled={isPurgingAll}
                className={cn(
                  tabToolbarControlClass,
                  'gap-1.5 whitespace-nowrap border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive',
                )}
              >
                <Trash2 className="w-4 h-4" />
                {t('aiMeme.purgeAll')}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                fetchMemes();
                fetchStats();
                fetchPersonas();
              }}
              className={cn(tabToolbarControlClass, 'gap-1.5 whitespace-nowrap')}
            >
              <RefreshCw className="w-4 h-4" />
              {t('aiMeme.refresh')}
            </Button>
            <Button
              onClick={() => setUploadOpen(true)}
              className={cn(tabToolbarControlClass, 'gap-1.5 whitespace-nowrap')}
            >
              <Upload className="w-4 h-4" />
              {t('aiMeme.upload.title')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowImportDotMemeDialog(true)}
              className={cn(tabToolbarControlClass, 'gap-1.5 whitespace-nowrap')}
              title={t('aiMeme.importDotMeme')}
            >
              <FileDown className="w-4 h-4" />
              <span>{t('aiMeme.importDotMeme')}</span>
            </Button>
            <Button
              variant="outline"
              onClick={openExportDialog}
              className={cn(tabToolbarControlClass, 'gap-1.5 whitespace-nowrap')}
              title={t('aiMeme.exportDotMeme')}
            >
              <FileUp className="w-4 h-4" />
              <span>{t('aiMeme.exportDotMeme')}</span>
            </Button>
          </div>
        </div>
      }
      toolbar={
        /* 筛选行：分段用默认高度，输入框和下拉 h-10，同行居中 */
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className={cn(tabToolbarGroupWrapClass, 'max-w-full')}>
            <TabButtonGroup
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v)}
              className="shrink-0"
              collapseOnMobile
              options={[
                {
                  value: 'tagged',
                  label: t('aiMeme.status.tagged'),
                  icon: <CheckCircle2 className="w-4 h-4" />,
                },
                {
                  value: 'pending',
                  label: t('aiMeme.status.pending'),
                  icon: <Clock className="w-4 h-4" />,
                },
                {
                  value: 'pending_manual',
                  label: t('aiMeme.status.pendingManual'),
                  icon: <AlertCircle className="w-4 h-4" />,
                },
                {
                  value: 'manual',
                  label: t('aiMeme.status.manual'),
                  icon: <Sparkles className="w-4 h-4" />,
                },
                {
                  value: 'rejected',
                  label: t('aiMeme.status.rejected'),
                  icon: <X className="w-4 h-4" />,
                },
                {
                  value: '',
                  label: t('aiMeme.filter.allStatus'),
                  icon: <Layers className="w-4 h-4" />,
                },
              ]}
            />
          </div>

          {/* Search */}
          <div className="relative min-w-[12rem] flex-1 basis-52">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('aiMeme.filter.searchPlaceholder')}
              className={cn(tabToolbarControlClass, 'w-full min-w-0 pl-9')}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                  setSearchInput('');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Persona Filter - drop-down of all personas the library has ever seen,
            ordered by count desc. Empty value = "all personas". */}
          <div className="min-w-[10rem] flex-1 basis-44">
            <Select value={filterPersona} onValueChange={(v) => setFilterPersona(v)}>
              <SelectTrigger
                className={cn(tabToolbarControlClass, 'w-full min-w-0 px-3 [&>span]:min-w-0')}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder={t('aiMeme.filter.persona')} />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONA_ALL}>{t('aiMeme.filter.allPersonas')}</SelectItem>
                {personas.map((p) => (
                  <SelectItem key={p.persona_hint} value={p.persona_hint}>
                    <span className="flex items-center gap-2">
                      <span className="truncate max-w-[160px]">{p.folder}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {p.count}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Select */}
          <div className="min-w-[9rem] flex-1 basis-40">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger
                className={cn(tabToolbarControlClass, 'w-full min-w-0 px-3 [&>span]:min-w-0')}
              >
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder={t('aiMeme.filter.sortBy')} />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at_desc">{t('aiMeme.filter.createdAtDesc')}</SelectItem>
                <SelectItem value="use_count_desc">{t('aiMeme.filter.useCountDesc')}</SelectItem>
                <SelectItem value="use_count_asc">{t('aiMeme.filter.useCountAsc')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {/* Batch Action Bar - shown when any items are selected */}
      {selectedIds.size > 0 && (
        <Card className="glass-card glass-alert glass-alert-tint glass-alert-tint-primary border-primary/35">
          <CardContent className="py-2.5 px-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size === memes.length && memes.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) selectAllOnPage();
                  else deselectAll();
                }}
              />
              <span className="text-sm font-medium">
                {t('aiMeme.selectedCount', { count: selectedIds.size })}
              </span>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllOnPage}
              className="h-7 text-xs gap-1"
            >
              {t('aiMeme.selectAll')}
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll} className="h-7 text-xs gap-1">
              {t('aiMeme.deselectAll')}
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleBatchSetEnabled(true)}
              disabled={isBatchUpdating}
              className="h-7 text-xs gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {t('aiMeme.batchEnable')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleBatchSetEnabled(false)}
              disabled={isBatchUpdating}
              className="h-7 text-xs gap-1"
            >
              <Ban className="w-3.5 h-3.5 text-muted-foreground" />
              {t('aiMeme.batchDisable')}
            </Button>
            {editablePacks.length > 0 && (
              <Select
                key={batchPackSelectKey}
                onValueChange={(packId) => void handleBatchAddToPack(packId)}
                disabled={isBatchUpdating}
              >
                <SelectTrigger className="h-7 w-auto min-w-[116px] text-xs px-2.5 gap-1">
                  <FolderPlus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder={t('aiMeme.batchAddPack')} />
                </SelectTrigger>
                <SelectContent>
                  {editablePacks.map((pack) => (
                    <SelectItem key={pack.pack_id} value={pack.pack_id}>
                      {pack.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRetagSelectedDialog(true)}
              disabled={isBatchRetaggingSelected}
              className="h-7 text-xs gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t('aiMeme.batchRetagSelected')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchExport}
              disabled={isExporting}
              className="h-7 text-xs gap-1"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {t('aiMeme.batchExport')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBatchDeleteDialog(true)}
              className="h-7 text-xs gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('aiMeme.batchDelete')}
            </Button>
          </CardContent>
        </Card>
      )}

      {(isLoadingStats || stats) && (
        <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6', pageGapClass)}>
          {isLoadingStats ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className={cn('glass-card')}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-7 w-12" />
                </CardContent>
              </Card>
            ))
          ) : stats ? (
            <>
              <StatCard
                icon={<Layers />}
                iconBgClass="bg-primary/10"
                iconClass="text-primary"
                label={t('aiMeme.stats.total')}
                value={stats.total}
              />
              <StatCard
                icon={<Zap />}
                iconBgClass="bg-amber-500/10"
                iconClass="text-amber-500"
                label={t('aiMeme.stats.totalUsage')}
                value={stats.total_usage}
              />
              <StatCard
                icon={<CheckCircle2 />}
                iconBgClass="bg-emerald-500/10"
                iconClass="text-emerald-500"
                label={t('aiMeme.stats.enabled')}
                value={stats.enabled_count ?? stats.total}
              />
              <StatCard
                icon={<Clock />}
                iconBgClass="bg-yellow-500/10"
                iconClass="text-yellow-500"
                label={t('aiMeme.stats.incomplete')}
                value={stats.incomplete_count ?? stats.status_counts.pending ?? 0}
              />
              <StatCard
                icon={<Sparkles />}
                iconBgClass="bg-blue-500/10"
                iconClass="text-blue-500"
                label={t('aiMeme.stats.tagged')}
                value={(stats.status_counts.tagged || 0) + (stats.status_counts.manual || 0)}
              />
              <StatCard
                icon={<AlertCircle />}
                iconBgClass="bg-red-500/10"
                iconClass="text-red-500"
                label={t('aiMeme.stats.rejected')}
                value={stats.status_counts.rejected || 0}
              />
            </>
          ) : null}
        </div>
      )}

      {/* Meme Grid */}
      {isLoading ? (
        <div
          className={cn(
            'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
            pageGapClass,
          )}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className={cn('glass-card')}>
              <Skeleton className="aspect-square w-full" />
              <CardContent className="space-y-2 p-3 sm:p-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : memes.length === 0 ? (
        <Card className={cn('glass-card')}>
          <CardContent className="!py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <p className="text-base font-medium text-muted-foreground">{t('aiMeme.noMemes')}</p>
              <p className="text-sm text-muted-foreground/70 mt-1">{t('aiMeme.noMemesDesc')}</p>
              <Button className="mt-4 gap-1.5" onClick={() => setUploadOpen(true)}>
                <Upload className="w-4 h-4" />
                {t('aiMeme.upload.title')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className={cn(
              'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
              pageGapClass,
            )}
          >
            {memes.map((meme) => (
              <MemeCard
                key={meme.meme_id}
                meme={meme}
                onClick={handleMemeClick}
                selected={selectedIds.has(meme.meme_id)}
                onToggleSelect={toggleSelectMeme}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{t('common.totalRecords', { total })}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  {t('common.firstPage')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  {t('common.previousPage')}
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  {t('common.pageInfo', { current: page, total: totalPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t('common.nextPage')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                >
                  {t('common.lastPage')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Right-side Edit Sheet */}
      <MemeEditSheet
        meme={selectedMeme}
        packs={packs}
        open={detailOpen}
        onClose={() => {
          detailSeqRef.current++;
          detailOpenRef.current = false;
          setDetailOpen(false);
        }}
        onUpdate={handleDetailUpdate}
        onDelete={handleDetailDelete}
      />

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        personas={editableUploadPersonas}
        onPackCreated={(pack) => {
          setPersonas((prev) =>
            prev.some((p) => p.persona_hint === pack.persona_hint) ? prev : [...prev, pack],
          );
          setPacks((prev) =>
            prev.some((p) => p.pack_id === pack.persona_hint)
              ? prev
              : [
                  ...prev,
                  {
                    pack_id: pack.persona_hint,
                    name: pack.folder,
                    member_count: 0,
                    tagged_count: 0,
                    bound_personas: [],
                    is_repo_pack: false,
                  },
                ],
          );
        }}
      />

      {/* Batch Delete Confirm Dialog */}
      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.batchDeleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiMeme.batchDeleteConfirmDesc', { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isBatchDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBatchDeleting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge Rejected Confirm Dialog */}
      <AlertDialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.purgeRejectedConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiMeme.purgeRejectedConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurgeRejected}
              disabled={isPurging}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPurging && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge All / Filtered Confirm Dialog */}
      <AlertDialog
        open={showPurgeAllDialog}
        onOpenChange={(open) => !isPurgingAll && setShowPurgeAllDialog(open)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.purgeAllConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('aiMeme.purgeAllConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup
            value={purgeScope}
            onValueChange={(v) => setPurgeScope(v as 'filtered' | 'all')}
            className="gap-3 py-2"
            disabled={isPurgingAll}
          >
            <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="filtered" id="purge-scope-filtered" className="mt-0.5" />
              <span className="text-sm leading-snug">
                {t('aiMeme.purgeScopeFiltered', { count: total })}
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40">
              <RadioGroupItem value="all" id="purge-scope-all" className="mt-0.5" />
              <span className="text-sm leading-snug">
                {t('aiMeme.purgeScopeAll', { count: stats?.total ?? total })}
              </span>
            </label>
          </RadioGroup>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPurgingAll}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handlePurgeAll();
              }}
              disabled={isPurgingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPurgingAll && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Retag Incomplete Confirm Dialog */}
      <AlertDialog
        open={showRetagPendingDialog}
        onOpenChange={(next) => !isRetaggingPending && setShowRetagPendingDialog(next)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.batchRetagIncompleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {activePackSummary
                ? t('aiMeme.batchRetagIncompleteConfirmPackDesc', { pack: activePackSummary.name })
                : t('aiMeme.batchRetagIncompleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRetaggingPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleBatchRetagIncomplete();
              }}
              disabled={isRetaggingPending}
            >
              {isRetaggingPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Retag Selected Confirm Dialog */}
      <AlertDialog
        open={showRetagSelectedDialog}
        onOpenChange={(next) => !isBatchRetaggingSelected && setShowRetagSelectedDialog(next)}
      >
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.batchRetagSelectedConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiMeme.batchRetagSelectedConfirmDesc', { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchRetaggingSelected}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleBatchRetagSelected();
              }}
              disabled={isBatchRetaggingSelected}
            >
              {isBatchRetaggingSelected && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>{t('aiMeme.exportDotMemeTitle')}</DialogTitle>
            <DialogDescription>{t('aiMeme.exportDotMemeDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 min-w-0">
            <Label>{t('aiMeme.exportDotMemePack')}</Label>
            <Select value={exportPackId} onValueChange={setExportPackId}>
              <SelectTrigger className="h-10 w-full min-w-0 py-0 text-sm [&>span]:min-w-0 [&>span]:truncate">
                <SelectValue placeholder={t('aiMeme.exportDotMemePack')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONA_ALL}>{t('aiMeme.filter.allPersonas')}</SelectItem>
                {personas.map((pack) => (
                  <SelectItem key={pack.persona_hint} value={pack.persona_hint}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{pack.folder}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {pack.count}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => void handleExportDotMeme()}
              disabled={isExporting || !exportPackId}
            >
              {isExporting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('aiMeme.exportDotMeme')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* .meme 导入对话框 */}
      <Dialog open={showImportDotMemeDialog} onOpenChange={setShowImportDotMemeDialog}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>{t('aiMeme.importDotMemeTitle')}</DialogTitle>
            <DialogDescription>{t('aiMeme.importDotMemeDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 min-w-0">
            <Input
              type="file"
              accept=".meme,.zip,application/octet-stream,application/zip"
              onChange={(e) => setImportDotMemeFile(e.target.files?.[0] ?? null)}
            />
            <Input
              className="h-9"
              placeholder={t('aiMeme.importDotMemePersonaHint') ?? ''}
              value={importDotMemePersonaHint}
              onChange={(e) => setImportDotMemePersonaHint(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3 md:gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={importDotMemeSkip} onCheckedChange={setImportDotMemeSkip} />
                {t('aiMeme.importDotMemeSkipExisting')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={importDotMemeAutoTag} onCheckedChange={setImportDotMemeAutoTag} />
                {t('aiMeme.importDotMemeAutoTag')}
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowImportDotMemeDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleImportDotMeme} disabled={importingDotMeme}>
              {importingDotMeme && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('aiMeme.importDotMemeSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
