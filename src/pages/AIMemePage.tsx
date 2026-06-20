import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
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
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import {
  Image as ImageIcon,
  Search,
  Upload,
  Trash2,
  RefreshCw,
  FolderOpen,
  Clock,
  Users,
  FileImage,
  Sparkles,
  Loader2,
  X,
  Move,
  Eye,
  TrendingUp,
  Zap,
  AlertCircle,
  CheckCircle2,
  Layers,
  Download,
  FileUp,
  Eraser,
  RotateCw,
} from 'lucide-react';
import { memeApi, MemeRecord, MemeStatsData, MemeListParams, MemePersona } from '@/lib/api';
import { toast } from 'sonner';

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

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  icon,
  iconBgClass,
  iconClass,
  label,
  value,
  isGlass,
}: {
  icon: React.ReactNode;
  iconBgClass: string;
  iconClass: string;
  label: string;
  value: number | string;
  isGlass: boolean;
}) {
  return (
    <Card className={cn(
      "transition-all duration-300 hover:shadow-md",
      isGlass && "glass-card"
    )}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          iconBgClass
        )}>
          <div className={cn("w-5 h-5", iconClass)}>{icon}</div>
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
  isGlass,
  selected,
  onToggleSelect,
}: {
  meme: MemeRecord;
  onClick: (meme: MemeRecord) => void;
  isGlass: boolean;
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
      { rootMargin: '300px', threshold: 0 }
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
        const token = localStorage.getItem('auth_token');
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
          if (cancelled) { bmp.close?.(); return; }
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

  return (
    <Card
      ref={cardRef}
      className={cn(
        "group cursor-pointer transition-[transform,box-shadow] duration-300 hover:shadow-lg hover:scale-[1.02] overflow-hidden",
        // glass-card-flat: keeps the translucent look but drops the per-card
        // backdrop-filter blur, which is very expensive across a 24-item grid.
        isGlass && "glass-card-flat",
        selected && "ring-2 ring-primary shadow-lg"
      )}
      onClick={() => onClick(meme)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image - lazy render via IntersectionObserver for GIF performance */}
      <div className="relative aspect-square bg-muted/30 overflow-hidden">
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
            {/* Loading placeholder until the downscaled thumbnail is painted */}
            {!snapshotReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Skeleton className="w-full h-full absolute" />
                <ImageIcon className="w-8 h-8 text-muted-foreground/30 relative z-10" />
              </div>
            )}
            {/* Lightweight downscaled thumbnail (used for every card) */}
            <canvas
              ref={canvasRef}
              aria-hidden
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-[transform,opacity] duration-300 group-hover:scale-105",
                snapshotReady ? "opacity-100" : "opacity-0"
              )}
            />
            {/* Full-resolution animated image - mounted only while hovered, so the
                grid plays at most one GIF at a time and never decodes 24 at once. */}
            {showLiveImg && (
              <img
                src={blobUrl || undefined}
                alt={meme.description || meme.meme_id}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImgError(true)}
                decoding="async"
              />
            )}
          </>
        )}
        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0.5",
              statusColorMap[meme.status] || 'bg-muted/80'
            )}
          >
            {t(`aiMeme.status.${meme.status}`)}
          </Badge>
        </div>
        {/* Selection checkbox - always visible, click stops propagation */}
        <div
          className="absolute top-2 right-2 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(meme.meme_id);
          }}
        >
          <div className={cn(
            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 cursor-pointer",
            selected
              ? "bg-primary border-primary shadow-sm"
              : "bg-white/80 dark:bg-black/60 border-white/50 dark:border-white/25 opacity-0 group-hover:opacity-100 hover:border-primary/60"
          )}>
            {selected && (
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
        {/* Use count overlay - bottom right when not selected */}
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
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center">
              <Eye className="w-5 h-5 text-foreground" />
            </div>
          </div>
        </div>
      </div>
      {/* Info */}
      <CardContent className="p-3 space-y-1.5">
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
          {meme.description || t('aiMeme.card.noDescription')}
        </p>
        <div className="flex flex-wrap gap-1">
          {/* Image format (PNG / GIF / JPG ...) - color-coded for quick scanning */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 h-5 font-mono font-medium",
              formatTypeColorMap[formatImageType(meme.file_mime)] ||
                'bg-muted text-muted-foreground/80 border-border'
            )}
          >
            {formatImageType(meme.file_mime)}
          </Badge>
          {meme.emotion_tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-5"
            >
              {tag}
            </Badge>
          ))}
          {meme.emotion_tags.length > 3 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              +{meme.emotion_tags.length - 3}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <FolderOpen className="w-3 h-3" />
            {meme.folder}
          </span>
          {meme.use_count > 0 && (
            <span>{t('aiMeme.card.useCount', { count: meme.use_count })}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Detail Dialog
// ============================================================================

function MemeDetailDialog({
  meme,
  open,
  onClose,
  onUpdate,
  onDelete,
  isGlass,
}: {
  meme: MemeRecord | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  isGlass: boolean;
}) {
  const { t } = useLanguage();
  const [editDescription, setEditDescription] = useState('');
  const [editEmotionTags, setEditEmotionTags] = useState<string[]>([]);
  const [editSceneTags, setEditSceneTags] = useState<string[]>([]);
  const [editCustomTags, setEditCustomTags] = useState<string[]>([]);
  const [editPersonaHint, setEditPersonaHint] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isRetagging, setIsRetagging] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showRetagDialog, setShowRetagDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  useEffect(() => {
    if (meme) {
      setEditDescription(meme.description || '');
      setEditEmotionTags([...meme.emotion_tags]);
      setEditSceneTags([...meme.scene_tags]);
      setEditCustomTags([...meme.custom_tags]);
      setEditPersonaHint(meme.persona_hint || '');
      setMoveTarget(meme.folder);
    }
  }, [meme]);

  const [detailBlobUrl, setDetailBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!meme || !open) return;
    let revoked = false;
    const controller = new AbortController();
    const fetchImage = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const base = memeApi.getImageUrl(meme.meme_id);
        const resp = await fetch(base, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
          signal: controller.signal,
        });
        if (!resp.ok || revoked) return;
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        if (!revoked) setDetailBlobUrl(url);
      } catch {
        // ignore
      }
    };
    fetchImage();
    return () => {
      revoked = true;
      controller.abort();
    };
  }, [meme?.meme_id, open]);

  useEffect(() => {
    return () => {
      if (detailBlobUrl) URL.revokeObjectURL(detailBlobUrl);
    };
  }, [detailBlobUrl]);

  if (!meme) return null;

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await memeApi.update(meme.meme_id, {
        description: editDescription,
        emotion_tags: editEmotionTags,
        scene_tags: editSceneTags,
        custom_tags: editCustomTags,
        persona_hint: editPersonaHint,
      });
      toast.success(t('aiMeme.detail.updateSuccess'));
      onUpdate();
    } catch (error) {
      toast.error(t('aiMeme.detail.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetag = async () => {
    try {
      setIsRetagging(true);
      await memeApi.retag(meme.meme_id);
      toast.success(t('aiMeme.detail.retagSuccess'));
      setShowRetagDialog(false);
      onUpdate();
    } catch (error) {
      toast.error(t('aiMeme.detail.retagFailed'));
    } finally {
      setIsRetagging(false);
    }
  };

  const handleMove = async () => {
    if (!moveTarget.trim()) return;
    try {
      setIsMoving(true);
      await memeApi.move(meme.meme_id, moveTarget.trim());
      toast.success(t('aiMeme.detail.moveSuccess', { folder: moveTarget }));
      setShowMoveDialog(false);
      onUpdate();
    } catch (error) {
      toast.error(t('aiMeme.detail.moveFailed'));
    } finally {
      setIsMoving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await memeApi.delete(meme.meme_id);
      toast.success(t('aiMeme.detail.deleteSuccess'));
      setShowDeleteDialog(false);
      onDelete();
    } catch (error) {
      toast.error(t('aiMeme.detail.deleteFailed'));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
            {/* Left: Image Preview */}
            <div className="md:w-1/2 bg-muted/20 flex items-center justify-center p-4 min-h-[300px] md:min-h-0">
              <img
                src={detailBlobUrl || undefined}
                alt={meme.description || meme.meme_id}
                className="max-w-full max-h-[400px] md:max-h-[70vh] object-contain rounded-lg"
              />
            </div>

            {/* Right: Info & Edit */}
            <div className="md:w-1/2 flex flex-col min-h-0">
              <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  {t('aiMeme.detail.title')}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {meme.meme_id} · {meme.width}×{meme.height} · {formatFileSize(meme.file_size)}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 min-h-0 px-5">
                <div className="space-y-3 pb-3">
                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{t('aiMeme.detail.description')}</Label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder={t('aiMeme.detail.descriptionPlaceholder')}
                      className="min-h-[60px] text-sm resize-none"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-2.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{t('aiMeme.detail.emotionTags')}</Label>
                      <TagsInput
                        value={editEmotionTags}
                        onChange={setEditEmotionTags}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{t('aiMeme.detail.sceneTags')}</Label>
                      <TagsInput
                        value={editSceneTags}
                        onChange={setEditSceneTags}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">{t('aiMeme.detail.customTags')}</Label>
                      <TagsInput
                        value={editCustomTags}
                        onChange={setEditCustomTags}
                      />
                    </div>
                  </div>

                  {/* Persona Hint */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      {t('aiMeme.detail.personaHint')}
                    </Label>
                    <Input
                      value={editPersonaHint}
                      onChange={(e) => setEditPersonaHint(e.target.value)}
                      placeholder={t('aiMeme.detail.personaHintPlaceholder')}
                      className="h-8 text-sm"
                    />
                  </div>

                  <Separator className="bg-border/30" />

                  {/* File Info & Usage Stats - compact grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <FileImage className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t('aiMeme.detail.fileSize')}:</span>
                      <span className="font-medium truncate">{formatFileSize(meme.file_size)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">{t('aiMeme.detail.dimensions')}:</span>
                      <span className="font-medium">{meme.width}×{meme.height}</span>
                    </div>
                    <div className="flex items-center gap-1.5 col-span-2">
                      <span className="text-muted-foreground">{t('aiMeme.detail.mimeType')}:</span>
                      <span className="font-medium truncate">{meme.file_mime}</span>
                    </div>
                  </div>

                  <Separator className="bg-border/30" />

                  {/* Usage Stats - compact */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t('aiMeme.detail.useCount')}:</span>
                      <span className="font-bold text-primary">{meme.use_count}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">
                        {meme.last_used_at ? formatDateTime(meme.last_used_at) : t('aiMeme.detail.never')}
                      </span>
                    </div>
                    {meme.last_used_group && (
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{t('aiMeme.detail.lastUsedGroup')}:</span>
                        <span className="font-medium">{meme.last_used_group}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-border/30" />

                  {/* Timestamps - compact */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span>{t('aiMeme.detail.createdAt')}</span>
                    </div>
                    <div className="text-right">{formatDateTime(meme.created_at)}</div>
                    {meme.tagged_at && (
                      <>
                        <div className="flex items-center gap-1">
                          <span>{t('aiMeme.detail.taggedAt')}</span>
                        </div>
                        <div className="text-right">{formatDateTime(meme.tagged_at)}</div>
                      </>
                    )}
                    <div className="flex items-center gap-1">
                      <span>{t('aiMeme.detail.updatedAt')}</span>
                    </div>
                    <div className="text-right">{formatDateTime(meme.updated_at)}</div>
                  </div>
                </div>
              </ScrollArea>

              {/* Action Buttons - single row, no wrap */}
              <div className="px-5 py-3 border-t border-border/30 flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-1.5 h-8 text-xs"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {t('common.save')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMoveDialog(true)}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Move className="w-3.5 h-3.5" />
                  {t('aiMeme.detail.moveToFolder')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowRetagDialog(true)}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('aiMeme.detail.retag')}
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-1.5 h-8 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('aiMeme.detail.moveToFolder')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>{t('aiMeme.detail.targetFolder')}</Label>
            <Input
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              placeholder="common"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleMove} disabled={isMoving || !moveTarget.trim()}>
              {isMoving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retag Confirm Dialog */}
      <AlertDialog open={showRetagDialog} onOpenChange={setShowRetagDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.detail.retagConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiMeme.detail.retagConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetag} disabled={isRetagging}>
              {isRetagging && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.detail.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiMeme.detail.deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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

function UploadDialog({
  open,
  onClose,
  onSuccess,
  isGlass,
  personas,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isGlass: boolean;
  personas: MemePersona[];
}) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>([]);
  // Target persona for this upload. We store the literal `persona_hint` value
  // (`'common'` or any real persona name) directly; the `<Select>` it feeds
  // uses unique non-empty string values, so no Radix sentinel dance is needed
  // here. Defaults to `common` (public).
  const [personaHint, setPersonaHint] = useState('common');
  const [autoTag, setAutoTag] = useState(true);
  const [skipExisting, setSkipExisting] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  const isImage = (f: File) => ACCEPTED_TYPES.includes(f.type) || /\.(jpe?g|png|gif|webp)$/i.test(f.name);
  const isMeme = (f: File) => f.name.endsWith('.meme');

  const imageFiles = files.filter(isImage);
  const memeFiles = files.filter(isMeme);

  const handleFilesSelect = (selectedFiles: FileList | File[]) => {
    const arr = Array.from(selectedFiles);
    const valid = arr.filter(f => isImage(f) || isMeme(f));
    if (valid.length === 0) {
      toast.error(t('aiMeme.upload.dragDropHint'));
      return;
    }
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelect(e.dataTransfer.files);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    let success = 0;
    let failed = 0;

    // Normalize the persona value the user picked. We never send an empty
    // string to the backend - empty means "no preference" for image upload
    // (the original backend behaviour when `folder` is omitted) and is
    // handled accordingly below.
    const persona = personaHint.trim();

    // Upload images one by one. For images the backend takes a `folder`
    // parameter; we map our persona selection onto it (folder ↔ persona_hint
    // is bijective on the server side).
    for (const f of imageFiles) {
      try {
        await memeApi.upload(f, persona || 'common', autoTag);
        success++;
      } catch {
        failed++;
      }
    }

    // Import .meme files one by one. Pass the persona hint through to the
    // import endpoint so all memes in the archive land in the chosen
    // persona's folder. An empty `persona` leaves backend behaviour intact
    // (use the original metadata.json folder / persona_hint).
    for (const f of memeFiles) {
      try {
        await memeApi.importMemes(f, skipExisting, autoTag, persona || undefined);
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
    setAutoTag(true);
    setSkipExisting(true);
    onClose();
  };

  const fileCount = files.length;
  const hasFiles = fileCount > 0;
  const hasMeme = memeFiles.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {t('aiMeme.upload.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drop Zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-xl text-center transition-all duration-300 cursor-pointer",
              isDragOver
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
              hasFiles ? "p-4" : "p-8"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
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
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {files.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-left">
                    {isImage(f) ? (
                      <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <FileUp className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs truncate flex-1">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatFileSize(f.size)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground pt-1">
                  {imageFiles.length > 0 && t('aiMeme.upload.dragDropHint')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('aiMeme.upload.dragDrop')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('aiMeme.upload.dragDropHint')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Target Persona - shown for both image and .meme uploads. The
              default `common` means "public memes". Users can pick from the
              existing personas (provided by /api/meme/personas) or type a
              brand-new persona name; the backend creates the folder on demand
              and keeps folder ↔ persona_hint bijective. The `common` entry is
              deduplicated against the personas list so the dropdown only shows
              it once even when the backend reports it as the top result. */}
          {(imageFiles.length > 0 || hasMeme) && (
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                {t('aiMeme.upload.targetPersona')}
              </Label>
              <Select value={personaHint} onValueChange={setPersonaHint}>
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder={t('aiMeme.upload.targetPersona')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="common">{t('aiMeme.filter.commonPersona')}</SelectItem>
                  {personas
                    .filter((p) => p.persona_hint !== 'common')
                    .map((p) => (
                      <SelectItem key={p.persona_hint} value={p.persona_hint}>
                        <span className="flex items-center gap-2">
                          <span className="truncate max-w-[200px]">{p.persona_hint}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {p.count}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {t('aiMeme.upload.targetPersonaDesc')}
              </p>
            </div>
          )}

          {/* Skip Existing Toggle (only for .meme) */}
          {hasMeme && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm font-medium">{t('aiMeme.upload.skipExisting')}</p>
                <p className="text-xs text-muted-foreground">{t('aiMeme.upload.skipExistingDesc')}</p>
              </div>
              <Switch checked={skipExisting} onCheckedChange={setSkipExisting} />
            </div>
          )}

          {/* Auto Tag Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('aiMeme.upload.autoTag')}</p>
                <p className="text-xs text-muted-foreground">{t('aiMeme.upload.autoTagDesc')}</p>
              </div>
            </div>
            <Switch checked={autoTag} onCheckedChange={setAutoTag} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleUpload} disabled={!hasFiles || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                {t('aiMeme.upload.uploading')}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1.5" />
                {t('aiMeme.upload.selectFile')} ({fileCount})
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
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // State
  const [memes, setMemes] = useState<MemeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(24);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<MemeStatsData | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Persona filter
  const [personas, setPersonas] = useState<MemePersona[]>([]);
  // Radix Select disallows empty-string values on <SelectItem>, so we use a
  // sentinel value and translate it back to '' (== "no persona filter") when
  // building the request.
  const PERSONA_ALL = '__all__';
  const [filterPersona, setFilterPersona] = useState<string>(PERSONA_ALL);

  // Filters
  const [filterFolder, setFilterFolder] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('tagged');
  const [sortBy, setSortBy] = useState<SortOption>('created_at_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialogs
  const [selectedMeme, setSelectedMeme] = useState<MemeRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);

  // Purge / Retag
  const [isPurging, setIsPurging] = useState(false);
  const [isRetaggingPending, setIsRetaggingPending] = useState(false);
  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [showRetagPendingDialog, setShowRetagPendingDialog] = useState(false);

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
      if (filterPersona && filterPersona !== PERSONA_ALL) params.persona_hint = filterPersona;

      const data = await memeApi.getList(params);
      setMemes(data.records);
      setTotal(data.total);
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
      console.error('Failed to fetch meme stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  const fetchPersonas = useCallback(async () => {
    try {
      const data = await memeApi.getPersonas();
      setPersonas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch meme personas:', error);
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

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterFolder, filterStatus, filterPersona, sortBy]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleMemeClick = useCallback(async (meme: MemeRecord) => {
    try {
      const detail = await memeApi.getDetail(meme.meme_id);
      setSelectedMeme(detail);
    } catch {
      setSelectedMeme(meme);
    }
    setDetailOpen(true);
  }, []);

  const handleDetailUpdate = () => {
    fetchMemes();
    fetchStats();
    fetchPersonas();
    // Refresh selected meme
    if (selectedMeme) {
      memeApi.getDetail(selectedMeme.meme_id).then(setSelectedMeme).catch(() => {});
    }
  };

  const handleDetailDelete = () => {
    setDetailOpen(false);
    setSelectedMeme(null);
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
          })
        );
      }
      setSelectedIds(new Set());
      setShowBatchDeleteDialog(false);
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (error) {
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
    } catch (error) {
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
        toast.warning(t('aiMeme.purgeRejectedPartial', { success: result.purged_count, failed: result.failed.length }));
      }
      setShowPurgeDialog(false);
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (error) {
      toast.error(t('aiMeme.purgeRejectedFailed'));
    } finally {
      setIsPurging(false);
    }
  };

  // Batch retag pending_manual
  const handleBatchRetagPending = async () => {
    try {
      setIsRetaggingPending(true);
      const result = await memeApi.batchRetagPending();
      if (result.retag_count === 0) {
        toast.info(t('aiMeme.batchRetagPendingNone'));
      } else if (result.failed.length === 0) {
        toast.success(t('aiMeme.batchRetagPendingSuccess', { count: result.retag_count }));
      } else {
        toast.warning(t('aiMeme.batchRetagPendingPartial', { success: result.retag_count, failed: result.failed.length }));
      }
      setShowRetagPendingDialog(false);
      fetchMemes();
      fetchStats();
      fetchPersonas();
    } catch (error) {
      toast.error(t('aiMeme.batchRetagPendingFailed'));
    } finally {
      setIsRetaggingPending(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize);


  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="p-4 sm:p-6 space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <ImageIcon className="w-8 h-8 shrink-0" />
            {t('aiMeme.title')}
          </h1>
          <p className="whitespace-nowrap text-sm text-muted-foreground mt-1">{t('aiMeme.description')}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
          {filterStatus === 'rejected' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowPurgeDialog(true)}
              className="gap-1.5 whitespace-nowrap"
            >
              <Eraser className="w-4 h-4" />
              {t('aiMeme.purgeRejected')}
            </Button>
          )}
          {filterStatus === 'pending_manual' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRetagPendingDialog(true)}
              className="gap-1.5 whitespace-nowrap"
            >
              <RotateCw className="w-4 h-4" />
              {t('aiMeme.batchRetagPending')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchMemes(); fetchStats(); fetchPersonas(); }}
            className="gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            {t('aiMeme.refresh')}
          </Button>
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            {t('aiMeme.upload.title')}
          </Button>
        </div>
      </div>

      {/* Batch Action Bar - shown when any items are selected */}
      {selectedIds.size > 0 && (
        <Card className={cn(
          "border-primary/30 bg-primary/5",
          isGlass && "glass-card"
        )}>
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
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              className="h-7 text-xs gap-1"
            >
              {t('aiMeme.deselectAll')}
            </Button>
            <div className="flex-1" />
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

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoadingStats ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className={cn(isGlass && "glass-card")}>
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
              isGlass={isGlass}
            />
            <StatCard
              icon={<Zap />}
              iconBgClass="bg-amber-500/10"
              iconClass="text-amber-500"
              label={t('aiMeme.stats.totalUsage')}
              value={stats.total_usage}
              isGlass={isGlass}
            />
            <StatCard
              icon={<Clock />}
              iconBgClass="bg-yellow-500/10"
              iconClass="text-yellow-500"
              label={t('aiMeme.stats.pending')}
              value={stats.status_counts.pending || 0}
              isGlass={isGlass}
            />
            <StatCard
              icon={<CheckCircle2 />}
              iconBgClass="bg-green-500/10"
              iconClass="text-green-500"
              label={t('aiMeme.stats.tagged')}
              value={stats.status_counts.tagged || 0}
              isGlass={isGlass}
            />
            <StatCard
              icon={<Sparkles />}
              iconBgClass="bg-blue-500/10"
              iconClass="text-blue-500"
              label={t('aiMeme.stats.manual')}
              value={stats.status_counts.manual || 0}
              isGlass={isGlass}
            />
            <StatCard
              icon={<AlertCircle />}
              iconBgClass="bg-red-500/10"
              iconClass="text-red-500"
              label={t('aiMeme.stats.rejected')}
              value={stats.status_counts.rejected || 0}
              isGlass={isGlass}
            />
          </>
        ) : null}
      </div>

      {/* Filter Bar - single row: TabButtonGroup + Search + Sort */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Tab Filter */}
        <TabButtonGroup
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v)}
          className="shrink-0"
          options={[
            { value: 'tagged', label: t('aiMeme.status.tagged'), icon: <CheckCircle2 className="w-4 h-4" /> },
            { value: 'pending', label: t('aiMeme.status.pending'), icon: <Clock className="w-4 h-4" /> },
            { value: 'pending_manual', label: t('aiMeme.status.pendingManual'), icon: <AlertCircle className="w-4 h-4" /> },
            { value: 'manual', label: t('aiMeme.status.manual'), icon: <Sparkles className="w-4 h-4" /> },
            { value: 'rejected', label: t('aiMeme.status.rejected'), icon: <X className="w-4 h-4" /> },
            { value: '', label: t('aiMeme.filter.allStatus'), icon: <Layers className="w-4 h-4" /> },
          ]}
        />

        {/* Search */}
        <div className={cn(
          "relative w-52 rounded-lg border border-border/40 overflow-hidden transition-all duration-200",
          isGlass ? "glass-card" : "bg-muted/50"
        )}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('aiMeme.filter.searchPlaceholder')}
            className="h-11 pl-10 pr-9 text-sm bg-transparent border-0 rounded-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Persona Filter - drop-down of all personas the library has ever seen,
            ordered by count desc. Empty value = "all personas". */}
        <div className={cn(
          "rounded-lg border border-border/40 overflow-hidden transition-all duration-200",
          isGlass ? "glass-card" : "bg-muted/50"
        )}>
          <Select
            value={filterPersona}
            onValueChange={(v) => setFilterPersona(v)}
          >
            <SelectTrigger className="w-auto min-w-[180px] max-w-[260px] h-11 text-sm whitespace-nowrap bg-transparent border-0 rounded-none shadow-none focus:ring-0 focus:ring-offset-0">
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
                    <span className="truncate max-w-[160px]">{p.persona_hint}</span>
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
        <div className={cn(
          "rounded-lg border border-border/40 overflow-hidden transition-all duration-200",
          isGlass ? "glass-card" : "bg-muted/50"
        )}>
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortOption)}
          >
            <SelectTrigger className="w-auto min-w-[160px] h-11 text-sm whitespace-nowrap bg-transparent border-0 rounded-none shadow-none focus:ring-0 focus:ring-offset-0">
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

      {/* Meme Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className={cn("overflow-hidden", isGlass && "glass-card")}>
              <Skeleton className="aspect-square w-full" />
              <CardContent className="p-3 space-y-2">
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
        <Card className={cn(isGlass && "glass-card")}>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <p className="text-base font-medium text-muted-foreground">{t('aiMeme.noMemes')}</p>
              <p className="text-sm text-muted-foreground/70 mt-1">{t('aiMeme.noMemesDesc')}</p>
              <Button
                className="mt-4 gap-1.5"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="w-4 h-4" />
                {t('aiMeme.upload.title')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {memes.map((meme) => (
              <MemeCard
                key={meme.meme_id}
                meme={meme}
                onClick={handleMemeClick}
                isGlass={isGlass}
                selected={selectedIds.has(meme.meme_id)}
                onToggleSelect={toggleSelectMeme}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {t('common.totalRecords', { total })}
              </p>
              <div className="flex items-center gap-2">
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
                  onClick={() => setPage(p => Math.max(1, p - 1))}
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
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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

      {/* Detail Dialog */}
      <MemeDetailDialog
        meme={selectedMeme}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedMeme(null); }}
        onUpdate={handleDetailUpdate}
        onDelete={handleDetailDelete}
        isGlass={isGlass}
      />

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={handleUploadSuccess}
        isGlass={isGlass}
        personas={personas}
      />

      {/* Batch Delete Confirm Dialog */}
      <AlertDialog open={showBatchDeleteDialog} onOpenChange={setShowBatchDeleteDialog}>
        <AlertDialogContent>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.purgeRejectedConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiMeme.purgeRejectedConfirmDesc')}
            </AlertDialogDescription>
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

      {/* Batch Retag Pending Confirm Dialog */}
      <AlertDialog open={showRetagPendingDialog} onOpenChange={setShowRetagPendingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMeme.batchRetagPendingConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiMeme.batchRetagPendingConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchRetagPending}
              disabled={isRetaggingPending}
            >
              {isRetaggingPending && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
